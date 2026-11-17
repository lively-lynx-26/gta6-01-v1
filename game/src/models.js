// Model writer: every vehicle, pedestrian, tree and prop in Solmar Bay is
// assembled here from three.js primitives with procedural materials.
// No external model or artwork is loaded. Each builder returns a THREE.Group
// whose userData carries the parts the game animates (wheels, limbs, lights).

import * as THREE from 'three';
import { PALETTE, VEHICLE_TYPES } from './config.js';
import { checkerTexture } from './textures.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.6,
      metalness: opts.metalness ?? 0.1,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1,
    }));
  }
  return matCache.get(key);
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, material, x = 0, y = 0, z = 0, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const glassMat = () => mat(PALETTE.glass, { roughness: 0.15, metalness: 0.6 });
const tireMat = () => mat(0x14161a, { roughness: 0.95 });
const chromeMat = () => mat(0xd8dee6, { roughness: 0.2, metalness: 0.9 });

// Build a car. type is a key of VEHICLE_TYPES; color is a hex number.
// The group faces +Z when heading is 0 (forward = +Z, matching the physics).
export function buildCarMesh(type, color) {
  const spec = VEHICLE_TYPES[type];
  const g = new THREE.Group();
  const L = spec.len, W = spec.wid;
  const body = mat(color, { roughness: 0.35, metalness: 0.55 });
  const isVan = type === 'van' || type === 'armored';
  const isPolice = type === 'police';

  // Lower body.
  const lower = box(W, 0.62, L, body, 0, 0.55, 0);
  g.add(lower);
  // Hood / trunk shaping.
  const hood = box(W * 0.94, 0.22, L * 0.26, body, 0, 0.92, L * 0.34);
  g.add(hood);
  // Cabin.
  if (isVan) {
    const cabin = box(W * 0.96, 0.95, L * 0.62, body, 0, 1.32, -L * 0.1);
    g.add(cabin);
    const windshield = box(W * 0.9, 0.7, 0.06, glassMat(), 0, 1.3, L * 0.22);
    g.add(windshield);
  } else {
    const cabin = box(W * 0.82, 0.55, L * 0.46, glassMat(), 0, 1.1, -L * 0.06);
    g.add(cabin);
    const roof = box(W * 0.86, 0.08, L * 0.44, body, 0, 1.4, -L * 0.06);
    g.add(roof);
  }
  // Bumpers and grille.
  g.add(box(W * 0.98, 0.18, 0.14, mat(0x22262c, { roughness: 0.4, metalness: 0.6 }), 0, 0.42, L / 2));
  g.add(box(W * 0.98, 0.18, 0.14, mat(0x22262c, { roughness: 0.4, metalness: 0.6 }), 0, 0.42, -L / 2));
  // Headlights and taillights.
  const headMat = mat(0xfff6c8, { emissive: 0xfff2b0, emissiveIntensity: 0.9, roughness: 0.2 });
  const tailMat = mat(0xd21f1f, { emissive: 0x8a0f0f, emissiveIntensity: 0.8, roughness: 0.2 });
  g.add(box(0.42, 0.14, 0.06, headMat, -W * 0.32, 0.72, L / 2 + 0.01));
  g.add(box(0.42, 0.14, 0.06, headMat, W * 0.32, 0.72, L / 2 + 0.01));
  g.add(box(0.42, 0.12, 0.06, tailMat, -W * 0.32, 0.72, -L / 2 - 0.01));
  g.add(box(0.42, 0.12, 0.06, tailMat, W * 0.32, 0.72, -L / 2 - 0.01));

  // Taxi dressing: yellow body, roof sign, checker band.
  if (type === 'taxi') {
    const sign = box(0.7, 0.18, 0.3, mat(0x111111), 0, 1.56, -L * 0.06);
    g.add(sign);
    const checker = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.99, 0.14, L * 0.7),
      new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.5 }),
    );
    checker.position.set(0, 0.86, 0);
    g.add(checker);
  }
  // Police dressing: white body, blue doors stripe, light bar.
  if (isPolice) {
    const stripe = box(0.04, 0.3, L * 0.8, mat(PALETTE.policeBlue, { roughness: 0.4 }), -W / 2 - 0.01, 0.62, 0);
    g.add(stripe);
    const stripe2 = stripe.clone();
    stripe2.position.x = W / 2 + 0.01;
    g.add(stripe2);
    const bar = box(0.9, 0.12, 0.3, mat(0x111111), 0, 1.52, -L * 0.06);
    g.add(bar);
    const redLight = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.32),
      mat(0xff2222, { emissive: 0xff0000, emissiveIntensity: 2 }));
    redLight.position.set(-0.24, 1.62, -L * 0.06);
    g.add(redLight);
    const blueLight = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.32),
      mat(0x2244ff, { emissive: 0x0022ff, emissiveIntensity: 2 }));
    blueLight.position.set(0.24, 1.62, -L * 0.06);
    g.add(blueLight);
    g.userData.lightBar = [redLight, blueLight];
    const badge = box(0.02, 0.34, 1.1, mat(0xffffff, { roughness: 0.4 }), -W / 2 - 0.02, 0.62, L * 0.1);
    g.add(badge);
  }
  // Armored van: reinforced panels and a roof vent.
  if (type === 'armored') {
    g.add(box(W * 1.0, 0.5, L * 0.5, mat(0x3a3f45, { roughness: 0.5, metalness: 0.7 }), 0, 1.1, -L * 0.12));
    g.add(box(0.8, 0.16, 0.8, mat(0x22262c), 0, 1.86, -L * 0.1));
  }
  // Sportscar: low spoiler and side skirts.
  if (type === 'comet') {
    g.add(box(W * 0.9, 0.06, 0.1, mat(0x111111), 0, 1.05, -L / 2 + 0.05));
    g.add(box(0.08, 0.22, L * 0.5, mat(0x111111), -W / 2, 0.3, 0));
    g.add(box(0.08, 0.22, L * 0.5, mat(0x111111), W / 2, 0.3, 0));
  }

  // Wheels: cylinders rotated to spin around the X axis.
  const wheels = [];
  const wheelR = type === 'van' || type === 'armored' ? 0.42 : 0.36;
  const wheelW = 0.28;
  const wx = W / 2 - 0.06;
  const wz = L * 0.32;
  for (const [x, z, front] of [[-wx, wz, true], [wx, wz, true], [-wx, -wz, false], [wx, -wz, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, wheelR, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 14), tireMat());
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, wheelW + 0.02, 10), chromeMat());
    hub.rotation.z = Math.PI / 2;
    pivot.add(tire);
    pivot.add(hub);
    g.add(pivot);
    wheels.push({ pivot, front, spin: 0 });
  }
  g.userData.wheels = wheels;
  g.userData.length = L;
  g.userData.width = W;
  g.userData.type = type;
  return g;
}

