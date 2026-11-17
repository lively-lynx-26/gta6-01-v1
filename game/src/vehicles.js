// Vehicle entity: one car in the world. It owns its mesh, its physics state
// and its health, and steps itself through the custom physics engine.
// Drivers are decided outside: the player, traffic AI or police AI feed it
// throttle / steer / handbrake each frame.

import { VEHICLE_TYPES } from './config.js';
import { stepCar, resolveCircleVsBoxes, resolveCircleVsCircle } from './physics.js';
import { buildCarMesh } from './models.js';

let nextId = 1;

export class Vehicle {
  constructor(type, color, x, z, heading) {
    this.id = nextId++;
    this.type = type;
    this.spec = VEHICLE_TYPES[type];
    this.color = color;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.slideX = 0;
    this.slideZ = 0;
    this.health = 100;
    this.driver = null; // 'player' | 'traffic' | 'police' | null (parked)
    this.dead = false;
    this.smoking = false;
    this.mesh = buildCarMesh(type, color);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.radius = Math.max(this.spec.len, this.spec.wid) * 0.52;
    this.lastHitAt = -10;
  }

  // Drive one physics step with the given inputs, then collide with the world.
  // Returns true when the car hit a building hard enough to matter.
  step(dt, throttle, steer, handbrake, colliders, time) {
    stepCar(this, dt, throttle, steer, handbrake, this.spec);
    const beforeX = this.x, beforeZ = this.z;
    const pos = { x: this.x, z: this.z };
    const hit = resolveCircleVsBoxes(pos, this.radius, colliders);
    this.x = pos.x;
    this.z = pos.z;
    if (hit) {
      // A wall hit kills speed and rattles the car; a hard hit damages it.
      const impact = Math.abs(this.speed);
      this.speed *= 0.45;
      if (impact > 10 && time - this.lastHitAt > 0.4) {
        this.lastHitAt = time;
        this.damage(impact * 0.9);
        return true;
      }
    }
    void beforeX; void beforeZ;
    return false;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 35) this.smoking = true;
    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      this.health = 0;
    }
  }

  repair() {
    this.health = 100;
    this.dead = false;
    this.smoking = false;
  }

  // Sync the mesh to the physics state and animate the wheels.
  sync(dt) {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const wheels = this.mesh.userData.wheels;
    if (wheels) {
      const spin = (this.speed / 0.36) * dt;
      for (const w of wheels) {
        w.spin += spin;
        w.pivot.rotation.x = w.spin;
      }
    }
    // Police light bar flashes while the cruiser is on duty.
    const bar = this.mesh.userData.lightBar;
    if (bar && this.driver === 'police') {
      const phase = Math.floor(performance.now() / 180) % 2 === 0;
      bar[0].material.emissiveIntensity = phase ? 3 : 0.2;
      bar[1].material.emissiveIntensity = phase ? 0.2 : 3;
    }
  }
}

// Circle-vs-circle separation between two vehicles, with a speed exchange.
export function separateVehicles(a, b) {
  const overlap = resolveCircleVsCircle(a, a.radius, b, b.radius);
  if (overlap > 0) {
    const total = Math.abs(a.speed) + Math.abs(b.speed) + 1;
    const aShare = Math.abs(b.speed) / total;
    a.speed *= (1 - 0.25 * aShare);
    b.speed *= (1 - 0.25 * (1 - aShare));
    return true;
  }
  return false;
}
