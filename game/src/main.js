// Solmar Bay — Neon Tide. Bootstrap, game loop, camera, state machine and
// the wiring between every module. The entry point the page loads.

import * as THREE from 'three';
import { WORLD, GAME, VEHICLE_TYPES, CHARACTERS } from './config.js';
import { clamp, dist } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { City } from './city.js';
import { Player } from './player.js';
import { TrafficManager } from './traffic.js';
import { PedestrianManager } from './pedestrians.js';
import { PoliceManager } from './police.js';
import { EnemyManager } from './enemies.js';
import { MissionManager, MISSION_DEFS, CashPickups } from './missions.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { applyShotMode } from './shots.js';

const canvas = document.getElementById('game-canvas');
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const wastedEl = document.getElementById('wasted');
const wastedSub = document.getElementById('wasted-sub');
const loadingEl = document.getElementById('loading');

export class Game {
  constructor() {
    this.state = 'menu'; // menu | playing | paused | wasted | busted
    this.time = 0;
    this.cash = GAME.startCash;
    this.day = 1;
    this.clockMinutes = 9 * 60;
    this.carsStolen = 0;
    this.missionsDone = 0;
    this.crimeCooldown = 0;
    this.orbitOffset = 0;
    this.shotDrive = false;
    this.shotMode = null;
    this.snapCam = false;      // set by shot staging: snap the camera once
    this.camDistOverride = 0;  // set by shot staging: camera distance
    this.camHeightOverride = 0; // set by shot staging: camera height
    this.saveTimer = 0;
    this.respawnTimer = 0;
    this.frameCount = 0;
    this.fpsAccum = 0;
    this.fpsFrames = 0;

    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.hud = new HUD();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xcfe9f7, 200, 1100);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.camera.position.set(0, 30, 60);

    // Sun: warm directional light with a shadow frustum that follows the player.
    this.sun = new THREE.DirectionalLight(0xfff2c0, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -120;
    this.sun.shadow.camera.right = 120;
    this.sun.shadow.camera.top = 120;
    this.sun.shadow.camera.bottom = -120;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 600;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    const hemi = new THREE.HemisphereLight(0x9fd4ff, 0x8a7a5a, 0.9);
    this.scene.add(hemi);

    this.city = new City(this.scene);
    this.player = new Player(this.scene, this.city, this.audio);
    this.traffic = new TrafficManager(this.scene, this.city);
    this.peds = new PedestrianManager(this.scene, this.city);
    this.police = new PoliceManager(this.scene, this.city, this.audio);
    this.enemies = new EnemyManager(this.scene, this.city, this.audio);
    this.pickups = new CashPickups(this.scene);
    this.missions = new MissionManager(this.scene, {
      onToast: (t) => this.hud.showToast(t),
      onCash: (amount) => { this.addCash(amount); },
      onMissionStart: (def) => { this.hud.showToast(def.name); },
      onMissionComplete: () => {
        this.missionsDone++;
        this.audio.missionDone();
        this.writeSave();
      },
      onAllComplete: () => {
        this.hud.showToast('KING OF SOLMAR — YOU OWN THE BAY');
        this.audio.missionDone();
      },
      onSpawnSquad: (x, z, count) => { this.enemies.spawnSquad(x, z, count); },
      onWanted: (level) => { this.police.setWanted(level); },
    });
    this.enemies.onEnemyDown = (enemy) => {
      this.missions.onEnemyKilled();
      this.addCash(25);
      this.hud.showToast('RIVAL DOWN  +$25');
    };
    this.police.onWantedChange = (level) => {
      if (level >= 3) this.hud.showToast('THE HEAT IS ON — LOSE THEM!');
    };

    this.traffic.spawnInitial(12);
    this.peds.spawnInitial(26);
    // The mission taxi and the armored van wait at their story spots.
    this.traffic.spawnSpecial('taxi', 0xffc21c, 8, -204, Math.PI / 2, 'taxi');
    this.traffic.spawnSpecial('armored', 0x3a3f45, 212, 216, Math.PI, 'armored');

    this.bindMenu();
    this.bindKeys();
    window.addEventListener('resize', () => this.resize());

    // Debug / playtest handle (used by the automated checks, not by players).
    window.__solmar = {
      game: this,
      player: this.player,
      police: this.police,
      missions: this.missions,
      traffic: this.traffic,
      peds: this.peds,
      enemies: this.enemies,
      state: () => this.state,
      version: 'solmar-bay-1.0',
    };

    // Screenshot staging: ?shot=chase|drive|foot|mission skips the menu.
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      this.shotMode = shot;
      this.startNewGame(true);
      applyShotMode(this, shot);
    } else if (hasSave()) {
      document.getElementById('btn-continue').style.display = 'inline-block';
    }

