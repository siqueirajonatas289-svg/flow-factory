/* FLOW FACTORY — audio.js
 * Todo o áudio é sintetizado com Web Audio API (sem arquivos).
 * Música: sequenciador generativo calmo (pad + baixo + arpejo + chimbal),
 * com variação a cada 8 compassos para não ficar repetitivo.
 * O jogo funciona normalmente sem áudio (qualquer falha é ignorada).
 */
(function (FF) {
  'use strict';

  var ctx = null, master = null, sfxBus = null, musicBus = null, hum = null;
  var musicOn = true, sfxOn = true, musicPlaying = false;
  var sched = null, nextTime = 0, step = 0, bar = 0;
  var BPM = 92, STEP = 60 / BPM / 4; // semicolcheias

  // Escala menor natural em Lá (frequências calculadas a partir do MIDI)
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var PROG = [ // acordes (MIDI): Am, F, C, G
    [57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]
  ];
  var PENTA = [0, 3, 5, 7, 10]; // pentatônica menor

  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

  function init() {
    if (ctx) return true;
    var AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      comp.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.8 : 0; sfxBus.connect(comp);
      musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(comp);
      return true;
    } catch (e) { ctx = null; return false; }
  }

  function resume() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    if (musicOn && !musicPlaying) startMusic();
  }

  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(function () {}); }

  /* ---------- blocos de síntese ---------- */
  function env(g, t, a, peak, d, sustain, r) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
    if (r) g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
  }

  function tone(bus, type, freq, t, dur, peak, opts) {
    opts = opts || {};
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    var node = o;
    if (opts.lp) {
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; f.Q.value = opts.q || 0.7;
      o.connect(f); node = f;
    }
    node.connect(g); g.connect(bus);
    env(g, t, opts.a || 0.004, peak, dur, 0.0001, 0);
    o.start(t); o.stop(t + (opts.a || 0.004) + dur + 0.05);
  }

  var noiseBuf = null;
  function ensureNoise() {
    if (noiseBuf) return;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function noise(bus, t, dur, peak, hp, lp) {
    ensureNoise();
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var g = ctx.createGain();
    var f = ctx.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp || lp || 2000;
    s.connect(f); f.connect(g); g.connect(bus);
    env(g, t, 0.002, peak, dur, 0.0001, 0);
    s.start(t); s.stop(t + dur + 0.05);
  }

  /* ---------- efeitos ---------- */
  var SFX = {
    ui: function (t) { tone(sfxBus, 'sine', 880, t, 0.05, 0.12, { to: 660 }); },
    toggle: function (t) {
      noise(sfxBus, t, 0.03, 0.25, 2500);
      tone(sfxBus, 'square', 520, t, 0.06, 0.08, { to: 780, lp: 2400 });
    },
    start: function (t) {
      tone(sfxBus, 'sawtooth', 110, t, 0.35, 0.12, { to: 220, lp: 900 });
      tone(sfxBus, 'triangle', 440, t + 0.12, 0.25, 0.12, { to: 660 });
    },
    deliver: function (t, cat) {
      var base = 72 + (FF.CATS[cat] ? FF.CATS[cat].pitch : 0);
      tone(sfxBus, 'triangle', mtof(base), t, 0.22, 0.22);
      tone(sfxBus, 'sine', mtof(base + 12), t + 0.01, 0.15, 0.08);
    },
    warn: function (t) {
      tone(sfxBus, 'square', 660, t, 0.07, 0.07, { lp: 1800 });
      tone(sfxBus, 'square', 660, t + 0.14, 0.07, 0.07, { lp: 1800 });
    },
    wrong: function (t) { tone(sfxBus, 'sawtooth', 120, t, 0.35, 0.22, { to: 70, lp: 700 }); },
    win: function (t) {
      [72, 76, 79, 84].forEach(function (m, i) { tone(sfxBus, 'triangle', mtof(m), t + i * 0.11, 0.3, 0.18); });
      tone(sfxBus, 'sine', mtof(96), t + 0.44, 0.6, 0.06);
    },
    fail: function (t) {
      [64, 60, 57].forEach(function (m, i) { tone(sfxBus, 'triangle', mtof(m), t + i * 0.16, 0.3, 0.16, { lp: 1500 }); });
    },
    star: function (t, n) { tone(sfxBus, 'triangle', mtof(79 + (n || 0) * 4), t, 0.25, 0.16); },
    gate: function (t) {
      noise(sfxBus, t, 0.05, 0.3, 0, 900);
      tone(sfxBus, 'square', 220, t, 0.09, 0.08, { to: 150, lp: 1200 });
    },
    gateOpen: function (t) { tone(sfxBus, 'triangle', 330, t, 0.08, 0.06, { to: 495 }); },
    cycle: function (t) { tone(sfxBus, 'sine', 1320, t, 0.03, 0.03); }
  };

  function play(name, arg) {
    if (!ctx || !sfxOn || ctx.state !== 'running') return;
    try { SFX[name] && SFX[name](ctx.currentTime + 0.005, arg); } catch (e) { /* silencioso */ }
  }

  /* ---------- zumbido das esteiras (muito discreto) ---------- */
  function setHum(on) {
    if (!ctx) return;
    if (on && !hum && sfxOn) {
      try {
        var s = ctx.createBufferSource();
        ensureNoise();
        s.buffer = noiseBuf; s.loop = true;
        var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
        var g = ctx.createGain(); g.gain.value = 0;
        g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.4);
        s.connect(f); f.connect(g); g.connect(sfxBus);
        s.start();
        hum = { s: s, g: g };
      } catch (e) { hum = null; }
    } else if (!on && hum) {
      var h = hum; hum = null;
      try { h.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25); h.s.stop(ctx.currentTime + 0.3); } catch (e) {}
    }
  }

  /* ---------- música generativa ---------- */
  var arpPattern = [];
  function newPattern() {
    arpPattern = [];
    var density = 0.35 + rnd() * 0.3;
    for (var i = 0; i < 16; i++) arpPattern.push(rnd() < density ? Math.floor(rnd() * PENTA.length) : -1);
    arpPattern[0] = 0;
  }

  function scheduleStep(t) {
    var chord = PROG[Math.floor(bar / 2) % PROG.length];
    var s = step % 16;
    if (s === 0 && bar % 2 === 0) {
      chord.forEach(function (m, i) {
        tone(musicBus, 'sawtooth', mtof(m), t, STEP * 30, 0.035, { a: 0.6, lp: 700, detune: i * 4 - 4 });
      });
    }
    if (s === 0 || s === 8) tone(musicBus, 'sine', 150, t, 0.16, 0.35, { to: 50 });
    if (s === 0 || s === 6 || s === 10) tone(musicBus, 'triangle', mtof(chord[0] - 12), t, STEP * 3, 0.16, { lp: 400 });
    if (s % 4 === 2) noise(musicBus, t, 0.03, 0.05, 7000);
    var n = arpPattern[s];
    if (n >= 0 && bar % 8 >= 2) {
      var m = 69 + PENTA[n] + (s % 8 === 4 ? 12 : 0);
      tone(musicBus, 'triangle', mtof(m), t, STEP * 1.4, 0.055, { lp: 2600 });
    }
    step++;
    if (step % 16 === 0) { bar++; if (bar % 8 === 0) newPattern(); }
  }

  function startMusic() {
    if (!ctx || musicPlaying) return;
    musicPlaying = true;
    newPattern();
    nextTime = ctx.currentTime + 0.1;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 1.5);
    sched = setInterval(function () {
      if (!ctx || ctx.state !== 'running') return;
      while (nextTime < ctx.currentTime + 0.15) { scheduleStep(nextTime); nextTime += STEP; }
    }, 40);
  }

  function stopMusic() {
    if (!musicPlaying) return;
    musicPlaying = false;
    clearInterval(sched); sched = null;
    if (ctx) {
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
      musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    }
  }

  function setMusic(on) {
    musicOn = !!on;
    if (!ctx) return;
    if (musicOn) startMusic(); else stopMusic();
  }

  function setSfx(on) {
    sfxOn = !!on;
    if (!ctx) return;
    sfxBus.gain.value = sfxOn ? 0.8 : 0;
    if (!sfxOn) setHum(false);
  }

  FF.Audio = {
    resume: resume, suspend: suspend, play: play, setMusic: setMusic, setSfx: setSfx, setHum: setHum,
    get available() { return !!(globalThis.AudioContext || globalThis.webkitAudioContext); }
  };
})(globalThis.FF = globalThis.FF || {});
