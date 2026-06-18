import { BallPhysics } from '../src/Physics/BallPhysics.js';

const hole = { x: 0, z: 36 };
const tee = { x: 0, z: -41 };

function sim(v0, thetaDeg, omegaz) {
    const phy = new BallPhysics();
    phy.setGroundCallbacks(() => 0, () => 'green');
    const theta = (thetaDeg * Math.PI) / 180;
    phy.shoot({
        vx: 0,
        vy: v0 * Math.sin(theta),
        vz: v0 * Math.cos(theta),
        omegax: omegaz,
        startX: tee.x,
        startZ: tee.z,
    });
    for (let i = 0; i < 35000 && !phy.stopped; i++) phy.update(0.001);
    return Math.hypot(phy.x - hole.x, phy.z - hole.z);
}

let best = { d: 999 };
for (let v0 = 28; v0 <= 46; v0 += 0.5) {
    for (let theta = 8; theta <= 18; theta += 0.5) {
        for (const omegaz of [70, 90, 110, 130]) {
            const d = sim(v0, theta, omegaz);
            if (d < best.d) best = { d, v0, thetaDeg: theta, omegaz };
        }
    }
}
console.log(JSON.stringify(best));
