import { R1_BIEN, R1_MAL, R1_TRAMPA } from './r1_sede';

export const TUTOS = [
  // Capítulo 1
  [
    {
      gesto: 'arrastrar',
      ok: ['atrapo'],
      txt: 'Arrastra el dedo por la zona de juego para mover tu tabla. Atrapa el agua 💧.',
      pista: 'Se te pasó. Mueve la tabla debajo del agua antes de que llegue abajo.',
      preparar(R1, W, H, DIF, S) {
        const x = R1.x < W / 2 ? W * 0.78 : W * 0.22;
        const it = R1.tutoItem('bien', R1_BIEN[0], x, 60 * DIF.vel, false, W, H);
        S.tuto.objetivo = () => it;
      }
    },
    {
      gesto: 'esquivar',
      ok: ['esquivo'],
      txt: 'Lo rojo te sobrecarga. Mueve la tabla hacia un lado para que no te caiga encima.',
      pista: 'Te cayó encima. Esta vez apártate hacia un lado.',
      preparar(R1, W, H, DIF, S) {
        const it = R1.tutoItem('mal', R1_MAL[0], R1.x, 70 * DIF.vel, false, W, H);
        S.tuto.objetivo = () => it;
      }
    },
    {
      gesto: 'boton',
      boton: '#btn-no',
      ok: ['escudo'],
      txt: 'Ahora toca el botón Decir NO. Crea un escudo que rechaza la sobrecarga.',
      pista: 'Esta vez toca Decir NO antes de que llegue a tu tabla.',
      preparar(R1, W, H, DIF, S) {
        R1.cdNo = 0;
        R1.escudo = 0;
        const it = R1.tutoItem('mal', R1_MAL[2], R1.x, 50 * DIF.vel, false, W, H);
        S.tuto.objetivo = () => it;
      }
    },
    {
      gesto: 'esquivar',
      ok: ['esquivo', 'escudo'],
      txt: 'Ojo: esto parece bueno, pero brilla morado. Es una trampa del Drenador. No la atrapes.',
      pista: '¡Caíste en la trampa! Lo que brilla morado se esquiva.',
      preparar(R1, W, H, DIF, S) {
        R1.cdNo = 0;
        const it = R1.tutoItem('mal', R1_TRAMPA[0], R1.x, 60 * DIF.vel, true, W, H);
        S.tuto.objetivo = () => it;
      }
    },
    {
      gesto: 'boton',
      boton: '#btn-pausa',
      ok: ['pausa'],
      txt: 'Por último: cuando tu batería baje, toca Pausa activa y respira siguiendo el círculo.',
      pista: '',
      preparar(R1, W, H, DIF, S) {
        S.cooldown = 0;
        S.tuto.objetivo = null;
      }
    }
  ],

  // Capítulo 2
  [
    {
      gesto: 'mantener',
      ok: ['intervino'],
      txt: 'Hay un conflicto. Pon el dedo sobre la burbuja roja y mantenlo un instante, hasta que se llene el círculo verde.',
      pista: 'Se escaló. Pon el dedo encima y no lo levantes hasta que el círculo se llene.',
      preparar(R2, W, H, DIF, S) {
        R2.crear(4, 'conf', 30, DIF);
        S.tuto.objetivo = () => {
          const g = R2.geo(4, W, H);
          return { x: g.bx, y: g.by };
        };
      }
    },
    {
      gesto: 'tocar',
      ok: ['ayudo'],
      txt: 'Un compañero pide ayuda (burbuja azul). Tócalo con un toque rápido.',
      pista: 'Se quedó sin ayuda. Tócalo antes de que se acabe su tiempo.',
      preparar(R2, W, H, DIF, S) {
        R2.crear(5, 'ayu', 8, DIF);
        S.tuto.objetivo = () => {
          const g = R2.geo(5, W, H);
          return { x: g.bx, y: g.by };
        };
      }
    },
    {
      gesto: 'esperar',
      ok: ['esquivo'],
      txt: 'Esto es un rumor (burbuja gris). No lo toques: espera a que desaparezca solo.',
      pista: 'Lo tocaste, y eso es repetir el rumor. Esta vez solo espera.',
      preparar(R2, W, H, DIF, S) {
        R2.crear(7, 'rum', 3.5, DIF);
        S.tuto.objetivo = () => {
          const g = R2.geo(7, W, H);
          return { x: g.bx, y: g.by };
        };
      }
    },
    {
      gesto: 'esperar',
      ok: ['esquivo'],
      txt: 'Parece alguien pidiendo ayuda, pero brilla morado: es un chisme disfrazado. Tampoco lo toques.',
      pista: 'Era un chisme. Fíjate en el brillo morado y déjalo pasar.',
      preparar(R2, W, H, DIF, S) {
        R2.crear(3, 'trampa', 3.5, DIF);
        S.tuto.objetivo = () => {
          const g = R2.geo(3, W, H);
          return { x: g.bx, y: g.by };
        };
      }
    }
  ],

  // Capítulo 3
  [
    {
      gesto: 'deslizar',
      ok: ['corto'],
      txt: 'Un mensaje de trabajo viene hacia tu casa. Desliza el dedo por encima para cortarlo.',
      pista: 'Se coló. Pasa el dedo rápido por encima del mensaje, como si lo cortaras.',
      preparar(R3, W, H, DIF, S) {
        const item = R3.tutoItem('trabajo', '📱', 'Cliente sin servicio', W * 0.22, H * 0.32, 22 * DIF.vel, false, W, H);
        S.tuto.objetivo = () => item;
      }
    },
    {
      gesto: 'tocar',
      ok: ['toco'],
      txt: 'Tu guagua quiere jugar. Los momentos verdes se tocan con un toque suave para vivirlos. ¡No los cortes!',
      pista: 'Ese momento no se corta. Tócalo con un toque, sin deslizar.',
      preparar(R3, W, H, DIF, S) {
        const item = R3.tutoItem('vida', '🧒', 'Jugar con tu guagua', W * 0.26, H * 0.36, 0, false, W, H);
        S.tuto.objetivo = () => item;
      }
    },
    {
      gesto: 'tocar',
      ok: ['toco'],
      txt: 'Estás de turno de disponibilidad acordado y se cayó un nodo. Ese sí se atiende: tócalo.',
      pista: 'El turno acordado se toca, no se corta ni se deja pasar.',
      preparar(R3, W, H, DIF, S) {
        const item = R3.tutoItem('turno', '🚨', 'Turno acordado', W * 0.84, H * 0.32, 16 * DIF.vel, false, W, H);
        S.tuto.objetivo = () => item;
      }
    },
    {
      gesto: 'deslizar',
      ok: ['corto'],
      txt: 'Esto parece un momento libre, pero brilla morado: es trabajo disfrazado. Córtalo.',
      pista: 'Era una trampa. Lo que brilla morado se corta deslizando el dedo.',
      preparar(R3, W, H, DIF, S) {
        const item = R3.tutoItem('trampa', '📱', 'Solo un correo', W * 0.7, H * 0.38, 0, true, W, H);
        S.tuto.objetivo = () => item;
      }
    }
  ],

  // Capítulo 4
  [
    {
      gesto: 'deslizar',
      ok: ['corto'],
      txt: 'El Drenador lanza ataques hacia ti. Córtalos deslizando el dedo antes de que te alcancen.',
      pista: 'Te alcanzó. Pasa el dedo por encima del ataque para cortarlo.',
      preparar(R4, W, H, DIF, S) {
        const b = R4.jefe(W, H, S);
        const item = R4.tutoItem('ataque', '📧', '¡URGENTE!', b.x, b.y + b.r + 30, 40 * DIF.vel, false, W, H);
        S.tuto.objetivo = () => item;
      }
    },
    {
      gesto: 'tocar',
      ok: ['toco'],
      txt: 'Tus aliados (verde) se tocan: te recargan y golpean al Drenador.',
      pista: 'Tus aliados no se cortan. Dales un toque suave.',
      preparar(R4, W, H, DIF, S) {
        const item = R4.tutoItem('aliado', '🤝', 'Apoyo', W * 0.26, H * 0.55, 0, false, W, H);
        S.tuto.objetivo = () => item;
      }
    },
    {
      gesto: 'deslizar',
      ok: ['corto'],
      txt: 'Las trampas moradas se cortan, nunca se tocan: si las tocas, el Drenador se recupera.',
      pista: 'Esa era una trampa. Córtala deslizando el dedo.',
      preparar(R4, W, H, DIF, S) {
        const item = R4.tutoItem('trampa', '💸', 'Horas extra diarias', W * 0.72, H * 0.55, 0, true, W, H);
        S.tuto.objetivo = () => item;
      }
    }
  ]
];
