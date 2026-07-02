import { GroundMaterial } from './GroundMaterial.js';

const STOP_SPEED = 0.08;
const STOP_SPIN = 2.0;
const GROUND_TORQUE_GAIN = 20;
const FIXED_DT = 0.001;
const MAX_SUBSTEPS = 12;


export class BallPhysics {
    constructor() {
        this.m = 0.04593;
        this.R = 0.02135;
        this.g = 9.81;
        this.rho = 1.225;
        this.I = (2/5) * this.m * this.R * this.R;
        this.area = Math.PI * this.R * this.R;

        this.setDimpled(true);

        this.ground = new GroundMaterial(); 
        this.getGroundHeight = null;
        this.groundType = 'shortGrass';

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


    shoot({
        v0 = 100,
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
        const vx = vxOverride;
        const vy = vyOverride;
        const vz = vzOverride;

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
    }

    _groundY(x, z) {
        return this.getGroundHeight ? this.getGroundHeight(x, z) : 0;
    }

    _applyZoneFriction() {
    if (this.groundType === 'sand') {
        this.ground.setBunker();
    } else if (this.groundType === 'tallGrass') {
        this.ground.setRough();
    } else {
        this.ground.setGreen();
    }
}

    setGroundType(type) {
    this.groundType = type;
}

    update(frameDt) {
        if (this.stopped) 
            return;

        this._accumulator += Math.min(frameDt, 0.05);
        let steps = 0;

        while (this._accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
            this._step(FIXED_DT);
            this._accumulator -= FIXED_DT;
            steps++;
        }
    }

    _step(dt) {
        let forces = this._calculateForces();

        this._updateMotion(forces, dt);

        this._handleGroundCollision(dt);

        this._checkIfStopped();
    }

    _calculateForces() {
        const { m, R, g, rho, Cd, Cl0, Cl_max, I, area } = this;
        let vTotal = Math.hypot(this.vx, this.vy, this.vz);
        if (vTotal < 1e-6) vTotal = 1e-6;

        const F_drag_mag = 0.5 * rho * Cd * area * vTotal * vTotal;
        const F_drag_x = -F_drag_mag * (this.vx / vTotal);
        const F_drag_y = -F_drag_mag * (this.vy / vTotal);
        const F_drag_z = -F_drag_mag * (this.vz / vTotal);

        const cross_x = this.omegay * this.vz - this.omegaz * this.vy;
        const cross_y = this.omegaz * this.vx - this.omegax * this.vz;
        const cross_z = this.omegax * this.vy - this.omegay * this.vx;
        let crossMag = Math.hypot(cross_x, cross_y, cross_z);
        if (crossMag < 1e-8) crossMag = 1e-8;

        const spinTotal = Math.hypot(this.omegax, this.omegay, this.omegaz);
        const spinRatio = (spinTotal * R) / vTotal;
        const Cl = Math.min(Cl0 * spinRatio, Cl_max);
        const F_magnus_mag = 0.5 * rho * Cl * area * vTotal * vTotal;

        const F_magnus_x = F_magnus_mag * (cross_x / crossMag);
        const F_magnus_y = F_magnus_mag * (cross_y / crossMag);
        const F_magnus_z = F_magnus_mag * (cross_z / crossMag);

        let F_fric_x = 0;
        let F_fric_z = 0;
        let torque_x = 0;
        let torque_y = 0;
        let torque_z = 0;
        
        const gy = this._groundY(this.x, this.z);
        const contactY = gy + R;
        const penetrating = this.y < contactY - 0.0001;
        const onGround = penetrating || (this.y <= contactY + 0.002 && this.vy <= 0.08);

        if (onGround || penetrating) {
            this._applyZoneFriction();
            let N = m * g;
            const vHoriz = Math.hypot(this.vx, this.vz);
            if (vHoriz > 0.01) {
                const F_fric_mag = (Math.hypot(this.vx + this.omegaz * R, this.vz - this.omegax * R) > 0.5) 
                    ? this.ground.mu_sliding * N 
                    : this.ground.mu_rolling * N;
                F_fric_x = -F_fric_mag * (this.vx / vHoriz);
                F_fric_z = -F_fric_mag * (this.vz / vHoriz);
            }
            torque_x = ((this.vz / R) - this.omegax) * GROUND_TORQUE_GAIN * I;
            torque_y = (0 - this.omegay) * GROUND_TORQUE_GAIN * I;
            torque_z = ((-this.vx / R) - this.omegaz) * GROUND_TORQUE_GAIN * I;
        }

        return {
            x: F_drag_x + F_magnus_x + F_fric_x,
            y: F_drag_y + F_magnus_y - m * g + (onGround || penetrating ? m * g : 0),
            z: F_drag_z + F_magnus_z + F_fric_z,
            tx: torque_x,
            ty: torque_y,
            tz: torque_z
        };
    }

    _updateMotion(forces, dt) {
        this.vx += (forces.x / this.m) * dt;
        this.vy += (forces.y / this.m) * dt;
        this.vz += (forces.z / this.m) * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.z += this.vz * dt;

        this.omegax += (forces.tx / this.I) * dt;
        this.omegay += (forces.ty / this.I) * dt;
        this.omegaz += (forces.tz / this.I) * dt;
        this.t += dt;
    }

    _handleGroundCollision(dt) {
        const gy2 = this._groundY(this.x, this.z);
        const floor = gy2 + this.R;

        if (this.y < floor && this.vy < 0) {
            this.y = floor;
            this.vy = -this.ground.e * this.vy;

            const muImpact = this.ground.mu_impact;
            const sgnVx = Math.sign(this.vx);
            const sgnVz = Math.sign(this.vz);

            this.vx += sgnVx !== 0 ? -muImpact * this.vy * sgnVx : 0;
            this.vz += sgnVz !== 0 ? -muImpact * this.vy * sgnVz : 0;

            this.omegaz += (-this.vx * this.R) / this.I;
            this.omegax += (this.vz * this.R) / this.I;

            this.bounceCount++;
        } else if (this.y < floor) {
            this.y = floor;
        }
    }

    _checkIfStopped() {
        const gy = this._groundY(this.x, this.z);
        const floor = gy + this.R;
        const speed = Math.hypot(this.vx, this.vy, this.vz);
        const spin = Math.hypot(this.omegax, this.omegay, this.omegaz);
        
        if (this.y <= floor + 0.001 && speed < STOP_SPEED && spin < STOP_SPIN) {
            this.vx = this.vy = this.vz = 0;
            this.omegax = this.omegay = this.omegaz = 0;
            this.y = floor;
            this.stopped = true;
        }
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

}
