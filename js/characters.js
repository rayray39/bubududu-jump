/* ============================================================
   characters.js — procedural sprites for Dudu & Bubu.

   Modelled on the "Bubu & Dudu" (Yier & Bubu) sticker style:
   a big wide head on a small pear-shaped body, tiny widely-set
   bead eyes, a little open mouth, big round blush and stubby
   limbs. Dudu is the plain brown bear (no muzzle patch); Bubu
   is the all-white panda with black ears only (no eye patches).
   Each carries a little crossbody bag.

   Everything is drawn with plain canvas primitives inside a
   1x1 unit box centred on the origin, then scaled to `size`.
   No image files, so nothing to preload and nothing to go
   blurry on a high-DPR phone screen.
   ============================================================ */

const CHARACTERS = {
  dudu: {
    name: 'Dudu',
    fur: '#a8714a',
    ear: '#a8714a',
    earInner: '#8f5d3b',
    limb: '#a8714a',
    blush: 'rgba(250,160,80,.8)',
    bag: '#7fc6e6',
    strap: '#5a9fc2'
  },
  bubu: {
    name: 'Bubu',
    fur: '#fffdf9',
    ear: '#2f2724',
    earInner: null,
    limb: '#fffdf9',
    blush: 'rgba(250,150,170,.75)',
    bag: '#f7d35e',
    strap: '#d8ad2f'
  }
};

const OUTLINE = '#3b2a22';
const INK = '#2a1e19';

function _ellipse(ctx, x, y, rx, ry, fill, stroke, lw) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

/**
 * Draw a character.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} key   'dudu' | 'bubu'
 * @param {number} x     centre x
 * @param {number} y     centre y
 * @param {number} size  overall width in px
 * @param {object} [o]   { facing:-1|1, squash:-0.3..0.3, limbs:'idle'|'up'|'fall', dead:boolean }
 */
