import { K_SES, K_PERF, K_RANK, INSIGNIAS } from './constants.js';
import { avatarPorDefecto } from './pixelAvatar.js';

export function ls(key, defaultValue) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

export function lsDel(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}

export function getSesion() {
  return ls(K_SES, null);
}

export function setSesion(ses) {
  if (ses) {
    lsSet(K_SES, ses);
  } else {
    lsDel(K_SES);
  }
}

export function perfilVacio() {
  return {
    partidas: 0,
    intentosUsados: 0,
    intentosRestantes: 2,
    primerIntentoPuntaje: null,
    segundoIntentoPuntaje: null,
    rankingScore: null,
    yaJugo: false,
    mejor: 0,
    capMax: 0,
    vioIntro: false,
    difPref: 'media',
    tutos: {},
    drenador: false,
    cont: { no: 0, interv: 0, cortes: 0, trampas: 0, pausas: 0 },
    run: null,
    avatar: avatarPorDefecto(),
    configuroAvatar: false,
    ultimoIntento: null
  };
}

export function puedeJugar(perfil) {
  if (!perfil) return false;
  const usados = Number(perfil.intentosUsados ?? (perfil.yaJugo ? 2 : perfil.partidas ?? 0));
  return usados < 2;
}

export function haJugado(perfil) {
  if (!perfil) return false;
  const usados = Number(perfil.intentosUsados ?? (perfil.yaJugo ? 2 : 0));
  return Boolean(usados >= 2 || (perfil.yaJugo && perfil.intentosUsados === undefined));
}

export function intentosDisponibles(perfil) {
  if (!perfil) return 2;
  const usados = Number(perfil.intentosUsados ?? (perfil.yaJugo ? 2 : 0));
  return Math.max(0, 2 - usados);
}

export function cargarPerfil(cedula) {
  if (!cedula) return perfilVacio();
  const base = perfilVacio();
  const guardado = ls(K_PERF + cedula, {});
  const merged = Object.assign(base, guardado);
  merged.cont = Object.assign(perfilVacio().cont, guardado.cont || {});
  merged.tutos = guardado.tutos || {};
  if (!merged.avatar) merged.avatar = avatarPorDefecto();
  if (merged.configuroAvatar === undefined) {
    merged.configuroAvatar = Boolean((merged.intentosUsados || 0) > 0 || merged.partidas > 0 || merged.yaJugo);
  }
  // Asegurar coherencia de intentos
  if (merged.intentosUsados === undefined) {
    merged.intentosUsados = merged.yaJugo ? 2 : (merged.partidas > 0 ? 1 : 0);
  }
  merged.intentosRestantes = Math.max(0, 2 - merged.intentosUsados);
  merged.yaJugo = merged.intentosUsados >= 2;
  return merged;
}

export function guardarPerfil(cedula, perfil) {
  if (!cedula || !perfil) return;
  lsSet(K_PERF + cedula, perfil);
}

export function contarAccion(cedula, perfil, key, n = 1) {
  if (!perfil) return;
  perfil.cont[key] = (perfil.cont[key] || 0) + n;
  if (cedula) guardarPerfil(cedula, perfil);
}

export function getInsigniasGanadas(perfil) {
  if (!perfil) return new Set();
  return new Set(INSIGNIAS.filter(i => i[4](perfil)).map(i => i[0]));
}

export function getRunActual(perfil) {
  return perfil?.run || {
    cap: 0,
    bateria: 100,
    puntos: 0,
    resultados: [],
    victoria: false,
    dif: perfil?.difPref || 'media'
  };
}

export function getLocalRanking() {
  return ls(K_RANK, []).slice().sort((a, b) => b.puntos - a.puntos);
}

export function guardarLocalRanking(record) {
  const rk = getLocalRanking();
  const idx = rk.findIndex(x => x.cedula === record.cedula);
  if (idx >= 0) {
    rk[idx] = record;
  } else {
    rk.push(record);
  }
  rk.sort((a, b) => b.puntos - a.puntos);
  lsSet(K_RANK, rk.slice(0, 50));
  return rk;
}
