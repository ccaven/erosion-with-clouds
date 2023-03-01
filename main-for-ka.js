
import * as THREE from "https://cdn.jsdelivr.net/gh/ccaven/erosion-with-clouds@2b087a5/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/gh/ccaven/erosion-with-clouds@2b087a5/addons/OrbitControls.js";

function main() {
    const perlin = {
        rand_vect() {
            let theta = Math.random() * 2 * Math.PI;
            return {
                x: Math.cos(theta),
                y: Math.sin(theta),
            };
        },
        dot_prod_grid(x, y, vx, vy) {
            let g_vect;
            let d_vect = { x: x - vx, y: y - vy };
            if (this.gradients[[vx, vy]]) {
                g_vect = this.gradients[[vx, vy]];
            } else {
                g_vect = this.rand_vect();
                this.gradients[[vx, vy]] = g_vect;
            }
            return d_vect.x * g_vect.x + d_vect.y * g_vect.y;
        },
        smootherstep(x) {
            return 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
        },
        interp(x, a, b) {
            return a + this.smootherstep(x) * (b - a);
        },
        reset() {
            this.gradients = {};
            this.memory = {};
        },
        get: function (x, y) {
            if (this.memory.hasOwnProperty([x, y])) return this.memory[[x, y]];
            let xf = Math.floor(x);
            let yf = Math.floor(y);
            //interpolate
            let tl = this.dot_prod_grid(x, y, xf, yf);
            let tr = this.dot_prod_grid(x, y, xf + 1, yf);
            let bl = this.dot_prod_grid(x, y, xf, yf + 1);
            let br = this.dot_prod_grid(x, y, xf + 1, yf + 1);
            let xt = this.interp(x - xf, tl, tr);
            let xb = this.interp(x - xf, bl, br);
            let v = this.interp(y - yf, xt, xb);
            this.memory[[x, y]] = v;
            return v;
        },
    };

    perlin.reset();

    const gaussianKernel5x5 = [
        1, 4, 7, 4, 1, 4, 16, 26, 16, 4, 7, 26, 41, 26, 7, 4, 16, 26, 16, 4, 1,
        4, 7, 4, 1,
    ];
    const gaussianKernel5x5Scale = 1.0 / 273.0;

    class Float32Array2D {
        constructor(width, height) {
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
            let x = 0,
                y = 0;
            for (let i = 0; i < this.data.length; i++) {
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
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let l = (x + y * this.width) * 3;
                    positions[l + 0] =
                        ((x - this.width / 2) / this.width) * 2 * lateralScale;
                    positions[l + 1] = this.get(x, y) * verticalScale;
                    positions[l + 2] =
                        ((y - this.height / 2) / this.height) *
                        2 *
                        lateralScale;
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
            for (let y = 0; y < this.height - 1; y++) {
                for (let x = 0; x < this.width - 1; x++) {
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
            positionAttribute.set;

            const uvAttribute = new THREE.BufferAttribute(uvs, 2);
            // const normalAttribute = new THREE.BufferAttribute(normals, 3);

            const geometry = new THREE.BufferGeometry();

            geometry.setAttribute("position", positionAttribute);
            geometry.setAttribute("uv", uvAttribute);
            geometry.setIndex(indices);

            //geometry.setAttribute('normal', normalAttribute);
            geometry.computeVertexNormals();

            return geometry;
        }

        toEdgesGeometry(lateralScale, verticalScale, bottomValue = -1.0) {
            const positions = [],
                indices = [],
                uv = [];

            // neg-y edge
            let x = 0,
                y = 0;
            for (x = 0; x < this.width; x++) {
                positions.push(
                    ((x - this.width / 2) / this.width) * 2 * lateralScale,
                    this.get(x, y) * verticalScale,
                    ((y - this.height / 2) / this.height) * 2 * lateralScale
                );
            }
            for (x = 0; x < this.width; x++) {
                positions.push(
                    ((x - this.width / 2) / this.width) * 2 * lateralScale,
                    bottomValue * verticalScale,
                    ((y - this.height / 2) / this.height) * 2 * lateralScale
                );
            }

            for (let j = 0; j < this.width - 1; j++) {
                let i = j + 0;
                indices.push(
                    i + this.width + 1,
                    i,
                    i + 1,
                    i,
                    i + this.width + 1,
                    i + this.width
                );
            }

            // pos-y side
            y = this.height - 1;
            for (x = 0; x < this.width; x++) {
                positions.push(
                    ((x - this.width / 2) / this.width) * 2 * lateralScale,
                    this.get(x, y) * verticalScale,
                    ((y - this.height / 2) / this.height) * 2 * lateralScale
                );
            }
            for (x = 0; x < this.width; x++) {
                positions.push(
                    ((x - this.width / 2) / this.width) * 2 * lateralScale,
                    bottomValue * verticalScale,
                    ((y - this.height / 2) / this.height) * 2 * lateralScale
                );
            }

            for (let j = 0; j < this.width - 1; j++) {
                let i = j + this.width * 2;
                indices.push(
                    i,
                    i + this.width + 1,
                    i + 1,
                    i + this.width + 1,
                    i,
                    i + this.width
                );
            }

            // neg-x side
            x = 0;
            for (y = 0; y < this.height; y++) {
                positions.push(
                    ((x - this.width / 2) / this.width) * 2 * lateralScale,
                    this.get(x, y) * verticalScale,
                    ((y - this.height / 2) / this.height) * 2 * lateralScale
                );
            }
            for (y = 0; y < this.height; y++) {
                positions.push(
                    ((x - this.width / 2) / this.width) * 2 * lateralScale,
                    bottomValue * verticalScale,
                    ((y - this.height / 2) / this.height) * 2 * lateralScale
                );
            }

            for (let j = 0; j < this.height - 1; j++) {
                let i = j + this.width * 4;
                indices.push(
                    i,
                    i + this.width + 1,
                    i + 1,
                    i + this.width + 1,
                    i,
                    i + this.width
                );
            }

            // pos-x side
            x = this.width - 1;
            for (y = 0; y < this.height; y++) {
                positions.push(
                    ((x - this.width / 2) / this.width) * 2 * lateralScale,
                    this.get(x, y) * verticalScale,
                    ((y - this.height / 2) / this.height) * 2 * lateralScale
                );
            }
            for (y = 0; y < this.height; y++) {
                positions.push(
                    ((x - this.width / 2) / this.width) * 2 * lateralScale,
                    bottomValue * verticalScale,
                    ((y - this.height / 2) / this.height) * 2 * lateralScale
                );
            }

            for (let j = 0; j < this.height - 1; j++) {
                let i = j + this.width * 4 + this.height * 2;
                indices.push(
                    i + this.width + 1,
                    i,
                    i + 1,
                    i,
                    i + this.width + 1,
                    i + this.width
                );
            }

            // bottom two triangles
            indices.push(
                this.width * 3,
                this.width,
                this.width * 2 - 1,
                this.width * 3,
                this.width * 2 - 1,
                this.width * 4 + this.height * 4 - 1
            );

            const positionAttribute = new THREE.BufferAttribute(
                new Float32Array(positions),
                3
            );
            const uvAttribute = new THREE.BufferAttribute(
                new Float32Array((positions.length / 3) * 2),
                2
            );
            const normalAttribute = new THREE.BufferAttribute(
                new Float32Array(positions.length),
                3
            );

            const geometry = new THREE.BufferGeometry();

            geometry.setAttribute("position", positionAttribute);
            geometry.setAttribute("uv", uvAttribute);
            geometry.setAttribute("normal", normalAttribute);
            geometry.setIndex(indices);

            geometry.computeVertexNormals();

            return geometry;
        }

        /**
         *
         * @param {THREE.BufferAttribute} positionAttribute
         * @param {number} verticalScale
         */
        updateBufferAttribute(positionAttribute, verticalScale) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let l = x + y * this.width;
                    positionAttribute.array[l * 3 + 1] =
                        (this.data[l] || 0) * verticalScale;
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

            return (
                this.get(_i, _j) * (1 - t) * (1 - k) +
                this.get(_i + 1, _j) * t * (1 - k) +
                this.get(_i, _j + 1) * (1 - t) * k +
                this.get(_i + 1, _j + 1) * t * k
            );
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
            for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -2; dy <= 2; dy++) {
                    this.addInterpolated(
                        cx + dx,
                        cy + dy,
                        gaussianKernel5x5[dx + 2 + (dy + 2) * 5] * v
                    );
                }
            }
        }

        calculateGradient(i, j) {
            const x =
                (this.getInterpolated(i + 0.01, j) -
                    this.getInterpolated(i - 0.01, j)) /
                0.02;
            const y =
                (this.getInterpolated(i, j + 0.01) -
                    this.getInterpolated(i, j - 0.01)) /
                0.02;

            return { x, y };
        }

        /**
         * @param {HTMLCanvasElement} canvasTag
         */
        toImage(canvasTag) {
            let ctx = canvasTag.getContext("2d");

            let imageData = new ImageData(this.width, this.height);

            for (let x = 0; x < this.width; x++) {
                for (let y = 0; y < this.height; y++) {
                    let l = (x + y * this.width) << 2;
                    let k = x + y * this.width;
                    imageData.data[l + 0] = (this.data[k] * 128 + 128) | 0;
                    imageData.data[l + 1] = (this.data[k] * 128 + 128) | 0;
                    imageData.data[l + 2] = (this.data[k] * 128 + 128) | 0;
                    imageData.data[l + 3] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);
        }
    }

    function createNoiseTexture(width, height, density, octaves) {
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

                for (let octave = 0; octave < octaves; octave++) {
                    v +=
                        octaveScale *
                        perlin.get(x * pointScale, y * pointScale);
                    octaveScale *= 0.5;
                    pointScale *= 2.0;
                }

                return v;
            });
        }

        return arr;
    }

    const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById("three-canvas"),
    });

    const renderTarget = new THREE.WebGLRenderTarget(600, 600);
    renderTarget.depthTexture = new THREE.DepthTexture(
        600,
        600,
        THREE.UnsignedShortType
    );
    renderTarget.depthTexture.format = THREE.DepthFormat;

    // {

    const noise3dglsl = /* glsl */ `
vec3 rotate2D(vec3 p, vec2 t){
    float stx = sin(t.x);
    float ctx = cos(t.x);
    float sty = sin(t.y);
    float cty = cos(t.y);
    mat3 xRotation;
    xRotation[0] = vec3(1, 0, 0);
    xRotation[1] = vec3(0, ctx, -stx);
    xRotation[2] = vec3(0, stx, ctx);
    
    mat3 yRotation;
    yRotation[0] = vec3(cty, 0, -sty);
    yRotation[1] = vec3(0, 1, 0);
    yRotation[2] = vec3(sty, 0, cty);
    return p*xRotation*yRotation;
}

//Dave_Hoskins' Hash Without Sine
float random3(vec3 p){
    p = fract(p*0.1031);
    p += dot(p, p.zyx + 31.32);
    return max(fract((p.x + p.y)*p.z)*2.0 - 1.0, 0.0);
}

float random2(vec2 p){
    p = fract(p*0.1031);
    p += dot(p, p.yx + 31.32);
    return max(fract(p.x + p.y)*2.0 - 1.0, 0.0);
}

float noise3(vec3 p){
    vec3 fc = floor(p);
    vec3 frc = fract(p);
    frc = frc*frc*(3.0 - 2.0*frc);
    
    float tlf = random3(fc + vec3(0, 1, 0));
    float trf = random3(fc + vec3(1, 1, 0));
    float blf = random3(fc + vec3(0, 0, 0));
    float brf = random3(fc + vec3(1, 0, 0));
    float tlb = random3(fc + vec3(0, 1, 1));
    float trb = random3(fc + vec3(1, 1, 1));
    float blb = random3(fc + vec3(0, 0, 1));
    float brb = random3(fc + vec3(1, 0, 1));
    
    float lerpTopFront = mix(tlf, trf, frc.x);
    float lerpBottomFront = mix(blf, brf, frc.x);
    
    float lerpTopBack = mix(tlb, trb, frc.x);
    float lerpBottomBack = mix(blb, brb, frc.x);
    
    float lerpFront = mix(lerpBottomFront, lerpTopFront, frc.y);
    float lerpBack = mix(lerpBottomBack, lerpTopBack, frc.y);
    
    return mix(lerpFront, lerpBack, frc.z);
}

float noise2(vec2 p){
    vec2 fc = floor(p);
    vec2 frc = fract(p);
    frc = frc*frc*(3.0 - 2.0*frc);
    
    float tlf = random2(fc + vec2(0, 1));
    float trf = random2(fc + vec2(1, 1));
    float blf = random2(fc + vec2(0, 0));
    float brf = random2(fc + vec2(1, 0));
    
    float lerpTopFront = mix(tlf, trf, frc.x);
    float lerpBottomFront = mix(blf, brf, frc.x);
    
    return mix(lerpBottomFront, lerpTopFront, frc.y);
}

float fbm(vec3 p){
    float f = 1.0;
    float r = radians(57.0);
    float h = 1.0;
    float n = noise3(p*f)*h;
    for(int i = 0; i < 2; i++){
        f *= 2.0;
        r += radians(57.0);
        h /= 2.0;
        n += noise3(rotate2D(p, vec2(0, r))*f)*h;
    }
    return n/1.0;
}

float fbm2(vec3 p){
    float f = 1.0;
    float r = radians(57.0);
    float h = 1.0;
    float n = noise2(p.xz*f)*h;
    for(int i = 0; i < 4; i++){
        f *= 2.0;
        r += radians(57.0);
        h /= 2.0;
        n += noise2(rotate2D(p, vec2(0, r)).xz*f)*h;
    }
    return n/1.0;
}

`;

    const noiseRenderTarget = new THREE.WebGLRenderTarget(1024, 1024);
    const renderNoise = (() => {
        noiseRenderTarget.texture.magFilter = THREE.NearestFilter;

        const planeGeometry = new THREE.PlaneGeometry(5.0, 5.0);
        const camera = new THREE.OrthographicCamera(-1, 1, -1, 1, -1, 1);

        const scene = new THREE.Scene();

        const planeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                iTime: { value: 0 },
            },

            vertexShader: /* glsl */ `
            void main() {
                gl_Position = vec4(position, 1.0);
            }
        `,
            fragmentShader: /* glsl */ `
            uniform float iTime;

            ${noise3dglsl}

            void main() {
                int x = int(gl_FragCoord.x) % 128;
                int y = int(gl_FragCoord.y) % 128;

                int z1 = int(gl_FragCoord.x) / 128;
                int z2 = int(gl_FragCoord.y) / 128;

                int z = z1 + z2 * 8;

                vec3 p = vec3(x, y, z) / 128.0 - 0.5;

                p *= vec3(8.0, 8.0, 8.0);

                float v = max(
                    fbm(
                        (p - vec3(iTime, 0, 0))*
                        vec3(0.5, 0.5, 1.0))*10.0 - 
                        noise3((p - vec3(iTime, 0, 0))*0.3
                    )*20.0, 
                    0.0);
                float boundaryFactor = 1.0 - length(p+vec3(0.0, 0.0, 7.0)) / 8.0;



                gl_FragColor.r = v * boundaryFactor;
                gl_FragColor.g = 0.0;
                gl_FragColor.b = 0.0;
                gl_FragColor.a = 1.0;
            }
        `,
        });

        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        scene.add(planeMesh);

        return function () {
            renderer.setRenderTarget(noiseRenderTarget);
            renderer.render(scene, camera);
        };
    })();

    renderNoise();

    // }

    const cameraNear = 0.05;
    const cameraFar = 10.0;
    const camera = new THREE.PerspectiveCamera(60, 1, cameraNear, cameraFar);

    const controls = new OrbitControls(camera, renderer.domElement);

    const scene = new THREE.Scene();

    camera.position.set(2, 2, 3);
    camera.lookAt(0, 0, 0);

    const lightDir = new THREE.Vector3(-5, -4, -1).normalize();
    const directionalLight = new THREE.DirectionalLight("white", 1.0);
    directionalLight.lookAt(lightDir.x, lightDir.y, lightDir.z);

    scene.add(directionalLight);

    const fifthsRaytracer = /* glsl */ `

uniform sampler2D densityTexture;
uniform float iTime;
const float mediaDensity = 4.0;

struct box {
    vec3 pos;
    vec3 size;
};

box b1 = box(vec3(0, 0.5, 0), vec3(2.0, 0.75, 2.0));

bool raytraceBox(vec3 o, vec3 d, out float ct, out float ft, box b) {
    vec3 tMin;
    vec3 tMax;

    vec3 halfSize = b.size/2.0;

    vec3 lbf = b.pos - halfSize;
    vec3 rtb = b.pos + halfSize;

    tMin = (lbf - o)/d;
    tMax = (rtb - o)/d;

    if(tMin.x > tMax.x){
        float tempT = tMin.x;
        tMin.x = tMax.x;
        tMax.x = tempT;
    }

    if(tMin.y > tMax.y){
        float tempT = tMin.y;
        tMin.y = tMax.y;
        tMax.y = tempT;
    }

    if(tMin.z > tMax.z){
        float tempT = tMin.z;
        tMin.z = tMax.z;
        tMax.z = tempT;
    }

    if((tMin.x > tMax.y) || (tMin.y > tMax.x)){
        return false;
    }

    if(tMin.y > tMin.x){
        tMin.x = tMin.y;
    }

    if(tMax.y < tMax.x){
        tMax.x = tMax.y;
    }

    if((tMin.x > tMax.z) || (tMin.z > tMax.x)){
        return false;
    }

    if(tMin.z > tMin.x){
        tMin.x = tMin.z;
    }

    if(tMax.z < tMax.x){
        tMax.x = tMax.z;
    }
    
    if(ct < 0.0){
        return false;
    }
    ct = max(tMin.x, 0.0);
    ft = max(tMax.x, 0.0);
    return true;
}

float densityAtPoint(vec3 p){
    return max(
        fbm(
            (p - vec3(iTime, 0, 0)) * vec3(0.5, 1, 0.5)) * 5.0 - 
            noise3((p - vec3(iTime, 0, 0)) * 5.0) * 5.0, 
        0.0);
}

float densityAtPoint2(vec3 p) {

    // (0, 1)
    vec3 _p = (p - b1.pos) / b1.size + 0.5;
    _p = _p.xzy;

    // from here on, z is up/down
    _p *= vec3(128.0, 128.0, 64.0);

    //if (true) {
    //    return _p.z;
    //}

    int x = clamp(int(_p.x), 0, 128);
    int y = clamp(int(_p.y), 0, 128);    
    int z = clamp(int(_p.z), 0, 63);
    int z2 = z + 1;

    // 0 .. 1
    float t = _p.z - floor(_p.z);

    if (true) {
        //return float(y+x+z) / (128.0 + 128.0 + 64.0) * 0.5;
    }

    vec2 xy = vec2(x, y) / 128.0 / 8.0;
    vec2 za1 = vec2(
        z - z / 8 * 8,
        z / 8
    ) / 8.0;
    vec2 za2 = vec2(
        z2 - z2 / 8 * 8,
        z2 / 8
    );

    float d1 = texture2D(densityTexture, xy + za1).r;
    float d2 = texture2D(densityTexture, xy + za2).r;

    return d1;

    //int z1 = int(floor(_p.y * 64.0));
    //int z2 = int(ceil(_p.y * 64.0));

    // float t = _p.z - float(z);

    // float d1 = sampleDensityTexture(x, y, z);
    // float d2 = sampleDensityTexture(x, y, z + 1);

    // return d1;
}

float getDensityOnRay(vec3 o, vec3 d, float ct, float ft, int res){
    vec3 samplePos = o + d*ct;
    float stepLength = (ft - ct)/float(res);
    vec3 stepDir = d*stepLength;
    float density = 1.0;
    for(int i = 0; i < res; i++){
        float currDensity = exp(-mediaDensity*stepLength*densityAtPoint2(samplePos));
        density *= currDensity;
        samplePos += stepDir;
        if(density >= 0.99) break;
    }
    return density;
}

vec2 renderVolume(vec3 o, vec3 d, float ct, float ft, int res){
    vec3 samplePos = o + d*ct;
    float stepLength = (ft - ct)/float(res);
    vec3 stepDir = stepLength*d;
    float density = 1.0;
    float outDensity = 0.0;
    float transmittance = 0.0;
    for(int i = 0; i < res; i++){
        //vec3 lightDir = normalize(vec3(0, 10, cos(iTime)*100.0 - 100.0) - samplePos);
        vec3 lightDir = normalize(vec3(-10, -10, 10));
        float ld = densityAtPoint2(samplePos);
        float lct;
        float lft;
        bool lightHit = raytraceBox(samplePos, lightDir, lct, lft, b1);
        float currDensity = exp(-mediaDensity*stepLength*ld);
        density *= currDensity;
        if(lightHit){
            float lDensity = getDensityOnRay(samplePos, lightDir, lct, lft, 5);
            transmittance += density*lDensity*ld*mediaDensity*stepLength;
        }
        outDensity += (1.0 - currDensity)*(1.0 - outDensity);
        samplePos += stepDir;
        if(outDensity >= 0.999 || transmittance >= 0.999) break;
    }
    return vec2(outDensity, transmittance);
}

/*
void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec3 col = vec3(0);
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    //vec3 o = vec3(sin(-iTime)*8.0, 0, cos(-iTime)*8.0);
    //vec3 d = normalize(rotate2D(vec3(uv, 1), vec2(0, iTime - radians(180.0))));
    vec3 o = vec3(0, 0, -8);
    vec3 d = normalize(rotate2D(vec3(uv, 1), vec2(0, 0)));
    float ct;
    float ft;
    bool hitBox = raytraceBox(o, d, ct, ft, b1);
    
    vec3 skyCol = mix(vec3(0.7, 0.9, 1), vec3(0.4, 0.5, 1), uv.y/2.0 + 0.5);
    
    if(hitBox){
        vec2 renderMedia = renderVolume(o, d, ct, ft, 25);
        
        col = mix(skyCol, mix(mix(vec3(1, 0.8, 0.7), vec3(0), renderMedia.y), skyCol, 1.0 - exp(-ct*vec3(0.1, 0.1, 0.15))), renderMedia.x);
    }else{
        col = skyCol;
    }
    fragColor = vec4(pow(col, vec3(1.0/2.2)), 1);
}
*/

`;

    const scene2 = new THREE.Scene();

    const plane = new THREE.PlaneGeometry(4.0, 4.0);

    const planeMesh = new THREE.Mesh(
        plane,
        new THREE.ShaderMaterial({
            uniforms: {
                colorTexture: { value: renderTarget.texture },
                depthTexture: { value: renderTarget.depthTexture },
                cameraModelMatrix: { value: camera.modelViewMatrix },
                cameraNear: { value: cameraNear },
                cameraFar: { value: cameraFar },
                cameraPos: { value: camera.position },
                rayOrigin: { value: camera.position },
                cameraQuaternion: { value: camera.quaternion },
                lightDir: { value: lightDir },
                iTime: { value: 0.0 },
                densityTexture: { value: noiseRenderTarget.texture },

                cloudTexture: { value: null },

                resolution: { value: new THREE.Vector2(600, 600) },
                time: { value: 0.0 },
            },

            vertexShader: /* glsl */ `
    varying vec3 vOrigin;
    varying vec3 vDirection;
    varying vec3 vWorldPosition;

    //uniform mat4 modelMatrix;
    //uniform mat4 modelViewMatrix;
    //uniform mat4 projectionMatrix;
    uniform vec3 cameraPos;

    void main() {
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * mvPosition;

        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

    }
    
    `,
            fragmentShader: /* glsl */ `
    #include <packing>

    #define dot2(v) dot(v, v)

    uniform sampler2D depthTexture;
    uniform sampler2D colorTexture;
    uniform vec4 cameraQuaternion;
    uniform vec3 rayOrigin;

    uniform float cameraNear;
    uniform float cameraFar;
    uniform vec3 lightDir;

    varying vec3 vWorldPosition;

    ${noise3dglsl}
    ${fifthsRaytracer}

    // From three.js documentation
    float readDepth( sampler2D depthSampler, vec2 coord ) {
        float fragCoordZ = texture2D( depthSampler, coord ).x;
        float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
        return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
        //return viewZToPerspectiveDepth(viewZ, cameraNear, cameraFar);
        //return fragCoordZ;
    }

    vec3 rotate_vertex_position(vec3 v, vec4 q) {
        return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
    }

    vec3 mix(vec3 a, vec3 b, float t) {
        return a + (b - a) * t;
    }

    void main() {
        vec2 screenUV = gl_FragCoord.xy / 600.0;
        vec2 uv = gl_FragCoord.xy / 600.0 - 0.5;

        //vec3 diffuse = texture2D( tDiffuse, vUv ).rgb;
        vec4 screenColor = texture2D(colorTexture, screenUV);
        float depth = readDepth( depthTexture, screenUV );
        float realDepth = depth * (cameraFar - cameraNear) + cameraNear;

        // TODO: Account for orthographic distance
        // Use "uv" DP
        // This works for now
        realDepth *= length(vec3(uv, -1.0));

        // 60 FOV

        // if (true) {
        //     gl_FragColor.xyz = texture2D(densityTexture, screenUV).xyz;
        //     gl_FragColor.a = 1.0;
        //     return;
        // }
        
        //vec3 rd = normalize( rotate_vertex_position( vec3(uv, -1.0), cameraQuaternion ) );

        vec3 ro = rayOrigin;
        vec3 rd = normalize(vWorldPosition - ro);

        float ct;
        float ft;
        bool hitBox = raytraceBox(ro, rd, ct, ft, b1);

        
        vec3 skyCol = screenColor.rgb;

        if (dot2(screenColor.rgb) == 0.0) {
            skyCol = mix(vec3(0.7, 0.9, 1), vec3(0.4, 0.5, 1), uv.y/2.0 + 0.5);
        }

        if (realDepth < ct || !hitBox) {
            
            if (dot2(screenColor.rgb) == 0.0) {
                screenColor.rgb = mix(vec3(0.7, 0.9, 1), vec3(0.4, 0.5, 1), uv.y/2.0 + 0.5);
            }
            gl_FragColor.rgb = screenColor.rgb;


        } else {

            ft = min(ft, realDepth);
            
            vec2 renderMedia = renderVolume(ro, rd, ct, ft, 64);

            vec3 col = mix(skyCol, mix(mix(vec3(1, 0.8, 0.7), vec3(0), renderMedia.y), skyCol, 1.0 - exp(-ct*vec3(0.1, 0.1, 0.15))), renderMedia.x);
            gl_FragColor.rgb = col;

        }

        gl_FragColor.a = 1.0;
        
        /*
        vec3 normal;
        vec2 boxDepth = iBox(
            rayOrigin,
            ray,
            boundingBoxRadius
        );

        
        if (boxDepth.x < 0.0) {
            gl_FragColor = screenColor;
        //    return;
        }
        

        float distanceNear = boxDepth.x;
        float distanceFar = min(boxDepth.y, realDepth);

        float c = distanceFar - distanceNear;

        gl_FragColor.rgb = vec3(ray * 0.5 + 0.5);
        gl_FragColor.a = 1.0;
        */
    }

    /*
    uniform mat4 cameraModelMatrix;
    uniform sampler2D colorTexture;
    uniform sampler2D depthTexture;

    void main() {
        vec2 screenUV = gl_FragCoord.xy / 600.0;
        vec2 uv = gl_FragCoord.xy / 300.0 - 0.5;

        vec4 screenColor = texture2D(colorTexture, screenUV);
        vec4 screenDepth = texture2D(depthTexture, screenUV);

        // 60 FOV
        vec3 ray = normalize(mat3(cameraModelMatrix) * vec3(uv, sqrt(3.0)));

        gl_FragColor = vec4(screenDepth.xxx * 0.1, 1.0);
    }
    */
    `,
        })
    );

    planeMesh.position.set(0, 0, -2);

    scene2.add(camera);
    camera.add(planeMesh);

    const heightmapSize = 128;
    const lateraiSize = 1.0;
    const verticalSize = 1.2;

    const heightmap = createNoiseTexture(heightmapSize, heightmapSize, 75, 3.0);

    const heightmapGeometry = heightmap.toBufferGeometry(
        lateraiSize,
        verticalSize
    );

    const heightmapMaterial = new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
    varying vec3 vPosition;
    varying vec3 vNormal;
    void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;

        vNormal = normal;
    }

    `,
        fragmentShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;

    vec3 mix(vec3 a, vec3 b, float t) {
        return a + (b - a) * t;
    }

    const vec3 lightDir = normalize(vec3(1.0, -1.0, 0.0));

    const vec3 slopeColorLow = vec3(77, 24, 2) / 255.0;
    const vec3 slopeColorHigh = vec3(77, 65, 61) / 255.0;

    const vec3 grassColorLow = vec3(35, 84, 5) / 255.0;
    const vec3 grassColorHigh = vec3(9, 148, 23) / 255.0;

    void main() {
        // 1. Color, based on normal and height
        float normalAmt = abs(vNormal.y);
        normalAmt *= normalAmt;
        normalAmt *= normalAmt;
        normalAmt *= normalAmt;
        normalAmt = 1.0 - normalAmt;
        normalAmt = normalAmt * normalAmt * (3.0 - 2.0 * normalAmt);

        float minY = -0.5;
        float maxY = 0.5;
        float altitudeAmt = (vPosition.y - minY) / (maxY - minY);
        vec3 grassColor = mix(grassColorLow, grassColorHigh, altitudeAmt);
        vec3 slopeColor = mix(slopeColorLow, slopeColorHigh, altitudeAmt);

        vec3 col = mix(grassColor, slopeColor, normalAmt);

        // 2. Shade
        float diffuse = max(0.0, -dot(vNormal, lightDir));
        float ambient = 0.2;

        gl_FragColor.rgb = col * (diffuse * 0.8 + ambient);
        gl_FragColor.a = 1.0;
    }

    `,
    });

    const heightmapMesh = new THREE.Mesh(heightmapGeometry, heightmapMaterial);

    const edgeGeometry = heightmap.toEdgesGeometry(lateraiSize, verticalSize);

    const edgesMesh = new THREE.Mesh(edgeGeometry, heightmapMaterial);

    scene.add(heightmapMesh);
    scene.add(edgesMesh);

    const maximumDropletLifetime = 30;
    const erosionSpeed = 0.01;
    let totalIterationsLeft = 12_000_000;

    /**
     * @typedef Droplet
     * @property {number} x
     * @property {number} y
     * @property {number} sediment
     * @property {number} water
     * @property {number} lifetime
     * @property {{
     *  x: number,
     *  y: number,
     *  magnitude: () => number
     * }} velocity
     */

    /** @type {Droplet[]} */
    const dropletQueue = [];

    /** @param {number?} x @param {number?} y */
    function addDroplet(x, y) {
        x = x || (Math.random() * heightmapSize) | 0;
        y = y || (Math.random() * heightmapSize) | 0;

        dropletQueue.push({
            x,
            y,
            velocity: {
                x: Math.random() - 0.5,
                y: Math.random() - 0.5,
                magnitude() {
                    return Math.sqrt(this.x * this.x + this.y * this.y);
                },
            },
            sediment: 0,
            lifetime: 0,
        });
    }

    /** @param {Droplet} drop  */
    function stepDroplet(drop) {
        if (drop.lifetime >= maximumDropletLifetime) return true;

        if (
            drop.x < 0 ||
            drop.y < 0 ||
            drop.x > heightmapSize - 1 ||
            drop.y > heightmapSize - 1
        )
            return true;

        // Get information about droplet's surroundings
        const initialHeight = heightmap.getInterpolated(drop.x, drop.y);
        const { x: gradientX, y: gradientY } = heightmap.calculateGradient(
            drop.x,
            drop.y
        );

        const inverseGradientMagnitude = Math.hypot(gradientX, gradientY);

        // Apply the downward force to the droplet
        const dropletMass = drop.water + drop.sediment;

        drop.velocity.x *= 0.9;
        drop.velocity.y *= 0.9;

        drop.velocity.x += -gradientX * inverseGradientMagnitude; // * dropletMass;
        drop.velocity.y += -gradientY * inverseGradientMagnitude; // * dropletMass;

        const inverseVelocityMagnitude = 1.0 / drop.velocity.magnitude();

        // Update the drop's position
        drop.x += drop.velocity.x * inverseVelocityMagnitude;
        drop.y += drop.velocity.y * inverseVelocityMagnitude;

        // Calculate the drop's new height
        const newHeight = heightmap.getInterpolated(drop.x, drop.y);

        // Positive if we are going uphill
        // Negative if we are going downhill
        const deltaHeight = newHeight - initialHeight;

        // Calculate the sediment capacity of the droplet
        const sedimentCapacity = Math.exp(-drop.lifetime * 0.1);

        // If we have stored too much sediment
        if (drop.sediment >= sedimentCapacity) {
            // Drop some off (deposit)
            // BUT not more than deltaHeight
            const depositAmount =
                Math.min(
                    drop.sediment - sedimentCapacity,
                    Math.min(Math.abs(deltaHeight), drop.sediment)
                ) * erosionSpeed;

            if (depositAmount > 1e-6) {
                drop.sediment -= depositAmount;
                heightmap.addInterpolated(drop.x, drop.y, depositAmount);
            }
        }

        // Otherwise
        else {
            // Pick some up (erode)
            // BUT not more than deltaHeight
            const erodeAmount =
                Math.min(
                    sedimentCapacity - drop.sediment,
                    Math.abs(deltaHeight)
                ) * erosionSpeed;

            if (erodeAmount > 1e-6) {
                drop.sediment += erodeAmount;
                heightmap.addInterpolated(drop.x, drop.y, -erodeAmount);
            }
        }

        // Age drop
        drop.lifetime += 1;

        totalIterationsLeft -= 1;
    }

    /** @param {Droplet[]} queue */
    function stepQueue(queue) {
        for (let i = queue.length - 1; i >= 0; i--) {
            const die = stepDroplet(queue[i]);
            if (die) queue.splice(i, 1);
        }

        if (queue.length < 300) addDroplet();
    }

    function render() {
        if (totalIterationsLeft > 0) {
            for (let i = 0; i < 1000 && totalIterationsLeft > 0; i++) {
                stepQueue(dropletQueue);
            }
            heightmap.updateBufferAttribute(
                heightmapGeometry.attributes.position,
                verticalSize
            );
            heightmapGeometry.computeVertexNormals();

            edgesMesh.geometry = heightmap.toEdgesGeometry(
                lateraiSize,
                verticalSize
            );
            edgesMesh.geometry.computeVertexNormals();
        }

        controls.update();

        renderer.setRenderTarget(renderTarget);
        renderer.render(scene, camera);

        planeMesh.material.uniforms.depthTexture.value =
            renderTarget.depthTexture;
        planeMesh.material.uniforms.rayOrigin.value = camera.position;
        planeMesh.material.uniforms.iTime.value = performance.now() * 0.0001;
        planeMesh.material.needsUpdate = true;

        renderer.setRenderTarget(null);
        renderer.render(scene2, camera);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

main();