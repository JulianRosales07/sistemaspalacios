import { azar, barajar, lerp, rrect, circ, emoji, etiqueta, brilloTrampa, rgba } from '../canvasUtils';
import { P } from '../constants';
import { sfx } from '../audio';
import { drawPuestoTrabajo } from '../pixelAvatar';

export const R2_CONF = [
  ['😠', 'Grito'],
  ['🤐', 'Burla'],
  ['🚫', 'Exclusión'],
  ['😤', 'Humillación']
];

export const R2_AYU = [
  ['🙋', '¿Me ayudas?'],
  ['😔', 'Mal día'],
  ['🎧', 'Cliente difícil']
];

export const R2_RUM = [
  ['🗣️', 'Rumor'],
  ['👂', 'Chisme']
];

export const R2_TRAMPA = [
  ['🤫', '¿Supiste lo de…?'],
  ['🙊', 'Te cuento algo…']
];

export const CARAS = ['👩', '👨', '🧑', '👵', '👴', '👱', '🧔', '👧', '👦'];

export class OperacionesGame {
  constructor() {
    this.desks = [];
    this.spawn = 0.6;
    this.hold = null;
    this.pres = false;
  }

  init() {
    this.desks = barajar(CARAS.slice()).map(c => ({ cara: c, mood: 1, ev: null }));
    this.spawn = 0.6;
    this.hold = null;
    this.pres = false;
  }

  geo(i, W, H) {
    const cw = W / 3,
      ch = H / 3,
      c = i % 3,
      r = Math.floor(i / 3),
      cx = cw * (c + 0.5),
      cy = ch * (r + 0.5),
      s = Math.min(cw, ch),
      off = Math.min(ch * 0.24, s * 0.36);
    return { cx, cy, s, bx: cx, by: cy - off + s * 0.04, br: s * 0.21, py: cy + off };
  }

