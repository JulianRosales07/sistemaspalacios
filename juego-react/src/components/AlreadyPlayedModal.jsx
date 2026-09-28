import React from 'react';
import WoodButton from './WoodButton';
import { num } from '../game/canvasUtils';
import { DIFS } from '../game/constants';
import { sfx } from '../game/audio';

export default function AlreadyPlayedModal({ session, profile, onClose, onGoRanking, onGoProfile }) {
  const nombre = session?.nombre ? session.nombre.split(' ')[0] : 'Colaborador';
  const puntos = profile?.mejor || 0;
  const dif = DIFS[profile?.difPref || 'media'] || DIFS.media;

  const handleRanking = () => {
    sfx.clic();
    onClose();
    if (onGoRanking) onGoRanking();
  };

  const handleProfile = () => {
    sfx.clic();
    onClose();
    if (onGoProfile) onGoProfile();
  };

  const handleClose = () => {
    sfx.clic();
    onClose();
  };

  return (
    <div className="capa" id="capa-ya-jugo" role="dialog" aria-modal="true" aria-labelledby="ya-jugo-titulo">
      <div className="panel modal-ya-jugo">
        <div className="tabla panel-cab t-morado" id="ya-jugo-titulo">
          ⚡ Oportunidad completada
        </div>

        <div style={{ fontSize: '48px', margin: '8px 0 2px 0' }} aria-hidden="true">
          🏆
        </div>

        <h2 style={{ margin: '4px 0 8px 0', fontSize: '1.4rem' }}>
          ¡Hola, {nombre}!
        </h2>

        <p style={{ margin: '0 0 14px 0', fontSize: '0.96rem', lineHeight: '1.4' }}>
          Para asegurar la equidad y transparencia de la <b>Semana SST</b>, cada colaborador cuenta con <b>una sola oportunidad</b> para jugar y registrar su récord.
        </p>

        <div
          style={{
            background: 'rgba(26, 20, 51, 0.65)',
            border: '2px solid rgba(255, 244, 224, 0.25)',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '16px',
            textAlign: 'center'
          }}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--crema-suave)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Tu puntaje registrado
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--ambar)', lineHeight: '1.1', margin: '4px 0' }}>
            {num(puntos)}
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--crema-suave)' }}>
            Nivel: {dif.nombre} • {profile?.drenador ? '⚡ Venció al Drenador' : 'Aventura terminada'}
          </span>
        </div>

        <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: 'var(--crema-suave)' }}>
          ¡Revisa tu posición actual en la tabla general de líderes o tus logros en el perfil!
        </p>

        <div className="acciones" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <WoodButton color="t-morado" chica onClick={handleRanking}>
            Ver Ranking General
          </WoodButton>
          <WoodButton color="t-verde" chica onClick={handleProfile}>
            Ver mi Perfil
          </WoodButton>
          <button
            type="button"
            className="btn-texto"
            onClick={handleClose}
            style={{ marginTop: '4px', alignSelf: 'center' }}
          >
            Volver al Menú
          </button>
        </div>
      </div>
    </div>
  );
}
