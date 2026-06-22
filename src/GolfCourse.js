/**
 * ============================================================
 *  GolfCourse.js  —  Golf Course Terrain System for Three.js
 * ============================================================
 */

import * as THREE from 'three';

export const ZONE = Object.freeze({
    TEE     : 'tee',
    FAIRWAY : 'fairway',
    ROUGH   : 'rough',
    GREEN   : 'green',
    BUNKER  : 'bunker',
    WATER   : 'water',
    OUT     : 'out',
});

export const ZONE_FRICTION = Object.freeze({
    [ZONE.TEE]     : 0.94,
    [ZONE.FAIRWAY] : 0.91,
    [ZONE.ROUGH]   : 0.78,
    [ZONE.GREEN]   : 0.96,
    [ZONE.BUNKER]  : 0.55,
    [ZONE.WATER]   : 0.20,
    [ZONE.OUT]     : 0.70,
});

// ─────────────────────────────────────────────────────────────
//  FBM Noise
// ─────────────────────────────────────────────────────────────
class FBMNoise {
    constructor(seed = 42) {
        this._p = new Uint8Array(512);
        for (let i = 0; i < 256; i++) this._p[i] = i;
        let s = seed;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807 + 0) % 2147483647;
            const j = (s / 2147483647 * (i + 1)) | 0;
            [this._p[i], this._p[j]] = [this._p[j], this._p[i]];
        }
        for (let i = 0; i < 256; i++) this._p[i + 256] = this._p[i];
    }
    _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    _lerp(t, a, b) { return a + t * (b - a); }
    _grad(h, x, y) {
        h &= 3;
        return ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
    }
    noise2(x, y) {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        x -= Math.floor(x); y -= Math.floor(y);
        const u = this._fade(x), v = this._fade(y);
        const a = this._p[X] + Y, b = this._p[X + 1] + Y;
        return this._lerp(v,
            this._lerp(u, this._grad(this._p[a],     x,     y),
                          this._grad(this._p[b],     x - 1, y)),
            this._lerp(u, this._grad(this._p[a + 1], x,     y - 1),
                          this._grad(this._p[b + 1], x - 1, y - 1))
        );
    }
    fbm(x, y, octaves = 6, lacunarity = 2.0, gain = 0.5) {
        let value = 0, amp = 0.5, freq = 1;
        for (let i = 0; i < octaves; i++) {
            value += this.noise2(x * freq, y * freq) * amp;
            freq  *= lacunarity;
            amp   *= gain;
        }
        return value;
    }
}

// ─────────────────────────────────────────────────────────────
//  HoleLayout
// ─────────────────────────────────────────────────────────────
class HoleLayout {
    constructor(index, totalW, totalD, count) {
        const strip = totalD / count;
        const z0    = -totalD / 2 + index * strip;
        const z1    = z0 + strip;
        const midZ  = (z0 + z1) / 2;
        const xOff  = Math.sin(index * 1.7) * 0.18 * totalW;

        this.teePos    = new THREE.Vector3(xOff,       0, midZ - strip * 0.18);
        this.holePos   = new THREE.Vector3(xOff * 0.4, 0, midZ + strip * 0.18);
        this.midPos    = new THREE.Vector3(xOff * 0.5, 0, midZ);
        this.fairwayHW = 0.10 + 0.04 * Math.sin(index * 2.3);
        this.greenR    = 6 + (index % 3);
        this.par       = index % 3 === 0 ? 5 : index % 3 === 1 ? 4 : 3;
        this.index     = index;
        this.bunkers   = [
            new THREE.Vector3(xOff - 10 - index, 0, midZ - 12),
            new THREE.Vector3(xOff + 10 + index, 0, midZ + 8),
        ];
    }
}

