import * as THREE from 'three';
import { BallPhysics } from '../Physics/BallPhysics.js';
import { BallRenderer } from './BallRenderer.js';
import { WorldBounds } from './WorldBounds.js';
import { ChaseCamera } from '../Controller/ChaseCamera.js';
import { OrbitCamera } from '../Controller/OrbitCamera.js'
import { CourseDecorations } from './CourseDecorations.js';
import { TrajectoryPreview } from './TrajectoryPreview.js';
import { buildDefaultShot, isDefaultShotParams } from './DefaultShot.js';
import { computeLaunchVelocity, getAimYawRad } from './ShotAiming.js';
import { ZONE } from '../GolfCourse.js';

const CUP_RADIUS = 0.38;
const MAX_SWING_PULL = 1.0;
const SWING_DURATION = 0.24;

const PHASE = {
    IDLE: 'idle',
    CHARGING: 'charging',
    SWINGING: 'swinging',
};

export class GolfGame {
    constructor(options) {
        this.scene = options.scene;
        this.camera = options.camera;
        this.course = options.course;
        this.dashboard = options.dashboard;
        this.flyController = options.flyController;

        this.physics = new BallPhysics();
        this.physics.setGroundCallbacks(
            (x, z) => this.course.getHeightAt(x, z)
            );

        this.ball = new BallRenderer(this.scene, this.physics.R);
        this.chaseCamera = new ChaseCamera(this.camera);
        this.orbitCamera = new OrbitCamera(this.camera);
        this.decorations = new CourseDecorations(this.scene, this.course);
        this.trajectory = new TrajectoryPreview(this.scene);

        this.bounds = new WorldBounds({
            halfWidth: this.course.opt.width / 2,
            halfDepth: this.course.opt.depth / 2,
            margin: 1,
            minCameraY: 0.1,
        });
        this.bounds.setGroundHeightFn((x, z) => this.course.getHeightAt(x, z));

        this.teePosition = this.resolveTeePosition();
        this.holePosition = this.resolveHolePosition();
        this.defaultShot = buildDefaultShot(this.teePosition);

        this.lastShotWasDefault = true;
        this.wasMoving = false;
        this.inCup = false;
        this.atTee = true;

        this.phase = PHASE.IDLE;
        this.swingPull = 0;
        this.swingTimer = 0;
        this.spaceCharging = false;

        this.cameraMode = 'follow';

        this.carryStart = new THREE.Vector2(0, 0);
        this.holeTarget = new THREE.Vector3(this.holePosition.x, 0, this.holePosition.z);
        this.ballVisual = new THREE.Vector3();
        this.offset = new THREE.Vector3();
    }

    async init() {
        await this.decorations.loadAll();
        this.dashboard.setDefaults(this.defaultShot);
        this.resetBall();
    }   

    resolveTeePosition() {
        let hole = this.course.holes[0];
        return { x: hole.teePos.x, z: hole.teePos.z };
    }

    resolveHolePosition() {
        let hole = this.course.holes[0];
        return { x: hole.holePos.x, z: hole.holePos.z };
    }

    getParams() {
            let params = this.dashboard.getShootParams();
            if (params) return params;
        return this.defaultShot;
    }

    getAimYaw(params) {
        let x;
        if (params.startX != null) {
            x = params.startX;
        } else {
            x = this.physics.x;
        }
        let z;
        if (params.startZ != null) {
            z = params.startZ;
        } else {
            z = this.physics.z;
        }
        return getAimYawRad(params, x, z, this.holePosition.x, this.holePosition.z);
    }

    isAtTeeDisplay() {
        return this.atTee && this.physics.stopped && !this.inCup;
    }

    canShowAimPreview() {
        if (!this.physics.stopped || this.inCup || this.phase == PHASE.SWINGING) {
            return false;
        }
        return true;
    }

    syncBallOnTee() {
        let anchor = this.decorations.getTeeAnchor();
        let ballY = this.decorations.getBallPhysicsY(this.physics.R);

        this.physics.x = anchor.x;
        this.physics.z = anchor.z;
        this.physics.y = ballY;
        this.physics.stopped = true;
        this.atTee = true;

        return { anchor: anchor, ballY: ballY };
    }

