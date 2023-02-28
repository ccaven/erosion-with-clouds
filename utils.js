import * as THREE from './three.module.js';
import perlin from './noise.js';

perlin.reset();

const gaussianKernel5x5 = [
    1, 4, 7, 4, 1,
    4, 16, 26, 16, 4,
    7, 26, 41, 26, 7,
    4, 16, 26, 16, 4,
    1, 4, 7, 4, 1
];
const gaussianKernel5x5Scale = 1.0 / 273.0;

export class Float32Array2D {
    constructor (width, height) {
        this.data = new Float32Array(width * height);
        this.width = width;
        this.height = height;
    }

    set(x, y, value) {
        this.data[x + y * this.width] = value;
    }

    get(x, y) {
        if (x == this.width) x -= 1;
        if (x == -1) x += 1;
        if (y == this.height) y -= 1;
        if (y == -1) y += 1;
        return this.data[x + y * this.width];
    }

    fill(value) {
        this.data.fill(value);
    }

    /** @param {Function} callback */
    forEach(callback) {
        let x = 0, y = 0;
        for (let i = 0; i < this.data.length; i ++) {
            
            this.data[i] = callback(x, y);

            if (++x >= this.width) {
                y++;
                x = 0;
            }
        }
    }

    /** @param {WebGLRenderingContext} gl */
    toWebGLTexture(gl) {}

    toBufferGeometry(lateralScale, verticalScale) {
        // create triangles/indices buffers
        // Y UP
        
        let positions = new Float32Array(this.width * this.height * 3);
        let uvs = new Float32Array(this.width * this.height * 2);
        let indices = [];
        

        // add vertices
        for (let y = 0; y < this.height; y ++) {
            for (let x = 0; x < this.width; x ++) {
                let l = (x + y * this.width) * 3;
                positions[l + 0] = (x - this.width / 2) / this.width * 2 * lateralScale;
                positions[l + 1] = this.get(x, y) * verticalScale;
                positions[l + 2] = (y - this.height / 2) / this.height * 2 * lateralScale;
            }
        }

        // add normals
        // TODO: correct normal calculation
        // let normals = new Float32Array(this.width * this.height * 3);
        // for (let y = 0; y < this.height; y ++) {
        //     for (let x = 0; x < this.height; x ++) {
        //         let l = (x + y * this.width) * 3;
        //         normals[l + 0] = 0;
        //         normals[l + 1] = 1;
        //         normals[l + 2] = 0;
        //     }
        // }
        
        // add indices
        for (let y = 0; y < this.height - 1; y ++) {
            for (let x = 0; x < this.width - 1; x ++) {
                let l = (x + y * (this.width - 1)) * 6;
                
                let i00 = x + y * this.width;
                let i10 = i00 + 1;
                let i01 = i00 + this.width;
                let i11 = i10 + this.width; 

                // TODO: check winding order
                // first triangle
                indices[l + 0] = i10;
                indices[l + 1] = i01;
                indices[l + 2] = i11;

                // second triangle
                indices[l + 3] = i01;
                indices[l + 4] = i10;
                indices[l + 5] = i00;
            }
        }

        const positionAttribute = new THREE.BufferAttribute(positions, 3);
        positionAttribute.set

        const uvAttribute = new THREE.BufferAttribute(uvs, 2);
        // const normalAttribute = new THREE.BufferAttribute(normals, 3);

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute('position', positionAttribute);
        geometry.setAttribute('uv', uvAttribute);
        geometry.setIndex(indices);

        //geometry.setAttribute('normal', normalAttribute);
        geometry.computeVertexNormals();

        return geometry;
    }

