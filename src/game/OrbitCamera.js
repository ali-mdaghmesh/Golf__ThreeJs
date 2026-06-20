import * as THREE from 'three';

// كاميرا تدور حول الكرة بشكل دائري (orbit)
export class OrbitCamera {
    constructor(camera) {
        this.camera = camera;
        this.angle = 0;
        this.autoRotate = true;
    }

    setAngle(rad) {
        this.angle = rad;
        this.autoRotate = false;
    }

    enableAutoRotate(enabled = true) {
        this.autoRotate = enabled;
    }

    update(ballPos, dt, groundY) {
        if (this.autoRotate) {
            this.angle = this.angle + dt * 0.55;
        }

        const dist = 11;
        let height = ballPos.y - groundY + 3.5;
        if (height < 4) {
            height = 4;
        }

        const cam = this.camera;
        const camX = ballPos.x + Math.sin(this.angle) * dist;
        const camZ = ballPos.z + Math.cos(this.angle) * dist;
        cam.position.set(camX, ballPos.y + height, camZ);
        cam.up.set(0, 1, 0);
        cam.lookAt(ballPos.x, ballPos.y + 0.15, ballPos.z);
    }

    resetAngle(ballPos, targetPos) {
        const dx = targetPos.x - ballPos.x;
        const dz = targetPos.z - ballPos.z;

        if (dx * dx + dz * dz < 1e-8) {
            this.angle = 0;
        } else {
            this.angle = Math.atan2(dx, dz) + Math.PI;
        }
        this.autoRotate = false;
    }
}
