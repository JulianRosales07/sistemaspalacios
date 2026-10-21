import { CONFIG, DEPARTAMENTOS_OFICIALES, K_EVENTO, DIFS } from './constants.js';
import { getLocalRanking, guardarLocalRanking, cargarPerfil, perfilVacio } from './storage.js';
import { backendService } from './backendService.js';

function ruta(o, p) {
  if (!p) return undefined;
  return p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
}

export function nombrePropio(n) {
  const menores = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von']);
  return String(n)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && menores.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export async function validarCedula(ced) {
  if (!CONFIG.LOGIN_URL) {
    return { ok: true, nombre: '', area: '', token: '' };
  }

  // Intentamos con la URL configurada (que usa el proxy de Vite en dev)
  const urlsToTry = [
    CONFIG.LOGIN_URL.replace('{cedula}', encodeURIComponent(ced)),
    CONFIG.LOGIN_FALLBACK_URL.replace('{cedula}', encodeURIComponent(ced))
  ];

  const noEncontrada = {
    ok: false,
    msg: 'No encontramos esa cédula entre los colaboradores activos. Revísala o pregunta a Talento Humano.'
  };

  for (const url of urlsToTry) {
    try {
      const post = CONFIG.LOGIN_METODO.toUpperCase() === 'POST';
      const r = await fetch(url, {
        method: post ? 'POST' : 'GET',
        headers: Object.assign(
          post ? { 'Content-Type': 'application/json' } : {},
          CONFIG.LOGIN_HEADERS || {}
        ),
        body: post ? JSON.stringify({ cedula: ced }) : undefined
      });

      if (r.status === 404 || r.status === 401 || r.status === 403 || r.status === 204) {
        return noEncontrada;
      }

      if (!r.ok) continue;

      const txt = await r.text();
      if (!txt.trim()) return noEncontrada;

      let d = JSON.parse(txt);
      if (Array.isArray(d)) d = d[0];
      if (!d || typeof d !== 'object') return noEncontrada;

      const nombre = ruta(d, CONFIG.CAMPO_NOMBRE);
      if (!nombre) return noEncontrada;

      const estado = ruta(d, CONFIG.CAMPO_ESTADO);
      if (
        estado != null &&
        CONFIG.ESTADO_VALIDO &&
        String(estado).trim().toUpperCase() !== CONFIG.ESTADO_VALIDO.toUpperCase()
      ) {
        return noEncontrada;
      }

      const cedResp = ruta(d, 'cedula');
      if (cedResp != null && String(cedResp).replace(/\D/g, '') !== ced) {
        return noEncontrada;
      }

      const infoJugador = {
        ok: true,
        nombre: nombrePropio(nombre),
        area: String(ruta(d, CONFIG.CAMPO_AREA) || '').trim(),
        cargo: String(ruta(d, 'cargo') || '').trim(),
        estado: String(ruta(d, CONFIG.CAMPO_ESTADO) || 'ACTIVO').trim(),
        cedula: ced,
        token: String(ruta(d, CONFIG.CAMPO_TOKEN) || '')
      };

      // Registrar o actualizar datos del colaborador en Supabase de forma asíncrona
      registrarJugador(infoJugador, infoJugador.token).catch(() => {});

      return infoJugador;
    } catch (err) {
      // Intentar la siguiente url de fallback si la primera falló
      continue;
    }
  }

  return {
    ok: false,
    msg: 'No se pudo conectar con el servicio de colaboradores. Verifica la red o el proxy local.'
  };
}

export function cabecerasAPI(token) {
  const h = Object.assign({ 'Content-Type': 'application/json' }, CONFIG.HEADERS);
  if (token && !h.Authorization) {
    h.Authorization = 'Bearer ' + token;
  }
  return h;
}

export async function registrarJugador(jugadorData, token) {
  if (!CONFIG.RESULTADOS_URL || !jugadorData?.cedula) return;
  const baseUrl = CONFIG.RESULTADOS_URL.replace(/\/partida\b/, '/jugador');
  const upsertUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'on_conflict=cedula';

  try {
    const payload = {
      cedula: jugadorData.cedula,
      nombre: jugadorData.nombre,
      area: jugadorData.area || '',
      cargo: jugadorData.cargo || '',
      estado: jugadorData.estado || 'ACTIVO',
      ultimo_ingreso: new Date().toISOString()
    };

    const hdrs = Object.assign({}, cabecerasAPI(token), {
      Prefer: 'resolution=merge-duplicates'
    });

    let r = await fetch(upsertUrl, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify(payload)
    });

    if (!r.ok && (r.status === 400 || r.status === 409)) {
      const patchUrl = baseUrl + '?cedula=eq.' + encodeURIComponent(payload.cedula);
      r = await fetch(patchUrl, {
        method: 'PATCH',
        headers: cabecerasAPI(token),
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        await fetch(baseUrl, {
          method: 'POST',
          headers: cabecerasAPI(token),
          body: JSON.stringify(payload)
        });
      }
    }
  } catch (err) {
    console.warn('No se pudo registrar jugador en Supabase:', err);
  }
}

export async function consultarIntentosServidor(cedula, token) {
  if (!cedula) return null;
  const hdrs = cabecerasAPI(token);

  // 1. Intentar RPC en Supabase
  if (CONFIG.CONSULTAR_INTENTOS_URL) {
    try {
      const r = await fetch(CONFIG.CONSULTAR_INTENTOS_URL, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ p_cedula: String(cedula) })
      });
      if (r.ok) {
        const d = await r.json();
        if (d && typeof d === 'object') return d;
      }
    } catch (_) {}
  }

  // 2. Intentar consultar tabla usuario_intentos directamente
  if (CONFIG.USUARIO_INTENTOS_URL) {
    try {
      const url =
        CONFIG.USUARIO_INTENTOS_URL +
        (CONFIG.USUARIO_INTENTOS_URL.includes('?') ? '&' : '?') +
        'cedula=eq.' +
        encodeURIComponent(cedula) +
        '&select=*';
      const r = await fetch(url, { headers: hdrs });
      if (r.ok) {
        const arr = await r.json();
        if (Array.isArray(arr) && arr.length > 0) {
          const u = arr[0];
          return {
            found: true,
            cedula: u.cedula,
            nombre: u.nombre,
            area: u.area,
            attemptsUsed: Number(u.intentos_usados) || 0,
            attemptsRemaining: Math.max(0, 2 - (Number(u.intentos_usados) || 0)),
            firstAttemptScore: u.primer_intento_puntaje,
            secondAttemptScore: u.segundo_intento_puntaje,
            rankingScore: u.ranking_puntaje,
            firstAttemptDate: u.primer_intento_fecha,
            secondAttemptDate: u.segundo_intento_fecha
          };
        }
      }
    } catch (_) {}
  }

  // 3. Fallback al servicio backend local
  return await backendService.getAttempts(cedula);
}

