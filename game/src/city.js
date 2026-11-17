// City generation: Solmar Bay is built from a fixed seed so every run
// produces the same streets, blocks and landmarks. The builder returns the
// colliders the physics engine needs, the road graph traffic follows, and
// named anchor points the missions use.

import * as THREE from 'three';
import { WORLD, DISTRICTS, PALETTE, roadPositions } from './config.js';
import { mulberry32, range, rangeInt, pick, chance } from './random.js';
import { makeBox } from './physics.js';
import {
  facadeTexture, roadTexture, sidewalkTexture, sandTexture, grassTexture,
} from './textures.js';
import { makeSkyMaterial, makeWaterMaterial } from './shaders.js';
import {
  mat, buildPalmTree, buildStreetLamp, buildBench, buildHydrant, buildBillboard,
} from './models.js';

export class City {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(20261117);
    this.colliders = [];
    this.buildings = [];
    this.roadLines = roadPositions();
    this.clouds = [];
    this.waterMaterial = makeWaterMaterial();
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildBeach();
    this.buildLandmarks();
    this.buildSky();
  }

  buildGround() {
    const size = WORLD.half * 2 + 220;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: 0x8a8a7a, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, 40);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  buildRoads() {
    const tex = roadTexture();
    const roadMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    const walkMat = new THREE.MeshStandardMaterial({
      map: sidewalkTexture(), roughness: 0.95,
    });
    const span = WORLD.half * 2 + 40;
    for (const p of this.roadLines) {
      // East-west road (along X) and north-south road (along Z).
      for (const horizontal of [true, false]) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(span, WORLD.roadHalf * 2), roadMat.clone());
        road.material.map = tex.clone();
        road.material.map.repeat.set(span / 16, 1);
        road.material.map.needsUpdate = true;
        road.rotation.x = -Math.PI / 2;
        if (!horizontal) road.rotation.z = Math.PI / 2;
        road.position.set(horizontal ? 0 : p, 0, horizontal ? p : 0);
        road.receiveShadow = true;
        this.scene.add(road);
        // Sidewalks on both sides.
        for (const side of [-1, 1]) {
          const walk = new THREE.Mesh(
            new THREE.PlaneGeometry(span, WORLD.sidewalk), walkMat.clone());
          walk.material.map = sidewalkTexture();
          walk.material.map.repeat.set(span / 8, 1);
          walk.material.map.needsUpdate = true;
          walk.rotation.x = -Math.PI / 2;
          if (!horizontal) walk.rotation.z = Math.PI / 2;
          const off = side * (WORLD.roadHalf + WORLD.sidewalk / 2);
          walk.position.set(horizontal ? 0 : p + off, 0.02, horizontal ? p + off : 0);
          walk.receiveShadow = true;
          this.scene.add(walk);
        }
      }
    }
  }

  buildBlocks() {
    const rng = this.rng;
    const lines = this.roadLines;
    // Blocks are the squares between neighbouring roads.
    for (let ix = 0; ix < lines.length - 1; ix++) {
      for (let iz = 0; iz < lines.length - 1; iz++) {
        const x0 = lines[ix] + WORLD.roadHalf + WORLD.sidewalk;
        const x1 = lines[ix + 1] - WORLD.roadHalf - WORLD.sidewalk;
        const z0 = lines[iz] + WORLD.roadHalf + WORLD.sidewalk;
        const z1 = lines[iz + 1] - WORLD.roadHalf - WORLD.sidewalk;
        // The south row (z > beachZ) is the beach; leave it open.
        if (z0 > WORLD.beachZ) continue;
        // Central plaza: keep the middle block open with a fountain court.
        if (ix === 3 && iz === 3) {
          this.buildPlaza(x0, x1, z0, z1);
          continue;
        }
        // Marina corner: low warehouses near the docks.
        const isDock = ix === 0 && iz === 6;
        const buildingCount = isDock ? 2 : rangeInt(rng, 2, 4);
        for (let b = 0; b < buildingCount; b++) {
          const bw = range(rng, 14, 24);
          const bd = range(rng, 12, 20);
          const bx = range(rng, x0 + bw / 2 + 2, x1 - bw / 2 - 2);
          const bz = range(rng, z0 + bd / 2 + 2, z1 - bd / 2 - 2);
          const floors = isDock ? rangeInt(rng, 1, 2) : rangeInt(rng, 2, 9);
          const h = floors * 3.4 + 1.2;
          const base = pick(rng, PALETTE.building);
          const tex = facadeTexture(
            '#' + base.toString(16).padStart(6, '0'), floors, Math.max(3, Math.floor(bw / 4)), rangeInt(rng, 1, 99999));
          tex.wrapS = THREE.RepeatWrapping;
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(bw, h, bd),
            new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
          );
          mesh.position.set(bx, h / 2, bz);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.scene.add(mesh);
          // Rooftop box for taller buildings.
          if (floors >= 5 && chance(rng, 0.6)) {
            const roof = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 0.3, 1.6, bd * 0.3),
              mat(0x6a6a66, { roughness: 0.9 }),
            );
            roof.position.set(bx + bw * 0.2, h + 0.8, bz - bd * 0.15);
            roof.castShadow = true;
            this.scene.add(roof);
          }
          const box = makeBox(bx - bw / 2 - 0.4, bz - bd / 2 - 0.4, bx + bw / 2 + 0.4, bz + bd / 2 + 0.4);
          this.colliders.push(box);
          this.buildings.push({ x: bx, z: bz, w: bw, d: bd, h, box });
        }
        // A few palms and benches inside each block.
        if (chance(rng, 0.7)) {
          const px = range(rng, x0 + 4, x1 - 4);
          const pz = range(rng, z0 + 4, z1 - 4);
          if (!this.insideAnyBuilding(px, pz, 3)) {
            const palm = buildPalmTree(range(rng, 5, 8));
            palm.position.set(px, 0, pz);
            this.scene.add(palm);
            this.colliders.push(makeBox(px - 0.4, pz - 0.4, px + 0.4, pz + 0.4));
          }
        }
      }
    }
    // Street lamps: one at each intersection corner, alternating sides.
    for (const px of lines) {
      for (const pz of lines) {
        if ((px + pz) % 160 !== 0) continue;
        const lamp = buildStreetLamp();
        lamp.position.set(px + WORLD.roadHalf + 1.2, 0, pz + WORLD.roadHalf + 1.2);
        this.scene.add(lamp);
      }
    }
  }

  buildPlaza(x0, x1, z0, z1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const plaza = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, z1 - z0),
      new THREE.MeshStandardMaterial({ map: sidewalkTexture(), roughness: 0.9 }),
    );
    plaza.material.map.repeat.set(8, 8);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(cx, 0.03, cz);
    plaza.receiveShadow = true;
    this.scene.add(plaza);
    // Fountain: stacked cylinders with a water disc.
    const stone = mat(0xb8b0a4, { roughness: 0.8 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 0.8, 20), stone);
    basin.position.set(cx, 0.4, cz);
    basin.castShadow = true;
    this.scene.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.2, 20),
      new THREE.MeshStandardMaterial({ color: 0x2fa8c8, roughness: 0.15, metalness: 0.4 }));
    water.position.set(cx, 0.85, cz);
    this.scene.add(water);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.4, 12), stone);
    column.position.set(cx, 1.8, cz);
    column.castShadow = true;
    this.scene.add(column);
    this.colliders.push(makeBox(cx - 5.4, cz - 5.4, cx + 5.4, cz + 5.4));
    // Benches and palms around the plaza.
    for (const [bx, bz, ry] of [
      [x0 + 6, cz, 0], [x1 - 6, cz, Math.PI],
      [cx, z0 + 6, Math.PI / 2], [cx, z1 - 6, -Math.PI / 2],
    ]) {
      const bench = buildBench();
      bench.position.set(bx, 0, bz);
      bench.rotation.y = ry;
      this.scene.add(bench);
    }
    for (const [px, pz] of [[x0 + 5, z0 + 5], [x1 - 5, z0 + 5], [x0 + 5, z1 - 5], [x1 - 5, z1 - 5]]) {
      const palm = buildPalmTree(6.5);
      palm.position.set(px, 0, pz);
      this.scene.add(palm);
    }
    // The plaza billboard.
    const board = buildBillboard('SOLMAR BAY', 'NEON TIDE', '#0d2a4a', '#ffd23e', 12, 3);
    board.position.set(cx, 0, z0 + 2);
    this.scene.add(board);
    this.colliders.push(makeBox(cx - 6, z0 - 1, cx + 6, z0 + 3));
  }

  buildBeach() {
    const rng = this.rng;
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(760, 70),
      new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }),
    );
    sand.material.map.repeat.set(24, 2);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.01, WORLD.beachZ + 32);
    sand.receiveShadow = true;
    this.scene.add(sand);
    // Boardwalk strip between the city and the sand.
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(760, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.9 }),
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.02, WORLD.beachZ - 2);
    walk.receiveShadow = true;
    this.scene.add(walk);
    // Palms along the beach.
    for (let x = -340; x <= 340; x += 48) {
      if (chance(rng, 0.8)) {
        const palm = buildPalmTree(range(rng, 6, 9));
        palm.position.set(x + range(rng, -8, 8), 0, WORLD.beachZ + range(rng, 8, 30));
        this.scene.add(palm);
      }
    }
    // Ocean plane with the custom water shader.
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 700, 48, 24),
      this.waterMaterial,
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, 0.1, WORLD.oceanZ + 340);
    this.scene.add(ocean);
    // A pier jutting into the water at the marina.
    const pierMat = mat(0x8a7a5a, { roughness: 0.9 });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 90), pierMat);
    pier.position.set(200, 0.5, WORLD.beachZ + 55);
    pier.castShadow = true;
    pier.receiveShadow = true;
    this.scene.add(pier);
    for (let z = WORLD.beachZ + 20; z < WORLD.beachZ + 95; z += 18) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.6, 8), pierMat);
      post.position.set(195, 0.2, z);
      this.scene.add(post);
      const post2 = post.clone();
      post2.position.x = 205;
      this.scene.add(post2);
    }
  }

  buildLandmarks() {
    // Neon Mile sign over the main avenue.
    const neon = buildBillboard('NEON MILE', 'EAT · DRIVE · REPEAT', '#1a0a2e', '#ff5ad8', 14, 3.2);
    neon.position.set(0, 0, -200 + 12);
    this.scene.add(neon);
    // Docks sign.
    const docks = buildBillboard('THE DOCKS', 'SOLMAR FREIGHT', '#10202e', '#7dd8ff', 12, 3);
    docks.position.set(-240, 0, 200 - 12);
    docks.rotation.y = Math.PI;
    this.scene.add(docks);
    // Rosa's garage: a low red-roofed building with a sign.
    const garage = buildBillboard("ROSA'S GARAGE", 'CASH FOR CARS', '#3a0d0d', '#ffd23e', 11, 2.8);
    garage.position.set(100, 0, 28);
    this.scene.add(garage);
    // Hotel tower near the marina (inside its block, clear of the roads).
    const hotel = new THREE.Mesh(
      new THREE.BoxGeometry(26, 42, 20),
      new THREE.MeshStandardMaterial({
        map: facadeTexture('#e3d5c0', 12, 8, 4242), roughness: 0.85,
      }),
    );
    hotel.position.set(160, 21, -240);
    hotel.castShadow = true;
    this.scene.add(hotel);
    this.colliders.push(makeBox(160 - 13.4, -240 - 10.4, 160 + 13.4, -240 + 10.4));
    this.buildings.push({ x: 160, z: -240, w: 26, d: 20, h: 42, box: this.colliders[this.colliders.length - 1] });
  }

  buildSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 24, 16),
      makeSkyMaterial(),
    );
    this.scene.add(sky);
    // Drifting clouds: soft billboards high above the city.
    const tex = new (THREE.CanvasTexture)(makeCloudCanvas());
    tex.colorSpace = THREE.SRGBColorSpace;
    const rng = mulberry32(777);
    for (let i = 0; i < 14; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: range(rng, 0.55, 0.9), depthWrite: false, fog: false,
      }));
      const s = range(rng, 90, 190);
      sprite.scale.set(s, s * 0.45, 1);
      sprite.position.set(range(rng, -700, 700), range(rng, 120, 220), range(rng, -700, 500));
      sprite.userData.drift = range(rng, 1.2, 3.2);
      this.scene.add(sprite);
      this.clouds.push(sprite);
    }
  }

  insideAnyBuilding(x, z, pad) {
    for (const b of this.buildings) {
      if (x > b.x - b.w / 2 - pad && x < b.x + b.w / 2 + pad
        && z > b.z - b.d / 2 - pad && z < b.z + b.d / 2 + pad) return true;
    }
    return false;
  }

  // Nearest point on the road lattice to (x, z), used by traffic and spawns.
  nearestRoadPoint(x, z) {
    let best = null, bestD = Infinity;
    for (const p of this.roadLines) {
      const d1 = Math.abs(x - p);
      if (d1 < bestD) { bestD = d1; best = { x: p, z, horizontal: false }; }
      const d2 = Math.abs(z - p);
      if (d2 < bestD) { bestD = d2; best = { x, z: p, horizontal: true }; }
    }
    return best;
  }

  randomRoadPoint(rng) {
    const p = pick(rng, this.roadLines);
    const t = range(rng, -280, 280);
    if (chance(rng, 0.5)) return { x: p, z: t };
    return { x: t, z: p };
  }

  // A random sidewalk point beside a road, for pedestrians.
  randomSidewalkPoint(rng) {
    const p = pick(rng, this.roadLines);
    const t = range(rng, -280, 280);
    const off = (chance(rng, 0.5) ? 1 : -1) * (WORLD.roadHalf + WORLD.sidewalk / 2);
    if (chance(rng, 0.5)) return { x: p + off, z: t };
    return { x: t, z: p + off };
  }

  update(dt, t) {
    this.waterMaterial.uniforms.time.value = t;
    for (const c of this.clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 800) c.position.x = -800;
    }
  }
}

function makeCloudCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);
  const puffs = [[70, 80, 42], [120, 62, 52], [175, 82, 44], [100, 92, 40], [150, 96, 36]];
  for (const [x, y, r] of puffs) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return canvas;
}