    toEdgesGeometry(lateralScale, verticalScale, bottomValue=-1.0) {
        const positions = [], indices = [], uv = [];

        // neg-y edge
        let x = 0, y = 0;
        for (x = 0; x < this.width; x ++) {
            positions.push(
                (x - this.width / 2) / this.width * 2 * lateralScale,
                this.get(x, y) * verticalScale,
                (y - this.height / 2) / this.height * 2 * lateralScale
            );
        }
        for (x = 0; x < this.width; x ++) {
            positions.push(
                (x - this.width / 2) / this.width * 2 * lateralScale,
                bottomValue * verticalScale,
                (y - this.height / 2) / this.height * 2 * lateralScale
            );
        }

        for (let j = 0; j < this.width - 1; j ++) {
            let i = j + 0;
            indices.push(
                i + this.width + 1, i, i + 1,
                i, i + this.width + 1, i + this.width
            );
        }

        // pos-y side
        y = this.height - 1;
        for (x = 0; x < this.width; x ++) {
            positions.push(
                (x - this.width / 2) / this.width * 2 * lateralScale,
                this.get(x, y) * verticalScale,
                (y - this.height / 2) / this.height * 2 * lateralScale
            );
        }
        for (x = 0; x < this.width; x ++) {
            positions.push(
                (x - this.width / 2) / this.width * 2 * lateralScale,
                bottomValue * verticalScale,
                (y - this.height / 2) / this.height * 2 * lateralScale
            );
        }

        for (let j = 0; j < this.width - 1; j ++) {
            let i = j + this.width * 2;
            indices.push(
                i, i + this.width + 1, i + 1,
                i + this.width + 1,i,  i + this.width
            );
        }

        // neg-x side
        x = 0;
        for (y = 0; y < this.height; y ++) {
            positions.push(
                (x - this.width / 2) / this.width * 2 * lateralScale,
                this.get(x, y) * verticalScale,
                (y - this.height / 2) / this.height * 2 * lateralScale
            );
        }
        for (y = 0; y < this.height; y ++) {
            positions.push(
                (x - this.width / 2) / this.width * 2 * lateralScale,
                bottomValue * verticalScale,
                (y - this.height / 2) / this.height * 2 * lateralScale
            );
        }

        for (let j = 0; j < this.height - 1; j ++) {
            let i = j + this.width * 4;
            indices.push(
                i, i + this.width + 1, i + 1,
                i + this.width + 1, i, i + this.width
            );
        }

        // pos-x side
        x = this.width - 1;
        for (y = 0; y < this.height; y ++) {
            positions.push(
                (x - this.width / 2) / this.width * 2 * lateralScale,
                this.get(x, y) * verticalScale,
                (y - this.height / 2) / this.height * 2 * lateralScale
            );
        }
        for (y = 0; y < this.height; y ++) {
            positions.push(
                (x - this.width / 2) / this.width * 2 * lateralScale,
                bottomValue * verticalScale,
                (y - this.height / 2) / this.height * 2 * lateralScale
            );
        }

        for (let j = 0; j < this.height - 1; j ++) {
            let i = j + this.width * 4 + this.height * 2;
            indices.push(
                i + this.width + 1, i, i + 1,
                i, i + this.width + 1, i + this.width
            );
        }

        // bottom two triangles
        indices.push(
            this.width * 3, this.width, this.width * 2 - 1,
            this.width * 3, this.width * 2 - 1, this.width * 4 + this.height * 4 - 1
        );

        const positionAttribute = new THREE.BufferAttribute(new Float32Array(positions), 3);
        const uvAttribute = new THREE.BufferAttribute(new Float32Array(positions.length / 3 * 2), 2);
        const normalAttribute = new THREE.BufferAttribute(new Float32Array(positions.length), 3);

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute('position', positionAttribute);
        geometry.setAttribute('uv', uvAttribute);
        geometry.setAttribute('normal', normalAttribute);
        geometry.setIndex(indices);

        geometry.computeVertexNormals();

        console.log(geometry);

        return geometry;
    }