  vecinos(i) {
    const c = i % 3,
      r = Math.floor(i / 3);
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]
      .map(([dx, dy]) => [c + dx, r + dy])
      .filter(([x, y]) => x >= 0 && x < 3 && y >= 0 && y < 3)
      .map(([x, y]) => y * 3 + x);
  }

  crear(i, tipo, dur, DIF) {
    if (!this.desks[i]) return;
    const [e, l] = azar(
      tipo === 'conf'
        ? R2_CONF
        : tipo === 'ayu'
        ? R2_AYU
        : tipo === 'rum'
        ? R2_RUM
        : R2_TRAMPA
    );
    this.desks[i].ev = {
      tipo,
      e,
      l,
      t: 0,
      dur: dur || (tipo === 'conf' ? 6.5 : tipo === 'ayu' ? 3.6 : tipo === 'trampa' ? 3.2 : 2.8) * (DIF?.tiempo || 1),
      hold: 0,
      spread: false
    };
    sfx.nueva();
  }

  vaciar() {
    this.desks.forEach(d => {
      d.ev = null;
      d.mood = 1;
    });
    this.hold = null;
    this.pres = false;
  }

  update(dt, p, W, H, DIF, S, handlers) {
    if (!S.tuto) this.spawn -= dt;
    if (!S.tuto && this.spawn <= 0) {
      const libres = this.desks.map((d, i) => (d.ev || i === 4 ? -1 : i)).filter(i => i >= 0);
      if (libres.length) {
        const r = Math.random(),
          tp = 0.14 * DIF.trampas;
        this.crear(azar(libres), r < 0.42 ? 'conf' : r < 0.7 ? 'ayu' : r < 1 - tp ? 'rum' : 'trampa', null, DIF);
      }
      this.spawn = lerp(1.3, 0.65, p) * (0.8 + Math.random() * 0.4) * DIF.spawn;
    }

    let conflictos = 0;
    this.desks.forEach((d, i) => {
      const e = d.ev;
      if (!e) {
        d.mood = Math.min(1, d.mood + dt * 0.15);
        return;
      }
      e.t += dt;
      const g = this.geo(i, W, H);
      if (e.tipo === 'conf') {
        conflictos++;
        d.mood = Math.max(0, d.mood - dt * 0.3);
        if (this.hold === i && this.pres) {
          e.hold += dt;
          if (e.hold >= DIF.hold) {
            d.ev = null;
            this.hold = null;
            this.pres = false;
            handlers.contar('interv');
            handlers.bien(g.bx, g.by, 120, 'Intervenido', 4);
            handlers.explicar(
              'r2conf',
              'Intervenir con respeto a tiempo evita que el maltrato se vuelva costumbre.',
              'bien'
            );
            handlers.ev('intervino');
            return;
          }
        } else {
          e.hold = Math.max(0, e.hold - dt * 0.3);
        }

        if (!S.tuto && !e.spread && e.t > 3.2) {
          e.spread = true;
          const v = this.vecinos(i).filter(j => !this.desks[j].ev);
          if (v.length) {
            this.crear(azar(v), 'conf', null, DIF);
            handlers.explicar(
              'r2spread',
              'El maltrato que nadie frena se contagia al resto del equipo.',
              'mal'
            );
          }
        }

        if (e.t >= e.dur) {
          d.ev = null;
          if (this.hold === i) {
            this.hold = null;
            this.pres = false;
          }
          handlers.mal(g.bx, g.by, 'Se escaló', -8);
          handlers.explicar('r2esc', 'El silencio frente al maltrato lo normaliza.', 'mal');
          handlers.ev('mal');
        }
      } else if (e.tipo === 'ayu') {
        if (e.t >= e.dur) {
          d.ev = null;
          handlers.mal(g.bx, g.by, 'Nadie ayudó', -3);
          handlers.explicar(
            'r2ayumiss',
            'Cuando alguien pide apoyo y nadie responde, el equipo se debilita.',
            'mal'
          );
          handlers.ev('perdio');
        }
      } else if (e.tipo === 'rum') {
        if (e.t >= e.dur) {
          d.ev = null;
          handlers.bien(g.bx, g.by, 40, 'No lo repetiste', 0);
          handlers.explicar(
            'r2rumok',
            'Bien: los rumores se apagan cuando nadie los repite.',
            'bien'
          );
          handlers.ev('esquivo');
        }
      } else {
        if (e.t >= e.dur) {
          d.ev = null;
          handlers.trampaEvitada(g.bx, g.by, 60);
          handlers.explicar(
            'r2trampaok',
            '¡Bien visto! Era un chisme disfrazado de conversación.',
            'trampa'
          );
          handlers.ev('esquivo');
        }
      }
    });

    if (conflictos && !S.tuto) {
      S.bateria = Math.max(0, S.bateria - conflictos * 1.1 * DIF.dano * dt);
    }
  }

  hit(pt, W, H) {
    for (let i = 0; i < 9; i++) {
      const d = this.desks[i];
      if (!d || !d.ev) continue;
      const g = this.geo(i, W, H);
      if (Math.hypot(pt.x - g.bx, pt.y - g.by) < g.br * 1.5) return i;
    }
    return -1;
  }

  down(pt, W, H, S, handlers) {
    const i = this.hit(pt, W, H);
    if (i < 0) return;
    const d = this.desks[i],
      e = d.ev,
      g = this.geo(i, W, H);
    if (e.tipo === 'conf') {
      this.hold = i;
      this.pres = true;
    } else if (e.tipo === 'ayu') {
      d.ev = null;
      handlers.bien(g.bx, g.by, 90, 'Ayudaste', 5);
      handlers.explicar('r2ayu', 'Un momento de apoyo cambia el día de un compañero.', 'bien');
      handlers.ev('ayudo');
    } else if (e.tipo === 'rum') {
      d.ev = null;
      handlers.mal(g.bx, g.by, 'Repetiste el rumor', -8);
      handlers.explicar(
        'r2rum',
        'Repetir rumores daña la confianza y puede ser acoso. Déjalos pasar sin tocarlos.',
        'mal'
      );
      handlers.ev('mal');
    } else {
      d.ev = null;
      handlers.mal(g.bx, g.by, '¡Era un chisme!', -9, true);
      handlers.explicar(
        'r2trampa',
        'Trampa del Drenador: parecía alguien pidiendo apoyo, pero era un chisme. Fíjate en el brillo morado.',
        'trampa'
      );
      handlers.ev('mal');
    }
  }

  move(pt, W, H) {
    if (this.hold === null) return;
    const g = this.geo(this.hold, W, H);
    if (Math.hypot(pt.x - g.bx, pt.y - g.by) > g.br * 2.4) {
      this.hold = null;
      this.pres = false;
    }
  }

  up() {
    this.hold = null;
    this.pres = false;
  }

  cancelar() {
    this.hold = null;
    this.pres = false;
  }

  draw(ctx, W, H, S, reduceMov, DIF, avatar) {
    const animoJugador = S.bateria > 60 ? 'feliz' : S.bateria > 30 ? 'normal' : 'cansado';

    this.desks.forEach((d, i) => {
      const g = this.geo(i, W, H),
        s = g.s,
        dw = s * 0.74;

      // El puesto central (índice 4) es el colaborador protagonista sentado en su estación
      if (i === 4) {
        drawPuestoTrabajo(ctx, g.cx, g.py, {
          avatar,
          animo: animoJugador,
          tiempo: S.tiempo,
          nombre: 'TÚ',
          esJugador: true
        });
        return;
      }

      rrect(ctx, g.cx - dw / 2, g.py + s * 0.1, dw, s * 0.12, 8);
      ctx.fillStyle = P.mesa;
      ctx.fill();

      const mc = d.mood > 0.66 ? P.verde : d.mood > 0.33 ? P.ambar : P.rojo;
      circ(ctx, g.cx, g.py, s * 0.14);
      ctx.fillStyle = rgba(mc, 0.25);
      ctx.fill();

      emoji(ctx, d.cara, g.cx, g.py, s * 0.2);
      const e = d.ev;
      if (!e) return;

      const col =
        e.tipo === 'conf' ? P.rojo : e.tipo === 'ayu' || e.tipo === 'trampa' ? P.azul : P.suave;
      const pul = e.tipo === 'conf' && !reduceMov ? 1 + 0.05 * Math.sin(S.tiempo * 10) : 1,
        r = g.br * pul;

      ctx.beginPath();
      ctx.moveTo(g.bx - 8, g.by + r - 4);
      ctx.lineTo(g.bx, g.by + r + 10);
      ctx.lineTo(g.bx + 8, g.by + r - 4);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();

      circ(ctx, g.bx, g.by, r);
      ctx.fillStyle = col;
      ctx.fill();

      if (e.tipo === 'trampa') brilloTrampa(ctx, g.bx, g.by, r, S.tiempo);

      const rest = Math.max(0, 1 - e.t / e.dur);
      ctx.beginPath();
      ctx.arc(ctx, g.bx, g.by, r + 5, -Math.PI / 2, -Math.PI / 2 + rest * Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = rgba(P.tinta, 0.45);
      ctx.stroke();

      if (e.tipo === 'conf' && e.hold > 0) {
        ctx.beginPath();
        ctx.arc(
          g.bx,
          g.by,
          r + 5,
          -Math.PI / 2,
          -Math.PI / 2 + Math.min(1, e.hold / DIF.hold) * Math.PI * 2
        );
        ctx.lineWidth = 7;
        ctx.strokeStyle = P.verde;
        ctx.stroke();
      }

      emoji(ctx, e.e, g.bx, g.by, r * 1.05);
      etiqueta(ctx, e.l, g.bx, g.by - r - 14, col, e.tipo === 'trampa' ? P.morado : null);
    });
  }
}
