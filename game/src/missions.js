// Story missions: five jobs for Dario Cruz, each a chain of steps with a
// 3D beacon, a minimap blip and a HUD objective. Completing a job pays cash
// and unlocks the next; finishing all five crowns the player King of Solmar.

import * as THREE from 'three';
import { dist, formatDistance } from './random.js';

// Mission definitions. Positions are world coordinates; carKey names a
// specific car the step needs (spawned by the traffic manager).
export const MISSION_DEFS = [
  {
    id: 'fare',
    name: 'MISSION 1 — SUNSET FARE',
    intro: 'Milo Ferrante needs a ride to the Marina. Take the Bay Cab.',
    reward: 120,
    steps: [
      { kind: 'goto', text: 'Meet Milo at the taxi stand', x: 8, z: -210, radius: 6 },
      { kind: 'enterCar', text: 'Get in the Bay Cab', carKey: 'taxi', x: 8, z: -204, radius: 8 },
      { kind: 'driveTo', text: 'Drive Milo to the Marina', x: 196, z: -236, radius: 9 },
    ],
  },
  {
    id: 'wheels',
    name: 'MISSION 2 — BORROWED WHEELS',
    intro: "Rosa wants the Comet GT parked at Bayfront Plaza. Borrow it. Permanently.",
    reward: 250,
    steps: [
      { kind: 'goto', text: 'Find the Comet GT at Bayfront Plaza', x: 56, z: -206, radius: 7 },
      { kind: 'enterCar', text: 'Steal the Comet GT', carKey: 'comet', x: 56, z: -206, radius: 8 },
      { kind: 'driveTo', text: 'Deliver the Comet to Rosa\'s Garage', x: 120, z: 40, radius: 9 },
    ],
  },
  {
    id: 'drop',
    name: 'MISSION 3 — THE DROP',
    intro: 'A package waits at the docks. The police watch the docks. Be quick.',
    reward: 400,
    steps: [
      { kind: 'goto', text: 'Pick up the package at the docks', x: -240, z: 200, radius: 7 },
      { kind: 'pickup', text: 'Grab the package — the docks are watched', x: -240, z: 200, radius: 5 },
      { kind: 'driveTo', text: 'Deliver the package to Neon Mile', x: 0, z: -200, radius: 9 },
    ],
  },
  {
    id: 'heat',
    name: 'MISSION 4 — DOCKSIDE HEAT',
    intro: "Kane Voss's crew is muscling in on the docks. Rosa wants them gone.",
    reward: 600,
    steps: [
      { kind: 'goto', text: 'Get to the docks', x: -240, z: 200, radius: 10 },
      { kind: 'kill', text: "Take down Kane's crew", x: -240, z: 200, radius: 26, count: 4 },
      { kind: 'goto', text: 'Report back to Rosa\'s Garage', x: 120, z: 40, radius: 9 },
    ],
  },
  {
    id: 'score',
    name: 'MISSION 5 — THE BIG SCORE',
    intro: 'A Vault Hauler full of casino cash sits at the Bayfront bank. Take it.',
    reward: 1500,
    steps: [
      { kind: 'goto', text: 'Reach the Bayfront bank', x: 200, z: 200, radius: 9 },
      { kind: 'enterCar', text: 'Steal the Vault Hauler', carKey: 'armored', x: 212, z: 216, radius: 9 },
      { kind: 'escape', text: 'Lose the 3-star heat', x: 120, z: 40, radius: 0 },
      { kind: 'driveTo', text: 'Deliver the Hauler to Rosa\'s Garage', x: 120, z: 40, radius: 9 },
    ],
  },
];

export class MissionManager {
  constructor(scene, callbacks) {
    this.scene = scene;
    this.cb = callbacks; // {onToast, onCash, onComplete, onMissionStart, onWanted}
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.active = false;
    this.finishedAll = false;
    this.killsDone = 0;
    this.killsNeeded = 0;
    this.beacon = null;
    this.beaconRing = null;
    this.stepTimer = 0;
    this.buildBeacon();
  }

