// Shared retro shaders: banded lighting, stepped fog, cylindrical billboards.
import * as THREE from 'three';

export const MAX_LIGHTS = 8;

// Shared uniform objects (referenced by every material so one update feeds all)
export const shared = {
  lPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, -999, 0)) },
  lCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
  lRad: { value: new Float32Array(MAX_LIGHTS).fill(1) },
  fogColor: { value: new THREE.Vector3(0, 0, 0) },
  fogNear: { value: 4 },
  fogFar: { value: 28 },
  camPos: { value: new THREE.Vector3() },
  camRight: { value: new THREE.Vector3(1, 0, 0) },
  time: { value: 0 },
};

const LIGHT_FN = /* glsl */ `
uniform vec3 lPos[${MAX_LIGHTS}];
uniform vec3 lCol[${MAX_LIGHTS}];
uniform float lRad[${MAX_LIGHTS}];
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform vec3 camPos;
vec3 dynLight(vec3 p) {
  vec3 L = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    float d = length(lPos[i] - p);
    float a = max(0.0, 1.0 - d / lRad[i]);
    L += lCol[i] * a * a;
  }
  return L;
}
vec3 retroFinish(vec3 col, vec3 L, vec3 p) {
  L = floor(L * 10.0 + 0.5) / 10.0;
  col *= L;
  float f = clamp((length(p - camPos) - fogNear) / (fogFar - fogNear), 0.0, 1.0);
  f = floor(f * 10.0) / 10.0;
  return mix(col, fogColor, f);
}
`;

export function levelMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, ...shared },
    vertexShader: /* glsl */ `
      attribute vec3 light;
      varying vec2 vUv;
      varying vec3 vLight;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vLight = light;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec2 vUv;
      varying vec3 vLight;
      varying vec3 vWorld;
      ${LIGHT_FN}
      void main() {
        vec4 tex = texture2D(map, vUv);
        vec3 L = vLight + dynLight(vWorld);
        gl_FragColor = vec4(retroFinish(tex.rgb, L, vWorld), 1.0);
      }`,
  });
}

// Plane geometry anchored at bottom-center for billboards.
export const billboardGeo = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0, 0.5, 0);
  return g;
})();

// Cylindrical billboard sprite with frame selection, lighting and fog.
export function spriteMaterial(map, frames = 1, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      frame: { value: 0 },
      frames: { value: frames },
      baseLight: { value: new THREE.Vector3(1, 1, 1) },
      tint: { value: new THREE.Vector3(1, 1, 1) },
      flash: { value: 0 },
      flip: { value: 0 },
      opacity: { value: 1 },
      fullbright: { value: opts.fullbright ? 1 : 0 },
      ...shared,
    },
    transparent: !!opts.transparent,
    depthWrite: !opts.transparent,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */ `
      uniform vec3 camRight;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sx = length(modelMatrix[0].xyz);
        float sy = length(modelMatrix[1].xyz);
        vec3 wp = center + camRight * position.x * sx + vec3(0.0, position.y * sy, 0.0);
        vWorld = center + vec3(0.0, 0.5 * sy, 0.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float frame;
      uniform float frames;
      uniform vec3 baseLight;
      uniform vec3 tint;
      uniform float flash;
      uniform float flip;
      uniform float opacity;
      uniform float fullbright;
      varying vec2 vUv;
      varying vec3 vWorld;
      ${LIGHT_FN}
      void main() {
        float u = flip > 0.5 ? 1.0 - vUv.x : vUv.x;
        vec4 tex = texture2D(map, vec2((frame + u) / frames, vUv.y));
        if (tex.a < 0.5) discard;
        vec3 L = fullbright > 0.5 ? vec3(1.0) : baseLight + dynLight(vWorld);
        vec3 col = tex.rgb * tint;
        col = mix(col, vec3(1.0), flash);
        vec3 outc = retroFinish(col, max(L, vec3(flash)), vWorld);
        gl_FragColor = vec4(outc, opacity);
      }`,
  });
}

// Point-sprite particle system material (glow = additive round, otherwise square pixels)
export function particleMaterial(glowTex, additive) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex }, scale: { value: 300 }, ...shared },
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */ `
      attribute float size;
      attribute vec4 pcolor;
      uniform float scale;
      varying vec4 vColor;
      varying float vFog;
      uniform float fogNear;
      uniform float fogFar;
      void main() {
        vColor = pcolor;
        if (size <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vFog = 1.0; return; }
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(size * scale / max(0.1, -mv.z), 1.0, scale * 0.06);
        vFog = clamp((-mv.z - fogNear) / (fogFar - fogNear), 0.0, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec4 vColor;
      varying float vFog;
      void main() {
        ${additive ? `vec4 t = texture2D(map, gl_PointCoord); if (t.a < 0.05) discard; gl_FragColor = vec4(vColor.rgb * t.a * vColor.a * (1.0 - vFog * 0.8), 1.0);`
          : `if (vColor.a < 0.01) discard; gl_FragColor = vec4(vColor.rgb * (1.0 - vFog * 0.85), vColor.a);`}
      }`,
  });
}
