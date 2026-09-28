// Sistema de Avatar Pixel Art 100% nativo para Batería al 100
// Diseñado para renderizado en Canvas y React con image-rendering: pixelated

export const TONOS_PIEL = [
  { id: 1, nombre: 'Claro', piel: '#FFDFC4', sombra: '#E0B594' },
  { id: 2, nombre: 'Medio', piel: '#ECC097', sombra: '#C9966B' },
  { id: 3, nombre: 'Moreno', piel: '#C68B59', sombra: '#9E6536' },
  { id: 4, nombre: 'Oscuro', piel: '#8D5524', sombra: '#663B14' }
];

export const COLORES_PELO = [
  { id: 1, nombre: 'Castaño', color: '#4A2A18', sombra: '#2F180B' },
  { id: 2, nombre: 'Negro', color: '#1E1B26', sombra: '#0F0D14' },
  { id: 3, nombre: 'Rubio', color: '#DDB042', sombra: '#A87F1E' },
  { id: 4, nombre: 'Cobrizo', color: '#A6411B', sombra: '#7A280B' },
  { id: 5, nombre: 'Gris', color: '#888899', sombra: '#5D5D6D' }
];

export const ESTILOS_PELO = [
  { id: 'corto', nombre: 'Corto Clásico' },
  { id: 'spiky', nombre: 'Despeinado' },
  { id: 'largo', nombre: 'Melena Larga' },
  { id: 'coleta', nombre: 'Coleta' },
  { id: 'afro', nombre: 'Afro / Rizado' }
];

export const ACCESORIOS = [
  { id: 'diadema', nombre: 'Diadema Contact Center' },
  { id: 'gafas', nombre: 'Gafas de Oficina' },
  { id: 'ninguno', nombre: 'Ninguno' }
];

// Configuración por defecto del avatar del colaborador
export function avatarPorDefecto() {
  return {
    genero: 'm', // 'm' o 'f'
    pielId: 2,
    peloId: 'corto',
    colorPeloId: 1,
    accesorioId: 'diadema'
  };
}

// Uniforme oficial mandatario de Sistemas Palacios
export const UNIFORME = {
  ROJO_CHAQUETA: '#D32F2F',
  ROJO_SOMBRA: '#9E1B1B',
  BLANCO_DETALLE: '#F5F5F5',
  AZUL_JEAN: '#2B4C7E',
  AZUL_SOMBRA: '#1B3255',
  NEGRO_ZAPATO: '#1E1E24',
  GRIS_SUELA: '#454555'
};

/**
 * Dibuja un avatar pixel art en un contexto 2D de Canvas.
 * La ropa es SIEMPRE la oficial: Chaqueta roja, Jean azul, Zapatos negros.
 */