export async function cargarPerfilServidor(cedula, token) {
  if (!cedula) return null;

  try {
    const hdrs = cabecerasAPI(token);

    // 1. Consultar intentos del usuario
    const pIntentos = consultarIntentosServidor(cedula, token).catch(() => null);

    // 2. Consultar partida en Supabase por cédula
    const urlPartida =
      CONFIG.RESULTADOS_URL +
      (CONFIG.RESULTADOS_URL.includes('?') ? '&' : '?') +
      'cedula=eq.' +
      encodeURIComponent(cedula) +
      '&select=*';

    // 3. Consultar jugador en Supabase por cédula
    const baseUrlJugador = CONFIG.RESULTADOS_URL.replace(/\/partida\b/, '/jugador');
    const urlJugador =
      baseUrlJugador +
      (baseUrlJugador.includes('?') ? '&' : '?') +
      'cedula=eq.' +
      encodeURIComponent(cedula) +
      '&select=*';

    const [intentosData, resPartida, resJugador] = await Promise.all([
      pIntentos,
      fetch(urlPartida, { headers: hdrs }).catch(() => null),
      fetch(urlJugador, { headers: hdrs }).catch(() => null)
    ]);

    let partidaData = null;
    if (resPartida && resPartida.ok) {
      const arr = await resPartida.json().catch(() => []);
      if (Array.isArray(arr) && arr.length > 0) {
        partidaData = arr[0];
      }
    }

    let jugadorData = null;
    if (resJugador && resJugador.ok) {
      const arr = await resJugador.json().catch(() => []);
      if (Array.isArray(arr) && arr.length > 0) {
        jugadorData = arr[0];
      }
    }

    // El perfil base siempre empieza limpio
    const perfil = perfilVacio();

    // Si jugador tiene perfil JSON en la base de datos, lo cargamos
    if (jugadorData && jugadorData.perfil && typeof jugadorData.perfil === 'object') {
      Object.assign(perfil, jugadorData.perfil);
      if (jugadorData.perfil.cont) {
        perfil.cont = Object.assign(perfilVacio().cont, jugadorData.perfil.cont);
      }
      if (jugadorData.perfil.avatar) {
        perfil.avatar = jugadorData.perfil.avatar;
      }
      if (typeof jugadorData.perfil.configuroAvatar === 'boolean') {
        perfil.configuroAvatar = jugadorData.perfil.configuroAvatar;
      }
    }

    // Si jugadorData tiene columna avatar directamente en Supabase, lo cargamos
    if (jugadorData && jugadorData.avatar && typeof jugadorData.avatar === 'object') {
      perfil.avatar = jugadorData.avatar;
      if (jugadorData.perfil && jugadorData.perfil.configuroAvatar === true) {
        perfil.configuroAvatar = true;
      }
    }

    // Si hay datos de intentos, aplicamos las reglas de negocio
    if (intentosData && (intentosData.found || intentosData.attemptsUsed > 0)) {
      perfil.intentosUsados = Number(intentosData.attemptsUsed) || 0;
      perfil.intentosRestantes = Math.max(0, 2 - perfil.intentosUsados);
      perfil.primerIntentoPuntaje = intentosData.firstAttemptScore;
      perfil.segundoIntentoPuntaje = intentosData.secondAttemptScore;
      perfil.rankingScore = intentosData.rankingScore;
      perfil.partidas = perfil.intentosUsados;
      perfil.yaJugo = perfil.intentosUsados >= 2;
      // REGLA CLAVE: perfil.mejor solo toma rankingScore (que viene exclusivamente del 2do intento)
      perfil.mejor = Number(intentosData.rankingScore) || 0;

      if (partidaData) {
        perfil.drenador = Boolean(partidaData.vencio_drenador);
        if (partidaData.dificultad) perfil.difPref = partidaData.dificultad;
        if (partidaData.avatar && typeof partidaData.avatar === 'object') {
          perfil.avatar = partidaData.avatar;
        }
      }
    } else if (partidaData) {
      // Compatibilidad con registros previos de la tabla partida
      perfil.mejor = Number(partidaData.puntaje) || 0;
      perfil.rankingScore = Number(partidaData.puntaje) || 0;
      perfil.drenador = Boolean(partidaData.vencio_drenador);
      perfil.intentosUsados = 2;
      perfil.intentosRestantes = 0;
      perfil.partidas = 2;
      perfil.yaJugo = true;
      perfil.configuroAvatar = true;
      if (partidaData.dificultad) {
        perfil.difPref = partidaData.dificultad;
      }
      if (partidaData.avatar && typeof partidaData.avatar === 'object') {
        perfil.avatar = partidaData.avatar;
      }
    } else {
      // SI NO HAY PARTIDA NI INTENTOS: todo en 0
      perfil.intentosUsados = 0;
      perfil.intentosRestantes = 2;
      perfil.primerIntentoPuntaje = null;
      perfil.segundoIntentoPuntaje = null;
      perfil.rankingScore = null;
      perfil.mejor = 0;
      perfil.drenador = false;
      perfil.partidas = 0;
      perfil.yaJugo = false;
      perfil.run = null;
    }

    // Blindaje contra reinicio de intentos:
    // Si localmente el colaborador ya completó 1 o 2 intentos, jamás rebajarlo a 0.
    const local = cargarPerfil(cedula);
    if (local && (local.intentosUsados > 0 || local.yaJugo)) {
      if ((perfil.intentosUsados || 0) < local.intentosUsados || local.yaJugo) {
        perfil.intentosUsados = Math.max(perfil.intentosUsados || 0, local.intentosUsados);
        perfil.yaJugo = local.yaJugo || perfil.intentosUsados >= 2;
        perfil.intentosRestantes = perfil.yaJugo ? 0 : Math.max(0, 2 - perfil.intentosUsados);
        perfil.primerIntentoPuntaje = perfil.primerIntentoPuntaje ?? local.primerIntentoPuntaje;
        perfil.segundoIntentoPuntaje = perfil.segundoIntentoPuntaje ?? local.segundoIntentoPuntaje;
        perfil.rankingScore = perfil.rankingScore ?? local.rankingScore;
        perfil.partidas = perfil.intentosUsados;
        perfil.mejor = perfil.rankingScore || local.mejor || 0;
        perfil.ultimoIntento = perfil.ultimoIntento || local.ultimoIntento;
      }
    }

    return perfil;
  } catch (err) {
    console.warn('Error al cargar perfil desde Supabase:', err);
    return null;
  }
}

