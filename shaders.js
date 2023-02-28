
export default {
    "raymarch": {
        "vert": /* glsl */ `
            attribute vec4 a_position;
            void main() {
                gl_Position = a_position;
            }
        `,
        "frag": /* glsl */ `
            precision highp float;

            void main() {
                gl_FragColor = vec4(1.0, 0.0, 0.5);
            }
        `
    },
    "terrain-raster": {
        "vert": /* glsl */ `
            uniform mat4 u_model;
            uniform mat4 u_view;
            uniform mat4 u_projection;

            attribute vec3 a_position;
            attribute vec3 a_normal;

            varying vec3 v_normal;
            varying float v_depth;

            void main() {
                gl_Position = u_projection * u_view * u_model * vec4(a_position, 1);
                v_normal = (u_model * vec4(a_normal, 0)).xyz;
                v_depth = length(a_position.xyz - u_view[3].xyz);
            }
        `,
        "frag": /* glsl */ `
            precision highp float;

            varying vec3 v_normal;
            varying float v_depth;

            void main() {
                // write normal to RGB, depth to alpha channel
                gl_FragColor = vec4(v_normal * 0.5 + 0.5, exp(-v_depth * 0.1));
                gl_FragColor = vec4(1.0, 0.2, 0.5, 1.0);
            }
        `
    },
};
