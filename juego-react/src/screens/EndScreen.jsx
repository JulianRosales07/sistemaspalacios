import React from 'react';
import WoodButton from '../components/WoodButton';
import { DIFS, multTxt } from '../game/constants';
import { num } from '../game/canvasUtils';

export default function EndScreen({ run, saveStatus, onBackToMenu }) {
  const dif = DIFS[run.dif] || DIFS.media;
  const ac = run.resultados.reduce((a, r) => a + (r.aciertos || 0), 0);
  const er = run.resultados.reduce((a, r) => a + (r.errores || 0), 0);
  const pct = ac + er ? ac / (ac + er) : 0;

  const perfil =
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
        <p className="gran-numero">{num(run.puntos)}</p>
        <p style={{ fontWeight: 800, marginTop: '-4px' }}>puntos en total</p>
        <p style={{ fontSize: '18px' }}>{perfil}</p>

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

        <p style={{ textAlign: 'left' }}>
          Si sientes que la carga de trabajo o el trato en tu equipo te están afectando, habla con
          Talento Humano, con el área de SST o con el Comité de Convivencia Laboral. Pedir ayuda
          también es cuidarse.
        </p>

        <p style={{ fontSize: '15px', fontWeight: 700, opacity: 0.8 }}>
          {saveStatus}
        </p>
      </div>

      <div className="acciones">
        <WoodButton color="t-teal" chica onClick={onBackToMenu}>
          Volver al menú
        </WoodButton>
      </div>
    </section>
  );
}
