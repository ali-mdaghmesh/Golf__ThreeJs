/**
 * حدود الملعب — تمنع الكرة والكاميرا من الخروج أو النزول تحت الأرض
 */
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

    clampXZ(x, z) {
        const maxX = this.halfWidth - this.margin;
        const maxZ = this.halfDepth - this.margin;
        return {
            x: Math.max(-maxX, Math.min(maxX, x)),
            z: Math.max(-maxZ, Math.min(maxZ, z)),
        };
    }

    clampBall(physics) {
        const { x, z } = this.clampXZ(physics.x, physics.z);
        physics.x = x;
        physics.z = z;
        const gy = this.getGroundHeight ? this.getGroundHeight(x, z) : 0;
        const floor = gy + physics.R;
        if (physics.y < floor) {
            physics.y = floor;
            if (physics.vy < 0) physics.vy = 0;
        }
    }

    clampCamera(camera) {
        const { x, z } = this.clampXZ(camera.position.x, camera.position.z);
        camera.position.x = x;
        camera.position.z = z;

        const gy = this.getGroundHeight
            ? this.getGroundHeight(camera.position.x, camera.position.z)
            : 0;
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
