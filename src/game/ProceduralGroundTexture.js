import * as THREE from 'three';

function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * خامة أرض واقعية (بدون ملفات textures خارجية)
 * - تدرجات + بقع + خطوط قص خفيفة
 */
export function createProceduralGrassTexture({
    size = 1024,
    seed = 1337,
    repeat = 14,
} = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const rnd = mulberry32(seed);

    // base
    ctx.fillStyle = '#2f7a2b';
    ctx.fillRect(0, 0, size, size);

    // noisy blobs
    for (let i = 0; i < 12000; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const r = 0.8 + rnd() * 3.2;
        const g = 110 + (rnd() * 80) | 0;
        const b = 55 + (rnd() * 40) | 0;
        const a = 0.06 + rnd() * 0.08;
        ctx.fillStyle = `rgba(${40 + (rnd() * 35) | 0},${g},${b},${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // mowing stripes (subtle)
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < repeat * 2; i++) {
        const x = (i / (repeat * 2)) * size;
        ctx.fillStyle = i % 2 === 0 ? '#2a6f27' : '#357f30';
        ctx.fillRect(x, 0, size / (repeat * 2), size);
    }
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