export async function sincronizarPerfilServidor(cedula, perfil, token) {
  if (!CONFIG.RESULTADOS_URL || !cedula || !perfil) return;
  const baseUrl = CONFIG.RESULTADOS_URL.replace(/\/partida\b/, '/jugador');
  const patchUrl =
    baseUrl +
    (baseUrl.includes('?') ? '&' : '?') +
    'cedula=eq.' +
    encodeURIComponent(cedula);

  try {
    const avatarData = perfil.avatar || null;
    const perfilPayload = {
      cont: perfil.cont || {},
      tutos: perfil.tutos || {},
      vioIntro: Boolean(perfil.vioIntro),
      capMax: perfil.capMax || 0,
      difPref: perfil.difPref || 'media',
      yaJugo: Boolean(perfil.yaJugo),
      avatar: avatarData,
      configuroAvatar: Boolean(perfil.configuroAvatar)
    };

    // Intentamos actualizar tanto la columna avatar como perfil en jugador
    const payloadCompleto = {
      avatar: avatarData,
      perfil: perfilPayload
    };

    let r = await fetch(patchUrl, {
      method: 'PATCH',
      headers: cabecerasAPI(token),
      body: JSON.stringify(payloadCompleto)
    });

    // Si la columna avatar no existe aún en la tabla de Supabase (error 400),
    // guardamos en la columna perfil que siempre existe:
    if (!r.ok && r.status === 400) {
      await fetch(patchUrl, {
        method: 'PATCH',
        headers: cabecerasAPI(token),
        body: JSON.stringify({ perfil: perfilPayload })
      });
    }
  } catch (e) {
    // Si no tiene la columna perfil o falla la red, no interrumpe el juego
  }
}

