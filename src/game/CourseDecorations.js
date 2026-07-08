import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

function loadGltf(path) {
    return new Promise(function (resolve) {
        gltfLoader.load(
            path,
            function (gltf) {
                resolve(gltf.scene);
            }
        );
    });
}

function fitModelToGround(model, targetHeight) {
    let box = new THREE.Box3().setFromObject(model);
    let size = new THREE.Vector3();
    box.getSize(size);

    let originalHeight = size.y;
    model.scale.setScalar(targetHeight / originalHeight);

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

        this.strokeDir = new THREE.Vector3(0, 0, 1);
        this.grassTemplate = null;
    }

    async loadAll() {
        let holePosition = this.course.getHolePosition();
        this.holePos.set(holePosition.x, holePosition.y, holePosition.z);

        let teePosition = this.course.getTeePosition();
        let teeX = teePosition.x;
        let teeZ = teePosition.z;

        let nail = await loadGltf('./Models/nail/scene.gltf');
        fitModelToGround(nail, 0.12);
        let teeGroundY = this.course.getHeightAt(teeX, teeZ);
        nail.position.set(teeX, teeGroundY, teeZ);
        this.scene.add(nail);
        this.nail = nail;

        let nailBox = new THREE.Box3().setFromObject(nail);
        this.teeTopY = nailBox.max.y + nail.position.y;
        this.teeAnchor.set(teeX, this.teeTopY, teeZ);

        let club = await loadGltf('./Models/bat/scene.gltf');
        fitModelToGround(club, 1.2);
        club.rotation.order = 'YXZ';
        this.club = club;
        this.clubPivot.add(club);
        this.scene.add(this.clubPivot);

        let hole = await loadGltf('./Models/hole/scene.gltf');
        fitModelToGround(hole, 0.35);
        hole.position.set(holePosition.x, this.course.getHeightAt(holePosition.x, holePosition.z), holePosition.z);
        this.scene.add(hole);
        this.hole = hole;

        let player = await loadGltf('./Models/golf_player/scene.gltf');
        fitModelToGround(player, 2.05);
        player.rotation.order = 'YXZ';
        this.player = player;
        this.scene.add(player);
        this.showPlayer(true);

        let grassTemplate = await loadGltf('./Models/grass/scene.gltf');
        fitModelToGround(grassTemplate, 0.35);
        this.grassTemplate = grassTemplate; 

        this.setGrassCount(12);

        let teeGroundY2 = this.course.getHeightAt(this.teeAnchor.x, this.teeAnchor.z);
        this.positionForStroke(this.teeAnchor.x, this.teeAnchor.z, 0, teeGroundY2, true);
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
        this.strokeDir.set(0, 0, Math.cos(aimYawRad));

        let sideX = this.strokeDir.z;
        let sideZ = -this.strokeDir.x;

        this.clubPivot.position.set(ballX, groundY, ballZ);
        this.clubPivot.rotation.set(0, aimYawRad, 0);
        this.applyClubSwing(0, 0);

        if (this.player) {
            let distanceBehindBall = 1.75;
            let lateralDistance = 0.95;

            let playerX = ballX - this.strokeDir.x * distanceBehindBall + sideX * lateralDistance - 0.3;
            let playerZ = ballZ - this.strokeDir.z * distanceBehindBall + sideZ * lateralDistance + 1.1;

            this.player.position.set(playerX, groundY + 1, playerZ);
            this.player.rotation.y = aimYawRad + Math.PI * 0.12;
        }

        if (atTee && this.nail) {
            let teePosition = this.course.getTeePosition();
            let teeGroundY = this.course.getHeightAt(teePosition.x, teePosition.z);
            this.nail.position.set(teePosition.x + 0.03, teeGroundY + 0.08, teePosition.z);


            this.teeAnchor.set(teePosition.x, this.teeTopY, teePosition.z);
        }
    }

    setSwingPose(back = 0, swingT = 0) {
        let forwardAmount = 0;
        if (swingT > 0) {
            forwardAmount = swingT;
        }

        let pullAmount = back * (1 - forwardAmount);
        this.applyClubSwing(pullAmount, forwardAmount);
    }

    applyClubSwing(pullBack, swingForward = 0) {
        if (!this.club) {
            return;
        }

        let pullRad = pullBack * 0.75;
        let hitRad = swingForward * 1.2;
        let distance = 0.2 + pullBack * 0.28 - swingForward * 0.15;
        let swingAngle = -0.42 - pullRad + hitRad + (Math.PI * 0.11);

        this.club.rotation.x = Math.PI * (-0.0115);
        this.club.rotation.y = Math.PI * -0.5;
        this.club.rotation.z = swingAngle;

        let shaftOffset = 0.36;
        this.club.position.set(shaftOffset, 0.2, -distance);
    }

    setGrassCount(count) {
        for (let i = 0; i < this.grassMeshes.length; i++) {
            this.scene.remove(this.grassMeshes[i]);
        }
        this.grassMeshes = [];

        if (this.grassTemplate == null) {
            return;
        }

        for (let i = 0; i < count; i++) {
            let grassClone = this.grassTemplate.clone();
            let x = (Math.random() - 0.5) * 70;
            let z = (Math.random() - 0.5) * 280;
            grassClone.position.set(x, this.course.getHeightAt(x, z), z);
            grassClone.scale.multiplyScalar(0.7 + Math.random() * 0.5);
            this.scene.add(grassClone);
            this.grassMeshes.push(grassClone);
        }
    }

    getTeeAnchor() {
        return this.teeAnchor;
    }

    getTeeTopY() {
        return this.teeTopY;
    }

    getBallPhysicsY(ballRadius) {
        return this.teeTopY + ballRadius;
    }
}