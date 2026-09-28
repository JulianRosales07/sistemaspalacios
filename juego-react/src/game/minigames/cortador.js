import { clamp, lerp, circ, burbujaItem, segDist, rgba } from '../canvasUtils';
import { P } from '../constants';
import { sfx } from '../audio';

export const G3 = 430;

export class BaseCortador {
  constructor() {
    this.items = [];
    this.trail = [];
    this.dn = null;
    this.corteOk = [];
    this.toqueOk = [];
  }

  baseInit() {
    this.items = [];
    this.trail = [];
    this.dn = null;
  }

  rad(W) {
    return clamp(W * 0.06, 24, 32);
  }

  desdeAbajo(tipo, e, l, trampa, W, H) {
    const c = this.objetivo(W, H),
      r = this.rad(W),
      x = lerp(0.18, 0.82, Math.random()) * W,
      y = H + r + 10;
    const vy = -Math.sqrt(2 * G3 * H * (0.55 + Math.random() * 0.25)),
      vx = (c.x - x) * (0.15 + Math.random() * 0.2);
    this.items.push({
      tipo,
      e,
      l,
      trampa: !!trampa,
      x,
      y,
      vx,
      vy,
      r,
      vivo: true,
      grav: true
    });
  }

  moverItems(dt) {
    for (const it of this.items) {
      if (it.grav) it.vy += G3 * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
    }
  }

  limpiar(H, handlers) {
    for (const it of this.items) {
      if (it.vivo && it.grav && it.vy > 0 && it.y > H + it.r + 20) {
        it.vivo = false;
        handlers.ev('perdio');
      }
    }
    this.items = this.items.filter(
      it => it.vivo && !(it.grav && it.vy > 0 && it.y > H + it.r + 20) && it.y < H + 200
    );
    const now = performance.now();
    this.trail = this.trail.filter(t => now - t.t < 160);
  }

  down(pt) {
    const now = performance.now();
    this.dn = { lx: pt.x, ly: pt.y, dist: 0, t: now };
    this.trail = [{ x: pt.x, y: pt.y, t: now }];
  }

  move(pt, handlers) {
    const d = this.dn;
    if (!d) return;
    const len = Math.hypot(pt.x - d.lx, pt.y - d.ly);
    d.dist += len;
    this.trail.push({ x: pt.x, y: pt.y, t: performance.now() });
    if (d.dist > 14 && len > 0) {
      for (const it of this.items) {
        if (it.vivo && segDist(d.lx, d.ly, pt.x, pt.y, it.x, it.y) < it.r) {
          it.vivo = false;
          sfx.corte();
          this.cortar(it, handlers);
          handlers.ev(this.corteOk.includes(it.tipo) ? 'corto' : 'mal');
        }
      }
    }
    d.lx = pt.x;
    d.ly = pt.y;
  }

  up(pt, cancel, handlers) {
    const d = this.dn;
    this.dn = null;
    if (!d || cancel || !pt) return;
    if (d.dist < 14 && performance.now() - d.t < 600) {
      const it = this.items.find(
        i => i.vivo && Math.hypot(i.x - pt.x, i.y - pt.y) < i.r * 1.35
      );
      if (it) {
        it.vivo = false;
        this.tocar(it, handlers);
        handlers.ev(this.toqueOk.includes(it.tipo) ? 'toco' : 'mal');
      }
    }
  }

  cancelar() {
    this.dn = null;
    this.trail = [];
  }

  vaciar() {
    this.items = [];
    this.trail = [];
    this.dn = null;
  }

  tutoItem(tipo, e, l, x, y, sp, trampa, W, H) {
    const r = this.rad(W),
      o = this.objetivo(W, H),
      d = Math.hypot(o.x - x, o.y - y) || 1;
    const it = {
      tipo,
      e,
      l,
      trampa: !!trampa,
      x,
      y,
      vx: sp ? ((o.x - x) / d) * sp : 0,
      vy: sp ? ((o.y - y) / d) * sp : 0,
      r: tipo === 'turno' ? r + 2 : r,
      vivo: true,
      grav: false
    };
    this.items.push(it);
    sfx.nueva();
    return it;
  }

  dibujarItems(ctx, S, reduceMov) {
    for (const it of this.items) {
      const col =
        it.tipo === 'trabajo' || it.tipo === 'ataque'
          ? P.rojo
          : it.tipo === 'turno'
          ? P.ambar
          : P.verde;
      if (it.tipo === 'turno' && !reduceMov) {
        circ(ctx, it.x, it.y, it.r + 6 + 3 * Math.sin(S.tiempo * 8));
        ctx.fillStyle = rgba(P.ambar, 0.25);
        ctx.fill();
      }
      burbujaItem(ctx, it, col, S.tiempo);
    }
  }

  dibujarRastro(ctx) {
    if (this.trail.length < 2) return;
    const now = performance.now();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1],
        b = this.trail[i],
        v = 1 - (now - b.t) / 160;
      ctx.globalAlpha = Math.max(0, v);
      ctx.lineWidth = 2 + 6 * v;
      ctx.strokeStyle = '#FFF4E0';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
