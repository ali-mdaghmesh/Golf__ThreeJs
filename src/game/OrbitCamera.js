import * as THREE from 'three';

/** كاميرا تدور حول الكرة — نفس اتجاه التصويب (sin/cos) */
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
            this.angle += dt * 0.55;
        }

        const dist = 11;
        const height = Math.max(4, ballPos.y - groundY + 3.5);
        const cam = this.camera;

        cam.position.set(
            ballPos.x + Math.sin(this.angle) * dist,
            ballPos.y + height,
            ballPos.z + Math.cos(this.angle) * dist
        );
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
