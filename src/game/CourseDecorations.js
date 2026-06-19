import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

function loadGltf(path) {
    return new Promise((resolve, reject) => {
        loader.load(path, (gltf) => resolve(gltf.scene), undefined, reject);
    });
}

/** قياس الارتفاع ثم إسقاط قاعدة النموذج على y=0 */
function fitModelToGround(model, targetHeight) {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const h = size.y || 1;
    model.scale.setScalar(targetHeight / h);
    box.setFromObject(model);
    model.position.y = -box.min.y;
    return box;
}

export class CourseDecorations {
    constructor(scene, course) {
        this.scene = scene;
        this.course = course;
        this.teeAnchor = new THREE.Vector3(0, 0, -41);
        this.teeTopY = 0;
        this.holePos = new THREE.Vector3(0, 0, 0);

        this.nail = null;
        this.clubPivot = new THREE.Group();
        this.clubPivot.name = 'ClubPivot';
        this.club = null;
        this.hole = null;
        this.player = null;
        this.grassMeshes = [];

        this._strokeDir = new THREE.Vector3(0, 0, 1);
        this._playerFeetOffset = 0;
    }

    async loadAll() {
        const hp = this.course.getHolePosition();
        this.holePos.set(hp.x, hp.y, hp.z);

        const tee = this.course.getTeePosition();
        const teeX = tee.x;
        const teeZ = tee.z;

        try {
            const nail = await loadGltf('./Models/nail/scene.gltf');
            fitModelToGround(nail, 0.12);
            const teeGy = this.course.getHeightAt(teeX, teeZ);
            nail.position.set(teeX, teeGy, teeZ);
            this.scene.add(nail);
            this.nail = nail;

            const box = new THREE.Box3().setFromObject(nail);
            this.teeTopY = box.max.y + nail.position.y;
            this.teeAnchor.set(teeX, this.teeTopY, teeZ);
        } catch (e) {
            console.warn('nail model', e);
            this.teeTopY = this.course.getHeightAt(teeX, teeZ) + 0.06;
            this.teeAnchor.set(teeX, this.teeTopY, teeZ);
        }

        try {
            const club = await loadGltf('./Models/bat/scene.gltf');
            fitModelToGround(club, 1.2);
            club.rotation.order = 'YXZ';
            this.club = club;
            this.clubPivot.add(club);
            this.scene.add(this.clubPivot);
        } catch (e) {
            console.warn('bat model', e);
        }

        try {
            const hole = await loadGltf('./Models/hole/scene.gltf');
            fitModelToGround(hole, 0.35);
            hole.position.set(hp.x, this.course.getHeightAt(hp.x, hp.z), hp.z);
            this.scene.add(hole);
            this.hole = hole;
        } catch (e) {
            console.warn('hole model', e);
        }

        try {
            const player = await loadGltf('./Models/golf_player/scene.gltf');
            const box = fitModelToGround(player, 2.05);
            player.rotation.order = 'YXZ';
            this._playerFeetOffset = 0;
            this.player = player;
            this.scene.add(player);
            this.showPlayer(true);
        } catch (e) {
            console.warn('golf_player model', e);
        }

        try {
            const grass = await loadGltf('./Models/grass/scene.gltf');
            fitModelToGround(grass, 0.35);
            for (let i = 0; i < 12; i++) {
                const g = grass.clone();
                const x = (Math.random() - 0.5) * 70;
                const z = (Math.random() - 0.5) * 140;
                g.position.set(x, this.course.getHeightAt(x, z), z);
                g.rotation.y = Math.random() * Math.PI * 2;
                g.scale.multiplyScalar(0.7 + Math.random() * 0.5);
                this.scene.add(g);
                this.grassMeshes.push(g);
            }
        } catch (e) {
            console.warn('grass model', e);
        }

        const gy = this.course.getHeightAt(this.teeAnchor.x, this.teeAnchor.z);
        this.positionForStroke(this.teeAnchor.x, this.teeAnchor.z, 0, gy, true);
    }

    showPeg(visible) {
        if (this.nail) this.nail.visible = visible;
    }

    showClub(visible) {
        this.clubPivot.visible = visible;
    }

    showPlayer(visible) {
        if (this.player) this.player.visible = visible;
    }

    showTeeSetup(visible) {
        this.showPeg(visible);
        this.showClub(visible);
    }

    /**
     * @param {number} aimYawRad - اتجاه الإطلاق بالراديان
     */
    positionForStroke(ballX, ballZ, aimYawRad, groundY, atTee = false) {
        this._strokeDir.set(Math.sin(aimYawRad), 0, Math.cos(aimYawRad));

        const sideX = this._strokeDir.z;
        const sideZ = -this._strokeDir.x;

        this.clubPivot.position.set(ballX, groundY, ballZ);
        this.clubPivot.rotation.set(0, aimYawRad, 0);
        this._applyClubSwing(0, 0);

        if (this.player) {
            const behind = 1.75;
            const lateral = 0.95;
            this.player.position.set(
                ballX - this._strokeDir.x * behind + sideX * lateral-0.3,
                groundY+1,
                ballZ - this._strokeDir.z * behind + sideZ * lateral +1.1
            );
            this.player.rotation.y = aimYawRad + Math.PI * 0.12;
        }

        if (atTee && this.nail) {
            const tee = this.course.getTeePosition();
            const teeGy = this.course.getHeightAt(tee.x, tee.z);
            this.nail.position.set(tee.x, teeGy, tee.z);
            const box = new THREE.Box3().setFromObject(this.nail);
            this.teeTopY = box.max.y + this.nail.position.y;
            this.teeAnchor.set(tee.x, this.teeTopY, tee.z);
        }
    }

    setSwingPose(back = 0, swingT = 0) {
        const forward = swingT > 0 ? swingT : 0;
        const pull = back * (1 - forward);
        this._applyClubSwing(pull, forward);
    }

    _applyClubSwing(pullBack, swingForward = 0) {
        if (!this.club) return;
        const pullRad = pullBack * 0.75;
        const hitRad = swingForward * 1.2;
        const dist = 0.42 + pullBack * 0.28 - swingForward * 0.15;
        const swingAngle = -0.42 - pullRad + hitRad + (Math.PI * 0.11);
        this.club.rotation.x = Math.PI * (-0.0115);
        this.club.rotation.y = Math.PI * -0.5;
        this.club.rotation.z = swingAngle; 

        const shaftOffset = 0.3; 

        this.club.position.set(
            shaftOffset, 
            0.3,
            -dist 
        );
    }

    getTeeAnchor() {
        return this.teeAnchor;
    }

    getTeeTopY() {
        return this.teeTopY;
    }

    getBallPhysicsY(R) {
        return this.teeTopY + R;
    }
}
