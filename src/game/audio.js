import { K_SONIDO } from './constants';

let actx = null;
let sonido = true;

try {
  const guardado = localStorage.getItem(K_SONIDO);
  if (guardado !== null) {
    sonido = JSON.parse(guardado);
  }
} catch (e) {
  sonido = true;
}

export function getSonido() {
  return sonido;
}

export function setSonido(val) {
  sonido = !!val;
  try {
    localStorage.setItem(K_SONIDO, JSON.stringify(sonido));
  } catch (e) {}
  return sonido;
}

export function toggleSonido() {
  return setSonido(!sonido);
}

export function activarAudio() {
  try {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (actx.state === 'suspended') {
      actx.resume();
    }
  } catch (e) {
    actx = null;
  }
}

export function tono(f, d = 0.12, tipo = 'sine', vol = 0.07) {
  if (!sonido || !actx) return;
  try {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = tipo;
    o.frequency.value = f;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + d);
  } catch (e) {}
}

export const sfx = {
  nueva: () => tono(880, 0.06, 'triangle', 0.03),
  bien: () => {
    tono(660, 0.09);
    setTimeout(() => tono(990, 0.12), 80);
  },
  mal: () => tono(150, 0.22, 'sawtooth', 0.045),
  trampa: () => {
    tono(420, 0.12, 'square', 0.035);
    setTimeout(() => tono(260, 0.2, 'square', 0.035), 110);
  },
  corte: () => tono(1400, 0.05, 'square', 0.025),
  escudo: () => {
    tono(300, 0.1, 'triangle');
    setTimeout(() => tono(450, 0.14, 'triangle'), 90);
  },
  golpe: () => tono(90, 0.18, 'sawtooth', 0.06),
  recarga: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tono(f, 0.15), i * 110)),
  fin: () => [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tono(f, 0.18, 'triangle'), i * 120)),
  clic: () => tono(520, 0.05, 'triangle', 0.04)
};
