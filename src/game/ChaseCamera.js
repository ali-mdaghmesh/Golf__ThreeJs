import * as THREE from 'three';

// كاميرا تطارد الكرة من الخلف، متل لعبة سباق
export class ChaseCamera {
    constructor(camera) {
        this.camera = camera;
        this.position = new THREE.Vector3();
        this.lookAt = new THREE.Vector3();
        this._initialized = false;
    }

    update(ballPos, vel, groundY, holePos, dt) {
        const cam = this.camera;
        const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy + vel.vz * vel.vz);

        // اتجاه الكاميرا حسب اتجاه حركة الكرة، وإذا الكرة واقفة منستخدم اتجاه الحفرة بدالها
        let forward = new THREE.Vector3(vel.vx, 0, vel.vz);
        if (forward.lengthSq() < 0.25) {
            forward.set(
                holePos.x - ballPos.x,
                0,
                holePos.z - ballPos.z
            );
        }
        if (forward.lengthSq() < 0.01) {
            forward.set(0, 0, 1);
        }
        forward.normalize();

        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3();
        right.crossVectors(forward, up);
        right.normalize();

        const speedRatio1 = Math.min(1, speed / 40);
        const speedRatio2 = Math.min(1, speed / 35);
        const distBack = THREE.MathUtils.lerp(5, 11, speedRatio1);
        let height = THREE.MathUtils.lerp(2.8, 5, speedRatio2);
        height += Math.max(0, ballPos.y - groundY - 0.15) * 0.25;
        const side = 1.2;

        const desired = new THREE.Vector3();
        desired.copy(ballPos);
        desired.addScaledVector(forward, -distBack);
        desired.addScaledVector(up, height);
        desired.addScaledVector(right, side);

        // ما نخلي الكاميرا تنزل تحت الأرض
        if (desired.y < groundY + 1.5) {
            desired.y = groundY + 1.5;
        }

        const lookAhead = speed > 0.5 ? 10 : 4;
        const lookTarget = new THREE.Vector3();
        lookTarget.copy(ballPos);
        lookTarget.addScaledVector(forward, lookAhead);
        lookTarget.add(new THREE.Vector3(0, 0.2, 0));

        if (!this._initialized) {
            this.position.copy(desired);
            this.lookAt.copy(lookTarget);
            this._initialized = true;
        }

        // smoothing حتى الكاميرا ما تقفز فجأة، lerp بسيط مبني على الوقت
        const smooth = 1 - Math.exp(-4.5 * dt);
        this.position.lerp(desired, smooth);
        this.lookAt.lerp(lookTarget, smooth * 1.1);

        cam.position.copy(this.position);
        cam.up.set(0, 1, 0);
        cam.lookAt(this.lookAt);
    }

    /**
     * منظر إرسال طبيعي: خلف الكرة بارتفاع معتدل نحو الحفرة
     */
    snapToTee(ballPos, holePos, groundY) {
        const dir = new THREE.Vector3(
            holePos.x - ballPos.x,
            0,
            holePos.z - ballPos.z
        );
        if (dir.lengthSq() < 0.01) {
            dir.set(0, 0, 1);
        }
        dir.normalize();

        const back = 5.5;
        const upHeight = 2.8;

        const camY = Math.max(groundY + upHeight, ballPos.y + 1.5);
        this.position.set(
            ballPos.x - dir.x * back,
            camY,
            ballPos.z - dir.z * back
        );

        this.lookAt.set(
            ballPos.x + dir.x * 12,
            ballPos.y + 0.15,
            ballPos.z + dir.z * 12
        );

        const cam = this.camera;
        cam.position.copy(this.position);
        cam.up.set(0, 1, 0);
        cam.rotation.set(0, 0, 0);
        cam.lookAt(this.lookAt);
        this._initialized = true;
    }
}
