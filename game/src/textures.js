// Procedural textures, painted on offscreen canvases at load time.
// No image files are shipped: facades, roads, sand, signs and clouds are
// all generated here so the game stays fully self-contained.

import * as THREE from 'three';

function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

// A building facade: base colour, window grid, lit and dark panes, ground floor.
export function facadeTexture(baseHex, floors, cols, seed) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);
    // Subtle vertical grime streaks.
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`;
      ctx.fillRect(rnd() * w, 0, 2 + rnd() * 5, h);
    }
    const cw = w / cols, ch = h / floors;
    for (let r = 0; r < floors; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.18, y = r * ch + ch * 0.2;
        const ww = cw * 0.64, hh = ch * 0.6;
        const lit = rnd() < 0.28;
        ctx.fillStyle = lit ? '#ffe9a8' : (rnd() < 0.5 ? '#2a4a66' : '#1d3247');
        ctx.fillRect(x, y, ww, hh);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x, y, ww, hh * 0.25);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.strokeRect(x, y, ww, hh);
      }
    }
    // Ground floor: darker shopfront band.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, h - ch * 0.9, w, ch * 0.9);
    ctx.fillStyle = shade(baseHex, -40);
    ctx.fillRect(0, h - 4, w, 4);
  });
}

// Asphalt with a centre dashed line and edge lines, tiled along the road.
export function roadTexture() {
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#33363c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = '#c8b45a';
    ctx.fillRect(w / 2 - 2, 8, 4, 34);
    ctx.fillRect(w / 2 - 2, 86, 4, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(6, 0, 3, h);
    ctx.fillRect(w - 9, 0, 3, h);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Pavement tiles for sidewalks and plazas.
export function sidewalkTexture() {
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9a938a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(w, i * 32); ctx.stroke();
    }
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function sandTexture() {
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8d9a0';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(120,90,40,${Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function grassTexture() {
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5da24a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(20,60,20,${Math.random() * 0.2})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 3);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// A soft round cloud puff, used on drifting billboard sprites.
export function cloudTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const puffs = [[70, 80, 42], [120, 62, 52], [175, 82, 44], [100, 92, 40], [150, 96, 36]];
    for (const [x, y, r] of puffs) {
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
}

// Neon sign board texture with big invented lettering.
export function signTexture(text, bg, fg, sub) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = fg;
    ctx.font = 'bold 64px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, sub ? h / 2 - 14 : h / 2);
    if (sub) {
      ctx.font = 'bold 26px Verdana, sans-serif';
      ctx.fillText(sub, w / 2, h - 30);
    }
  });
}

// Taxi roof checker band.
export function checkerTexture() {
  const tex = canvasTexture(64, 16, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#111' : '#fff';
      ctx.fillRect(i * 8, 0, 8, h);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}
