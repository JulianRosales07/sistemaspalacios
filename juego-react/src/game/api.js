import { CONFIG, DEPARTAMENTOS_OFICIALES } from './constants';
import { getLocalRanking, perfilVacio } from './storage';

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

export async function cargarPerfilServidor(cedula, token) {
  if (!CONFIG.RESULTADOS_URL || !cedula) return null;

  try {
    const hdrs = cabecerasAPI(token);

    // 1. Consultar partida en Supabase por cédula
    const urlPartida =
      CONFIG.RESULTADOS_URL +
      (CONFIG.RESULTADOS_URL.includes('?') ? '&' : '?') +
      'cedula=eq.' +
      encodeURIComponent(cedula) +
      '&select=*';

    // 2. Consultar jugador en Supabase por cédula
    const baseUrlJugador = CONFIG.RESULTADOS_URL.replace(/\/partida\b/, '/jugador');
    const urlJugador =
      baseUrlJugador +
      (baseUrlJugador.includes('?') ? '&' : '?') +
      'cedula=eq.' +
      encodeURIComponent(cedula) +
      '&select=*';

    const [resPartida, resJugador] = await Promise.all([
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
        perfil.configuroAvatar = true;
      }
    }

    // Si jugadorData tiene columna avatar directamente en Supabase, lo cargamos
    if (jugadorData && jugadorData.avatar && typeof jugadorData.avatar === 'object') {
      perfil.avatar = jugadorData.avatar;
      perfil.configuroAvatar = true;
    }

    // Si hay partida en Supabase, los datos del servidor mandan
    if (partidaData) {
      perfil.mejor = Number(partidaData.puntaje) || 0;
      perfil.drenador = Boolean(partidaData.vencio_drenador);
      perfil.partidas = Math.max(perfil.partidas || 0, 1);
      perfil.yaJugo = true;
      if (partidaData.dificultad) {
        perfil.difPref = partidaData.dificultad;
      }
      if (partidaData.avatar && typeof partidaData.avatar === 'object' && !perfil.avatar) {
        perfil.avatar = partidaData.avatar;
        perfil.configuroAvatar = true;
      }
    } else {
      // SI NO HAY PARTIDA EN SUPABASE: los puntajes y victorias están en 0
      perfil.mejor = 0;
      perfil.drenador = false;
      perfil.partidas = 0;
      perfil.yaJugo = false;
      perfil.run = null;
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
  if (!CONFIG.RESULTADOS_URL) {
    return { ok: true, localOnly: true, msg: 'Puntaje guardado en este equipo.' };
  }

  try {
    // 1. Verificar si ya existe una partida para esta cédula (solo 1 oportunidad por jugador)
    const checkUrl =
      CONFIG.RESULTADOS_URL +
      (CONFIG.RESULTADOS_URL.includes('?') ? '&' : '?') +
      'cedula=eq.' +
      encodeURIComponent(payload.cedula) +
      '&select=id,puntaje';
    const checkRes = await fetch(checkUrl, { headers: cabecerasAPI(token) }).catch(() => null);
    if (checkRes && checkRes.ok) {
      const prev = await checkRes.json().catch(() => []);
      if (Array.isArray(prev) && prev.length > 0) {
        return {
          ok: false,
          yaExiste: true,
          msg: 'Ya completaste tu única oportunidad en esta competencia. No se permiten más intentos.'
        };
      }
    }

    // 2. Insertar la única partida del jugador
    const hdrs = Object.assign({}, cabecerasAPI(token));

    let r = await fetch(CONFIG.RESULTADOS_URL, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify(payload)
    });

    // Si falla porque public.partida no tiene aún la columna avatar (error 400),
    // reintentamos sin el campo avatar para que no se pierda la partida:
    if (!r.ok && r.status === 400 && payload.avatar) {
      const { avatar, ...fallbackPayload } = payload;
      r = await fetch(CONFIG.RESULTADOS_URL, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify(fallbackPayload)
      });
    }

    if (r.ok) {
      return { ok: true, msg: 'Tu puntaje quedó registrado en el ranking oficial.' };
    } else {
      const errTxt = await r.text().catch(() => '');
      console.warn('Error al guardar en Supabase:', r.status, errTxt);
      let msg = 'No se pudo sincronizar con el ranking general. Quedó guardado en este equipo.';
      if (errTxt.includes('oportunidad_agotada') || errTxt.includes('partida_cedula_key') || errTxt.includes('duplicate key')) {
        msg = 'Ya registraste tu única oportunidad en el evento. No se permiten más intentos.';
      } else if (errTxt.includes('puntaje_invalido')) {
        msg = 'El puntaje supera el límite máximo configurado en Supabase (evento.max_puntaje_base).';
      }
      return {
        ok: false,
        msg
      };
    }
  } catch (e) {
    console.warn('Excepción al conectar con Supabase:', e);
    return {
      ok: false,
      msg: 'No se pudo sincronizar con el ranking general. Quedó guardado en este equipo.'
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
