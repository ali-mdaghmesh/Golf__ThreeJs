import * as THREE from 'three';
import { BallPhysics } from '../Physics/BallPhysics.js';
import { BALL_VISUAL_SCALE } from './BallRenderer.js';
import { computeLaunchVelocity, getAimYawRad } from './ShotAiming.js';

const PHYSICS_RADIUS = 0.02135;
const VISUAL_RADIUS = PHYSICS_RADIUS * BALL_VISUAL_SCALE;
const VISUAL_OFFSET = VISUAL_RADIUS - PHYSICS_RADIUS;

export class TrajectoryPreview {
    constructor(scene) {
        this.scene = scene;
        this.line = null;

        this.lineMaterial = new THREE.LineDashedMaterial();
    }

    hide() {
        if (this.line != null) {
            this.scene.remove(this.line);
            this.line.geometry.dispose();
            this.line = null;
        }
    }

    show(physicsRef, params, holePos, getHeight, getZone) {
        let points = this.simulate(physicsRef, params, holePos, getHeight, getZone);

        this.hide();

        let geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.line = new THREE.Line(geometry, this.lineMaterial);
        this.line.computeLineDistances();
        this.scene.add(this.line);
    }

    simulate(physicsRef, params, holePos, getHeight, getZone) {
        let simulation = new BallPhysics();
        simulation.setDimpled(params.dimpled !== false);
        simulation.setGroundCallbacks(getHeight, getZone);

        let startX = params.startX;
        let startZ = params.startZ;
        let groundY = getHeight(startX, startZ);
        let aimYaw = getAimYawRad(params, startX, startZ, holePos.x, holePos.z);
        let launch = computeLaunchVelocity(params, aimYaw);

        simulation.x = startX;
        simulation.z = startZ;
        simulation.y = Math.max(physicsRef.y, groundY + simulation.R);
        simulation.vx = launch.vx;
        simulation.vy = launch.vy;
        simulation.vz = launch.vz;
        simulation.omegax = launch.omegax;
        simulation.omegay = launch.omegay;
        simulation.omegaz = launch.omegaz;
        simulation.stopped = false;

        let points = [];
        let maxSteps = 25000;
        let stepTime = 0.001;

        for (let step = 1; step <= maxSteps; step += 1) {
            if (simulation.stopped == true) {
                break;
            }

            simulation.update(stepTime);
            let ballGroundY = getHeight(simulation.x, simulation.z);
            let visualY = ballGroundY + VISUAL_RADIUS;
            visualY = simulation.y + VISUAL_OFFSET;
            points.push(new THREE.Vector3(simulation.x, visualY, simulation.z));
        }

        return points;
    }
}