export async function guardarPartida(payload, token) {
  // 0. Validar disponibilidad del evento en las fechas configuradas
  try {
    const ev = await obtenerEvento(token);
    const disp = verificarDisponibilidad(ev);
    if (!disp.disponible) {
      return {
        ok: false,
        cerrado: true,
        msg: 'El juego se encuentra actualmente cerrado. No se pueden registrar más partidas en este momento.'
      };
    }
  } catch (e) {}

  // 1. Intentar llamar al procedimiento almacenado seguro en Supabase
  if (CONFIG.REGISTRAR_INTENTO_URL) {
    try {
      const hdrs = cabecerasAPI(token);
      const rpcBody = {
        p_cedula: String(payload.cedula),
        p_nombre: payload.nombre || 'Colaborador',
        p_area: payload.area || '',
        p_dificultad: payload.dificultad || 'media',
        p_puntaje: Math.max(0, Math.round(Number(payload.puntaje) || 0)),
        p_porcentaje_aciertos: payload.porcentaje_aciertos ?? null,
        p_vencio_drenador: Boolean(payload.vencio_drenador),
        p_capitulos: payload.capitulos || [],
        p_avatar: payload.avatar || null,
        p_fecha_inicio: payload.fecha_inicio || null
      };

      const res = await fetch(CONFIG.REGISTRAR_INTENTO_URL, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify(rpcBody)
      });

      if (res.status === 409) {
        const errJson = await res.json().catch(() => ({}));
        return {
          ok: false,
          conflict: true,
          status: 409,
          attemptsUsed: 2,
          attemptsRemaining: 0,
          msg: errJson.message || 'El usuario ya utilizó sus 2 intentos disponibles.'
        };
      }

      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          if (data.ok === false && (data.status === 409 || data.error === 'CONFLICT')) {
            return {
              ok: false,
              conflict: true,
              status: 409,
              attemptsUsed: 2,
              attemptsRemaining: 0,
              msg: data.message || 'El usuario ya utilizó sus 2 intentos disponibles.'
            };
          }

          // Sincronizar también con backendService en memoria local
          await backendService.registerAttempt(payload).catch(() => {});

          return {
            ok: true,
            attempt: data.attempt,
            score: data.score,
            countsForRanking: Boolean(data.countsForRanking),
            attemptsUsed: data.attemptsUsed,
            attemptsRemaining: data.attemptsRemaining,
            firstAttemptScore: data.firstAttemptScore,
            secondAttemptScore: data.secondAttemptScore,
            rankingScore: data.rankingScore,
            msg: data.message
          };
        }
      }
    } catch (err) {
      console.warn('RPC Supabase registrar_intento no disponible, usando backend de resguardo:', err);
    }
  }

  // 2. Fallback al servicio backend local (garantiza la misma regla transaccional y ranking exclusivo intento 2)
  const localResp = await backendService.registerAttempt(payload);
  if (localResp.ok) {
    if (localResp.attempt === 2) {
      const dRun = DIFS[payload.dificultad] || DIFS.media;
      guardarLocalRanking({
        cedula: payload.cedula,
        nombre: payload.nombre,
        area: payload.area || '',
        puntos: localResp.rankingScore,
        dificultad: dRun.nombre
      });
    }

    return {
      ok: true,
      attempt: localResp.attempt,
      score: localResp.score,
      countsForRanking: localResp.countsForRanking,
      attemptsUsed: localResp.attemptsUsed,
      attemptsRemaining: localResp.attemptsRemaining,
      firstAttemptScore: localResp.firstAttemptScore,
      secondAttemptScore: localResp.secondAttemptScore,
      rankingScore: localResp.rankingScore,
      msg: localResp.message
    };
  } else {
    return {
      ok: false,
      conflict: localResp.status === 409,
      status: localResp.status || 400,
      attemptsUsed: localResp.attemptsUsed,
      attemptsRemaining: localResp.attemptsRemaining,
      msg: localResp.message || 'No se pudo registrar el intento.'
    };
  }
}

