import { azar, clamp, lerp, rrect, circ, emoji, burbujaItem, drawEstrellas, texto, rgba } from '../canvasUtils';
import { P } from '../constants';
import { sfx } from '../audio';
import { drawPixelAvatar } from '../pixelAvatar';

export const R1_BIEN = [
  ['💧', 'Agua', 6, 'Hidratarte es una recarga rápida para el cuerpo y la mente.'],
  ['🍲', 'Almuerzo caliente', 8, 'Almorzar lejos del escritorio recarga de verdad.'],
  ['✅', 'Ticket priorizado', 4, 'Un ticket con prioridad clara se atiende sin angustia.'],
  ['🤝', 'Apoyo del equipo', 7, 'Pedir y recibir apoyo reparte la carga.'],
  ['☕', 'Pausa activa', 9, 'Las pausas recargan la concentración.'],
  ['📶', 'Cliente conectado', 5, 'Reconocer lo logrado también motiva.']
];

export const R1_MAL = [
  ['📧', '¡URGENTE!', -8, 'Cuando todo es urgente, nada lo es. Prioriza con tu jefe o usa Decir NO.'],
  ['🎫', '20 tickets a la vez', -9, 'Nadie atiende 20 tickets al mismo tiempo. Prioriza y pide apoyo.'],
  ['📅', 'Reunión sin agenda', -7, 'Pide el objetivo de una reunión antes de aceptarla.'],
  ['🌙', 'Informe 9 p.m.', -8, 'El trabajo fuera de horario te quita descanso.'],
  ['🔔', '15 notificaciones', -6, 'Silenciar el chat un rato protege tu concentración.'],
  ['📂', 'No es tu área', -7, 'Decir que no con argumentos también es trabajar bien.']
];

export const R1_TRAMPA = [
  ['💸', 'Horas extra diarias', -12, 'Trampa del Drenador: trabajar horas extra todos los días parece bueno, pero te agota.'],
  ['🥤', 'Bebida energética', -9, 'Trampa del Drenador: la energía artificial no reemplaza el descanso.'],
  ['🏅', 'Ascenso sin descanso', -11, 'Trampa del Drenador: un logro que te quita el descanso no es un logro.']
];

export class SedeGame {
  constructor() {
    this.items = [];
    this.spawn = 0.5;
    this.x = 150;
    this.tx = 150;
    this.escudo = 0;
    this.cdNo = 0;
    this.izq = false;
    this.der = false;
  }

  init(W = 300) {
    this.items = [];
    this.spawn = 0.5;
    this.x = W / 2;
    this.tx = W / 2;
    this.escudo = 0;
    this.cdNo = 0;
    this.izq = false;
    this.der = false;
  }

  tw(W) {
    return clamp(W * 0.28, 96, 150);
  }

  ty(H) {
    return H - 46;
  }

  rad(W) {
    return clamp(W * 0.055, 22, 30);
  }

  nuevo(p, W, DIF, S) {
    const q = Math.random();
    let d, tipo, trampa = false;
    if (S.tiempo > 5 && q < 0.13 * DIF.trampas) {
      d = azar(R1_TRAMPA);
      tipo = 'mal';
      trampa = true;
    } else if (q < lerp(0.52, 0.64, p)) {
      d = azar(R1_MAL);
      tipo = 'mal';
    } else {
      d = azar(R1_BIEN);
      tipo = 'bien';
    }
    const r = this.rad(W);
    this.items.push({
      tipo,
      trampa,
      e: d[0],
      l: d[1],
      en: d[2],
      ex: d[3],
      x: lerp(r + 40, W - r - 40, Math.random()),
      y: -r - 10,
      vx: 0,
      vy: (lerp(120, 240, p) + Math.random() * 40) * DIF.vel,
      r,
      vivo: true,
      rebote: false
    });
    sfx.nueva();
  }

  tutoItem(tipo, d, x, vy, trampa, W, H) {
    const r = this.rad(W);
    const it = {
      tipo,
      trampa: !!trampa,
      e: d[0],
      l: d[1],
      en: d[2],
      ex: d[3],
      x: clamp(x, r + 30, W - r - 30),
      y: H * 0.3,
      vx: 0,
      vy,
      r,
      vivo: true,
      rebote: false
    };
    this.items.push(it);
    sfx.nueva();
    return it;
  }

  vaciar() {
    this.items = [];
    this.escudo = 0;
  }

  decirNo(S, handlers) {
    if (this.cdNo > 0 || S.pausado || !S.corriendo) return;
    if (S.tuto && !handlers.tutoPermite('escudo')) return;
    this.escudo = S.tuto ? 6 : 2.2;
    this.cdNo = 7;
    sfx.escudo();
  }

