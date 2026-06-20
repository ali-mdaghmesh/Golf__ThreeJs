import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// دالة بسيطة لتحميل موديل GLTF وترجيعه كـ Promise
function loadGltf(path) {
    return new Promise((resolve, reject) => {
        loader.load(
            path,
            function (gltf) {
                resolve(gltf.scene);
            },
            undefined,
            function (err) {
                reject(err);
            }
        );
    });
}

// بناخد ارتفاع الموديل ونعمله scale للارتفاع المطلوب، وبعدين ننزله لحتى قاعدته تلمس y = 0
function fitModelToGround(model, targetHeight) {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    let h = size.y;
    if (!h) {
        h = 1;
    }
    model.scale.setScalar(targetHeight / h);

    // بعد ما عملنا scale لازم نعيد حساب الصندوق لأنه تغير
    box.setFromObject(model);
    model.position.y = -box.min.y;
    return box;
}

// هاد الكلاس مسؤول عن كل الأشياء المرسومة حوالين الملعب: الـ tee، العصا، الحفرة، اللاعب، والعشب
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

        // الوتد (nail) اللي عليه الكرة بأول ضربة
            const nail = await loadGltf('./Models/nail/scene.gltf');
            fitModelToGround(nail, 0.12);
            const teeGy = this.course.getHeightAt(teeX, teeZ);
            nail.position.set(teeX, teeGy, teeZ);
            this.scene.add(nail);
            this.nail = nail;

            const box = new THREE.Box3().setFromObject(nail);
            this.teeTopY = box.max.y + nail.position.y;
            this.teeAnchor.set(teeX, this.teeTopY, teeZ);


        // عصا الغولف
            const club = await loadGltf('./Models/bat/scene.gltf');
            fitModelToGround(club, 1.2);
            club.rotation.order = 'YXZ';
            this.club = club;
            this.clubPivot.add(club);
            this.scene.add(this.clubPivot);

        // علم/فتحة الحفرة
   
            const hole = await loadGltf('./Models/hole/scene.gltf');
            fitModelToGround(hole, 0.35);
            hole.position.set(hp.x, this.course.getHeightAt(hp.x, hp.z), hp.z);
            this.scene.add(hole);
            this.hole = hole;

        // شخصية اللاعب
            const player = await loadGltf('./Models/golf_player/scene.gltf');
            fitModelToGround(player, 2.05);
            player.rotation.order = 'YXZ';
            this._playerFeetOffset = 0;
            this.player = player;
            this.scene.add(player);
            this.showPlayer(true);

        // كم حزمة عشب عشوائية حوالين الملعب لإضافة تفاصيل
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


        const gy = this.course.getHeightAt(this.teeAnchor.x, this.teeAnchor.z);
        this.positionForStroke(this.teeAnchor.x, this.teeAnchor.z, 0, gy, true);
    }

    showPeg(visible) {
        if (this.nail) {
            this.nail.visible = visible;
        }
    }

    showClub(visible) {
        this.clubPivot.visible = visible;
    }

    showPlayer(visible) {
        if (this.player) {
            this.player.visible = visible;
        }
    }

    showTeeSetup(visible) {
        this.showPeg(visible);
        this.showClub(visible);
    }


    positionForStroke(ballX, ballZ, aimYawRad, groundY, atTee = false) {
        this._strokeDir.set(Math.sin(aimYawRad), 0, Math.cos(aimYawRad));

        // المحور الجانبي (يمين/شمال) بناءً على اتجاه الضربة
        const sideX = this._strokeDir.z;
        const sideZ = -this._strokeDir.x;

        this.clubPivot.position.set(ballX, groundY, ballZ);
        this.clubPivot.rotation.set(0, aimYawRad, 0);
        this._applyClubSwing(0, 0);

        if (this.player) {
            const behind = 1.75;
            const lateral = 0.95;
            const playerX = ballX - this._strokeDir.x * behind + sideX * lateral - 0.3;
            const playerZ = ballZ - this._strokeDir.z * behind + sideZ * lateral + 1.1;
            this.player.position.set(playerX, groundY + 1, playerZ);
            this.player.rotation.y = aimYawRad + Math.PI * 0.12;
        }

        if (atTee && this.nail) {
            const tee = this.course.getTeePosition();
            const teeGy = this.course.getHeightAt(tee.x, tee.z);
            this.nail.position.set(tee.x + 0.03, teeGy + 0.08, tee.z);
            // ملاحظة: تركت هاد السطر معلق لأنه كان يسبب مشكلة بارتفاع الكرة، خليه هيك حالياً
            // this.teeTopY = box.max.y + this.nail.position.y;
            this.teeAnchor.set(tee.x, this.teeTopY, tee.z);
        }
    }

    setSwingPose(back = 0, swingT = 0) {
        let forward = 0;
        if (swingT > 0) {
            forward = swingT;
        }
        const pull = back * (1 - forward);
        this._applyClubSwing(pull, forward);
    }

    _applyClubSwing(pullBack, swingForward = 0) {
        if (!this.club) return;

        const pullRad = pullBack * 0.75;
        const hitRad = swingForward * 1.2;
        const dist = 0.2 + pullBack * 0.28 - swingForward * 0.15;
        const swingAngle = -0.42 - pullRad + hitRad + (Math.PI * 0.11);

        this.club.rotation.x = Math.PI * (-0.0115);
        this.club.rotation.y = Math.PI * -0.5;
        this.club.rotation.z = swingAngle;

        const shaftOffset = 0.36;
        this.club.position.set(shaftOffset, 0.2, -dist);
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
