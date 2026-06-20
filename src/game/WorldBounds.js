export class WorldBounds {
    constructor({ halfWidth, halfDepth, margin = 2, minCameraY = 0.5 }) {
        this.halfWidth = halfWidth;
        this.halfDepth = halfDepth;
        this.margin = margin;
        this.minCameraY = minCameraY;
        this.getGroundHeight = null;
    }

    setGroundHeightFn(fn) {
        this.getGroundHeight = fn;
    }

    // بيقص الإحداثيات حتى تضل جوا حدود الملعب
    clampXZ(x, z) {
        const maxX = this.halfWidth - this.margin;
        const maxZ = this.halfDepth - this.margin;

        let clampedX = x;
        if (clampedX > maxX){
             clampedX = maxX;
        }
        if (clampedX < -maxX){
            clampedX = -maxX;
        }

        let clampedZ = z;
        
        if (clampedZ > maxZ){
            clampedZ = maxZ;
        }
        if (clampedZ < -maxZ){

        } 

        return { x: clampedX, z: clampedZ };
    }

    clampBall(physics) {
        const result = this.clampXZ(physics.x, physics.z);
        physics.x = result.x;
        physics.z = result.z;

        let gy = 0;
        if (this.getGroundHeight) {
            gy = this.getGroundHeight(result.x, result.z);
        }

        const floor = gy + physics.R;
        if (physics.y < floor) {
            physics.y = floor;
            if (physics.vy < 0) {
                physics.vy = 0;
            }
        }
    }

    clampCamera(camera) {
        const result = this.clampXZ(camera.position.x, camera.position.z);
        camera.position.x = result.x;
        camera.position.z = result.z;

        let gy = 0;
        if (this.getGroundHeight) {
            gy = this.getGroundHeight(camera.position.x, camera.position.z);
        }

        const minY = gy + this.minCameraY;
        if (camera.position.y < minY) {
            camera.position.y = minY;
        }
    }

    isOutOfBounds(x, z) {
        const maxX = this.halfWidth - this.margin;
        const maxZ = this.halfDepth - this.margin;
        return Math.abs(x) > maxX || Math.abs(z) > maxZ;
    }
}
