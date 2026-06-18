import * as THREE from 'three';
import { BallPhysics } from '../Physics/BallPhysics.js';
import { BALL_VISUAL_SCALE } from './BallRenderer.js';
import { computeLaunchVelocity, getAimYawRad } from './ShotAiming.js';

const VISUAL_R = 0.02135 * BALL_VISUAL_SCALE;
const VISUAL_OFFSET = VISUAL_R - 0.02135;

export class TrajectoryPreview {
    constructor(scene) {
        this.scene = scene;
        this.line = null;
        this._mat = new THREE.LineDashedMaterial({
            color: 0xfff59d,
            dashSize: 0.5,
            gapSize: 0.32,
            transparent: true,
            opacity: 0.88,
            depthTest: true,
        });
    }

    hide() {
        if (this.line) {
            this.scene.remove(this.line);
            this.line.geometry.dispose();
            this.line = null;
        }
    }

    show(physicsRef, params, holePos, getHeight, getZone) {
        const points = this._simulate(
            physicsRef,
            params,
            holePos,
            getHeight,
            getZone
        );
        this.hide();
        if (points.length < 2) return;

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        this.line = new THREE.Line(geo, this._mat);
        this.line.computeLineDistances();
        this.line.frustumCulled = false;
        this.scene.add(this.line);
    }

    _simulate(physicsRef, params, holePos, getHeight, getZone) {
        const sim = new BallPhysics();
        sim.setDimpled(params.dimpled !== false);
        sim.setGroundCallbacks(getHeight, getZone);

        const gx = params.startX ?? physicsRef.x;
        const gz = params.startZ ?? physicsRef.z;
        const gy0 = getHeight(gx, gz);
        const aimYaw = getAimYawRad(params, gx, gz, holePos.x, holePos.z);
        const launch = computeLaunchVelocity(params, aimYaw);

        sim.x = gx;
        sim.z = gz;
        sim.y = Math.max(physicsRef.y, gy0 + sim.R);
        sim.vx = launch.vx;
        sim.vy = launch.vy;
        sim.vz = launch.vz;
        sim.omegax = launch.omegax;
        sim.omegay = launch.omegay;
        sim.omegaz = launch.omegaz;
        sim.stopped = false;
        sim.t = 0;

        const pts = [];
        let steps = 0;
        let sample = 0;

        while (!sim.stopped && steps < 25000) {
            sim.update(0.001);
            steps++;
            sample++;
            if (sample % 16 !== 0) continue;

            const gy = getHeight(sim.x, sim.z);
            const surfaceY = gy + VISUAL_R;
            const airborne = sim.y > gy + sim.R + 0.015;
            const vy = airborne ? sim.y + VISUAL_OFFSET : surfaceY;
            pts.push(new THREE.Vector3(sim.x, vy, sim.z));
        }

        if (pts.length === 0) {
            pts.push(new THREE.Vector3(gx, gy0 + VISUAL_R, gz));
        }
        return pts;
    }
}
