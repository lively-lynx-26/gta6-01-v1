# Solmar Bay — Neon Tide

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/lively-lynx-26/gta6-01-v1/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/lively-lynx-26/gta6-01-v1/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for make.fun's **gta6-01 — Make GTA 6** bounty.
Dario Cruz is back in Solmar Bay, a sun-soaked coastal city, with empty pockets
and a fast right foot. Drive the Neon Mile, outrun the Solmar Bay Police, take
five story jobs for Rosa's Garage, and become King of Solmar.

## The game

- **A city to explore on foot and by car** — eight-by-eight blocks of streets,
  the Bayfront Plaza with its fountain, the Docks, the Marina, the beach and
  the ocean, all built from a fixed seed so the city is the same every run.
- **Traffic and pedestrians** — civilian cars cruise the road lattice and turn
  at intersections; residents stroll the sidewalks and flee from gunfire.
- **Cars to steal and drive** — any parked car is yours: sedans, the Bay Cab,
  the Comet GT sports car, vans and the armored Vault Hauler. Stealing one
  draws the law.
- **A wanted level with police who respond** — 0 to 5 stars; Solmar Bay Police
  Interceptors spawn, chase, ram and try to bust you. Stay out of sight and
  the heat cools off.
- **Five story missions** — Sunset Fare, Borrowed Wheels, The Drop, Dockside
  Heat and The Big Score, with objectives, a 3D beacon, minimap blips and cash
  rewards, plus scattered cash pickups.
- **Combat** — a pistol with a crosshair, rival gang members who strafe and
  shoot back, and car damage with smoke.
- **A dense HUD** — minimap, wanted stars, cash, clock, health and car health,
  ammo, speed and the current mission objective with its distance.
- **Start screen, pause and saving** — progress survives a reload through
  localStorage; WASTED and BUSTED send you back to the streets with a penalty.
- **Sound and music** — engine hum, two-tone sirens, gunshots and a bass
  groove, all synthesized live with the Web Audio API. No audio files.

## How it is built

Three.js (vendored minified build under `game/vendor/`) renders the city from
static files with no network request. The physics engine is custom and written
from scratch in this repository (`game/src/physics.js`): arcade vehicle
handling, drift, circle-vs-box and circle-vs-circle collision. The code is
split into modules with one clear job each — `city.js` builds the world,
`traffic.js` drives the cars, `pedestrians.js` walks the crowds, `police.js`
runs the wanted system, `missions.js` runs the story, `hud.js` draws the HUD
and minimap, `audio.js` synthesizes the sound, `textures.js` and `shaders.js`
paint the city and the sky and sea. Vehicles, characters, palms and props are
assembled from primitives by `models.js`; nothing is copied from any
commercial game.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Keyboard and mouse:
WASD to move and drive, mouse drag to look, **E** to enter or steal a car,
**Space** handbrake, **Shift** sprint, click to shoot, **R** reload, **Esc** /
**P** pause, **M** mute.

## Entry

`main.ts` copies `game/` and `screenshots/` to `/output` and writes
`dossier.json` with the kit's `buildDossier`. Screenshots in `screenshots/`
are real renders of the game running in a desktop browser.
