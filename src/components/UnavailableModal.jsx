import React from 'react';
import WoodButton from './WoodButton';
import { sfx } from '../game/audio';

export default function UnavailableModal({
  disponibilidad,
  session,
  esAdmin = false,
  onAdmin,
  onClose,
  onGoRanking,
  onGoProfile
}) {
  const nombre = session?.nombre ? session.nombre.split(' ')[0] : 'Colaborador';
  const esAntes = disponibilidad?.motivo === 'antes';

  const handleAdmin = () => {
    sfx.clic();
    onClose();
    if (onAdmin) onAdmin();
  };

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
    <div
      className="capa"
      id="capa-disponibilidad"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disp-titulo"
    >
      <div className="panel modal-disponibilidad">
        <div className={`tabla panel-cab ${esAntes ? 't-naranja' : 't-morado'}`} id="disp-titulo">
          {esAntes ? '⏳ Juego no disponible aún' : '🏁 Evento finalizado'}
        </div>

        <div style={{ fontSize: '46px', margin: '8px 0 2px 0' }} aria-hidden="true">
          {esAntes ? '⏰' : '🏅'}
        </div>

        <h2 style={{ margin: '4px 0 8px 0', fontSize: '1.35rem' }}>
          ¡Hola, {nombre}!
        </h2>

        <p style={{ margin: '0 0 14px 0', fontSize: '0.95rem', lineHeight: '1.4' }}>
          {esAntes ? (
            <>
              La aventura interactiva de la <b>Semana SST</b> aún no se encuentra habilitada para partidas oficiales.
            </>
          ) : (
            <>
              El periodo de juego para la <b>Semana SST</b> ha finalizado. ¡Muchas gracias a todos los que participaron!
            </>
          )}
        </p>

        <div
          style={{
            background: 'rgba(26, 20, 51, 0.7)',
            border: '2px solid rgba(255, 244, 224, 0.25)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            textAlign: 'left'
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--crema-suave)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Fechas de disponibilidad oficial:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: 'var(--verde)', fontWeight: 'bold' }}>🚀 Habilitación:</span>{' '}
              <span>{disponibilidad?.inicioFormateado || 'Por definir'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--rojo)', fontWeight: 'bold' }}>🛑 Cierre:</span>{' '}
              <span>{disponibilidad?.finFormateado || 'Por definir'}</span>
            </div>
          </div>

          {esAntes && disponibilidad?.tiempoParaInicio && (
            <div
              style={{
                marginTop: '10px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                fontSize: '0.88rem',
                color: 'var(--ambar)',
                fontWeight: 'bold',
                textAlign: 'center'
              }}
            >
              ⚡ Tiempo para apertura: {disponibilidad.tiempoParaInicio}
            </div>
          )}
        </div>

        <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: 'var(--crema-suave)' }}>
          {esAntes
            ? 'Mientras se habilita el juego, puedes personalizar tu avatar o consultar los detalles de la competencia.'
            : 'Puedes consultar el podio y las estadísticas por área en el ranking oficial.'}
        </p>

        <div className="acciones" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {esAdmin && (
            <WoodButton color="t-ambar" chica onClick={handleAdmin}>
              ⚙️ Abrir Panel Admin para Habilitar
            </WoodButton>
          )}
          <WoodButton color="t-morado" chica onClick={handleRanking}>
            Ver Ranking General
          </WoodButton>
          <WoodButton color="t-verde" chica onClick={handleProfile}>
            Ver mi Perfil y Avatar
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
