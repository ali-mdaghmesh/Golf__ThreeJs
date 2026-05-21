import * as THREE from 'three';
import { Controller } from './Controller/Controller.js';
import { GolfCourse } from './GolfCourse.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';



const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);


const courseAmbientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(courseAmbientLight);

const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(10, 20, 10);
light.castShadow = true;

light.shadow.camera.left = -100;
light.shadow.camera.right = 100;
light.shadow.camera.top = 100;
light.shadow.camera.bottom = -100;

scene.add(light);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 100000);
camera.position.set(0,4,60);


const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);


const controller = new Controller(camera, renderer.domElement, 0.2);
const clock = new THREE.Clock();

const gltfLoader = new GLTFLoader();

let course = null;

async function initCourse() {
    course = new GolfCourse(scene, {
        width: 200,
        depth: 200,
        segments : 150,
        maxHeight: 5,
        textureRepeat : 15,
        grassTexturePath : './Textures/download.jpg',
        fairwayTexturePath : './Textures/download.jpg',
        greenTexturePath : './Textures/download.jpg',
        grassCount : 1000,
        holeCount : 1,
    });

    await course.init();

    loadModels();
}

function loadModels() {
    gltfLoader.load('./Models/hole/scene.gltf', (gltf) => {
        const model = gltf.scene;
        model.position.set(0,0.1 ,36.1);
        model.scale.setScalar(0.2);
        scene.add(model);
    });

    gltfLoader.load('./Models/bat/scene.gltf', (gltf) => {
        const model = gltf.scene;
        model.position.set(1, 1,52 );
        model.scale.setScalar(0.8);
        model.rotation.y -=2;
        scene.add(model);
    });

    gltfLoader.load('./Models/nail/scene.gltf', (gltf) => {
        const model = gltf.scene;
        model.position.set(0, course.getHeightAt(0, 50), 50);
        model.scale.setScalar(0.02);
        scene.add(model);
    });

    gltfLoader.load('./Models/ball/scene.gltf', (gltf) => {
        const model = gltf.scene;
        model.position.set(0.2, 0.4, 50);
        model.scale.setScalar(0.004);
        scene.add(model);
    });
}

initCourse();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
});

function animate() {
    requestAnimationFrame(animate);
    controller.update();
    renderer.render(scene, camera);
}

animate();