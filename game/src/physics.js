// Custom physics engine, written from scratch for Solmar Bay.
// No physics library is used. It covers:
//  - arcade vehicle dynamics (engine, braking, steering, drift, drag)
//  - circle vs axis-aligned-box collision for buildings and props
//  - circle vs circle collision for cars and pedestrians
//  - on-foot character movement with the same collision world

import { clamp } from './random.js';

// A building or prop collider: an axis-aligned box on the ground plane.
export function makeBox(minX, minZ, maxX, maxZ) {
  return { minX, minZ, maxX, maxZ };
}

// Push a circle out of a box. Returns the corrected position, or null
// when there is no overlap. Also reports the hit normal for bounce.
export function circleVsBox(px, pz, r, box) {
  const cx = clamp(px, box.minX, box.maxX);
  const cz = clamp(pz, box.minZ, box.maxZ);
  const dx = px - cx, dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    return { x: px + dx * push, z: pz + dz * push, nx: dx / d, nz: dz / d, depth: r - d };
  }
  // Centre is inside the box: push out along the smallest penetration axis.
  const left = px - box.minX, right = box.maxX - px;
  const top = pz - box.minZ, bottom = box.maxZ - pz;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: box.minX - r, z: pz, nx: -1, nz: 0, depth: left + r };
  if (m === right) return { x: box.maxX + r, z: pz, nx: 1, nz: 0, depth: right + r };
  if (m === top) return { x: px, z: box.minZ - r, nx: 0, nz: -1, depth: top + r };
  return { x: px, z: box.maxZ + r, nx: 0, nz: 1, depth: bottom + r };
}

// Resolve a circle against a list of boxes, in place. Returns true on any hit.
export function resolveCircleVsBoxes(pos, r, boxes) {
  let hit = false;
  for (const box of boxes) {
    const res = circleVsBox(pos.x, pos.z, r, box);
    if (res) {
      pos.x = res.x;
      pos.z = res.z;
      hit = true;
    }
  }
  return hit;
}

// Push two circles apart. Returns the overlap depth (0 when separate).
export function resolveCircleVsCircle(a, ra, b, rb) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d2 = dx * dx + dz * dz;
  const min = ra + rb;
  if (d2 >= min * min || d2 < 1e-8) return 0;
  const d = Math.sqrt(d2);
  const push = (min - d) / 2;
  const nx = dx / d, nz = dz / d;
  a.x -= nx * push; a.z -= nz * push;
  b.x += nx * push; b.z += nz * push;
  return min - d;
}

// Arcade car step. The car is a point with a heading and a forward speed;
// lateral velocity is implicit in the drift model, which keeps the feel
// tight at low speed and loose with the handbrake at high speed.
export function stepCar(car, dt, throttle, steerInput, handbrake, spec) {
  const maxFwd = spec.topSpeed;
  const maxRev = spec.topSpeed * 0.42;
  if (throttle > 0) {
    car.speed += spec.accel * throttle * dt * (1 - Math.max(0, car.speed) / (maxFwd * 1.15));
  } else if (throttle < 0) {
    if (car.speed > 0.5) {
      car.speed -= spec.brake * dt; // braking while moving forward
    } else {
      car.speed -= spec.accel * 0.7 * dt; // reversing
      if (car.speed < -maxRev) car.speed = -maxRev;
    }
  }
  // Rolling drag and handbrake slide.
  const drag = handbrake ? 0.35 : 0.55;
  car.speed -= car.speed * drag * dt;
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
  if (car.speed > maxFwd) car.speed = maxFwd;

  // Steering: stronger at speed, weaker when crawling, reversed in reverse.
  const speedFactor = clamp(Math.abs(car.speed) / 12, 0.12, 1);
  const grip = handbrake ? spec.grip * 0.45 : spec.grip;
  const steerAngle = steerInput * spec.turn * speedFactor;
  car.heading += steerAngle * (car.speed >= 0 ? 1 : -1) * dt * (1.6 - grip * 0.08);

  // Drift: with the handbrake the car keeps some of its old direction.
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  if (handbrake && Math.abs(car.speed) > 8) {
    car.slideX = (car.slideX || 0) * (1 - 2.2 * dt) + fx * car.speed * dt * 0.35;
    car.slideZ = (car.slideZ || 0) * (1 - 2.2 * dt) + fz * car.speed * dt * 0.35;
    car.x += car.slideX * 0.4;
    car.z += car.slideZ * 0.4;
  } else {
    car.slideX = 0;
    car.slideZ = 0;
  }
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;
}

// Move a walking character (player or pedestrian) with collision.
// dirX/dirZ is the desired direction; speed is units per second.
export function stepWalker(pos, dirX, dirZ, speed, dt, radius, boxes, bounds) {
  const len = Math.hypot(dirX, dirZ);
  if (len < 1e-6) return false;
  const nx = dirX / len, nz = dirZ / len;
  pos.x += nx * speed * dt;
  pos.z += nz * speed * dt;
  // Clamp to the playable world.
  pos.x = clamp(pos.x, -bounds, bounds);
  pos.z = clamp(pos.z, -bounds, bounds + 60);
  return resolveCircleVsBoxes(pos, radius, boxes);
}
