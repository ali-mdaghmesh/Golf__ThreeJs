import * as THREE from 'three';

export const BALL_VISUAL_SCALE = 2.4;
const PHYSICS_RADIUS = 0.02135;

export class BallRenderer {
    constructor(scene, radius = PHYSICS_RADIUS) {
        this.physicsRadius = radius;
        this.renderRadius = radius * BALL_VISUAL_SCALE;
        this.visualOffset = this.renderRadius - this.physicsRadius;
        this.teeVisualExtra = 0.1;

        this.group = new THREE.Group();
        this.group.name = 'GolfBall';

        let ballGeometry = new THREE.SphereGeometry(this.renderRadius, 48, 48);
        let ballMaterial = new THREE.MeshPhysicalMaterial();
        
        this.mesh = new THREE.Mesh(ballGeometry, ballMaterial);
        this.group.add(this.mesh);

        this.trailMaxPoints = 120;
        this.trailPoints = [];
        this.trailLine = null;
        this.trailMaterial = new THREE.LineBasicMaterial();

        this.spinRotation = new THREE.Euler(0, 0, 0);
        this.lastTrailTime = 0;
        this.myScene = scene;

        scene.add(this.group);
    }

    computeVisualY(physicsY, groundY, onTee, teeTopY, stopped) {
        if (onTee == true) {
            if (teeTopY != null) {
                return teeTopY + this.renderRadius + this.teeVisualExtra;
            }
        }

        let surfaceY = groundY + this.renderRadius;
        let contactY = groundY + this.physicsRadius;

        let onGround = false;
        if (stopped == true) {
            onGround = true;
        } else if (physicsY <= contactY) {
            onGround = true;
        }

        if (onGround == true) {
            return surfaceY;
        } else {
            return physicsY + this.visualOffset;
        }
    }

    rebuildTrail() {
        let count = this.trailPoints.length;
        
        if (count < 2) {
            if (this.trailLine != null) {
                this.trailLine.visible = false;
            }
            return;
        }

        if (this.trailLine != null) {
            this.trailLine.geometry.dispose();
            this.myScene.remove(this.trailLine);
        }

        let geometry = new THREE.BufferGeometry().setFromPoints(this.trailPoints);
        this.trailLine = new THREE.Line(geometry, this.trailMaterial);
        this.trailLine.frustumCulled = false;
        this.myScene.add(this.trailLine);
        this.trailLine.visible = true;
    }

    sync(physics, showTrail, groundY = 0, options = {}) {
        let posX = physics.position.x;
        let posY = physics.position.y;
        let posZ = physics.position.z;

        let isOnTee = false;
        if (options.onTee == true) {
            isOnTee = true;
        }

        let topOfTee = null;
        if (options.teeTopY != null) {
            topOfTee = options.teeTopY;
        }

        let isStopped = false;
        if (options.stopped == true) {
            isStopped = true;
        }

        let visualY = this.computeVisualY(posY, groundY, isOnTee, topOfTee, isStopped);
        this.group.position.set(posX, visualY, posZ);

        let timeStep = 0.016; 
        
        this.spinRotation.x = this.spinRotation.x + (physics.omegax * timeStep);
        this.spinRotation.y = this.spinRotation.y + (physics.omegay * timeStep);
        this.spinRotation.z = this.spinRotation.z + (physics.omegaz * timeStep);
        
        this.mesh.rotation.copy(this.spinRotation);

        if (showTrail == true && physics.stopped == false) {
            let now = performance.now();
            
            if (now - this.lastTrailTime > 50) {
                this.lastTrailTime = now;
                
                let point = new THREE.Vector3(posX, visualY, posZ);
                this.trailPoints.push(point);
                
                if (this.trailPoints.length > this.trailMaxPoints) {
                    this.trailPoints.shift(); 
                }
                
                this.rebuildTrail();
            }
        } else if (physics.stopped == true && this.trailLine != null) {
            this.trailLine.visible = false;
        }
    }

    clearTrail() {
        this.trailPoints = [];
        if (this.trailLine != null) {
            this.trailLine.geometry.dispose();
            this.myScene.remove(this.trailLine);
            this.trailLine = null;
        }
    }
}
