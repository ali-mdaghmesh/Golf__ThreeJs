import { GroundMaterial } from './GroundMaterial.js';

export class BallPhysics {

    constructor() {
        this.m    = 0.04593;
        this.R    = 0.02135;
        this.g    = 9.81;
        this.rho  = 1.225;
        this.Cd   = 0.25;
        this.Cl0  = 0.22;
        this.I    = (2 / 5) * this.m * this.R * this.R;
        this.area = Math.PI * this.R * this.R;

        this.ground = new GroundMaterial();

        this.x = 0;
        this.y = this.R;
        this.z = 0;

        this.vx = 60;
        this.vy = 20;
        this.vz = 5;

        this.omegax = 0;
        this.omegay = 15;
        this.omegaz = 120;

        this.t = 0;
    }


    shoot({
        vx     = 60,
        vy     = 20,
        vz     = 5,
        omegax = 0,
        omegay = 15,
        omegaz = 120,
        startX = 0,
        startZ = 0,
    } = {}) {
        this.x      = startX;
        this.y      = this.R;
        this.z      = startZ;
        this.vx     = vx;
        this.vy     = vy;
        this.vz     = vz;
        this.omegax = omegax;
        this.omegay = omegay;
        this.omegaz = omegaz;
        this.t      = 0;
        console.log(`الكرة انطلقت: vx=${vx}, vy=${vy}, vz=${vz}`);
    }

    update(dt) {
        const { m, R, g, rho, Cd, Cl0, I, area } = this;
        const { mu_rolling, e } = this.ground;

        let { x, y, z, vx, vy, vz, omegax, omegay, omegaz } = this;

        // حساب السرعة الكلية المحصلة في 3D
        let v_total = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (v_total < 0.001) v_total = 0.001;

        // 1. قوة مقاومة الهواء (Drag Force)
        let F_drag_mag = 0.5 * rho * Cd * area * v_total * v_total;
        let F_drag_x = -F_drag_mag * (vx / v_total);
        let F_drag_y = -F_drag_mag * (vy / v_total);
        let F_drag_z = -F_drag_mag * (vz / v_total);

        // 2. قوة ماغنوس (Magnus Force)
        let cross_x = omegay * vz - omegaz * vy;
        let cross_y = omegaz * vx - omegax * vz;
        let cross_z = omegax * vy - omegay * vx;
        let cross_mag = Math.sqrt(cross_x * cross_x + cross_y * cross_y + cross_z * cross_z);
        if (cross_mag < 0.001) cross_mag = 0.001;

        let spin_total = Math.sqrt(omegax * omegax + omegay * omegay + omegaz * omegaz);
        let spin_ratio = (spin_total * R) / v_total;
        let Cl = Math.min(Cl0 * spin_ratio, 0.3);
        let F_magnus_mag = 0.5 * rho * Cl * area * v_total * v_total;

        let F_magnus_x = F_magnus_mag * (cross_x / cross_mag);
        let F_magnus_y = F_magnus_mag * (cross_y / cross_mag);
        let F_magnus_z = F_magnus_mag * (cross_z / cross_mag);

        // 3. قوة الوزن (Gravity)
        let F_weight_y = -m * g;

        // 4. قوى التلامس والاحتكاك السطحي
        let isOnGround = (y <= R);
        let N = 0;
        let F_friction_x = 0;
        let F_friction_z = 0;
        let torque_x = 0;
        let torque_y = 0;
        let torque_z = 0;

        if (isOnGround) {
            N = m * g;
            let v_horiz = Math.hypot(vx, vz);

            if (v_horiz > 0.01) {
                let F_roll_mag = mu_rolling * N;
                F_friction_x = -F_roll_mag * (vx / v_horiz);
                F_friction_z = -F_roll_mag * (vz / v_horiz);
            }

            let target_omegax = vz / R;
            let target_omegaz = -vx / R;

            torque_x = (target_omegax - omegax) * 20 * I;
            torque_y = (0 - omegay) * 20 * I;
            torque_z = (target_omegaz - omegaz) * 20 * I;
        }

        // محصلة القوى والتسارعات
        let F_net_x = F_drag_x + F_magnus_x + F_friction_x;
        let F_net_y = F_drag_y + F_magnus_y + F_weight_y + N;
        let F_net_z = F_drag_z + F_magnus_z + F_friction_z;

        let ax = F_net_x / m;
        let ay = F_net_y / m;
        let az = F_net_z / m;

        let alphax = torque_x / I;
        let alphay = torque_y / I;
        let alphaz = torque_z / I;

        // تكامل أويلر
        vx += ax * dt; vy += ay * dt; vz += az * dt;
        x  += vx * dt; y  += vy * dt; z  += vz * dt;

        omegax += alphax * dt;
        omegay += alphay * dt;
        omegaz += alphaz * dt;
        this.t += dt;

        // معالجة الاصطدام بالأرض
        if (y < R) {
            y = R;

            let vy_before = vy;
            vy = -vy * e;

            let impulse_vertical = m * (vy - (vy_before / -e));
            let friction_impulse = -0.4 * impulse_vertical;

            let v_horiz = Math.hypot(vx, vz);
            if (v_horiz > 0.001) {
                let jx = friction_impulse * (vx / v_horiz);
                let jz = friction_impulse * (vz / v_horiz);

                vx += jx / m;
                vz += jz / m;

                omegaz -= (jx * R) / I;
                omegax += (jz * R) / I;
            }
        }

        // حفظ القيم
        this.x = x; this.y = y; this.z = z;
        this.vx = vx; this.vy = vy; this.vz = vz;
        this.omegax = omegax; this.omegay = omegay; this.omegaz = omegaz;
    }

    get position() {
        return { x: this.x, y: this.y, z: this.z };
    }

    get rotation() {
        return { x: this.omegax, y: this.omegay, z: this.omegaz };
    }
}