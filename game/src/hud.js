// HUD: the DOM overlay plus the canvas minimap. Every frame the game hands
// it a snapshot; it writes only the DOM nodes that changed, and redraws the
// minimap a few times a second so the map stays cheap.

import { DISTRICTS } from './config.js';

export class HUD {
  constructor() {
    this.el = {
      wanted: document.getElementById('wanted'),
      cash: document.getElementById('cash'),
      clock: document.getElementById('clock'),
      missionName: document.querySelector('#objective .mission-name'),
      missionText: document.querySelector('#objective .mission-text'),
      missionDist: document.querySelector('#objective .mission-dist'),
      healthBar: document.getElementById('health-bar'),
      carRow: document.getElementById('car-health-row'),
      carBar: document.getElementById('car-health-bar'),
      ammoRow: document.getElementById('ammo-row'),
      speedBox: document.getElementById('bottom-right'),
      speed: document.getElementById('speed'),
      carName: document.getElementById('car-name'),
      hint: document.getElementById('hint'),
      toast: document.getElementById('toast'),
      crosshair: document.getElementById('crosshair'),
      vignette: document.getElementById('vignette'),
      fps: document.getElementById('fps'),
      minimap: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.last = {};
    this.mapTimer = 0;
    this.toastTimer = null;
  }

  setText(key, node, value) {
    if (this.last[key] !== value) {
      this.last[key] = value;
      node.textContent = value;
    }
  }

  setHTML(key, node, value) {
    if (this.last[key] !== value) {
      this.last[key] = value;
      node.innerHTML = value;
    }
  }

  showToast(text) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, 2600);
  }

  showHint(text) {
    if (text) {
      this.el.hint.style.display = 'block';
      this.setText('hint', this.el.hint, text);
    } else {
      this.el.hint.style.display = 'none';
    }
  }

  // snap: {wanted, cash, day, clockMinutes, health, carHealth, ammo, speedMph,
  //  carName, driving, objective{name,text,dist}, hint, vignette, crosshair}
  update(snap) {
    // Wanted stars: filled gold, empty dim.
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += i < snap.wanted
        ? '★'
        : '<span class="dim">★</span>';
    }
    this.setHTML('wanted', this.el.wanted, stars);
    this.setHTML('cash', this.el.cash, `<small>CASH</small> $${snap.cash.toLocaleString('en-US')}`);
    const hh = String(Math.floor(snap.clockMinutes / 60)).padStart(2, '0');
    const mm = String(snap.clockMinutes % 60).padStart(2, '0');
    this.setText('clock', this.el.clock, `DAY ${snap.day}  ·  ${hh}:${mm}`);
    this.setText('mname', this.el.missionName, snap.objective.name);
    this.setText('mtext', this.el.missionText, snap.objective.text);
    this.setText('mdist', this.el.missionDist, snap.objective.dist);
    this.el.healthBar.style.width = `${Math.max(0, snap.health)}%`;
    this.el.carRow.style.display = snap.driving ? 'flex' : 'none';
    if (snap.driving) {
      this.el.carBar.style.width = `${Math.max(0, snap.carHealth)}%`;
    }
    this.setText('ammo', this.el.ammoRow,
      snap.driving ? 'DRIVING — E to step out' : `PISTOL  ${snap.ammo} / 12   ·   R reload`);
    this.el.speedBox.style.display = snap.driving ? 'block' : 'none';
    if (snap.driving) {
      this.setHTML('speed', this.el.speed, `${Math.round(snap.speedMph)} <small>MPH</small>`);
      this.setText('carname', this.el.carName, snap.carName);
    }
    this.showHint(snap.hint);
    this.el.crosshair.style.display = snap.crosshair ? 'block' : 'none';
    this.el.vignette.style.opacity = String(snap.vignette);
  }

  drawMinimap(world) {
    // world: {city, player{x,z,heading}, missionTarget, police[], cars[], enemies[], pickups[]}
    const ctx = this.mapCtx;
    const S = 216;
    const scale = S / 760; // world -380..380 maps to the canvas
    const toX = (x) => S / 2 + x * scale;
    const toY = (z) => S / 2 + z * scale;
    ctx.clearRect(0, 0, S, S);
    // Ocean and sand on the south edge.
    ctx.fillStyle = '#12334a';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#0e5a80';
    ctx.fillRect(0, toY(400), S, S - toY(400));
    ctx.fillStyle = '#c9b478';
    ctx.fillRect(0, toY(340), S, toY(400) - toY(340));
    // City ground.
    ctx.fillStyle = '#20262e';
    ctx.fillRect(toX(-330), toY(-330), 660 * scale, 660 * scale);
    // Blocks.
    ctx.fillStyle = '#3a4149';
    for (const b of world.city.buildings) {
      ctx.fillRect(toX(b.x - b.w / 2), toY(b.z - b.d / 2), b.w * scale, b.d * scale);
    }
    // Roads.
    ctx.strokeStyle = '#565e68';
    ctx.lineWidth = 16 * scale;
    for (const p of world.city.roadLines) {
      ctx.beginPath(); ctx.moveTo(toX(-330), toY(p)); ctx.lineTo(toX(330), toY(p)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toX(p), toY(-330)); ctx.lineTo(toX(p), toY(330)); ctx.stroke();
    }
    // District labels: only the four with room to breathe on the map.
    ctx.fillStyle = 'rgba(180,220,255,0.75)';
    ctx.font = 'bold 8px Verdana';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      if (!['Neon Mile', 'Bayfront Plaza', 'The Docks'].includes(d.name)) continue;
      ctx.fillText(d.name.toUpperCase(), toX(d.cx), toY(d.cz));
    }
    // Cash pickups.
    ctx.fillStyle = '#7dff9a';
    for (const item of world.pickups || []) {
      if (item.taken) continue;
      ctx.fillRect(toX(item.x) - 1.5, toY(item.z) - 1.5, 3, 3);
    }
    // Traffic cars: small white dots.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of world.cars || []) {
      ctx.fillRect(toX(c.x) - 1.5, toY(c.z) - 1.5, 3, 3);
    }
    // Enemies: red dots.
    ctx.fillStyle = '#ff4e4e';
    for (const e of world.enemies || []) {
      if (e.dead) continue;
      ctx.beginPath(); ctx.arc(toX(e.x), toY(e.z), 3, 0, Math.PI * 2); ctx.fill();
    }
    // Police: flashing blue dots.
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#3a7bff' : '#ff3b3b';
    for (const c of world.police || []) {
      ctx.beginPath(); ctx.arc(toX(c.x), toY(c.z), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Mission target: pulsing yellow diamond.
    if (world.missionTarget) {
      const pulse = 5 + Math.sin(performance.now() / 240) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(toX(world.missionTarget.x), toY(world.missionTarget.z) - pulse);
      ctx.lineTo(toX(world.missionTarget.x) + pulse, toY(world.missionTarget.z));
      ctx.lineTo(toX(world.missionTarget.x), toY(world.missionTarget.z) + pulse);
      ctx.lineTo(toX(world.missionTarget.x) - pulse, toY(world.missionTarget.z));
      ctx.closePath(); ctx.fill();
    }
    // Player arrow.
    const px = toX(world.player.x), py = toY(world.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(world.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // North marker.
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 9px Verdana';
    ctx.fillText('N', S - 10, 12);
  }
}