    /**
     * 
     * @param {THREE.BufferAttribute} positionAttribute 
     * @param {number} verticalScale 
     */
    updateBufferAttribute(positionAttribute, verticalScale) {
        for (let y = 0; y < this.height; y ++) {
            for (let x = 0; x < this.width; x ++) {
                let l = x + y * this.width;
                positionAttribute.array[l * 3 + 1] = (this.data[l] || 0) * verticalScale;
                // console.log(positionAttribute.array[l * 3 + 1])
                // positionAttribute.setY(l, this.get(x, y) * verticalScale);
            }
        }

        positionAttribute.needsUpdate = true;
    }

    getInterpolated(i, j) {
        /*
        const i0 = Math.floor(i);
        const i1 = Math.ceil(i);
        const t = i - i0;

        const j0 = Math.floor(j);
        const j1 = Math.ceil(j);
        const k = j - j0;

        
        return (this.get(i0, j0) * (1 - t) + this.get(i1, j0) * t) * (1 - k) + 
               (this.get(i0, j1) * (1 - t) + this.get(i1, j1) * t) * k
        */
        const _i = Math.floor(i);
        const _j = Math.floor(j);

        const t = i - _i;
        const k = j - _j;

        let l = Math.floor(i) + Math.floor(j) * this.width;

        return this.get(_i, _j) * (1 - t) * (1 - k) +
               this.get(_i + 1, _j) * t * (1 - k) +
               this.get(_i, _j + 1) * (1 - t) * k +
               this.get(_i + 1, _j + 1) * t * k;

    }

    addInterpolated(i, j, v) {

        let t = i - Math.floor(i) * 1.0;
        let k = j - Math.floor(j) * 1.0;

        let l = Math.floor(i) + Math.floor(j) * this.width;

        this.data[l] += v * (1 - t) * (1 - k);
        this.data[l + 1] += v * t * (1 - k);
        this.data[l + this.width] += v * (1 - t) * k;
        this.data[l + this.width + 1] += v * t * k;

    }

    addGaussian(cx, cy, v) {
        v *= gaussianKernel5x5Scale;
        for (let dx = -2; dx <= 2; dx ++) {
            for (let dy = -2; dy <= 2; dy ++) {
                this.addInterpolated(
                    cx + dx, 
                    cy + dy, 
                    gaussianKernel5x5[dx + 2 + (dy + 2) * 5] * v)
            }
        }
    }

    calculateGradient(i, j) {

        const x = (this.getInterpolated(i + 0.01, j) - this.getInterpolated(i - 0.01, j)) / 0.02;
        const y = (this.getInterpolated(i, j + 0.01) - this.getInterpolated(i, j - 0.01)) / 0.02;

        return { x, y };

    }

    /**
     * @param {HTMLCanvasElement} canvasTag 
     */
    toImage(canvasTag) {
        
        
        let ctx = canvasTag.getContext('2d');

        let imageData = new ImageData(this.width, this.height);

        for (let x = 0; x < this.width; x ++) {
            for (let y = 0; y < this.height; y ++) {
                let l = x + y * this.width << 2;
                let k = x + y * this.width;
                imageData.data[l + 0] = this.data[k] * 128 + 128 | 0;
                imageData.data[l + 1] = this.data[k] * 128 + 128 | 0;
                imageData.data[l + 2] = this.data[k] * 128 + 128 | 0;
                imageData.data[l + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);

    }
}

export function createNoiseTexture(width, height, density, octaves) {
    const arr = new Float32Array2D(width, height);
    const invDensity = 1.0 / density;
    if (octaves == 1) {
        arr.forEach((x, y) => {
            x *= invDensity;
            y *= invDensity;
            return perlin.get(x, y);
        });
    } else {
        arr.forEach((x, y) => {

            x *= invDensity;
            y *= invDensity;

            let v = 0;
            let octaveScale = 0.5;
            let pointScale = 1.0;

            for (let octave = 0; octave < octaves; octave ++) {
                v += octaveScale * perlin.get(x * pointScale, y * pointScale);
                octaveScale *= 0.5;
                pointScale *= 2.0;
            }

            return v;

        });
    }

    return arr;
}
