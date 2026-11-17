// Rivals: Kane Voss's crew, the only armed NPCs in the game. They spawn for
// combat missions, take cover positions, strafe and shoot at the player,
// and drop cash when they go down.

import * as THREE from 'three';
import { mulberry32, range, dist, clamp, angleLerp } from './random.js';
import { buildPedestrianMesh } from './models.js';
import { stepWalker } from './physics.js';

export class EnemyManager {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;
    this.rng = mulberry32((Math.random() * 1e9) | 0);
    this.enemies = [];
    this.onEnemyDown = null;
  }

  spawnSquad(cx, cz, count, opts = {}) {
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const x = cx + range(this.rng, -10, 10);
      const z = cz + range(this.rng, -10, 10);
      const mesh = buildPedestrianMesh((this.rng() * 1e9) | 0, {
        shirt: opts.shirt ?? 0x1a1a1a, pants: 0x2a2a2a, skin: 0xc98d64, hair: 0x111111,
      });
      mesh.position.set(x, 0, z);
      // A red bandana marker so rivals read as hostile at a glance.
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.4),
        new THREE.MeshStandardMaterial({ color: 0xd21f1f, roughness: 0.6 }));
      band.position.set(0, 1.78, 0);
      mesh.add(band);
      this.scene.add(mesh);
      const enemy = {
        mesh,
        x, z,
        heading: this.rng() * Math.PI * 2,
        health: 100,
        dead: false,
        shootCooldown: range(this.rng, 0.5, 1.5),
        strafeDir: this.rng() < 0.5 ? 1 : -1,
        strafeTimer: 0,
        walkPhase: this.rng() * 6,
        home: { x: cx, z: cz },
      };
      this.enemies.push(enemy);
      spawned.push(enemy);
    }
    return spawned;
  }

  hit(enemy, damage) {
    if (enemy.dead) return false;
    enemy.health -= damage;
    if (enemy.health <= 0) {
      enemy.dead = true;
      enemy.mesh.rotation.x = -Math.PI / 2;
      enemy.mesh.position.y = 0.25;
      if (this.onEnemyDown) this.onEnemyDown(enemy);
      return true;
    }
    return false;
  }

  // A rival shoots at the player: a short tracer and a chance to hit.
  // Returns 'hit' | 'miss' | null.
  enemyShoot(enemy, player, time) {
    const d = dist(enemy.x, enemy.z, player.x, player.z);
    if (d > 55 || enemy.dead) return null;
    if (enemy.shootCooldown > 0) return null;
    enemy.shootCooldown = range(this.rng, 0.9, 1.9);
    if (this.audio) this.audio.gunshot();
    // Hit chance falls with distance and rises if the player is close.
    const p = clamp(0.55 - d / 140, 0.08, 0.5);
    const hit = this.rng() < p;
    if (hit) player.damage(range(this.rng, 6, 12), time);
    // Tracer line from the rival toward the player.
    this.spawnTracer(enemy, player);
    return hit ? 'hit' : 'miss';
  }

  spawnTracer(enemy, player) {
    const from = new THREE.Vector3(enemy.x, 1.3, enemy.z);
    const to = new THREE.Vector3(player.x, 1.2, player.z);
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.9,
    }));
    this.scene.add(line);
    setTimeout(() => {
      this.scene.remove(line);
      geo.dispose();
    }, 90);
  }

  clearAll() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  update(dt, time, player) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.shootCooldown -= dt;
      const d = dist(e.x, e.z, player.x, player.z);
      if (d < 45) {
        // Face the player, strafe sideways, keep a firing distance.
        const desired = Math.atan2(player.x - e.x, player.z - e.z);
        e.heading = angleLerp(e.heading, desired, Math.min(1, dt * 8));
        e.strafeTimer -= dt;
        if (e.strafeTimer <= 0) {
          e.strafeTimer = range(this.rng, 0.8, 1.8);
          e.strafeDir = this.rng() < 0.5 ? 1 : -1;
        }
        const side = e.strafeDir;
        const mx = Math.cos(e.heading) * side;
        const mz = -Math.sin(e.heading) * side;
        const approach = d > 26 ? 1 : d < 12 ? -1 : 0;
        const ax = Math.sin(e.heading) * approach;
        const az = Math.cos(e.heading) * approach;
        stepWalker(e, mx + ax, mz + az, 3.2, dt, 0.5, this.city.colliders, 330);
        this.enemyShoot(e, player, time);
        e.walkPhase += dt * 5;
        const swing = Math.sin(e.walkPhase) * 0.5;
        const u = e.mesh.userData;
        u.legL.rotation.x = swing;
        u.legR.rotation.x = -swing;
      } else {
        // Idle near home: slow patrol.
        e.walkPhase += dt * 2;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
    }
  }
}
