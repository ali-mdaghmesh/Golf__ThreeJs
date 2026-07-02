export const DEFAULT_SHOT_TEMPLATE = {
    v0: 36,
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
    startX: 0,
    startZ: 0,
};

export function isDefaultShotParams(current, defaults) {
    if (current.v0 != defaults.v0) return false;
    if (current.thetaDeg != defaults.thetaDeg) return false;
    if (current.vz0 != defaults.vz0) return false;
    if (current.omegax != defaults.omegax) return false;
    if (current.omegay != defaults.omegay) return false;
    if (current.omegaz != defaults.omegaz) return false;
    if (current.dimpled != defaults.dimpled) return false;
    if (current.startX != defaults.startX) return false;
    if (current.startZ != defaults.startZ) return false;
    
    return true;
}

export function buildDefaultShot(teePosition) {
    let shot = {
        v0: 36,
        thetaDeg: 8,
        vz0: 0,
        omegax: 0,
        omegay: 0,
        omegaz: 90,
        aimYawDeg: 0,
        viewYawDeg: 0,
        dimpled: true,
        cameraMode: 'follow',
        startX: teePosition.x,
        startZ: teePosition.z,
    };
    return shot;
}
