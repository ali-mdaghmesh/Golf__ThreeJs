export class GroundMaterial {
    constructor() {
        this.mu_rolling = 0.1;
        this.e          = 0.8;
    }

    change(type) {
        if (type === 'smooth') {
            this.mu_rolling = 0.01;
            this.e          = 0.85;
            console.log("الفيزياء الحالية: أرض ملساء تماماً (انزلاق مرتفع)");

        } else if (type === 'rough') {
            this.mu_rolling = 0.35;
            this.e          = 0.45;
            console.log("الفيزياء الحالية: أرض خشنة (كبح وسرعة امتصاص للصدمة)");

        } else {
            this.mu_rolling = 0.1;
            this.e          = 0.8;
            console.log("الفيزياء الحالية: عشب الغولف الطبيعي القياسي");
        }
    }
}