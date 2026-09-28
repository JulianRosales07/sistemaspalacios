import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sfx } from '../game/audio';

const FASES = [
  { n: 'Prepárate', d: 1.5, h: null },
  { n: 'Inhala… mantén presionado', d: 3, h: true },
  { n: 'Exhala… suelta', d: 3, h: false },
  { n: 'Inhala… mantén presionado', d: 3, h: true },
  { n: 'Exhala… suelta', d: 3, h: false }
];

export default function BreathingModal({ onComplete }) {
  const [faseIndex, setFaseIndex] = useState(0);
  const [scale, setScale] = useState(0.55);
  const [segundo, setSegundo] = useState('');
  const [esFuera, setEsFuera] = useState(false);
  const [presionado, setPresionado] = useState(false);

  const presRef = useRef(false);
  const statsRef = useRef({ ok: 0, tot: 0 });
  const animRef = useRef(null);
  const timeInFaseRef = useRef(0);
  const lastTsRef = useRef(performance.now());
  const faseIndexRef = useRef(0);

  const finishBreathing = useCallback(() => {
    const { ok, tot } = statsRef.current;
    const acc = tot ? ok / tot : 0;
    const rec = Math.round(10 + 22 * acc);
    const bono = Math.round(60 * acc);
    sfx.recarga();
    if (onComplete) {
      onComplete({ rec, bono });
    }
  }, [onComplete]);

  const tick = useCallback(
    (ts) => {
      const dt = Math.min(0.05, Math.max(0, (ts - lastTsRef.current) / 1000));
      lastTsRef.current = ts;
      timeInFaseRef.current += dt;

      const idx = faseIndexRef.current;
      if (idx >= FASES.length) {
        finishBreathing();
        return;
      }

      const F = FASES[idx];
      let s = 0.55;
      if (F.h === true) {
        s = 0.55 + 0.45 * Math.min(1, timeInFaseRef.current / F.d);
      } else if (F.h === false) {
        s = 1 - 0.45 * Math.min(1, timeInFaseRef.current / F.d);
      }
      setScale(s);

      if (F.h !== null) {
        statsRef.current.tot += dt;
        const ok = presRef.current === F.h;
        if (ok) {
          statsRef.current.ok += dt;
        }
        setEsFuera(!ok);
      } else {
        setEsFuera(false);
      }

      setSegundo(F.h === null ? '' : Math.max(1, Math.ceil(F.d - timeInFaseRef.current)));

      if (timeInFaseRef.current >= F.d) {
        faseIndexRef.current += 1;
        setFaseIndex(faseIndexRef.current);
        timeInFaseRef.current = 0;
        if (faseIndexRef.current >= FASES.length) {
          finishBreathing();
          return;
        }
      }

      animRef.current = requestAnimationFrame(tick);
    },
    [finishBreathing]
  );

  useEffect(() => {
    faseIndexRef.current = 0;
    timeInFaseRef.current = 0;
    lastTsRef.current = performance.now();
    statsRef.current = { ok: 0, tot: 0 };
    animRef.current = requestAnimationFrame(tick);

    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        presRef.current = true;
        setPresionado(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        presRef.current = false;
        setPresionado(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [tick]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    presRef.current = true;
    setPresionado(true);
  };

  const handlePointerUp = () => {
    presRef.current = false;
    setPresionado(false);
  };

  const currentFase = FASES[faseIndex] || FASES[0];

  return (
    <div className="capa" id="capa-resp" role="dialog" aria-modal="true" aria-labelledby="resp-titulo">
      <div className="panel">
        <h2 id="resp-titulo">Pausa activa: respiración</h2>
        <p>Mantén presionado mientras el círculo crece y suelta mientras se achica.</p>
        <div className="circulo-zona">
          <div
            className={`circulo ${esFuera ? 'fuera' : ''}`}
            id="circulo"
            style={{ transform: `scale(${scale})` }}
          >
            <span id="resp-seg">{segundo}</span>
          </div>
        </div>
        <p className="resp-fase" id="resp-fase">
          {currentFase.n}
        </p>
        <button
          className={`tabla chica t-verde btn-respirar ${presionado ? 'activo' : ''}`}
          type="button"
          id="btn-respirar"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          Mantén presionado
        </button>
      </div>
    </div>
  );
}
