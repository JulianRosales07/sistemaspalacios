import React, { useState } from 'react';
import WoodButton from '../components/WoodButton';
import { CAPS_META, DIFS, multTxt } from '../game/constants';
import { sfx } from '../game/audio';
import { generarAvatarDataUrl, avatarPorDefecto } from '../game/pixelAvatar';

export default function MapScreen({
  profile,
  run,
  onSelectChapter,
  onSelectDifficulty,
  onBackToMenu
}) {
  const [aviso, setAviso] = useState(() => {
    if (run.cap === 0) return 'Recupera los tres núcleos para llegar al nodo principal.';
    if (run.cap < 3) {
      return `Siguiente parada: ${CAPS_META[run.cap].nombre}. Tu batería llega con ${Math.round(run.bateria)}%.`;
    }
    return 'Tienes los tres núcleos. Es hora de enfrentar al Drenador.';
  });

  const d = DIFS[run.dif] || DIFS.media;
  const libre = !profile?.run || profile.run.cap === 0;

  const handleNodeClick = (i) => {
    if (i < run.cap) {
      setAviso('Ya recuperaste este núcleo. Sigue adelante.');
      return;
    }
    if (i > run.cap) {
      setAviso(
        i === 3
          ? 'Primero recupera los tres núcleos.'
          : 'Ese capítulo sigue bloqueado. Termina el anterior.'
      );
      sfx.mal();
      return;
    }
    sfx.clic();
    onSelectChapter(i);
  };

  const handleDifficultyClick = (difKey) => {
    if (!libre) return;
    sfx.clic();
    onSelectDifficulty(difKey);
  };

  const batColor =
    run.bateria > 60 ? 'var(--verde)' : run.bateria > 30 ? 'var(--ambar)' : 'var(--rojo)';

  return (
    <section className="pantalla" id="p-mapa">
      {/* Estado superior de batería y núcleos */}
      <div className="mapa-estado">
        <img
          src={generarAvatarDataUrl(profile?.avatar || avatarPorDefecto(), 48)}
          alt="Avatar del Colaborador"
          title="Tu avatar oficial de Sistemas Palacios"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: '2px solid var(--madera2)',
            background: 'rgba(0,0,0,0.3)',
            imageRendering: 'pixelated'
          }}
        />
        <div className="mini-bat" aria-label="Batería de la aventura">
          <div className="cuerpo">
            <div
              className="carga"
              id="map-carga"
              style={{ width: `${run.bateria}%`, backgroundColor: batColor }}
            />
            <div className="txt" id="map-bat">
              {Math.round(run.bateria)}%
            </div>
          </div>
          <div className="polo" />
        </div>
        <div className="nucleos" id="map-nucleos">
          ⚡ {Math.min(run.cap, 3)}/3
        </div>
      </div>

      {/* Selector de dificultad */}
      <div className="dif-caja" id="map-dif">
        <p className="dif-titulo">Dificultad</p>
        <div
          className="dif-opciones"
          id="dif-opciones"
          role="group"
          aria-label="Elegir dificultad"
          style={{ display: libre ? 'flex' : 'none' }}
        >
          <button
            className="tabla chica t-verde dif-op"
            type="button"
            aria-pressed={run.dif === 'facil'}
            onClick={() => handleDifficultyClick('facil')}
          >
            Fácil
          </button>
          <button
            className="tabla chica t-naranja dif-op"
            type="button"
            aria-pressed={run.dif === 'media'}
            onClick={() => handleDifficultyClick('media')}
          >
            Media
          </button>
          <button
            className="tabla chica t-rojo dif-op"
            type="button"
            aria-pressed={run.dif === 'dificil'}
            onClick={() => handleDifficultyClick('dificil')}
          >
            Difícil
          </button>
        </div>
        <p className="dif-nota" id="dif-nota">
          {libre
            ? `${d.nota} Puntos ${multTxt(d)}.`
            : `Nivel ${d.nombre}, puntos ${multTxt(d)}.`}
        </p>
      </div>

      <div className="aviso" id="map-aviso">
        {aviso}
      </div>

      {/* Camino de nodos */}
      <div className="camino" id="camino">
        {CAPS_META.map((c, i) => {
          const est = i < run.cap ? 'hecha' : i === run.cap ? 'actual' : 'bloqueada';
          const sello = est === 'hecha' ? '⚡' : est === 'bloqueada' ? '🔒' : '';
          const sub =
            est === 'hecha'
              ? i < 3
                ? 'Núcleo recuperado'
                : 'Completado'
              : est === 'actual'
              ? 'Disponible'
              : i === 3
              ? 'Necesitas los 3 núcleos'
              : 'Bloqueado';

          return (
            <button
              key={c.id}
              className={`parada ${est}`}
              type="button"
              onClick={() => handleNodeClick(i)}
              aria-disabled={est !== 'actual'}
            >
              <span className="nodo" style={{ '--c': c.color }}>
                <span aria-hidden="true">{c.icono}</span>
                {sello && (
                  <span className="sello" aria-hidden="true">
                    {sello}
                  </span>
                )}
              </span>
              <span className="parada-info">
                <b>
                  {i < 3 ? `Capítulo ${i + 1}: ` : 'Final: '}
                  {c.nombre}
                </b>
                <small>{sub}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mapa-pie">
        <WoodButton color="t-rojo" chica onClick={onBackToMenu}>
          Menú
        </WoodButton>
      </div>
    </section>
  );
}
