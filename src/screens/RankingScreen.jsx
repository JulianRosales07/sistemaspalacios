import React, { useState, useEffect, useCallback, useMemo } from 'react';
import WoodButton from '../components/WoodButton';
import { DIFS, DEPARTAMENTOS_OFICIALES, esAdmin } from '../game/constants';
import { num } from '../game/canvasUtils';
import {
  obtenerRankingJugadores,
  obtenerRankingAreas,
  obtenerDepartamentosAPI,
  eliminarJugadorRanking,
  limpiarTodoRanking
} from '../game/api';
import { exportarRankingPDF } from '../game/exportRankingPdf';
import logoImg from '../assets/logo.webp';
import { sfx } from '../game/audio';

export default function RankingScreen({ session, onBackToMenu }) {
  const [tab, setTab] = useState('jugadores');
  const [deptoFiltro, setDeptoFiltro] = useState('TODOS');
  const [cargando, setCargando] = useState(true);
  const [jugadores, setJugadores] = useState([]);
  const [areas, setAreas] = useState([]);
  // Inicializar inmediatamente con la lista oficial completa de departamentos
  const [deptosAPI, setDeptosAPI] = useState(DEPARTAMENTOS_OFICIALES);
  const [estadoTxt, setEstadoTxt] = useState('');
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [mensajePdf, setMensajePdf] = useState('');
  const admin = esAdmin(session?.cedula);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setEstadoTxt('Cargando ranking…');

    try {
      // Cargar ranking de Supabase de inmediato
      const [respJugadores, respAreas] = await Promise.all([
        obtenerRankingJugadores(session?.token),
        obtenerRankingAreas(session?.token)
      ]);

      setJugadores(respJugadores.lista || []);
      setAreas(respAreas.lista || []);

      const hora = new Date().toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit'
      });

      if (respJugadores.origen === 'api') {
        setEstadoTxt(`Ranking oficial, actualizado a las ${hora}`);
      } else if (respJugadores.origen === 'error') {
        setEstadoTxt(
          'No se pudo conectar con el ranking general. Mostrando puntajes guardados en este equipo.'
        );
      } else {
        setEstadoTxt('Puntajes guardados en este equipo.');
      }

      // Sincronizar departamentos de la API en segundo plano sin demorar la pantalla
      obtenerDepartamentosAPI()
        .then((listaDeptos) => {
          if (listaDeptos && listaDeptos.length > 0) {
            setDeptosAPI(listaDeptos);
          }
        })
        .catch(() => {});
    } catch (e) {
      setEstadoTxt('Error al cargar datos del ranking.');
    } finally {
      setCargando(false);
    }
  }, [session]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleTabChange = (t) => {
    if (tab === t) return;
    sfx.clic();
    setTab(t);
  };

  const puntosDe = (x) => +(x.puntaje ?? x.puntajeTotal ?? x.puntos ?? 0);
  const nombreDif = (d) => (!d ? '' : DIFS[d] ? DIFS[d].nombre : d);
  const areaDe = (x) => String(x.area || '').trim() || 'Sin área';

  const esYo = (x) =>
    session &&
    ((x.cedula && String(x.cedula) === session.cedula) ||
      (!x.cedula && session.nombre && x.nombre === session.nombre));

  const miArea = session?.area ? session.area.trim().toLowerCase() : '';

  // Lista unificada de todos los departamentos (API + BD + Jugadores)
  const listaDeptos = useMemo(() => {
    const setD = new Set();
    deptosAPI.forEach((d) => {
      const a = String(d || '').trim();
      if (a && a.toLowerCase() !== 'sin área') setD.add(a);
    });
    areas.forEach((ar) => {
      const a = String(ar.area || '').trim();
      if (a && a.toLowerCase() !== 'sin área') setD.add(a);
    });
    jugadores.forEach((j) => {
      const a = String(j.area || '').trim();
      if (a && a.toLowerCase() !== 'sin área') setD.add(a);
    });
    if (session?.area) {
      const a = String(session.area).trim();
      if (a && a.toLowerCase() !== 'sin área') setD.add(a);
    }
    return Array.from(setD).sort((a, b) => a.localeCompare(b, 'es'));
  }, [deptosAPI, jugadores, areas, session]);

  // Jugadores filtrados por el departamento seleccionado
  const jugadoresFiltrados = useMemo(() => {
    if (!deptoFiltro || deptoFiltro === 'TODOS') {
      return jugadores;
    }
    return jugadores.filter((j) => {
      const a = String(j.area || '').trim().toLowerCase();
      return a === deptoFiltro.toLowerCase();
    });
  }, [jugadores, deptoFiltro]);

  // Al hacer clic en un departamento desde la pestaña de áreas
  const handleFiltrarPorArea = (nombreArea) => {
    sfx.clic();
    setDeptoFiltro(nombreArea);
    setTab('jugadores');
  };

  const handleEliminarJugador = async (jugador) => {
    sfx.clic();
    const nombre = jugador.nombre || 'este colaborador';
    const ced = jugador.cedula;
    if (!ced) return;
    const ok = window.confirm(`¿Deseas eliminar a ${nombre} (Cédula: ${ced}) del ranking?\n\nAl borrarlo, su puntaje saldrá de la tabla y podrá volver a jugar sus 2 intentos.`);
    if (ok) {
      setCargando(true);
      await eliminarJugadorRanking(ced, session?.token);
      await cargarDatos();
    }
  };

  const handleLimpiarTodo = async () => {
    sfx.clic();
    const ok = window.confirm('⚠️ ¿Estás seguro de que deseas BORRAR TODO EL RANKING?\n\nEsta acción eliminará todas las partidas y puntajes de todos los colaboradores, permitiendo reiniciar el torneo.');
    if (ok) {
      setCargando(true);
      await limpiarTodoRanking(session?.token);
      await cargarDatos();
    }
  };

  const handleExportarPDF = async () => {
    sfx.clic();
    setExportandoPdf(true);
    setMensajePdf('');
    try {
      const res = await exportarRankingPDF({
        session,
        jugadoresData: jugadores,
        areasData: areas,
        deptosData: listaDeptos,
        logoUrl: logoImg
      });
      if (res?.ok) {
        setMensajePdf(`✅ ¡Reporte PDF descargado! (${res.totalPaginas} págs, ${res.totalParticipantes} jugadores)`);
        setTimeout(() => setMensajePdf(''), 6000);
      }
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      alert('Error al generar el PDF: ' + (err.message || 'Error inesperado'));
    } finally {
      setExportandoPdf(false);
    }
  };

  // Render podio para jugadores
  const renderPodio = (lista) => {
    if (!lista || lista.length === 0) return null;
    const medallas = ['🥇', '🥈', '🥉'];
    // Orden visual: 2º (izq), 1º (centro), 3º (der)
    const orden = [lista[1], lista[0], lista[2]];

    return (
      <div className="podio" aria-label="Podio">
        {orden.map((x, visualIdx) => {
          const posIdx = visualIdx === 0 ? 1 : visualIdx === 1 ? 0 : 2;
          const posNum = posIdx + 1;
          if (!x) {
            return (
              <div key={visualIdx} className={`puesto p${posNum} vacio`}>
                <div className="medalla" aria-hidden="true">
                  {medallas[posIdx]}
                </div>
                <b>Libre</b>
                <small></small>
                <div className="puesto-base"></div>
              </div>
            );
          }
          return (
            <div key={visualIdx} className={`puesto p${posNum}`} style={{ position: 'relative' }}>
              <div className="medalla" aria-hidden="true">
                {medallas[posIdx]}
              </div>
              <b>
                {x.nombre || 'Colaborador'}
                {esYo(x) ? ' (tú)' : ''}
              </b>
              {deptoFiltro !== 'TODOS' && posNum === 1 && (
                <div style={{ marginTop: '2px' }}>
                  <span style={{
                    background: 'rgba(217, 119, 6, 0.35)',
                    border: '1px solid #f59e0b',
                    color: '#fcd34d',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    display: 'inline-block'
                  }}>
                    👑 ¡Ganador(a) del Área!
                  </span>
                </div>
              )}
              <small>{x.area ? areaDe(x) : nombreDif(x.dificultad)}</small>
              <div className="puesto-base">{num(puntosDe(x))}</div>
              {admin && x.cedula && (
                <button
                  type="button"
                  onClick={() => handleEliminarJugador(x)}
                  title={`Eliminar a ${x.nombre || x.cedula} del ranking`}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: 'rgba(239, 83, 80, 0.85)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  🗑️
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderRestoJugadores = (lista) => {
    if (!lista || lista.length <= 3) return null;
    const resto = lista.slice(3, 50);

    return (
      <ol className="ranking">
        {resto.map((x, i) => (
          <li key={i} className={esYo(x) ? 'yo' : ''}>
            <span className="pos">{i + 4}</span>
            <span className="quien">
              <b>{x.nombre || 'Colaborador'}</b>
              <small>
                {x.area ? areaDe(x) : ''}
                {x.dificultad && (
                  <span
                    className="etq-dif"
                    style={x.area ? undefined : { marginLeft: 0 }}
                  >
                    {nombreDif(x.dificultad)}
                  </span>
                )}
                {deptoFiltro !== 'TODOS' && x.posicion && (
                  <span style={{ opacity: 0.65, marginLeft: '6px' }}>
                    (Puesto general #{x.posicion})
                  </span>
                )}
              </small>
            </span>
            <b className="pts">{num(puntosDe(x))}</b>
            {admin && x.cedula && (
              <button
                type="button"
                onClick={() => handleEliminarJugador(x)}
                title={`Eliminar a ${x.nombre || x.cedula} del ranking`}
                style={{
                  background: 'rgba(239, 83, 80, 0.25)',
                  border: '1px solid rgba(239, 83, 80, 0.6)',
                  color: '#ffcdd2',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  marginLeft: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                🗑️
              </button>
            )}
          </li>
        ))}
      </ol>
    );
  };

  const renderAreas = () => {
    if (!areas || areas.length === 0) {
      return (
        <>
          <p className="rk-nota">
            Departamentos de Sistemas Palacios. Toca cualquier departamento para ver sus jugadores:
          </p>
          <ol className="ranking">
            {listaDeptos.map((d, i) => {
              const cant = jugadores.filter(
                (j) => String(j.area || '').trim().toLowerCase() === d.toLowerCase()
              ).length;
              const esMiDepto = miArea && d.toLowerCase() === miArea;

              return (
                <li
                  key={d}
                  className={esMiDepto ? 'yo fila-area-interactiva' : 'fila-area-interactiva'}
                  onClick={() => handleFiltrarPorArea(d)}
                  style={{ cursor: 'pointer' }}
                  title={`Ver jugadores de ${d}`}
                >
                  <span className="pos">🏢</span>
                  <span className="quien">
                    <b>{d}</b>
                    <small>
                      {cant} {cant === 1 ? 'colaborador con partida' : 'colaboradores con partida'}
                    </small>
                    <button
                      type="button"
                      className="btn-ver-depto-jugadores"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFiltrarPorArea(d);
                      }}
                    >
                      👥 Ver jugadores ({cant})
                    </button>
                  </span>
                  <b className="pts">
                    -
                    <small>pendiente</small>
                  </b>
                </li>
              );
            })}
          </ol>
        </>
      );
    }

    const max = Math.max(...areas.map((x) => +(x.promedio || 0)), 1);

    return (
      <>
        <p className="rk-nota">
          Se ordena por el promedio del mejor puntaje. Toca cualquier departamento para ver sus jugadores:
        </p>
        <ol className="ranking">
          {areas.map((x, i) => {
            const prom = +(x.promedio || 0);
            const part = +(x.participantes || 0);
            const esMiDepto = miArea && areaDe(x).toLowerCase() === miArea;

            const jgsArea = jugadores.filter(
              (j) => String(j.area || '').trim().toLowerCase() === areaDe(x).toLowerCase()
            );
            const liderArea = jgsArea.length > 0 ? jgsArea[0] : null;

            return (
              <li
                key={i}
                className={esMiDepto ? 'yo fila-area-interactiva' : 'fila-area-interactiva'}
                onClick={() => handleFiltrarPorArea(areaDe(x))}
                style={{ cursor: 'pointer' }}
                title={`Ver ranking de jugadores de ${areaDe(x)}`}
              >
                <span className="pos">
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                </span>
                <span className="quien">
                  <b>{areaDe(x)}</b>
                  <small>
                    {part} {part === 1 ? 'participante' : 'participantes'}
                    {liderArea ? ` • 👑 Ganador(a): ${liderArea.nombre} (${num(puntosDe(liderArea))} pts)` : ''}
                  </small>
                  <span className="barra" aria-hidden="true">
                    <i style={{ width: `${Math.round((prom / max) * 100)}%` }} />
                  </span>
                  <button
                    type="button"
                    className="btn-ver-depto-jugadores"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFiltrarPorArea(areaDe(x));
                    }}
                  >
                    👥 Ver jugadores ({part})
                  </button>
                </span>
                <b className="pts">
                  {num(prom)}
                  <small>promedio</small>
                </b>
              </li>
            );
          })}
        </ol>
      </>
    );
  };

  const deptoActivoLabel =
    deptoFiltro === 'TODOS'
      ? 'General (todos los departamentos)'
      : deptoFiltro;

  return (
    <section className="pantalla pantalla-panel" id="p-ranking">
      <div className="panel">
        <div className="tabla panel-cab t-morado">Ranking</div>

        <div className="pestanas" role="tablist" aria-label="Tipo de ranking">
          <button
            className="tabla chica t-teal"
            type="button"
            role="tab"
            aria-selected={tab === 'jugadores'}
            onClick={() => handleTabChange('jugadores')}
          >
            Jugadores
          </button>
          <button
            className="tabla chica t-naranja"
            type="button"
            role="tab"
            aria-selected={tab === 'areas'}
            onClick={() => handleTabChange('areas')}
          >
            Departamentos
          </button>
        </div>

        {/* Nota explicativa de la regla oficial del ranking */}
        <div
          style={{
            background: 'rgba(26, 20, 51, 0.65)',
            border: '1px solid rgba(255, 244, 224, 0.2)',
            borderRadius: '10px',
            padding: '8px 12px',
            margin: '8px auto 10px auto',
            maxWidth: '520px',
            textAlign: 'center',
            fontSize: '0.84rem',
            color: 'var(--crema-suave)',
            lineHeight: '1.35'
          }}
        >
          🏆 <b>Regla de clasificación:</b> El ranking oficial se determina <b>exclusivamente con el puntaje del 2º intento</b>. El 1º intento es de práctica y no suma al ranking.
        </div>

        {/* Barra de administración si es SUPER ADMIN */}
        {admin && (
          <div
            style={{
              background: 'rgba(34, 27, 71, 0.75)',
              border: '1.5px solid rgba(217, 119, 6, 0.4)',
              borderRadius: '10px',
              padding: '10px 14px',
              margin: '8px auto 14px auto',
              maxWidth: '520px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ fontSize: '0.84rem', color: '#fcd34d', textAlign: 'left', flex: '1', minWidth: '180px' }}>
              👑 <b>Panel Administrador:</b> Exporta el reporte o gestiona la tabla.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleExportarPDF}
                disabled={exportandoPdf}
                style={{
                  background: exportandoPdf ? 'rgba(217, 119, 6, 0.5)' : 'linear-gradient(135deg, #d97706, #b45309)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: exportandoPdf ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)'
                }}
              >
                <span>{exportandoPdf ? '⏳ Generando…' : '📄 Exportar PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handleLimpiarTodo}
                style={{
                  background: '#d32f2f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                ⚠️ Vaciar Ranking
              </button>
            </div>

            {mensajePdf && (
              <div
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: 'rgba(61, 220, 132, 0.15)',
                  border: '1px solid #3ddc84',
                  color: '#b9f6ca',
                  fontSize: '0.82rem',
                  textAlign: 'center'
                }}
              >
                {mensajePdf}
              </div>
            )}
          </div>
        )}

        {/* Filtro de Departamento en pestaña Jugadores */}
        {tab === 'jugadores' && (
          <div className="rk-filtro-fila">
            <div className="rk-filtro-header">
              <label htmlFor="select-filtro-depto" className="rk-filtro-label">
                <span>🏢</span> Filtrar por departamento:
              </label>
              {deptoFiltro !== 'TODOS' && (
                <button
                  type="button"
                  className="btn-limpiar-filtro"
                  onClick={() => {
                    sfx.clic();
                    setDeptoFiltro('TODOS');
                  }}
                >
                  ✕ Quitar filtro
                </button>
              )}
            </div>

            <div className="rk-select-wrapper">
              <select
                id="select-filtro-depto"
                className="rk-select"
                value={deptoFiltro}
                onChange={(e) => {
                  sfx.clic();
                  setDeptoFiltro(e.target.value);
                }}
              >
                <option value="TODOS">
                  🏢 Todos los departamentos ({jugadores.length} jugadores)
                </option>
                {session?.area && (
                  <option value={session.area.trim()}>
                    ⭐ Mi departamento: {session.area.trim()}
                  </option>
                )}
                {listaDeptos.map((d) => {
                  if (session?.area && d.toLowerCase() === session.area.trim().toLowerCase()) {
                    return null; // Ya mostrado arriba como 'Mi departamento'
                  }
                  const cant = jugadores.filter(
                    (j) => String(j.area || '').trim().toLowerCase() === d.toLowerCase()
                  ).length;
                  return (
                    <option key={d} value={d}>
                      {d} {cant > 0 ? `(${cant} ${cant === 1 ? 'jugador' : 'jugadores'})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {deptoFiltro !== 'TODOS' && (
              <div
                className="rk-filtro-activo"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  background: 'rgba(217, 119, 6, 0.15)',
                  border: '1px solid rgba(217, 119, 6, 0.45)',
                  padding: '8px 12px',
                  borderRadius: '8px'
                }}
              >
                <span>
                  Mostrando ranking de <b>{deptoFiltro}</b> ({jugadoresFiltrados.length}{' '}
                  {jugadoresFiltrados.length === 1 ? 'jugador' : 'jugadores'})
                </span>
                {jugadoresFiltrados.length > 0 && (
                  <span style={{ color: '#fcd34d', fontWeight: 800, fontSize: '0.86rem' }}>
                    👑 <b>Ganador(a) del departamento:</b> {jugadoresFiltrados[0].nombre} con{' '}
                    {num(puntosDe(jugadoresFiltrados[0]))} puntos
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div id="rk-contenido">
          {cargando ? (
            <p className="rk-nota">Cargando datos del ranking…</p>
          ) : tab === 'jugadores' ? (
            jugadores.length === 0 ? (
              <p className="rk-nota">
                Todavía nadie ha terminado la aventura. ¡Puedes ser el primero!
              </p>
            ) : jugadoresFiltrados.length === 0 ? (
              <p className="rk-nota">
                Todavía no hay colaboradores de <b>{deptoFiltro}</b> con partidas registradas.
              </p>
            ) : (
              <>
                {renderPodio(jugadoresFiltrados)}
                {renderRestoJugadores(jugadoresFiltrados)}
              </>
            )
          ) : (
            renderAreas()
          )}
        </div>

        <p className="rk-estado">{estadoTxt}</p>
      </div>

      <div className="fila-botones">
        <button
          className="btn-texto"
          type="button"
          onClick={() => {
            sfx.clic();
            cargarDatos();
          }}
        >
          Actualizar
        </button>
        <WoodButton color="t-rojo" chica onClick={onBackToMenu}>
          Volver
        </WoodButton>
      </div>
    </section>
  );
}
