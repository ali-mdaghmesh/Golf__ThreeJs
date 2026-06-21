export class WorldBounds {
    constructor(options) {
        this.halfWidth = options.halfWidth;
        this.halfDepth = options.halfDepth;

        this.margin = options.margin;
        if (this.margin === undefined) {
            this.margin = 2;
        }

        this.minCameraY = options.minCameraY;
        if (this.minCameraY === undefined) {
            this.minCameraY = 0.5;
        }

        this.getGroundHeight = null;
    }

    setGroundHeightFn(fn) {
        this.getGroundHeight = fn;
    }

    // بيقص الإحداثيات حتى تضل جوا حدود الملعب
    clampXZ(x, z) {
        let maxX = this.halfWidth - this.margin;
        let maxZ = this.halfDepth - this.margin;

        let clampedX = x;
        if (clampedX > maxX) {
            clampedX = maxX;
        }
        if (clampedX < -maxX) {
            clampedX = -maxX;
        }

        let clampedZ = z;
        if (clampedZ > maxZ) {
            clampedZ = maxZ;
        }
        if (clampedZ < -maxZ) {
            clampedZ = -maxZ;
        }

        return { x: clampedX, z: clampedZ };
    }

    clampBall(physics) {
        let result = this.clampXZ(physics.x, physics.z);
        physics.x = result.x;
        physics.z = result.z;

        let groundY = 0;
        if (this.getGroundHeight) {
            groundY = this.getGroundHeight(result.x, result.z);
        }

        let floorY = groundY + physics.R;
        if (physics.y < floorY) {
            physics.y = floorY;
            if (physics.vy < 0) {
                physics.vy = 0;
            }
        }
    }

    clampCamera(camera) {
        let result = this.clampXZ(camera.position.x, camera.position.z);
        camera.position.x = result.x;
        camera.position.z = result.z;

        let groundY = 0;
        if (this.getGroundHeight) {
            groundY = this.getGroundHeight(camera.position.x, camera.position.z);
        }

        let minY = groundY + this.minCameraY;
        if (camera.position.y < minY) {
            camera.position.y = minY;
        }
    }

    isOutOfBounds(x, z) {
        let maxX = this.halfWidth - this.margin;
        let maxZ = this.halfDepth - this.margin;
        return Math.abs(x) > maxX || Math.abs(z) > maxZ;
    }
}
