import * as THREE from 'three';

// مولد أرقام عشوائية بسيد ثابت (حتى نفس الخريطة تطلع نفسها كل مرة)
// ما لمست المعادلة هاي لأنها خوارزمية جاهزة (mulberry32) وبتشتغل تمام
function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

// بيرسم تكستشر عشب على canvas ويرجعه كـ THREE.Texture جاهز للاستخدام
export function createProceduralGrassTexture({
    size = 1024,
    seed = 1337,
    repeat = 1999,
} = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const rnd = mulberry32(seed);

    // لون خلفية العشب الأساسي
    ctx.fillStyle = '#2f7a2b';
    ctx.fillRect(0, 0, size, size);

    // نقاط عشوائية صغيرة حتى يطلع شكل العشب مو لون فلات
    for (let i = 0; i < 12000; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const r = 0.8 + rnd() * 3.2;
        const g = (110 + rnd() * 80) | 0;
        const b = (55 + rnd() * 40) | 0;
        const a = 0.06 + rnd() * 0.08;
        const red = (40 + rnd() * 35) | 0;

        ctx.fillStyle = 'rgba(' + red + ',' + g + ',' + b + ',' + a + ')';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // خطوط رفيعة فاتحة وغامقة بالتبادل، تعطي إحساس إنه فيه قص للعشب
    ctx.globalAlpha = 0.12;
    const stripeCount = repeat * 2;
    for (let i = 0; i < stripeCount; i++) {
        const x = (i / stripeCount) * size;
        if (i % 2 === 0) {
            ctx.fillStyle = '#2a6f27';
        } else {
            ctx.fillStyle = '#357f30';
        }
        ctx.fillRect(x, 0, size / stripeCount, size);
    }
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}
