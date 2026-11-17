// The player: Dario Cruz on foot, and in any car he can reach.
// On foot he walks, sprints, orbits the camera with the mouse and shoots
// his pistol. Near a car, E steals or enters it; in a car, E steps out.

import * as THREE from 'three';
import { GAME } from './config.js';
import { clamp, dist, angleLerp } from './random.js';
import { stepWalker } from './physics.js';
import { buildPlayerMesh } from './models.js';

export class Player {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;
    this.x = GAME.startPos.x;
    this.z = GAME.startPos.z;
    this.heading = 0;        // facing direction
    this.camYaw = 0;         // camera orbit angle
    this.camPitch = 0.32;
    this.camDist = 9;
    this.health = GAME.playerHealth;
    this.ammo = GAME.pistolMag;
    this.inCar = null;       // Vehicle or null
    this.speed = 0;
    this.walkPhase = 0;
    this.muzzleFlash = null;
    this.lastDamageAt = -10;
    this.mesh = buildPlayerMesh();
    this.mesh.position.set(this.x, 0, this.z);
    this.scene.add(this.mesh);
    this.aimTarget = new THREE.Vector3();
  }

  get pos() {
    return this.inCar ? { x: this.inCar.x, z: this.inCar.z } : { x: this.x, z: this.z };
  }

  damage(amount, time) {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.lastDamageAt = time;
    if (this.audio) this.audio.thud();
  }

  heal(amount) {
    this.health = Math.min(GAME.playerHealth, this.health + amount);
  }

  reload() {
    if (this.ammo < GAME.pistolMag) {
      this.ammo = GAME.pistolMag;
      if (this.audio) this.audio.click();
    }
  }

  // Fire the pistol from the camera through the crosshair. Returns a hit
  // description for the game to resolve, or null when nothing was hit.
  shoot(camera, enemies, peds, cars, time) {
    if (this.ammo <= 0) {
      this.reload();
      return { kind: 'dry' };
    }
    this.ammo--;
    if (this.audio) this.audio.gunshot();
    this.showMuzzle(camera);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone();
    const range = GAME.pistolRange;
    let best = null, bestD = range;
    const consider = (px, pz, py, kind, ref) => {
      // Distance from the ray to the target's centre, in the XZ plane plus height.
      const dx = px - origin.x, dz = pz - origin.z;
      const along = dx * dir.x + dz * dir.z;
      if (along < 1 || along > bestD) return;
      const cx = origin.x + dir.x * along;
      const cz = origin.z + dir.z * along;
      const miss = Math.hypot(px - cx, pz - cz);
      const radius = kind === 'ped' ? 0.9 : kind === 'enemy' ? 1.0 : 2.4;
      if (miss < radius) {
        best = { kind, ref, dist: along, x: px, z: pz };
        bestD = along;
      }
    };
    for (const e of enemies) {
      if (!e.dead) consider(e.x, e.z, 1.2, 'enemy', e);
    }
    for (const p of peds) {
      if (!p.dead) consider(p.x, p.z, 1.2, 'ped', p);
    }
    for (const c of cars) {
      if (c !== this.inCar) consider(c.x, c.z, 1.0, 'car', c);
    }
    return best || { kind: 'miss', dist: range };
  }

  showMuzzle(camera) {
    if (!this.muzzleFlash) {
      this.muzzleFlash = new THREE.PointLight(0xffc860, 0, 14, 1.8);
      this.scene.add(this.muzzleFlash);
    }
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    this.muzzleFlash.position.copy(camera.position).addScaledVector(dir, 2.5);
    this.muzzleFlash.intensity = 26;
    setTimeout(() => { if (this.muzzleFlash) this.muzzleFlash.intensity = 0; }, 60);
  }

  // Find the nearest enterable car within reach.
  nearestCar(cars, maxDist) {
    let best = null, bestD = maxDist;
    for (const c of cars) {
      if (c.dead || c.driver === 'police') continue;
      const d = dist(this.x, this.z, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  enterCar(car, time) {
    this.inCar = car;
    car.driver = 'player';
    this.mesh.visible = false;
    return car;
  }

  exitCar() {
    if (!this.inCar) return null;
    const car = this.inCar;
    car.driver = null;
    this.inCar = null;
    // Step out on the driver's side.
    const sideX = Math.cos(car.heading), sideZ = -Math.sin(car.heading);
    this.x = car.x + sideX * 2.2;
    this.z = car.z + sideZ * 2.2;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    return car;
  }

  update(dt, input, time) {
    if (this.inCar) {
      // The car's own step runs in main.js; keep the player mesh parked.
      this.x = this.inCar.x;
      this.z = this.inCar.z;
      this.heading = this.inCar.heading;
      this.camYaw = angleLerp(this.camYaw, this.inCar.heading + Math.PI, Math.min(1, dt * 2.2));
      return;
    }
    const mouse = input.consumeMouse();
    this.camYaw -= mouse.dx * 0.0042;
    this.camPitch = clamp(this.camPitch + mouse.dy * 0.003, 0.08, 1.1);
    const { fwd, strafe } = input.axes();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? GAME.playerRunSpeed : GAME.playerWalkSpeed;
    // Movement is relative to the camera yaw. The camera sits at the player
    // plus (sin yaw, cos yaw), so it looks along (-sin yaw, -cos yaw); W
    // walks that way and D strafes to its right, (cos yaw, -sin yaw).
    const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
    const mx = -sin * fwd + cos * strafe;
    const mz = -cos * fwd - sin * strafe;
    const moving = Math.abs(fwd) + Math.abs(strafe) > 0;
    if (moving) {
      stepWalker(this, mx, mz, speed, dt, 0.6, this.city.colliders, 330);
      this.speed = speed;
      this.heading = angleLerp(this.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
      this.walkPhase += dt * speed * 1.9;
      const swing = Math.sin(this.walkPhase) * 0.6;
      const u = this.mesh.userData;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.7;
      u.armR.rotation.x = swing * 0.7;
    } else {
      this.speed = 0;
      const u = this.mesh.userData;
      u.legL.rotation.x *= 0.8;
      u.legR.rotation.x *= 0.8;
      u.armL.rotation.x *= 0.8;
      u.armR.rotation.x *= 0.8;
    }
    // Slow health regen when out of trouble for a while.
    if (time - this.lastDamageAt > 8 && this.health > 0 && this.health < GAME.playerHealth) {
      this.health = Math.min(GAME.playerHealth, this.health + dt * 2.5);
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }
}
