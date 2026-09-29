import React from 'react';
import WoodButton from '../components/WoodButton';
import logoImg from '../assets/logo.webp';
import { getSonido, toggleSonido, activarAudio, sfx } from '../game/audio';
import { haJugado } from '../game/storage';
import { esAdmin } from '../game/constants';

export default function MenuScreen({
  session,
  profile,
  disponibilidad,
  onPlay,
  onProfile,
  onDetails,
  onRanking,
  onLogout,
  onAdmin,
  onUnavailableModal,
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
  const admin = esAdmin(session?.cedula);
  const juegoHabilitado = disponibilidad ? disponibilidad.disponible : true;

  const saludo = nombreCorto
    ? `Hola, ${nombreCorto}`
    : `Hola, colaborador ${cedulaOculta}`;

  const handleSoundClick = () => {
    activarAudio();
    sfx.clic();
    onToggleSound();
  };

  const handlePlayClick = () => {
    // Si el juego está cerrado, no se debe dejar jugar bajo ninguna circunstancia desde el menú
    if (!juegoHabilitado) {
      sfx.mal();
      if (onUnavailableModal) onUnavailableModal();
      return;
    }
    if (onPlay) onPlay();
  };

  // Texto y estilo del botón de juego
  let textoBotonJugar = 'JUGAR';
  let colorBotonJugar = 't-teal';
  let tituloBotonJugar = 'Comenzar aventura';

  if (yaJugo) {
    textoBotonJugar = '🔒 JUGADO (1/1)';
    colorBotonJugar = 't-gris';
    tituloBotonJugar = 'Ya completaste tu única oportunidad';
  } else if (!juegoHabilitado) {
    colorBotonJugar = 't-gris';
    if (disponibilidad?.motivo === 'antes') {
      textoBotonJugar = '🔒 PRÓXIMAMENTE';
      tituloBotonJugar = `El juego está cerrado. Inicia el ${disponibilidad.inicioCorta}`;
    } else {
      textoBotonJugar = '🔒 EVENTO CERRADO';
      tituloBotonJugar = 'El juego se encuentra actualmente cerrado';
    }
  }

  return (
    <>
      <section className="pantalla" id="p-menu">
        <div className="menu-cabecera-estado">
          <div className="saludo">{saludo}</div>

          <div className="menu-badges-grupo">
            {admin && (
              <button
                type="button"
                className="badge-admin-header"
                onClick={onAdmin}
                title="Configurar disponibilidad del evento"
              >
                👑 Admin • {juegoHabilitado ? '🟢 Abierto' : '🔴 Cerrado'}
              </button>
            )}

            {!juegoHabilitado && (
              <div className={`badge-disponibilidad ${disponibilidad?.motivo || 'cerrado'}`}>
                {disponibilidad?.motivo === 'antes'
                  ? `⏳ Inicia: ${disponibilidad.inicioCorta}`
                  : '🏁 Evento Cerrado'}
              </div>
            )}

            <div className={`badge-oportunidad ${yaJugo ? 'usada' : 'libre'}`}>
              {yaJugo ? '🔒 Oportunidad completada (1/1)' : '⚡ 1 oportunidad disponible'}
            </div>
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

          {/* Botón exclusivo para el administrador con cédula 1193051330 */}
          {admin && (
            <WoodButton
              color="t-ambar"
              rotation={-1.8}
              onClick={onAdmin}
              className="btn-admin-madera"
              title="Panel de Administración y Disponibilidad"
            >
              ⚙️ PANEL ADMIN
            </WoodButton>
          )}

          <WoodButton
            color={colorBotonJugar}
            rotation={admin ? 1.1 : -1.5}
            onClick={handlePlayClick}
            className={yaJugo || !juegoHabilitado ? 'btn-jugado' : ''}
            title={tituloBotonJugar}
          >
            {textoBotonJugar}
          </WoodButton>

          <WoodButton color="t-verde" rotation={admin ? -1.3 : 1.2} onClick={onProfile}>
            PERFIL
          </WoodButton>
          <WoodButton color="t-naranja" rotation={admin ? 1.5 : -1} onClick={onDetails}>
            DETALLES
          </WoodButton>
          <WoodButton color="t-morado" rotation={admin ? -1.1 : 1.6} onClick={onRanking}>
            RANKING
          </WoodButton>
          <WoodButton color="t-rojo" rotation={admin ? 1.2 : -1.2} onClick={onLogout}>
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
