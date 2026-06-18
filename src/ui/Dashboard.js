import { DEFAULT_SHOT_TEMPLATE } from '../game/DefaultShot.js';

export class Dashboard {
    constructor(callbacks) {
        this.cb = callbacks;
        this.root = document.getElementById('dashboard');
        this.toggleBtn = document.getElementById('btn-dashboard');
        this.closeBtn = document.getElementById('dashboard-close');
        this.backdrop = document.getElementById('dashboard-backdrop');

        this.defaults = { ...DEFAULT_SHOT_TEMPLATE };
        this.params = { ...this.defaults };
        this._userTouched = false;

        this._bind();
    }

    setDefaults(defaults) {
        this.defaults = { ...this.defaults, ...defaults };
        if (!this._userTouched) {
            this.params = { ...this.defaults };
            this._syncInputs();
        }
    }

    getDefaults() {
        return { ...this.defaults };
    }

    _notifyChange() {
        this.cb.onParamsChange?.();
    }

    _bind() {
        const stop = (e) => e.stopPropagation();

        this.toggleBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        this.closeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
        });
        this.backdrop?.addEventListener('click', () => this.hide());
        this.root?.addEventListener('click', stop);

        const markTouched = () => {
            this._userTouched = true;
        };

        const bindRange = (id, key) => {
            const el = document.getElementById(id);
            const val = document.getElementById(`${id}-val`);
            if (!el) return;
            el.addEventListener('input', () => {
                markTouched();
                this.params[key] = parseFloat(el.value);
                if (val) val.textContent = el.value;
                this._notifyChange();
            });
        };

        bindRange('param-v0', 'v0');
        bindRange('param-theta', 'thetaDeg');
        bindRange('param-vz0', 'vz0');
        bindRange('param-omegax', 'omegax');
        bindRange('param-omegay', 'omegay');
        bindRange('param-omegaz', 'omegaz');
        bindRange('param-startX', 'startX');
        bindRange('param-startZ', 'startZ');
        bindRange('param-aim-yaw', 'aimYawDeg');
        bindRange('param-view-yaw', 'viewYawDeg');

        const shootBtn = document.getElementById('btn-shoot');
        shootBtn?.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.cb.onBeginCharge?.();
        });
        shootBtn?.addEventListener('pointerup', (e) => {
            e.preventDefault();
            this.cb.onReleaseCharge?.();
        });
        shootBtn?.addEventListener('contextmenu', (e) => e.preventDefault());

        document.getElementById('btn-reset')?.addEventListener('click', () => {
            this._userTouched = false;
            this.params = { ...this.defaults };
            this._syncInputs();
            this.cb.onReset?.();
        });

        document.getElementById('btn-restore-defaults')?.addEventListener('click', () => {
            this._userTouched = false;
            this.params = { ...this.defaults };
            this._syncInputs();
            this._notifyChange();
        });

        document.getElementById('ball-dimpled')?.addEventListener('change', (e) => {
            markTouched();
            this.params.dimpled = e.target.checked;
            const smoothEl = document.getElementById('ball-smooth');
            if (smoothEl) smoothEl.checked = !e.target.checked;
            this.cb.onBallType?.(this.params.dimpled);
            this._notifyChange();
        });

        document.getElementById('ball-smooth')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                markTouched();
                this.params.dimpled = false;
                const dimpledEl = document.getElementById('ball-dimpled');
                if (dimpledEl) dimpledEl.checked = false;
                this.cb.onBallType?.(false);
                this._notifyChange();
            }
        });

        document.getElementById('opt-trail')?.addEventListener('change', (e) => {
            this.params.showTrail = e.target.checked;
            this.cb.onTrail?.(e.target.checked);
        });

        document.getElementById('opt-follow')?.addEventListener('change', (e) => {
            this.params.followBall = e.target.checked;
            this.cb.onFollowBall?.(e.target.checked);
        });

        document.getElementById('camera-mode')?.addEventListener('change', (e) => {
            this.params.cameraMode = e.target.value;
            this.cb.onCameraMode?.(e.target.value);
            this._notifyChange();
        });

        document.querySelectorAll('[data-preset]').forEach((btn) => {
            btn.addEventListener('click', () => {
                markTouched();
                this._applyPreset(btn.dataset.preset);
                this._syncInputs();
                this._notifyChange();
            });
        });
    }

    _applyPreset(name) {
        const presets = {
            standard: { ...this.defaults },
            low: { v0: 70, thetaDeg: 8, omegaz: 100 },
            high: { v0: 70, thetaDeg: 14, omegaz: 100 },
            draw: { v0: 65, thetaDeg: 10, omegaz: 80, omegay: 40 },
            fade: { v0: 65, thetaDeg: 10, omegaz: 80, omegay: -40 },
            flop: { v0: 40, thetaDeg: 22, omegaz: 120 },
            short: { v0: 40, thetaDeg: 8, omegaz: 50 },
            smooth: { v0: 70, thetaDeg: 12, omegaz: 100, dimpled: false },
        };
        Object.assign(this.params, presets[name] ?? {});
        if (name === 'smooth') {
            document.getElementById('ball-dimpled').checked = false;
            this.cb.onBallType?.(false);
        }
    }

    _syncInputs() {
        const set = (id, val) => {
            const el = document.getElementById(id);
            const label = document.getElementById(`${id}-val`);
            if (el) {
                el.value = val;
                if (label) label.textContent = String(val);
            }
        };
        set('param-v0', this.params.v0);
        set('param-theta', this.params.thetaDeg);
        set('param-vz0', this.params.vz0);
        set('param-omegax', this.params.omegax);
        set('param-omegay', this.params.omegay);
        set('param-omegaz', this.params.omegaz);
        set('param-startX', this.params.startX);
        set('param-startZ', this.params.startZ);
        set('param-aim-yaw', this.params.aimYawDeg ?? 0);
        set('param-view-yaw', this.params.viewYawDeg ?? 0);
        const dimpledEl = document.getElementById('ball-dimpled');
        if (dimpledEl) dimpledEl.checked = this.params.dimpled;
    }

    getShootParams() {
        return { ...this.params };
    }

    setStrokePosition(x, z, notify = true) {
        this.params.startX = x;
        this.params.startZ = z;
        const set = (id, val) => {
            const el = document.getElementById(id);
            const label = document.getElementById(`${id}-val`);
            if (el) {
                el.value = val;
                if (label) label.textContent = String(Math.round(val));
            }
        };
        set('param-startX', x);
        set('param-startZ', z);
        if (notify) this._notifyChange();
    }

    updateStats(stats) {
        const el = document.getElementById('stats-readout');
        if (!el) return;
        el.innerHTML = `
            <div><span>السرعة</span><strong>${stats.speed.toFixed(2)} م/ث</strong></div>
            <div><span>الارتفاع</span><strong>${stats.height.toFixed(2)} م</strong></div>
            <div><span>المسافة الأفقية</span><strong>${stats.carry.toFixed(1)} م</strong></div>
            <div><span>الارتدادات</span><strong>${stats.bounces}</strong></div>
            <div><span>الزمن</span><strong>${stats.time.toFixed(2)} ث</strong></div>
            <div><span>الحالة</span><strong>${stats.state}</strong></div>
        `;
    }

    show() {
        this.root?.classList.add('open');
        this.backdrop?.classList.add('open');
    }

    hide() {
        this.root?.classList.remove('open');
        this.backdrop?.classList.remove('open');
    }

    toggle() {
        if (this.root?.classList.contains('open')) this.hide();
        else this.show();
    }
}
