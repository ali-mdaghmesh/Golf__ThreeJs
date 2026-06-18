import * as THREE from 'three';
import { FlyController } from './Controller/FlyController.js';
import { GolfCourse } from './GolfCourse.js';
import { GolfGame } from './game/GolfGame.js';
import { Dashboard } from './ui/Dashboard.js';
import { InstructionsPanel } from './ui/InstructionsPanel.js';
import { setupScene } from './game/SceneSetup.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    400
);

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);

setupScene(scene, renderer);

const flyController = new FlyController(camera, renderer.domElement, 16);
flyController.attach();

const timer = new THREE.Timer();

let course = null;
let game = null;
let dashboard = null;

function setCanvasPointerEvents(mode) {
    renderer.domElement.style.pointerEvents = mode === 'free' ? 'auto' : 'none';
}

async function init() {
    course = new GolfCourse(scene, {
        width: 200,
        depth: 200,
        segments: 128,
        maxHeight: 2.8,
        textureRepeat: 14,
        grassCount: 1800,
        holeCount: 1,
        showBunkers: true,
        showWater: true,
    });

    await course.init();

    dashboard = new Dashboard({
        onBeginCharge: () => game?.beginCharge(),
        onReleaseCharge: () => game?.releaseCharge(),
        onCancelCharge: () => game?.cancelCharge(),
        onReset: () => {
            document.getElementById('hud-win')?.classList.remove('show');
            game?.resetBall();
        },
        onBallType: (d) => game?.setBallType(d),
        onCameraMode: (m) => {
            game?.setCameraMode(m);
            setCanvasPointerEvents(m);
        },
        onTrail: (e) => game?.setTrail(e),
        onFollowBall: (e) => game?.setFollowBall(e),
        onParamsChange: () => game?.onDashboardChange(),
    });

    new InstructionsPanel();

    game = new GolfGame({
        scene,
        camera,
        course,
        dashboard,
        flyController,
    });
    await game.init();

    setCanvasPointerEvents('follow');
    bindKeyboard();
}

function bindKeyboard() {
    window.addEventListener('keydown', (e) => {
        if (e.target.matches('input, select, textarea, button')) return;

        if (e.code === 'Space') {
            if (e.repeat) return;
            e.preventDefault();
            game?.beginChargeFromKeyboard();
        }
        if (e.key === 'r' || e.key === 'R') {
            game?.resetBall();
            document.getElementById('hud-win')?.classList.remove('show');
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            game?.releaseChargeFromKeyboard();
        }
    });

    window.addEventListener('blur', () => {
        game?.cancelCharge();
    });

    window.addEventListener('pointerup', () => {
        game?.releaseCharge();
    });
}

init();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const elapsed = timer.getElapsed();

    if (course) course.update(elapsed);
    if (game) {
        const fc = game.cameraMode === 'free' ? flyController : null;
        game.update(dt, fc);
    }

    renderer.render(scene, camera);
}

animate();
