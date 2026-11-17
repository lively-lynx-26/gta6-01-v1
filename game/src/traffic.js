// Traffic: civilian cars that cruise the road lattice, follow lanes, slow
// for the car ahead and turn at intersections. Parked cars line the kerbs
// and are the ones the player can steal.

import { VEHICLE_TYPES, CAR_COLORS, WORLD } from './config.js';
import { mulberry32, range, pick, chance, dist, clamp, angleLerp } from './random.js';
import { Vehicle, separateVehicles } from './vehicles.js';

export class TrafficManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32((Math.random() * 1e9) | 0);
    this.cars = [];       // moving traffic
    this.parked = [];     // stealable parked cars
    this.spawnedSpecials = {};
  }

  spawnInitial(count) {
    for (let i = 0; i < count; i++) this.spawnTrafficCar(true);
    this.spawnParkedCars();
  }

  spawnTrafficCar(anywhere) {
    const rng = this.rng;
    const type = chance(rng, 0.12) ? 'taxi' : (chance(rng, 0.15) ? 'van' : 'sedan');
    const color = type === 'taxi' ? 0xffc21c : pick(rng, CAR_COLORS);
    // Start on a road, in the right-hand lane for the direction of travel.
    const horizontal = chance(rng, 0.5);
    const roadLine = pick(rng, this.city.roadLines);
    const t = range(rng, -280, 280);
    const lane = 4;
    let x, z, heading;
    if (horizontal) {
      heading = chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2;
      x = t;
      z = roadLine + (heading === Math.PI / 2 ? lane : -lane);
    } else {
      heading = chance(rng, 0.5) ? 0 : Math.PI;
      x = roadLine + (heading === 0 ? -lane : lane);
      z = t;
    }
    const car = new Vehicle(type, color, x, z, heading);
    car.driver = 'traffic';
    car.cruise = range(rng, 11, 18);
    car.target = this.nextWaypoint(car);
    car.speed = car.cruise * 0.6;
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  // The next intersection along the car's road, or a turn onto the
  // crossing road. Waypoints are always road centrelines, so traffic
  // stays on the lattice instead of cutting through blocks.
  nextWaypoint(car) {
    const rng = this.rng;
    const lines = this.city.roadLines;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const alongX = Math.abs(fx) > Math.abs(fz);
    const nearestLine = (v) => {
      let best = lines[0], bd = Infinity;
      for (const p of lines) {
        const d = Math.abs(p - v);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    };
    if (alongX) {
      const roadZ = nearestLine(car.z);
      const dir = fx > 0 ? 1 : -1;
      let nextX = null;
      for (const p of lines) {
        if (dir > 0 && p > car.x + 10) { nextX = p; break; }
        if (dir < 0 && p < car.x - 10) { nextX = p; }
      }
      if (nextX === null) {
        // End of the road: turn around.
        return { x: clamp(car.x - fx * 80, -300, 300), z: roadZ };
      }
      if (chance(rng, 0.3)) {
        const turnDir = chance(rng, 0.5) ? 1 : -1;
        return { x: nextX, z: clamp(roadZ + turnDir * 70, -300, 300) };
      }
      return { x: nextX, z: roadZ };
    }
    const roadX = nearestLine(car.x);
    const dir = fz > 0 ? 1 : -1;
    let nextZ = null;
    for (const p of lines) {
      if (dir > 0 && p > car.z + 10) { nextZ = p; break; }
      if (dir < 0 && p < car.z - 10) { nextZ = p; }
    }
    if (nextZ === null) {
      return { x: roadX, z: clamp(car.z - fz * 80, -300, 300) };
    }
    if (chance(rng, 0.3)) {
      const turnDir = chance(rng, 0.5) ? 1 : -1;
      return { x: clamp(roadX + turnDir * 70, -300, 300), z: nextZ };
    }
    return { x: roadX, z: nextZ };
  }

  spawnParkedCars() {
    const rng = this.rng;
    const spots = [
      { x: 56, z: -206, heading: Math.PI / 2, type: 'comet', color: 0xc23b2e, key: 'comet' },
      { x: -36, z: 116, heading: 0, type: 'sedan', color: 0x2e6fc2 },
      { x: 124, z: -36, heading: Math.PI / 2, type: 'sedan', color: 0xe8e4da },
      { x: -124, z: -44, heading: -Math.PI / 2, type: 'van', color: 0x8a8f96 },
      { x: 204, z: 36, heading: 0, type: 'sedan', color: 0x4a7a3f },
      { x: -204, z: -124, heading: Math.PI, type: 'taxi', color: 0xffc21c },
      { x: 44, z: 196, heading: Math.PI / 2, type: 'sedan', color: 0xd8a13c },
      { x: -44, z: -276, heading: 0, type: 'sedan', color: 0x7a3fc2 },
    ];
    for (const s of spots) {
      const car = new Vehicle(s.type, s.color, s.x, s.z, s.heading);
      car.driver = null;
      this.scene.add(car.mesh);
      this.parked.push(car);
      if (s.key) this.spawnedSpecials[s.key] = car;
    }
  }

  // Spawn a specific car at a mission location (the armored van, the taxi).
  spawnSpecial(type, color, x, z, heading, key) {
    const car = new Vehicle(type, color, x, z, heading);
    car.driver = null;
    this.scene.add(car.mesh);
    this.parked.push(car);
    if (key) this.spawnedSpecials[key] = car;
    return car;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    this.cars = this.cars.filter((c) => c !== car);
    this.parked = this.parked.filter((c) => c !== car);
  }

  allCars() {
    return this.cars.concat(this.parked);
  }

  // Steer toward the current waypoint; slow for the car ahead.
  update(dt, playerPos, time) {
    const colliders = this.city.colliders;
    for (const car of this.cars) {
      const dx = car.target.x - car.x, dz = car.target.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) car.target = this.nextWaypoint(car);
      const desired = Math.atan2(dx, dz);
      const steer = clamp(angleLerp(0, desired - car.heading, 1) * 1.4, -1, 1);
      // Look ahead for a slower car in front and brake.
      let throttle = 1;
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      for (const other of this.allCars()) {
        if (other === car) continue;
        const ox = other.x - car.x, oz = other.z - car.z;
        const ahead = ox * fx + oz * fz;
        const side = Math.abs(ox * fz - oz * fx);
        if (ahead > 0 && ahead < 13 && side < 3.4) {
          throttle = ahead < 6 ? -0.6 : 0.15;
          break;
        }
      }
      // And for the player standing in the way.
      if (playerPos) {
        const px = playerPos.x - car.x, pz = playerPos.z - car.z;
        const ahead = px * fx + pz * fz;
        const side = Math.abs(px * fz - pz * fx);
        if (ahead > 0 && ahead < 9 && side < 2.6) throttle = -0.5;
      }
      // Ease toward cruise speed instead of flooring it.
      const want = car.cruise * (throttle > 0 ? throttle : 0);
      const applied = car.speed < want ? 1 : (throttle < 0 ? -1 : 0);
      car.step(dt, applied, steer, false, colliders, time);
      // Keep traffic on the roads: if it drifted off, re-aim at the lattice.
      if (Math.abs(car.x) > WORLD.half + 20 || Math.abs(car.z) > WORLD.half + 20) {
        const p = this.city.randomRoadPoint(this.rng);
        car.x = p.x; car.z = p.z;
        car.target = this.nextWaypoint(car);
      }
      car.sync(dt);
    }
    // Car-car separation so traffic does not stack.
    const all = this.allCars();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (dist(all[i].x, all[i].z, all[j].x, all[j].z) < 5.5) {
          separateVehicles(all[i], all[j]);
        }
      }
    }
    // Top the traffic back up if the player wrecked some.
    if (this.cars.length < 9 && Math.random() < dt * 0.25) {
      this.spawnTrafficCar(false);
    }
  }
}