  buildBeacon() {
    const geo = new THREE.CylinderGeometry(2.6, 2.6, 42, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.y = 21;
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    const ringGeo = new THREE.TorusGeometry(3.4, 0.28, 8, 32);
    this.beaconRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.9,
    }));
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.position.y = 0.3;
    this.beaconRing.visible = false;
    this.scene.add(this.beaconRing);
  }

  currentDef() {
    return MISSION_DEFS[this.missionIndex] || null;
  }

  currentStep() {
    const def = this.currentDef();
    if (!def || !this.active) return null;
    return def.steps[this.stepIndex] || null;
  }

  startMission(index) {
    this.missionIndex = index;
    this.stepIndex = 0;
    this.killsDone = 0;
    this.active = true;
    const def = this.currentDef();
    if (this.cb.onMissionStart) this.cb.onMissionStart(def);
    if (this.cb.onToast) this.cb.onToast(def.name);
    this.beginStep();
  }

  beginStep() {
    const step = this.currentStep();
    if (!step) return;
    this.stepTimer = 0;
    if (step.kind === 'kill') {
      this.killsNeeded = step.count;
      this.killsDone = 0;
      if (this.cb.onSpawnSquad) this.cb.onSpawnSquad(step.x, step.z, step.count);
    }
    if (step.kind === 'escape') {
      if (this.cb.onWanted) this.cb.onWanted(3);
    }
    if (step.kind === 'pickup') {
      if (this.cb.onWanted) this.cb.onWanted(1);
    }
    this.placeBeacon(step);
  }

  placeBeacon(step) {
    if (!step || step.x === undefined) {
      this.beacon.visible = false;
      this.beaconRing.visible = false;
      return;
    }
    this.beacon.position.x = step.x;
    this.beacon.position.z = step.z;
    this.beaconRing.position.x = step.x;
    this.beaconRing.position.z = step.z;
    this.beacon.visible = true;
    this.beaconRing.visible = true;
  }

  objectiveText() {
    if (this.finishedAll) return { name: 'KING OF SOLMAR', text: 'Free roam — Solmar Bay is yours', dist: '' };
    const def = this.currentDef();
    const step = this.currentStep();
    if (!def || !step) return { name: 'FREE ROAM', text: 'Explore Solmar Bay', dist: '' };
    let text = step.text;
    if (step.kind === 'kill') text += `  (${this.killsDone}/${this.killsNeeded})`;
    return { name: def.name, text, dist: '' };
  }

  targetPos() {
    const step = this.currentStep();
    if (!step || step.x === undefined) return null;
    return { x: step.x, z: step.z };
  }

  completeStep(ctx) {
    const step = this.currentStep();
    if (!step) return;
    if (step.kind === 'pickup' && this.cb.onToast) {
      this.cb.onToast('PACKAGE SECURED — MOVE!');
    }
    this.stepIndex++;
    const def = this.currentDef();
    if (this.stepIndex >= def.steps.length) {
      this.completeMission(ctx);
    } else {
      this.beginStep();
    }
  }

  completeMission(ctx) {
    const def = this.currentDef();
    this.active = false;
    this.beacon.visible = false;
    this.beaconRing.visible = false;
    if (this.cb.onCash) this.cb.onCash(def.reward);
    if (this.cb.onToast) this.cb.onToast(`JOB DONE  +$${def.reward}`);
    if (this.cb.onMissionComplete) this.cb.onMissionComplete(def);
    if (this.missionIndex + 1 >= MISSION_DEFS.length) {
      this.finishedAll = true;
      if (this.cb.onAllComplete) this.cb.onAllComplete();
      return;
    }
    this.missionIndex++;
    // The next job starts after a short breather.
    this.pendingNext = 2.5;
  }

  onEnemyKilled() {
    const step = this.currentStep();
    if (!step || step.kind !== 'kill') return;
    this.killsDone++;
    if (this.killsDone >= this.killsNeeded) {
      this.completeStep();
    }
  }

  update(dt, ctx) {
    // ctx: {player, playerCar, police, time}
    if (this.pendingNext !== undefined) {
      this.pendingNext -= dt;
      if (this.pendingNext <= 0) {
        this.pendingNext = undefined;
        this.startMission(this.missionIndex);
      }
      return;
    }
    const step = this.currentStep();
    if (!step || !this.active) return;
    this.stepTimer += dt;
    // Beacon pulse.
    if (this.beacon.visible) {
      const s = 1 + Math.sin(ctx.time * 3) * 0.12;
      this.beaconRing.scale.set(s, s, 1);
      this.beacon.material.opacity = 0.22 + Math.sin(ctx.time * 3) * 0.08;
    }
    const p = ctx.player;
    const px = p.x, pz = p.z;
    switch (step.kind) {
      case 'goto':
      case 'pickup':
        if (dist(px, pz, step.x, step.z) < step.radius) this.completeStep(ctx);
        break;
      case 'enterCar': {
        const car = ctx.playerCar;
        if (car) {
          const key = step.carKey;
          const ok = !key || (ctx.carKeyOf && ctx.carKeyOf(car) === key);
          if (ok) this.completeStep(ctx);
        }
        break;
      }
      case 'driveTo': {
        const inCar = !!ctx.playerCar;
        if (inCar && dist(px, pz, step.x, step.z) < step.radius) this.completeStep(ctx);
        break;
      }
      case 'escape': {
        if (ctx.police && ctx.police.wanted === 0) this.completeStep(ctx);
        break;
      }
      case 'kill':
        // Completion happens in onEnemyKilled.
        break;
      default:
        break;
    }
  }

  // Distance readout for the HUD objective line.
  distanceToTarget(player) {
    const t = this.targetPos();
    if (!t) return '';
    return formatDistance(dist(player.x, player.z, t.x, t.z));
  }
}

// Cash pickups: glowing bundles scattered around the city, worth $50 each.
export class CashPickups {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    const spots = [
      [120, -120], [-120, 120], [200, -40], [-200, 40],
      [40, 280], [-40, -40], [280, 120], [-280, -120],
    ];
    for (const [x, z] of spots) this.spawn(x, z);
  }

  spawn(x, z) {
    const group = new THREE.Group();
    const bundle = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.35, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x2fae5a, roughness: 0.6, emissive: 0x1a5a2a, emissiveIntensity: 0.5 }),
    );
    bundle.position.y = 0.5;
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.4, 0.72),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }),
    );
    band.position.y = 0.5;
    const light = new THREE.PointLight(0x7dff9a, 2.2, 9, 1.6);
    light.position.y = 1.2;
    group.add(bundle, band, light);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.items.push({ group, x, z, taken: false, phase: Math.random() * 6 });
  }

  update(dt, time, player, onCollect) {
    for (const item of this.items) {
      if (item.taken) continue;
      item.group.position.y = 0.25 + Math.sin(time * 2 + item.phase) * 0.22;
      item.group.rotation.y += dt * 1.4;
      if (dist(player.x, player.z, item.x, item.z) < 2.6) {
        item.taken = true;
        this.scene.remove(item.group);
        onCollect(50);
      }
    }
  }
}
