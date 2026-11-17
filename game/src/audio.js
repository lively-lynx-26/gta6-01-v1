// All sound is synthesized in the browser with the Web Audio API.
// No audio files are loaded: engine hum, sirens, gunshots, pickups and a
// bass-driven street groove are all built from oscillators and noise.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = false;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenStep = 0;
    this.sirenTimer = null;
    this.step = 0;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startEngineLoop();
    this.startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // Continuous engine hum: two detuned saws through a lowpass, pitch by speed.
  startEngineLoop() {
    const c = this.ctx;
    this.engineOsc = c.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = c.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 28;
    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();
  }

  setEngine(speed01, driving) {
    if (!this.ctx || !this.engineGain) return;
    const target = driving ? 0.05 + speed01 * 0.11 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.now(), 0.08);
    const f = 55 + speed01 * 165;
    this.engineOsc.frequency.setTargetAtTime(f, this.now(), 0.1);
    this.engineOsc2.frequency.setTargetAtTime(f * 0.5, this.now(), 0.1);
    this.engineFilter.frequency.setTargetAtTime(300 + speed01 * 1400, this.now(), 0.1);
  }

  // Two-tone police siren while the player is wanted.
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      const c = this.ctx;
      this.sirenOsc = c.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = c.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenStep = 0;
      this.sirenTimer = setInterval(() => {
        if (!this.sirenOsc) return;
        this.sirenStep = 1 - this.sirenStep;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenStep ? 960 : 720, this.now(), 0.05);
      }, 420);
    } else if (!on && this.sirenOsc) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
      try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc.disconnect();
      this.sirenOsc = null;
    }
  }

  noiseBuffer(seconds) {
    const c = this.ctx;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  gunshot() {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now();
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer(0.16);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.14);
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.18);
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const og = c.createGain();
    og.gain.setValueAtTime(0.4, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(og); og.connect(this.master);
    osc.start(t); osc.stop(t + 0.14);
  }

  thud() {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now();
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.22);
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now();
    const osc = c.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  pickup() {
    this.blip(880, 0.12, 'sine', 0.3);
    setTimeout(() => this.blip(1318, 0.18, 'sine', 0.3), 90);
  }

  click() {
    this.blip(1200, 0.05, 'square', 0.12);
  }

  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'triangle', 0.3), i * 110));
  }

  busted() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.35, 'sawtooth', 0.18), i * 160));
  }

  // A lazy bass groove: A-minor root notes with a hat tick, scheduled in 8ths.
  startMusic() {
    if (this.musicTimer) return;
    const bass = [55, 55, 65.41, 55, 49, 55, 82.41, 73.42];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const c = this.ctx, t = this.now();
      const f = bass[this.step % bass.length];
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.36);
      if (this.step % 2 === 0) {
        const hat = c.createBufferSource();
        hat.buffer = this.noiseBuffer(0.04);
        const hf = c.createBiquadFilter();
        hf.type = 'highpass'; hf.frequency.value = 6000;
        const hg = c.createGain();
        hg.gain.setValueAtTime(0.05, t);
        hg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        hat.connect(hf); hf.connect(hg); hg.connect(this.master);
        hat.start(t); hat.stop(t + 0.06);
      }
      this.step++;
    }, 210);
  }
}
