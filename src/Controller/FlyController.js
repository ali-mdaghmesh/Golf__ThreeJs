import * as THREE from 'three';

export class FlyController {
    constructor(camera, domElement, speed = 14) {
        this.camera = camera;
        this.domElement = domElement;
        this.speed = speed;
        this.isEnabled = false;

        this.yawAngle = 0;
        this.pitchAngle = 0;
        this.pressedKeys = {};
        this.isLocked = false;
    }

    attach() {
        window.addEventListener('keydown', (event) => {
            if (!this.isEnabled) return;
            this.pressedKeys[event.code] = true;
        });
        window.addEventListener('keyup', (event) => {
            this.pressedKeys[event.code] = false;
        });
        document.addEventListener('mousemove', (event) => {
            if (!this.isEnabled || !this.isLocked) return;
            this.yawAngle -= event.movementX * 0.0022;
            this.pitchAngle -= event.movementY * 0.0022;
            let limit = 1.5;
            if (this.pitchAngle > limit) this.pitchAngle = limit;
            if (this.pitchAngle < -limit) this.pitchAngle = -limit;
        });
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.domElement;
        });
        this.domElement.addEventListener('click', () => {
            if (!this.isEnabled) return;
            this.domElement.requestPointerLock();
        });
    }

    activate() {
        let direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        this.yawAngle = Math.atan2(-direction.x, -direction.z);
        this.pitchAngle = Math.asin(direction.y);
        this.isEnabled = true;
        this.camera.rotation.order = 'YXZ';
        this.applyRotation();
    }

    deactivate() {
        this.isEnabled = false;
        this.pressedKeys = {};
        if (document.pointerLockElement === this.domElement) {
            document.exitPointerLock();
        }
    }

    applyRotation() {
        this.camera.rotation.x = this.pitchAngle;
        this.camera.rotation.y = this.yawAngle;
        this.camera.rotation.z = 0;
    }

    update(deltaTime) {
        if (!this.isEnabled) return;

        this.applyRotation();

        let forwardVector = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
        let rightVector = new THREE.Vector3(1, 0, 0).applyEuler(this.camera.rotation);

        let moveDirection = new THREE.Vector3(0, 0, 0);
        if (this.pressedKeys['KeyW']) moveDirection.add(forwardVector);
        if (this.pressedKeys['KeyS']) moveDirection.sub(forwardVector);
        if (this.pressedKeys['KeyD']) moveDirection.add(rightVector);
        if (this.pressedKeys['KeyA']) moveDirection.sub(rightVector);
        if (this.pressedKeys['KeyE'] || this.pressedKeys['Space']) moveDirection.y += 1;
        if (this.pressedKeys['KeyQ']) moveDirection.y -= 1;

        if (moveDirection.lengthSq() > 0) {
            moveDirection.normalize();
            this.camera.position.addScaledVector(moveDirection, this.speed * deltaTime);
        }
    }
}
