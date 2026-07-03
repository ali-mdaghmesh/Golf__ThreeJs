export class GroundMaterial {
    constructor() {
        this.mu_rolling = 0.1;
        this.mu_sliding = 0.3;
        this.mu_impact = 0.22;
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
    this.mu_rolling = 0.45; 
    this.mu_sliding = 2.6;   
    this.mu_impact = 2.75;   
    this.e = 0.15;         
}
}
