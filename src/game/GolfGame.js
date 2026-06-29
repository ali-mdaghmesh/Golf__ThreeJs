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
        let scene = options.scene;
        let camera = options.camera;
        let course = options.course;
        let dashboard = options.dashboard;
        let flyController = options.flyController;

        this.scene = scene;
        this.camera = camera;
        this.course = course;
        this.dashboard = dashboard;
        this.flyController = flyController;

        let courseWidth = course.opt.width;
        let courseDepth = course.opt.depth;

        this.physics = new BallPhysics();
        this.physics.setGroundCallbacks(
            function(x, z) { 
                return course.getHeightAt(x, z); 
            },
            function(x, z) {
                 return course.getZoneAt(x, z); 
                }
        );

        this.ball = new BallRenderer(scene, this.physics.R);
        this.chaseCamera = new ChaseCamera(camera);
        this.orbitCamera = new OrbitCamera(camera);
        this.decorations = new CourseDecorations(scene, course);
        this.trajectory = new TrajectoryPreview(scene);

        this.bounds = new WorldBounds({
            halfWidth:courseWidth/2,
            halfDepth:courseDepth /2,
            margin:3,
            minCameraY: 1.2,
        });
        this.bounds.setGroundHeightFn(function (x, z) {
            return course.getHeightAt(x, z);
        });

        this.teePosition =this.resolveTeePosition();
        this.holePosition= this.resolveHolePosition();
        this.defaultShot = buildDefaultShot(this.teePosition);

        this.lastShotWasDefault = true;
        this.wasMoving =false;
        this.inCup =false;
        this.atTee = true;
        this.strokeCount= 0;

        this.phase = PHASE.IDLE;
        this.swingPull =0;
        this.swingTimer =0;
        this.spaceCharging = false;

        this.cameraMode = 'follow';
        this.followBall = true;
        this.showTrail = true;

        this.carryStart = new THREE.Vector2(0, 0);
        this.holeTarget = new THREE.Vector3(this.holePosition.x, 0, this.holePosition.z);
        this.ballVisual = new THREE.Vector3();
        this.offset = new THREE.Vector3();
        this.ready = false;
    }

    async init() {
        await this.decorations.loadAll();
        if (this.dashboard) {
            this.dashboard.setDefaults(this.defaultShot);
        }
        this.ready = true;
        this.resetBall();
    }

    resolveTeePosition() {
        let hole = this.course.holes[0];
        if (!hole) {
            return { x: 0, z: -41 };
        }
        return { x: hole.teePos.x, z: hole.teePos.z - 5 };
    }

    resolveHolePosition() {
        let hole = this.course.holes[0];
        if (!hole) {
            return { x: 0, z: 36 };
        }
        return { x: hole.holePos.x, z: hole.holePos.z };
    }

    getParams() {
        if (this.dashboard) {
            let fromDashboard = this.dashboard.getShootParams();
            if (fromDashboard) {
                return fromDashboard;
            }
        }
        return {
            v0: this.defaultShot.v0,
            thetaDeg: this.defaultShot.thetaDeg,
            vz0: this.defaultShot.vz0,
            omegax: this.defaultShot.omegax,
            omegay: this.defaultShot.omegay,
            omegaz: this.defaultShot.omegaz,
            aimYawDeg: this.defaultShot.aimYawDeg,
            viewYawDeg: this.defaultShot.viewYawDeg,
            dimpled: this.defaultShot.dimpled,
            cameraMode: this.defaultShot.cameraMode,
            showTrail: this.defaultShot.showTrail,
            startX: this.defaultShot.startX,
            startZ: this.defaultShot.startZ,
        };
    }

    getAimYaw(params) {
        let startX = params.startX;
        if (startX === undefined || startX === null) {
            startX = this.physics.x;
        }
        let startZ = params.startZ;
        if (startZ === undefined || startZ === null) {
            startZ = this.physics.z;
        }
        return getAimYawRad(params, startX, startZ, this.holePosition.x, this.holePosition.z);
    }

    isNearTee() {
        let anchor = this.decorations.getTeeAnchor();
        let dx = this.physics.x -anchor.x;
        let dz = this.physics.z- anchor.z;
        let distance = Math.sqrt(dx * dx + dz * dz);
        return distance < 0.25;
    }

    isAtTeeDisplay() {
        return this.atTee && this.physics.stopped && !this.inCup;
    }

    canShowAimPreview() {
        if(!this.ready){
            return false;
        } 
        if(!this.physics.stopped){
            return false;
        } 
        if(this.inCup){
            return false;
        } 
        if(this.phase === PHASE.SWINGING){
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
        let x = this.physics.position.x;
        let y = this.physics.position.y;
        let z = this.physics.position.z;

        let onTee = this.isAtTeeDisplay();
        let teeTopY = null;
        if (onTee) {
            teeTopY = this.decorations.getTeeTopY();
        }

        let visualY = this.ball.computeVisualY(y, groundY, onTee, teeTopY, this.physics.stopped);
        this.ballVisual.set(x, visualY, z);
        return this.ballVisual;
    }

    updateAimPreview() {
        if (!this.canShowAimPreview()) return;

        let params = this.getParams();

        let targetX = params.startX;
        if(targetX === undefined || targetX === null) {
            targetX = this.physics.x;
        }
        let targetZ = params.startZ;
        if(targetZ === undefined || targetZ === null) {
            targetZ = this.physics.z;
        }

        let groundY = this.course.getHeightAt(targetX, targetZ);

        this.physics.x = targetX;
        this.physics.z = targetZ;
        this.physics.y = groundY + this.physics.R;
        this.physics.stopped = true;

        let aimYaw = this.getAimYaw(params);
        this.decorations.positionForStroke(targetX, targetZ, aimYaw, groundY, this.atTee);

        if(this.phase === PHASE.IDLE) {
            this.decorations.setSwingPose(0, 0);
        }

        let courseRef = this.course;
        this.trajectory.show(
            this.physics,
            params,
            this.holePosition,
            function (x, z) { return courseRef.getHeightAt(x, z); },
            function (x, z) { return courseRef.getZoneAt(x, z); }
        );

        if(this.cameraMode === 'orbit') {
            let ballVisual = this.getBallVisualPos(groundY);
            this.applyOrbitAimCamera(ballVisual, groundY, params);
        }
    }

    applyOrbitAimCamera(ballPos, groundY, params) {
        let viewDeg = params.viewYawDeg;
        if (viewDeg === undefined || viewDeg === null) {
            viewDeg = 0;
        }
        let viewRad = (viewDeg * Math.PI) / 180;
        let aimYaw = this.getAimYaw(params);

        this.orbitCamera.setAngle(aimYaw + Math.PI + viewRad);
        this.orbitCamera.update(ballPos, 0, groundY);
    }

    applyViewYawOffset(ballPos, params) {
        let viewDeg = params.viewYawDeg;
        if(viewDeg === undefined || viewDeg === null) {
            viewDeg = 0;
        }
        if(Math.abs(viewDeg) < 0.5){
            return; 
        }

        let viewRad = (viewDeg * Math.PI)/ 180;
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
        let syncResult = this.syncBallOnTee();
        let anchor = syncResult.anchor;
        this.ball.clearTrail();

        let groundY = this.course.getHeightAt(anchor.x, anchor.z);
        this.ball.sync(this.physics, false, groundY, {
            onTee: true,
            teeTopY: this.decorations.getTeeTopY(),
            stopped: true,
        });

        this.carryStart.set(anchor.x, anchor.z);
        this.lastShotWasDefault = true;
        this.wasMoving = false;
        this.inCup = false;
        this.strokeCount = 0;

        this.defaultShot = buildDefaultShot(this.teePosition);
        if (this.dashboard) {
            this.dashboard.setDefaults(this.defaultShot);
            this.dashboard.setStrokePosition(anchor.x, anchor.z, false);
        }

        this.updateAimPreview();
        let ballVisual = this.getBallVisualPos(groundY);
        let holeTarget = new THREE.Vector3(this.holePosition.x, groundY, this.holePosition.z);
        this.chaseCamera.snapToTee(ballVisual, holeTarget, groundY);
        this.orbitCamera.resetAngle(ballVisual, holeTarget);

        let winElement = document.getElementById('hud-win');
        if (winElement) {
            winElement.classList.remove('show');
        }
    }

    beginCharge() {
        if (!this.ready || this.inCup || !this.physics.stopped) return;
        if (this.phase === PHASE.SWINGING) return;

        this.phase = PHASE.CHARGING;
        this.swingPull = 0;
        this.updateAimPreview();
    }

    releaseCharge() {
        if (this.phase !== PHASE.CHARGING) return;
        this.phase = PHASE.SWINGING;
        this.swingTimer = SWING_DURATION;
        this.trajectory.hide();
    }

    cancelCharge() {
        if (this.phase !== PHASE.CHARGING) return;
        this.phase = PHASE.IDLE;
        this.swingPull = 0;
        this.decorations.setSwingPose(0, 0);
        this.updateAimPreview();
    }

    executeShot(params) {
        let defaults = this.defaultShot;
        if (this.dashboard) {
            let dashDefaults = this.dashboard.getDefaults();
            if (dashDefaults) {
                defaults = dashDefaults;
            }
        }
        this.lastShotWasDefault = isDefaultShotParams(params, defaults);
        this.wasMoving = false;
        this.strokeCount = this.strokeCount + 1;

        let startX = params.startX;
        if (startX === undefined || startX === null) {
            startX = this.physics.x;
        }
        let startZ = params.startZ;
        if (startZ === undefined || startZ === null) {
            startZ = this.physics.z;
        }
        let groundY = this.course.getHeightAt(startX, startZ);
        this.carryStart.set(startX, startZ);

        if (this.atTee) {
            this.decorations.showPeg(false);
        }
        this.decorations.showClub(false);

        this.physics.setDimpled(params.dimpled !== false);

        let aimYaw = this.getAimYaw(params);
        let launch = computeLaunchVelocity(params, aimYaw);

        this.physics.shoot({
            vx: launch.vx,
            vy: launch.vy,
            vz: launch.vz,
            omegax: launch.omegax,
            omegay: launch.omegay,
            omegaz: launch.omegaz,
            startX: startX,
            startZ: startZ,
        });
        this.physics.y = Math.max(this.physics.y, groundY + this.physics.R);
        this.atTee = false;

        this.trajectory.hide();
        this.ball.clearTrail();
        this.orbitCamera.enableAutoRotate(true);

        let winElement = document.getElementById('hud-win');
        if (winElement) {
            winElement.classList.remove('show');
        }
    }

    shoot(params) {
        if (params) {
            this.executeShot(params);
        } else {
            this.executeShot(this.getParams());
        }
    }

    setCameraMode(mode) {
        let previousMode = this.cameraMode;
        this.cameraMode = mode;

        if(previousMode === 'free' && this.flyController) {
            this.flyController.deactivate();
        }

        if(mode === 'free') {
            this.cancelCharge();
            if (this.flyController) {
                this.flyController.activate();
            }
        } else {
            this.updateAimPreview();
        }
    }

    setFollowBall(enabled) {
        this.followBall = enabled;
    }

    setTrail(enabled) {
        this.showTrail = enabled;
        if(!enabled) {
            this.ball.clearTrail();
        }
    }

    setBallType(dimpled) {
        this.physics.setDimpled(dimpled);
        this.updateAimPreview();
    }

    onDashboardChange() {
        this.updateAimPreview();
    }

    isBallOnGround(groundY) {
        let contactY = groundY + this.physics.R;
        let onSurface = this.physics.y <= contactY + 0.006;
        let lowVerticalSpeed = Math.abs(this.physics.vy) < 2.5;
        return onSurface && lowVerticalSpeed;
    }

    checkCupEntry(groundY) {
        if (this.inCup) return;

        let dx = this.physics.x - this.holePosition.x;
        let dz = this.physics.z - this.holePosition.z;
        let distance = Math.sqrt(dx * dx + dz * dz);
        if (distance >= CUP_RADIUS) return;

        let zone = this.course.getZoneAt(this.physics.x, this.physics.z);
        let onGreen = zone === ZONE.GREEN || zone === ZONE.FAIRWAY || zone === ZONE.TEE;

        if (!onGreen || !this.isBallOnGround(groundY)) {
            return;
        }
        this.sinkInCup();
    }

    prepareNextStroke(groundY) {
        let floorY = groundY + this.physics.R;
        if (this.physics.y < floorY) {
            this.physics.y = floorY;
        }
        this.physics.stopped = true;

        this.atTee = this.isNearTee();
        this.decorations.showPeg(this.atTee);
        this.decorations.showClub(true);
        this.decorations.showPlayer(true);

        if(this.dashboard) {
            this.dashboard.setStrokePosition(this.physics.x, this.physics.z);
        }
        this.phase = PHASE.IDLE;
        this.orbitCamera.enableAutoRotate(false);
        this.updateAimPreview();
    }

    update(deltaTime, flyController) {
        if(!this.ready) return;

        if(this.phase === PHASE.CHARGING) {
            this.swingPull = Math.min(this.swingPull + deltaTime * 0.85, MAX_SWING_PULL);
            this.decorations.setSwingPose(this.swingPull, 0);
        }

        if(this.phase === PHASE.SWINGING) {
            this.swingTimer = this.swingTimer - deltaTime;

            let remaining = Math.max(0, this.swingTimer);
            let swingProgress = 1 - remaining / SWING_DURATION;
            this.decorations.setSwingPose(0, swingProgress);

            if(this.swingTimer <= 0) {
                this.phase = PHASE.IDLE;
                this.executeShot(this.getParams());
            }
        }

        let wasStoppedBefore = this.physics.stopped;

        if(!this.physics.stopped) {
            this.physics.update(deltaTime);
            this.bounds.clampBall(this.physics);
            this.wasMoving = true;
        }

        let groundY = this.course.getHeightAt(this.physics.x, this.physics.z);
        let onTee = this.isAtTeeDisplay();

        let teeTopYForSync = null;
        if(onTee) {
            teeTopYForSync = this.decorations.getTeeTopY();
        }

        this.ball.sync(this.physics, this.showTrail, groundY, {
            onTee: onTee,
            teeTopY: teeTopYForSync,
            stopped: this.physics.stopped,
        });

        this.checkCupEntry(groundY);

        if(this.wasMoving && this.physics.stopped && !wasStoppedBefore && !this.inCup) {
            this.onBallJustStopped(groundY);
        }

        this.updateCamera(deltaTime, flyController, groundY);
        this.bounds.clampCamera(this.camera);
        this.updateHUD();
    }

    onBallJustStopped(groundY) {
        if(this.inCup){
            return;
        }

        let dx = this.physics.x - this.holePosition.x;
        let dz = this.physics.z - this.holePosition.z;
        let distance = Math.sqrt(dx * dx + dz * dz);

        let zone = this.course.getZoneAt(this.physics.x, this.physics.z);
        let onGreen = zone === ZONE.GREEN || zone === ZONE.FAIRWAY;

        if(distance < CUP_RADIUS && onGreen && this.isBallOnGround(groundY)) {
            this.sinkInCup();
            return;
        }

        if(this.lastShotWasDefault && distance < 1.5 && onGreen && this.isBallOnGround(groundY)) {
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

        let holeGroundY = this.course.getHeightAt(this.holePosition.x, this.holePosition.z);
        this.physics.x = this.holePosition.x;
        this.physics.z = this.holePosition.z;
        this.physics.y = holeGroundY + this.physics.R * 0.3;
        this.physics.stopped = true;

        this.ball.sync(this.physics, false, holeGroundY, { stopped: true });

        let winElement = document.getElementById('hud-win');
        if (winElement) {
            winElement.classList.add('show');
        }
    }

    updateCamera(deltaTime, flyController, groundY) {
        let ballPos = this.getBallVisualPos(groundY);
        let params = this.getParams();

        this.holeTarget.set(
            this.holePosition.x,
            this.course.getHeightAt(this.holePosition.x, this.holePosition.z),
            this.holePosition.z
        );

        if(this.cameraMode === 'free' && flyController) {
            flyController.update(deltaTime);
            return;
        }

        if(this.cameraMode === 'orbit') {
            if (this.canShowAimPreview()) {
                this.applyOrbitAimCamera(ballPos, groundY, params);
            } else {
                this.orbitCamera.update(ballPos, deltaTime, groundY);
            }
            return;
        }

        if(this.cameraMode === 'follow' && this.followBall) {
            this.chaseCamera.update(ballPos, this.physics.velocity, groundY, this.holeTarget, deltaTime);
            if (this.canShowAimPreview()) {
                this.applyViewYawOffset(ballPos, params);
            }
        }
    }

    updateHUD() {
        let ballPosition = this.physics.position;
        let groundY = this.course.getHeightAt(ballPosition.x, ballPosition.z);

        let carryDx = ballPosition.x - this.carryStart.x;
        let carryDz = ballPosition.z - this.carryStart.y;
        let carryDistance = Math.sqrt(carryDx * carryDx + carryDz * carryDz);

        let holeDx = ballPosition.x - this.holePosition.x;
        let holeDz = ballPosition.z - this.holePosition.z;
        let distanceToHole = Math.sqrt(holeDx * holeDx + holeDz * holeDz);


        if (this.dashboard) {
            this.dashboard.updateStats({
                speed: this.physics.speed,
                height: Math.max(0, ballPosition.y - groundY - this.physics.R),
                carry: carryDistance,
                bounces: this.physics.bounceCount,
                time: this.physics.t,
                strokes: this.strokeCount,
            });
        }

    }

    beginChargeFromKeyboard() {
        this.spaceCharging = true;
        this.beginCharge();
    }

    releaseChargeFromKeyboard() {
        if (!this.spaceCharging) return;
        this.spaceCharging = false;
        this.releaseCharge();
    }

    setGroundType(type) {
    this.physics.setGroundType(type);
    this.course.setGroundTexture(type);

    if (type =='tallGrass') {
        this.decorations.setGrassCount(900);
    } else {
        this.decorations.setGrassCount(12);
    }
}
}
