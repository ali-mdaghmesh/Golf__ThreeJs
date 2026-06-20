import * as THREE from 'three';

// بيجهز المشهد: الخلفية، الضباب، الإضاءة، وقبة السماء
export function setupScene(scene, renderer) {
    scene.background = new THREE.Color(0x7ec8e8);
    scene.fog = new THREE.FogExp2(0xa8d4e8, 0.0018);

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // إضاءة عامة من السما والأرض، بتعطي إحساس طبيعي بدون ما تكون قوية
    const hemi = new THREE.HemisphereLight(0xb8e0ff, 0x3d6b2f, 0.55);
    scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.28);
    scene.add(ambient);

    // ضوء الشمس الرئيسي، هو اللي بيعمل الظلال
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.35);
    sun.position.set(80, 120, 50);
    sun.castShadow = true;
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.02;
    sun.shadow.mapSize.set(2048, 2048);

    const shadowCam = sun.shadow.camera;
    shadowCam.near = 2;
    shadowCam.far = 280;
    shadowCam.left = -110;
    shadowCam.right = 110;
    shadowCam.top = 110;
    shadowCam.bottom = -110;
    scene.add(sun);

    // ضوء خفيف ثاني من جهة تانية حتى الظل مش أسود قاتم
    const fill = new THREE.DirectionalLight(0x88b4ff, 0.25);
    fill.position.set(-40, 30, -60);
    scene.add(fill);

    // كرة كبيرة معكوسة من جوا بتشكل السما، فيها تدرج لون بسيط من فوق لتحت
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            topColor: { value: new THREE.Color(0x2563a8) },
            bottomColor: { value: new THREE.Color(0x8ecae6) },
        },
        vertexShader: `
            varying vec3 vWorld;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vWorld = w.xyz;
                gl_Position = projectionMatrix * viewMatrix * w;
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            varying vec3 vWorld;
            void main() {
                float h = normalize(vWorld).y * 0.5 + 0.5;
                gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.85)), 1.0);
            }
        `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.name = 'SkyDome';
    scene.add(sky);

    return { sun, hemi };
}
