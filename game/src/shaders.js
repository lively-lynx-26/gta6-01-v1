// Custom GLSL shaders: a gradient sky dome with a sun disc, and an
// animated ocean surface. Both are written here, not copied from any library.

import * as THREE from 'three';

// Sky dome: blue zenith fading to a warm haze at the horizon, with a sun disc.
export function makeSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2f7fd0) },
      horizonColor: { value: new THREE.Color(0xcfe9f7) },
      sunColor: { value: new THREE.Color(0xfff2c0) },
      sunDirection: { value: new THREE.Vector3(0.45, 0.62, 0.35).normalize() },
    },
    vertexShader: `
      varying vec3 vWorldDirection;
      void main() {
        vWorldDirection = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      varying vec3 vWorldDirection;
      void main() {
        vec3 d = normalize(vWorldDirection);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, topColor, pow(h, 0.62));
        float sunAmount = max(dot(d, normalize(sunDirection)), 0.0);
        col += sunColor * pow(sunAmount, 220.0) * 1.4;
        col += sunColor * pow(sunAmount, 10.0) * 0.22;
        // Warm haze band right at the horizon.
        col = mix(col, vec3(1.0, 0.86, 0.62), pow(1.0 - h, 6.0) * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// Ocean: rolling sine waves in the vertex shader, deep-to-shallow colour
// and a sun glint in the fragment shader.
export function makeWaterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: false,
    fog: false,
    uniforms: {
      time: { value: 0 },
      deepColor: { value: new THREE.Color(0x0e5a80) },
      shallowColor: { value: new THREE.Color(0x2fa8c8) },
      sunDirection: { value: new THREE.Vector3(0.45, 0.62, 0.35).normalize() },
    },
    vertexShader: `
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 p = position;
        float w1 = sin(p.x * 0.08 + time * 1.1) * 0.55;
        float w2 = cos(p.z * 0.06 + time * 0.8) * 0.45;
        float w3 = sin((p.x + p.z) * 0.045 + time * 0.5) * 0.35;
        p.y += w1 + w2 + w3;
        vNormal = normalize(vec3(
          -0.08 * cos(p.x * 0.08 + time * 1.1),
          1.0,
          -0.06 * sin(p.z * 0.06 + time * 0.8)
        ));
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 deepColor;
      uniform vec3 shallowColor;
      uniform vec3 sunDirection;
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.0);
        vec3 col = mix(deepColor, shallowColor, fresnel * 0.8 + 0.12);
        float sparkle = sin(vWorldPos.x * 0.9 + time * 2.0) * sin(vWorldPos.z * 0.7 - time * 1.6);
        col += vec3(1.0, 0.95, 0.75) * smoothstep(0.86, 1.0, sparkle) * 0.35;
        float sunAmount = max(dot(reflect(-normalize(sunDirection), n), viewDir), 0.0);
        col += vec3(1.0, 0.9, 0.6) * pow(sunAmount, 90.0) * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
