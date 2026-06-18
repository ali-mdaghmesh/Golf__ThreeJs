/** معاملات التلامس مع الأرض — وفق الدراسة (μr, e, μimpact) */
export class GroundMaterial {
    constructor() {
        this.mu_rolling = 0.1;
        this.mu_sliding = 0.3;
        this.mu_impact = 0.22;
        this.e = 0.8;
    }

    /** عشب قصير جاف (افتراضي الدراسة) */
    setGrass() {
        this.mu_rolling = 0.1;
        this.mu_sliding = 0.3;
        this.mu_impact = 0.4;
        this.e = 0.8;
    }

    setGreen() {
        this.mu_rolling = 0.08;
        this.mu_sliding = 0.25;
        this.mu_impact = 0.35;
        this.e = 0.85;
    }

    setRough() {
        this.mu_rolling = 0.18;
        this.mu_sliding = 0.4;
        this.mu_impact = 0.45;
        this.e = 0.75;
    }

    setBunker() {
        this.mu_rolling = 0.25;
        this.mu_sliding = 0.5;
        this.mu_impact = 0.5;
        this.e = 0.6;
    }

    setFairway() {
        this.mu_rolling = 0.09;
        this.mu_sliding = 0.28;
        this.mu_impact = 0.38;
        this.e = 0.82;
    }

    /** @deprecated — استخدم setGrass / setRough */
    change(type) {
        if (type === 'smooth') {
            this.mu_rolling = 0.01;
            this.e = 0.85;
        } else if (type === 'rough') {
            this.setRough();
        } else {
            this.setGrass();
        }
    }
}