    getBallVisualPos(groundY) {
        let onTee = this.isAtTeeDisplay();
        let teeTopY;
        if (onTee) {
            teeTopY = this.decorations.getTeeTopY();
        } else {
            teeTopY = null;
        }
        let visualY = this.ball.computeVisualY(this.physics.position.y, groundY, onTee, teeTopY, this.physics.stopped);
        this.ballVisual.set(this.physics.position.x, visualY, this.physics.position.z);
        return this.ballVisual;
    }

    updateAimPreview() {
        if (!this.canShowAimPreview())
             return;

        let params = this.getParams();
        let x;
        if (params.startX != null) {
            x = params.startX;
        } else {
            x = this.physics.x;
        }
        let z;
        if (params.startZ != null) {
            z = params.startZ;
        } else {
            z = this.physics.z;
        }
        let groundY = this.course.getHeightAt(x, z);

        this.physics.x = x;
        this.physics.z = z;
        this.physics.y = groundY + this.physics.R;
        this.physics.stopped = true;

        let aimYaw = this.getAimYaw(params);
        this.decorations.positionForStroke(x, z, aimYaw, groundY, this.atTee);

        if (this.phase == PHASE.IDLE) {
            this.decorations.setSwingPose(0, 0);
        }

        this.trajectory.show(
            this.physics,
            params,
            this.holePosition,
            (x, z) => this.course.getHeightAt(x, z),
            (x, z) => this.course.getZoneAt(x, z)
        );

        if (this.cameraMode == 'orbit') {
            this.applyOrbitAimCamera(this.getBallVisualPos(groundY), groundY, params);
        }
    }

    applyOrbitAimCamera(ballPos, groundY, params) {
        let viewRad = ((params.viewYawDeg || 0) * Math.PI) / 180;
        let aimYaw = this.getAimYaw(params);
        this.orbitCamera.setAngle(aimYaw + Math.PI + viewRad);
        this.orbitCamera.update(ballPos, 0, groundY);
    }

