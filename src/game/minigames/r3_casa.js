import { BaseCortador } from './cortador';
import { azar, lerp, circ, emoji, drawEstrellas, rgba } from '../canvasUtils';
import { P } from '../constants';
import { sfx } from '../audio';
import { drawSofaCasa } from '../pixelAvatar';

export const R3_TRAB = [
  ['📱', 'Cliente de Ipiales'],
  ['💻', 'Cierra el ticket'],
  ['📧', 'Correo del jefe'],
  ['🔔', 'Grupo de la cuadrilla'],
  ['📞', 'Llamada 10 p.m.']
];

export const R3_VIDA = [
  ['🧒', 'Jugar con tu guagua'],
  ['🍲', 'Cena en familia'],
  ['😴', 'Dormir bien'],
  ['⚽', 'Fútbol con amigos'],
  ['🎭', 'Ensayo de carnaval'],
  ['🐶', 'Pasear al perro']
];

export const R3_TRAMPA = [
  ['📱', 'Solo un correo'],
  ['💻', 'Reviso rapidito'],
  ['📊', 'Un ajuste pequeño']
];

export class CasaGame extends BaseCortador {
  constructor() {
    super();
    this.corteOk = ['trabajo', 'trampa'];
    this.toqueOk = ['vida', 'turno'];
    this.spawn = 0.5;
  }

  init() {
    this.baseInit();
    this.spawn = 0.5;
  }

  objetivo(W, H) {
    return { x: W / 2, y: H * 0.6 };
  }

  nuevo(p, W, H, DIF, S) {
    const c = this.objetivo(W, H),
      r = this.rad(W),
      q = Math.random();
    if (q < 0.08 && !this.items.some(i => i.tipo === 'turno')) {
      const x = lerp(0.2, 0.8, Math.random()) * W,
        y = -r - 10,
        sp = 48,
        d = Math.hypot(c.x - x, c.y - y);
      this.items.push({
        tipo: 'turno',
        e: '🚨',
        l: 'Turno acordado',
        x,
        y,
        vx: ((c.x - x) / d) * sp,
        vy: ((c.y - y) / d) * sp,
        r: r + 2,
        vivo: true,
        grav: false
      });
    } else if (q < 0.58) {
      const lado = Math.floor(Math.random() * 3);
      let x, y;
      if (lado === 0) {
        x = Math.random() * W;
        y = -r - 10;
      } else if (lado === 1) {
        x = -r - 10;
        y = Math.random() * H * 0.5;
      } else {
        x = W + r + 10;
        y = Math.random() * H * 0.5;
      }
      const sp = (lerp(55, 112, p) + Math.random() * 20) * DIF.vel,
        d = Math.hypot(c.x - x, c.y - y),
        [e, l] = azar(R3_TRAB);
      this.items.push({
        tipo: 'trabajo',
        e,
        l,
        x,
        y,
        vx: ((c.x - x) / d) * sp,
        vy: ((c.y - y) / d) * sp,
        r,
        vivo: true,
        grav: false
      });
    } else if (q < 0.58 + 0.14 * DIF.trampas && S.tiempo > 5) {
      const [e, l] = azar(R3_TRAMPA);
      this.desdeAbajo('trampa', e, l, true, W, H);
    } else {
      const [e, l] = azar(R3_VIDA);
      this.desdeAbajo('vida', e, l, false, W, H);
    }
    sfx.nueva();
  }

