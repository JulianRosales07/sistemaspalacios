import { BaseCortador } from './cortador';
import { azar, clamp, lerp, circ, rrect, texto, emoji, drawEstrellas, rgba } from '../canvasUtils';
import { P } from '../constants';
import { sfx } from '../audio';
import { drawPixelAvatar } from '../pixelAvatar';

export const R4_ATAQ = [
  ['📧', '¡URGENTE!'],
  ['😠', 'Grito'],
  ['🌙', 'Informe 9 p.m.'],
  ['🗣️', 'Rumor'],
  ['🎫', '20 tickets'],
  ['🤐', 'Burla']
];

export const R4_ALIADO = [
  ['🤝', 'Apoyo'],
  ['☕', 'Pausa'],
  ['💧', 'Agua'],
  ['💬', 'Pedir ayuda'],
  ['😴', 'Descanso']
];

export const R4_TRAMPA = [
  ['💸', 'Horas extra diarias'],
  ['📱', 'Solo un correo'],
  ['🥤', 'Bebida energética']
];

export class DrenadorGame extends BaseCortador {
  constructor() {
    super();
    this.corteOk = ['ataque', 'trampa'];
    this.toqueOk = ['aliado'];
    this.spawn = 0.9;
    this.hpMax = 100;
    this.hp = 100;
    this.golpe = 0;
    this.furia = false;
    this.fin = null;
    this.W = 300;
    this.H = 300;
    this.S = null;
    this.handlers = null;
  }

  init(W, DIF) {
    this.baseInit();
    this.W = W || 300;
    this.spawn = 0.9;
    // DIF puede ser el segundo argumento o el primero
    const difConfig = DIF && DIF.jefe ? DIF : W && W.jefe ? W : null;
    this.hpMax = difConfig?.jefe || 100;
    this.hp = this.hpMax;
    this.golpe = 0;
    this.furia = false;
    this.fin = null;
  }

  jefe(customW, customH, customS) {
    const W = customW || this.W || 300;
    const H = customH || this.H || 300;
    const S = customS || this.S || { tiempo: 0 };
    const r = clamp(W * 0.14, 46, 68);
    return {
      x: W / 2 + Math.sin((S.tiempo || 0) * 0.8) * W * 0.22,
      y: Math.max(r + 34, H * 0.2),
      r
    };
  }

  objetivo(customW, customH) {
    const W = customW || this.W || 300;
    const H = customH || this.H || 300;
    return { x: W / 2, y: H - 56 };
  }

  danar(n) {
    this.hp = Math.max(0, this.hp - n);
    this.golpe = 0.18;
    const b = this.jefe();
    if (this.handlers && this.handlers.flot) {
      this.handlers.flot(
        b.x + (Math.random() - 0.5) * 40,
        b.y + b.r + 18,
        '-' + n,
        P.morado
      );
    }
    sfx.golpe();
    if (this.hp <= 0) {
      this.fin = 'victoria';
    }
  }

  nuevo(p, W, H, DIF, S) {
    this.W = W;
    this.H = H;
    this.S = S;
    const q = Math.random(),
      r = this.rad(W);
    if (q < 0.56) {
      const b = this.jefe(W, H, S),
        o = this.objetivo(W, H),
        tx = o.x + (Math.random() - 0.5) * W * 0.5,
        x = b.x,
        y = b.y + b.r * 0.6,
        d = Math.hypot(tx - x, o.y - y);
      const sp = lerp(95, 150, p) * (this.furia ? 1.15 : 1) * DIF.vel,
        [e, l] = azar(R4_ATAQ);
      this.items.push({
        tipo: 'ataque',
        e,
        l,
        x,
        y,
        vx: ((tx - x) / d) * sp,
        vy: ((o.y - y) / d) * sp,
        r,
        vivo: true,
        grav: false
      });
    } else if (q < 0.56 + 0.18 * DIF.trampas) {
      const [e, l] = azar(R4_TRAMPA);
      this.desdeAbajo('trampa', e, l, true, W, H);
    } else {
      const [e, l] = azar(R4_ALIADO);
      this.desdeAbajo('aliado', e, l, false, W, H);
    }
    sfx.nueva();
  }

  update(dt, p, W, H, DIF, S, handlers) {
    this.W = W;
    this.H = H;
    this.S = S;
    this.handlers = handlers;

    this.golpe = Math.max(0, this.golpe - dt);
    if (!this.furia && this.hp <= this.hpMax / 2) {
      this.furia = true;
      handlers.aviso('¡El Drenador se enfurece! Ahora ataca más rápido.', 'trampa');
      sfx.trampa();
    }
    if (!S.tuto) {
      this.spawn -= dt;
      if (this.spawn <= 0) {
        this.nuevo(p, W, H, DIF, S);
        this.spawn =
          lerp(0.9, 0.5, p) * (this.furia ? 0.8 : 1) * (0.8 + Math.random() * 0.4) * DIF.spawn;
      }
    }
    this.moverItems(dt);
    const o = this.objetivo(W, H);
    for (const it of this.items) {
      if (it.vivo && it.tipo === 'ataque' && Math.hypot(it.x - o.x, it.y - o.y) < 44) {
        it.vivo = false;
        handlers.mal(o.x, o.y - 50, 'Te golpeó: ' + it.l, -7);
        handlers.explicar(
          'r4golpe',
          'Los ataques del Drenador se cortan deslizando el dedo antes de que te alcancen.',
          'mal'
        );
        handlers.ev('mal');
      }
    }
    this.limpiar(H, handlers);
  }

