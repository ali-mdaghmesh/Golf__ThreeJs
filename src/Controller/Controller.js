import * as THREE from 'three';

export class Controller {
    constructor(camera, domElement, speed) {
        this.camera = camera;
        this.domElement = domElement;
        this.speed = speed;

        this.wIsPressed = false;
        this.aIsPressed = false;
        this.sIsPressed = false;
        this.dIsPressed = false;
        this.qIsPressed = false;
        this.eIsPressed = false;

        this.mouseX = 0;
        this.mouseY = 0;
        this.isLocked = false;

        this.initEvents();
    }

    initEvents() {
        window.addEventListener('keydown', (event) => {
            if (event.key == 'w') { this.wIsPressed = true; }
            if (event.key == 'a') { this.aIsPressed = true; }
            if (event.key == 's') { this.sIsPressed = true; }
            if (event.key == 'd') { this.dIsPressed = true; }
            if (event.key == 'q') { this.qIsPressed = true; }
            if (event.key == 'e') { this.eIsPressed = true; }
        });

        window.addEventListener('keyup', (event) => {
            if (event.key == 'w') { this.wIsPressed = false; }
            if (event.key == 'a') { this.aIsPressed = false; }
            if (event.key == 's') { this.sIsPressed = false; }
            if (event.key == 'd') { this.dIsPressed = false; }
            if (event.key == 'q') { this.qIsPressed = false; }
            if (event.key == 'e') { this.eIsPressed = false; }
        });

        this.domElement.addEventListener('click', () => {
            this.domElement.requestPointerLock();
            this.isLocked = true;
        });

        document.addEventListener('mousemove', (event) => {
            if (this.isLocked == true) {
                this.mouseX = this.mouseX - event.movementX * 0.002;
                this.mouseY = this.mouseY - event.movementY * 0.002;
                
                if (this.mouseY > 1.5) { 
                    this.mouseY = 1.5; 
                }
                if (this.mouseY < -1.5) { 
                    this.mouseY = -1.5; 
                }
            }
        });
    }

    update() {
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.mouseX;
        this.camera.rotation.x = this.mouseY;

        let moveX = 0;
        let moveZ = 0;

        if (this.wIsPressed == true) { moveZ = moveZ - 1; }
        if (this.sIsPressed == true) { moveZ = moveZ + 1; }
        if (this.aIsPressed == true) { moveX = moveX - 1; }
        if (this.dIsPressed == true) { moveX = moveX + 1; }

        let moveVector = new THREE.Vector3(moveX, 0, moveZ);
        let lookDirection = new THREE.Euler(0, this.mouseX, 0);
        moveVector.applyEuler(lookDirection);

        this.camera.position.x = this.camera.position.x + (moveVector.x * this.speed);
        this.camera.position.z = this.camera.position.z + (moveVector.z * this.speed);

        if (this.qIsPressed == true) { 
            this.camera.position.y = this.camera.position.y + this.speed; 
        }
        if (this.eIsPressed == true) { 
            this.camera.position.y = this.camera.position.y - this.speed; 
        }
    }
}