// Build a pedestrian: head, torso, legs and arms that swing while walking.
// skin/shirt/pants colours come from a small seeded palette so crowds vary.
export function buildPedestrianMesh(seed, opts = {}) {
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const skins = [0xe8b98a, 0xc98d64, 0x8a5a3b, 0xf0c8a0, 0x6e4426];
  const shirts = [0xc23b2e, 0x2e6fc2, 0x4a7a3f, 0xd8a13c, 0x7a3fc2, 0xe8e4da, 0x22262c, 0x3fc2b0];
  const pants = [0x2a3a55, 0x333333, 0x5a4a3a, 0x6a6a72];
  const skin = mat(opts.skin ?? skins[Math.floor(rng() * skins.length)], { roughness: 0.8 });
  const shirt = mat(opts.shirt ?? shirts[Math.floor(rng() * shirts.length)], { roughness: 0.85 });
  const pant = mat(opts.pants ?? pants[Math.floor(rng() * pants.length)], { roughness: 0.9 });
  const g = new THREE.Group();

  const legL = box(0.16, 0.78, 0.18, pant, -0.11, 0.39, 0);
  const legR = box(0.16, 0.78, 0.18, pant, 0.11, 0.39, 0);
  legL.geometry.translate(0, -0.39, 0);
  legR.geometry.translate(0, -0.39, 0);
  legL.position.y = 0.78;
  legR.position.y = 0.78;
  const torso = box(0.46, 0.62, 0.26, shirt, 0, 1.09, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skin);
  head.position.set(0, 1.62, 0);
  head.castShadow = true;
  // Hair cap.
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.195, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mat(opts.hair ?? 0x2a1c10, { roughness: 0.95 }));
  hair.position.set(0, 1.65, -0.01);
  const armL = box(0.12, 0.6, 0.14, shirt, -0.3, 1.1, 0);
  const armR = box(0.12, 0.6, 0.14, shirt, 0.3, 1.1, 0);
  armL.geometry.translate(0, -0.26, 0);
  armR.geometry.translate(0, -0.26, 0);
  armL.position.y = 1.36;
  armR.position.y = 1.36;
  g.add(legL, legR, torso, head, hair, armL, armR);
  g.userData = {
    legL, legR, armL, armR, head, torso,
    walkPhase: rng() * Math.PI * 2,
    isPedestrian: true,
  };
  return g;
}