  cortar(it, handlers) {
    this.handlers = handlers;
    if (it.tipo === 'ataque') {
      handlers.contar('cortes');
      handlers.bien(it.x, it.y, 50, 'Bloqueado', 0);
      this.danar(4);
      handlers.explicar('r4corte', 'Cada ataque que cortas debilita al Drenador.', 'bien');
    } else if (it.tipo === 'trampa') {
      handlers.trampaEvitada(it.x, it.y, 90);
      this.danar(6);
      handlers.explicar('r4trampaok', '¡Trampa descubierta! Eso lo debilita más.', 'trampa');
    } else {
      handlers.mal(it.x, it.y, 'Apartaste tu apoyo', -6);
      handlers.explicar(
        'r4aliadocorte',
        'Tus aliados no se cortan: tócalos para recibir su ayuda.',
        'mal'
      );
    }
  }

  tocar(it, handlers) {
    this.handlers = handlers;
    if (it.tipo === 'aliado') {
      handlers.bien(it.x, it.y, 80, it.l, 7);
      this.danar(7);
      handlers.explicar(
        'r4aliado',
        'Apoyarte en otros y cuidarte te hace más fuerte que el Drenador.',
        'bien'
      );
    } else if (it.tipo === 'trampa') {
      handlers.mal(it.x, it.y, '¡Caíste en la trampa!', -10, true);
      this.hp = Math.min(this.hpMax, this.hp + 8);
      handlers.explicar(
        'r4trampa',
        'Trampa del Drenador: se alimentó de ella y recuperó energía.',
        'trampa'
      );
    } else {
      handlers.mal(it.x, it.y, 'Eso no se toca', -5);
    }
  }

  draw(ctx, W, H, S, cara, reduceMov, DIF, avatar) {
    this.W = W;
    this.H = H;
    this.S = S;

    drawEstrellas(ctx, W, H);
    const b = this.jefe(W, H, S),
      t = S.tiempo;

    ctx.save();
    const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.4, b.x, b.y, b.r * 1.9);
    g.addColorStop(0, rgba(P.morado, 0.5));
    g.addColorStop(1, rgba(P.morado, 0));
    ctx.fillStyle = g;
    circ(ctx, b.x, b.y, b.r * 1.9);
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2,
        rr =
          b.r *
          (1 +
            0.09 * Math.sin(a * 5 + t * 4) +
            (this.furia ? 0.05 * Math.sin(a * 9 - t * 9) : 0));
      const x = b.x + Math.cos(a) * rr,
        y = b.y + Math.sin(a) * rr * 0.88;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = this.golpe > 0 ? '#E9D5FF' : '#3B1D5E';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = P.morado;
    ctx.stroke();

    const ox = b.r * 0.34,
      oy = b.y - b.r * 0.12;
    ctx.shadowColor = '#FFE14D';
    ctx.shadowBlur = 12;
    ctx.fillStyle = this.furia ? '#FF5C5C' : '#FFE14D';
    ctx.beginPath();
    ctx.ellipse(b.x - ox, oy, b.r * 0.14, b.r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(b.x + ox, oy, b.r * 0.14, b.r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#150F2E';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(b.x - ox - b.r * 0.2, oy - b.r * 0.24);
    ctx.lineTo(b.x - ox + b.r * 0.12, oy - b.r * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x + ox + b.r * 0.2, oy - b.r * 0.24);
    ctx.lineTo(b.x + ox - b.r * 0.12, oy - b.r * 0.12);
    ctx.stroke();
    ctx.beginPath();
    const my = b.y + b.r * 0.32;
    for (let i = 0; i <= 6; i++) {
      const x = b.x - b.r * 0.4 + (i * b.r * 0.8) / 6,
        y = my + (i % 2 ? b.r * 0.08 : -b.r * 0.02);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Barra de vida del jefe
    rrect(ctx, 14, 10, W - 28, 18, 9);
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fill();
    if (this.hp > 0) {
      const barW = Math.max(0, (W - 28) * (this.hp / this.hpMax));
      rrect(ctx, 14, 10, barW, 18, 9);
      ctx.fillStyle = P.morado;
      ctx.fill();
    }
    texto(ctx, `El Drenador: ${Math.ceil(this.hp)} / ${this.hpMax}`, W / 2, 20, 12, '#fff', 900);

    // Base del jugador con el avatar en guardia de combate
    const o = this.objetivo(W, H);
    circ(ctx, o.x, o.y, 44);
    ctx.fillStyle = rgba(P.verde, 0.18);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(P.verde, 0.6);
    ctx.stroke();

    const animo = S.bateria > 60 ? 'feliz' : S.bateria > 30 ? 'normal' : 'cansado';
    drawPixelAvatar(ctx, o.x, o.y + 4, {
      avatar,
      scale: 2.8,
      postura: 'combate',
      animo,
      tiempo: S.tiempo,
      mostrarAura: true
    });

    this.dibujarItems(ctx, S, reduceMov);
    this.dibujarRastro(ctx);
  }
}
