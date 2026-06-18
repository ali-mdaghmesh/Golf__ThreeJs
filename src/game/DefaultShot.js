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

export function isDefaultShotParams(params, defaults) {
    const keys = ['v0', 'thetaDeg', 'vz0', 'omegax', 'omegay', 'omegaz', 'startX', 'startZ', 'dimpled'];
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
    for (const k of keys) {
        if (k === 'dimpled') {
            if (Boolean(params[k]) !== Boolean(defaults[k])) return false;
            continue;
        }
        if (Math.abs((params[k] ?? 0) - (defaults[k] ?? 0)) > (tol[k] ?? 0.05)) return false;
    }
    return true;
}

export function buildDefaultShot(tee) {
    return {
        ...DEFAULT_SHOT_TEMPLATE,
        startX: tee.x,
        startZ: tee.z,
    };
}
