import React, { useState, useEffect, useCallback, useMemo } from 'react';
import WoodButton from '../components/WoodButton';
import { DIFS, DEPARTAMENTOS_OFICIALES } from '../game/constants';
import { num } from '../game/canvasUtils';
import { obtenerRankingJugadores, obtenerRankingAreas, obtenerDepartamentosAPI } from '../game/api';
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
            <div key={visualIdx} className={`puesto p${posNum}`}>
              <div className="medalla" aria-hidden="true">
                {medallas[posIdx]}
              </div>
              <b>
                {x.nombre || 'Colaborador'}
                {esYo(x) ? ' (tú)' : ''}
              </b>
              <small>{x.area ? areaDe(x) : nombreDif(x.dificultad)}</small>
              <div className="puesto-base">{num(puntosDe(x))}</div>
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
                    {x.mejor != null ? `, récord ${num(x.mejor)}` : ''}
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
              <div className="rk-filtro-activo">
                <span>
                  Mostrando ranking de <b>{deptoFiltro}</b> ({jugadoresFiltrados.length}{' '}
                  {jugadoresFiltrados.length === 1 ? 'jugador' : 'jugadores'})
                </span>
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