// The player character: a taller figure in a teal jacket, easy to spot.
export function buildPlayerMesh() {
  const g = buildPedestrianMesh(7, { shirt: 0x2e8f8a, pants: 0x2a3a55, skin: 0xe8b98a, hair: 0x1a1a1a });
  g.scale.setScalar(1.06);
  return g;
}

// A palm tree: one leaning trunk, three drooping frond cones, coconuts.
// Kept to five meshes so a street full of palms stays cheap to draw.
export function buildPalmTree(height = 7) {
  const g = new THREE.Group();
  const trunkMat = mat(0x8a6a4a, { roughness: 0.95 });
  const trunk = cyl(0.16, 0.24, height, trunkMat, 0.35, height / 2, 0, 8);
  trunk.rotation.z = -0.08;
  trunk.castShadow = false;
  g.add(trunk);
  const frondMat = mat(0x3f8f3a, { roughness: 0.85 });
  const frondMat2 = mat(0x57a83f, { roughness: 0.85 });
  const topX = 0.7, topY = height + 0.1;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.0, 6), i % 2 ? frondMat : frondMat2);
    frond.position.set(topX + Math.cos(a) * 1.0, topY + 0.1, Math.sin(a) * 1.0);
    frond.rotation.z = Math.cos(a) * 1.25;
    frond.rotation.x = -Math.sin(a) * 1.25;
    frond.castShadow = false;
    g.add(frond);
  }
  const coconuts = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(0x6a4a2a, { roughness: 0.9 }));
  coconuts.position.set(topX, topY - 0.25, 0);
  g.add(coconuts);
  return g;
}

export function buildStreetLamp() {
  const g = new THREE.Group();
  const poleMat = mat(0x2c3138, { roughness: 0.5, metalness: 0.7 });
  g.add(cyl(0.07, 0.1, 5.4, poleMat, 0, 2.7, 0, 8));
  const arm = box(0.08, 0.08, 1.4, poleMat, 0, 5.35, 0.6);
  g.add(arm);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
    mat(0xfff2b0, { emissive: 0xffe9a0, emissiveIntensity: 0.7 }));
  lamp.position.set(0, 5.3, 1.25);
  g.add(lamp);
  return g;
}

export function buildBench() {
  const g = new THREE.Group();
  const wood = mat(0x8a5a34, { roughness: 0.9 });
  const iron = mat(0x2c3138, { roughness: 0.5, metalness: 0.6 });
  g.add(box(1.8, 0.08, 0.5, wood, 0, 0.45, 0));
  g.add(box(1.8, 0.5, 0.07, wood, 0, 0.75, -0.22));
  g.add(box(0.08, 0.45, 0.45, iron, -0.8, 0.22, 0));
  g.add(box(0.08, 0.45, 0.45, iron, 0.8, 0.22, 0));
  return g;
}

export function buildHydrant() {
  const g = new THREE.Group();
  const red = mat(0xc23b2e, { roughness: 0.5, metalness: 0.3 });
  g.add(cyl(0.16, 0.18, 0.7, red, 0, 0.35, 0, 10));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), red));
  g.children[1].position.y = 0.72;
  return g;
}

// A glowing billboard with invented lettering, mounted on two posts.
export function buildBillboard(text, sub, bg, fg, w = 10, h = 2.6) {
  const g = new THREE.Group();
  const tex = new THREE.CanvasTexture(makeSignCanvas(text, sub, bg, fg));
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.3),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.45, roughness: 0.5 }),
  );
  board.position.y = 6;
  board.castShadow = true;
  g.add(board);
  const postMat = mat(0x2c3138, { roughness: 0.5, metalness: 0.6 });
  g.add(cyl(0.12, 0.14, 6, postMat, -w / 2 + 0.6, 3, 0, 8));
  g.add(cyl(0.12, 0.14, 6, postMat, w / 2 - 0.6, 3, 0, 8));
  return g;
}

function makeSignCanvas(text, sub, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = fg;
  ctx.font = 'bold 58px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, sub ? 48 : 64);
  if (sub) {
    ctx.font = 'bold 24px Verdana, sans-serif';
    ctx.fillText(sub, 256, 100);
  }
  return canvas;
}
