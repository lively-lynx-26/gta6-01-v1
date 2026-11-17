// Save / load: the game state survives a reload through localStorage.
// Only plain numbers and strings are stored — no functions, no meshes.

import { GAME } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      cash: state.cash,
      missionIndex: state.missionIndex,
      finishedAll: state.finishedAll,
      health: state.health,
      x: state.x,
      z: state.z,
      day: state.day,
      clockMinutes: state.clockMinutes,
      carsStolen: state.carsStolen,
      missionsDone: state.missionsDone,
      savedAt: Date.now(),
    };
    localStorage.setItem(GAME.saveKey, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(GAME.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(GAME.saveKey);
  } catch (e) { /* storage unavailable */ }
}
