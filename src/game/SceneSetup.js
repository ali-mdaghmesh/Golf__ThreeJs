import * as THREE from 'three';

export function setupScene(scene, renderer) {
    scene.background = new THREE.Color(0x7ec8e8);
    scene.fog = new THREE.FogExp2(0xa8d4e8, 0.0018);

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    let hemiLight = new THREE.HemisphereLight(0xb8e0ff, 0x3d6b2f, 0.55);
    scene.add(hemiLight);

    let ambientLight = new THREE.AmbientLight(0xffffff, 0.28);
    scene.add(ambientLight);

    let sunLight = new THREE.DirectionalLight(0xfff4e0, 1.35);
    sunLight.position.set(80, 120, 50);
    sunLight.castShadow = true;
    sunLight.shadow.bias = -0.0002;
    sunLight.shadow.normalBias = 0.02;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 280;
    sunLight.shadow.camera.left = -110;
    sunLight.shadow.camera.right = 110;
    sunLight.shadow.camera.top = 110;
    sunLight.shadow.camera.bottom = -110;
    scene.add(sunLight);

    let fillLight = new THREE.DirectionalLight(0x88b4ff, 0.25);
    fillLight.position.set(-40, 30, -60);
    scene.add(fillLight);

    let skyGeometry = new THREE.SphereGeometry(400, 32, 16);
    let skyMaterial = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            topColor: { value: new THREE.Color(0x2563a8) },
            bottomColor: { value: new THREE.Color(0x8ecae6) },
        },
        vertexShader: `
            varying vec3 vWorld;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorld = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            varying vec3 vWorld;
            void main() {
                float heightFactor = normalize(vWorld).y * 0.5 + 0.5;
                gl_FragColor = vec4(mix(bottomColor, topColor, pow(heightFactor, 0.85)), 1.0);
            }
        `,
    });

    let skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
    skyDome.name = 'SkyDome';
    scene.add(skyDome);

    return { sun: sunLight, hemi: hemiLight };
}
