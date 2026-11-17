// Solmar Bay — Neon Tide: the make.fun entry program for gta6-01.
// Node 22, standard library only. It hands the game in: copy this
// repository's game/ and screenshots/ beside this file into the output
// directory, then write the dossier the judge reads with the vendored
// make.fun library. The output directory is /output in the grader; outside
// it, MAKEFUN_OUTPUT_DIR stands in for /output.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

function copyGame() {
  // Create the output directory; never delete it, the grader mounts it.
  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  }
}

function writeDossier() {
  // The gate's own caps, from the competition's reference data: game/ stays
  // under 993 files and 48 MiB, screenshots under 4 files of 256 KiB each,
  // and the dossier text under 160 KiB.
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

copyGame();
writeDossier();
console.log(`Solmar Bay entry written to ${outDir}`);