export function drawPixelAvatar(ctx, cx, cy, options = {}) {
  const {
    avatar = avatarPorDefecto(),
    scale = 3,
    postura = 'parado', // 'parado' | 'canasta' | 'sentado' | 'sofa' | 'combate'
    animo = 'normal',   // 'feliz' | 'normal' | 'cansado'
    tiempo = 0,
    anchoCanasta = 0,
    mostrarAura = false
  } = options;

  const pielConf = TONOS_PIEL.find(t => t.id === avatar.pielId) || TONOS_PIEL[1];
  const peloColorConf = COLORES_PELO.find(c => c.id === avatar.colorPeloId) || COLORES_PELO[0];
  const peloEstilo = avatar.peloId || 'corto';
  const accesorio = avatar.accesorioId || 'ninguno';

  const { ROJO_CHAQUETA, ROJO_SOMBRA, BLANCO_DETALLE, AZUL_JEAN, AZUL_SOMBRA, NEGRO_ZAPATO, GRIS_SUELA } = UNIFORME;

  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));

  // Animación sutil de respiración en reposo
  const respiracion = (postura === 'parado' || postura === 'sofa') ? Math.sin(tiempo * 4) * 0.5 : 0;
  const esfuerzo = animo === 'cansado' ? Math.sin(tiempo * 6) * 0.8 : 0;

  const p = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(
      Math.round(x * scale),
      Math.round((y + respiracion + esfuerzo) * scale),
      Math.round(w * scale),
      Math.round(h * scale)
    );
  };

  // Aura de combate para Capítulo 4
  if (postura === 'combate' || mostrarAura) {
    const pulse = Math.sin(tiempo * 6) * 2;
    ctx.beginPath();
    ctx.arc(0, -6 * scale, (16 + pulse) * scale, 0, Math.PI * 2);
    ctx.strokeStyle = animo === 'cansado' ? 'rgba(238, 154, 43, 0.4)' : 'rgba(61, 220, 132, 0.5)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
  }

  // 1. ZAPATOS NEGROS
  if (postura === 'sentado' || postura === 'sofa') {
    p(-6, 6, 4, 3, NEGRO_ZAPATO);
    p(2, 6, 4, 3, NEGRO_ZAPATO);
    p(-6, 8, 4, 1, GRIS_SUELA);
    p(2, 8, 4, 1, GRIS_SUELA);
  } else {
    // Parado / Combate / Canasta
    p(-6, 6, 5, 3, NEGRO_ZAPATO);
    p(1, 6, 5, 3, NEGRO_ZAPATO);
    p(-6, 8, 5, 1, GRIS_SUELA);
    p(1, 8, 5, 1, GRIS_SUELA);
  }

  // 2. PANTALÓN JEAN AZUL
  if (postura === 'sentado' || postura === 'sofa') {
    p(-6, 2, 12, 5, AZUL_JEAN);
    p(-1, 3, 2, 4, AZUL_SOMBRA);
  } else {
    p(-5, 0, 10, 3, AZUL_JEAN); // Cintura
    p(-5, 3, 4, 4, AZUL_JEAN);  // Pierna izquierda
    p(1, 3, 4, 4, AZUL_JEAN);   // Pierna derecha
    p(-1, 3, 2, 4, AZUL_SOMBRA); // Entrepierna sombra
  }

  // 3. CHAQUETA ROJA CORPORATIVA
  p(-6, -8, 12, 9, ROJO_CHAQUETA);
  p(-6, -8, 2, 9, ROJO_SOMBRA); // Sombra lateral
  p(4, -8, 2, 9, ROJO_SOMBRA);
  p(-1, -7, 2, 8, BLANCO_DETALLE); // Cremallera frontal blanca

  // 4. BRAZOS Y MANOS SEGÚN POSTURA
  if (postura === 'canasta') {
    // Brazos levantados sosteniendo la canasta de energía
    p(-8, -13, 3, 8, ROJO_CHAQUETA); // Brazo izq arriba
    p(5, -13, 3, 8, ROJO_CHAQUETA);  // Brazo der arriba
    p(-8, -15, 3, 3, pielConf.piel);  // Mano izq
    p(5, -15, 3, 3, pielConf.piel);   // Mano der

    // Canasta tejida adaptativa
    const canW = Math.max(28, Math.round((anchoCanasta || 84) / scale));
    const halfW = Math.round(canW / 2);
    const basY = -18;

    // Cuerpo de la canasta
    ctx.fillStyle = '#EE9A2B';
    ctx.fillRect(-halfW * scale, basY * scale, canW * scale, 7 * scale);

    // Textura tejida pixel
    ctx.fillStyle = '#C97716';
    for (let xPos = -halfW + 2; xPos < halfW - 2; xPos += 4) {
      ctx.fillRect(xPos * scale, (basY + 1) * scale, 2 * scale, 5 * scale);
    }

    // Borde superior iluminado
    ctx.fillStyle = '#FFD23F';
    ctx.fillRect(-halfW * scale, basY * scale, canW * scale, 2 * scale);

    // Borde inferior sombra
    ctx.fillStyle = '#8F5109';
    ctx.fillRect(-halfW * scale, (basY + 6) * scale, canW * scale, 1 * scale);

    // Asas laterales de agarre
    ctx.fillStyle = '#8F5109';
    ctx.fillRect((-halfW - 2) * scale, (basY + 1) * scale, 2 * scale, 5 * scale);
    ctx.fillRect((halfW) * scale, (basY + 1) * scale, 2 * scale, 5 * scale);

  } else if (postura === 'combate') {
    // Brazos al frente en guardia de energía
    p(-9, -6, 3, 6, ROJO_CHAQUETA);
    p(6, -6, 3, 6, ROJO_CHAQUETA);
    p(-8, -2, 4, 4, pielConf.piel); // Puño izq
    p(4, -2, 4, 4, pielConf.piel);  // Puño der
    // Chispas de energía en los puños
    const spark = Math.sin(tiempo * 10) > 0 ? '#3DDC84' : '#FFD23F';
    p(-9, -3, 2, 2, spark);
    p(7, -3, 2, 2, spark);

  } else if (postura === 'sentado') {
    // Brazos sobre el escritorio / tecleando
    p(-8, -6, 3, 6, ROJO_CHAQUETA);
    p(5, -6, 3, 6, ROJO_CHAQUETA);
    p(-7, 0, 4, 3, pielConf.piel); // Manos tecleando
    p(3, 0, 4, 3, pielConf.piel);

  } else {
    // Parado normal / reposo
    p(-8, -7, 3, 8, ROJO_CHAQUETA);
    p(5, -7, 3, 8, ROJO_CHAQUETA);
    p(-8, 1, 3, 3, pielConf.piel); // Mano izq
    p(5, 1, 3, 3, pielConf.piel);  // Mano der
  }

  // 5. CUELLO Y CABEZA
  p(-2, -9, 4, 2, pielConf.sombra); // Cuello
  p(-6, -17, 12, 9, pielConf.piel); // Cabeza ovalada pixel
  p(-6, -9, 12, 1, pielConf.sombra); // Sombra barbilla

  // 6. OJOS Y EXPRESIÓN
  if (animo === 'feliz') {
    // Ojos cerrados sonrientes en arco ^ ^
    p(-4, -13, 3, 1, '#1A1423');
    p(-4, -14, 1, 1, '#1A1423');
    p(-2, -14, 1, 1, '#1A1423');

    p(1, -13, 3, 1, '#1A1423');
    p(1, -14, 1, 1, '#1A1423');
    p(3, -14, 1, 1, '#1A1423');
    // Sonrisa alegre
    p(-2, -11, 4, 1, '#C24B4B');
  } else if (animo === 'cansado') {
    // Ojos caídos / estresados
    p(-4, -13, 3, 1, '#1A1423');
    p(1, -13, 3, 1, '#1A1423');
    p(-3, -11, 2, 1, '#9E3030'); // Boca preocupada
    // Gota de sudor animada al costado
    const sudorY = -16 + (Math.sin(tiempo * 5) * 1.5);
    p(7, sudorY, 2, 3, '#4FC3F7');
    p(7, sudorY + 2, 3, 1, '#29B6F6');
  } else {
    // Ojos normales pixel art con brillo blanco
    p(-4, -14, 2, 3, '#1A1423');
    p(-4, -14, 1, 1, '#FFFFFF'); // Brillo pupila
    p(2, -14, 2, 3, '#1A1423');
    p(2, -14, 1, 1, '#FFFFFF');
    // Boca neutra
    p(-1, -11, 2, 1, '#B85555');
  }

  // 7. CABELLO SEGÚN ESTILO Y COLOR
  const colP = peloColorConf.color;
  const somP = peloColorConf.sombra;

  if (peloEstilo === 'spiky') {
    // Cabello despeinado / mechones hacia arriba
    p(-7, -20, 14, 4, colP);
    p(-6, -22, 3, 3, colP);
    p(-1, -23, 3, 4, colP);
    p(3, -21, 3, 3, colP);
    p(-7, -18, 2, 5, somP);
    p(5, -18, 2, 5, somP);
  } else if (peloEstilo === 'largo') {
    // Melena larga que cae sobre los hombros
    p(-7, -19, 14, 4, colP);
    p(-7, -18, 3, 11, colP);
    p(4, -18, 3, 11, colP);
    p(-7, -8, 2, 3, somP);
    p(5, -8, 2, 3, somP);
  } else if (peloEstilo === 'coleta') {
    // Cabello recogido con coleta visible
    p(-7, -19, 14, 4, colP);
    p(-7, -18, 2, 4, colP);
    p(5, -18, 2, 4, colP);
    p(6, -17, 3, 7, colP); // Coleta a la derecha
    p(5, -18, 2, 2, '#D32F2F'); // Moña roja corporativa
  } else if (peloEstilo === 'afro') {
    // Cabello rizado / afro redondo
    p(-8, -21, 16, 6, colP);
    p(-8, -17, 3, 6, colP);
    p(5, -17, 3, 6, colP);
    p(-6, -22, 12, 2, somP);
  } else {
    // Corto clásico ordenado
    p(-7, -19, 14, 4, colP);
    p(-7, -18, 2, 5, somP);
    p(5, -18, 2, 5, somP);
    p(-4, -16, 8, 1, colP); // Flequillo
  }

  // 8. ACCESORIOS
  if (accesorio === 'diadema') {
    // Diadema de Contact Center con micrófono verde activo
    p(-7, -19, 14, 2, '#3DDC84'); // Arco de la diadema
    p(-7, -15, 2, 4, '#24140A');  // Auricular izquierdo
    p(5, -15, 2, 4, '#24140A');   // Auricular derecho
    p(5, -12, 1, 3, '#3DDC84');   // Brazo del micrófono
    p(3, -10, 3, 1, animo === 'cansado' ? '#FF5252' : '#3DDC84'); // Micrófono indicador
  } else if (accesorio === 'gafas') {
    // Gafas rectangulares de oficina
    p(-5, -14, 4, 3, 'rgba(79, 195, 247, 0.45)');
    p(1, -14, 4, 3, 'rgba(79, 195, 247, 0.45)');
    p(-6, -14, 12, 1, '#3A2314'); // Marco superior
    p(-5, -12, 4, 1, '#3A2314');
    p(1, -12, 4, 1, '#3A2314');
    p(-1, -13, 2, 1, '#3A2314'); // Puente nasal
  }

  ctx.restore();
}

