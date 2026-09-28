import React from 'react';
import WoodButton from '../components/WoodButton';
import { CAPS_META, DIFS, multTxt, INSIGNIAS } from '../game/constants';
import { num } from '../game/canvasUtils';

export default function SummaryScreen({
  chapterIndex,
  motivo,
  stats,
  gameState,
  run,
  profile,
  insigniasAntes,
  insigniasDespues,
  onContinueMap,
  onSeeEnding,
  onRetryChapter
}) {
  const c = CAPS_META[chapterIndex] || CAPS_META[0];
  const dif = DIFS[run.dif] || DIFS.media;
  const exito = motivo !== 'agotado';

  const base = gameState.puntosNivel;
  const bono = exito ? Math.round(gameState.bateria * 2 * dif.mult) : 0;
  const victoria = motivo === 'victoria' ? Math.round(500 * dif.mult) : 0;
  const total = base + bono + victoria;

  let titulo = '';
  if (!exito) {
    titulo = 'Te apagaste';
  } else if (chapterIndex < 3) {
    titulo = '¡Núcleo recuperado!';
  } else {
    titulo = motivo === 'victoria' ? '¡Venciste al Drenador!' : 'El Drenador escapó';
  }

  const claves = exito
    ? c.claves
    : [
        'El agotamiento no llega de golpe: se acumula cuando no hay pausas ni límites.',
        c.claves[0]
      ];

  const nuevasInsignias = INSIGNIAS.filter(
    x => insigniasDespues.has(x[0]) && !insigniasAntes.has(x[0])
  );

  return (
    <section className="pantalla pantalla-panel" id="p-resumen">
      <div className="panel">
        <div className={`tabla panel-cab ${c.tabla}`}>
          {chapterIndex < 3 ? `Capítulo ${chapterIndex + 1}` : 'Final'}
        </div>
        <h2>{titulo}</h2>

        <div className="tabla-datos">
          <div className="fila">
            <span>Puntos por acciones</span>
            <b>{num(base)}</b>
          </div>
          {exito && (
            <div className="fila">
              <span>Bono por batería</span>
              <b>
                {num(bono)} ({Math.round(gameState.bateria)}%)
              </b>
            </div>
          )}
          {victoria > 0 && (
            <div className="fila">
              <span>Bono por vencer al Drenador</span>
              <b>{num(victoria)}</b>
            </div>
          )}
          <div className="fila">
            <span>Dificultad</span>
            <b>
              {dif.nombre} (puntos {multTxt(dif)})
            </b>
          </div>
          <div className="fila">
            <span>Aciertos</span>
            <b>{stats.buenas}</b>
          </div>
          <div className="fila">
            <span>Errores</span>
            <b>{stats.malas}</b>
          </div>
          <div className="fila">
            <span>Pausas activas</span>
            <b>{stats.pausas}</b>
          </div>
          <div className="fila total">
            <span>{exito ? 'Total del capítulo' : 'Puntos perdidos'}</span>
            <b>{num(exito ? total : base)}</b>
          </div>
        </div>

        {exito && chapterIndex < 3 && (
          <p style={{ fontWeight: 800 }}>
            Tu batería pasa al siguiente capítulo: {Math.round(gameState.bateria)}% +{' '}
            {dif.descanso}% por descansar ={' '}
            {Math.min(100, Math.round(gameState.bateria) + dif.descanso)}%.
          </p>
        )}

        {!exito && (
          <p style={{ fontWeight: 800 }}>
            El Drenador te alcanzó. Puedes reintentar este capítulo con {dif.reintento}% de
            batería.
          </p>
        )}

        <div className="claves">
          {claves.map((txt, i) => (
            <div key={i} className="clave">
              {txt}
            </div>
          ))}
        </div>

        {nuevasInsignias.length > 0 && (
          <div>
            {nuevasInsignias.map(x => (
              <p key={x[0]} className="nueva-insignia">
                {x[1]} Nueva insignia: {x[2]}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="acciones">
        {exito ? (
          chapterIndex < 3 ? (
            <WoodButton color="t-teal" chica onClick={onContinueMap} autoFocus>
              Continuar al mapa
            </WoodButton>
          ) : (
            <WoodButton color="t-morado" chica onClick={onSeeEnding} autoFocus>
              Ver el final
            </WoodButton>
          )
        ) : (
          <>
            <WoodButton color="t-verde" chica onClick={onRetryChapter} autoFocus>
              Reintentar con {dif.reintento}%
            </WoodButton>
            <WoodButton color="t-rojo" chica onClick={onContinueMap}>
              Volver al mapa
            </WoodButton>
          </>
        )}
      </div>
    </section>
  );
}
