import React, { useState, useEffect } from 'react';
import { ARTE } from '../game/constants';
import WoodButton from './WoodButton';
import { sfx } from '../game/audio';

export default function StoryModal({ panels, onFinish, finalButtonText = 'Continuar' }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [panels]);

  if (!panels || panels.length === 0) return null;

  const current = panels[index] || panels[0];
  const [quien, arte, texto] = current;
  const isLast = index === panels.length - 1;

  const handleNext = () => {
    sfx.clic();
    if (!isLast) {
      setIndex(prev => prev + 1);
    } else {
      if (onFinish) onFinish();
    }
  };

  const handleSkip = () => {
    sfx.clic();
    if (onFinish) onFinish();
  };

  return (
    <section className="pantalla pantalla-panel" id="p-historia">
      <div className="panel vineta">
        <div
          className="vineta-arte"
          id="h-arte"
          aria-hidden="true"
          style={{ backgroundColor: ARTE[quien] || '#3E6FB0' }}
        >
          {arte}
        </div>
        <span className="vineta-quien" id="h-quien">
          {quien}
        </span>
        <p className="vineta-texto" id="h-texto">
          {texto}
        </p>

        <div className="puntos-hist" id="h-puntos" aria-hidden="true">
          {panels.map((_, i) => (
            <span key={i} className={i === index ? 'on' : ''} />
          ))}
        </div>
      </div>

      <div className="fila-botones">
        {!isLast ? (
          <button className="btn-texto" type="button" onClick={handleSkip}>
            Saltar
          </button>
        ) : (
          <div style={{ width: '60px' }} />
        )}
        <WoodButton color="t-teal" chica onClick={handleNext} autoFocus>
          {isLast ? finalButtonText : 'Siguiente'}
        </WoodButton>
      </div>
    </section>
  );
}
