import React from 'react';
import WoodButton from '../components/WoodButton';
import { DIFS, multTxt } from '../game/constants';
import { num } from '../game/canvasUtils';

export default function EndScreen({
  run,
  profile,
  saveStatus,
  intentoInfo,
  onBackToMenu,
  onPlaySecondAttempt,
  onGoRanking
}) {
  const dif = DIFS[run.dif] || DIFS.media;
  const ac = run.resultados.reduce((a, r) => a + (r.aciertos || 0), 0);
  const er = run.resultados.reduce((a, r) => a + (r.errores || 0), 0);
  const pct = ac + er ? ac / (ac + er) : 0;

  // Determinar número de intento actual
  const attemptNum =
    intentoInfo?.attempt ||
    (profile?.intentosUsados === 1 ? 1 : profile?.intentosUsados >= 2 ? 2 : 1);
  const esPrimerIntento = attemptNum === 1;
  const primerIntentoPuntaje =
    intentoInfo?.firstAttemptScore ?? profile?.primerIntentoPuntaje ?? (esPrimerIntento ? run.puntos : null);

  const perfilFeedback =
    pct >= 0.8
      ? 'Energía bien administrada. Sabes poner límites, apoyar a tu equipo y desconectarte.'
      : pct >= 0.6
      ? 'Vas por buen camino. Algunas trampas todavía te descargan: revisa en qué capítulo perdiste más.'
      : 'Tu batería pide atención. Pausar, pedir apoyo y decir que no también son parte del trabajo.';

  return (
    <section className="pantalla pantalla-panel" id="p-fin">
      <div className="panel" style={{ textAlign: 'center' }}>
        <div className="tabla panel-cab t-morado">
          {run.victoria ? 'Nariño vuelve a tener señal' : 'Fin de la aventura'}
        </div>

        {/* Tarjeta destacada de intento y ranking según las reglas de negocio */}
        {esPrimerIntento ? (
          <div
            className="card-destacada-intento intento-1"
            style={{
              background: 'linear-gradient(145deg, rgba(42, 35, 82, 0.95), rgba(26, 20, 51, 0.95))',
              border: '2px solid rgba(255, 183, 77, 0.7)',
              borderRadius: '16px',
              padding: '16px',
              margin: '12px 0 16px 0',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 0 12px rgba(255, 183, 77, 0.15)'
            }}
          >
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(255, 183, 77, 0.2)',
                color: '#ffb74d',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                marginBottom: '8px'
              }}
            >
              ⚡ PRIMER INTENTO COMPLETADO
            </div>

            <p style={{ margin: '4px 0', fontSize: '1rem', color: 'var(--crema-suave)' }}>
              Puntaje obtenido:
            </p>
            <p className="gran-numero" style={{ margin: '0 0 4px 0', color: '#ffb74d' }}>
              {num(run.puntos)}
            </p>

            <div
              style={{
                background: 'rgba(239, 83, 80, 0.18)',
                border: '1px solid rgba(239, 83, 80, 0.4)',
                borderRadius: '10px',
                padding: '10px 14px',
                margin: '10px 0',
                color: '#ffcdd2',
                fontSize: '0.92rem',
                lineHeight: '1.4'
              }}
            >
              ⚠️ <b>Este intento no cuenta para el ranking.</b>
              <br />
              Te queda <b>1 intento disponible</b>.
            </div>

            <p style={{ fontSize: '0.92rem', color: '#FFF4E0', margin: '8px 0', lineHeight: '1.4' }}>
              <b>El puntaje obtenido en tu segundo intento será el que se registre oficialmente.</b>
            </p>

            <div
              style={{
                fontSize: '0.88rem',
                color: 'var(--crema-suave)',
                marginTop: '10px',
                fontWeight: 700
              }}
            >
              Intentos utilizados: <span style={{ color: '#ffb74d' }}>1 de 2</span>
            </div>
          </div>
        ) : (
          <div
            className="card-destacada-intento intento-2"
            style={{
              background: 'linear-gradient(145deg, rgba(30, 48, 40, 0.95), rgba(20, 32, 28, 0.95))',
              border: '2px solid rgba(61, 220, 132, 0.8)',
              borderRadius: '16px',
              padding: '16px',
              margin: '12px 0 16px 0',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 0 14px rgba(61, 220, 132, 0.2)'
            }}
          >
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(61, 220, 132, 0.2)',
                color: '#3ddc84',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                marginBottom: '8px'
              }}
            >
              🏆 SEGUNDO INTENTO (PUNTAJE OFICIAL)
            </div>

            <p style={{ margin: '4px 0', fontSize: '1rem', color: 'var(--crema-suave)' }}>
              Tu puntaje oficial para el ranking:
            </p>
            <p className="gran-numero" style={{ margin: '0 0 4px 0', color: '#3ddc84' }}>
              {num(run.puntos)}
            </p>

            <div
              style={{
                background: 'rgba(61, 220, 132, 0.18)',
                border: '1px solid rgba(61, 220, 132, 0.5)',
                borderRadius: '10px',
                padding: '10px 14px',
                margin: '10px 0',
                color: '#b9f6ca',
                fontSize: '0.92rem',
                lineHeight: '1.4'
              }}
            >
              ✅ <b>Este es tu puntaje oficial para el ranking.</b>
              <br />
              Este puntaje ha sido registrado en el ranking general.
            </div>

            {primerIntentoPuntaje !== null && primerIntentoPuntaje !== undefined && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12px',
                  fontSize: '0.84rem',
                  color: 'var(--crema-suave)',
                  margin: '8px 0',
                  padding: '6px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '8px'
                }}
              >
                <span>Intento 1: <b>{num(primerIntentoPuntaje)}</b> (Historial)</span>
                <span>•</span>
                <span style={{ color: '#3ddc84' }}>Intento 2: <b>{num(run.puntos)}</b> (Oficial)</span>
              </div>
            )}

            <div
              style={{
                fontSize: '0.88rem',
                color: 'var(--crema-suave)',
                marginTop: '10px',
                fontWeight: 700
              }}
            >
              Intentos utilizados: <span style={{ color: '#3ddc84' }}>2 de 2 (Agotados)</span>
            </div>
          </div>
        )}

        <p style={{ fontSize: '16px', margin: '8px 0 12px 0' }}>{perfilFeedback}</p>

        <div className="tabla-datos" style={{ textAlign: 'left' }}>
          <div className="fila">
            <span>Dificultad</span>
            <b>
              {dif.nombre} ({multTxt(dif)})
            </b>
          </div>
          {run.resultados.map((r, i) => (
            <div key={i} className="fila">
              <span>{r.capitulo}</span>
              <b>{num(r.puntos)}</b>
            </div>
          ))}
          <div className="fila">
            <span>Aciertos</span>
            <b>{Math.round(pct * 100)}%</b>
          </div>
        </div>

        <p style={{ textAlign: 'left', fontSize: '0.9rem', opacity: 0.9 }}>
          Si sientes que la carga de trabajo o el trato en tu equipo te están afectando, habla con
          Talento Humano, con el área de SST o con el Comité de Convivencia Laboral. Pedir ayuda
          también es cuidarse.
        </p>

        <p style={{ fontSize: '14px', fontWeight: 700, opacity: 0.85, margin: '8px 0' }}>
          {saveStatus}
        </p>
      </div>

      <div
        className="acciones"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          marginTop: '12px'
        }}
      >
        {esPrimerIntento ? (
          <>
            <WoodButton
              color="t-ambar"
              onClick={onPlaySecondAttempt}
              title="Comenzar ahora tu segundo y definitivo intento"
            >
              🎮 JUGAR SEGUNDO INTENTO
            </WoodButton>
            <WoodButton color="t-teal" chica onClick={onBackToMenu}>
              Volver al menú
            </WoodButton>
          </>
        ) : (
          <>
            {onGoRanking && (
              <WoodButton color="t-morado" onClick={onGoRanking}>
                🏆 Ver Ranking Oficial
              </WoodButton>
            )}
            <WoodButton color="t-teal" chica onClick={onBackToMenu}>
              Volver al menú
            </WoodButton>
          </>
        )}
      </div>
    </section>
  );
}
