import React, { useState, useEffect, useRef } from 'react';
import WoodButton from '../components/WoodButton';
import {
  obtenerEvento,
  actualizarEvento,
  verificarDisponibilidad,
  obtenerMetricasAdmin,
  formatearFechaLarga,
  eliminarJugadorRanking,
  limpiarTodoRanking
} from '../game/api';
import { exportarRankingPDF } from '../game/exportRankingPdf';
import { exportarRankingExcel } from '../game/exportRankingExcel';
import logoImg from '../assets/logo.webp';
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
  const [copiadoSqlBorrar, setCopiadoSqlBorrar] = useState(false);

  const [cedulaABorrar, setCedulaABorrar] = useState('');
  const [mensajeRanking, setMensajeRanking] = useState('');
  const [borrandoRanking, setBorrandoRanking] = useState(false);

  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [mensajePdf, setMensajePdf] = useState('');

  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [mensajeExcel, setMensajeExcel] = useState('');

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

  const sqlBorrarCode = `-- 1. Borrar todas las partidas y reiniciar el ranking:
TRUNCATE TABLE public.partida RESTART IDENTITY;
TRUNCATE TABLE public.usuario_intentos RESTART IDENTITY;

-- 2. O borrar a un colaborador específico (ejemplo con cédula):
-- DELETE FROM public.partida WHERE cedula = '1085268734';
-- DELETE FROM public.usuario_intentos WHERE cedula = '1085268734';

-- 3. Habilitar DELETE directamente desde la vista ranking:
CREATE OR REPLACE FUNCTION public.eliminar_ranking_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM public.partida WHERE cedula = OLD.cedula;
    DELETE FROM public.usuario_intentos WHERE cedula = OLD.cedula;
    RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS ranking_delete_trg ON public.ranking;
CREATE TRIGGER ranking_delete_trg INSTEAD OF DELETE ON public.ranking
FOR EACH ROW EXECUTE FUNCTION public.eliminar_ranking_trigger();`;

  const handleCopiarSql = () => {
    sfx.clic();
    navigator.clipboard.writeText(sqlCode).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    });
  };

  const handleCopiarSqlBorrar = () => {
    sfx.clic();
    navigator.clipboard.writeText(sqlBorrarCode).then(() => {
      setCopiadoSqlBorrar(true);
      setTimeout(() => setCopiadoSqlBorrar(false), 3000);
    });
  };

  const handleEliminarPorCedula = async (e) => {
    if (e) e.preventDefault();
    sfx.clic();
    const ced = String(cedulaABorrar).replace(/\D/g, '').trim();
    if (!ced) {
      setMensajeRanking('Ingresa una cédula válida.');
      return;
    }
    const ok = window.confirm(`¿Seguro que deseas eliminar al colaborador con cédula ${ced} del ranking?\n\nEsto borrará su puntaje registrado y le permitirá volver a jugar sus 2 intentos.`);
    if (!ok) return;

    setBorrandoRanking(true);
    setMensajeRanking('');
    const res = await eliminarJugadorRanking(ced, session?.token);
    setBorrandoRanking(false);
    setCedulaABorrar('');
    setMensajeRanking(res.msg);

    // Recargar métricas
    obtenerMetricasAdmin(session?.token).then(setMetricas).catch(() => {});
  };

  const handleVaciarTodoRanking = async () => {
    sfx.clic();
    const ok = window.confirm('⚠️ ADVERTENCIA: ¿Estás completamente seguro de BORRAR TODO EL RANKING?\n\nEsta acción borrará todas las partidas registradas y permitirá a todos los participantes jugar nuevamente desde cero.');
    if (!ok) return;

    setBorrandoRanking(true);
    setMensajeRanking('');
    const res = await limpiarTodoRanking(session?.token);
    setBorrandoRanking(false);
    setMensajeRanking(res.msg);

    // Recargar métricas
    obtenerMetricasAdmin(session?.token).then(setMetricas).catch(() => {});
  };

  const handleExportarPDF = async () => {
    sfx.clic();
    setExportandoPdf(true);
    setMensajePdf('');
    try {
      const res = await exportarRankingPDF({ session, eventoData: evento, logoUrl: logoImg });
      if (res?.ok) {
        setMensajePdf(`✅ ¡Reporte oficial descargado exitosamente! Documento de ${res.totalPaginas} páginas con ${res.totalParticipantes} colaboradores registrados en los rankings.`);
      } else {
        setMensajePdf('No se pudo generar el documento PDF.');
      }
    } catch (err) {
      console.error('Error al exportar ranking a PDF:', err);
      setMensajePdf('❌ Error al exportar ranking: ' + (err.message || 'Error inesperado'));
    } finally {
      setExportandoPdf(false);
    }
  };

  const handleExportarExcel = async () => {
    sfx.clic();
    setExportandoExcel(true);
    setMensajeExcel('');
    try {
      const res = await exportarRankingExcel({ session, eventoData: evento });
      if (res?.ok) {
        setMensajeExcel(`✅ ¡Archivo Excel (.xlsx) descargado exitosamente! Tabla con los ${res.totalGanadores} ganadores departamentales (Nombre, Cargo, Puntaje, Departamento).`);
      } else {
        setMensajeExcel('No se pudo generar el archivo Excel.');
      }
    } catch (err) {
      console.error('Error al exportar ranking a Excel:', err);
      setMensajeExcel('❌ Error al exportar ranking a Excel: ' + (err.message || 'Error inesperado'));
    } finally {
      setExportandoExcel(false);
    }
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

            {/* Tarjeta: Exportación Oficial de Ranking en PDF */}
            <div
              className="admin-card exportar-pdf-card"
              style={{
                border: '2px solid rgba(217, 119, 6, 0.45)',
                background: 'linear-gradient(135deg, rgba(34, 27, 71, 0.95), rgba(48, 40, 106, 0.92))'
              }}
            >
              <div className="admin-card-titulo">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.25rem' }}>📄</span>
                  <span>Exportar Reporte Oficial de Ranking (PDF)</span>
                </span>
                <span
                  style={{
                    background: 'rgba(217, 119, 6, 0.25)',
                    border: '1px solid #f59e0b',
                    color: '#fcd34d',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 800
                  }}
                >
                  PDF OFICIAL SST
                </span>
              </div>

              <p className="admin-ayuda-txt" style={{ margin: '4px 0 10px 0', lineHeight: 1.5 }}>
                Genera y descarga un documento PDF corporativo de alta calidad listo para imprimir o presentar a Gerencia y Talento Humano. El informe consolida automáticamente:
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '10px',
                  marginBottom: '14px'
                }}
              >
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px'
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#fcd34d', fontSize: '0.86rem', marginBottom: '3px' }}>
                    🥇 1. Ranking de Todos los Jugadores
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--crema-suave)', lineHeight: 1.35 }}>
                    Listado de todos los participantes con cédula, departamento, dificultad, si venció al drenador y puntaje oficial.
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px'
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#3ddc84', fontSize: '0.86rem', marginBottom: '3px' }}>
                    🏢 2. Ranking de Departamentos
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--crema-suave)', lineHeight: 1.35 }}>
                    Clasificación de áreas ordenada por puntaje promedio, número de participantes y récord departamental.
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px'
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#4fc3f7', fontSize: '0.86rem', marginBottom: '3px' }}>
                    👥 3. Jugadores por Departamentos
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--crema-suave)', lineHeight: 1.35 }}>
                    Desglose detallado área por área con las posiciones internas y el puesto general de cada colaborador.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleExportarPDF}
                  disabled={exportandoPdf || exportandoExcel}
                  style={{
                    background: exportandoPdf
                      ? 'rgba(217, 119, 6, 0.5)'
                      : 'linear-gradient(135deg, #d97706, #b45309)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    cursor: exportandoPdf || exportandoExcel ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <span>{exportandoPdf ? '⏳ Generando PDF…' : '📄 Descargar Reporte en PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportarExcel}
                  disabled={exportandoExcel || exportandoPdf}
                  style={{
                    background: exportandoExcel
                      ? 'rgba(16, 185, 129, 0.5)'
                      : 'linear-gradient(135deg, #059669, #047857)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    cursor: exportandoExcel || exportandoPdf ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <span>{exportandoExcel ? '⏳ Generando Excel…' : '📊 Descargar Ganadores por Depto (Excel)'}</span>
                </button>

                {(exportandoPdf || exportandoExcel) && (
                  <span style={{ fontSize: '0.82rem', color: '#fcd34d' }}>
                    Procesando rankings y calculando ganadores...
                  </span>
                )}
              </div>

              {mensajePdf && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '9px 13px',
                    borderRadius: '8px',
                    background: mensajePdf.startsWith('✅')
                      ? 'rgba(61, 220, 132, 0.15)'
                      : 'rgba(239, 83, 80, 0.15)',
                    border: `1px solid ${mensajePdf.startsWith('✅') ? '#3ddc84' : '#ef5350'}`,
                    color: mensajePdf.startsWith('✅') ? '#b9f6ca' : '#ffcdd2',
                    fontSize: '0.88rem'
                  }}
                >
                  {mensajePdf}
                </div>
              )}

              {mensajeExcel && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '9px 13px',
                    borderRadius: '8px',
                    background: mensajeExcel.startsWith('✅')
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(239, 83, 80, 0.15)',
                    border: `1px solid ${mensajeExcel.startsWith('✅') ? '#10b981' : '#ef5350'}`,
                    color: mensajeExcel.startsWith('✅') ? '#a7f3d0' : '#ffcdd2',
                    fontSize: '0.88rem'
                  }}
                >
                  {mensajeExcel}
                </div>
              )}
            </div>

            {/* Tarjeta 4: Gestión y Limpieza del Ranking */}
            <div className="admin-card" style={{ border: '1px solid rgba(239, 83, 80, 0.5)' }}>
              <div className="admin-card-titulo">
                <span>🗑️ Gestión y Borrado de Ranking</span>
              </div>
              <p className="admin-ayuda-txt">
                Elimina registros de partidas para corregir puntajes o permitir que colaboradores específicos vuelvan a jugar sus intentos:
              </p>

              {/* Borrar por cédula */}
              <form onSubmit={handleEliminarPorCedula} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0' }}>
                <input
                  type="text"
                  placeholder="Cédula a eliminar (ej: 1085268734)"
                  value={cedulaABorrar}
                  onChange={(e) => setCedulaABorrar(e.target.value)}
                  style={{
                    flex: '1',
                    minWidth: '220px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 244, 224, 0.3)',
                    background: '#150f2e',
                    color: '#fff',
                    fontSize: '0.92rem'
                  }}
                  disabled={borrandoRanking}
                />
                <button
                  type="submit"
                  disabled={borrandoRanking || !cedulaABorrar.trim()}
                  style={{
                    background: '#d32f2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {borrandoRanking ? 'Eliminando…' : '🗑️ Eliminar Cédula'}
                </button>
              </form>

              {/* Botón para vaciar todo el ranking */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed rgba(255, 244, 224, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.88rem', color: '#ffcdd2' }}>
                  ¿Deseas reiniciar la competencia completa?
                </span>
                <button
                  type="button"
                  onClick={handleVaciarTodoRanking}
                  disabled={borrandoRanking}
                  style={{
                    background: 'rgba(239, 83, 80, 0.2)',
                    border: '1px solid #ef5350',
                    color: '#ffcdd2',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  ⚠️ Vaciar Todo el Ranking
                </button>
              </div>

              {mensajeRanking && (
                <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(61, 220, 132, 0.15)', border: '1px solid #3ddc84', color: '#b9f6ca', fontSize: '0.88rem' }}>
                  {mensajeRanking}
                </div>
              )}

              {/* Snippet SQL para ejecutar directamente en Supabase si se prefiere */}
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255, 244, 224, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--crema-suave)', fontWeight: 700 }}>
                    💡 O ejecuta esto en el SQL Editor de Supabase:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopiarSqlBorrar}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#fff',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    {copiadoSqlBorrar ? '✅ Copiado' : '📋 Copiar SQL'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '10px', background: '#120d28', borderRadius: '8px', fontSize: '0.78rem', color: '#80cbc4', overflowX: 'auto', maxHeight: '110px' }}>
                  <code>{sqlBorrarCode}</code>
                </pre>
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
                <WoodButton
                  color="t-naranja"
                  chica
                  onClick={handleExportarPDF}
                  disabled={exportandoPdf || exportandoExcel}
                >
                  {exportandoPdf ? '⏳ Generando…' : '📄 Exportar PDF'}
                </WoodButton>
                <WoodButton
                  color="t-verde"
                  chica
                  onClick={handleExportarExcel}
                  disabled={exportandoExcel || exportandoPdf}
                >
                  {exportandoExcel ? '⏳ Generando…' : '📊 Exportar Excel'}
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
