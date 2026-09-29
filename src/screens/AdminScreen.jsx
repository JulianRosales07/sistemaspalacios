import React, { useState, useEffect, useRef } from 'react';
import WoodButton from '../components/WoodButton';
import {
  obtenerEvento,
  actualizarEvento,
  verificarDisponibilidad,
  obtenerMetricasAdmin,
  formatearFechaLarga
} from '../game/api';
import { num } from '../game/canvasUtils';
import { sfx } from '../game/audio';

function dateToInput(dateOrIso) {
  if (!dateOrIso) return '';
  const d = new Date(dateOrIso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputToIso(inputStr) {
  if (!inputStr) return null;
  const d = new Date(inputStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function AdminScreen({
  session,
  onBackToMenu,
  onPlayTest,
  onViewRanking,
  onEventoUpdated
}) {
  const sectionRef = useRef(null);
  const [evento, setEvento] = useState(null);
  const [nombre, setNombre] = useState('Semana SST 2026');
  const [inicioInput, setInicioInput] = useState('');
  const [finInput, setFinInput] = useState('');

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [mensajeError, setMensajeError] = useState('');
  const [alertaRls, setAlertaRls] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [metricas, setMetricas] = useState({
    totalJugadores: 0,
    totalPartidas: 0,
    mejorPuntaje: 0,
    mejorJugador: null
  });

  const [horaActual, setHoraActual] = useState(new Date());

  // Reloj en tiempo real
  useEffect(() => {
    const t = setInterval(() => {
      setHoraActual(new Date());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Cargar datos del evento y métricas al montar
  useEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);

    let activo = true;
    setCargando(true);

    Promise.all([
      obtenerEvento(session?.token),
      obtenerMetricasAdmin(session?.token)
    ])
      .then(([ev, met]) => {
        if (!activo) return;
        setEvento(ev);
        setNombre(ev.nombre || 'Semana SST 2026');
        setInicioInput(dateToInput(ev.inicio));
        setFinInput(dateToInput(ev.fin));
        setMetricas(met);
        setCargando(false);
      })
      .catch((err) => {
        if (!activo) return;
        console.warn('Error al cargar panel admin:', err);
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [session?.token]);

  // Disponibilidad en tiempo real
  const dispActual = evento ? verificarDisponibilidad(evento) : null;

  // Manejo de presets de fechas rápidas
  const aplicarPreset = (tipo) => {
    sfx.clic();
    const ahora = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    if (tipo === 'abrir_ya') {
      // Abre inmediatamente: desde este minuto hasta fin de mes
      const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
      setInicioInput(dateToInput(ahora));
      setFinInput(dateToInput(finMes));
    } else if (tipo === 'cerrar_ya') {
      // Cierra inmediatamente: fin en este instante
      setFinInput(dateToInput(ahora));
    } else if (tipo === 'solo_hoy') {
      const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
      const hoyFin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
      setInicioInput(dateToInput(hoyInicio));
      setFinInput(dateToInput(hoyFin));
    } else if (tipo === 'esta_semana') {
      const diaSemana = ahora.getDay() || 7; // 1 = Lunes, 7 = Domingo
      const lunes = new Date(ahora);
      lunes.setDate(ahora.getDate() - diaSemana + 1);
      lunes.setHours(0, 0, 0, 0);

      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      domingo.setHours(23, 59, 59, 999);

      setInicioInput(dateToInput(lunes));
      setFinInput(dateToInput(domingo));
    } else if (tipo === 'todo_el_mes') {
      const primero = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0);
      const ultimo = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
      setInicioInput(dateToInput(primero));
      setFinInput(dateToInput(ultimo));
    }
  };

  // Guardar configuración
  const handleGuardar = async (e) => {
    if (e) e.preventDefault();
    sfx.clic();

    const isoInicio = inputToIso(inicioInput);
    const isoFin = inputToIso(finInput);

    if (!isoInicio || !isoFin) {
      setMensajeError('Debes seleccionar tanto la fecha de inicio como la de cierre.');
      return;
    }

    if (new Date(isoFin) <= new Date(isoInicio)) {
      setMensajeError('La fecha de cierre debe ser posterior a la fecha de inicio.');
      return;
    }

    setGuardando(true);
    setMensajeError('');
    setMensajeExito('');
    setAlertaRls(false);

    try {
      const cambios = {
        inicio: isoInicio,
        fin: isoFin,
        nombre: nombre.trim() || 'Semana SST 2026'
      };

      const res = await actualizarEvento(cambios, session?.token);

      if (res.ok) {
        const nuevoEv = { ...(evento || {}), ...cambios };
        setEvento(nuevoEv);
        if (onEventoUpdated) onEventoUpdated(nuevoEv);

        if (res.rlsBloqueado) {
          setAlertaRls(true);
          setMensajeExito('Configuración guardada en este equipo. Ejecuta el script SQL para aplicarla en Supabase.');
        } else {
          setMensajeExito('✅ ¡Disponibilidad actualizada exitosamente en Supabase!');
        }
      } else {
        setMensajeError(res.msg || 'No se pudo guardar la configuración.');
      }
    } catch (err) {
      setMensajeError('Error al guardar cambios: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const sqlCode = `-- 1. Permitir que el panel admin actualice la tabla evento:
GRANT UPDATE ON public.evento TO anon, authenticated;

-- 2. Habilitar la política RLS para permitir la actualización:
DROP POLICY IF EXISTS "Permitir actualizar evento" ON public.evento;
CREATE POLICY "Permitir actualizar evento" ON public.evento 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);`;

  const handleCopiarSql = () => {
    sfx.clic();
    navigator.clipboard.writeText(sqlCode).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    });
  };

  return (
    <section className="pantalla pantalla-panel" id="p-admin" ref={sectionRef}>
      <div className="panel admin-panel-container">
        <div className="tabla panel-cab t-morado">
          ⚙️ Panel de Control Admin
        </div>

        {/* Identificación del Admin */}
        <div className="admin-usuario-header">
          <div className="admin-avatar-ico">👑</div>
          <div className="admin-usuario-info">
            <div className="admin-nombre">
              {session?.nombre || 'Julian David Rosales Portilla'}
            </div>
            <div className="admin-detalles">
              <span>Cédula: <b>1193051330</b></span>
              <span>•</span>
              <span className="badge-rol-admin">SUPER ADMIN SST</span>
              {session?.area && (
                <>
                  <span>•</span>
                  <span>{session.area}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Reloj oficial Colombia */}
        <div className="admin-reloj-bar">
          <span>🕒 Hora actual (Colombia):</span>
          <b>{horaActual.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</b>
          <span className="reloj-fecha">• {horaActual.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>

        {cargando ? (
          <p className="admin-cargando">Cargando configuración del evento desde Supabase…</p>
        ) : (
          <>
            {/* Tarjeta 1: Estado en vivo de la disponibilidad */}
            <div className="admin-card estado-vivo-card">
              <div className="admin-card-titulo">
                <span>📡 Estado Actual del Juego</span>
                <span className={`admin-badge-estado ${dispActual?.motivo || 'activo'}`}>
                  {dispActual?.motivo === 'activo' && '🟢 HABILITADO (EN CURSO)'}
                  {dispActual?.motivo === 'antes' && '🟡 PROGRAMADO (CERRADO)'}
                  {dispActual?.motivo === 'despues' && '🔴 FINALIZADO (CERRADO)'}
                </span>
              </div>

              <div className="admin-estado-cuerpo">
                {dispActual?.motivo === 'activo' && (
                  <p className="estado-desc texto-verde">
                    El juego está <b>abierto para todos los colaboradores</b> de Sistemas Palacios.
                    {dispActual.tiempoRestante && (
                      <span className="tiempo-destacado">
                        {' '}Cierra en: <b>{dispActual.tiempoRestante}</b>.
                      </span>
                    )}
                  </p>
                )}
                {dispActual?.motivo === 'antes' && (
                  <p className="estado-desc texto-ambar">
                    El juego está <b>bloqueado temporalmente</b> para los colaboradores.
                    {dispActual.tiempoParaInicio && (
                      <span className="tiempo-destacado">
                        {' '}Abre automáticamente en: <b>{dispActual.tiempoParaInicio}</b>.
                      </span>
                    )}
                  </p>
                )}
                {dispActual?.motivo === 'despues' && (
                  <p className="estado-desc texto-rojo">
                    El juego ha <b>cerrado sus partidas oficiales</b>. Los colaboradores solo pueden ver el ranking y su perfil.
                  </p>
                )}

                <div className="admin-fechas-resumen">
                  <div className="fecha-item">
                    <span className="f-label">Apertura:</span>
                    <span className="f-val">{dispActual?.inicioFormateado || 'Sin definir'}</span>
                  </div>
                  <div className="fecha-item">
                    <span className="f-label">Cierre:</span>
                    <span className="f-val">{dispActual?.finFormateado || 'Sin definir'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjeta 2: Formulario de configuración de fechas */}
            <form className="admin-card form-config-card" onSubmit={handleGuardar}>
              <div className="admin-card-titulo">
                <span>🗓️ Configurar Cuándo se Habilita y Deshabilita</span>
              </div>

              <p className="admin-ayuda-txt">
                Define el rango de fechas y horas en que el juego estará disponible para que los colaboradores jueguen:
              </p>

              {/* Botones de presets rápidos */}
              <div className="admin-presets-container">
                <span className="presets-label">⚡ Acciones rápidas:</span>
                <div className="presets-botones">
                  <button
                    type="button"
                    className="btn-preset btn-preset-verde"
                    onClick={() => aplicarPreset('abrir_ya')}
                    title="Abre el juego inmediatamente"
                  >
                    🟢 Habilitar Ahora Mismo
                  </button>
                  <button
                    type="button"
                    className="btn-preset btn-preset-rojo"
                    onClick={() => aplicarPreset('cerrar_ya')}
                    title="Cierra el juego inmediatamente"
                  >
                    🔴 Deshabilitar Inmediatamente
                  </button>
                  <button
                    type="button"
                    className="btn-preset"
                    onClick={() => aplicarPreset('solo_hoy')}
                  >
                    📅 Solo Hoy
                  </button>
                  <button
                    type="button"
                    className="btn-preset"
                    onClick={() => aplicarPreset('esta_semana')}
                  >
                    📆 Esta Semana
                  </button>
                  <button
                    type="button"
                    className="btn-preset"
                    onClick={() => aplicarPreset('todo_el_mes')}
                  >
                    🗓️ Todo este Mes
                  </button>
                </div>
              </div>

              <div className="admin-campos-grid">
                <div className="admin-campo">
                  <label htmlFor="nombre-evento">🏷️ Nombre del Evento</label>
                  <input
                    id="nombre-evento"
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Semana SST 2026"
                    className="admin-input-txt"
                    disabled={guardando}
                  />
                </div>

                <div className="admin-campo">
                  <label htmlFor="fecha-inicio">🚀 Fecha y Hora de Apertura (Se Habilita)</label>
                  <input
                    id="fecha-inicio"
                    type="datetime-local"
                    value={inicioInput}
                    onChange={(e) => setInicioInput(e.target.value)}
                    className="admin-input-fecha"
                    disabled={guardando}
                    required
                  />
                  <small className="campo-ayuda">Momento exacto en que los jugadores pueden empezar a jugar.</small>
                </div>

                <div className="admin-campo">
                  <label htmlFor="fecha-fin">🛑 Fecha y Hora de Cierre (Se Deshabilita)</label>
                  <input
                    id="fecha-fin"
                    type="datetime-local"
                    value={finInput}
                    onChange={(e) => setFinInput(e.target.value)}
                    className="admin-input-fecha"
                    disabled={guardando}
                    required
                  />
                  <small className="campo-ayuda">Momento exacto en que se bloquea el acceso a nuevas partidas.</small>
                </div>
              </div>

              {mensajeError && (
                <div className="admin-mensaje error">
                  ⚠️ {mensajeError}
                </div>
              )}

              {mensajeExito && (
                <div className="admin-mensaje exito">
                  {mensajeExito}
                </div>
              )}

              <div className="admin-form-acciones">
                <button
                  type="submit"
                  className="btn-guardar-admin"
                  disabled={guardando}
                >
                  {guardando ? 'Guardando en Supabase…' : '💾 Guardar Disponibilidad'}
                </button>
              </div>
            </form>

            {/* Alerta o tarjeta de configuración SQL para Supabase */}
            <div className={`admin-card sql-card ${alertaRls ? 'resaltada' : ''}`}>
              <div className="admin-card-titulo">
                <span>🔧 Permisos en Supabase (SQL)</span>
                <button
                  type="button"
                  className="btn-copiar-sql"
                  onClick={handleCopiarSql}
                >
                  {copiado ? '✅ ¡Copiado!' : '📋 Copiar SQL'}
                </button>
              </div>
              <p className="sql-desc">
                Si aún no has habilitado la modificación de la tabla <code>evento</code> en tu proyecto de Supabase, ejecuta este script en el <b>SQL Editor</b> (solo se hace una vez):
              </p>
              <pre className="admin-codigo-sql">
                <code>{sqlCode}</code>
              </pre>
            </div>

            {/* Tarjeta 3: Métricas en vivo del juego */}
            <div className="admin-card metricas-card">
              <div className="admin-card-titulo">
                <span>📊 Estadísticas en Vivo de la Plataforma</span>
              </div>
              <div className="metricas-grid">
                <div className="metrica-item">
                  <span className="met-num">{num(metricas.totalJugadores)}</span>
                  <span className="met-label">👥 Colaboradores registrados</span>
                </div>
                <div className="metrica-item">
                  <span className="met-num">{num(metricas.totalPartidas)}</span>
                  <span className="met-label">🎮 Partidas jugadas</span>
                </div>
                <div className="metrica-item">
                  <span className="met-num">{num(metricas.mejorPuntaje)}</span>
                  <span className="met-label">
                    🏆 Récord ({metricas.mejorJugador?.nombre ? metricas.mejorJugador.nombre.split(' ')[0] : 'Sin partidas'})
                  </span>
                </div>
              </div>
            </div>

            {/* Tarjeta 4: Acciones adicionales para el administrador */}
            <div className="admin-card acciones-rapidas-card">
              <div className="admin-card-titulo">
                <span>🎮 Modo Pruebas de Administrador</span>
              </div>
              <p className="admin-ayuda-txt">
                Como administrador con cédula <b>1193051330</b>, puedes ingresar a jugar y probar la aventura en cualquier momento:
              </p>
              <div className="acciones-pruebas-btns">
                <WoodButton
                  color="t-teal"
                  chica
                  onClick={() => {
                    sfx.clic();
                    if (onPlayTest) onPlayTest();
                  }}
                >
                  🎮 Probar Juego Ahora
                </WoodButton>
                <WoodButton
                  color="t-morado"
                  chica
                  onClick={() => {
                    sfx.clic();
                    if (onViewRanking) onViewRanking();
                  }}
                >
                  🏆 Ver Ranking Oficial
                </WoodButton>
              </div>
            </div>
          </>
        )}

        <div className="fila-botones" style={{ marginTop: '16px' }}>
          <WoodButton color="t-rojo" chica onClick={onBackToMenu}>
            Volver al Menú
          </WoodButton>
        </div>
      </div>
    </section>
  );
}
