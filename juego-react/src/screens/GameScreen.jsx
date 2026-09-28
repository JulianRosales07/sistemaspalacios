import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CAPS_META, DIFS, P } from '../game/constants';
import { num, FXManager, mano, etiqueta, circ } from '../game/canvasUtils';
import { SedeGame } from '../game/minigames/r1_sede';
import { OperacionesGame } from '../game/minigames/r2_operaciones';
import { CasaGame } from '../game/minigames/r3_casa';
import { DrenadorGame } from '../game/minigames/r4_drenador';
import { TUTOS } from '../game/minigames/tutorials';
import { sfx } from '../game/audio';
import { avatarPorDefecto } from '../game/pixelAvatar';
import BreathingModal from '../components/BreathingModal';
import PauseModal from '../components/PauseModal';

const COOLDOWN_PAUSA = 18;

export default function GameScreen({
  chapterIndex,
  conTutorial,
  profile,
  run,
  onChapterEnd,
  onExitToMap,
  onSaveProfile
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const cMeta = CAPS_META[chapterIndex] || CAPS_META[0];
  const dif = DIFS[run.dif] || DIFS.media;

  // Modales
  const [isPaused, setIsPaused] = useState(false);
  const [isBreathing, setIsBreathing] = useState(false);

  // HUD States
  const [bateria, setBateria] = useState(run.bateria);
  const [tiempoRestante, setTiempoRestante] = useState(cMeta.dur);
  const [puntos, setPuntos] = useState(run.puntos);
  const [racha, setRacha] = useState(1);
  const [cooldownPausa, setCooldownPausa] = useState(0);
  const [cooldownNo, setCooldownNo] = useState(0);
  const [escudoActivo, setEscudoActivo] = useState(false);
  const [avisoTexto, setAvisoTexto] = useState(cMeta.pasos[0][1]);
  const [avisoClase, setAvisoClase] = useState('');
  const [flotantes, setFlotantes] = useState([]);

  // Tutorial UI State
  const [tutoActivo, setTutoActivo] = useState(conTutorial);
  const [tutoNum, setTutoNum] = useState('');
  const [tutoTxt, setTutoTxt] = useState('');
  const [tutoClase, setTutoClase] = useState('');
  const [resaltarBoton, setResaltarBoton] = useState(null);

  // Motor y referencias
  const gameRef = useRef(null);
  const fxRef = useRef(new FXManager());
  const dimensionsRef = useRef({ W: 300, H: 300 });

  const stateRef = useRef({
    cap: chapterIndex,
    bateria: run.bateria,
    tiempo: 0,
    puntosNivel: 0,
    racha: 0,
    cooldown: 0,
    shake: 0,
    corriendo: true,
    pausado: false,
    st: { buenas: 0, malas: 0, pausas: 0 },
    vistos: new Set(),
    tuto: null
  });

  const reduceMov =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const flotarBateria = useCallback((d) => {
    if (!Number.isFinite(d)) return;
    const rounded = Math.round(d);
    if (Math.abs(rounded) < 1) return;
    const id = Date.now() + Math.random();
    const sube = rounded > 0;
    const txt = (rounded > 0 ? '+' : '') + rounded + '%';
    const left = 15 + Math.random() * 60;
    setFlotantes((prev) => [...prev.slice(-3), { id, txt, sube, left }]);
    setTimeout(() => {
      setFlotantes((prev) => prev.filter((f) => f.id !== id));
    }, 1150);
  }, []);

  const drenarBateria = useCallback((drenaje) => {
    const S = stateRef.current;
    if (S.tuto) return;
    const nueva = Math.max(0, Math.min(100, S.bateria - drenaje));
    S.bateria = nueva;
    setBateria(nueva);
  }, []);

  const cambiarBateria = useCallback(
    (d, conFlotante = true) => {
      const S = stateRef.current;
      if (S.tuto) return;
      const nueva = Math.max(0, Math.min(100, S.bateria + d));
      S.bateria = nueva;
      setBateria(nueva);
      if (conFlotante && Math.abs(d) >= 1) {
        flotarBateria(d);
      }
    },
    [flotarBateria]
  );

  const contar = useCallback(
    (k, n = 1) => {
      const S = stateRef.current;
      if (!S.tuto && profile) {
        profile.cont = profile.cont || {};
        profile.cont[k] = (profile.cont[k] || 0) + n;
        onSaveProfile(profile);
      }
    },
    [profile, onSaveProfile]
  );

  const getMultiplier = useCallback(() => {
    return 1 + Math.min(Math.max(stateRef.current.racha - 1, 0), 4) * 0.25;
  }, []);

  const sumarPuntos = useCallback(
    (p) => {
      const S = stateRef.current;
      const v = Math.round(p * dif.mult);
      if (!S.tuto) {
        S.puntosNivel += v;
        setPuntos(run.puntos + S.puntosNivel);
      }
      return v;
    },
    [dif.mult, run.puntos]
  );

  const bien = useCallback(
    (x, y, pts, txt, energia) => {
      const S = stateRef.current;
      S.racha++;
      S.st.buenas++;
      const mult = getMultiplier();
      const p = sumarPuntos(pts * mult);
      setRacha(mult);
      fxRef.current.flot(x, y - 10, (txt ? txt + '  ' : '') + '+' + p, P.verde);
      fxRef.current.chispasFx(x, y, P.verde, 12, reduceMov);
      if (energia) cambiarBateria(energia);
      sfx.bien();
    },
    [getMultiplier, sumarPuntos, cambiarBateria, reduceMov]
  );

  const mal = useCallback(
    (x, y, txt, energia, trampa) => {
      const S = stateRef.current;
      S.racha = 0;
      S.st.malas++;
      setRacha(1);
      fxRef.current.flot(x, y - 10, txt, trampa ? P.morado : P.rojo);
      fxRef.current.chispasFx(x, y, trampa ? P.morado : P.rojo, 8, reduceMov);
      if (energia) cambiarBateria(Math.round(energia * dif.dano));
      if (trampa) sfx.trampa();
      else sfx.mal();
      S.shake = 0.3;
    },
    [cambiarBateria, dif.dano, reduceMov]
  );

  const trampaEvitada = useCallback(
    (x, y, pts = 40) => {
      const S = stateRef.current;
      S.st.buenas++;
      const v = sumarPuntos(pts);
      contar('trampas');
      fxRef.current.flot(x, y, 'Trampa descubierta  +' + v, P.morado);
      fxRef.current.chispasFx(x, y, P.morado, 10, reduceMov);
    },
    [sumarPuntos, contar, reduceMov]
  );

  const aviso = useCallback((t, clase) => {
    setAvisoTexto(t);
    setAvisoClase(clase || '');
  }, []);

  const explicar = useCallback(
    (clave, t, clase) => {
      const S = stateRef.current;
      if (S.vistos.has(clave)) return;
      S.vistos.add(clave);
      aviso(t, clase);
    },
    [aviso]
  );

  const tutoPermite = useCallback((t) => {
    const S = stateRef.current;
    return !!(
      S.tuto &&
      S.tuto.estado === 'activo' &&
      S.tuto.pasos[S.tuto.i]?.ok?.includes(t)
    );
  }, []);

  const finTutorial = useCallback(() => {
    const S = stateRef.current;
    S.tuto = null;
    setTutoActivo(false);
    setResaltarBoton(null);

    if (profile) {
      profile.tutos = profile.tutos || {};
      profile.tutos[chapterIndex] = true;
      onSaveProfile(profile);
    }

    S.bateria = run.bateria;
    S.tiempo = 0;
    S.puntosNivel = 0;
    S.racha = 0;
    S.cooldown = 0;
    S.shake = 0;
    S.st = { buenas: 0, malas: 0, pausas: 0 };
    S.vistos = new Set();
    fxRef.current.reset();

    setBateria(run.bateria);
    setPuntos(run.puntos);
    setRacha(1);

    const { W } = dimensionsRef.current;
    gameRef.current?.cancelar?.();
    gameRef.current?.init?.(W, dif);

    aviso('¡Ahora sí, va en serio! Corre el tiempo y cuenta cada punto.', 'bien');
    const { H } = dimensionsRef.current;
    fxRef.current.flot(W / 2, H / 2, '¡A jugar!', P.ambar, W);
  }, [chapterIndex, dif, profile, run, aviso, onSaveProfile]);

  const tutoPaso = useCallback(() => {
    const S = stateRef.current;
    const t = S.tuto;
    if (!t) return;
    const p = t.pasos[t.i];
    setResaltarBoton(null);
    gameRef.current?.cancelar?.();
    gameRef.current?.vaciar?.();
    t.estado = 'activo';

    const { W, H } = dimensionsRef.current;
    p.preparar(gameRef.current, W, H, dif, S);

    if (p.boton) {
      setResaltarBoton(p.boton);
    }
    setTutoClase('');
    setTutoNum(`Tutorial ${t.i + 1} de ${t.pasos.length}`);
    setTutoTxt(p.txt);
  }, [dif]);

  const tutoResultado = useCallback(
    (r) => {
      const S = stateRef.current;
      const t = S.tuto;
      if (!t || t.estado !== 'activo') return;
      const p = t.pasos[t.i];

      if (p.ok.includes(r)) {
        t.estado = 'bien';
        setTutoClase('bien');
        setTutoTxt(
          t.i === t.pasos.length - 1
            ? '¡Excelente! Ya sabes cómo se juega.'
            : '¡Muy bien! Así se hace.'
        );
        setTimeout(() => {
          if (stateRef.current.tuto !== t) return;
          t.i++;
          if (t.i >= t.pasos.length) {
            finTutorial();
          } else {
            tutoPaso();
          }
        }, 1300);
      } else {
        t.estado = 'fallo';
        setTutoClase('mal');
        setTutoTxt(p.pista);
        setTimeout(() => {
          if (stateRef.current.tuto !== t) return;
          tutoPaso();
        }, 2200);
      }
    },
    [finTutorial, tutoPaso]
  );

  const ev = useCallback(
    (t) => {
      const S = stateRef.current;
      if (S.tuto && S.tuto.estado === 'activo') {
        tutoResultado(t);
      }
    },
    [tutoResultado]
  );

  // Guardar handlers en ref para que el loop siempre tenga la última versión
  const handlersRef = useRef({
    bien,
    mal,
    trampaEvitada,
    explicar,
    aviso,
    contar,
    cambiarBateria,
    drenarBateria,
    flot: (x, y, txt, col) => fxRef.current.flot(x, y, txt, col),
    ev,
    tutoPermite
  });

  useEffect(() => {
    handlersRef.current = {
      bien,
      mal,
      trampaEvitada,
      explicar,
      aviso,
      contar,
      cambiarBateria,
      drenarBateria,
      flot: (x, y, txt, col) => fxRef.current.flot(x, y, txt, col),
      ev,
      tutoPermite
    };
  }, [bien, mal, trampaEvitada, explicar, aviso, contar, cambiarBateria, drenarBateria, ev, tutoPermite]);

  const saltarTutorial = () => {
    sfx.clic();
    finTutorial();
  };

  // LOOP PRINCIPAL DE CANVAS
  useEffect(() => {
    // 1. Instanciar el juego
    if (chapterIndex === 0) gameRef.current = new SedeGame();
    else if (chapterIndex === 1) gameRef.current = new OperacionesGame();
    else if (chapterIndex === 2) gameRef.current = new CasaGame();
    else gameRef.current = new DrenadorGame();

    // 2. Resetear estado de ejecución
    const S = stateRef.current;
    S.cap = chapterIndex;
    S.bateria = run.bateria;
    S.tiempo = 0;
    S.puntosNivel = 0;
    S.racha = 0;
    S.cooldown = 0;
    S.shake = 0;
    S.corriendo = true;
    S.pausado = false;
    S.st = { buenas: 0, malas: 0, pausas: 0 };
    S.vistos = new Set();
    fxRef.current.reset();

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Ajustar dimensiones del canvas
    const ajustarCanvas = () => {
      const rect = container.getBoundingClientRect();
      const W = Math.max(280, rect.width - 8);
      const H = Math.max(240, rect.height - 8);
      dimensionsRef.current = { W, H };

      const DPR = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';

      const ctx = canvas.getContext('2d');
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    ajustarCanvas();
    const { W, H } = dimensionsRef.current;
    gameRef.current.init(W, dif);

    // Si viene con tutorial
    if (conTutorial) {
      S.tuto = {
        cap: chapterIndex,
        pasos: TUTOS[chapterIndex],
        i: 0,
        estado: 'activo',
        objetivo: null
      };
      setTutoActivo(true);
      aviso('Tutorial: aquí practicas sin perder batería ni puntos.', '');
      tutoPaso();
    } else {
      S.tuto = null;
      setTutoActivo(false);
      aviso(cMeta.pasos[0][1], '');
    }

    let animId;
    let ultimoTs = performance.now();

    const loop = (ts) => {
      if (!stateRef.current.corriendo) return;

      try {
        const dt = Math.min(0.05, Math.max(0, (ts - ultimoTs) / 1000));
        ultimoTs = ts;

        const curW = dimensionsRef.current.W;
        const curH = dimensionsRef.current.H;

        if (!S.pausado) {
          S.tiempo += dt;

          if (S.tuto) {
            gameRef.current.update(dt, 0, curW, curH, dif, S, handlersRef.current);
            fxRef.current.update(dt);
          } else {
            const p = Math.min(1, S.tiempo / cMeta.dur);
            const drenajeDt = cMeta.drenaje * dif.drenaje * dt;
            S.bateria = Math.max(0, S.bateria - drenajeDt);
            S.cooldown = Math.max(0, S.cooldown - dt);
            S.shake = Math.max(0, S.shake - dt);

            setBateria(S.bateria);
            setTiempoRestante(Math.max(0, Math.ceil(cMeta.dur - S.tiempo)));
            setCooldownPausa(S.cooldown);

            if (gameRef.current.cdNo !== undefined) {
              setCooldownNo(gameRef.current.cdNo);
              setEscudoActivo(gameRef.current.escudo > 0);
            }

            gameRef.current.update(dt, p, curW, curH, dif, S, handlersRef.current);
            fxRef.current.update(dt);

            // Condiciones de fin
            if (gameRef.current.fin === 'victoria') {
              S.corriendo = false;
              onChapterEnd('victoria', S.st, S);
              return;
            }
            if (S.bateria <= 0) {
              S.corriendo = false;
              onChapterEnd('agotado', S.st, S);
              return;
            }
            if (S.tiempo >= cMeta.dur) {
              S.corriendo = false;
              onChapterEnd('tiempo', S.st, S);
              return;
            }
          }
        }

        // Dibujar en el canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, curW, curH);
        ctx.fillStyle = P.fondo;
        ctx.fillRect(0, 0, curW, curH);

        ctx.save();
        if (!reduceMov) {
          let m = S.shake * 16;
          if (S.bateria < 25) m += 2;
          if (m > 0) {
            ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
          }
        }

        const cara = S.bateria > 60 ? '😊' : S.bateria > 30 ? '😐' : '😰';
        const avatarActual = profile?.avatar || avatarPorDefecto();
        gameRef.current.draw(ctx, curW, curH, S, cara, reduceMov, dif, avatarActual);
        fxRef.current.draw(ctx);

        // Dibujar mano guía en tutorial
        if (S.tuto && S.tuto.estado === 'activo') {
          const t = S.tuto;
          const p = t.pasos[t.i];
          const tt = performance.now() / 1000;
          const o = t.objetivo ? t.objetivo() : null;

          if (p.gesto === 'boton') {
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,.55)';
            ctx.shadowBlur = 8;
            mano(ctx, curW / 2, curH - 30 + Math.sin(tt * 6) * 7);
            ctx.restore();
            etiqueta(ctx, 'Toca el botón de abajo', curW / 2, curH - 66, P.ambar);
          } else if (p.gesto === 'arrastrar' && o) {
            const f = (tt % 1.6) / 1.6;
            const x = (1 - f) * gameRef.current.x + f * o.x;
            mano(ctx, x, gameRef.current.ty(curH) - 8);
          } else if (p.gesto === 'esquivar') {
            mano(ctx, gameRef.current.x + Math.sin(tt * 3.5) * 60, gameRef.current.ty(curH) - 8);
            etiqueta(ctx, 'Muévete a un lado', gameRef.current.x, gameRef.current.ty(curH) - 70, P.ambar);
          } else if (o) {
            if (p.gesto === 'tocar') {
              mano(ctx, o.x, o.y + Math.abs(Math.sin(tt * 5)) * 12);
            } else if (p.gesto === 'mantener') {
              const pul = 0.5 + 0.5 * Math.sin(tt * 6);
              circ(ctx, o.x, o.y, 40 + pul * 6);
              ctx.lineWidth = 3;
              ctx.strokeStyle = `rgba(61,220,132,${0.4 + 0.4 * pul})`;
              ctx.stroke();
              mano(ctx, o.x, o.y);
              etiqueta(ctx, 'Mantén el dedo', o.x, o.y + 66, P.verde);
            } else if (p.gesto === 'deslizar') {
              const f = (tt % 1.1) / 1.1;
              const x = o.x - 70 + 140 * f;
              const y = o.y + (f - 0.5) * 24;
              ctx.globalAlpha = 0.6;
              ctx.lineWidth = 5;
              ctx.lineCap = 'round';
              ctx.strokeStyle = '#FFF4E0';
              ctx.beginPath();
              ctx.moveTo(o.x - 70, o.y - 12);
              ctx.lineTo(x, y - 12);
              ctx.stroke();
              ctx.globalAlpha = 1;
              mano(ctx, x, y - 12);
            } else if (p.gesto === 'esperar') {
              mano(ctx, o.x + 46, o.y - 6);
              etiqueta(ctx, 'No lo toques, espera', o.x, o.y + 62, P.ambar);
            }
          }
        }

        ctx.restore();
      } catch (err) {
        console.error('Error en el loop de juego:', err);
      }

      animId = requestAnimationFrame(loop);
    };

    window.addEventListener('resize', ajustarCanvas);
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', ajustarCanvas);
      stateRef.current.corriendo = false;
    };
  }, [chapterIndex, conTutorial]); // Dependencias mínimas y estables

  // Eventos de puntero
  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const handlePointerDown = (e) => {
    const S = stateRef.current;
    if (!S.corriendo || S.pausado) return;
    e.preventDefault();
    const pt = getCanvasPos(e);
    const { W, H } = dimensionsRef.current;
    gameRef.current?.down?.(pt, W, H, S, handlersRef.current);
  };

  const handlePointerMove = (e) => {
    const S = stateRef.current;
    if (!S.corriendo || S.pausado) return;
    const pt = getCanvasPos(e);
    if (gameRef.current instanceof SedeGame || e.buttons || e.pointerType !== 'mouse') {
      gameRef.current?.move?.(pt, handlersRef.current);
    }
  };

  const handlePointerUp = (e) => {
    const S = stateRef.current;
    if (S.corriendo && !S.pausado) {
      const pt = getCanvasPos(e);
      gameRef.current?.up?.(pt, false, handlersRef.current);
    }
  };

  const handlePointerCancel = () => {
    const S = stateRef.current;
    if (S.corriendo) {
      gameRef.current?.up?.(null, true, handlersRef.current);
    }
  };

  // Teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isBreathing) return;
      if (e.key === 'Escape') {
        setIsPaused((prev) => !prev);
        stateRef.current.pausado = !stateRef.current.pausado;
        return;
      }
      if (stateRef.current.corriendo && !stateRef.current.pausado && gameRef.current?.tecla) {
        gameRef.current.tecla(e, true, stateRef.current, handlersRef.current);
      }
    };

    const handleKeyUp = (e) => {
      if (isBreathing) return;
      if (stateRef.current.corriendo && gameRef.current?.tecla) {
        gameRef.current.tecla(e, false, stateRef.current, handlersRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isBreathing]);

  // Botón Decir NO
  const handleDecirNo = () => {
    if (gameRef.current instanceof SedeGame) {
      gameRef.current.decirNo(stateRef.current, handlersRef.current);
    }
  };

  // Pausa Activa
  const handleOpenBreathing = () => {
    const S = stateRef.current;
    if (S.cooldown > 0 || S.pausado || !S.corriendo) return;
    if (S.tuto && !tutoPermite('pausa')) return;
    S.st.pausas++;
    contar('pausas');
    S.pausado = true;
    gameRef.current?.cancelar?.();
    setIsBreathing(true);
  };

  const handleBreathingComplete = ({ rec, bono }) => {
    setIsBreathing(false);
    const S = stateRef.current;
    cambiarBateria(rec);
    if (bono) {
      const bv = sumarPuntos(bono);
      const { W, H } = dimensionsRef.current;
      fxRef.current.flot(W / 2, H / 2, 'Respiraste  +' + bv, P.verde, W);
    }
    aviso(
      `Recargaste ${rec}%. Respirar despacio baja el ritmo del corazón y aclara la mente.`,
      'bien'
    );
    S.cooldown = S.tuto ? 0 : COOLDOWN_PAUSA;
    S.pausado = false;
    ev('pausa');
  };

  // Botón menú pausa
  const handleOpenPauseMenu = () => {
    stateRef.current.pausado = true;
    gameRef.current?.cancelar?.();
    setIsPaused(true);
  };

  const handleResumeGame = () => {
    setIsPaused(false);
    stateRef.current.pausado = false;
  };

  const batColor =
    bateria > 60 ? 'var(--verde)' : bateria > 30 ? 'var(--ambar)' : 'var(--rojo)';

  return (
    <section
      className={`pantalla ${bateria <= 25 ? 'alto' : bateria <= 50 ? 'medio' : ''}`}
      id="p-juego"
    >
      {/* HUD Superior */}
      <div className="hud">
        <button
          className="hud-btn"
          type="button"
          id="btn-menu"
          aria-label="Pausar juego"
          onClick={handleOpenPauseMenu}
        >
          ❚❚
        </button>
        <div className="hud-cap">
          <b id="hud-cap">{cMeta.nombre}</b>
          <small id="hud-sub">
            {chapterIndex < 3 ? `Capítulo ${chapterIndex + 1} de 3` : 'Batalla final'}, nivel{' '}
            {dif.nombre}
          </small>
        </div>
        <div className="hud-dato">
          <b id="hud-tiempo">{tutoActivo ? cMeta.dur : tiempoRestante}</b>
          <span>segundos</span>
        </div>
        <div className="hud-dato">
          <b id="hud-puntos">{num(puntos)}</b>
          <span>puntos</span>
        </div>
      </div>

      {/* Barra de batería */}
      <div>
        <div className="bateria" id="bateria-juego" style={{ '--color-carga': batColor }}>
          <div className="bat-cuerpo">
            <div className="bat-carga" style={{ width: `${bateria}%` }} />
            <div className="bat-txt">{Math.ceil(bateria)}%</div>
            {flotantes.map((f) => (
              <span
                key={f.id}
                className={`flota ${f.sube ? 'sube' : 'baja'}`}
                style={{ left: `${f.left}%` }}
              >
                {f.txt}
              </span>
            ))}
          </div>
          <div className="bat-polo" />
        </div>
      </div>

      {/* Zona Canvas */}
      <div className="lienzo" id="lienzo-caja" ref={containerRef} style={{ '--c': cMeta.lienzo }}>
        <canvas
          ref={canvasRef}
          id="lienzo"
          aria-label="Zona de juego interactiva"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        />

        {tutoActivo && (
          <div className={`tuto ${tutoClase}`} id="tuto" role="status">
            <div className="tuto-cab">
              <b>{tutoNum}</b>
              <button className="tuto-saltar" type="button" onClick={saltarTutorial}>
                Saltar tutorial
              </button>
            </div>
            <p>{tutoTxt}</p>
          </div>
        )}
      </div>

      {/* Banner de aviso / explicación */}
      <div className={`aviso ${avisoClase}`} id="aviso" role="status">
        {avisoTexto}
      </div>

      {/* Barra inferior de acciones */}
      <div className="pie">
        {cMeta.no && (
          <button
            className={`tabla chica t-azul ${resaltarBoton === '#btn-no' ? 'resalta' : ''}`}
            type="button"
            id="btn-no"
            disabled={cooldownNo > 0 || (tutoActivo && !tutoPermite('escudo'))}
            onClick={handleDecirNo}
          >
            <div className="cd" style={{ width: `${(cooldownNo / 7) * 100}%` }} />
            <span>
              {escudoActivo ? 'Escudo' : cooldownNo > 0 ? `NO ${Math.ceil(cooldownNo)} s` : 'Decir NO'}
            </span>
          </button>
        )}

        <button
          className={`tabla chica t-verde ${resaltarBoton === '#btn-pausa' ? 'resalta' : ''}`}
          type="button"
          id="btn-pausa"
          disabled={cooldownPausa > 0 || (tutoActivo && !tutoPermite('pausa'))}
          onClick={handleOpenBreathing}
        >
          <div className="cd" style={{ width: `${(cooldownPausa / COOLDOWN_PAUSA) * 100}%` }} />
          <span>{cooldownPausa > 0 ? `Pausa ${Math.ceil(cooldownPausa)} s` : 'Pausa activa'}</span>
        </button>

        <div className="racha">
          <span>x{racha.toLocaleString('es-CO')}</span>
          <small>racha</small>
        </div>
      </div>

      {/* Modales */}
      {isBreathing && <BreathingModal onComplete={handleBreathingComplete} />}
      {isPaused && <PauseModal onResume={handleResumeGame} onExit={onExitToMap} />}
    </section>
  );
}
