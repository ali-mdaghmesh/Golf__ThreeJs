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

        if (points.length < 2) {
            return;
        }

        let geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.line = new THREE.Line(geometry, this.lineMaterial);
        this.line.computeLineDistances();
        this.line.frustumCulled = false;
        this.scene.add(this.line);
    }

    simulate(physicsRef, params, holePos, getHeight, getZone) {
        let simulation = new BallPhysics();
        simulation.setDimpled(params.dimpled !== false);
        simulation.setGroundCallbacks(getHeight, getZone);

        let startX = params.startX;
        if (startX === undefined || startX === null) {
            startX = physicsRef.x;
        }

        let startZ = params.startZ;
        if (startZ === undefined || startZ === null) {
            startZ = physicsRef.z;
        }

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
        simulation.t = 0;

        let points = [];
        let stepCount = 0;
        let sampleCount = 0;
        let maxSteps = 25000;
        let stepTime = 0.001;
        let sampleEveryNSteps = 16;

        while (simulation.stopped === false && stepCount < maxSteps) {
            simulation.update(stepTime);
            stepCount = stepCount + 1;
            sampleCount = sampleCount + 1;

            if (sampleCount % sampleEveryNSteps !== 0) {
                continue;
            }

            let ballGroundY = getHeight(simulation.x, simulation.z);
            let surfaceY = ballGroundY + VISUAL_RADIUS;
            
            let isAirborne = false;
            if (simulation.y > ballGroundY + simulation.R + 0.015) {
                isAirborne = true;
            }

            let visualY = 0;
            if (isAirborne === true) {
                visualY = simulation.y + VISUAL_OFFSET;
            } else {
                visualY = surfaceY;
            }

            points.push(new THREE.Vector3(simulation.x, visualY, simulation.z));
        }

        return points;
    }
}
