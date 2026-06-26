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
    2000
);

// عنصر الـ div اللي رح نحط فيه شاشة الرسم (canvas)
const appContainer = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
appContainer.appendChild(renderer.domElement);

setupScene(scene, renderer);

const flyController = new FlyController(camera, renderer.domElement, 16);
flyController.attach();

const timer = new THREE.Timer();

let course = null;
let game = null;
let dashboard = null;

// بتفعّل أو تعطّل التفاعل مع الماوس فوق الشاشة، حسب وضع الكاميرا الحالي
function setCanvasPointerEvents(mode) {
    if (mode === 'free') {
        renderer.domElement.style.pointerEvents = 'auto';
    } else {
        renderer.domElement.style.pointerEvents = 'none';
    }
}

async function init() {
    course = new GolfCourse(scene, {
    width: 400,
    depth: 400,
    segments: 128,
    maxHeight: 10,
    textureRepeat: 140,
    grassCount: 1800,
    holeCount: 1,
    showBunkers: true,
    showWater: false,
    grassTexturePath: '/Textures/grass3.avif',
    sandTexturePath: '../Textures/sand.jpg',
});

    await course.init();

    dashboard = new Dashboard({
    onBeginCharge: function () {
        if (game) { game.beginCharge(); }
    },
    onReleaseCharge: function () {
        if (game) { game.releaseCharge(); }
    },
    onCancelCharge: function () {
        if (game) { game.cancelCharge(); }
    },
    onReset: function () {
        let winEl = document.getElementById('hud-win');
        if (winEl) { winEl.classList.remove('show'); }
        if (game) { game.resetBall(); }
    },
    onBallType: function (dimpled) {
        if (game) { game.setBallType(dimpled); }
    },
    onGroundType: function (type) {
    if (game) { game.setGroundType(type); }
},
    onCameraMode: function (mode) {
        if (game) { game.setCameraMode(mode); }
        setCanvasPointerEvents(mode);
    },
    onTrail: function (enabled) {
        if (game) { game.setTrail(enabled); }
    },
    onFollowBall: function (enabled) {
        if (game) { game.setFollowBall(enabled); }
    },
    onParamsChange: function () {
        if (game) { game.onDashboardChange(); }
    },
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



// بتربط أزرار الكيبورد بالأكشنات بتاعت اللعبة (مسطرة = ضرب، R = إعادة الكرة)
function bindKeyboard() {
    window.addEventListener('keydown', function (event) {
        // إذا اللاعب عم يكتب جوا input أو select، ما نعمل شي
        if (event.target.matches('input, select, textarea, button')) {
            return;
        }

        if (event.code === 'Space') {
            if (event.repeat) {
                return;
            }
            event.preventDefault();
            game?.beginChargeFromKeyboard();
        }

        if (event.key === 'r' || event.key === 'R') {
            game?.resetBall();
            document.getElementById('hud-win')?.classList.remove('show');
        }
    });

    window.addEventListener('keyup', function (event) {
        if (event.code === 'Space') {
            event.preventDefault();
            game?.releaseChargeFromKeyboard();
        }
    });

    window.addEventListener('blur', function () {
        game?.cancelCharge();
    });

    window.addEventListener('pointerup', function () {
        game?.releaseCharge();
    });
}

init();

window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// حلقة الرسم الرئيسية، بتنعاد كل فريم
function animate() {
    requestAnimationFrame(animate);

    timer.update();
    let deltaTime = Math.min(timer.getDelta(), 0.05);
    let elapsedTime = timer.getElapsed();

    if (course) {
        course.update(elapsedTime);
    }

    if (game) {
        let activeFlyController = null;
        if (game.cameraMode === 'free') {
            activeFlyController = flyController;
        }
        game.update(deltaTime, activeFlyController);
    }

    renderer.render(scene, camera);
}

animate();
