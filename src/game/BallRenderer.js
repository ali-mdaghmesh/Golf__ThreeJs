import * as THREE from 'three';

export const BALL_VISUAL_SCALE = 2.4;

// نصف قطر الكرة الحقيقي اللي بنستخدمه بالفيزياء
const R = 0.02135;

// هاد الكلاس مسؤول عن رسم الكرة على الشاشة (بدون موديل جاهز عشان أسهل)
export class BallRenderer {
    constructor(scene, physicsRadius = R) {
        this.physicsRadius = physicsRadius;
        this.renderRadius = physicsRadius * BALL_VISUAL_SCALE;
        this.visualOffset = this.renderRadius - this.physicsRadius;
        this.teeVisualExtra = 0.1; // مسافة زيادة عشان المسمار

        this.group = new THREE.Group();
        this.group.name = 'GolfBall';

        // عمل شكل الكرة
        let ballGeo = new THREE.SphereGeometry(this.renderRadius, 48, 48);
        let ballMat = new THREE.MeshPhysicalMaterial();
        
        this.mesh = new THREE.Mesh(ballGeo, ballMat);
       // this.mesh.castShadow = true;
        //this.mesh.receiveShadow = true;
        this.group.add(this.mesh);

        this.trailMax = 120;
        this.trailPoints = [];
        this.trailLine = null;
        
        this.trailMat = new THREE.LineBasicMaterial();

        this.mySpinAngle = new THREE.Euler(0, 0, 0);
        this.lastTrailTime = 0;
        this.myScene = scene;

        scene.add(this.group);
    }

    // بيحسب وين لازم ترتفع الكرة بمحور Y
    computeVisualY(physicsY, groundY, onTee, teeTopY, stopped = false) {
        if (onTee == true && teeTopY != null) {
            return teeTopY + this.renderRadius + this.teeVisualExtra;
        }

        let surfaceY = groundY + this.renderRadius;
        let contact = groundY + this.physicsRadius;

        // إذا الكرة واقفة أو قريبة كتير من الأرض، خليها تلزق بالسطح تماماً
        let onGround = false;
        
        if (stopped == true) {
            onGround = true;
        } else if (physicsY <= contact + 0.008) {
            onGround = true;
        }

        if (onGround == true) {
            return surfaceY;
        }

        return physicsY + this.visualOffset;
    }

    _rebuildTrailGeometry() {
        let numberOfPoints = this.trailPoints.length;
        
        if (numberOfPoints < 2) {
            if (this.trailLine != null) {
                this.trailLine.visible = false;
            }
            return; // وقف الفنكشن هون
        }

        // بنشيل الخط القديم قبل ما نعمل واحد جديد
        if (this.trailLine != null) {
            this.trailLine.geometry.dispose();
            this.myScene.remove(this.trailLine);
        }

        let newGeo = new THREE.BufferGeometry().setFromPoints(this.trailPoints);
        this.trailLine = new THREE.Line(newGeo, this.trailMat);
        this.trailLine.frustumCulled = false;
        this.myScene.add(this.trailLine);
        this.trailLine.visible = true;
    }

    sync(physics, showTrail, groundY = 0, options = {}) {
        // فكينا المتغيرات بدل الاختصارات المعقدة
        let posX = physics.position.x;
        let posY = physics.position.y;
        let posZ = physics.position.z;

        // تبسيط الشروط (If statements)
        let isOnTee = false;
        if (options.onTee == true) {
            isOnTee = true;
        }

        let topOfTee = null;
        if (options.teeTopY != null) {
            topOfTee = options.teeTopY;
        }

        let isStopped = false;
        if (options.stopped == true) {
            isStopped = true;
        }

        // تحديث مكان الكرة
        let vY = this.computeVisualY(posY, groundY, isOnTee, topOfTee, isStopped);
        this.group.position.set(posX, vY, posZ);

        // تدوير الكرة حسب سرعتها الدورانية
        let timeStep = 0.016; // تقريباً فريم واحد
        
        this.mySpinAngle.x = this.mySpinAngle.x + (physics.omegax * timeStep);
        this.mySpinAngle.y = this.mySpinAngle.y + (physics.omegay * timeStep);
        this.mySpinAngle.z = this.mySpinAngle.z + (physics.omegaz * timeStep);
        
        this.mesh.rotation.copy(this.mySpinAngle);

        // رسم خط المسار (Trail)
        if (showTrail == true && physics.stopped == false) {
            let currentTime = performance.now();
            
            if (currentTime - this.lastTrailTime > 50) {
                this.lastTrailTime = currentTime;
                
                let newPoint = new THREE.Vector3(posX, vY, posZ);
                this.trailPoints.push(newPoint);
                
                // إذا الخط صار طويل كتير، احذف أقدم نقطة
                if (this.trailPoints.length > this.trailMax) {
                    this.trailPoints.shift(); 
                }
                
                this._rebuildTrailGeometry();
            }
        } else if (physics.stopped == true && this.trailLine != null) {
            this.trailLine.visible = false;
        }
    }

    clearTrail() {
        this.trailPoints = []; // فضي المصفوفة
        
        if (this.trailLine != null) {
            this.trailLine.geometry.dispose();
            this.myScene.remove(this.trailLine);
            this.trailLine = null;
        }
    }

    setDimpledVisual(dimpled) {
        // حطينا if واضحة بدل علامة الاستفهام ؟
        if (dimpled == true) {
            this.mesh.material.roughness = 0.4;
            this.mesh.material.clearcoat = 0.5;
        } else {
            this.mesh.material.roughness = 0.2;
            this.mesh.material.clearcoat = 0.25;
        }
    }
}