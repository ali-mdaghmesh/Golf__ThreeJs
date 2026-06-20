// القيم الافتراضية لأول ضربة بكل هول (تقريباً ضربة متوسطة وسهلة)
export const DEFAULT_SHOT_TEMPLATE = {
    v0: 23,
    thetaDeg: 8.1,
    vz0: 0,
    omegax: 0,
    omegay: 0,
    omegaz: 91.5,
    aimYawDeg: 0,
    viewYawDeg: 0,
    dimpled: true,
    cameraMode: 'follow',
    showTrail: true,
    followBall: true,
};

// بتفحص إذا الإعدادات الحالية هي تقريباً نفس الإعدادات الافتراضية (بهامش خطأ بسيط)
export function isDefaultShotParams(params, defaults) {
    const keys = ['v0', 'thetaDeg', 'vz0', 'omegax', 'omegay', 'omegaz', 'startX', 'startZ', 'dimpled'];

    // هاي هي الهوامش المسموحة لكل قيمة (إذا الفرق أكبر من هيك القيمة بتعتبر مختلفة)
    const tol = {
        v0: 0.2,
        thetaDeg: 0.2,
        vz0: 0.15,
        omegax: 1.5,
        omegay: 1.5,
        omegaz: 2,
        startX: 0.6,
        startZ: 0.6,
    };

    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];

        if (k === 'dimpled') {
            if (Boolean(params[k]) !== Boolean(defaults[k])) {
                return false;
            }
            continue;
        }

        let paramVal = params[k];
        if (paramVal === undefined || paramVal === null) {
            paramVal = 0;
        }
        let defaultVal = defaults[k];
        if (defaultVal === undefined || defaultVal === null) {
            defaultVal = 0;
        }

        let margin = tol[k];
        if (margin === undefined) {
            margin = 0.05;
        }

        if (Math.abs(paramVal - defaultVal) > margin) {
            return false;
        }
    }

    return true;
}

export function buildDefaultShot(tee) {
    const shot = Object.assign({}, DEFAULT_SHOT_TEMPLATE);
    shot.startX = tee.x;
    shot.startZ = tee.z;
    return shot;
}
