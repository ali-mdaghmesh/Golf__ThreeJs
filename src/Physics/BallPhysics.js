import { GroundMaterial } from './GroundMaterial.js';

const STOP_SPEED = 0.08;
const STOP_SPIN = 2.0;
const GROUND_TORQUE_GAIN = 20;
const FIXED_DT = 0.001;
const MAX_SUBSTEPS = 12;

/**
 * نموذج فيزيائي لكرة الغولف — قانون نيوتن الثاني + العزوم + أويلر
 * المحاور: X أمامي، Y عمودي، Z جانبي (مطابق Three.js)
 */
export class BallPhysics {
    constructor() {
        this.m = 0.04593;
        this.R = 0.02135;
        this.g = 9.81;
        this.rho = 1.225;
        this.I = (2 / 5) * this.m * this.R * this.R;
        this.area = Math.PI * this.R * this.R;

        this.setDimpled(true);

        this.ground = new GroundMaterial();
        this.getGroundHeight = null;
        this.getZoneAt = null;

        this.resetState();
        this._accumulator = 0;
        this.stopped = true;
        this.bounceCount = 0;
    }

    setDimpled(dimpled) {
        this.dimpled = dimpled;
        this.Cd = dimpled ? 0.25 : 0.5;
        this.Cl0 = dimpled ? 0.22 : 0.1;
        this.Cl_max = 0.3;
    }

    resetState() {
        this.x = 0;
        this.y = this.R;
        this.z = 0;
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
        this.omegax = 0;
        this.omegay = 0;
        this.omegaz = 0;
        this.t = 0;
        this.bounceCount = 0;
        this.stopped = true;
        this._accumulator = 0;
    }

    /**
     * إطلاق الكرة من شروط ابتدائية
     * @param {number} v0 - السرعة الكلية (م/ث)
     * @param {number} thetaDeg - زاوية الانطلاق من الأفقي (درجة)
     */
    shoot({
        v0 = 70,
        thetaDeg = 12,
        vz0 = 0,
        omegax = 0,
        omegay = 0,
        omegaz = 100,
        startX = 0,
        startZ = 0,
        vx: vxOverride,
        vy: vyOverride,
        vz: vzOverride,
    } = {}) {
        const theta = (thetaDeg * Math.PI) / 180;
        const vx = vxOverride ?? v0 * Math.cos(theta);
        const vy = vyOverride ?? v0 * Math.sin(theta);
        const vz = vzOverride ?? vz0;

        this.x = startX;
        this.z = startZ;
        const gy = this._groundY(startX, startZ);
        this.y = gy + this.R;

        this.vx = vx;
        this.vy = vy;
        this.vz = vz;
        this.omegax = omegax;
        this.omegay = omegay;
        this.omegaz = omegaz;
        this.t = 0;
        this.bounceCount = 0;
        this.stopped = false;
        this._accumulator = 0;
    }

    setGroundCallbacks(getHeight, getZone) {
        this.getGroundHeight = getHeight;
        this.getZoneAt = getZone;
    }

    _groundY(x, z) {
        return this.getGroundHeight ? this.getGroundHeight(x, z) : 0;
    }

    _applyZoneFriction() {
        if (!this.getZoneAt) return;
        const zone = this.getZoneAt(this.x, this.z);
        switch (zone) {
            case 'green': this.ground.setGreen(); break;
            case 'fairway': this.ground.setFairway(); break;
            case 'rough': this.ground.setRough(); break;
            case 'bunker': this.ground.setBunker(); break;
            default: this.ground.setGrass();
        }
    }

    update(frameDt) {
        if (this.stopped) return;

        this._accumulator += Math.min(frameDt, 0.05);
        let steps = 0;

        while (this._accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
            this._step(FIXED_DT);
            this._accumulator -= FIXED_DT;
            steps++;
        }
    }

