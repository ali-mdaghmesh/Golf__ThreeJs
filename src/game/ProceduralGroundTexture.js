import * as THREE from 'three';

// مولد أرقام عشوائية بسيد (seed) ثابت، حتى نفس الخريطة تطلع نفسها كل مرة
// ملاحظة: ما لمست المعادلة هاي لأنها خوارزمية جاهزة اسمها mulberry32 وبتشتغل تمام
function mulberry32(seed) {
    let state = seed >>> 0;
    return function () {
        state += 0x6D2B79F5;
        let result = Math.imul(state ^ (state >>> 15), 1 | state);
        result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

// بيرسم تكستشر عشب على canvas ويرجعه كـ THREE.Texture جاهز للاستخدام
export function createProceduralGrassTexture(options = {}) {
    let size = options.size;
    if (size === undefined) size = 1024;

    let seed = options.seed;
    if (seed === undefined) seed = 1337;

    let repeatCount = options.repeat;
    if (repeatCount === undefined) repeatCount = 1999;

    let canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    let ctx = canvas.getContext('2d');
    let randomNumber = mulberry32(seed);

    // لون خلفية العشب الأساسي
    ctx.fillStyle = '#2f7a2b';
    ctx.fillRect(0, 0, size, size);

    // نقاط عشوائية صغيرة كتير حتى يطلع شكل العشب مو لون فلات
    let dotsCount = 12000;
    for (let i = 0; i < dotsCount; i++) {
        let x = randomNumber() * size;
        let y = randomNumber() * size;
        let radius = 0.8 + randomNumber() * 3.2;

        let green = (110 + randomNumber() * 80) | 0;
        let blue = (55 + randomNumber() * 40) | 0;
        let red = (40 + randomNumber() * 35) | 0;
        let alpha = 0.06 + randomNumber() * 0.08;

        ctx.fillStyle = 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 0.12;
    let stripeCount = repeatCount * 2;
    for (let i = 0; i < stripeCount; i++) {
        let x = (i / stripeCount) * size;

        if (i % 2 === 0) {
            ctx.fillStyle = '#2a6f27';
        } else {
            ctx.fillStyle = '#357f30';
        }
        ctx.fillRect(x, 0, size / stripeCount, size);
    }
    ctx.globalAlpha = 1;

    let texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatCount, repeatCount);
    texture.anisotropy = 8;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    return texture;
}
