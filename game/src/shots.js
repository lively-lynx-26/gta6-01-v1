// Screenshot staging: ?shot=chase|drive|foot|mission drops the game straight
// into a composed scene so the screenshots show the city, the HUD, traffic,
// police and a mission in progress — all rendered live by the game itself.

import { GAME } from './config.js';

function placePlayerInCar(game, car, heading) {
  const player = game.player;
  player.enterCar(car, game.time);
  car.heading = heading;
  car.speed = 0;
  car.x = car.x;
  car.z = car.z;
  player.camYaw = heading + Math.PI;
}

function spawnCruisersBehind(game, count, startZ) {
  for (let i = 0; i < count; i++) {
    const c = game.police.spawnCruiser(game.player.pos);
    // Line them up behind the player on the same road.
    c.x = game.player.pos.x + (i - 1) * 7;
    c.z = startZ - i * 9;
    c.heading = game.player.inCar ? game.player.inCar.heading : Math.PI;
    c.speed = 22 + i * 2;
  }
}

// Chase staging: cruisers staged well ahead of the player, driving the
// same way, so at the early screenshot they read as a pursuit closing
// in ahead — not yet turned around and ramming onto the camera. The
// police AI still converges on the player, so the chase is real; the
// shot is simply taken before the ram lands.
function spawnChaseCruisers(game) {
  const spots = [
    { x: 28, z: -185, speed: 24 },
    { x: 54, z: -195, speed: 24 },
    { x: 38, z: -210, speed: 22 },
  ];
  for (const s of spots) {
    const c = game.police.spawnCruiser(game.player.pos);
    c.x = s.x;
    c.z = s.z;
    c.heading = Math.PI;
    c.speed = s.speed;
  }
}

function applyShotMode(game, shot) {
  const player = game.player;
  const missions = game.missions;
  game.audio.ensure();
  if (game.audio.master) game.audio.master.gain.value = 0;

  if (shot === 'chase') {
    // Cover shot: a police chase on Neon Mile, wanted 3, mission live.
    const comet = game.traffic.spawnedSpecials.comet;
    comet.x = 40; comet.z = -150;
    placePlayerInCar(game, comet, Math.PI);
    comet.speed = 32;
    // A three-quarter rear angle for the cover: the camera sits off to
    // the side, so the pursuit reads laterally instead of head-on.
    game.orbitOffset = 1.4;
    game.shotDrive = true;
    game.cash = 1240;
    player.health = 82;
    game.police.setWanted(3);
    spawnChaseCruisers(game);
    missions.missionIndex = 2;
    missions.stepIndex = 2;
    missions.active = true;
    missions.killsDone = 0;
    missions.beginStep();
  } else if (shot === 'drive') {
    // Driving the Bay Cab down the main avenue with traffic around.
    const taxi = game.traffic.spawnedSpecials.taxi;
    taxi.x = 40; taxi.z = 60;
    placePlayerInCar(game, taxi, 0);
    taxi.speed = 17;
    game.shotDrive = true;
    game.cash = 120;
    player.health = 100;
    missions.missionIndex = 0;
    missions.stepIndex = 2;
    missions.active = true;
    missions.beginStep();
    // A couple of traffic cars alongside for a busy street. The oncoming
    // one stays a full lane clear so its separation radius never clips
    // the taxi and kills its speed.
    const t1 = game.traffic.spawnTrafficCar(true);
    t1.x = 36; t1.z = 20; t1.heading = 0; t1.speed = 14;
    const t2 = game.traffic.spawnTrafficCar(true);
    t2.x = 48; t2.z = 100; t2.heading = Math.PI; t2.speed = 13;
    // Keep the taxi's lane clear: push any other traffic out of the
    // corridor onto the cross street, so the separation radius never
    // brakes the taxi mid-shot. They cross the avenue ahead instead,
    // which keeps the street busy without touching the taxi.
    for (const c of game.traffic.cars) {
      if (c === t1 || c === t2) continue;
      if (Math.abs(c.x - 40) < 12 && c.z > 45 && c.z < 150) {
        c.x = -120 + (game.traffic.cars.indexOf(c) % 6) * 48;
        c.z = 120;
        c.heading = Math.PI / 2;
        c.target = { x: 120, z: 120 };
      }
    }
  } else if (shot === 'foot') {
    // On foot in Bayfront Plaza, pedestrians strolling, mission live.
    player.x = 8; player.z = 8;
    player.heading = Math.PI * 0.75;
    player.camYaw = Math.PI * 0.75 + Math.PI;
    game.cash = 340;
    player.health = 100;
    missions.missionIndex = 1;
    missions.stepIndex = 0;
    missions.active = true;
    missions.beginStep();
    // Gather a few pedestrians near the plaza for a lively frame — all
    // ahead of the player, none standing on his heels.
    for (let i = 0; i < 4; i++) {
      const ped = game.peds.peds[i];
      if (ped) {
        ped.x = -8 + i * 6;
        ped.z = -6 + (i % 2) * 8;
        ped.target = { x: ped.x + 12, z: ped.z - 8 };
      }
    }
  } else if (shot === 'mission') {
    // Combat at the docks: rivals in the open, wanted 2, mission live.
    player.x = -222; player.z = 214;
    player.heading = -2.23;
    player.camYaw = -2.23 + Math.PI;
    game.cash = 890;
    player.health = 76;
    game.police.setWanted(2);
    spawnCruisersBehind(game, 1, 150);
    missions.missionIndex = 3;
    missions.stepIndex = 1;
    missions.active = true;
    missions.killsDone = 0;
    missions.killsNeeded = 4;
    missions.beginStep();
    // Pull the squad into a loose firing line ahead of the player.
    game.enemies.enemies.forEach((e, i) => {
      e.x = -240 + i * 6;
      e.z = 202 - (i % 2) * 6;
      e.mesh.position.set(e.x, 0, e.z);
    });
    // Keep parked cars out of the player's feet so the frame stays clean.
    for (const c of game.traffic.parked) {
      if (Math.hypot(c.x - player.x, c.z - player.z) < 12) {
        c.x = -120; c.z = 120;
        c.sync(0);
      }
    }
  } else {
    return;
  }

  // Expose the active shot for the playtest harness.
  window.__solmar.shot = shot;
  // Snap the camera to its follow position so the first rendered frame is
  // already composed. The chase sits a touch higher than the drive shot
  // so a cruiser ramming from behind reads below the player's car
  // instead of being cut off by the frame edge; on-foot shots sit closer
  // still so the player reads at a glance.
  if (shot === 'chase') {
    game.camDistOverride = 11;
    game.camHeightOverride = 5.2;
  } else if (shot === 'drive') {
    game.camDistOverride = 10;
    game.camHeightOverride = 4.4;
  } else if (shot === 'foot' || shot === 'mission') {
    game.camDistOverride = 7;
    game.camHeightOverride = 3.0;
  }
  game.snapCam = true;
  // Keep the menu hidden and the game running.
  game.setState('playing');
}

export { applyShotMode };