    _step(dt) {
        const { m, R, g, rho, Cd, Cl0, Cl_max, I, area } = this;
        const ground = this.ground;

        let { x, y, z, vx, vy, vz, omegax, omegay, omegaz } = this;

        const gy = this._groundY(x, z);
        const contactY = gy + R;

        if (y <= contactY + 0.0001) {
            this._applyZoneFriction();
        }

        let vTotal = Math.hypot(vx, vy, vz);
        if (vTotal < 1e-6) vTotal = 1e-6;

        const F_drag_mag = 0.5 * rho * Cd * area * vTotal * vTotal;
        const F_drag_x = -F_drag_mag * (vx / vTotal);
        const F_drag_y = -F_drag_mag * (vy / vTotal);
        const F_drag_z = -F_drag_mag * (vz / vTotal);

        const cross_x = omegay * vz - omegaz * vy;
        const cross_y = omegaz * vx - omegax * vz;
        const cross_z = omegax * vy - omegay * vx;
        let crossMag = Math.hypot(cross_x, cross_y, cross_z);
        if (crossMag < 1e-8) crossMag = 1e-8;

        const spinTotal = Math.hypot(omegax, omegay, omegaz);
        const spinRatio = (spinTotal * R) / vTotal;
        const Cl = Math.min(Cl0 * spinRatio, Cl_max);
        const F_magnus_mag = 0.5 * rho * Cl * area * vTotal * vTotal;

        const F_magnus_x = F_magnus_mag * (cross_x / crossMag);
        const F_magnus_y = F_magnus_mag * (cross_y / crossMag);
        const F_magnus_z = F_magnus_mag * (cross_z / crossMag);

        const penetrating = y < contactY - 0.0001;
        const onGround = penetrating || (y <= contactY + 0.002 && vy <= 0.08);

        let N = 0;
        let F_fric_x = 0;
        let F_fric_z = 0;
        let torque_x = 0;
        let torque_y = 0;
        let torque_z = 0;

        if (onGround || penetrating) {
            N = m * g;

            const vHoriz = Math.hypot(vx, vz);
            const vSlip = Math.hypot(
                vx + omegaz * R,
                vz - omegax * R
            );

            if (vHoriz > 0.01) {
                if (vSlip > 0.5) {
                    const F_slide = ground.mu_sliding * N;
                    F_fric_x = -F_slide * (vx / vHoriz);
                    F_fric_z = -F_slide * (vz / vHoriz);
                } else {
                    const F_roll = ground.mu_rolling * N;
                    F_fric_x = -F_roll * (vx / vHoriz);
                    F_fric_z = -F_roll * (vz / vHoriz);
                }
            }

            const targetOmegax = vz / R;
            const targetOmegaz = -vx / R;
            torque_x = (targetOmegax - omegax) * GROUND_TORQUE_GAIN * I;
            torque_y = (0 - omegay) * GROUND_TORQUE_GAIN * I;
            torque_z = (targetOmegaz - omegaz) * GROUND_TORQUE_GAIN * I;
        }

        const F_net_x = F_drag_x + F_magnus_x + F_fric_x;
        const F_net_y = F_drag_y + F_magnus_y - m * g + (onGround || penetrating ? N : 0);
        const F_net_z = F_drag_z + F_magnus_z + F_fric_z;

        const ax = F_net_x / m;
        const ay = F_net_y / m;
        const az = F_net_z / m;

        const alphax = torque_x / I;
        const alphay = torque_y / I;
        const alphaz = torque_z / I;

        vx += ax * dt;
        vy += ay * dt;
        vz += az * dt;
        x += vx * dt;
        y += vy * dt;
        z += vz * dt;

        omegax += alphax * dt;
        omegay += alphay * dt;
        omegaz += alphaz * dt;
        this.t += dt;

        const gy2 = this._groundY(x, z);
        const floor = gy2 + R;

        if (y < floor && vy < 0) {
            y = floor;
            const vyBefore = vy;
            vy = -ground.e * vyBefore;

            const deltaVy = vy - vyBefore;
            const muImpact = ground.mu_impact;

            const sgnVx = Math.abs(vx) > 1e-6 ? Math.sign(vx) : 0;
            const sgnVz = Math.abs(vz) > 1e-6 ? Math.sign(vz) : 0;

            const deltaVx = sgnVx !== 0 ? -muImpact * deltaVy * sgnVx : 0;
            const deltaVz = sgnVz !== 0 ? -muImpact * deltaVy * sgnVz : 0;

            vx += deltaVx;
            vz += deltaVz;

            omegaz += (-deltaVx * R) / I;
            omegax += (deltaVz * R) / I;

            this.bounceCount++;
        } else if (y < floor) {
            y = floor;
        }

        const speed = Math.hypot(vx, vy, vz);
        const spin = Math.hypot(omegax, omegay, omegaz);
        if (y <= floor + 0.001 && speed < STOP_SPEED && spin < STOP_SPIN) {
            vx = vy = vz = 0;
            omegax = omegay = omegaz = 0;
            y = floor;
            this.stopped = true;
        }

        this.x = x;
        this.y = y;
        this.z = z;
        this.vx = vx;
        this.vy = vy;
        this.vz = vz;
        this.omegax = omegax;
        this.omegay = omegay;
        this.omegaz = omegaz;
    }

    get position() {
        return { x: this.x, y: this.y, z: this.z };
    }

    get velocity() {
        return { vx: this.vx, vy: this.vy, vz: this.vz };
    }

    get spin() {
        return { omegax: this.omegax, omegay: this.omegay, omegaz: this.omegaz };
    }

    get speed() {
        return Math.hypot(this.vx, this.vy, this.vz);
    }

    get distanceFromOrigin() {
        return Math.hypot(this.x, this.z);
    }
}