    this.lastT = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
    loadingEl.style.display = 'none';
  }

  bindMenu() {
    document.getElementById('btn-new').addEventListener('click', () => {
      this.audio.ensure();
      this.audio.click();
      clearSave();
      this.startNewGame(false);
    });
    document.getElementById('btn-continue').addEventListener('click', () => {
      this.audio.ensure();
      this.audio.click();
      this.startContinue();
    });
    document.getElementById('btn-resume').addEventListener('click', () => {
      this.audio.click();
      this.setState('playing');
    });
    document.getElementById('btn-save-quit').addEventListener('click', () => {
      this.audio.click();
      this.writeSave();
      this.setState('menu');
    });
  }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        this.audio.ensure();
        const muted = this.audio.toggleMute();
        this.hud.showToast(muted ? 'SOUND OFF' : 'SOUND ON');
      }
      if (e.code === 'KeyH' && this.state === 'playing') {
        this.hud.showToast('WASD move · E car · Click shoot · R reload · Shift sprint · Space handbrake');
      }
      if ((e.code === 'Escape' || e.code === 'KeyP') && !this.shotMode) {
        if (this.state === 'playing') this.setState('paused');
        else if (this.state === 'paused') this.setState('playing');
      }
    });
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setState(next) {
    this.state = next;
    menuEl.classList.toggle('hidden', next !== 'menu');
    pauseEl.classList.toggle('hidden', next !== 'paused');
    if (next === 'paused') {
      document.getElementById('pause-stats').textContent =
        `Cash $${this.cash.toLocaleString('en-US')} · Missions done ${this.missionsDone} / ${MISSION_DEFS.length} · Cars stolen ${this.carsStolen} · Day ${this.day}`;
    }
    if (next === 'menu' && hasSave()) {
      document.getElementById('btn-continue').style.display = 'inline-block';
    }
  }

  startNewGame(skipMenu) {
    this.cash = GAME.startCash;
    this.day = 1;
    this.clockMinutes = 9 * 60;
    this.carsStolen = 0;
    this.missionsDone = 0;
    this.player.health = GAME.playerHealth;
    this.player.ammo = GAME.pistolMag;
    this.player.x = GAME.startPos.x;
    this.player.z = GAME.startPos.z;
    this.player.heading = Math.PI;
    this.player.camYaw = 0; // camera behind the player, looking north
    this.police.clearWanted();
    this.enemies.clearAll();
    this.missions.missionIndex = 0;
    this.missions.finishedAll = false;
    this.missions.startMission(0);
    this.setState('playing');
    if (!skipMenu) this.hud.showToast('WELCOME TO SOLMAR BAY');
  }

  startContinue() {
    const data = loadGame();
    if (!data) { this.startNewGame(false); return; }
    this.cash = data.cash;
    this.day = data.day;
    this.clockMinutes = data.clockMinutes;
    this.carsStolen = data.carsStolen || 0;
    this.missionsDone = data.missionsDone || 0;
    this.player.health = data.health;
    this.player.x = data.x;
    this.player.z = data.z;
    this.player.heading = Math.PI;
    this.police.clearWanted();
    this.enemies.clearAll();
    if (data.finishedAll) {
      this.missions.finishedAll = true;
      this.missions.active = false;
    } else {
      this.missions.startMission(data.missionIndex || 0);
    }
    this.setState('playing');
    this.hud.showToast('WELCOME BACK, DARIO');
  }

  writeSave() {
    const p = this.player.pos;
    saveGame({
      cash: this.cash,
      missionIndex: this.missions.missionIndex,
      finishedAll: this.missions.finishedAll,
      health: this.player.health,
      x: p.x, z: p.z,
      day: this.day,
      clockMinutes: this.clockMinutes,
      carsStolen: this.carsStolen,
      missionsDone: this.missionsDone,
    });
  }

  addCash(amount) {
    this.cash += amount;
    if (this.audio) this.audio.pickup();
  }

  carKeyOf(car) {
    for (const [key, c] of Object.entries(this.traffic.spawnedSpecials)) {
      if (c === car) return key;
    }
    return null;
  }

  // A crime the police care about: stealing, shooting, hurting a pedestrian.
  commitCrime(level, time) {
    if (time - this.crimeCooldown < 4) return;
    this.crimeCooldown = time;
    this.police.addWanted(level, time);
    this.peds.scare(this.player.x, this.player.z, 45, time);
  }

  tryEnterExitCar() {
    const player = this.player;
    if (player.inCar) {
      player.exitCar();
      return;
    }
    const car = player.nearestCar(this.traffic.parked, 5);
    if (!car) return;
    const key = this.carKeyOf(car);
    const step = this.missions.currentStep();
    const missionCar = step && step.kind === 'enterCar' && step.carKey === key;
    player.enterCar(car, this.time);
    if (car.driver === 'player') {
      this.audio.click();
      if (!missionCar) {
        this.carsStolen++;
        this.commitCrime(1, this.time);
        this.hud.showToast('CAR STOLEN — THE LAW NOTICED');
      } else {
        this.hud.showToast(`${car.spec.name} — GO!`);
      }
    }
  }

  resolveShot() {
    const player = this.player;
    const result = player.shoot(
      this.camera,
      this.enemies.enemies,
      this.peds.peds,
      this.traffic.allCars().concat(this.police.cruisers),
      this.time,
    );
    if (!result) return;
    if (result.kind === 'dry') {
      this.hud.showToast('RELOADING…');
      return;
    }
    this.commitCrime(1, this.time);
    if (result.kind === 'enemy') {
      const killed = this.enemies.hit(result.ref, GAME.pistolDamage);
      if (!killed) this.hud.showToast('HIT!');
    } else if (result.kind === 'ped') {
      const killed = this.peds.hit(result.ref, GAME.pistolDamage, this.time);
      if (killed) {
        this.police.addWanted(2, this.time);
        this.hud.showToast('INNOCENT DOWN — 2 STARS');
      }
    } else if (result.kind === 'car') {
      const car = result.ref;
      car.damage(GAME.pistolDamage * 0.5);
      if (car.driver === 'police') this.police.addWanted(1, this.time);
      if (car.driver === 'traffic') {
        // The driver bails out of a shot-up car.
        car.driver = null;
        if (!this.traffic.parked.includes(car)) this.traffic.parked.push(car);
        this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
      }
    }
  }

  // Running a pedestrian over while driving.
  checkRunOvers() {
    const car = this.player.inCar;
    if (!car || Math.abs(car.speed) < 5) return;
    for (const ped of this.peds.peds) {
      if (ped.dead) continue;
      if (dist(car.x, car.z, ped.x, ped.z) < 2.4) {
        this.peds.hit(ped, 200, this.time);
        this.police.addWanted(2, this.time);
        this.hud.showToast('PEDESTRIAN HIT — 2 STARS');
        this.audio.thud();
      }
    }
  }

  respawn(reason) {
    if (this.player.inCar) this.player.exitCar();
    this.player.health = GAME.playerHealth;
    this.player.x = GAME.startPos.x;
    this.player.z = GAME.startPos.z;
    this.player.heading = Math.PI;
    this.player.camYaw = 0;
    this.police.clearWanted();
    const penalty = reason === 'busted' ? Math.min(this.cash, 100) : Math.floor(this.cash * 0.1);
    this.cash = Math.max(0, this.cash - penalty);
    wastedEl.style.display = 'none';
    this.hud.showToast(reason === 'busted' ? 'BUSTED — BAIL PAID' : 'PATCHED UP — BACK ON THE STREETS');
    this.setState('playing');
  }

  frame() {
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    dt = clamp(dt, 0.001, 0.05);
    this.time += dt;
    this.frameCount++;
    this.fpsAccum += dt;
    this.fpsFrames++;

    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'wasted' || this.state === 'busted') {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn(this.state);
    }
    this.city.update(dt, this.time);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
    if (this.frameCount % 30 === 0) {
      const fps = Math.round(this.fpsFrames / Math.max(0.001, this.fpsAccum));
      this.fpsAccum = 0;
      this.fpsFrames = 0;
      this.lastFps = fps;
    }
  }

  update(dt) {
    const input = this.input;
    const player = this.player;
    const time = this.time;

    // Clock: one game minute per real second.
    this.clockMinutes += dt;
    if (this.clockMinutes >= 24 * 60) {
      this.clockMinutes -= 24 * 60;
      this.day++;
    }
    this.saveTimer += dt;
    if (this.saveTimer > 30) {
      this.saveTimer = 0;
      this.writeSave();
    }

    // Enter / exit car.
    if (input.pressed('KeyE')) this.tryEnterExitCar();
    if (input.pressed('KeyR') && !player.inCar) player.reload();

    // Driving.
    if (player.inCar) {
      const car = player.inCar;
      const { fwd, strafe } = input.axes();
      const handbrake = input.down('Space');
      let throttle = fwd;
      let steer = strafe;
      if (this.shotDrive) {
        throttle = 1;
        const near = this.city.nearestRoadPoint(car.x + Math.sin(car.heading) * 30, car.z + Math.cos(car.heading) * 30);
        const want = Math.atan2(near.x - car.x, near.z - car.z);
        steer = clamp((want - car.heading) * 1.5, -1, 1);
      }
      const hitBuilding = car.step(dt, throttle, steer, handbrake, this.city.colliders, time);
      if (hitBuilding) this.audio.thud();
      // Keep the player's car inside the playable world (no driving into the sea).
      if (car.x > 330) { car.x = 330; car.speed *= 0.5; }
      if (car.x < -330) { car.x = -330; car.speed *= 0.5; }
      if (car.z > 392) { car.z = 392; car.speed *= 0.5; }
      if (car.z < -330) { car.z = -330; car.speed *= 0.5; }
      car.sync(dt);
      this.audio.setEngine(Math.abs(car.speed) / car.spec.topSpeed, true);
      this.checkRunOvers();
      // Car vs traffic separation.
      for (const other of this.traffic.allCars()) {
        if (other === car) continue;
        if (dist(car.x, car.z, other.x, other.z) < 5) {
          const bumped = this.separateCars(car, other);
          if (bumped && Math.abs(car.speed) > 8) this.audio.thud();
        }
      }
    } else {
      player.update(dt, input, time);
      this.audio.setEngine(0, false);
      if (input.click()) this.resolveShot();
    }

    // Camera orbit while driving (mouse drag).
    if (player.inCar) {
      const mouse = input.consumeMouse();
      this.orbitOffset = clamp(this.orbitOffset - mouse.dx * 0.0042, -1.4, 1.4);
    }
    this.orbitOffset *= (1 - dt * 1.2);

    // World life.
    const playerPos = player.pos;
    this.traffic.update(dt, player.inCar ? null : playerPos, time);
    this.peds.update(dt, time);
    this.police.update(dt, time, player, player.inCar, this.traffic.allCars());
    this.enemies.update(dt, time, player);
    this.missions.update(dt, {
      player: playerPos,
      playerCar: player.inCar,
      police: this.police,
      time,
      carKeyOf: (c) => this.carKeyOf(c),
    });
    this.pickups.update(dt, time, playerPos, (amount) => {
      this.addCash(amount);
      this.hud.showToast(`CASH PICKUP  +$${amount}`);
    });

    // Wasted / busted.
    if (player.health <= 0 && this.state === 'playing') {
      this.state = 'wasted';
      wastedEl.style.display = 'flex';
      document.querySelector('#wasted .big').textContent = 'WASTED';
      wastedSub.textContent = 'Dario is down — the streets of Solmar Bay wait for no one.';
      this.audio.busted();
      this.respawnTimer = 2.8;
      return;
    }
    if (this.police.bustMeter >= 1 && this.state === 'playing') {
      this.state = 'busted';
      wastedEl.style.display = 'flex';
      document.querySelector('#wasted .big').textContent = 'BUSTED';
      wastedSub.textContent = 'Officer Delia Rook reads Dario his rights. Bail: $100.';
      this.audio.busted();
      this.respawnTimer = 2.8;
      return;
    }

    this.updateHUD(dt);
  }

  separateCars(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    const min = a.radius + b.radius;
    if (d >= min || d < 1e-6) return false;
    const push = (min - d) / 2;
    const nx = dx / d, nz = dz / d;
    a.x -= nx * push; a.z -= nz * push;
    b.x += nx * push; b.z += nz * push;
    a.speed *= 0.8;
    b.speed *= 0.8;
    return true;
  }

  updateCamera(dt) {
    const player = this.player;
    const target = player.inCar ? player.inCar : player;
    const tx = target.x, tz = target.z;
    let yaw;
    if (player.inCar) {
      yaw = player.inCar.heading + Math.PI + this.orbitOffset;
    } else {
      yaw = player.camYaw;
    }
    const distCam = this.camDistOverride || (player.inCar ? 11.5 : 9);
    const height = this.camHeightOverride || (player.inCar ? 4.6 : 3.6);
    const cx = tx + Math.sin(yaw) * distCam;
    const cz = tz + Math.cos(yaw) * distCam;
    const desired = new THREE.Vector3(cx, height, cz);
    if (this.snapCam) {
      // Shot staging: place the camera exactly, no trailing lerp.
      this.camera.position.copy(desired);
      this.snapCam = false;
    } else {
      // Smooth the camera so it trails instead of snapping.
      const k = 1 - Math.exp(-dt * (player.inCar ? 5.5 : 8));
      this.camera.position.lerp(desired, k);
    }
    // Keep the camera out of buildings: lift it if it clips a roofline.
    this.camera.position.y = Math.max(this.camera.position.y, 2.2);
    const look = new THREE.Vector3(
      tx - Math.sin(yaw) * 4,
      1.6,
      tz - Math.cos(yaw) * 4,
    );
    this.camera.lookAt(look);
    // The sun and its shadow frustum follow the player.
    this.sun.position.set(tx + 120, 180, tz + 80);
    this.sun.target.position.set(tx, 0, tz);
  }

  updateHUD(dt) {
    const player = this.player;
    const car = player.inCar;
    const objective = this.missions.objectiveText();
    objective.dist = this.missions.distanceToTarget(player.pos);
    let hint = '';
    if (!car) {
      const near = player.nearestCar(this.traffic.parked, 5);
      if (near) {
        const key = this.carKeyOf(near);
        const step = this.missions.currentStep();
        const missionCar = step && step.kind === 'enterCar' && step.carKey === key;
        hint = missionCar ? `E — Take the ${near.spec.name}` : `E — Steal the ${near.spec.name}`;
      } else if (this.missions.currentStep()?.kind === 'enterCar') {
        hint = 'Find the marked car — follow the yellow beacon';
      }
    }
    const snap = {
      wanted: this.police.wanted,
      cash: this.cash,
      day: this.day,
      clockMinutes: Math.floor(this.clockMinutes),
      health: player.health,
      carHealth: car ? car.health : 100,
      ammo: player.ammo,
      speedMph: car ? Math.abs(car.speed) * 2.24 : 0,
      carName: car ? car.spec.name.toUpperCase() : '',
      driving: !!car,
      objective,
      hint,
      vignette: clamp(1 - player.health / 55, 0, 0.85),
      crosshair: !car && this.state === 'playing',
    };
    this.hud.update(snap);
    this.hud.mapTimer += dt;
    if (this.hud.mapTimer > 0.12) {
      this.hud.mapTimer = 0;
      this.hud.drawMinimap({
        city: this.city,
        player: { x: player.pos.x, z: player.pos.z, heading: player.heading },
        missionTarget: this.missions.targetPos(),
        police: this.police.cruisers,
        cars: this.traffic.allCars().filter((c) => c.driver === 'traffic'),
        enemies: this.enemies.enemies,
        pickups: this.pickups.items,
      });
    }
  }
}

new Game();