export function localAreasFromLocalScores() {
  const jugadores = getLocalRanking();
  const g = {};
  jugadores.forEach(x => {
    const a = String(x.area || '').trim() || 'Sin área';
    const pts = +(x.puntaje ?? x.puntajeTotal ?? x.puntos ?? 0);
    (g[a] = g[a] || []).push(pts);
  });
  return Object.entries(g)
    .map(([area, v]) => ({
      area,
      participantes: v.length,
      promedio: Math.round(v.reduce((s, n) => s + n, 0) / v.length),
      mejor: Math.max(...v)
    }))
    .sort((a, b) => b.promedio - a.promedio || b.participantes - a.participantes);
}

export async function obtenerRankingJugadores(token) {
  if (!CONFIG.RANKING_URL) {
    return { lista: getLocalRanking(), origen: 'local' };
  }
  try {
    let r = await fetch(CONFIG.RANKING_URL, { headers: cabecerasAPI(token) });
    if (!r.ok && CONFIG.RANKING_FALLBACK_URL) {
      r = await fetch(CONFIG.RANKING_FALLBACK_URL, { headers: cabecerasAPI(token) });
    }
    if (!r.ok) throw new Error('http');
    const d = await r.json();
    return {
      lista: Array.isArray(d) ? d : d.data || d.ranking || [],
      origen: 'api'
    };
  } catch (e) {
    return { lista: getLocalRanking(), origen: 'error' };
  }
}

export async function obtenerRankingAreas(token) {
  if (!CONFIG.RANKING_AREAS_URL) {
    return { lista: localAreasFromLocalScores(), origen: 'local' };
  }
  try {
    const r = await fetch(CONFIG.RANKING_AREAS_URL, { headers: cabecerasAPI(token) });
    if (!r.ok) throw new Error('http');
    const d = await r.json();
    return {
      lista: Array.isArray(d) ? d : d.data || d.ranking || [],
      origen: 'api'
    };
  } catch (e) {
    return { lista: localAreasFromLocalScores(), origen: 'error' };
  }
}

