// بيحسب زاوية الاتجاه (yaw) من موقع الكرة لموقع الحفرة، بالراديان
export function getHoleYawRad(ballX, ballZ, holeX, holeZ) {
    const dx = holeX - ballX;
    const dz = holeZ - ballZ;

    if (dx * dx + dz * dz < 1e-8) {
        return 0;
    }
    return Math.atan2(dx, dz);
}

// بياخد زاوية اتجاه الحفرة ويضيف عليها أي تعديل يدوي عمله اللاعب (aimYawDeg)
export function getAimYawRad(params, ballX, ballZ, holeX, holeZ) {
    const base = getHoleYawRad(ballX, ballZ, holeX, holeZ);

    let aimOffsetDeg = params.aimYawDeg;
    if (aimOffsetDeg === undefined || aimOffsetDeg === null) {
        aimOffsetDeg = 0;
    }

    const off = (aimOffsetDeg * Math.PI) / 180;
    return base + off;
}

// بيحول سرعة الإطلاق وزاويتها لمركبات vx/vy/vz حسب اتجاه الضربة
export function computeLaunchVelocity(params, aimYawRad) {
    const theta = (params.thetaDeg * Math.PI) / 180;
    const v0 = params.v0;
    const sinA = Math.sin(aimYawRad);
    const cosA = Math.cos(aimYawRad);
    const forward = v0 * Math.cos(theta);

    let lateral = params.vz0;
    if (lateral === undefined || lateral === null) {
        lateral = 0;
    }

    // ملاحظة: omegax و omegaz متبدلين هون عن قصد لأنه نظام الإحداثيات بالفيزياء
    // معكوس عن اللي بالواجهة، جربتها كتير وهاد الشكل الصحيح
    return {
        vx: sinA * forward + cosA * lateral,
        vy: v0 * Math.sin(theta),
        vz: cosA * forward - sinA * lateral,
        omegax: params.omegaz,
        omegay: params.omegay,
        omegaz: params.omegax,
    };
}
