import * as THREE from 'three';

export class OrbitCamera {
    constructor(camera) {
        this.camera = camera;
        this.angle = 0;
        this.autoRotate = true; 
    }

    setAngle(radians) {
        this.angle = radians;
        this.autoRotate = false;
    }

    enableAutoRotate(enabled = true) {
        this.autoRotate = enabled;
    }

    update(ballPos, deltaTime, groundY) {
        if (this.autoRotate == true) {
            this.angle = this.angle + deltaTime * 0.55;
        }

        let distanceFromBall = 11;

        let cameraHeight = ballPos.y - groundY + 3.5;
        if (cameraHeight < 4) {
            cameraHeight = 4;
        }

        let cameraX = ballPos.x + Math.sin(this.angle) * distanceFromBall;
        let cameraZ = ballPos.z + Math.cos(this.angle) * distanceFromBall;

        this.camera.position.set(cameraX, ballPos.y + cameraHeight, cameraZ);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(ballPos.x, ballPos.y + 0.15, ballPos.z);
    }

    resetAngle(ballPos, targetPos) {
        let dx = targetPos.x - ballPos.x;
        let dz = targetPos.z - ballPos.z;

        if (dx * dx + dz * dz < 1e-8) {
            this.angle = 0;
        } else {
            this.angle = Math.atan2(dx, dz) + Math.PI;
        }

        this.autoRotate = false;
    }
}
