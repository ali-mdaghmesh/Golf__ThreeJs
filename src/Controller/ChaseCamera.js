import * as THREE from 'three';

export class ChaseCamera {
    constructor(camera) {
        this.camera = camera;
        this.currentPosition = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();
        this.isFirstUpdate = true;
    }

    update(ballPosition, velocity, groundY, holePosition, deltaTime) {
        let speed = Math.sqrt(
            velocity.vx * velocity.vx + 
            velocity.vy * velocity.vy + 
            velocity.vz * velocity.vz
        );

        let forwardDirection = new THREE.Vector3(velocity.vx, 0, velocity.vz);

        if (forwardDirection.lengthSq() < 0.25) {
            forwardDirection.set(
                holePosition.x - ballPosition.x, 
                0, 
                holePosition.z - ballPosition.z
            );
        }

        if (forwardDirection.lengthSq() < 0.01) {
            forwardDirection.set(0, 0, 1);
        }

        forwardDirection.normalize();

        let upDirection = new THREE.Vector3(0, 1, 0);
        let rightDirection = new THREE.Vector3();
        rightDirection.crossVectors(forwardDirection, upDirection);
        rightDirection.normalize();

        let distanceFactor = speed / 40;
        if (distanceFactor > 1) {
            distanceFactor = 1;
        }

        let heightFactor = speed / 35;
        if (heightFactor > 1) {
            heightFactor = 1;
        }

        let distanceBehind = 5 + (11 - 5) * distanceFactor;
        let cameraHeight = 2.8 + (5 - 2.8) * heightFactor;

        let ballHeight = ballPosition.y - groundY - 0.15;
        if (ballHeight < 0) {
            ballHeight = 0;
        }
        cameraHeight = cameraHeight + ballHeight * 0.25;

        let sideOffset = 1.2;

        let targetPosition = new THREE.Vector3();
        targetPosition.copy(ballPosition);
        targetPosition.x = targetPosition.x - forwardDirection.x * distanceBehind + rightDirection.x * sideOffset;
        targetPosition.y = targetPosition.y + upDirection.y * cameraHeight;
        targetPosition.z = targetPosition.z - forwardDirection.z * distanceBehind + rightDirection.z * sideOffset;

        if (targetPosition.y < groundY + 1.5) {
            targetPosition.y = groundY + 1.5;
        }

        let lookAheadDistance = 4;
        if (speed > 0.5) {
            lookAheadDistance = 10;
        }

        let targetLookAt = new THREE.Vector3();
        targetLookAt.copy(ballPosition);
        targetLookAt.x = targetLookAt.x + forwardDirection.x * lookAheadDistance;
        targetLookAt.y = targetLookAt.y + 0.2;
        targetLookAt.z = targetLookAt.z + forwardDirection.z * lookAheadDistance;

        if (this.isFirstUpdate == true) {
            this.currentPosition.copy(targetPosition);
            this.currentLookAt.copy(targetLookAt);
            this.isFirstUpdate = false;
        }

        let smoothValue = deltaTime * 4.5;
        if (smoothValue > 1) {
            smoothValue = 1;
        }

        this.currentPosition.lerp(targetPosition, smoothValue);
        this.currentLookAt.lerp(targetLookAt, smoothValue);

        this.camera.position.copy(this.currentPosition);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(this.currentLookAt);
    }

    snapToTee(ballPosition, holePosition, groundY) {
        let directionToHole = new THREE.Vector3(
            holePosition.x - ballPosition.x, 
            0, 
            holePosition.z - ballPosition.z
        );

        if (directionToHole.lengthSq() < 0.01) {
            directionToHole.set(0, 0, 1);
        }
        directionToHole.normalize();

        let distanceBack = 5.5;
        let heightValue = 2.8;

        let cameraY = groundY + heightValue;
        if (ballPosition.y + 1.5 > cameraY) {
            cameraY = ballPosition.y + 1.5;
        }

        this.currentPosition.set(
            ballPosition.x - directionToHole.x * distanceBack,
            cameraY,
            ballPosition.z - directionToHole.z * distanceBack
        );

        this.currentLookAt.set(
            ballPosition.x + directionToHole.x * 12,
            ballPosition.y + 0.15,
            ballPosition.z + directionToHole.z * 12
        );

        this.camera.position.copy(this.currentPosition);
        this.camera.up.set(0, 1, 0);
        this.camera.rotation.set(0, 0, 0);
        this.camera.lookAt(this.currentLookAt);

        this.isFirstUpdate = false;
    }
}