// ─────────────────────────────────────────────────────────────
//  GolfCourse
// ─────────────────────────────────────────────────────────────
export class GolfCourse {
    constructor(scene, options = {}) {
        this.scene = scene;

        this.opt = {
            width              : 1200,
            depth              : 2000,
            segments           : 150,
            maxHeight          : 5,
            noiseSeed          : 42,
            textureRepeat      : 1090,
            grassTexturePath   : null,
            grassNormalPath    : null,
            grassRoughPath     : null,
            roughTexturePath   : null,
            fairwayTexturePath : null,
            greenTexturePath   : null,
            sandTexturePath    : null,
            waterTexturePath   : null,
            grassCount         : 4000,
            holeCount          : 1,
            showWater          : false,
            showBunkers        : false,
            ...options,
        };

        this.opt.holeCount = Math.max(1, Math.min(18, this.opt.holeCount));

        this._noise       = new FBMNoise(this.opt.noiseSeed);
        this._loader      = new THREE.TextureLoader();
        this._group       = new THREE.Group();
        this._group.name  = 'GolfCourse';
        scene.add(this._group);

        this.terrainMesh  = null;
        this.holes        = [];
        this._heightData  = null;
        this._grassMesh   = null;
        this._waterMeshes = [];
        this._waterAreas  = [];
        this._flagMeshes  = [];
        this._textures    = {};
    }

    async init() {
        await this._loadTextures();
        this._buildHoleLayouts();
        this._buildHeightmap();
        this._buildTerrainMesh();
        this._buildFairwayOverlays();
        if (this.opt.showBunkers) this._buildBunkers();
        if (this.opt.showWater)   this._buildWaterAreas();
        this._buildAllHoleObjects();
        this._buildProceduralGrass();
        console.log(`[GolfCourse] ✅  ${this.opt.holeCount}-hole course ready.`);
        return this;
    }

    getHeightAt(x, z) { return this._sampleHeight(x, z); }

    /** موضع الحفرة الأولى (مطابق منطق GolfGame) */
    getHolePosition() {
        const hole = this.holes[0];
        if (!hole) return { x: 0, y: 0, z: 0 };
        const { x, z } = hole.holePos;
        return { x, y: this.getHeightAt(x, z), z };
    }

    /** موضع الإرسال للحفرة الأولى */
    getTeePosition() {
        const hole = this.holes[0];
        if (!hole) return { x: 0, z: -41 };
        return {
            x: hole.teePos.x,
            z: hole.teePos.z - 5,
        };
    }

    getNormalAt(x, z, eps = 0.4) {
        const h0 = this._sampleHeight(x, z);
        const hx = this._sampleHeight(x + eps, z);
        const hz = this._sampleHeight(x, z + eps);
        return new THREE.Vector3(-(hx - h0) / eps, 1, -(hz - h0) / eps).normalize();
    }

    getZoneAt(x, z) {
        const { width, depth } = this.opt;
        if (Math.abs(x) > width / 2 || Math.abs(z) > depth / 2) return ZONE.OUT;
        for (const w of this._waterAreas) {
            const dx = x - w.x, dz = z - w.z;
            if (dx * dx + dz * dz < w.r * w.r) return ZONE.WATER;
        }
        const nx = x / width + 0.5;
        const nz = z / depth + 0.5;
        for (const hole of this.holes) {
            const dgx = x - hole.holePos.x, dgz = z - hole.holePos.z;
            if (dgx * dgx + dgz * dgz < hole.greenR * hole.greenR) return ZONE.GREEN;
            const dtx = x - hole.teePos.x, dtz = z - hole.teePos.z;
            if (dtx * dtx + dtz * dtz < 9) return ZONE.TEE;
            for (const b of hole.bunkers) {
                const dbx = x - b.x, dbz = z - b.z;
                if (dbx * dbx + dbz * dbz < (b.r ?? 5) ** 2) return ZONE.BUNKER;
            }
            if (this._fairwayMask(nx, nz, hole) > 0.05) return ZONE.FAIRWAY;
        }
        return ZONE.ROUGH;
    }

