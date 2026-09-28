import React from 'react';
import WoodButton from '../components/WoodButton';
import { CAPS_META } from '../game/constants';
import { activarAudio } from '../game/audio';

export default function IntroScreen({ chapterIndex, profile, onStartChapter }) {
  const c = CAPS_META[chapterIndex] || CAPS_META[0];
  const visto = !!(profile?.tutos && profile.tutos[chapterIndex]);

  const handleStart = (conTutorial) => {
    activarAudio();
    onStartChapter(chapterIndex, conTutorial);
  };

  return (
    <section className="pantalla pantalla-panel" id="p-intro">
      <div className="panel">
        <div className={`tabla panel-cab ${c.tabla}`}>
          {chapterIndex < 3 ? `Capítulo ${chapterIndex + 1}` : 'Final'}
        </div>
        <h2>{c.nombre}</h2>
        <ul className="pasos">
          {c.pasos.map(([emoji, text], i) => (
            <li key={i}>
              <span aria-hidden="true">{emoji}</span>
              {text}
            </li>
          ))}
        </ul>

        <WoodButton color="t-verde" chica onClick={() => handleStart(!visto)}>
          {visto ? 'Comenzar' : 'Hacer el tutorial'}
        </WoodButton>

        <button
          className="btn-texto intro-alt"
          type="button"
          onClick={() => handleStart(visto)}
        >
          {visto ? 'Repasar el tutorial' : 'Saltar tutorial'}
        </button>
      </div>
    </section>
  );
}