    applyViewYawOffset(ballPos, params) {
        let viewDeg = params.viewYawDeg || 0;
        if (Math.abs(viewDeg) < 0.5) return;

        let viewRad = (viewDeg * Math.PI) / 180;
        let aimYaw = this.getAimYaw(params);

        this.offset.copy(this.camera.position).sub(ballPos);
        this.offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), viewRad);
        this.camera.position.copy(ballPos).add(this.offset);

        let lookX = ballPos.x + Math.sin(aimYaw) * 10;
        let lookZ = ballPos.z + Math.cos(aimYaw) * 10;
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(lookX, ballPos.y + 0.15, lookZ);

        this.chaseCamera.position.copy(this.camera.position);
        this.chaseCamera.lookAt.set(lookX, ballPos.y + 0.15, lookZ);
    }

    resetBall() {
        this.trajectory.hide();
        this.phase = PHASE.IDLE;
        this.swingPull = 0;

        this.decorations.showPeg(true);
        this.decorations.showClub(true);
        this.decorations.showPlayer(true);

        this.physics.resetState();
        let sync = this.syncBallOnTee();
        this.ball.clearTrail();

        let groundY = this.course.getHeightAt(sync.anchor.x, sync.anchor.z);
        this.ball.sync(this.physics, false, groundY, {
            onTee: true,
            teeTopY: this.decorations.getTeeTopY(),
            stopped: true,
        });

        this.carryStart.set(sync.anchor.x, sync.anchor.z);
        this.lastShotWasDefault = true;
        this.wasMoving = false;
        this.inCup = false;

        this.defaultShot = buildDefaultShot(this.teePosition);
        if (this.dashboard) {
            this.dashboard.setDefaults(this.defaultShot);
            this.dashboard.setStrokePosition(sync.anchor.x, sync.anchor.z, false);
        }

        this.updateAimPreview();
        let ballVisual = this.getBallVisualPos(groundY);
        let holeTarget = new THREE.Vector3(this.holePosition.x, groundY, this.holePosition.z);
        this.chaseCamera.snapToTee(ballVisual, holeTarget, groundY);
        this.orbitCamera.resetAngle(ballVisual, holeTarget);
    }

    beginCharge() {
        if (this.inCup || !this.physics.stopped || this.phase == PHASE.SWINGING) return;
        this.phase = PHASE.CHARGING;
        this.swingPull = 0;
        this.updateAimPreview();
    }

    releaseCharge() {
        if (this.phase != PHASE.CHARGING) return;
        this.phase = PHASE.SWINGING;
        this.swingTimer = SWING_DURATION;
        this.trajectory.hide();
    }

    cancelCharge() {
        if (this.phase != PHASE.CHARGING) return;
        this.phase = PHASE.IDLE;
        this.swingPull = 0;
        this.decorations.setSwingPose(0, 0);
        this.updateAimPreview();
    }

    executeShot(params) {
        let defaults = this.dashboard ? (this.dashboard.getDefaults() || this.defaultShot) : this.defaultShot;
        this.lastShotWasDefault = isDefaultShotParams(params, defaults);
        this.wasMoving = false;

        let x = params.startX != null ? params.startX : this.physics.x;
        let z = params.startZ != null ? params.startZ : this.physics.z;
        let groundY = this.course.getHeightAt(x, z);
        this.carryStart.set(x, z);

        if (this.atTee) this.decorations.showPeg(false);
        this.decorations.showClub(false);

        this.physics.setDimpled(params.dimpled != false);

        let aimYaw = this.getAimYaw(params);
        let launch = computeLaunchVelocity(params, aimYaw);

        this.physics.shoot({
            vx: launch.vx, vy: launch.vy, vz: launch.vz,
            omegax: launch.omegax, omegay: launch.omegay, omegaz: launch.omegaz,
            startX: x, startZ: z,
        });
        this.physics.y = Math.max(this.physics.y, groundY + this.physics.R);
        this.atTee = false;

        this.trajectory.hide();
        this.ball.clearTrail();
        this.orbitCamera.enableAutoRotate(true);

    }

    shoot(params) {
        this.executeShot(params || this.getParams());
    }

    setCameraMode(mode) {
        let oldMode = this.cameraMode;
        this.cameraMode = mode;

        if (oldMode == 'free' && this.flyController) this.flyController.deactivate();
        if (mode == 'free') {
            this.cancelCharge();
            if (this.flyController) this.flyController.activate();
        } else {
            this.updateAimPreview();
        }
    }

    setBallType(dimpled) {
        this.physics.setDimpled(dimpled);
        this.updateAimPreview();
    }
    onDashboardChange() { this.updateAimPreview(); }

    isBallOnGround(groundY) {
        let onSurface = this.physics.y <= groundY + this.physics.R + 0.006;
        let lowSpeed = Math.abs(this.physics.vy) < 2.5;
        return onSurface && lowSpeed;
    }

    checkCupEntry(groundY) {
        if (this.inCup) return;
        let dx = this.physics.x - this.holePosition.x;
        let dz = this.physics.z - this.holePosition.z;
        if (Math.sqrt(dx * dx + dz * dz) >= CUP_RADIUS) return;

        let zone = this.course.getZoneAt(this.physics.x, this.physics.z);
        let onGreen = zone == ZONE.GREEN || zone == ZONE.FAIRWAY || zone == ZONE.TEE;
        if (!onGreen || !this.isBallOnGround(groundY)) return;
        this.sinkInCup();
    }

    prepareNextStroke(groundY) {
        this.physics.y = Math.max(this.physics.y, groundY + this.physics.R);
        this.physics.stopped = true;

        this.decorations.showPeg(this.atTee);
        this.decorations.showClub(true);
        this.decorations.showPlayer(true);

        if (this.dashboard) this.dashboard.setStrokePosition(this.physics.x, this.physics.z);
        this.phase = PHASE.IDLE;
        this.orbitCamera.enableAutoRotate(false);
        this.updateAimPreview();
    }

    update(deltaTime, flyController) {

        if (this.phase == PHASE.CHARGING) {
            this.swingPull = Math.min(this.swingPull + deltaTime * 0.85, MAX_SWING_PULL);
            this.decorations.setSwingPose(this.swingPull, 0);
        }

        if (this.phase == PHASE.SWINGING) {
            this.swingTimer = this.swingTimer - deltaTime;
            let progress = 1 - Math.max(0, this.swingTimer) / SWING_DURATION;
            this.decorations.setSwingPose(0, progress);
            if (this.swingTimer <= 0) {
                this.phase = PHASE.IDLE;
                this.executeShot(this.getParams());
            }
        }

        let wasStopped = this.physics.stopped;
        if (!this.physics.stopped) {
            this.physics.update(deltaTime);
            this.bounds.clampBall(this.physics);
            this.wasMoving = true;
        }

        let groundY = this.course.getHeightAt(this.physics.x, this.physics.z);
        let onTee = this.isAtTeeDisplay();
        this.ball.sync(this.physics, true, groundY, {
            onTee: onTee,
            teeTopY: onTee ? this.decorations.getTeeTopY() : null,
            stopped: this.physics.stopped,
        });

        this.checkCupEntry(groundY);
        if (this.wasMoving && this.physics.stopped && !wasStopped && !this.inCup) {
            this.onBallJustStopped(groundY);
        }

        this.updateCamera(deltaTime, flyController, groundY);
        this.bounds.clampCamera(this.camera);
        this.updateHUD();
    }

    onBallJustStopped(groundY) {
        if (this.inCup) return;
        let dx = this.physics.x - this.holePosition.x;
        let dz = this.physics.z - this.holePosition.z;
        let distance = Math.sqrt(dx * dx + dz * dz);
        let zone = this.course.getZoneAt(this.physics.x, this.physics.z);
        let onGreen = zone == ZONE.GREEN || zone == ZONE.FAIRWAY;

        if ((distance < CUP_RADIUS && onGreen && this.isBallOnGround(groundY)) || 
            (this.lastShotWasDefault && distance < 1.5 && onGreen && this.isBallOnGround(groundY))) {
            this.sinkInCup();
            return;
        }
        this.prepareNextStroke(groundY);
    }

    sinkInCup() {
        if (this.inCup) return;
        this.inCup = true;
        this.phase = PHASE.IDLE;
        this.trajectory.hide();
        this.decorations.showClub(false);

        let holeY = this.course.getHeightAt(this.holePosition.x, this.holePosition.z);
        this.physics.x = this.holePosition.x;
        this.physics.z = this.holePosition.z;
        this.physics.y = holeY;
        this.physics.stopped = true;
        this.ball.sync(this.physics, false, holeY, { stopped: true });
    }

    updateCamera(deltaTime, flyController, groundY) {
        let ballPos = this.getBallVisualPos(groundY);
        let params = this.getParams();
        this.holeTarget.set(this.holePosition.x, this.course.getHeightAt(this.holePosition.x, this.holePosition.z), this.holePosition.z);

        if (this.cameraMode == 'free' && flyController) {
            flyController.update(deltaTime);
            return;
        }
        if (this.cameraMode == 'orbit') {
            if (this.canShowAimPreview()) this.applyOrbitAimCamera(ballPos, groundY, params);
            else this.orbitCamera.update(ballPos, deltaTime, groundY);
            return;
        }
        if (this.cameraMode == 'follow') {
            this.chaseCamera.update(ballPos, this.physics.velocity, groundY, this.holeTarget, deltaTime);
            if (this.canShowAimPreview()) this.applyViewYawOffset(ballPos, params);
        }
    }

    updateHUD() {
        let pos = this.physics.position;
        let groundY = this.course.getHeightAt(pos.x, pos.z);
        let carry = Math.sqrt((pos.x - this.carryStart.x)**2 + (pos.z - this.carryStart.y)**2);

        if (this.dashboard) {
            this.dashboard.updateStats({
                speed: this.physics.speed,
                height: Math.max(0, pos.y - groundY - this.physics.R),
                carry: carry,
            });
        }
    }

    beginChargeFromKeyboard() {
        this.spaceCharging = true;
        this.beginCharge();
    }

    releaseChargeFromKeyboard() {
        if (!this.spaceCharging) 
            return;
        this.spaceCharging = false;
        this.releaseCharge();
    }

    setGroundType(type) {
        this.physics.setGroundType(type);
        this.course.setGroundTexture(type);
        this.decorations.setGrassCount(type == 'tallGrass' ? 500 : 12);
    }
}
