import * as THREE from 'three';
import { BallPhysics } from '../Physics/BallPhysics.js';
import { BallRenderer } from './BallRenderer.js';
import { WorldBounds } from './WorldBounds.js';
import { ChaseCamera } from './ChaseCamera.js';
import { OrbitCamera } from './OrbitCamera.js';
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
            function (x, z) { return course.getHeightAt(x, z); },
            function (x, z) { return course.getZoneAt(x, z); }
        );

        this.ball = new BallRenderer(scene, this.physics.R);
        this.chaseCamera = new ChaseCamera(camera);
        this.orbitCamera = new OrbitCamera(camera);
        this.decorations = new CourseDecorations(scene, course);
        this.trajectory = new TrajectoryPreview(scene);

        this.bounds = new WorldBounds({
            halfWidth: courseWidth / 2,
            halfDepth: courseDepth / 2,
            margin: 3,
            minCameraY: 1.2,
        });
        this.bounds.setGroundHeightFn(function (x, z) {
            return course.getHeightAt(x, z);
        });

        this.teePosition = this._resolveTeePosition();
        this.holePosition = this._resolveHolePosition();
        this.defaultShot = buildDefaultShot(this.teePosition);

        this._lastShotWasDefault = true;
        this._wasMoving = false;
        this._inCup = false;
        this._atTee = true;
        this._strokeCount = 0;

        this._phase = PHASE.IDLE;
        this._swingPull = 0;
        this._swingTimer = 0;
        this._spaceCharging = false;

        this.cameraMode = 'follow';
        this.followBall = true;
        this.showTrail = true;

        // _carryStart عبارة عن Vector2: x = إحداثي X، y = إحداثي Z (مش Y الحقيقي)
        this._carryStart = new THREE.Vector2(0, 0);
        this._holeTarget = new THREE.Vector3(
            this.holePosition.x,
            0,
            this.holePosition.z
        );
        this._ballVisual = new THREE.Vector3();
        this._offset = new THREE.Vector3();

        this._ready = false;
    }

    async init() {
        await this.decorations.loadAll();
        if (this.dashboard) {
            this.dashboard.setDefaults(this.defaultShot);
        }
        this._ready = true;
        this.resetBall();
    }

    _resolveTeePosition() {
        let hole = this.course.holes[0];
        if (!hole) {
            return { x: 0, z: -41 };
        }
        return { x: hole.teePos.x, z: hole.teePos.z - 5 };
    }

    _resolveHolePosition() {
        let hole = this.course.holes[0];
        if (!hole) {
            return { x: 0, z: 36 };
        }
        return { x: hole.holePos.x, z: hole.holePos.z };
    }

    _getParams() {
        if (this.dashboard) {
            let fromDashboard = this.dashboard.getShootParams();
            if (fromDashboard) {
                return fromDashboard;
            }
        }
        return Object.assign({}, this.defaultShot);
    }

    _getAimYaw(params) {
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

    _isNearTee() {
        let anchor = this.decorations.getTeeAnchor();
        let dx = this.physics.x - anchor.x;
        let dz = this.physics.z - anchor.z;
        let distance = Math.sqrt(dx * dx + dz * dz);
        return distance < 0.25;
    }

    _isAtTeeDisplay() {
        return this._atTee && this.physics.stopped && !this._inCup;
    }

    _canShowAimPreview() {
        if (!this._ready) return false;
        if (!this.physics.stopped) return false;
        if (this._inCup) return false;
        if (this._phase === PHASE.SWINGING) return false;
        return true;
    }

    _syncBallOnTee() {
        let anchor = this.decorations.getTeeAnchor();
        let ballY = this.decorations.getBallPhysicsY(this.physics.R);

        this.physics.x = anchor.x;
        this.physics.z = anchor.z;
        this.physics.y = ballY;
        this.physics.stopped = true;
        this._atTee = true;

        return { anchor: anchor, ballY: ballY };
    }

    _getBallVisualPos(groundY) {
        let x = this.physics.position.x;
        let y = this.physics.position.y;
        let z = this.physics.position.z;

        let onTee = this._isAtTeeDisplay();
        let teeTopY = null;
        if (onTee) {
            teeTopY = this.decorations.getTeeTopY();
        }

        let visualY = this.ball.computeVisualY(y, groundY, onTee, teeTopY, this.physics.stopped);
        this._ballVisual.set(x, visualY, z);
        return this._ballVisual;
    }

    updateAimPreview() {
        if (!this._canShowAimPreview()) return;

        let params = this._getParams();

        let targetX = params.startX;
        if (targetX === undefined || targetX === null) {
            targetX = this.physics.x;
        }
        let targetZ = params.startZ;
        if (targetZ === undefined || targetZ === null) {
            targetZ = this.physics.z;
        }

        let groundY = this.course.getHeightAt(targetX, targetZ);

        this.physics.x = targetX;
        this.physics.z = targetZ;
        this.physics.y = groundY + this.physics.R;
        this.physics.stopped = true;

        let aimYaw = this._getAimYaw(params);
        this.decorations.positionForStroke(targetX, targetZ, aimYaw, groundY, this._atTee);

        if (this._phase === PHASE.IDLE) {
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

        if (this.cameraMode === 'orbit') {
            let ballVisual = this._getBallVisualPos(groundY);
            this._applyOrbitAimCamera(ballVisual, groundY, params);
        }
    }

    _applyOrbitAimCamera(ballPos, groundY, params) {
        let viewDeg = params.viewYawDeg;
        if (viewDeg === undefined || viewDeg === null) {
            viewDeg = 0;
        }
        let viewRad = (viewDeg * Math.PI) / 180;
        let aimYaw = this._getAimYaw(params);

        this.orbitCamera.setAngle(aimYaw + Math.PI + viewRad);
        this.orbitCamera.update(ballPos, 0, groundY);
    }

    _applyViewYawOffset(ballPos, params) {
        let viewDeg = params.viewYawDeg;
        if (viewDeg === undefined || viewDeg === null) {
            viewDeg = 0;
        }
        if (Math.abs(viewDeg) < 0.5) return;

        let viewRad = (viewDeg * Math.PI) / 180;
        let aimYaw = this._getAimYaw(params);

        this._offset.copy(this.camera.position).sub(ballPos);
        this._offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), viewRad);
        this.camera.position.copy(ballPos).add(this._offset);

        let lookX = ballPos.x + Math.sin(aimYaw) * 10;
        let lookZ = ballPos.z + Math.cos(aimYaw) * 10;
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(lookX, ballPos.y + 0.15, lookZ);

        this.chaseCamera.position.copy(this.camera.position);
        this.chaseCamera.lookAt.set(lookX, ballPos.y + 0.15, lookZ);
    }

    resetBall() {
        this.trajectory.hide();
        this._phase = PHASE.IDLE;
        this._swingPull = 0;

        this.decorations.showPeg(true);
        this.decorations.showClub(true);
        this.decorations.showPlayer(true);

        this.physics.resetState();
        let syncResult = this._syncBallOnTee();
        let anchor = syncResult.anchor;
        this.ball.clearTrail();

        let groundY = this.course.getHeightAt(anchor.x, anchor.z);
        this.ball.sync(this.physics, false, groundY, {
            onTee: true,
            teeTopY: this.decorations.getTeeTopY(),
            stopped: true,
        });

        this._carryStart.set(anchor.x, anchor.z);
        this._lastShotWasDefault = true;
        this._wasMoving = false;
        this._inCup = false;
        this._strokeCount = 0;

        this.defaultShot = buildDefaultShot(this.teePosition);
        if (this.dashboard) {
            this.dashboard.setDefaults(this.defaultShot);
            this.dashboard.setStrokePosition(anchor.x, anchor.z, false);
        }

        this.updateAimPreview();
        let ballVisual = this._getBallVisualPos(groundY);
        let holeTarget = new THREE.Vector3(this.holePosition.x, groundY, this.holePosition.z);
        this.chaseCamera.snapToTee(ballVisual, holeTarget, groundY);
        this.orbitCamera.resetAngle(ballVisual, holeTarget);

        let winElement = document.getElementById('hud-win');
        if (winElement) {
            winElement.classList.remove('show');
        }
    }

    beginCharge() {
        if (!this._ready || this._inCup || !this.physics.stopped) return;
        if (this._phase === PHASE.SWINGING) return;

        this._phase = PHASE.CHARGING;
        this._swingPull = 0;
        this.updateAimPreview();
    }

    releaseCharge() {
        if (this._phase !== PHASE.CHARGING) return;
        this._phase = PHASE.SWINGING;
        this._swingTimer = SWING_DURATION;
        this.trajectory.hide();
    }

    cancelCharge() {
        if (this._phase !== PHASE.CHARGING) return;
        this._phase = PHASE.IDLE;
        this._swingPull = 0;
        this.decorations.setSwingPose(0, 0);
        this.updateAimPreview();
    }

    _executeShot(params) {
        let defaults = this.defaultShot;
        if (this.dashboard) {
            let dashDefaults = this.dashboard.getDefaults();
            if (dashDefaults) {
                defaults = dashDefaults;
            }
        }
        this._lastShotWasDefault = isDefaultShotParams(params, defaults);
        this._wasMoving = false;
        this._strokeCount = this._strokeCount + 1;

        let startX = params.startX;
        if (startX === undefined || startX === null) {
            startX = this.physics.x;
        }
        let startZ = params.startZ;
        if (startZ === undefined || startZ === null) {
            startZ = this.physics.z;
        }
        let groundY = this.course.getHeightAt(startX, startZ);
        this._carryStart.set(startX, startZ);

        if (this._atTee) {
            this.decorations.showPeg(false);
        }
        this.decorations.showClub(false);

        this.physics.setDimpled(params.dimpled !== false);
        this.ball.setDimpledVisual(this.physics.dimpled);

        let aimYaw = this._getAimYaw(params);
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
        this._atTee = false;

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
            this._executeShot(params);
        } else {
            this._executeShot(this._getParams());
        }
    }

    setCameraMode(mode) {
        let previousMode = this.cameraMode;
        this.cameraMode = mode;

        if (previousMode === 'free' && this.flyController) {
            this.flyController.deactivate();
        }

        if (mode === 'free') {
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
        if (!enabled) {
            this.ball.clearTrail();
        }
    }

    setBallType(dimpled) {
        this.physics.setDimpled(dimpled);
        this.ball.setDimpledVisual(dimpled);
        this.updateAimPreview();
    }

    onDashboardChange() {
        this.updateAimPreview();
    }

    _isBallOnGround(groundY) {
        let contactY = groundY + this.physics.R;
        let onSurface = this.physics.y <= contactY + 0.006;
        let lowVerticalSpeed = Math.abs(this.physics.vy) < 2.5;
        return onSurface && lowVerticalSpeed;
    }

    _checkCupEntry(groundY) {
        if (this._inCup) return;

        let dx = this.physics.x - this.holePosition.x;
        let dz = this.physics.z - this.holePosition.z;
        let distance = Math.sqrt(dx * dx + dz * dz);
        if (distance >= CUP_RADIUS) return;

        let zone = this.course.getZoneAt(this.physics.x, this.physics.z);
        let onGreen = zone === ZONE.GREEN || zone === ZONE.FAIRWAY || zone === ZONE.TEE;

        if (!onGreen || !this._isBallOnGround(groundY)) return;
        this._sinkInCup();
    }

    _prepareNextStroke(groundY) {
        let floorY = groundY + this.physics.R;
        if (this.physics.y < floorY) {
            this.physics.y = floorY;
        }
        this.physics.stopped = true;

        this._atTee = this._isNearTee();
        this.decorations.showPeg(this._atTee);
        this.decorations.showClub(true);
        this.decorations.showPlayer(true);

        if (this.dashboard) {
            this.dashboard.setStrokePosition(this.physics.x, this.physics.z);
        }
        this._phase = PHASE.IDLE;
        this.orbitCamera.enableAutoRotate(false);
        this.updateAimPreview();
    }

    update(deltaTime, flyController) {
        if (!this._ready) return;

        if (this._phase === PHASE.CHARGING) {
            this._swingPull = Math.min(this._swingPull + deltaTime * 0.85, MAX_SWING_PULL);
            this.decorations.setSwingPose(this._swingPull, 0);
        }

        if (this._phase === PHASE.SWINGING) {
            this._swingTimer = this._swingTimer - deltaTime;

            let remaining = Math.max(0, this._swingTimer);
            let swingProgress = 1 - remaining / SWING_DURATION;
            this.decorations.setSwingPose(0, swingProgress);

            if (this._swingTimer <= 0) {
                this._phase = PHASE.IDLE;
                this._executeShot(this._getParams());
            }
        }

        let wasStoppedBefore = this.physics.stopped;

        if (!this.physics.stopped) {
            this.physics.update(deltaTime);
            this.bounds.clampBall(this.physics);
            this._wasMoving = true;
        }

        let groundY = this.course.getHeightAt(this.physics.x, this.physics.z);
        let onTee = this._isAtTeeDisplay();

        let teeTopYForSync = null;
        if (onTee) {
            teeTopYForSync = this.decorations.getTeeTopY();
        }

        this.ball.sync(this.physics, this.showTrail, groundY, {
            onTee: onTee,
            teeTopY: teeTopYForSync,
            stopped: this.physics.stopped,
        });

        this._checkCupEntry(groundY);

        if (this._wasMoving && this.physics.stopped && !wasStoppedBefore && !this._inCup) {
            this._onBallJustStopped(groundY);
        }

        this._updateCamera(deltaTime, flyController, groundY);
        this.bounds.clampCamera(this.camera);
        this._updateHUD();
    }

    _onBallJustStopped(groundY) {
        if (this._inCup) return;

        let dx = this.physics.x - this.holePosition.x;
        let dz = this.physics.z - this.holePosition.z;
        let distance = Math.sqrt(dx * dx + dz * dz);

        let zone = this.course.getZoneAt(this.physics.x, this.physics.z);
        let onGreen = zone === ZONE.GREEN || zone === ZONE.FAIRWAY;

        if (distance < CUP_RADIUS && onGreen && this._isBallOnGround(groundY)) {
            this._sinkInCup();
            return;
        }

        if (this._lastShotWasDefault && distance < 1.5 && onGreen && this._isBallOnGround(groundY)) {
            this._sinkInCup();
            return;
        }

        this._prepareNextStroke(groundY);
    }

    _sinkInCup() {
        if (this._inCup) return;
        this._inCup = true;
        this._phase = PHASE.IDLE;
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

    _updateCamera(deltaTime, flyController, groundY) {
        let ballPos = this._getBallVisualPos(groundY);
        let params = this._getParams();

        this._holeTarget.set(
            this.holePosition.x,
            this.course.getHeightAt(this.holePosition.x, this.holePosition.z),
            this.holePosition.z
        );

        if (this.cameraMode === 'free' && flyController) {
            flyController.update(deltaTime);
            return;
        }

        if (this.cameraMode === 'orbit') {
            if (this._canShowAimPreview()) {
                this._applyOrbitAimCamera(ballPos, groundY, params);
            } else {
                this.orbitCamera.update(ballPos, deltaTime, groundY);
            }
            return;
        }

        if (this.cameraMode === 'follow' && this.followBall) {
            this.chaseCamera.update(ballPos, this.physics.velocity, groundY, this._holeTarget, deltaTime);
            if (this._canShowAimPreview()) {
                this._applyViewYawOffset(ballPos, params);
            }
        }
    }

    _updateHUD() {
        let ballPosition = this.physics.position;
        let groundY = this.course.getHeightAt(ballPosition.x, ballPosition.z);

        let carryDx = ballPosition.x - this._carryStart.x;
        let carryDz = ballPosition.z - this._carryStart.y;
        let carryDistance = Math.sqrt(carryDx * carryDx + carryDz * carryDz);

        let holeDx = ballPosition.x - this.holePosition.x;
        let holeDz = ballPosition.z - this.holePosition.z;
        let distanceToHole = Math.sqrt(holeDx * holeDx + holeDz * holeDz);

        let state;
        if (this._inCup) {
            state = 'في الحفرة';
        } else if (this.physics.stopped) {
            state = 'جاهزة للضربة';
        } else {
            state = 'طيران';
        }

        if (this._phase === PHASE.CHARGING) {
            state = 'سحب العصا...';
        } else if (this._phase === PHASE.SWINGING) {
            state = 'ضربة...';
        }

        if (this.dashboard) {
            this.dashboard.updateStats({
                speed: this.physics.speed,
                height: Math.max(0, ballPosition.y - groundY - this.physics.R),
                carry: carryDistance,
                bounces: this.physics.bounceCount,
                time: this.physics.t,
                state: state,
                strokes: this._strokeCount,
            });
        }

        let distanceElement = document.getElementById('hud-distance');
        if (distanceElement) {
            if (this._inCup) {
                distanceElement.textContent = '⛳ داخل الحفرة';
            } else {
                distanceElement.textContent = 'المسافة للحفرة: ' + distanceToHole.toFixed(1) + ' م';
            }
        }

        let zone = this.course.getZoneAt(ballPosition.x, ballPosition.z);
        let zoneElement = document.getElementById('hud-zone');
        if (zoneElement) {
            let label = zone;
            if (zone === ZONE.TEE) {
                label = 'منطقة الإرسال';
            } else if (zone === ZONE.FAIRWAY) {
                label = 'الفيرواي';
            } else if (zone === ZONE.GREEN) {
                label = 'الجرين';
            } else if (zone === ZONE.ROUGH) {
                label = 'عشب طويل';
            } else if (zone === ZONE.BUNKER) {
                label = 'بونكر';
            } else if (zone === ZONE.WATER) {
                label = 'ماء';
            } else if (zone === ZONE.OUT) {
                label = 'خارج الحدود';
            }
            zoneElement.textContent = label;
        }
    }

    beginChargeFromKeyboard() {
        this._spaceCharging = true;
        this.beginCharge();
    }

    releaseChargeFromKeyboard() {
        if (!this._spaceCharging) return;
        this._spaceCharging = false;
        this.releaseCharge();
    }
}