/**
 * Dibuja el puesto de trabajo del colaborador para el Capítulo 2 (Operaciones)
 */
export function drawPuestoTrabajo(ctx, cx, cy, options = {}) {
  const {
    avatar = avatarPorDefecto(),
    animo = 'normal',
    tiempo = 0,
    nombre = 'TÚ',
    esJugador = true
  } = options;

  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));

  // 1. Silla ergonómica de oficina detrás del avatar
  ctx.fillStyle = '#212121';
  ctx.fillRect(-18, -48, 36, 42); // Respaldo alto
  ctx.fillStyle = '#424242';
  ctx.fillRect(-14, -44, 28, 34); // Acolchado
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(-22, -24, 6, 18);  // Reposabrazo izq
  ctx.fillRect(16, -24, 6, 18);   // Reposabrazo der

  // 2. Avatar sentado en su puesto oficial
  drawPixelAvatar(ctx, 0, -12, {
    avatar,
    scale: 2.6,
    postura: 'sentado',
    animo,
    tiempo
  });

  // 3. Escritorio moderno en primer plano
  const deskW = 90;
  const deskH = 22;
  // Superficie del escritorio
  ctx.fillStyle = '#795548';
  ctx.fillRect(-deskW / 2, 2, deskW, 8);
  ctx.fillStyle = '#A1887F';
  ctx.fillRect(-deskW / 2, 0, deskW, 2); // Borde iluminado
  ctx.fillStyle = '#4E342E';
  ctx.fillRect(-deskW / 2, 10, deskW, 12); // Frontal del escritorio

  // 4. Monitor de computadora corporativo
  ctx.fillStyle = '#37474F';
  ctx.fillRect(-16, -20, 32, 22); // Marco del monitor
  ctx.fillStyle = animo === 'cansado' ? '#FFCDD2' : '#E0F7FA';
  ctx.fillRect(-14, -18, 28, 18); // Pantalla encendida
  // Gráfico de líneas / datos en pantalla
  ctx.fillStyle = animo === 'cansado' ? '#D32F2F' : '#00897B';
  ctx.fillRect(-11, -14, 10, 2);
  ctx.fillRect(-11, -10, 16, 2);
  ctx.fillRect(-11, -6, 22, 2);
  // Soporte monitor
  ctx.fillStyle = '#263238';
  ctx.fillRect(-4, 2, 8, 4);

  // 5. Teclado y mouse
  ctx.fillStyle = '#ECEFF1';
  ctx.fillRect(-12, 3, 24, 4);
  ctx.fillStyle = '#B0BEC5';
  ctx.fillRect(16, 3, 6, 4);

  // 6. Placa con el nombre o "TÚ"
  if (esJugador) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(-22, 12, 44, 13);
    ctx.fillStyle = animo === 'cansado' ? '#FF8A80' : '#80CBC4';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(nombre.toUpperCase().slice(0, 8), 0, 22);
  }

  // 7. Si el avatar está cansado, mostrar aviso visual
  if (animo === 'cansado') {
    ctx.fillStyle = '#FF5252';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ Batería Baja!', 0, -56);
  }

  ctx.restore();
}

