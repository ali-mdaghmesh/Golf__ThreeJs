import * as THREE from 'three';

export const BALL_VISUAL_SCALE = 2.4;

const PHYSICS_R = 0.02135;

/** كرة غولف مرئية (شكل كروي بسيط — بدون نموذج GLTF) */
export class BallRenderer {
    constructor(scene, physicsRadius = PHYSICS_R) {
        this.physicsRadius = physicsRadius;
        this.renderRadius = physicsRadius * BALL_VISUAL_SCALE;
        this.visualOffset = this.renderRadius - this.physicsRadius;
        this.teeVisualExtra = 0.1;

        this.group = new THREE.Group();
        this.group.name = 'GolfBall';

        const geo = new THREE.SphereGeometry(this.renderRadius, 48, 48);
        this.mesh = new THREE.Mesh(
            geo,
            new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                roughness: 0.35,
                metalness: 0.02,
                clearcoat: 0.5,
                clearcoatRoughness: 0.35,
            })
        );
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.group.add(this.mesh);

        this.shadowBlob = new THREE.Mesh(
            new THREE.CircleGeometry(this.renderRadius * 1.8, 24),
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.25,
                depthWrite: false,
            })
        );
        this.shadowBlob.rotation.x = -Math.PI / 2;
        this.shadowBlob.position.y = -this.renderRadius + 0.002;
        this.group.add(this.shadowBlob);

        this.trailMax = 120;
        this.trailPoints = [];
        this.trailLine = null;
        this.trailMat = new THREE.LineBasicMaterial({
            color: 0xfff9c4,
            transparent: true,
            opacity: 0.45,
        });
        this._spinAngle = new THREE.Euler(0, 0, 0);
        this._lastTrailTime = 0;
        this._scene = scene;

        scene.add(this.group);
    }

    computeVisualY(physicsY, groundY, onTee, teeTopY, stopped = false) {
        if (onTee && teeTopY != null) {
            return teeTopY + this.renderRadius + this.teeVisualExtra;
        }
        const surfaceY = groundY + this.renderRadius;
        const contact = groundY + this.physicsRadius;
        const onGround = stopped || physicsY <= contact + 0.008;
        if (onGround) return surfaceY;
        return physicsY + this.visualOffset;
    }

    _rebuildTrailGeometry() {
        const n = this.trailPoints.length;
        if (n < 2) {
            if (this.trailLine) this.trailLine.visible = false;
            return;
        }

        if (this.trailLine) {
            this.trailLine.geometry.dispose();
            this._scene.remove(this.trailLine);
        }

        const geo = new THREE.BufferGeometry().setFromPoints(this.trailPoints);
        this.trailLine = new THREE.Line(geo, this.trailMat);
        this.trailLine.frustumCulled = false;
        this._scene.add(this.trailLine);
        this.trailLine.visible = true;
    }

    sync(physics, showTrail, groundY = 0, options = {}) {
        const { x, y, z } = physics.position;
        const { onTee = false, teeTopY = null, stopped = false } = options;

        const visualY = this.computeVisualY(y, groundY, onTee, teeTopY, stopped);
        this.group.position.set(x, visualY, z);

        const dt = 0.016;
        this._spinAngle.x += physics.omegax * dt;
        this._spinAngle.y += physics.omegay * dt;
        this._spinAngle.z += physics.omegaz * dt;
        this.mesh.rotation.copy(this._spinAngle);

        const shadowBase = onTee && teeTopY != null ? teeTopY : groundY;
        const h = Math.max(0, visualY - shadowBase - this.renderRadius);
        const scale = 1 + Math.min(2, h * 0.45);
        this.shadowBlob.scale.setScalar(scale);
        this.shadowBlob.material.opacity = 0.28 / scale;

        if (showTrail && !physics.stopped) {
            const now = performance.now();
            if (now - this._lastTrailTime > 50) {
                this._lastTrailTime = now;
                this.trailPoints.push(new THREE.Vector3(x, visualY, z));
                if (this.trailPoints.length > this.trailMax) {
                    this.trailPoints.shift();
                }
                this._rebuildTrailGeometry();
            }
        } else if (physics.stopped && this.trailLine) {
            this.trailLine.visible = false;
        }
    }

    clearTrail() {
        this.trailPoints = [];
        if (this.trailLine) {
            this.trailLine.geometry.dispose();
            this._scene.remove(this.trailLine);
            this.trailLine = null;
        }
    }

    setDimpledVisual(dimpled) {
        this.mesh.material.roughness = dimpled ? 0.4 : 0.2;
        this.mesh.material.clearcoat = dimpled ? 0.5 : 0.25;
    }
}