    update(elapsedTime) {
        if (this._grassMesh?.material?.uniforms) {
            this._grassMesh.material.uniforms.uTime.value = elapsedTime;
        }
        const wt = this._textures.water;
        if (wt) wt.offset.x = elapsedTime * 0.02;
        for (const wm of this._waterMeshes) {
            if (!this._textures.water) {
                const s = Math.sin(elapsedTime * 0.9) * 0.04;
                wm.material.color.setRGB(0.15 + s, 0.43 + s, 0.68);
            }
        }
        for (const flag of this._flagMeshes) {
            flag.rotation.y = Math.sin(elapsedTime * 3.1 + flag.userData.phase) * 0.18;
        }
    }

    dispose() {
        this._group.traverse(obj => {
            obj.geometry?.dispose();
            if (obj.material) {
                (Array.isArray(obj.material) ? obj.material : [obj.material])
                    .forEach(m => m.dispose());
            }
        });
        Object.values(this._textures).forEach(t => t?.dispose());
        this.scene.remove(this._group);
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE — textures
    // ═══════════════════════════════════════════════════════
    _loadTex(path, repeat = this.opt.textureRepeat) {
        if (!path) return Promise.resolve(null);
        return new Promise(resolve => {
            this._loader.load(path, tex => {
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(repeat, repeat);
                tex.anisotropy = 8;
                tex.colorSpace = THREE.SRGBColorSpace;
                resolve(tex);
            }, undefined, err => {
                console.warn(`[GolfCourse] Texture failed: ${path}`, err.message);
                resolve(null);
            });
        });
    }

    _loadLinearTex(path, repeat = this.opt.textureRepeat) {
        if (!path) return Promise.resolve(null);
        return new Promise(resolve => {
            this._loader.load(path, tex => {
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(repeat, repeat);
                tex.anisotropy = 8;
                resolve(tex);
            }, undefined, err => {
                console.warn(`[GolfCourse] Texture failed: ${path}`, err.message);
                resolve(null);
            });
        });
    }

    async _loadTextures() {
        const o = this.opt;
        const [grass, grassNorm, grassRough, rough, fairway, green, sand, water] =
            await Promise.all([
                this._loadTex(o.grassTexturePath),
                this._loadLinearTex(o.grassNormalPath),
                this._loadLinearTex(o.grassRoughPath),
                this._loadTex(o.roughTexturePath),
                this._loadTex(o.fairwayTexturePath),
                this._loadTex(o.greenTexturePath),
                this._loadTex(o.sandTexturePath),
                this._loadTex(o.waterTexturePath, 4),
            ]);
        this._textures = { grass, grassNorm, grassRough, rough, fairway, green, sand, water };
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE — hole layouts
    // ═══════════════════════════════════════════════════════
    _buildHoleLayouts() {
        this.holes = [];
        for (let i = 0; i < this.opt.holeCount; i++) {
            this.holes.push(new HoleLayout(i, this.opt.width, this.opt.depth, this.opt.holeCount));
        }
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE — heightmap
    // ═══════════════════════════════════════════════════════
    _buildHeightmap() {
        const { width, depth, segments, maxHeight } = this.opt;
        const W = segments + 1, D = segments + 1;
        this._heightData = new Float32Array(W * D);
        for (let iz = 0; iz < D; iz++) {
            for (let ix = 0; ix < W; ix++) {
                const nx = ix / segments, nz = iz / segments;
                const sx = (nx - 0.5) * 4.0, sz = (nz - 0.5) * 6.0;
                let h = this._noise.fbm(sx, sz, 6, 2.0, 0.48);
                let maxFairway = 0, maxGreen = 0;
                for (const hole of this.holes) {
                    maxFairway = Math.max(maxFairway, this._fairwayMask(nx, nz, hole));
                    maxGreen   = Math.max(maxGreen,   this._greenMaskNorm(nx, nz, hole));
                }
                h *= (1 - maxFairway * 0.88);
                h *= (1 - maxGreen   * 0.97);
                this._heightData[iz * W + ix] = h * maxHeight;
            }
        }
    }

    _fairwayMask(nx, nz, hole) {
        const { width, depth } = this.opt;
        const wx = (nx - 0.5) * width, wz = (nz - 0.5) * depth;
        const tx = hole.teePos.x,  tz = hole.teePos.z;
        const hx = hole.holePos.x, hz = hole.holePos.z;
        const len2 = (hx - tx) ** 2 + (hz - tz) ** 2;
        if (len2 < 1) return 0;
        const t   = Math.max(0, Math.min(1, ((wx - tx) * (hx - tx) + (wz - tz) * (hz - tz)) / len2));
        const cx  = tx + t * (hx - tx), cz = tz + t * (hz - tz);
        const dist = Math.sqrt((wx - cx) ** 2 + (wz - cz) ** 2);
        const halfW = hole.fairwayHW * width * (0.9 + 0.2 * Math.sin(t * Math.PI * 3));
        return Math.max(0, 1 - dist / halfW);
    }

    _greenMaskNorm(nx, nz, hole) {
        const { width, depth } = this.opt;
        const wx = (nx - 0.5) * width, wz = (nz - 0.5) * depth;
        const dist = Math.sqrt((wx - hole.holePos.x) ** 2 + (wz - hole.holePos.z) ** 2);
        return Math.max(0, 1 - dist / hole.greenR);
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE — terrain mesh
    //  FIX: when texture is present, do NOT use vertexColors
    //  (vertex colors multiplied onto texture = dark/light patches)
    //  Instead use a single flat color so texture looks uniform.
    // ═══════════════════════════════════════════════════════
    _buildTerrainMesh() {
        const { width, depth, segments } = this.opt;
        const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
        geo.rotateX(-Math.PI / 2);

        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            pos.setY(i, this._heightData[i]);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();

        const tx = this._textures;
        let mat;

        if (tx.grass) {
        mat = new THREE.MeshStandardMaterial({
            map: tx.grass,
            roughness: 0.85,
            metalness: 0.0,
        });
    } else {
        mat = new THREE.MeshStandardMaterial({
            color: 0x2f7a2b,  // أخضر عشب بسيط
            roughness: 0.95,
            metalness: 0.0,
        });
    }

        this.terrainMesh = new THREE.Mesh(geo, mat);
        this.terrainMesh.receiveShadow = true;
        this.terrainMesh.name = 'TerrainMesh';
        this._group.add(this.terrainMesh);
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE — fairway overlays
    // ═══════════════════════════════════════════════════════
    _buildFairwayOverlays() {
        for (const hole of this.holes) {
            this._buildFairwayOverlay(hole);
        }
    }

    _buildFairwayOverlay(hole) {
        const { width, depth } = this.opt;
        const tx  = hole.teePos.x,  tz  = hole.teePos.z;
        const hx  = hole.holePos.x, hz  = hole.holePos.z;
        const len = Math.sqrt((hx - tx) ** 2 + (hz - tz) ** 2);
        const fwW = hole.fairwayHW * width * 2;

        const geo = new THREE.PlaneGeometry(fwW, len, 2, 30);
        geo.rotateX(-Math.PI / 2);
        geo.rotateY(Math.atan2(hx - tx, hz - tz));

        const cx = (tx + hx) / 2;
        const cz = (tz + hz) / 2;
        const posAttr = geo.attributes.position;

        for (let i = 0; i < posAttr.count; i++) {
            const wx = posAttr.getX(i) + cx;
            const wz = posAttr.getZ(i) + cz;
            posAttr.setY(i, this._sampleHeight(wx, wz) + 0.02);
        }
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();

        let mat;
        if (this._textures.fairway) {
            const ftex = this._textures.fairway.clone();
            ftex.needsUpdate = true;
            ftex.repeat.set(fwW / 8, len / 8);
            mat = new THREE.MeshStandardMaterial({
                map               : ftex,
                roughness         : 0.80,
                metalness         : 0.0,
                transparent       : true,
                opacity           : 0.1,
                depthWrite        : false,
                polygonOffset     : true,
                polygonOffsetFactor: -2,
                polygonOffsetUnits : -2,
            });
        } else {
            mat = new THREE.MeshStandardMaterial({
                color             :0x3aad35,
                roughness         : 0.82,
                metalness         : 0.0,
                transparent       : true,
                opacity           : 0,
                depthWrite        : false,
                polygonOffset     : true,
                polygonOffsetFactor: -2,
                polygonOffsetUnits : -2,
            });
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx, 0, cz);
        mesh.receiveShadow = true;
        mesh.name = `FairwayOverlay_${hole.index}`;
        this._group.add(mesh);
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE — bunkers
    // ═══════════════════════════════════════════════════════
    _buildBunkers() {
        for (const hole of this.holes) {
            for (const b of hole.bunkers) {
                const r = 4 + Math.random() * 2;
                b.r = r;
                const segs = 24;
                const bGeo = new THREE.BufferGeometry();
                const positions = [], uvs = [], indices = [];
                const bx = b.x, bz = b.z;
                const by = this._sampleHeight(bx, bz) + 0.04;
                positions.push(bx, by, bz);
                uvs.push(0.5, 0.5);
                for (let i = 0; i <= segs; i++) {
                    const angle = (i / segs) * Math.PI * 2;
                    const ex = bx + Math.cos(angle) * r;
                    const ez = bz + Math.sin(angle) * r;
                    const ey = this._sampleHeight(ex, ez) + 0.04;
                    positions.push(ex, ey, ez);
                    uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
                }
                for (let i = 1; i <= segs; i++) indices.push(0, i, i + 1);
                bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
                bGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
                bGeo.setIndex(indices);
                bGeo.computeVertexNormals();

                let mat;
                if (this._textures.sand) {
                    const stex = this._textures.sand.clone();
                    stex.needsUpdate = true;
                    stex.repeat.set(r / 2, r / 2);
                    mat = new THREE.MeshStandardMaterial({ map: stex, roughness: 0.97, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
                } else {
                    mat = new THREE.MeshStandardMaterial({ color: 0xd6bc84, roughness: 0.97, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
                }
                const mesh = new THREE.Mesh(bGeo, mat);
                mesh.receiveShadow = true;
                mesh.name = `Bunker_${hole.index}`;
                this._group.add(mesh);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE — water
    // ═══════════════════════════════════════════════════════
    _buildWaterAreas() {
        const waterConfig = [
            { x:  22, z: -40, rx: 14, rz: 9 },
            { x: -18, z:  50, rx: 10, rz: 7 },
        ];
        for (const w of waterConfig) {
            if (Math.abs(w.z) > this.opt.depth / 2) continue;
            const geo = new THREE.PlaneGeometry(w.rx * 2, w.rz * 2, 4, 4);
            geo.rotateX(-Math.PI / 2);
            let mat;
            if (this._textures.water) {
                const wtex = this._textures.water.clone();
                wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping;
                wtex.repeat.set(4, 4);
                wtex.needsUpdate = true;
                this._textures.water = wtex;
                mat = new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.88 });
            } else {
                mat = new THREE.MeshStandardMaterial({ color: 0x2a6ea6, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.84 });
            }
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(w.x, this._sampleHeight(w.x, w.z) - 0.1, w.z);
            mesh.receiveShadow = true;
            mesh.name = 'WaterHazard';
            this._group.add(mesh);
            this._waterMeshes.push(mesh);
            this._waterAreas.push({ x: w.x, z: w.z, r: (w.rx + w.rz) / 2 });
        }
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE — hole objects
    // ═══════════════════════════════════════════════════════
    _buildAllHoleObjects() {
        for (const hole of this.holes) this._buildHoleObject(hole);
    }

    _buildHoleObject(hole) {
        const { holePos, teePos } = hole;
        const hy = this._sampleHeight(holePos.x, holePos.z);
        const ty = this._sampleHeight(teePos.x,  teePos.z);

        // Cup flush with terrain
        const cup = new THREE.Mesh(
            new THREE.CylinderGeometry(0.27, 0.24, 0.20, 20),
            new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.9, metalness: 0.1 })
        );
        cup.position.set(holePos.x, hy, holePos.z);
        this._group.add(cup);

        // Flag pole
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.022, 0.002, 2.8, 8),
            new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 })
        );
        pole.position.set(holePos.x, hy + 1.4, holePos.z);
        this._group.add(pole);

        // Flag
        const flag = new THREE.Mesh(
            new THREE.PlaneGeometry(0.7, 0.45),
            new THREE.MeshStandardMaterial({ color: 0xff2200, side: THREE.DoubleSide })
        );
        flag.position.set(holePos.x + 0.35, hy + 2.6, holePos.z);
        flag.userData.phase = hole.index * 1.2;
        this._group.add(flag);
        this._flagMeshes.push(flag);
       
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE — grass blades
    // ═══════════════════════════════════════════════════════
    _buildProceduralGrass() {
        const count = this.opt.grassCount;
        const BW = 0.055, BH = 0.42;

        const verts = new Float32Array([
            -BW / 2, 0,        0,
             BW / 2, 0,        0,
            -BW / 3, BH / 3,   0,
             BW / 3, BH / 3,   0,
            -BW / 6, BH * 0.7, 0,
             BW / 6, BH * 0.7, 0,
             0,      BH,       0,
        ]);
        const uvs = new Float32Array([
            0, 0,    1, 0,
            0, 0.33, 1, 0.33,
            0, 0.7,  1, 0.7,
            0.5, 1,
        ]);
        const idx = [0,1,2, 1,3,2, 2,3,4, 3,5,4, 4,5,6];

        const bladeGeo = new THREE.BufferGeometry();
        bladeGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        bladeGeo.setAttribute('uv',       new THREE.BufferAttribute(uvs,   2));
        bladeGeo.setIndex(idx);
        bladeGeo.computeVertexNormals();

        const offsets = new Float32Array(count * 3);
        const rotArr  = new Float32Array(count);
        const sclArr  = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const { x, z } = this._roughGrassPos();
            offsets[i * 3]     = x;
            offsets[i * 3 + 1] = this._sampleHeight(x, z);
            offsets[i * 3 + 2] = z;
            rotArr[i] = Math.random() * Math.PI * 2;
            sclArr[i] = 0.6 + Math.random() * 1.0;
        }

        const instGeo = new THREE.InstancedBufferGeometry();
        instGeo.index = bladeGeo.index;
        instGeo.setAttribute('position', bladeGeo.attributes.position);
        instGeo.setAttribute('normal',   bladeGeo.attributes.normal);
        instGeo.setAttribute('uv',       bladeGeo.attributes.uv);
        instGeo.setAttribute('aOffset',  new THREE.InstancedBufferAttribute(offsets, 3));
        instGeo.setAttribute('aRot',     new THREE.InstancedBufferAttribute(rotArr,  1));
        instGeo.setAttribute('aScale',   new THREE.InstancedBufferAttribute(sclArr,  1));
        instGeo.instanceCount = count;

        const hasGrassTex = !!this._textures.grass;

        const mat = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            uniforms: {
                uTime    : { value: 0 },
                uWindDir : { value: new THREE.Vector2(1.0, 0.6) },
                uColorLo : { value: new THREE.Color(0x1e5010) },
                uColorHi : { value: new THREE.Color(0x5dba28) },
                uGrassTex: { value: this._textures.grass ?? null },
                uHasTex  : { value: hasGrassTex ? 1.0 : 0.0 },
            },
            vertexShader: /* glsl */`
                attribute vec3  aOffset;
                attribute float aRot;
                attribute float aScale;
                uniform float   uTime;
                uniform vec2    uWindDir;
                varying float   vT;
                varying vec2    vUv;
                void main() {
                    float s = sin(aRot), c = cos(aRot);
                    vec3 p  = position;
                    vec3 rp = vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z);
                    rp *= aScale;
                    float tNorm = rp.y / (0.42 * aScale);
                    float wave  = sin(uTime * 2.2 + aOffset.x * 0.35 + aOffset.z * 0.28);
                    float gust  = sin(uTime * 0.7 + aOffset.z * 0.12) * 0.5;
                    float sway  = (wave + gust) * tNorm * 0.10;
                    rp.x += sway * uWindDir.x;
                    rp.z += sway * uWindDir.y;
                    vT   = tNorm;
                    vUv  = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(rp + aOffset, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                uniform vec3      uColorLo;
                uniform vec3      uColorHi;
                uniform sampler2D uGrassTex;
                uniform float     uHasTex;
                varying float     vT;
                varying vec2      vUv;
                void main() {
                    vec3 col;
                    if (uHasTex > 0.5) {
                        vec4 texCol = texture2D(uGrassTex, vUv);
                        vec3 tint   = mix(uColorLo, uColorHi, vT);
                        col = texCol.rgb * tint * 1.6;
                    } else {
                        col = mix(uColorLo, uColorHi, vT);
                    }
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });

        const mesh = new THREE.Mesh(instGeo, mat);
        mesh.frustumCulled = false;
        mesh.name = 'GrassBlades';
        this._group.add(mesh);
        this._grassMesh = mesh;
    }

    // ═══════════════════════════════════════════════════════
    //  PRIVATE — height sampling
    // ═══════════════════════════════════════════════════════
    _sampleHeight(wx, wz) {
        const { width, depth, segments } = this.opt;
        const nx  = Math.max(0, Math.min(1, wx / width + 0.5));
        const nz  = Math.max(0, Math.min(1, wz / depth + 0.5));
        const W   = segments + 1;
        const fx  = nx * segments, fz = nz * segments;
        const ix  = Math.floor(fx),  iz = Math.floor(fz);
        const tx  = fx - ix,         tz = fz - iz;
        const ix1 = Math.min(ix + 1, segments);
        const iz1 = Math.min(iz + 1, segments);
        const h00 = this._heightData[ iz  * W + ix  ] ?? 0;
        const h10 = this._heightData[ iz  * W + ix1 ] ?? 0;
        const h01 = this._heightData[ iz1 * W + ix  ] ?? 0;
        const h11 = this._heightData[ iz1 * W + ix1 ] ?? 0;
        return h00*(1-tx)*(1-tz) + h10*tx*(1-tz) + h01*(1-tx)*tz + h11*tx*tz;
    }

    _roughGrassPos() {
        const { width, depth } = this.opt;
        for (let tries = 0; tries < 40; tries++) {
            const x = (Math.random() - 0.5) * width;
            const z = (Math.random() - 0.5) * depth;
            const nx = x / width + 0.5, nz = z / depth + 0.5;
            let maxFair = 0, maxGreen = 0;
            for (const hole of this.holes) {
                maxFair  = Math.max(maxFair,  this._fairwayMask(nx, nz, hole));
                maxGreen = Math.max(maxGreen, this._greenMaskNorm(nx, nz, hole));
            }
            if (maxFair < 0.25 && maxGreen < 0.05) return { x, z };
        }
        return { x: (Math.random() - 0.5) * width, z: (Math.random() - 0.5) * depth };
    }
}