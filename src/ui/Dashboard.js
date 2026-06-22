import { DEFAULT_SHOT_TEMPLATE } from '../game/DefaultShot.js';

export class Dashboard {
    constructor(callbacks) {
        this.callbacks = callbacks;
        
        // جلب العناصر بالطريقة العادية
        this.rootPanel = document.getElementById('dashboard');
        this.toggleButton = document.getElementById('btn-dashboard');
        this.closeButton = document.getElementById('dashboard-close');
        this.backdrop = document.getElementById('dashboard-backdrop');

        // نسخ القيم 
        this.defaultSettings = Object.assign({}, DEFAULT_SHOT_TEMPLATE);
        this.currentSettings = Object.assign({}, this.defaultSettings);
        
        this.userChangedSomething = false;

        this.setupButtonsAndSliders();
    }

    setDefaults(newDefaults) {
        // تحديث القيم الافتراضية
        this.defaultSettings = Object.assign(this.defaultSettings, newDefaults);
        
        if (this.userChangedSomething == false) {
            this.currentSettings = Object.assign({}, this.defaultSettings);
            this.updateAllInputsOnScreen();
        }
    }

    getDefaults() {
        return Object.assign({}, this.defaultSettings);
    }

    // دالة لربط كل الأزرار
    setupButtonsAndSliders() {
        let self = this; 

        // زر فتح القائمة
        if (this.toggleButton != null) {
            this.toggleButton.addEventListener('click', function(event) {
                event.stopPropagation();
                if (self.rootPanel.classList.contains('open')) {
                    self.rootPanel.classList.remove('open');
                    self.backdrop.classList.remove('open');
                } else {
                    self.rootPanel.classList.add('open');
                    self.backdrop.classList.add('open');
                }
            });
        }

        // زر إغلاق القائمة
        if (this.closeButton != null) {
            this.closeButton.addEventListener('click', function(event) {
                event.stopPropagation();
                self.rootPanel.classList.remove('open');
                self.backdrop.classList.remove('open');
            });
        }

        if (this.backdrop != null) {
            this.backdrop.addEventListener('click', function() {
                self.rootPanel.classList.remove('open');
                self.backdrop.classList.remove('open');
            });
        }

        if (this.rootPanel != null) {
            this.rootPanel.addEventListener('click', function(event) {
                event.stopPropagation();
            });
        }

        // --- ربط أشرطة التمرير (Sliders) يدوياً ---
        function bindMySlider(id, key) {
            let el = document.getElementById(id);
            if (el != null) {
                el.addEventListener('input', function() {
                    self.userChangedSomething = true;
                    self.currentSettings[key] = parseFloat(el.value);
                    let label = document.getElementById(id + '-val');
                    if (label != null) {
                        label.innerHTML = el.value;
                    }
                    if (self.callbacks.onParamsChange) {
                        self.callbacks.onParamsChange();
                    }
                });
            }
        }

        bindMySlider('param-v0', 'v0');
        bindMySlider('param-theta', 'thetaDeg');
        bindMySlider('param-vz0', 'vz0');
        bindMySlider('param-omegax', 'omegax');
        bindMySlider('param-omegay', 'omegay');
        bindMySlider('param-omegaz', 'omegaz');
        bindMySlider('param-startX', 'startX');
        bindMySlider('param-startZ', 'startZ');
        bindMySlider('param-aim-yaw', 'aimYawDeg');
        bindMySlider('param-view-yaw', 'viewYawDeg');

        // --- زر إطلاق الكرة ---
        let shootBtn = document.getElementById('btn-shoot');
        if (shootBtn != null) {
            shootBtn.addEventListener('pointerdown', function(event) {
                event.preventDefault();
                if (self.callbacks.onBeginCharge) {
                    self.callbacks.onBeginCharge();
                }
            });
            
            shootBtn.addEventListener('pointerup', function(event) {
                event.preventDefault();
                if (self.callbacks.onReleaseCharge) {
                    self.callbacks.onReleaseCharge();
                }
            });
        }

        // --- زر إعادة الضبط ---
        let resetBtn = document.getElementById('btn-reset');
        if (resetBtn != null) {
            resetBtn.addEventListener('click', function() {
                self.userChangedSomething = false;
                self.currentSettings = Object.assign({}, self.defaultSettings);
                self.updateAllInputsOnScreen();
                if (self.callbacks.onReset) {
                    self.callbacks.onReset();
                }
            });
        }

        // --- خيارات الكرة ---
        let dimpledBox = document.getElementById('ball-dimpled');
        let smoothBox = document.getElementById('ball-smooth');

        if (dimpledBox != null) {
            dimpledBox.addEventListener('change', function(event) {
                self.userChangedSomething = true;
                self.currentSettings.dimpled = true;
                if (smoothBox != null) {
                    smoothBox.checked = false;
                }
                if (self.callbacks.onBallType) {
                    self.callbacks.onBallType(true);
                }
                if (self.callbacks.onParamsChange) {
                    self.callbacks.onParamsChange();
                }
            });
        }

        if (smoothBox != null) {
            smoothBox.addEventListener('change', function(event) {
                self.userChangedSomething = true;
                self.currentSettings.dimpled = false;
                if (dimpledBox != null) {
                    dimpledBox.checked = false;
                }
                if (self.callbacks.onBallType) {
                    self.callbacks.onBallType(false);
                }
                if (self.callbacks.onParamsChange) {
                    self.callbacks.onParamsChange();
                }
            });
        }
    }