  update(dt, p, W, H, DIF, S, handlers) {
    if (!S.tuto) {
      this.spawn -= dt;
      if (this.spawn <= 0) {
        this.nuevo(p, W, H, DIF, S);
        this.spawn = lerp(1.0, 0.55, p) * (0.8 + Math.random() * 0.4) * DIF.spawn;
      }
    }
    this.moverItems(dt);
    const c = this.objetivo(W, H);
    for (const it of this.items) {
      if (it.vivo && !it.grav && Math.hypot(it.x - c.x, it.y - c.y) < 48) {
        it.vivo = false;
        if (it.tipo === 'trabajo') {
          handlers.mal(c.x, c.y - 50, 'Se coló el trabajo', -8);
          handlers.explicar(
            'r3colo',
            'Cada mensaje de trabajo que dejas entrar en la noche te quita descanso. Córtalo.',
            'mal'
          );
          handlers.ev('mal');
        } else {
          handlers.mal(c.x, c.y - 50, 'No atendiste tu turno', -6);
          handlers.explicar(
            'r3turnomiss',
            'Un turno de disponibilidad acordado sí se atiende: tócalo.',
            'mal'
          );
          handlers.ev('mal');
        }
      }
    }
    this.limpiar(H, handlers);
  }

  cortar(it, handlers) {
    if (it.tipo === 'trabajo') {
      handlers.contar('cortes');
      handlers.bien(it.x, it.y, 60, 'Desconectado', 0);
      handlers.explicar(
        'r3corte',
        'La desconexión laboral es un derecho en Colombia (Ley 2191 de 2022).',
        'bien'
      );
    } else if (it.tipo === 'trampa') {
      handlers.contar('cortes');
      handlers.trampaEvitada(it.x, it.y, 80);
      handlers.explicar(
        'r3trampaok',
        '¡La descubriste! Ese "rapidito" era trabajo disfrazado de tiempo libre.',
        'trampa'
      );
    } else if (it.tipo === 'vida') {
      handlers.mal(it.x, it.y, 'Apartaste ese momento', -6);
      handlers.explicar(
        'r3vidacorte',
        'Los momentos con tu familia y tu descanso no se cortan: tócalos para vivirlos.',
        'mal'
      );
    } else {
      handlers.mal(it.x, it.y, 'Era tu turno acordado', -8);
      handlers.explicar(
        'r3turnocorte',
        'Si el turno está pactado, atenderlo es lo correcto. La clave es que sea acordado.',
        'mal'
      );
    }
  }

  tocar(it, handlers) {
    if (it.tipo === 'vida') {
      handlers.bien(it.x, it.y, 70, it.l, 7);
      handlers.explicar('r3vida', 'Estar presente con los tuyos es la mejor recarga.', 'bien');
    } else if (it.tipo === 'turno') {
      handlers.bien(it.x, it.y, 90, 'Turno atendido', -3);
      handlers.explicar(
        'r3turno',
        'Bien: era un turno acordado. Atenderlo es parte del compromiso.',
        'bien'
      );
    } else if (it.tipo === 'trampa') {
      handlers.mal(it.x, it.y, '¡Era trabajo!', -10, true);
      handlers.explicar(
        'r3trampa',
        'Trampa del Drenador: "solo un correo" nunca es solo uno. Lo que brilla morado se corta.',
        'trampa'
      );
    } else {
      handlers.mal(it.x, it.y, 'Respondiste fuera de horario', -5);
      handlers.explicar(
        'r3resp',
        'Responder de noche refuerza la costumbre de estar siempre disponible. Córtalo deslizando el dedo.',
        'mal'
      );
    }
  }

  draw(ctx, W, H, S, cara, reduceMov, DIF, avatar) {
    drawEstrellas(ctx, W, H);
    ctx.globalAlpha = 0.7;
    emoji(ctx, '🌙', W - 34, 32, 30);
    ctx.globalAlpha = 1;

    const c = this.objetivo(W, H);
    circ(ctx, c.x, c.y, 62);
    ctx.fillStyle = rgba(P.verde, 0.14);
    ctx.fill();

    circ(ctx, c.x, c.y, 52);
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = rgba(P.verde, 0.6);
    ctx.stroke();
    ctx.setLineDash([]);

    const animo = S.bateria > 60 ? 'feliz' : S.bateria > 30 ? 'normal' : 'cansado';
    drawSofaCasa(ctx, c.x, c.y, {
      avatar,
      animo,
      tiempo: S.tiempo
    });

    this.dibujarItems(ctx, S, reduceMov);
    this.dibujarRastro(ctx);
  }
}