/**
 * Dibuja el sofá de descanso para el Capítulo 3 (La Casa)
 */
export function drawSofaCasa(ctx, cx, cy, options = {}) {
  const {
    avatar = avatarPorDefecto(),
    animo = 'feliz',
    tiempo = 0
  } = options;

  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));

  // 1. Respaldo del sofá acogedor
  ctx.fillStyle = '#3E2723';
  ctx.fillRect(-44, -30, 88, 36);
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(-40, -28, 80, 32);

  // Cojines traseros
  ctx.fillStyle = '#795548';
  ctx.fillRect(-38, -26, 36, 26);
  ctx.fillRect(2, -26, 36, 26);

  // 2. Avatar sentado cómodamente en el centro del sofá
  drawPixelAvatar(ctx, 0, -4, {
    avatar,
    scale: 2.8,
    postura: 'sofa',
    animo,
    tiempo
  });

  // 3. Asiento acolchado del sofá (frente)
  ctx.fillStyle = '#4E342E';
  ctx.fillRect(-46, 6, 92, 16);
  ctx.fillStyle = '#6D4C41';
  ctx.fillRect(-44, 4, 88, 4); // Borde acolchado

  // 4. Brazos laterales del sofá
  ctx.fillStyle = '#3E2723';
  ctx.fillRect(-52, -18, 10, 38);
  ctx.fillRect(42, -18, 10, 38);
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(-50, -20, 8, 8); // Cojín reposabrazo izq
  ctx.fillRect(42, -20, 8, 8);  // Cojín reposabrazo der

  // 5. Patas de madera
  ctx.fillStyle = '#1B0000';
  ctx.fillRect(-42, 22, 6, 6);
  ctx.fillRect(36, 22, 6, 6);

  // 6. Detalle: Taza de té o café humeante en la mesita
  ctx.fillStyle = '#FFECB3';
  ctx.fillRect(36, -8, 8, 9);
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(37, -7, 6, 2); // Café dentro
  // Humo animado sutil
  const vaporY = Math.sin(tiempo * 4) * 2;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(39, -13 + vaporY, 2, 3);

  ctx.restore();
}

/**
 * Genera un DataURL del avatar en PNG para usar directamente en etiquetas <img> o CSS
 */
export function generarAvatarDataUrl(avatarConfig, tamaño = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = tamaño;
  canvas.height = tamaño;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const scale = tamaño / 28;
  drawPixelAvatar(ctx, tamaño / 2, tamaño * 0.65, {
    avatar: avatarConfig,
    scale,
    postura: 'parado',
    animo: 'feliz'
  });

  return canvas.toDataURL('image/png');
}
