export const DEFAULT_SHOT_TEMPLATE = {
    v0: 21,
    thetaDeg: 8,
    vz0: 0,
    omegax: 0,
    omegay: 0,
    omegaz: 90,
    aimYawDeg: 0,
    viewYawDeg: 0,
    dimpled: true,
    cameraMode: 'follow',
    showTrail: true,
    followBall: true,
};

const ALLOWED_DIFFERENCE = {
    v0: 0.2,
    thetaDeg: 0.2,
    vz0: 0.15,
    omegax: 1.5,
    omegay: 1.5,
    omegaz: 2,
    startX: 0.6,
    startZ: 0.6,
};

export function isDefaultShotParams(currentParams, defaultParams) {
    let keysToCheck = ['v0', 'thetaDeg', 'vz0', 'omegax', 'omegay', 'omegaz', 'startX', 'startZ', 'dimpled'];

    for (let i = 0; i < keysToCheck.length; i++) {
        let key = keysToCheck[i];

        if (key === 'dimpled') {
            if (Boolean(currentParams[key]) !== Boolean(defaultParams[key])) {
                return false;
            }
            continue;
        }

        let currentValue = currentParams[key];
        if (currentValue === undefined || currentValue === null) {
            currentValue = 0;
        }

        let defaultValue = defaultParams[key];
        if (defaultValue === undefined || defaultValue === null) {
            defaultValue = 0;
        }

        let margin = ALLOWED_DIFFERENCE[key];
        if (margin === undefined) {
            margin = 0.05;
        }

        if (Math.abs(currentValue - defaultValue) > margin) {
            return false;
        }
    }

    return true;
}

export function buildDefaultShot(teePosition) {
    let shot = Object.assign({}, DEFAULT_SHOT_TEMPLATE);
    shot.startX = teePosition.x;
    shot.startZ = teePosition.z;
    return shot;
}