  update(dt, p, W, H, DIF, S, handlers) {
    if (this.izq) this.tx -= 560 * dt;
    if (this.der) this.tx += 560 * dt;
    const hw = this.tw(W) / 2;
    this.tx = clamp(this.tx, hw, W - hw);
    this.x += (this.tx - this.x) * Math.min(1, dt * 16);
    this.escudo = Math.max(0, this.escudo - dt);
    this.cdNo = Math.max(0, this.cdNo - dt);

    if (!S.tuto) {
      this.spawn -= dt;
      if (this.spawn <= 0) {
        this.nuevo(p, W, DIF, S);
        this.spawn = lerp(0.95, 0.5, p) * (0.8 + Math.random() * 0.4) * (S.bateria < 35 ? 0.85 : 1) * DIF.spawn;
      }
    }

    const ty = this.ty(H);
    for (const it of this.items) {
      if (it.rebote) it.vy += 600 * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      if (!it.vivo || it.rebote) continue;

      if (this.escudo > 0 && it.tipo === 'mal') {
        const dx = it.x - this.x,
          dy = it.y - ty;
        if (Math.hypot(dx, dy) < hw + 36 + it.r * 0.5) {
          it.rebote = true;
          it.vy = -Math.abs(it.vy) - 160;
          it.vx = (dx >= 0 ? 1 : -1) * (140 + Math.random() * 140);
          handlers.contar('no');
          handlers.ev('escudo');
          if (it.trampa) {
            handlers.trampaEvitada(it.x, it.y, 70);
            handlers.explicar('r1trampaok', '¡La descubriste! No todo lo que brilla recarga.', 'trampa');
          } else {
            handlers.bien(it.x, it.y, 60, '¡No!', 0);
            handlers.explicar('r1no', '¡Eso es! Decir que no a tiempo te protege de la sobrecarga.', 'bien');
          }
          continue;
        }
      }

      if (it.y + it.r * 0.6 >= ty - 12 && it.y < ty + 16 && Math.abs(it.x - this.x) < hw + it.r * 0.45) {
        it.vivo = false;
        if (it.tipo === 'bien') {
          handlers.bien(it.x, ty - 30, 80, '', it.en);
          handlers.explicar('r1' + it.l, it.ex, 'bien');
          handlers.ev('atrapo');
        } else if (it.trampa) {
          handlers.mal(it.x, ty - 30, '¡Era una trampa!', it.en, true);
          handlers.explicar('r1t' + it.l, it.ex, 'trampa');
          handlers.ev('mal');
        } else {
          handlers.mal(it.x, ty - 30, it.l, it.en);
          handlers.explicar('r1' + it.l, it.ex, 'mal');
          handlers.ev('mal');
        }
      }
    }

    for (const it of this.items) {
      if (it.vivo && !it.rebote && it.y > H + it.r) {
        it.vivo = false;
        if (it.trampa) handlers.trampaEvitada(it.x, H - 70, 30);
        handlers.ev(it.tipo === 'bien' ? 'perdio' : 'esquivo');
      }
    }

    this.items = this.items.filter(
      it => it.vivo && it.y < H + 60 && it.y > -220 && it.x > -80 && it.x < W + 80
    );
  }

  draw(ctx, W, H, S, cara, reduceMov, DIF, avatar) {
    drawEstrellas(ctx, W, H);
    const ty = this.ty(H),
      hw = this.tw(W) / 2;
    ctx.strokeStyle = rgba(P.tinta, 0.18);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(0, ty + 22);
    ctx.lineTo(W, ty + 22);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const it of this.items) {
      ctx.globalAlpha = it.rebote ? 0.5 : 1;
      burbujaItem(ctx, it, it.tipo === 'bien' || it.trampa ? P.verde : P.rojo, S.tiempo);
      ctx.globalAlpha = 1;
    }

    if (this.escudo > 0) {
      const pul = 0.2 + 0.1 * Math.sin(S.tiempo * 12);
      circ(ctx, this.x, ty, hw + 36);
      ctx.fillStyle = rgba(P.azul, pul);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = P.azul;
      ctx.stroke();
      texto(ctx, 'NO', this.x, ty - hw - 20, 22, P.azul);
    }

    // El avatar con su canasta recolectora oficial
    const animo = S.bateria > 60 ? 'feliz' : S.bateria > 30 ? 'normal' : 'cansado';
    drawPixelAvatar(ctx, this.x, ty + 42, {
      avatar,
      scale: 2.8,
      postura: 'canasta',
      animo,
      tiempo: S.tiempo,
      anchoCanasta: hw * 2
    });
  }

  down(pt) {
    this.tx = pt.x;
  }

  move(pt) {
    this.tx = pt.x;
  }

  up() {}

  tecla(e, ab, S, handlers) {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
      this.izq = ab;
      e.preventDefault();
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      this.der = ab;
      e.preventDefault();
    } else if (ab && e.code === 'Space') {
      e.preventDefault();
      this.decirNo(S, handlers);
    }
  }

  cancelar() {
    this.izq = this.der = false;
  }
}
