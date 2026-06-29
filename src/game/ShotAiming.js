export function getHoleYawRad(ballX, ballZ, holeX, holeZ) {
    let dx = holeX - ballX;
    let dz = holeZ - ballZ;
    return Math.atan2(dx, dz);
}

export function getAimYawRad(params, ballX, ballZ, holeX, holeZ) {
    let baseYaw = getHoleYawRad(ballX, ballZ, holeX, holeZ);
    let offset = params.aimYawDeg || 0;
    let offsetRad = (offset * Math.PI) / 180;
    return baseYaw + offsetRad;
}

export function computeLaunchVelocity(params, aimYawRad) {
    let theta = (params.thetaDeg * Math.PI) / 180;
    let v0 = params.v0;
    let lateral = params.vz0 || 0;

    let vx = Math.sin(aimYawRad) * v0 * Math.cos(theta) + Math.cos(aimYawRad) * lateral;
    let vy = v0 * Math.sin(theta);
    let vz = Math.cos(aimYawRad) * v0 * Math.cos(theta) - Math.sin(aimYawRad) * lateral;

    return {
        vx: vx,
        vy: vy,
        vz: vz,
        omegax: params.omegaz,
        omegay: params.omegay,
        omegaz: params.omegax
    };
}
