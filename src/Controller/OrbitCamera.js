import * as THREE from 'three';

export class OrbitCamera {
    constructor(camera) {
        this.camera = camera;
        this.currentAngle = 0;
        this.autoRotateEnabled = true; 
    }

    setAngle(radians) {
        this.currentAngle = radians;
        this.autoRotateEnabled = false;
    }

    enableAutoRotate(value = true) {
        this.autoRotateEnabled = value;
    }

    update(ballPosition, deltaTime, groundY) {
        if (this.autoRotateEnabled == true) {
            this.currentAngle = this.currentAngle + deltaTime * 0.55;
        }

        let distance = 11;

        let height = ballPosition.y - groundY + 3.5;
        if (height < 4) {
            height = 4;
        }

        let cameraX = ballPosition.x + Math.sin(this.currentAngle) * distance;
        let cameraZ = ballPosition.z + Math.cos(this.currentAngle) * distance;

        this.camera.position.set(cameraX, ballPosition.y + height, cameraZ);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(ballPosition.x, ballPosition.y + 0.15, ballPosition.z);
    }

    resetAngle(ballPosition, targetPosition) {
        let diffX = targetPosition.x - ballPosition.x;
        let diffZ = targetPosition.z - ballPosition.z;

        if (diffX * diffX + diffZ * diffZ < 0.001) {
            this.currentAngle = 0;
        } else {
            this.currentAngle = Math.atan2(diffX, diffZ) + Math.PI;
        }

        this.autoRotateEnabled = false;
    }
}
