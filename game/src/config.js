// Solmar Bay — world constants, palette, vehicle specs and named places.
// Every name here is invented for this game; nothing is taken from any commercial game.

// City grid: roads run on a regular lattice, blocks sit between them.
export const WORLD = {
  pitch: 80,            // distance between neighbouring road centrelines
  roadHalf: 8,          // half the road width (16 wide roads)
  roads: 8,             // roads per axis, at -280 .. +280
  half: 320,            // playable half-extent of the street grid
  beachZ: 340,          // beach strip starts here (south edge)
  oceanZ: 400,          // water starts here
  sidewalk: 3.5,        // sidewalk width beside each road
  blockInset: 14,       // buildings keep this far inside their block
};

export function roadPositions() {
  const out = [];
  for (let i = 0; i < WORLD.roads; i++) out.push(-280 + i * WORLD.pitch);
  return out;
}

// Named districts and streets, invented for Solmar Bay.
export const DISTRICTS = [
  { name: 'Neon Mile', cx: 0, cz: -200, r: 130 },
  { name: 'Bayfront Plaza', cx: 200, cz: 200, r: 110 },
  { name: 'The Docks', cx: -240, cz: 200, r: 110 },
  { name: 'Calle Verde', cx: -200, cz: -200, r: 110 },
  { name: 'Marina District', cx: 200, cz: -240, r: 100 },
  { name: 'Old Solmar', cx: 0, cz: 40, r: 120 },
];

export const STREETS = [
  'Neon Mile', 'Palmera Avenue', 'Calle Verde', 'Harbor Road',
  'Sunset Boulevard', 'Coral Street', 'Marina Drive', 'Bayfront Way',
];

export const CHARACTERS = {
  player: 'Dario Cruz',
  fixer: 'Rosa Marín',
  client: 'Milo Ferrante',
  rivalBoss: 'Kane Voss',
  officer: 'Officer Delia Rook',
};

export const PALETTE = {
  skyTop: 0x2f7fd0,
  skyHorizon: 0xbfe6ff,
  sun: 0xfff2c0,
  ocean: 0x1e7fa8,
  sand: 0xe8d9a0,
  asphalt: 0x33363c,
  sidewalk: 0x9a938a,
  grass: 0x5da24a,
  building: [0xd8c9b0, 0xc9b8a3, 0xb7a58e, 0xe3d5c0, 0xa8b6c4, 0xd9b8a6, 0xc4b49a, 0x9fb4a8],
  glass: 0x2a4a66,
  taxiYellow: 0xffc21c,
  policeWhite: 0xf2f2f2,
  policeBlue: 0x1c4fd6,
};

// Vehicle specs: top speed in world-units per second, accel, grip, mass.
export const VEHICLE_TYPES = {
  sedan:   { name: 'Solmar Sedan',   topSpeed: 34, accel: 16, brake: 30, grip: 7.5, turn: 1.9, mass: 1.0, len: 4.6, wid: 2.0, seats: 4 },
  taxi:    { name: 'Bay Cab',        topSpeed: 32, accel: 15, brake: 30, grip: 7.5, turn: 1.9, mass: 1.0, len: 4.6, wid: 2.0, seats: 4 },
  comet:   { name: 'Comet GT',       topSpeed: 52, accel: 26, brake: 38, grip: 9.5, turn: 2.4, mass: 0.9, len: 4.4, wid: 1.9, seats: 2 },
  van:     { name: 'Cargo Van',      topSpeed: 28, accel: 11, brake: 24, grip: 6.0, turn: 1.5, mass: 1.5, len: 5.4, wid: 2.2, seats: 2 },
  armored: { name: 'Vault Hauler',   topSpeed: 30, accel: 13, brake: 26, grip: 6.5, turn: 1.6, mass: 2.2, len: 5.8, wid: 2.4, seats: 2 },
  police:  { name: 'SBP Interceptor', topSpeed: 46, accel: 24, brake: 36, grip: 9.0, turn: 2.3, mass: 1.1, len: 4.8, wid: 2.0, seats: 4 },
};

export const CAR_COLORS = [
  0xc23b2e, 0x2e6fc2, 0xe8e4da, 0x22262c, 0x4a7a3f, 0xd8a13c,
  0x7a3fc2, 0x3fc2b0, 0xb03f6a, 0x8a8f96,
];

export const GAME = {
  playerHealth: 100,
  playerWalkSpeed: 6.5,
  playerRunSpeed: 11,
  pistolDamage: 34,
  pistolRange: 90,
  pistolMag: 12,
  maxWanted: 5,
  wantedDecaySeconds: 9,
  saveKey: 'solmarbay.save.v1',
  startCash: 40,
  startPos: { x: 0, z: -210 },
};
