import * as THREE from 'three';

export class FlyController {
    constructor(camera, domElement, speed = 14) {
        this.camera = camera;
        this.domElement = domElement;
        this.speed = speed;
        this.enabled = false;

        this.yaw = 0;
        this.pitch = 0;
        this.keys = new Set();

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onClick = this._onClick.bind(this);
        this._onLockChange = this._onLockChange.bind(this);
    }

    attach() {
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('pointerlockchange', this._onLockChange);
        this.domElement.addEventListener('click', this._onClick);
    }

    _onKeyDown(e) {
        if (!this.enabled) return;
        if (e.target.matches('input, select, textarea, button')) return;
        this.keys.add(e.code);
    }

    _onKeyUp(e) {
        this.keys.delete(e.code);
    }

    _onClick() {
        if (!this.enabled) return;
        this.domElement.requestPointerLock?.();
    }

    _onLockChange() {
        this._locked = document.pointerLockElement === this.domElement;
    }

    _onMouseMove(e) {
        if (!this.enabled || !this._locked) return;
        this.yaw -= e.movementX * 0.0022;
        this.pitch -= e.movementY * 0.0022;
        const limit = Math.PI / 2 - 0.05;
        this.pitch = THREE.MathUtils.clamp(this.pitch, -limit, limit);
    }

    /** مزامنة الزوايا من اتجاه الكاميرا الحالي (بعد lookAt) */
    activate() {
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        this.yaw = Math.atan2(-dir.x, -dir.z);
        this.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
        this.enabled = true;
        this.camera.rotation.order = 'YXZ';
        this._applyRotation();
    }

    deactivate() {
        this.enabled = false;
        this.keys.clear();
        if (document.pointerLockElement === this.domElement) {
            document.exitPointerLock?.();
        }
    }

    _applyRotation() {
        this.camera.rotation.x = this.pitch;
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.z = 0;
    }

    update(dt) {
        if (!this.enabled) return;

        this._applyRotation();

        const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(this.camera.rotation);

        let move = new THREE.Vector3();
        if (this.keys.has('KeyW')) move.add(forward);
        if (this.keys.has('KeyS')) move.sub(forward);
        if (this.keys.has('KeyD')) move.add(right);
        if (this.keys.has('KeyA')) move.sub(right);
        if (this.keys.has('KeyE') || this.keys.has('Space')) move.y += 1;
        if (this.keys.has('KeyQ')) move.y -= 1;

        if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(this.speed * dt);
            this.camera.position.add(move);
        }
    }
}
