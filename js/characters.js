/* ============================================================
   characters.js — procedural sprites for Dudu & Bubu.

   Everything is drawn with plain canvas primitives inside a
   1x1 unit box centred on the origin, then scaled to `size`.
   No image files, so nothing to preload and nothing to go
   blurry on a high-DPR phone screen.
   ============================================================ */

const CHARACTERS = {
  dudu: {
    name: 'Dudu',
    fur: '#b07c4f',
    furDark: '#8d5f39',
    ear: '#8d5f39',
    muzzle: '#f2dcc0',
    limb: '#9c6a42',
    blush: 'rgba(224,122,95,.35)',
    accent: '#5fb0e0',   // scarf
    hasScarf: true,
    hasBow: false
  },
  bubu: {
    name: 'Bubu',
    fur: '#fdfcf8',
    furDark: '#e4ded2',
    ear: '#3a3330',
    muzzle: '#fdfcf8',
    limb: '#3a3330',
    blush: 'rgba(240,150,170,.45)',
    accent: '#ff8fa3',   // bow
    hasScarf: false,
    hasBow: true,
    patches: true        // panda eye patches
  }
};

const OUTLINE = '#4a3a30';

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
  const lw = size * 0.045;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((opt.roll || 0) + facing * 0.1);
  ctx.scale(size * (1 - squash * 0.55), size * (1 + squash));
  ctx.lineJoin = 'round';

  // --- legs (behind body) ---
  const legY = limbs === 'up' ? 0.46 : 0.5;
  const legSpread = limbs === 'up' ? 0.30 : 0.22;
  _ellipse(ctx, -legSpread, legY, 0.15, 0.11, c.limb, OUTLINE, lw / size);
  _ellipse(ctx, legSpread, legY, 0.15, 0.11, c.limb, OUTLINE, lw / size);

  // --- arms (behind body) ---
  const armY = limbs === 'up' ? -0.22 : (limbs === 'fall' ? -0.30 : 0.14);
  const armX = limbs === 'up' ? 0.46 : 0.45;
  _ellipse(ctx, -armX, armY, 0.14, 0.11, c.limb, OUTLINE, lw / size);
  _ellipse(ctx, armX, armY, 0.14, 0.11, c.limb, OUTLINE, lw / size);

  // --- ears ---
  for (const s of [-1, 1]) {
    _ellipse(ctx, s * 0.34, -0.37, 0.17, 0.17, c.ear, OUTLINE, lw / size);
    _ellipse(ctx, s * 0.34, -0.36, 0.08, 0.08, c.furDark, null, 0);
  }

  // --- body / head blob ---
  _ellipse(ctx, 0, 0, 0.47, 0.45, c.fur, OUTLINE, lw / size);

  // --- panda eye patches ---
  if (c.patches) {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 0.19, -0.07);
      ctx.rotate(s * 0.45);
      _ellipse(ctx, 0, 0, 0.14, 0.17, c.ear, null, 0);
      ctx.restore();
    }
  }

  // --- muzzle ---
  _ellipse(ctx, 0, 0.17, 0.21, 0.15, c.muzzle, null, 0);

  // --- eyes ---
  const px = facing * 0.025;
  for (const s of [-1, 1]) {
    const ex = s * 0.19, ey = -0.07;
    if (dead) {
      // X_X
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(ex - 0.06, ey - 0.06); ctx.lineTo(ex + 0.06, ey + 0.06);
      ctx.moveTo(ex + 0.06, ey - 0.06); ctx.lineTo(ex - 0.06, ey + 0.06);
      ctx.stroke();
    } else {
      _ellipse(ctx, ex + px, ey, 0.062, 0.072, '#2b2320', null, 0);
      _ellipse(ctx, ex + px + 0.022, ey - 0.028, 0.022, 0.024, '#fff', null, 0);
    }
  }

  // --- nose + mouth ---
  _ellipse(ctx, 0, 0.09, 0.055, 0.042, '#2b2320', null, 0);
  ctx.strokeStyle = '#2b2320';
  ctx.lineWidth = 0.028;
  if (dead) {
    ctx.beginPath();
    ctx.arc(0, 0.26, 0.075, Math.PI, Math.PI * 2);           // frown
    ctx.stroke();
  } else {
    for (const s of [-1, 1]) {                                // :3 smile, two separate strokes
      ctx.beginPath();
      ctx.arc(s * 0.045, 0.14, 0.05, 0.12, Math.PI - 0.12);
      ctx.stroke();
    }
  }

  // --- blush ---
  _ellipse(ctx, -0.33, 0.08, 0.08, 0.055, c.blush, null, 0);
  _ellipse(ctx, 0.33, 0.08, 0.08, 0.055, c.blush, null, 0);

  // --- accessories ---
  if (c.hasBow) {
    ctx.save();
    ctx.translate(-0.42, -0.46);
    ctx.rotate(-0.3);
    _ellipse(ctx, -0.085, 0, 0.085, 0.065, c.accent, OUTLINE, lw / size);
    _ellipse(ctx, 0.085, 0, 0.085, 0.065, c.accent, OUTLINE, lw / size);
    _ellipse(ctx, 0, 0, 0.045, 0.045, '#ffd2dc', OUTLINE, lw / size);
    ctx.restore();
  }
  if (c.hasScarf) {
    ctx.beginPath();
    ctx.ellipse(0, 0.33, 0.33, 0.1, 0, Math.PI * 0.08, Math.PI * 0.92);
    ctx.fillStyle = c.accent;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw / size;
    ctx.stroke();
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