    // طريقة يدوية لتحديث كل عناصر الشاشة (تشمل زوايا الدوران)
    updateAllInputsOnScreen() {
        let self = this;

        function updateMySlider(id, value) {
            let el = document.getElementById(id);
            if (el != null) {
                if (value == undefined) {
                    value = 0; 
                }
                el.value = value;
                
                let label = document.getElementById(id + '-val');
                if (label != null) {
                    label.innerHTML = value;
                }
            }
        }

        updateMySlider('param-v0', this.currentSettings.v0);
        updateMySlider('param-theta', this.currentSettings.thetaDeg);
        updateMySlider('param-vz0', this.currentSettings.vz0);
        
        updateMySlider('param-omegax', this.currentSettings.omegax);
        updateMySlider('param-omegay', this.currentSettings.omegay);
        updateMySlider('param-omegaz', this.currentSettings.omegaz);
        
        updateMySlider('param-startX', this.currentSettings.startX);
        updateMySlider('param-startZ', this.currentSettings.startZ);
        updateMySlider('param-aim-yaw', this.currentSettings.aimYawDeg);
        updateMySlider('param-view-yaw', this.currentSettings.viewYawDeg);

        let dimpledBox = document.getElementById('ball-dimpled');
        if (dimpledBox != null) {
            dimpledBox.checked = this.currentSettings.dimpled;
        }
    }

    getShootParams() {
        return Object.assign({}, this.currentSettings);
    }

    setStrokePosition(x, z) {
        this.currentSettings.startX = x;
        this.currentSettings.startZ = z;
        
        let xInput = document.getElementById('param-startX');
        if (xInput != null) {
            xInput.value = x;
            let xLabel = document.getElementById('param-startX-val');
            if (xLabel != null) {
                xLabel.innerHTML = Math.round(x);
            }
        }

        let zInput = document.getElementById('param-startZ');
        if (zInput != null) {
            zInput.value = z;
            let zLabel = document.getElementById('param-startZ-val');
            if (zLabel != null) {
                zLabel.innerHTML = Math.round(z);
            }
        }

        if (this.callbacks.onParamsChange) {
            this.callbacks.onParamsChange();
        }
    }

    updateStats(stats) {
        let el = document.getElementById('stats-readout');
        if (el != null) {
            el.innerHTML = 
                "<div><span>السرعة</span><strong>" + stats.speed.toFixed(2) + " م/ث</strong></div>" +
                "<div><span>الارتفاع</span><strong>" + stats.height.toFixed(2) + " م</strong></div>" +
                "<div><span>المسافة الأفقية</span><strong>" + stats.carry.toFixed(1) + " م</strong></div>" +
                "<div><span>الارتدادات</span><strong>" + stats.bounces + "</strong></div>" +
                "<div><span>الزمن</span><strong>" + stats.time.toFixed(2) + " ث</strong></div>" +
                "<div><span>الحالة</span><strong>" + stats.state + "</strong></div>";
        }
    }
}