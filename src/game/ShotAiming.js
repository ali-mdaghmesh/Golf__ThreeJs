export function getHoleYawRad(ballX, ballZ, holeX, holeZ) {
    const dx = holeX - ballX;
    const dz = holeZ - ballZ;
    if (dx * dx + dz * dz < 1e-8) return 0;
    return Math.atan2(dx, dz);
}

export function getAimYawRad(params, ballX, ballZ, holeX, holeZ) {
    const base = getHoleYawRad(ballX, ballZ, holeX, holeZ);
    const off = ((params.aimYawDeg ?? 0) * Math.PI) / 180;
    return base + off;
}

export function computeLaunchVelocity(params, aimYawRad) {
    const theta = (params.thetaDeg * Math.PI) / 180;
    const v0 = params.v0;
    const sinA = Math.sin(aimYawRad);
    const cosA = Math.cos(aimYawRad);
    const forward = v0 * Math.cos(theta);
    const lateral = params.vz0 ?? 0;

    return {
        vx: sinA * forward + cosA * lateral,
        vy: v0 * Math.sin(theta),
        vz: cosA * forward - sinA * lateral,
        omegax: params.omegaz ?? 0,
        omegay: params.omegay ?? 0,
        omegaz: params.omegax ?? 0,
    };
}
