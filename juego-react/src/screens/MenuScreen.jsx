import React from 'react';
import WoodButton from '../components/WoodButton';
import logoImg from '../assets/logo.webp';
import { getSonido, toggleSonido, activarAudio, sfx } from '../game/audio';
import { haJugado } from '../game/storage';

export default function MenuScreen({
  session,
  profile,
  onPlay,
  onProfile,
  onDetails,
  onRanking,
  onLogout,
  soundEnabled,
  onToggleSound
}) {
  const nombreCorto = session?.nombre ? session.nombre.split(' ')[0] : '';
  const cedulaOculta = session?.cedula
    ? session.cedula.length > 4
      ? '•••• ' + session.cedula.slice(-4)
      : session.cedula
    : '';

  const yaJugo = haJugado(profile);

  const saludo = nombreCorto
    ? `Hola, ${nombreCorto}`
    : `Hola, colaborador ${cedulaOculta}`;

  const handleSoundClick = () => {
    activarAudio();
    sfx.clic();
    onToggleSound();
  };

  return (
    <>
      <section className="pantalla" id="p-menu">
        <div className="menu-cabecera-estado">
          <div className="saludo">{saludo}</div>
          <div className={`badge-oportunidad ${yaJugo ? 'usada' : 'libre'}`}>
            {yaJugo ? '🔒 Oportunidad completada (1/1)' : '⚡ 1 oportunidad disponible'}
          </div>
        </div>
        <h1 className="titulo-juego">
          BATERÍA
          <br />
          AL 100
          <span className="rayo" aria-hidden="true">
            ⚡
          </span>
        </h1>
        <div className="tabla subtitulo-tabla" aria-hidden="true">
          La última carga
        </div>

        <nav className="letrero" aria-label="Menú principal">
          <div className="poste" aria-hidden="true" />
          <WoodButton
            color={yaJugo ? 't-gris' : 't-teal'}
            rotation={-1.5}
            onClick={onPlay}
            className={yaJugo ? 'btn-jugado' : ''}
            title={yaJugo ? 'Ya completaste tu única oportunidad' : 'Comenzar aventura'}
          >
            {yaJugo ? '🔒 JUGADO (1/1)' : 'JUGAR'}
          </WoodButton>
          <WoodButton color="t-verde" rotation={1.2} onClick={onProfile}>
            PERFIL
          </WoodButton>
          <WoodButton color="t-naranja" rotation={-1} onClick={onDetails}>
            DETALLES
          </WoodButton>
          <WoodButton color="t-morado" rotation={1.6} onClick={onRanking}>
            RANKING
          </WoodButton>
          <WoodButton color="t-rojo" rotation={-1.2} onClick={onLogout}>
            SALIR
          </WoodButton>
        </nav>
      </section>

      {/* Esquinas con control de sonido y logo */}
      <div className="esquinas" id="esquinas">
        <button
          className={`redondo ${!soundEnabled ? 'apagado' : ''}`}
          type="button"
          id="btn-sonido"
          aria-label={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
          aria-pressed={soundEnabled}
          onClick={handleSoundClick}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>

        <div className="placa-logo">
          <img src={logoImg} alt="Sistemas Palacios" />
        </div>
      </div>
    </>
  );
}
