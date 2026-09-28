import React, { useEffect, useState, useRef } from 'react';
import WoodButton from '../components/WoodButton';
import { INSIGNIAS, DIFS } from '../game/constants';
import { num } from '../game/canvasUtils';
import { getInsigniasGanadas, haJugado, guardarPerfil } from '../game/storage';
import { cargarPerfilServidor, sincronizarPerfilServidor } from '../game/api';
import { generarAvatarDataUrl, avatarPorDefecto } from '../game/pixelAvatar';

export default function ProfileScreen({ session, profile, onBackToMenu, onProfileLoaded, onEditAvatar }) {
  const [sincronizando, setSincronizando] = useState(false);
  const [estadoBd, setEstadoBd] = useState('');
  const sectionRef = useRef(null);

  useEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!session?.cedula) return;
    let activo = true;
    setSincronizando(true);
    setEstadoBd('Sincronizando con la base de datos…');

    cargarPerfilServidor(session.cedula, session.token)
      .then(servidorPerfil => {
        if (!activo) return;
        setSincronizando(false);
        if (servidorPerfil) {
          setEstadoBd('Datos conectados con la base de datos');
          if (onProfileLoaded) onProfileLoaded(servidorPerfil);
        } else {
          setEstadoBd('');
        }
      })
      .catch(() => {
        if (!activo) return;
        setSincronizando(false);
        setEstadoBd('');
      });

    return () => {
      activo = false;
    };
  }, [session?.cedula, session?.token, onProfileLoaded]);

  const nombre = session?.nombre || 'Colaborador';
  const iniciales = session?.nombre
    ? session.nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('')
    : 'SP';

  const cedulaOculta = session?.cedula
    ? session.cedula.length > 4
      ? '•••• ' + session.cedula.slice(-4)
      : session.cedula
    : '';

  const run = profile?.run;
  const k = profile?.cont || {};
  const dAct = DIFS[(run && run.dif) || profile?.difPref || 'media'];
  const jugado = haJugado(profile);

  const avance = run
    ? run.cap < 3
      ? `Capítulo ${run.cap + 1}`
      : 'Batalla final'
    : jugado
    ? 'Aventura completada'
    : 'Sin iniciar';

  const datos = [
    ...(session?.area ? [['Área', session.area]] : []),
    ['Oportunidad de juego', jugado ? 'Completada (1 de 1)' : 'Disponible (1 intento)'],
    ['Dificultad elegida', dAct.nombre],
    ['Puntaje registrado', num(profile?.mejor || 0)],
    ['Avance actual', avance],
    ['Drenador vencido', profile?.drenador ? 'Sí' : 'Todavía no'],
    ['Veces que dijiste NO', k.no || 0],
    ['Conflictos frenados', k.interv || 0],
    ['Mensajes cortados', k.cortes || 0],
    ['Trampas descubiertas', k.trampas || 0],
    ['Pausas activas', k.pausas || 0]
  ];

  const insigniasDesbloqueadas = getInsigniasGanadas(profile);

  return (
    <section className="pantalla pantalla-panel" id="p-perfil" ref={sectionRef}>
      <div className="panel">
        <div className="tabla panel-cab t-verde">Perfil</div>

        <div className="perfil-cab" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <img
            src={generarAvatarDataUrl(profile?.avatar || avatarPorDefecto(), 80)}
            alt="Avatar"
            className="avatar-badge-preview"
            style={{ width: '64px', height: '64px' }}
          />
          <div style={{ flex: 1 }}>
            <b>{nombre}</b>
            <small>Cédula {cedulaOculta}</small>
          </div>
          <WoodButton
            color="t-teal"
            chica
            onClick={onEditAvatar}
            title="Personaliza tu peinado, tono de piel y accesorios en pantalla dedicada"
          >
            EDITAR AVATAR
          </WoodButton>
        </div>

        {estadoBd && (
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--crema-suave)', margin: '4px 0 12px 0' }}>
            {sincronizando ? '⏳ ' : '🟢 '} {estadoBd}
          </p>
        )}

        <div className="tabla-datos">
          {datos.map(([label, val], idx) => (
            <div key={idx} className="fila">
              <span>{label}</span>
              <b>{val}</b>
            </div>
          ))}
        </div>

        <h3>Insignias</h3>
        <div className="insignias">
          {INSIGNIAS.map(([key, icono, titulo, desc]) => {
            const desbloqueada = insigniasDesbloqueadas.has(key);
            return (
              <div key={key} className={`insignia ${desbloqueada ? '' : 'bloq'}`}>
                <span aria-hidden="true">{icono}</span>
                <b>{titulo}</b>
                <small>{desc}</small>
              </div>
            );
          })}
        </div>
      </div>

      <div className="acciones">
        <WoodButton color="t-rojo" chica onClick={onBackToMenu}>
          Volver
        </WoodButton>
      </div>
    </section>
  );
}
