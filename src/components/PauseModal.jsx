import React from 'react';
import WoodButton from './WoodButton';

export default function PauseModal({ onResume, onExit }) {
  return (
    <div className="capa" id="capa-menu" role="dialog" aria-modal="true" aria-labelledby="menu-titulo">
      <div className="panel">
        <h2 id="menu-titulo">Juego en pausa</h2>
        <p>El tiempo está detenido.</p>
        <div className="acciones">
          <WoodButton color="t-verde" chica onClick={onResume} autoFocus>
            Continuar
          </WoodButton>
          <WoodButton color="t-rojo" chica onClick={onExit}>
            Salir al mapa
          </WoodButton>
        </div>
      </div>
    </div>
  );
}
