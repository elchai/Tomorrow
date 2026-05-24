/* ============================================================
   TOMORROW — Sound engine
   Synthesized SFX via Web Audio API (no audio files).
   Tactical/game feel: alerts, dispatch, arrival, UI clicks.
   Muted-safe: only starts after first user gesture.
   ============================================================ */

window.TomorrowSounds = (function () {

  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // single oscillator note
  function note(freq, start, dur, type = 'sine', gain = 0.18) {
    const c = ensure(); if (!c || muted) return;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // frequency sweep (siren-ish)
  function sweep(f1, f2, start, dur, type = 'sawtooth', gain = 0.12) {
    const c = ensure(); if (!c || muted) return;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, t0);
    osc.frequency.linearRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // ---- Public cues ----
  function uiClick()      { note(520, 0, 0.06, 'square', 0.07); }
  function dispatch()     { note(440, 0, 0.10, 'triangle', 0.16); note(660, 0.10, 0.14, 'triangle', 0.16); }
  function arrival()      { note(784, 0, 0.10, 'sine', 0.16); note(1046, 0.10, 0.18, 'sine', 0.14); }
  function alert(level)   {                 // level 1=critical … 4=low
    if (level <= 1) { sweep(700, 1200, 0, 0.22); sweep(1200, 700, 0.22, 0.22); sweep(700, 1200, 0.44, 0.22); }
    else if (level === 2) { sweep(600, 1000, 0, 0.20); sweep(1000, 600, 0.20, 0.20); }
    else { note(880, 0, 0.12, 'triangle', 0.12); }
  }
  function online()       { note(523, 0, 0.10); note(659, 0.10, 0.10); note(784, 0.20, 0.10); note(1046, 0.30, 0.22); }
  function rumble()       {
    const c = ensure(); if (!c || muted) return;
    const t0 = c.currentTime;
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const g = c.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(65, t0);
    osc1.frequency.linearRampToValueAtTime(55, t0 + 1.8);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(65.4, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.24, t0 + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
    osc1.connect(g); osc2.connect(g); g.connect(c.destination);
    osc1.start(t0); osc2.start(t0);
    osc1.stop(t0 + 1.9); osc2.stop(t0 + 1.9);
  }

  function setMuted(m)    { muted = m; if (!m) uiClick(); }
  function isMuted()      { return muted; }
  function toggle()       { setMuted(!muted); return muted; }

  // resume audio on first gesture (browsers block autoplay)
  ['click', 'keydown'].forEach(ev =>
    window.addEventListener(ev, () => ensure(), { once: true }));

  return { uiClick, dispatch, arrival, alert, online, rumble, setMuted, isMuted, toggle };
})();
