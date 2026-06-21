import * as THREE from 'three';

export class ChaseCamera {
    constructor(camera) {
        this.camera = camera;

        this.position = new THREE.Vector3();
        this.lookAt = new THREE.Vector3();

        this.isFirstUpdate = true;
    }

    update(ballPos, velocity, groundY, holePos, deltaTime) {
        let speed = Math.sqrt(
            velocity.vx * velocity.vx +
            velocity.vy * velocity.vy +
            velocity.vz * velocity.vz
        );

        let forwardDir = new THREE.Vector3(velocity.vx, 0, velocity.vz);

        if (forwardDir.lengthSq() < 0.25) {
            forwardDir.set(
                holePos.x - ballPos.x,
                0,
                holePos.z - ballPos.z
            );
        }

        if (forwardDir.lengthSq() < 0.01) {
            forwardDir.set(0, 0, 1);
        }

        forwardDir.normalize();

        let upDir = new THREE.Vector3(0, 1, 0);
        let rightDir = new THREE.Vector3();
        rightDir.crossVectors(forwardDir, upDir);
        rightDir.normalize();

        let speedFactorDistance = Math.min(1, speed / 40);
        let speedFactorHeight = Math.min(1, speed / 35);

        let distanceBehind = THREE.MathUtils.lerp(5, 11, speedFactorDistance);
        let cameraHeight = THREE.MathUtils.lerp(2.8, 5, speedFactorHeight);

        let ballHeightAboveGround = ballPos.y - groundY - 0.15;
        if (ballHeightAboveGround < 0) {
            ballHeightAboveGround = 0;
        }
        cameraHeight += ballHeightAboveGround * 0.25;

        let sideOffset = 1.2;

        let desiredPos = new THREE.Vector3();
        desiredPos.copy(ballPos);
        desiredPos.addScaledVector(forwardDir, -distanceBehind);
        desiredPos.addScaledVector(upDir, cameraHeight);
        desiredPos.addScaledVector(rightDir, sideOffset);

        let minCameraY = groundY + 1.5;
        if (desiredPos.y < minCameraY) {
            desiredPos.y = minCameraY;
        }

        let lookAheadDistance = 4;
        if (speed > 0.5) {
            lookAheadDistance = 10;
        }

        let desiredLookAt = new THREE.Vector3();
        desiredLookAt.copy(ballPos);
        desiredLookAt.addScaledVector(forwardDir, lookAheadDistance);
        desiredLookAt.add(new THREE.Vector3(0, 0.2, 0));

        if (this.isFirstUpdate == true) {
            this.position.copy(desiredPos);
            this.lookAt.copy(desiredLookAt);
            this.isFirstUpdate = false;
        }

        let smoothAmount = 1 - Math.exp(-4.5 * deltaTime);
        this.position.lerp(desiredPos, smoothAmount);
        this.lookAt.lerp(desiredLookAt, smoothAmount * 1.1);

        this.camera.position.copy(this.position);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(this.lookAt);
    }

    snapToTee(ballPos, holePos, groundY) {
        let dirToHole = new THREE.Vector3(
            holePos.x - ballPos.x,
            0,
            holePos.z - ballPos.z
        );

        if (dirToHole.lengthSq() < 0.01) {
            dirToHole.set(0, 0, 1);
        }
        dirToHole.normalize();

        let distanceBack = 5.5;
        let heightAbove = 2.8;

        let cameraY = Math.max(groundY + heightAbove, ballPos.y + 1.5);

        this.position.set(
            ballPos.x - dirToHole.x * distanceBack,
            cameraY,
            ballPos.z - dirToHole.z * distanceBack
        );

        this.lookAt.set(
            ballPos.x + dirToHole.x * 12,
            ballPos.y + 0.15,
            ballPos.z + dirToHole.z * 12
        );

        this.camera.position.copy(this.position);
        this.camera.up.set(0, 1, 0);
        this.camera.rotation.set(0, 0, 0);
        this.camera.lookAt(this.lookAt);

        this.isFirstUpdate = false;
    }
}