export async function obtenerDepartamentosAPI() {
  const urls = [
    CONFIG.EMPLOYEES_URL || '/api/employees',
    CONFIG.EMPLOYEES_FALLBACK_URL || 'http://localhost:3001/api/employees',
    'https://sp-empresarial.com/api/employees'
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      const cType = res.headers.get('content-type') || '';
      if (!res.ok || !cType.includes('application/json')) continue;

      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const deps = new Set(DEPARTAMENTOS_OFICIALES);
        data.forEach(emp => {
          const depName =
            emp?.position?.dependency?.name ||
            emp?.position?.parentPosition?.dependency?.name ||
            emp?.dependencia ||
            emp?.area;
          if (depName && String(depName).trim()) {
            deps.add(String(depName).trim().toUpperCase());
          }
        });
        return Array.from(deps).sort((a, b) => a.localeCompare(b, 'es'));
      }
    } catch (e) {
      // Intentar la siguiente url o continuar
    }
  }

  // Retornar lista oficial completa de dependencias de Sistemas Palacios
  return DEPARTAMENTOS_OFICIALES;
}

const EVENTO_DEFAULT = {
  id: 1,
  nombre: 'Semana SST 2026',
  inicio: '2026-09-01T00:00:00-05:00',
  fin: '2026-11-30T23:59:59-05:00',
  max_partidas_dia: 1,
  max_puntaje_base: 35000
};

export async function obtenerEvento(token) {
  // Intentar cargar primero de Supabase
  if (CONFIG.EVENTO_URL) {
    try {
      const url = CONFIG.EVENTO_URL + (CONFIG.EVENTO_URL.includes('?') ? '&' : '?') + 'id=eq.1&select=*';
      const r = await fetch(url, { headers: cabecerasAPI(token) });
      if (r.ok) {
        const arr = await r.json();
        if (Array.isArray(arr) && arr.length > 0) {
          const ev = arr[0];
          // Guardar en cache local
          try {
            localStorage.setItem(K_EVENTO, JSON.stringify(ev));
          } catch (_) {}
          return ev;
        }
      }
    } catch (e) {
      console.warn('Error al consultar evento en Supabase:', e);
    }
  }

  // Fallback a localStorage
  try {
    const local = localStorage.getItem(K_EVENTO);
    if (local) {
      const evLocal = JSON.parse(local);
      if (evLocal && evLocal.inicio && evLocal.fin) {
        return evLocal;
      }
    }
  } catch (_) {}

  return EVENTO_DEFAULT;
}

export async function actualizarEvento(cambios, token) {
  const payload = {
    inicio: cambios.inicio,
    fin: cambios.fin
  };
  if (cambios.nombre) payload.nombre = cambios.nombre;

  // Actualizar inmediatamente en cache local para feedback instantáneo
  try {
    const actual = await obtenerEvento(token);
    const nuevoLocal = { ...actual, ...payload };
    localStorage.setItem(K_EVENTO, JSON.stringify(nuevoLocal));
  } catch (_) {}

  if (!CONFIG.EVENTO_URL) {
    return { ok: true, data: payload, origen: 'local' };
  }

  try {
    const url = CONFIG.EVENTO_URL + (CONFIG.EVENTO_URL.includes('?') ? '&' : '?') + 'id=eq.1';
    const hdrs = Object.assign({}, cabecerasAPI(token), {
      'Prefer': 'return=representation'
    });

    const r = await fetch(url, {
      method: 'PATCH',
      headers: hdrs,
      body: JSON.stringify(payload)
    });

    if (r.ok) {
      const resData = await r.json().catch(() => []);
      if (Array.isArray(resData) && resData.length > 0) {
        return { ok: true, data: resData[0], origen: 'supabase' };
      } else {
        // HTTP 200 pero array vacío => RLS bloqueó el UPDATE en Supabase
        return {
          ok: true,
          data: payload,
          origen: 'local_rls_bloqueado',
          rlsBloqueado: true,
          msg: 'Guardado localmente. Para sincronizar a todos los colaboradores en Supabase, ejecuta el comando SQL de actualización.'
        };
      }
    } else {
      const errTxt = await r.text().catch(() => '');
      return {
        ok: false,
        msg: `Error ${r.status} al guardar en Supabase: ${errTxt}`
      };
    }
  } catch (err) {
    return {
      ok: true,
      data: payload,
      origen: 'local_offline',
      msg: 'Guardado en este equipo. No se pudo conectar con Supabase en este momento.'
    };
  }
}

