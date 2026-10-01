/* ============================================================
   Bubu & Dudu Jump — game engine
   Vanilla canvas, fixed 60Hz timestep, portrait-first.
   ============================================================ */
(() => {
  'use strict';

  // ---------- tuning ----------
  const VW = 400;                 // logical width; everything is drawn in these units
  let   VH = 700;                 // logical height, derived from the device aspect ratio

  const STEP        = 1000 / 60;  // fixed physics tick
  const GRAVITY     = 0.42;
  const JUMP_V      = -12.3;      // ≈ 180 logical px of rise
  const SPRING_V    = -23;
  const MOVE_ACCEL  = 0.95;
  const MOVE_MAX    = 7.2;
  const DRAG        = 0.86;
  const MAX_FALL    = 19;
  const SCROLL_LINE = 0.42;       // camera pushes once the player is this far up

  const PLAT_W = 70, PLAT_H = 15;
  const PLAYER_W = 42;

  const SKIES = [
    ['#bfeaff', '#eaf8ff'],
    ['#ffd9ec', '#fff1e4'],
    ['#d7d2ff', '#eef0ff'],
    ['#1f2a52', '#4a5a9b']
  ];

  // ---------- dom ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const el = {
    hud: document.getElementById('hud'),
    score: document.getElementById('score'),
    menu: document.getElementById('menu'),
    paused: document.getElementById('paused'),
    gameover: document.getElementById('gameover'),
    goScore: document.getElementById('goScore'),
    goBest: document.getElementById('goBest'),
    goTitle: document.getElementById('goTitle'),
    goChar: document.getElementById('goChar'),
    touchHint: document.getElementById('touchHint'),
    tiltNote: document.getElementById('tiltNote')
  };

  // ---------- persisted settings ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('bdj.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('bdj.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  let character = store.get('char', 'dudu');
  let controlMode = store.get('ctrl', 'touch');   // 'touch' | 'tilt'
  let soundOn = store.get('sound', true);
  const best = { dudu: store.get('best.dudu', 0), bubu: store.get('best.bubu', 0) };

  // ---------- audio (tiny WebAudio blips, no asset files) ----------
  const sfx = {
    ac: null,
    unlock() {
      if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ac = new AC();
    },
    play(freq, dur, type, vol, slideTo) {
      if (!soundOn || !this.ac) return;
      const t = this.ac.currentTime;
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ac.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    jump()   { this.play(440, 0.11, 'sine', 0.10, 760); },
    spring() { this.play(300, 0.3, 'triangle', 0.14, 1300); },
    crack()  { this.play(190, 0.14, 'square', 0.07, 90); },
    dead()   { this.play(420, 0.5, 'sawtooth', 0.11, 70); }
  };
  const buzz = (ms) => { if (soundOn && navigator.vibrate) navigator.vibrate(ms); };

  // ---------- canvas sizing ----------
  let scale = 1;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = window.innerWidth, ch = window.innerHeight;
    VH = Math.round(VW * ch / cw);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    scale = (cw * dpr) / VW;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  resize();

  // ---------- world ----------
  const STATE = { MENU: 0, PLAY: 1, PAUSE: 2, OVER: 3 };
  let state = STATE.MENU;

  const player = { x: VW / 2, y: 0, py: 0, vx: 0, vy: 0, squash: 0, facing: 0 };
  let platforms = [], clouds = [], puffs = [];
  let topMost = 0;          // y of the highest platform generated
  let scrolled = 0;         // total distance climbed, in logical px
  let score = 0, deathT = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  /** Difficulty ramps from 0 → 1 over the first ~1800 m. */
  const diff = () => clamp(scrolled / 18000, 0, 1);

  function makePlatform(y, forceSolid) {
    const d = diff();
    const w = PLAT_W - 10 * d;
    const p = {
      x: rnd(6, VW - w - 6), y, w, h: PLAT_H,
      type: 'normal', vx: 0, broken: false, fallV: 0, springT: 0, shake: 0
    };
    const r = Math.random();
    if (!forceSolid && r < 0.10 + 0.20 * d) {
      p.type = 'break';
    } else if (r < 0.10 + 0.20 * d + 0.08 + 0.26 * d) {
      p.type = 'move';
      p.vx = rnd(0.8, 1.5 + 1.4 * d) * (Math.random() < 0.5 ? -1 : 1);
    }
    if (p.type !== 'break' && Math.random() < 0.07) p.spring = true;
    return p;
  }

  function generateUpTo(limitY) {
    let lastBreakable = false;
    while (topMost > limitY) {
      const d = diff();
      topMost -= rnd(58 + 24 * d, 96 + 36 * d);
      const p = makePlatform(topMost, lastBreakable);
      lastBreakable = p.type === 'break';
      platforms.push(p);
    }
  }

  function seedClouds() {
    clouds = [];
    for (let i = 0; i < 9; i++) {
      clouds.push({ x: rnd(0, VW), y: rnd(-VH, VH), r: rnd(26, 58), a: rnd(0.25, 0.6) });
    }
  }

  function resetWorld() {
    platforms = [];
    puffs = [];
    scrolled = 0; score = 0; deathT = 0;
    player.x = VW / 2;
    player.y = VH * 0.62;
    player.py = player.y;
    player.vx = 0; player.vy = JUMP_V; player.squash = 0; player.facing = 0;

    // a guaranteed landing pad right under the player, then fill the screen
    platforms.push({ x: VW / 2 - PLAT_W / 2, y: VH * 0.78, w: PLAT_W, h: PLAT_H, type: 'normal', vx: 0, broken: false, fallV: 0, springT: 0, shake: 0 });
    topMost = VH * 0.78;
    generateUpTo(-VH);
    seedClouds();
    tiltBase = null;
  }

  // ---------- input ----------
  let input = 0;              // -1 .. 1
  let tiltBase = null;        // calibrated neutral gamma
  let keyL = false, keyR = false;
  const pointers = new Map();

  function pointerInput() {
    if (!pointers.size) return 0;
    let last = 0;
    for (const v of pointers.values()) last = v;
    return last < window.innerWidth / 2 ? -1 : 1;
  }

  canvas.addEventListener('pointerdown', (e) => {
    sfx.unlock();
    pointers.set(e.pointerId, e.clientX);
    el.touchHint.classList.add('fade');
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e.clientX);
  });
  const dropPointer = (e) => pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', dropPointer);
  canvas.addEventListener('pointercancel', dropPointer);
  canvas.addEventListener('pointerleave', dropPointer);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keyL = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keyR = true;
    if (e.key === ' ' && state === STATE.MENU) startGame();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keyL = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keyR = false;
  });

  function onTilt(e) {
    if (controlMode !== 'tilt' || e.gamma === null) return;
    // In portrait, gamma is the left/right tilt in degrees.
    if (tiltBase === null) tiltBase = e.gamma;
    const g = e.gamma - tiltBase;
    input = Math.abs(g) < 2 ? 0 : clamp(g / 16, -1, 1);
  }
  window.addEventListener('deviceorientation', onTilt);

  function requestTilt() {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') {
      D.requestPermission().then((r) => {
        if (r !== 'granted') setControl('touch');
      }).catch(() => setControl('touch'));
    }
  }

  // ---------- physics ----------
  function tick() {
    if (state !== STATE.PLAY) return;

    // steering
    if (controlMode === 'touch' || keyL || keyR) {
      input = (keyL ? -1 : 0) + (keyR ? 1 : 0) || pointerInput();
    }
    player.vx += input * MOVE_ACCEL;
    if (!input) player.vx *= DRAG;
    player.vx = clamp(player.vx, -MOVE_MAX, MOVE_MAX);
    if (Math.abs(player.vx) > 0.4) player.facing = player.vx > 0 ? 1 : -1;

    player.py = player.y;
    player.x += player.vx;
    player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
    player.y += player.vy;

    // wrap around the sides, Doodle-Jump style
    const hw = PLAYER_W / 2;
    if (player.x < -hw) player.x = VW + hw;
    else if (player.x > VW + hw) player.x = -hw;

    // platforms
    // the sprite's paws sit ~0.61 * width below its centre
    const feetPrev = player.py + hw * 1.2;
    const feetNow = player.y + hw * 1.2;
    for (let i = platforms.length - 1; i >= 0; i--) {
      const p = platforms[i];

      if (p.type === 'move' && !p.broken) {
        p.x += p.vx;
        if (p.x < 4) { p.x = 4; p.vx *= -1; }
        if (p.x + p.w > VW - 4) { p.x = VW - 4 - p.w; p.vx *= -1; }
      }
      if (p.broken) {
        p.fallV += GRAVITY * 0.8;
        p.y += p.fallV;
        p.shake += 0.3;
      }
      if (p.springT > 0) p.springT -= 1;

      if (p.y > VH + 80) { platforms.splice(i, 1); continue; }
      if (p.broken) continue;

      // land only while falling, and only when the feet cross the top edge
      if (player.vy > 0 && feetPrev <= p.y && feetNow >= p.y &&
          player.x + hw * 0.7 > p.x && player.x - hw * 0.7 < p.x + p.w) {
        if (p.type === 'break') {
          p.broken = true;
          sfx.crack();
        } else if (p.spring) {
          player.vy = SPRING_V;
          player.squash = -0.26;
          p.springT = 12;
          sfx.spring(); buzz(18);
          spawnPuff(player.x, p.y, 10);
        } else {
          player.vy = JUMP_V;
          player.squash = -0.18;
          sfx.jump();
          spawnPuff(player.x, p.y, 5);
        }
      }
    }

    // squash/stretch easing
    const target = clamp(-player.vy / 46, -0.16, 0.16);
    player.squash += (target - player.squash) * 0.18;

    // camera
    const line = VH * SCROLL_LINE;
    if (player.y < line) {
      const d = line - player.y;
      player.y = line;
      player.py += d;
      scrolled += d;
      for (const p of platforms) p.y += d;
      for (const q of puffs) q.y += d;
      topMost += d;
      for (const c of clouds) {
        c.y += d * 0.3;
        if (c.y - c.r > VH) { c.y = -c.r - rnd(0, 120); c.x = rnd(0, VW); }
      }
      generateUpTo(-VH * 0.6);
      score = Math.floor(scrolled / 10);
    }

    for (let i = puffs.length - 1; i >= 0; i--) {
      const q = puffs[i];
      q.x += q.vx; q.y += q.vy; q.vy += 0.12; q.life -= 1;
      if (q.life <= 0) puffs.splice(i, 1);
    }

    // death
    if (player.y - hw > VH + 30) endGame();
  }

  function spawnPuff(x, y, n) {
    for (let i = 0; i < n; i++) {
      puffs.push({ x, y, vx: rnd(-1.6, 1.6), vy: rnd(-1.2, 0.2), r: rnd(2, 5), life: rnd(16, 30) });
    }
  }

  // ---------- rendering ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round((pa >> 16) + ((pb >> 16) - (pa >> 16)) * t);
    const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
    const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
    return `rgb(${r},${g},${bl})`;
  }

  function drawSky() {
    const band = scrolled / 9000;
    const i = Math.floor(band) % SKIES.length;
    const j = (i + 1) % SKIES.length;
    const t = band - Math.floor(band);
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, mix(SKIES[i][0], SKIES[j][0], t));
    g.addColorStop(1, mix(SKIES[i][1], SKIES[j][1], t));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = '#ffffff';
    for (const c of clouds) {
      ctx.globalAlpha = c.a * 0.55;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r, c.r * 0.52, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + c.r * 0.6, c.y + c.r * 0.1, c.r * 0.62, c.r * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - c.r * 0.6, c.y + c.r * 0.12, c.r * 0.55, c.r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const PLAT_COLORS = {
    normal: ['#86d6a0', '#5fb87f'],
    move:   ['#8fc4f2', '#5d99cf'],
    break:  ['#d9b48f', '#b58b64']
  };

  function drawPlatform(p) {
    const c = PLAT_COLORS[p.type];
    ctx.save();
    if (p.broken) {
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(Math.sin(p.shake) * 0.25);
      ctx.translate(-p.w / 2, -p.h / 2);
    } else {
      ctx.translate(p.x, p.y);
    }

    // spring sits on top of the board
    if (p.spring) {
      const squash = p.springT > 0 ? 0.45 : 1;
      const sh = 12 * squash;
      ctx.fillStyle = '#f7c948';
      roundRect(p.w / 2 - 9, -sh, 18, sh, 3); ctx.fill();
      ctx.strokeStyle = '#d9a315'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 1; k <= 2; k++) { ctx.moveTo(p.w / 2 - 9, -sh * k / 3); ctx.lineTo(p.w / 2 + 9, -sh * k / 3 + 3); }
      ctx.stroke();
    }

    ctx.fillStyle = c[1];
    roundRect(0, 0, p.w, p.h, 7); ctx.fill();
    ctx.fillStyle = c[0];
    roundRect(0, 0, p.w, p.h - 5, 7); ctx.fill();

    if (p.type === 'break') {
      ctx.strokeStyle = 'rgba(90,60,35,.45)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.w * 0.34, 1); ctx.lineTo(p.w * 0.46, p.h - 5); ctx.lineTo(p.w * 0.58, 1);
      ctx.stroke();
    }
    if (p.type === 'move') {
      ctx.fillStyle = 'rgba(255,255,255,.65)';
      ctx.beginPath();
      ctx.ellipse(p.w / 2, p.h * 0.32, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawSky();

    for (const p of platforms) drawPlatform(p);

    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (const q of puffs) {
      ctx.globalAlpha = clamp(q.life / 26, 0, 1);
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (state !== STATE.MENU) {
      const limbs = player.vy < -2 ? 'up' : (player.vy > 6 ? 'fall' : 'idle');
      drawCharacter(ctx, character, player.x, player.y, PLAYER_W, {
        facing: player.facing,
        squash: player.squash,
        limbs,
        dead: state === STATE.OVER
      });
      // mirror the player while wrapping around an edge
      const hw = PLAYER_W / 2;
      if (player.x < hw) drawCharacter(ctx, character, player.x + VW + hw * 2, player.y, PLAYER_W, { facing: player.facing, squash: player.squash, limbs });
      else if (player.x > VW - hw) drawCharacter(ctx, character, player.x - VW - hw * 2, player.y, PLAYER_W, { facing: player.facing, squash: player.squash, limbs });
    }
  }

  // ---------- loop ----------
  let last = 0, acc = 0, portraitT = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (!last) last = t;
    let dt = Math.min(t - last, 100);
    last = t;

    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 6) { tick(); acc -= STEP; }

    draw();

    // gentle bob on the menu / game-over portraits
    portraitT += dt / 1000;
    const bob = Math.sin(portraitT * 2.4) * 3;
    if (!el.menu.classList.contains('hidden')) {
      document.querySelectorAll('.char-card').forEach((card) => {
        drawPortrait(card.querySelector('.char-prev'), card.dataset.char, card.dataset.char === character ? bob : 0);
      });
    }
    if (!el.gameover.classList.contains('hidden')) drawPortrait(el.goChar, character, bob * 0.5);

    if (state === STATE.PLAY) el.score.textContent = score;
  }

  // ---------- state transitions ----------
  function show(node, on) { node.classList.toggle('hidden', !on); }

  function startGame() {
    sfx.unlock();
    resetWorld();
    state = STATE.PLAY;
    show(el.menu, false); show(el.gameover, false); show(el.paused, false); show(el.hud, true);
    el.hud.setAttribute('aria-hidden', 'false');
    el.touchHint.classList.toggle('hidden', controlMode !== 'touch');
    el.touchHint.classList.remove('fade');
    if (controlMode === 'touch') setTimeout(() => el.touchHint.classList.add('fade'), 2600);
  }

  function endGame() {
    state = STATE.OVER;
    sfx.dead(); buzz([20, 60, 30]);
    const isBest = score > best[character];
    if (isBest) { best[character] = score; store.set('best.' + character, score); }
    el.goScore.textContent = score;
    el.goBest.textContent = best[character];
    el.goTitle.textContent = isBest ? 'New best!' : (score < 100 ? 'Oops!' : 'Nice climb!');
    show(el.hud, false); show(el.gameover, true);
    refreshBests();
  }

  function toMenu() {
    state = STATE.MENU;
    resetWorld();
    show(el.gameover, false); show(el.paused, false); show(el.hud, false); show(el.menu, true);
  }

  function pause() {
    if (state !== STATE.PLAY) return;
    state = STATE.PAUSE;
    pointers.clear();
    show(el.paused, true);
  }
  function resume() {
    if (state !== STATE.PAUSE) return;
    state = STATE.PLAY;
    last = 0; acc = 0;
    show(el.paused, false);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // ---------- menu wiring ----------
  function selectChar(key) {
    character = key;
    store.set('char', key);
    document.querySelectorAll('.char-card').forEach((c) => {
      c.setAttribute('aria-pressed', String(c.dataset.char === key));
    });
  }
  function refreshBests() {
    document.querySelectorAll('[data-best]').forEach((b) => { b.textContent = best[b.dataset.best] || 0; });
  }
  function setControl(mode) {
    controlMode = mode;
    store.set('ctrl', mode);
    document.querySelectorAll('#controlSeg button').forEach((b) => b.classList.toggle('on', b.dataset.ctrl === mode));
    show(el.tiltNote, mode === 'tilt');
    if (mode === 'tilt') { tiltBase = null; requestTilt(); } else { input = 0; }
  }
  function setSound(on) {
    soundOn = on;
    store.set('sound', on);
    document.querySelectorAll('#soundSeg button').forEach((b) => b.classList.toggle('on', (b.dataset.snd === 'on') === on));
    if (on) sfx.unlock();
  }

  document.querySelectorAll('.char-card').forEach((card) => {
    card.addEventListener('click', () => { sfx.unlock(); selectChar(card.dataset.char); });
  });
  document.querySelectorAll('#controlSeg button').forEach((b) => b.addEventListener('click', () => setControl(b.dataset.ctrl)));
  document.querySelectorAll('#soundSeg button').forEach((b) => b.addEventListener('click', () => setSound(b.dataset.snd === 'on')));
  document.getElementById('playBtn').addEventListener('click', startGame);
  document.getElementById('retryBtn').addEventListener('click', startGame);
  document.getElementById('menuBtn').addEventListener('click', toMenu);
  document.getElementById('pauseBtn').addEventListener('click', pause);
  document.getElementById('resumeBtn').addEventListener('click', resume);
  document.getElementById('quitBtn').addEventListener('click', toMenu);

  // stop iOS double-tap zoom / long-press callout on UI chrome
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Opt-in inspection hook for the headless smoke test (index.html?debug).
  if (/[?&]debug/.test(location.search)) {
    window.__bdj = {
      player,
      VW,
      get VH() { return VH; },
      get platforms() { return platforms; },
      get playing() { return state === STATE.PLAY; },
      get score() { return score; }
    };
  }

  // ---------- boot ----------
  selectChar(character);
  setControl(controlMode);
  setSound(soundOn);
  refreshBests();
  resetWorld();
  requestAnimationFrame(frame);
})();
