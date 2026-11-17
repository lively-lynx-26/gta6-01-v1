// Wanted system and the Solmar Bay Police.
// Crimes raise the wanted level; cruisers spawn on the roads, chase the
// player, ram the player's car, and try to bust the player on foot.
// When the player stays out of sight, the heat cools off one star at a time.

import { GAME, PALETTE } from './config.js';
import { mulberry32, range, pick, chance, dist, clamp, angleLerp } from './random.js';
import { Vehicle, separateVehicles } from './vehicles.js';

export class PoliceManager {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;
    this.rng = mulberry32((Math.random() * 1e9) | 0);
    this.wanted = 0;
    this.heat = 0;           // 0..1, how "hot" the player is right now
    this.lastSeenAt = -100;  // last time a cruiser had line of sight
    this.cruisers = [];
    this.bustMeter = 0;      // fills while a cruiser sits next to the player on foot
    this.onWantedChange = null;
  }

  setWanted(level, silent) {
    const next = clamp(level, 0, GAME.maxWanted);
    const changed = next !== this.wanted;
    this.wanted = next;
    if (next > 0) this.lastSeenAt = this.time || 0;
    if (changed && this.onWantedChange) this.onWantedChange(next);
    return changed;
  }

  addWanted(amount, time) {
    if (this.wanted >= GAME.maxWanted) return;
    this.setWanted(this.wanted + amount);
    this.lastSeenAt = time;
  }

  clearWanted() {
    this.setWanted(0);
    this.bustMeter = 0;
    for (const c of this.cruisers) {
      this.scene.remove(c.mesh);
    }
    this.cruisers = [];
  }

  spawnCruiser(playerPos) {
    // Spawn on a road 60-90 units away, on the lattice.
    const rng = this.rng;
    const a = rng() * Math.PI * 2;
    const d = range(rng, 55, 85);
    let x = playerPos.x + Math.sin(a) * d;
    let z = playerPos.z + Math.cos(a) * d;
    x = clamp(x, -300, 300);
    z = clamp(z, -300, 300);
    const near = this.city.nearestRoadPoint(x, z);
    const heading = Math.atan2(playerPos.x - near.x, playerPos.z - near.z);
    const cruiser = new Vehicle('police', PALETTE.policeWhite, near.x, near.z, heading);
    cruiser.driver = 'police';
    cruiser.cruise = 30;
    this.scene.add(cruiser.mesh);
    this.cruisers.push(cruiser);
    return cruiser;
  }

  update(dt, time, player, playerCar, trafficCars) {
    this.time = time;
    const playerPos = player.pos;
    const wantCount = this.wanted === 0 ? 0 : Math.min(this.wanted + 1, 5);
    // Spawn cruisers up to the wanted level's demand.
    if (this.cruisers.length < wantCount && Math.random() < dt * 1.6) {
      this.spawnCruiser(player);
    }
    // Despawn cruisers that fell far behind once the heat is off.
    if (this.wanted === 0) {
      for (const c of this.cruisers) {
        if (dist(c.x, c.z, playerPos.x, playerPos.z) > 130) {
          this.scene.remove(c.mesh);
          this.cruisers = this.cruisers.filter((x) => x !== c);
        }
      }
    }

    let anyNear = false;
    for (const cruiser of this.cruisers) {
      const dPlayer = dist(cruiser.x, cruiser.z, playerPos.x, playerPos.z);
      if (dPlayer < 55) {
        anyNear = true;
        this.lastSeenAt = time;
      }
      // Pursuit steering: aim at the player's current position, with a
      // little prediction so the chase looks intentional, not robotic.
      const predict = playerCar ? 0.35 : 0.15;
      const tx = playerPos.x + Math.sin(player.heading || 0) * (playerCar ? playerCar.speed : 0) * predict;
      const tz = playerPos.z + Math.cos(player.heading || 0) * (playerCar ? playerCar.speed : 0) * predict;
      const desired = Math.atan2(tx - cruiser.x, tz - cruiser.z);
      const steer = clamp(angleLerp(0, desired - cruiser.heading, 1) * 1.6, -1, 1);
      // Full throttle while chasing; ease off when right on top of the player.
      let throttle = 1;
      if (dPlayer < 7) throttle = 0.4;
      const hardHit = cruiser.step(dt, throttle, steer, false, this.city.colliders, time);
      if (hardHit && dPlayer < 12) {
        // Ramming the player's car damages it; hitting the player hurts.
        if (playerCar) playerCar.damage(6);
        else player.damage(8, time);
      }
      cruiser.sync(dt);
    }
    // Cruiser vs traffic separation.
    for (const c of this.cruisers) {
      for (const t of trafficCars) {
        if (dist(c.x, c.z, t.x, t.z) < 5.5) separateVehicles(c, t);
      }
    }

    // Bust meter: on foot, a cruiser parked beside the player busts them.
    if (!playerCar && this.wanted > 0) {
      let close = false;
      for (const c of this.cruisers) {
        if (dist(c.x, c.z, playerPos.x, playerPos.z) < 7 && Math.abs(c.speed) < 4) close = true;
      }
      this.bustMeter = close
        ? this.bustMeter + dt / 3.5
        : Math.max(0, this.bustMeter - dt / 2);
    } else {
      this.bustMeter = Math.max(0, this.bustMeter - dt / 2);
    }

    // Heat decay: unseen for a while, the wanted level drops a star.
    if (this.wanted > 0 && time - this.lastSeenAt > GAME.wantedDecaySeconds) {
      this.setWanted(this.wanted - 1);
      this.lastSeenAt = time;
    }

    // Siren while any cruiser is close and the player is wanted.
    if (this.audio) this.audio.siren(this.wanted > 0 && anyNear);
    this.heat = this.wanted > 0 ? clamp(1 - (time - this.lastSeenAt) / GAME.wantedDecaySeconds, 0, 1) : 0;
  }
}