export function formatearFechaLarga(fechaStr) {
  if (!fechaStr) return '';
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return fechaStr;

  return d.toLocaleString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function formatearFechaCorta(fechaStr) {
  if (!fechaStr) return '';
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return fechaStr;

  return d.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function tiempoDiferenciaTexto(ms) {
  if (ms <= 0) return '0 min';
  const segs = Math.floor(ms / 1000);
  const mins = Math.floor(segs / 60);
  const horas = Math.floor(mins / 60);
  const dias = Math.floor(horas / 24);

  if (dias > 0) {
    const remHoras = horas % 24;
    return `${dias} ${dias === 1 ? 'día' : 'días'}${remHoras > 0 ? ` y ${remHoras} h` : ''}`;
  }
  if (horas > 0) {
    const remMins = mins % 60;
    return `${horas} h${remMins > 0 ? ` ${remMins} min` : ''}`;
  }
  return `${Math.max(1, mins)} min`;
}

export function verificarDisponibilidad(ev) {
  let evento = ev;
  if (!evento || !evento.inicio || !evento.fin) {
    try {
      const local = typeof localStorage !== 'undefined' ? localStorage.getItem(K_EVENTO) : null;
      if (local) evento = JSON.parse(local);
    } catch (_) {}
  }
  if (!evento || !evento.inicio || !evento.fin) {
    evento = EVENTO_DEFAULT;
  }

  const ahora = new Date();
  const dInicio = new Date(evento.inicio);
  const dFin = new Date(evento.fin);

  const inicioFormateado = formatearFechaLarga(evento.inicio);
  const finFormateado = formatearFechaLarga(evento.fin);
  const inicioCorta = formatearFechaCorta(evento.inicio);
  const finCorta = formatearFechaCorta(evento.fin);

  if (ahora < dInicio) {
    const msFaltan = dInicio.getTime() - ahora.getTime();
    return {
      disponible: false,
      motivo: 'antes',
      inicioDate: dInicio,
      finDate: dFin,
      inicioFormateado,
      finFormateado,
      inicioCorta,
      finCorta,
      tiempoParaInicio: tiempoDiferenciaTexto(msFaltan),
      tiempoRestante: ''
    };
  }

  if (ahora > dFin) {
    return {
      disponible: false,
      motivo: 'despues',
      inicioDate: dInicio,
      finDate: dFin,
      inicioFormateado,
      finFormateado,
      inicioCorta,
      finCorta,
      tiempoParaInicio: '',
      tiempoRestante: 'Finalizado'
    };
  }

  const msRestantes = dFin.getTime() - ahora.getTime();
  return {
    disponible: true,
    motivo: 'activo',
    inicioDate: dInicio,
    finDate: dFin,
    inicioFormateado,
    finFormateado,
    inicioCorta,
    finCorta,
    tiempoParaInicio: '',
    tiempoRestante: tiempoDiferenciaTexto(msRestantes)
  };
}

export async function obtenerMetricasAdmin(token) {
  const result = {
    totalJugadores: 0,
    totalPartidas: 0,
    mejorPuntaje: 0,
    mejorJugador: null
  };

  if (!CONFIG.RESULTADOS_URL) return result;

  try {
    const urlJugadores = CONFIG.RESULTADOS_URL.replace(/\/partida\b/, '/jugador') + '?select=id';
    const urlPartidas = CONFIG.RESULTADOS_URL + '?select=puntaje,nombre,area,dificultad&order=puntaje.desc&limit=1';
    const urlTotalPartidas = CONFIG.RESULTADOS_URL + '?select=id';

    const hdrs = cabecerasAPI(token);

    const [resJugs, resParts, resTop] = await Promise.all([
      fetch(urlJugadores, { headers: hdrs }).catch(() => null),
      fetch(urlTotalPartidas, { headers: hdrs }).catch(() => null),
      fetch(urlPartidas, { headers: hdrs }).catch(() => null)
    ]);

    if (resJugs && resJugs.ok) {
      const arr = await resJugs.json().catch(() => []);
      if (Array.isArray(arr)) result.totalJugadores = arr.length;
    }

    if (resParts && resParts.ok) {
      const arr = await resParts.json().catch(() => []);
      if (Array.isArray(arr)) result.totalPartidas = arr.length;
    }

    if (resTop && resTop.ok) {
      const arr = await resTop.json().catch(() => []);
      if (Array.isArray(arr) && arr.length > 0) {
        result.mejorPuntaje = arr[0].puntaje || 0;
        result.mejorJugador = arr[0];
      }
    }
  } catch (err) {
    console.warn('Error al cargar métricas de admin:', err);
  }

  return result;
}

