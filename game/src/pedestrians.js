// Pedestrians: ordinary Solmar Bay residents strolling the sidewalks.
// They walk between sidewalk waypoints, turn at intersections, and run
// screaming from gunshots, car crashes and police chases nearby.

import { mulberry32, range, pick, chance, dist, clamp, angleLerp } from './random.js';
import { stepWalker } from './physics.js';
import { buildPedestrianMesh } from './models.js';

export class PedestrianManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32((Math.random() * 1e9) | 0);
    this.peds = [];
    this.fleeEvents = []; // {x, z, time}
  }

  spawnInitial(count) {
    for (let i = 0; i < count; i++) this.spawnPed();
  }

  spawnPed() {
    const rng = this.rng;
    const p = this.city.randomSidewalkPoint(rng);
    const mesh = buildPedestrianMesh((rng() * 1e9) | 0);
    mesh.position.set(p.x, 0, p.z);
    const ped = {
      mesh,
      x: p.x,
      z: p.z,
      heading: rng() * Math.PI * 2,
      target: this.city.randomSidewalkPoint(rng),
      speed: range(rng, 1.2, 2.4),
      state: 'walk', // 'walk' | 'flee' | 'down'
      fleeUntil: 0,
      walkPhase: rng() * Math.PI * 2,
      health: 100,
      dead: false,
    };
    mesh.rotation.y = ped.heading;
    this.scene.add(mesh);
    this.peds.push(ped);
    return ped;
  }

  // A loud event (gunshot, crash) makes nearby pedestrians flee.
  scare(x, z, radius, time) {
    this.fleeEvents.push({ x, z, time });
    for (const ped of this.peds) {
      if (ped.dead) continue;
      if (dist(ped.x, ped.z, x, z) < radius) {
        ped.state = 'flee';
        ped.fleeUntil = time + range(this.rng, 3, 6);
        // Run directly away from the scare.
        const a = Math.atan2(ped.x - x, ped.z - z);
        ped.target = {
          x: ped.x + Math.sin(a) * 40,
          z: ped.z + Math.cos(a) * 40,
        };
      }
    }
  }

  // Damage a pedestrian (shot or run over). Returns true if it went down.
  hit(ped, damage, time) {
    if (ped.dead) return false;
    ped.health -= damage;
    if (ped.health <= 0) {
      ped.dead = true;
      ped.state = 'down';
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.25;
      this.scare(ped.x, ped.z, 30, time);
      return true;
    }
    ped.state = 'flee';
    ped.fleeUntil = time + 4;
    return false;
  }

  update(dt, time) {
    for (const ped of this.peds) {
      if (ped.dead) continue;
      if (ped.state === 'flee' && time > ped.fleeUntil) ped.state = 'walk';
      const speed = ped.state === 'flee' ? 5.2 : ped.speed;
      const dx = ped.target.x - ped.x, dz = ped.target.z - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.5) {
        ped.target = ped.state === 'flee'
          ? this.city.randomSidewalkPoint(this.rng)
          : this.city.randomSidewalkPoint(this.rng);
        continue;
      }
      const desired = Math.atan2(dx, dz);
      ped.heading = angleLerp(ped.heading, desired, Math.min(1, dt * 6));
      stepWalker(ped, Math.sin(ped.heading), Math.cos(ped.heading), speed, dt, 0.5,
        this.city.colliders, 330);
      // Walk-cycle animation: legs and arms swing in opposition.
      ped.walkPhase += dt * speed * 3.4;
      const swing = Math.sin(ped.walkPhase) * 0.55;
      const u = ped.mesh.userData;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.7;
      u.armR.rotation.x = swing * 0.7;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
    // Keep the streets populated.
    const alive = this.peds.filter((p) => !p.dead).length;
    if (alive < 20 && Math.random() < dt * 0.5) this.spawnPed();
  }

  // The nearest living pedestrian to a point, within maxDist.
  nearest(x, z, maxDist) {
    let best = null, bestD = maxDist;
    for (const ped of this.peds) {
      if (ped.dead) continue;
      const d = dist(ped.x, ped.z, x, z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    return best;
  }
}
