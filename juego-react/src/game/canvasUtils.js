import { P, EF, TF } from './constants';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const azar = a => a[Math.floor(Math.random() * a.length)];
export function barajar(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function num(n) {
  return Math.round(n).toLocaleString('es-CO');
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

export function segDist(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
  let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function rgba(hex, a) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

export function emoji(ctx, e, x, y, s) {
  ctx.font = `${Math.round(s)}px ${EF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(e, x, y + s * 0.06);
}

export function texto(ctx, t, x, y, s, col, peso = 900) {
  ctx.font = `${peso} ${Math.round(s)}px ${TF}`;
  ctx.fillStyle = col;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t, x, y);
}

export function rrect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.closePath();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function circ(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

export function tintaPara(col) {
  return col === P.verde || col === P.ambar ? P.oscuro : '#fff';
}

export function etiqueta(ctx, t, x, y, bg, borde) {
  ctx.font = `800 13px ${TF}`;
  const m = ctx.measureText(t), w = m.width + 16, h = 22;
  rrect(ctx, x - w / 2, y - h / 2, w, h, 6);
  ctx.fillStyle = bg;
  ctx.fill();
  if (borde) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = borde;
    ctx.stroke();
  }
  ctx.fillStyle = tintaPara(bg);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t, x, y);
}

export function brilloTrampa(ctx, x, y, r, tiempo = 0) {
  const pul = 1 + 0.12 * Math.sin(tiempo * 9);
  circ(ctx, x, y, r * 1.35 * pul);
  ctx.fillStyle = rgba(P.morado, 0.35);
  ctx.fill();
  circ(ctx, x, y, r * 1.15 * pul);
  ctx.fillStyle = rgba(P.morado, 0.45);
  ctx.fill();
}

export function burbujaItem(ctx, it, col, tiempo = 0) {
  const r = it.r;
  if (it.trampa) brilloTrampa(ctx, it.x, it.y, r, tiempo);
  circ(ctx, it.x, it.y, r);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = P.oscuro;
  ctx.stroke();
  emoji(ctx, it.e, it.x, it.y, r * 1.1);
  etiqueta(ctx, it.l, it.x, it.y + it.r + 13, col, it.trampa ? P.morado : null);
}

export class FXManager {
  constructor() {
    this.textos = [];
    this.chispas = [];
  }

  reset() {
    this.textos = [];
    this.chispas = [];
  }

  flot(x, y, t, col, W = 300) {
    this.textos.push({ x: clamp(x, 70, W - 70), y, t, col, v: 0 });
  }

  chispasFx(x, y, col, n = 12, reduceMov = false) {
    if (reduceMov) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        s = 90 + Math.random() * 170;
      this.chispas.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        v: 0,
        col
      });
    }
  }

  update(dt) {
    this.textos.forEach(o => {
      o.v += dt;
      o.y -= 38 * dt;
    });
    this.textos = this.textos.filter(o => o.v < 1.1);

    this.chispas.forEach(o => {
      o.v += dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.vy += 320 * dt;
    });
    this.chispas = this.chispas.filter(o => o.v < 0.6);
  }

  draw(ctx) {
    this.chispas.forEach(o => {
      ctx.globalAlpha = 1 - o.v / 0.6;
      ctx.fillStyle = o.col;
      circ(ctx, o.x, o.y, 3.5);
      ctx.fill();
    });

    this.textos.forEach(o => {
      ctx.globalAlpha = Math.max(0, 1 - o.v / 1.1);
      ctx.font = `900 19px ${TF}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = P.oscuro;
      ctx.strokeText(o.t, o.x, o.y);
      ctx.fillStyle = o.col;
      ctx.fillText(o.t, o.x, o.y);
    });
    ctx.globalAlpha = 1;
  }
}

export function drawEstrellas(ctx, W, H) {
  ctx.fillStyle = rgba(P.tinta, 0.12);
  for (let i = 0; i < 30; i++) {
    const x = (i * 97.3) % W,
      y = (i * 53.7) % H;
    circ(ctx, x, y, 1.2);
    ctx.fill();
  }
}

export function mano(ctx, x, y) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 8;
  emoji(ctx, '👆', x + 6, y + 24, 40);
  ctx.restore();
}
