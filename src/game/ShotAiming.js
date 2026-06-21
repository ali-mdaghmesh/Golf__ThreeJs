export function getHoleYawRad(ballX, ballZ, holeX, holeZ) {
    let dx = holeX - ballX;
    let dz = holeZ - ballZ;

    if (dx * dx + dz * dz < 1e-8) {
        return 0;
    }

    return Math.atan2(dx, dz);
}

export function getAimYawRad(params, ballX, ballZ, holeX, holeZ) {
    let baseYaw = getHoleYawRad(ballX, ballZ, holeX, holeZ);

    let aimOffsetDeg = params.aimYawDeg;
    if (aimOffsetDeg === undefined || aimOffsetDeg === null) {
        aimOffsetDeg = 0;
    }

    let aimOffsetRad = (aimOffsetDeg * Math.PI) / 180;
    return baseYaw + aimOffsetRad;
}

export function computeLaunchVelocity(params, aimYawRad) {
    let thetaRad = (params.thetaDeg * Math.PI) / 180; 
    let v0 = params.v0;

    let sinYaw = Math.sin(aimYawRad);
    let cosYaw = Math.cos(aimYawRad);

    let forwardSpeed = v0 * Math.cos(thetaRad);

    let lateralSpeed = params.vz0;
    if (lateralSpeed === undefined || lateralSpeed === null) {
        lateralSpeed = 0;
    }

    return {
        vx: sinYaw * forwardSpeed + cosYaw * lateralSpeed,
        vy: v0 * Math.sin(thetaRad),
        vz: cosYaw * forwardSpeed - sinYaw * lateralSpeed,
        omegax: params.omegaz,
        omegay: params.omegay,
        omegaz: params.omegax,
    };
}