function drawCharacter(ctx, key, x, y, size, o) {
  const c = CHARACTERS[key] || CHARACTERS.dudu;
  const opt = o || {};
  const facing = opt.facing || 0;
  const squash = Math.max(-0.3, Math.min(0.3, opt.squash || 0));
  const limbs = opt.limbs || 'idle';
  const dead = !!opt.dead;
  const lw = 0.034;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((opt.roll || 0) + facing * 0.1);
  ctx.scale(size * (1 - squash * 0.55), size * (1 + squash));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // --- feet (behind body) ---
  const footY = limbs === 'up' ? 0.53 : 0.54;
  const footX = limbs === 'up' ? 0.19 : 0.15;
  _ellipse(ctx, -footX, footY, 0.12, 0.075, c.limb, OUTLINE, lw);
  _ellipse(ctx, footX, footY, 0.12, 0.075, c.limb, OUTLINE, lw);

  // --- raised arms sit behind the body ---
  const raised = limbs !== 'idle';
  if (raised) {
    // 'up' = arms flung out to the sides, 'fall' = arms thrown overhead
    const ax = limbs === 'up' ? 0.44 : 0.4;
    const ay = limbs === 'up' ? 0.2 : -0.38;
    const rot = limbs === 'up' ? -1.0 : -0.35;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * ax, ay);
      ctx.rotate(s * rot);
      _ellipse(ctx, 0, 0, 0.075, 0.13, c.limb, OUTLINE, lw);
      ctx.restore();
    }
  }

  // --- body: small pear under the head ---
  ctx.beginPath();
  ctx.moveTo(-0.24, 0.18);
  ctx.bezierCurveTo(-0.36, 0.34, -0.36, 0.58, -0.12, 0.58);
  ctx.lineTo(0.12, 0.58);
  ctx.bezierCurveTo(0.36, 0.58, 0.36, 0.34, 0.24, 0.18);
  ctx.closePath();
  ctx.fillStyle = c.fur; ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = lw; ctx.stroke();

  // --- crossbody bag: strap over the shoulder, pouch on the hip ---
  ctx.beginPath();
  ctx.moveTo(-0.2, 0.22);
  ctx.quadraticCurveTo(0.02, 0.36, 0.2, 0.44);
  ctx.strokeStyle = c.strap; ctx.lineWidth = 0.035; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.12, 0.38);
  ctx.lineTo(0.34, 0.38);
  ctx.quadraticCurveTo(0.35, 0.53, 0.23, 0.53);
  ctx.quadraticCurveTo(0.11, 0.53, 0.12, 0.38);
  ctx.closePath();
  ctx.fillStyle = c.bag; ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = lw * 0.8; ctx.stroke();

  // --- resting arms: little nubs hugging the body ---
  if (!raised) {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 0.27, 0.33);
      ctx.rotate(s * 0.35);
      _ellipse(ctx, 0, 0, 0.07, 0.11, c.limb, OUTLINE, lw);
      ctx.restore();
    }
  }

  // --- ears ---
  for (const s of [-1, 1]) {
    _ellipse(ctx, s * 0.31, -0.37, 0.125, 0.115, c.ear, OUTLINE, lw);
    if (c.earInner) _ellipse(ctx, s * 0.31, -0.36, 0.06, 0.055, c.earInner, null, 0);
  }

  // --- head: wide, slightly flattened ---
  _ellipse(ctx, 0, -0.08, 0.48, 0.37, c.fur, OUTLINE, lw);

  // --- blush: big soft circles under the eyes ---
  _ellipse(ctx, -0.29, 0.04, 0.095, 0.08, c.blush, null, 0);
  _ellipse(ctx, 0.29, 0.04, 0.095, 0.08, c.blush, null, 0);

  // --- eyes: tiny widely-set beads ---
  const px = facing * 0.02;
  for (const s of [-1, 1]) {
    const ex = s * 0.18 + px, ey = -0.07;
    if (dead) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.moveTo(ex - 0.045, ey - 0.045); ctx.lineTo(ex + 0.045, ey + 0.045);
      ctx.moveTo(ex + 0.045, ey - 0.045); ctx.lineTo(ex - 0.045, ey + 0.045);
      ctx.stroke();
    } else {
      _ellipse(ctx, ex, ey, 0.045, 0.056, INK, null, 0);
      _ellipse(ctx, ex + 0.015, ey - 0.022, 0.016, 0.018, '#fff', null, 0);
    }
  }

  // --- mouth: small open "o" with a red tongue ---
  const mx = px * 0.6, my = 0.03;
  if (dead) {
    ctx.beginPath();
    ctx.arc(mx, my + 0.07, 0.05, Math.PI * 1.1, Math.PI * 1.9);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.03; ctx.stroke();
  } else {
    const mouth = () => {
      ctx.beginPath();
      ctx.moveTo(mx - 0.055, my);
      ctx.lineTo(mx + 0.055, my);
      ctx.quadraticCurveTo(mx + 0.055, my + 0.075, mx, my + 0.075);
      ctx.quadraticCurveTo(mx - 0.055, my + 0.075, mx - 0.055, my);
      ctx.closePath();
    };
    mouth();
    ctx.fillStyle = '#5c2320'; ctx.fill();
    ctx.save();
    ctx.clip();
    _ellipse(ctx, mx, my + 0.075, 0.04, 0.032, '#ef6f6a', null, 0);
    ctx.restore();
    mouth();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.02; ctx.stroke();
  }

  ctx.restore();
}

/** Draw a centred idle portrait into a small square canvas (menu / game over). */
function drawPortrait(canvas, key, bob) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const css = canvas.clientWidth || canvas.width;
  if (canvas.width !== Math.round(css * dpr)) {
    canvas.width = canvas.height = Math.round(css * dpr);
  }
  ctx.setTransform(canvas.width / css, 0, 0, canvas.width / css, 0, 0);
  ctx.clearRect(0, 0, css, css);
  drawCharacter(ctx, key, css / 2, css / 2 + (bob || 0), css * 0.78, { limbs: 'idle' });
}
