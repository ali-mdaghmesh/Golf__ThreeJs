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
    constructor({ scene, camera, course, dashboard, flyController }) {
        this.scene = scene;
        this.camera = camera;
        this.course = course;
        this.dashboard = dashboard;
        this.flyController = flyController;

        const { width, depth } = course.opt;

        this.physics = new BallPhysics();
        this.physics.setGroundCallbacks(
            (x, z) => course.getHeightAt(x, z),
            (x, z) => course.getZoneAt(x, z)
        );

        this.ball = new BallRenderer(scene, this.physics.R);
        this.chaseCamera = new ChaseCamera(camera);
        this.orbitCamera = new OrbitCamera(camera);
        this.decorations = new CourseDecorations(scene, course);
        this.trajectory = new TrajectoryPreview(scene);

        this.bounds = new WorldBounds({
            halfWidth: width / 2,
            halfDepth: depth / 2,
            margin: 3,
            minCameraY: 1.2,
        });
        this.bounds.setGroundHeightFn((x, z) => course.getHeightAt(x, z));

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
        const hole = this.course.holes[0];
        if (!hole) return { x: 0, z: -41 };
        return { x: hole.teePos.x, z: hole.teePos.z - 5 };
    }

    _resolveHolePosition() {
        const hole = this.course.holes[0];
        if (!hole) return { x: 0, z: 36 };
        return { x: hole.holePos.x, z: hole.holePos.z };
    }

    _getParams() {
        return this.dashboard?.getShootParams() ?? { ...this.defaultShot };
    }

    _getAimYaw(params) {
        const px = params.startX ?? this.physics.x;
        const pz = params.startZ ?? this.physics.z;
        return getAimYawRad(
            params,
            px,
            pz,
            this.holePosition.x,
            this.holePosition.z
        );
    }

    _isNearTee() {
        const a = this.decorations.getTeeAnchor();
        return Math.hypot(this.physics.x - a.x, this.physics.z - a.z) < 0.25;
    }

    _isAtTeeDisplay() {
        return this._atTee && this.physics.stopped && !this._inCup;
    }

    _canShowAimPreview() {
        return (
            this._ready &&
            this.physics.stopped &&
            !this._inCup &&
            this._phase !== PHASE.SWINGING
        );
    }

    _syncBallOnTee() {
        const anchor = this.decorations.getTeeAnchor();
        const py = this.decorations.getBallPhysicsY(this.physics.R);
        this.physics.x = anchor.x;
        this.physics.z = anchor.z;
        this.physics.y = py;
        this.physics.stopped = true;
        this._atTee = true;
        return { anchor, py };
    }

    _getBallVisualPos(gy) {
        const { x, y, z } = this.physics.position;
        const onTee = this._isAtTeeDisplay();
        const vy = this.ball.computeVisualY(
            y,
            gy,
            onTee,
            onTee ? this.decorations.getTeeTopY() : null,
            this.physics.stopped
        );
        this._ballVisual.set(x, vy, z);
        return this._ballVisual;
    }

    updateAimPreview() {
        if (!this._canShowAimPreview()) return;

        const params = this._getParams();
        const tx = params.startX ?? this.physics.x;
        const tz = params.startZ ?? this.physics.z;
        const gy = this.course.getHeightAt(tx, tz);

        this.physics.x = tx;
        this.physics.z = tz;
        this.physics.y = gy + this.physics.R;
        this.physics.stopped = true;

        const aimYaw = this._getAimYaw(params);
        this.decorations.positionForStroke(tx, tz, aimYaw, gy, this._atTee);

        if (this._phase === PHASE.IDLE) {
            this.decorations.setSwingPose(0, 0);
        }

        this.trajectory.show(
            this.physics,
            params,
            this.holePosition,
            (x, z) => this.course.getHeightAt(x, z),
            (x, z) => this.course.getZoneAt(x, z)
        );

        if (this.cameraMode === 'orbit') {
            const ballVisual = this._getBallVisualPos(gy);
            this._applyOrbitAimCamera(ballVisual, gy, params);
        }
    }

    _applyOrbitAimCamera(ballPos, groundY, params) {
        const viewRad = ((params.viewYawDeg ?? 0) * Math.PI) / 180;
        const aimYaw = this._getAimYaw(params);
        this.orbitCamera.setAngle(aimYaw + Math.PI + viewRad);
        this.orbitCamera.update(ballPos, 0, groundY);
    }

    _applyViewYawOffset(ballPos, params) {
        const viewDeg = params.viewYawDeg ?? 0;
        if (Math.abs(viewDeg) < 0.5) return;

        const viewRad = (viewDeg * Math.PI) / 180;
        const aimYaw = this._getAimYaw(params);
        const cam = this.camera;

        this._offset.copy(cam.position).sub(ballPos);
        this._offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), viewRad);
        cam.position.copy(ballPos).add(this._offset);

        const lookX = ballPos.x + Math.sin(aimYaw) * 10;
        const lookZ = ballPos.z + Math.cos(aimYaw) * 10;
        cam.up.set(0, 1, 0);
        cam.lookAt(lookX, ballPos.y + 0.15, lookZ);

        this.chaseCamera.position.copy(cam.position);
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
        const { anchor } = this._syncBallOnTee();
        this.ball.clearTrail();

        const gy = this.course.getHeightAt(anchor.x, anchor.z);
        this.ball.sync(this.physics, false, gy, {
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
        this.dashboard?.setDefaults(this.defaultShot);
        this.dashboard?.setStrokePosition(anchor.x, anchor.z, false);

        this.updateAimPreview();
        const ballVisual = this._getBallVisualPos(gy);
        const holePos = new THREE.Vector3(
            this.holePosition.x,
            gy,
            this.holePosition.z
        );
        this.chaseCamera.snapToTee(ballVisual, holePos, gy);
        this.orbitCamera.resetAngle(ballVisual, holePos);
        document.getElementById('hud-win')?.classList.remove('show');
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
        const defaults = this.dashboard?.getDefaults() ?? this.defaultShot;
        this._lastShotWasDefault = isDefaultShotParams(params, defaults);
        this._wasMoving = false;
        this._strokeCount += 1;

        const gx = params.startX ?? this.physics.x;
        const gz = params.startZ ?? this.physics.z;
        const gy = this.course.getHeightAt(gx, gz);
        this._carryStart.set(gx, gz);

        if (this._atTee) this.decorations.showPeg(false);
        this.decorations.showClub(false);

        this.physics.setDimpled(params.dimpled !== false);
        this.ball.setDimpledVisual(this.physics.dimpled);

        const aimYaw = this._getAimYaw(params);
        const launch = computeLaunchVelocity(params, aimYaw);

        this.physics.shoot({
            vx: launch.vx,
            vy: launch.vy,
            vz: launch.vz,
            omegax: launch.omegax,
            omegay: launch.omegay,
            omegaz: launch.omegaz,
            startX: gx,
            startZ: gz,
        });
        this.physics.y = Math.max(this.physics.y, gy + this.physics.R);
        this._atTee = false;

        this.trajectory.hide();
        this.ball.clearTrail();
        this.orbitCamera.enableAutoRotate(true);
        document.getElementById('hud-win')?.classList.remove('show');
    }

    shoot(params) {
        this._executeShot(params ?? this._getParams());
    }

    setCameraMode(mode) {
        const prev = this.cameraMode;
        this.cameraMode = mode;
        if (prev === 'free') this.flyController?.deactivate();
        if (mode === 'free') {
            this.cancelCharge();
            this.flyController?.activate();
        } else {
            this.updateAimPreview();
        }
    }

    setFollowBall(enabled) {
        this.followBall = enabled;
    }

    setTrail(enabled) {
        this.showTrail = enabled;
        if (!enabled) this.ball.clearTrail();
    }

    setBallType(dimpled) {
        this.physics.setDimpled(dimpled);
        this.ball.setDimpledVisual(dimpled);
        this.updateAimPreview();
    }

    onDashboardChange() {
        this.updateAimPreview();
    }

    _isBallOnGround(gy) {
        const contact = gy + this.physics.R;
        const onSurface = this.physics.y <= contact + 0.006;
        const lowVerticalSpeed = Math.abs(this.physics.vy) < 2.5;
        return onSurface && lowVerticalSpeed;
    }

    _checkCupEntry(gy) {
        if (this._inCup) return;

        const dist = Math.hypot(
            this.physics.x - this.holePosition.x,
            this.physics.z - this.holePosition.z
        );
        if (dist >= CUP_RADIUS) return;

        const zone = this.course.getZoneAt(this.physics.x, this.physics.z);
        const onGreen =
            zone === ZONE.GREEN ||
            zone === ZONE.FAIRWAY ||
            zone === ZONE.TEE;

        if (!onGreen || !this._isBallOnGround(gy)) return;
        this._sinkInCup();
    }

    _prepareNextStroke(gy) {
        const floor = gy + this.physics.R;
        if (this.physics.y < floor) this.physics.y = floor;
        this.physics.stopped = true;

        this._atTee = this._isNearTee();
        this.decorations.showPeg(this._atTee);
        this.decorations.showClub(true);
        this.decorations.showPlayer(true);

        this.dashboard?.setStrokePosition(this.physics.x, this.physics.z);
        this._phase = PHASE.IDLE;
        this.orbitCamera.enableAutoRotate(false);
        this.updateAimPreview();
    }

    update(dt, flyController) {
        if (!this._ready) return;

        if (this._phase === PHASE.CHARGING) {
            this._swingPull = Math.min(this._swingPull + dt * 0.85, MAX_SWING_PULL);
            this.decorations.setSwingPose(this._swingPull, 0);
        }

        if (this._phase === PHASE.SWINGING) {
            this._swingTimer -= dt;
            const t = 1 - Math.max(0, this._swingTimer) / SWING_DURATION;
            this.decorations.setSwingPose(0, t);
            if (this._swingTimer <= 0) {
                this._phase = PHASE.IDLE;
                this._executeShot(this._getParams());
            }
        }

        const wasStopped = this.physics.stopped;

        if (!this.physics.stopped) {
            this.physics.update(dt);
            this.bounds.clampBall(this.physics);
            this._wasMoving = true;
        }

        const gy = this.course.getHeightAt(this.physics.x, this.physics.z);
        const onTee = this._isAtTeeDisplay();

        this.ball.sync(this.physics, this.showTrail, gy, {
            onTee,
            teeTopY: onTee ? this.decorations.getTeeTopY() : null,
            stopped: this.physics.stopped,
        });

        this._checkCupEntry(gy);

        if (this._wasMoving && this.physics.stopped && !wasStopped && !this._inCup) {
            this._onBallJustStopped(gy);
        }

        this._updateCamera(dt, flyController, gy);
        this.bounds.clampCamera(this.camera);
        this._updateHUD();
    }

    _onBallJustStopped(gy) {
        if (this._inCup) return;

        const dist = Math.hypot(
            this.physics.x - this.holePosition.x,
            this.physics.z - this.holePosition.z
        );
        const zone = this.course.getZoneAt(this.physics.x, this.physics.z);
        const onGreen = zone === ZONE.GREEN || zone === ZONE.FAIRWAY;

        if (dist < CUP_RADIUS && onGreen && this._isBallOnGround(gy)) {
            this._sinkInCup();
            return;
        }

        if (
            this._lastShotWasDefault &&
            dist < 1.5 &&
            onGreen &&
            this._isBallOnGround(gy)
        ) {
            this._sinkInCup();
            return;
        }

        this._prepareNextStroke(gy);
    }

    _sinkInCup() {
        if (this._inCup) return;
        this._inCup = true;
        this._phase = PHASE.IDLE;
        this.trajectory.hide();
        this.decorations.showClub(false);

        const hgy = this.course.getHeightAt(
            this.holePosition.x,
            this.holePosition.z
        );
        this.physics.x = this.holePosition.x;
        this.physics.z = this.holePosition.z;
        this.physics.y = hgy + this.physics.R * 0.3;
        this.physics.stopped = true;

        this.ball.sync(this.physics, false, hgy, { stopped: true });
        document.getElementById('hud-win')?.classList.add('show');
    }

    _updateCamera(dt, flyController, gy) {
        const ballPos = this._getBallVisualPos(gy);
        const params = this._getParams();

        this._holeTarget.set(
            this.holePosition.x,
            this.course.getHeightAt(this.holePosition.x, this.holePosition.z),
            this.holePosition.z
        );

        if (this.cameraMode === 'free' && flyController) {
            flyController.update(dt);
            return;
        }

        if (this.cameraMode === 'orbit') {
            if (this._canShowAimPreview()) {
                this._applyOrbitAimCamera(ballPos, gy, params);
            } else {
                this.orbitCamera.update(ballPos, dt, gy);
            }
            return;
        }

        if (this.cameraMode === 'follow' && this.followBall) {
            this.chaseCamera.update(
                ballPos,
                this.physics.velocity,
                gy,
                this._holeTarget,
                dt
            );
            if (this._canShowAimPreview()) {
                this._applyViewYawOffset(ballPos, params);
            }
        }
    }

    _updateHUD() {
        const p = this.physics.position;
        const gy = this.course.getHeightAt(p.x, p.z);
        const carry = Math.hypot(p.x - this._carryStart.x, p.z - this._carryStart.y);
        const distToHole = Math.hypot(
            p.x - this.holePosition.x,
            p.z - this.holePosition.z
        );

        let state = this._inCup
            ? 'في الحفرة'
            : this.physics.stopped
              ? 'جاهزة للضربة'
              : 'طيران';

        if (this._phase === PHASE.CHARGING) {
            state = 'سحب العصا...';
        } else if (this._phase === PHASE.SWINGING) {
            state = 'ضربة...';
        }

        this.dashboard?.updateStats({
            speed: this.physics.speed,
            height: Math.max(0, p.y - gy - this.physics.R),
            carry,
            bounces: this.physics.bounceCount,
            time: this.physics.t,
            state,
            strokes: this._strokeCount,
        });

        const distEl = document.getElementById('hud-distance');
        if (distEl) {
            distEl.textContent = this._inCup
                ? '⛳ داخل الحفرة'
                : `المسافة للحفرة: ${distToHole.toFixed(1)} م`;
        }

        const zone = this.course.getZoneAt(p.x, p.z);
        const zoneEl = document.getElementById('hud-zone');
        if (zoneEl) {
            const labels = {
                [ZONE.TEE]: 'منطقة الإرسال',
                [ZONE.FAIRWAY]: 'الفيرواي',
                [ZONE.GREEN]: 'الجرين',
                [ZONE.ROUGH]: 'عشب طويل',
                [ZONE.BUNKER]: 'بونكر',
                [ZONE.WATER]: 'ماء',
                [ZONE.OUT]: 'خارج الحدود',
            };
            zoneEl.textContent = labels[zone] ?? zone;
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
