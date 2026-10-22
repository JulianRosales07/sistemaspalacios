import { jsPDF as jsPDFNamed } from 'jspdf';
import * as jspdfLib from 'jspdf';
import autoTableLib from 'jspdf-autotable';
import {
  obtenerRankingJugadores,
  obtenerRankingAreas,
  obtenerDepartamentosAPI,
  obtenerEvento
} from './api.js';
import { DEPARTAMENTOS_OFICIALES, DIFS } from './constants.js';

const jsPDF = jsPDFNamed || jspdfLib.jsPDF || jspdfLib.default;
const autoTable = typeof autoTableLib === 'function' ? autoTableLib : (autoTableLib.autoTable || autoTableLib.default);

/**
 * Elimina emojis y caracteres unicode fuera del rango estándar de WinAnsi / Latin1
 * para evitar corrupción de texto (mojibake como Ø>ÝG) en fuentes estándar de jsPDF.
 */
function sanitizarTextoPDF(str) {
  if (str == null) return '';
  return String(str)
    // Eliminar pares suplentes de emojis (U+10000 a U+10FFFF)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    // Eliminar símbolos misceláneos y dingbats
    .replace(/[\u2600-\u27BF]/g, '')
    // Eliminar área de uso privado
    .replace(/[\uE000-\uF8FF]/g, '')
    // Eliminar caracteres de variación y control
    .replace(/[\uFE00-\uFE0F]/g, '')
    .trim();
}

/**
 * Formatea un número con separadores de miles estilo colombiano
 */
function fmtNum(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('es-CO');
}

/**
 * Nombre legible de la dificultad
 */
function nombreDif(d) {
  if (!d) return 'Media';
  const k = String(d).toLowerCase().trim();
  return DIFS[k] ? DIFS[k].nombre : (d.charAt(0).toUpperCase() + d.slice(1));
}

/**
 * Capitaliza nombres de personas de forma estética
 */
function capitalizarNombre(n) {
  if (!n) return 'Colaborador';
  const limpio = sanitizarTextoPDF(n);
  const menores = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von']);
  return limpio
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && menores.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Prepara el logo corporativo para incrustar en el PDF convirtiéndolo a PNG
 * mediante un canvas HTML en el navegador para máxima compatibilidad con jsPDF.
 */
async function prepararLogoParaPDF(logoSrc) {
  if (!logoSrc || typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width || 504;
          const h = img.naturalHeight || img.height || 160;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const pngDataUrl = canvas.toDataURL('image/png');
          resolve({
            dataUrl: pngDataUrl,
            aspectRatio: w / h,
            width: w,
            height: h
          });
        } catch (err) {
          resolve({
            dataUrl: logoSrc,
            aspectRatio: 3.15,
            width: 504,
            height: 160
          });
        }
      };

      img.onerror = () => {
        resolve(null);
      };

      img.src = logoSrc;
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Genera y descarga el reporte en PDF con los 3 rankings:
 * 1. Ranking de todos los jugadores que participaron (sin emojis corruptos)
 * 2. Ranking de departamentos (indicando el ganador de cada departamento)
 * 3. Ranking de jugadores por departamento (indicando claramente quién ganó en cada área)
 */
export async function exportarRankingPDF({
  session = null,
  jugadoresData = null,
  areasData = null,
  deptosData = null,
  eventoData = null,
  logoUrl = null,
  descargar = true
} = {}) {
  const token = session?.token;

  // Cargar logo corporativo automáticamente si no fue provisto
  let logoUrlFinal = logoUrl;
  if (!logoUrlFinal && typeof window !== 'undefined') {
    try {
      const mod = await import('../assets/logo.webp');
      logoUrlFinal = mod.default || mod;
    } catch (e) {
      logoUrlFinal = null;
    }
  }
  const logoInfo = await prepararLogoParaPDF(logoUrlFinal);

  // 1. Cargar datos necesarios en paralelo si no se suministraron
  let jugadores = jugadoresData;
  let areas = areasData;
  let deptosAPI = deptosData;
  let evento = eventoData;

  const tareas = [];
  if (!jugadores) {
    tareas.push(
      obtenerRankingJugadores(token).then((r) => {
        jugadores = r.lista || [];
      })
    );
  }
  if (!areas) {
    tareas.push(
      obtenerRankingAreas(token).then((r) => {
        areas = r.lista || [];
      })
    );
  }
  if (!deptosAPI) {
    tareas.push(
      obtenerDepartamentosAPI().then((r) => {
        deptosAPI = r && r.length > 0 ? r : DEPARTAMENTOS_OFICIALES;
      })
    );
  }
  if (!evento) {
    tareas.push(
      obtenerEvento(token).then((ev) => {
        evento = ev;
      }).catch(() => {})
    );
  }

  if (tareas.length > 0) {
    await Promise.all(tareas);
  }

  jugadores = jugadores || [];
  areas = areas || [];
  deptosAPI = deptosAPI || DEPARTAMENTOS_OFICIALES;

  // 2. Normalizar lista de todos los jugadores con posición
  // Ordenar por puntaje DESC, luego por fecha ASC
  const jugadoresOrdenados = [...jugadores].sort((a, b) => {
    const ptsA = +(a.puntaje ?? a.puntajeTotal ?? a.puntos ?? 0);
    const ptsB = +(b.puntaje ?? b.puntajeTotal ?? b.puntos ?? 0);
    if (ptsB !== ptsA) return ptsB - ptsA;
    const fA = a.logrado_en || a.jugada_en || '';
    const fB = b.logrado_en || b.jugada_en || '';
    return fA.localeCompare(fB);
  }).map((j, idx) => ({
    ...j,
    posGeneral: idx + 1,
    puntosVal: +(j.puntaje ?? j.puntajeTotal ?? j.puntos ?? 0),
    areaVal: sanitizarTextoPDF(String(j.area || '').trim()) || 'Sin área',
    nombreVal: capitalizarNombre(j.nombre),
    cedulaVal: j.cedula ? sanitizarTextoPDF(String(j.cedula).trim()) : 'N/A',
    dificultadVal: nombreDif(j.dificultad),
    vencioVal: j.vencio_drenador ? 'Sí' : 'No'
  }));

  // 3. Estructurar Departamentos
  // Agrupar jugadores por departamento
  const jugadoresPorDeptoMap = new Map();
  jugadoresOrdenados.forEach((j) => {
    const depto = j.areaVal;
    if (!jugadoresPorDeptoMap.has(depto)) {
      jugadoresPorDeptoMap.set(depto, []);
    }
    jugadoresPorDeptoMap.get(depto).push(j);
  });

  // Asegurar departamentos oficiales en la lista
  const todosDeptosSet = new Set([
    ...deptosAPI.map((d) => sanitizarTextoPDF(d)),
    ...DEPARTAMENTOS_OFICIALES.map((d) => sanitizarTextoPDF(d)),
    ...Array.from(jugadoresPorDeptoMap.keys())
  ]);

  const resumenDepartamentos = Array.from(todosDeptosSet)
    .filter((d) => d && d.toLowerCase() !== 'sin área')
    .map((nombreDepto) => {
      const jgs = jugadoresPorDeptoMap.get(nombreDepto) || [];
      const participantes = jgs.length;
      const ptsList = jgs.map((j) => j.puntosVal);
      const promedio = participantes > 0
        ? Math.round(ptsList.reduce((acc, p) => acc + p, 0) / participantes)
        : 0;
      const mejor = participantes > 0 ? Math.max(...ptsList) : 0;
      // Colaboradores de este depto ordenados por puntaje DESC
      const jgsOrdenados = [...jgs].sort((a, b) => b.puntosVal - a.puntosVal);
      const ganador = jgsOrdenados.length > 0 ? jgsOrdenados[0] : null;

      return {
        area: nombreDepto,
        participantes,
        promedio,
        mejor,
        ganador,
        jugadores: jgsOrdenados
      };
    })
    // Ordenar departamentos por promedio DESC, luego por participantes DESC, luego alfabéticamente
    .sort((a, b) => {
      if (b.promedio !== a.promedio) return b.promedio - a.promedio;
      if (b.participantes !== a.participantes) return b.participantes - a.participantes;
      return a.area.localeCompare(b.area, 'es');
    })
    .map((d, idx) => ({
      ...d,
      posicion: idx + 1
    }));

  // Si hay colaboradores "Sin área", agregarlos al final si existen
  if (jugadoresPorDeptoMap.has('Sin área') && jugadoresPorDeptoMap.get('Sin área').length > 0) {
    const jgs = jugadoresPorDeptoMap.get('Sin área');
    const ptsList = jgs.map((j) => j.puntosVal);
    const jgsOrdenados = [...jgs].sort((a, b) => b.puntosVal - a.puntosVal);
    resumenDepartamentos.push({
      posicion: resumenDepartamentos.length + 1,
      area: 'Sin área asignada',
      participantes: jgs.length,
      promedio: Math.round(ptsList.reduce((acc, p) => acc + p, 0) / jgs.length),
      mejor: Math.max(...ptsList),
      ganador: jgsOrdenados[0] || null,
      jugadores: jgsOrdenados
    });
  }

  // 4. Estadísticas Globales
  const totalParticipantes = jugadoresOrdenados.length;
  const totalDeptosConParticipantes = resumenDepartamentos.filter((d) => d.participantes > 0).length;
  const puntajeRecord = jugadoresOrdenados.length > 0 ? jugadoresOrdenados[0].puntosVal : 0;
  const jugadorRecord = jugadoresOrdenados.length > 0 ? jugadoresOrdenados[0].nombreVal : 'Sin partidas';
  const deptoLider = resumenDepartamentos.length > 0 && resumenDepartamentos[0].participantes > 0
    ? resumenDepartamentos[0].area
    : 'N/A';
  const promedioGeneral = totalParticipantes > 0
    ? Math.round(jugadoresOrdenados.reduce((s, j) => s + j.puntosVal, 0) / totalParticipantes)
    : 0;

  // 5. Instanciar documento PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  // Paleta de Colores Corporativos
  const cPrimario = [34, 27, 71];      // #221B47 - Morado institucional
  const cSecundario = [58, 49, 112];   // #3A3170
  const cDorado = [217, 119, 6];       // #D97706 - Ámbar / Oro
  const cTextoOscuro = [30, 41, 59];    // #1E293B - Gris pizarra
  const cTextoClaro = [100, 116, 139]; // #64748B - Gris neutro
  const cFondoGris = [248, 250, 252];  // #F8FAFC
  const cBordeGris = [226, 232, 240];  // #E2E8F0
  const cBlanco = [255, 255, 255];

  // Fecha y hora de generación
  const ahora = new Date();
  const fechaGeneracion = ahora.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const horaGeneracion = ahora.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  let currentY = 16;

  // ==========================================
  // ENCABEZADO PRINCIPAL (PORTADA / REPORTE)
  // ==========================================

  // Barra superior decorativa
  doc.setFillColor(...cPrimario);
  doc.rect(0, 0, pageWidth, 5, 'F');
  doc.setFillColor(...cDorado);
  doc.rect(0, 5, pageWidth, 1.5, 'F');

  currentY = 14;

  // Si el logo de la empresa está disponible, renderizarlo en la esquina superior derecha
  if (logoInfo?.dataUrl) {
    try {
      const logoW = 44; // ancho en mm
      const logoH = logoW / (logoInfo.aspectRatio || 3.15); // ~14 mm
      const logoX = pageWidth - marginX - logoW;
      const logoY = 10;
      doc.addImage(logoInfo.dataUrl, 'PNG', logoX, logoY, logoW, logoH);
    } catch (e) {
      console.warn('No se pudo incrustar el logo en la portada:', e);
    }
  }

  // Encabezado de la empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...cDorado);
  doc.text('SISTEMAS PALACIOS S.A.S. - SEGURIDAD Y SALUD EN EL TRABAJO', marginX, currentY);

  currentY += 5.5;
  doc.setFontSize(16.5);
  doc.setTextColor(...cPrimario);
  doc.text('REPORTE OFICIAL DE RANKING Y RESULTADOS', marginX, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...cTextoClaro);
  const nombreEvento = sanitizarTextoPDF(evento?.nombre || 'Semana SST 2026');
  doc.text(`Juego "Bateria al 100" - ${nombreEvento}`, marginX, currentY);

  currentY += 7.5;

  // Cuadro de Resumen Ejecutivo / Metadatos
  const metaBoxY = currentY;
  const metaBoxHeight = 36;
  doc.setFillColor(...cFondoGris);
  doc.setDrawColor(...cBordeGris);
  doc.roundedRect(marginX, metaBoxY, contentWidth, metaBoxHeight, 3, 3, 'FD');

  // Borde lateral dorado
  doc.setFillColor(...cDorado);
  doc.roundedRect(marginX, metaBoxY, 2.5, metaBoxHeight, 1.2, 1.2, 'F');

  // Metadatos en 2 columnas
  const col1X = marginX + 6;
  const col2X = marginX + (contentWidth / 2) + 4;
  let metaY = metaBoxY + 7;

  doc.setFontSize(8.5);

  // Fila 1
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...cPrimario);
  doc.text('Fecha de emision:', col1X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...cTextoOscuro);
  doc.text(`${fechaGeneracion} a las ${horaGeneracion}`, col1X + 27, metaY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...cPrimario);
  doc.text('Total participantes:', col2X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...cTextoOscuro);
  doc.text(`${fmtNum(totalParticipantes)} colaboradores con partida`, col2X + 29, metaY);

  metaY += 6;

  // Fila 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...cPrimario);
  doc.text('Generado por:', col1X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...cTextoOscuro);
  const adminNombre = capitalizarNombre(session?.nombre || 'Administrador SST');
  const adminCedula = session?.cedula ? `(C.C. ${sanitizarTextoPDF(session.cedula)})` : '';
  doc.text(`${adminNombre} ${adminCedula}`, col1X + 23, metaY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...cPrimario);
  doc.text('Deptos participantes:', col2X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...cTextoOscuro);
  doc.text(`${totalDeptosConParticipantes} de ${resumenDepartamentos.length} departamentos`, col2X + 33, metaY);

  metaY += 6;

  // Fila 3
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...cPrimario);
  doc.text('Criterio oficial:', col1X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...cTextoOscuro);
  doc.text('Puntaje del 2º intento oficial de juego', col1X + 23, metaY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...cPrimario);
  doc.text('Promedio general:', col2X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...cTextoOscuro);
  doc.text(`${fmtNum(promedioGeneral)} puntos`, col2X + 29, metaY);

  metaY += 6;

  // Fila 4
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...cPrimario);
  doc.text('Depto lider:', col1X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...cTextoOscuro);
  doc.text(`${deptoLider}`, col1X + 19, metaY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...cPrimario);
  doc.text('Record individual:', col2X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...cTextoOscuro);
  doc.text(`${fmtNum(puntajeRecord)} pts (${jugadorRecord})`, col2X + 29, metaY);

  currentY = metaBoxY + metaBoxHeight + 8;

  // ==========================================
  // SECCIÓN 1: RANKING GENERAL DE JUGADORES
  // ==========================================

  const renderTituloSeccion = (numSec, titulo, subtitulo) => {
    doc.setFillColor(...cPrimario);
    doc.roundedRect(marginX, currentY, contentWidth, 7.5, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...cBlanco);
    doc.text(`SECCION ${numSec}: ${titulo.toUpperCase()}`, marginX + 4, currentY + 5.2);

    currentY += 10.5;
    if (subtitulo) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...cTextoClaro);
      doc.text(subtitulo, marginX, currentY);
      currentY += 4.5;
    }
  };

  renderTituloSeccion(
    '1',
    'Ranking General de Jugadores Participantes',
    'Listado oficial de todos los colaboradores clasificados por su puntaje definitivo en la competencia:'
  );

  const tablaJugadoresBody = jugadoresOrdenados.length > 0
    ? jugadoresOrdenados.map((j) => {
        let posTxt = `${j.posGeneral}°`;
        if (j.posGeneral === 1) posTxt = '1° (ORO)';
        else if (j.posGeneral === 2) posTxt = '2° (PLATA)';
        else if (j.posGeneral === 3) posTxt = '3° (BRONCE)';

        return [
          posTxt,
          j.nombreVal,
          j.cedulaVal,
          j.areaVal,
          j.dificultadVal,
          j.vencioVal,
          fmtNum(j.puntosVal)
        ];
      })
    : [['-', 'No se registran partidas aun', '-', '-', '-', '-', '0']];

  autoTable(doc, {
    startY: currentY,
    head: [['Puesto', 'Colaborador', 'Cedula', 'Departamento', 'Dificultad', '¿Completo?', 'Puntaje']],
    body: tablaJugadoresBody,
    theme: 'striped',
    margin: { left: marginX, right: marginX, top: 22, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: cTextoOscuro,
      cellPadding: 2,
      valign: 'middle'
    },
    headStyles: {
      fillColor: cPrimario,
      textColor: [255, 244, 224],
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [247, 248, 252]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 44, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'left', cellWidth: 40 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 20, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.row.index === 0) {
          data.cell.styles.fillColor = [254, 243, 199]; // Oro suave
          if (data.column.index === 0) {
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fontStyle = 'bold';
          }
        } else if (data.row.index === 1) {
          data.cell.styles.fillColor = [241, 245, 249]; // Plata suave
          if (data.column.index === 0) {
            data.cell.styles.textColor = [71, 85, 105];
            data.cell.styles.fontStyle = 'bold';
          }
        } else if (data.row.index === 2) {
          data.cell.styles.fillColor = [255, 237, 213]; // Bronce suave
          if (data.column.index === 0) {
            data.cell.styles.textColor = [194, 65, 12];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    }
  });

  // ==========================================
  // SECCIÓN 2: RANKING DE DEPARTAMENTOS
  // ==========================================

  // Forzar inicio de la sección 2 en nueva página para presentación impecable
  doc.addPage();
  currentY = 22;

  renderTituloSeccion(
    '2',
    'Ranking General por Departamentos',
    'Clasificacion por dependencias de Sistemas Palacios ordenada por puntaje promedio, incluyendo el ganador de cada area:'
  );

  const tablaDeptosBody = resumenDepartamentos.map((d) => {
    const posTxt = `${d.posicion}°`;
    const ganadorTxt = d.ganador
      ? `${d.ganador.nombreVal} (${fmtNum(d.mejor)} pts)`
      : 'Sin participantes';

    return [
      posTxt,
      d.area,
      fmtNum(d.participantes),
      d.participantes > 0 ? fmtNum(d.promedio) : '-',
      d.participantes > 0 ? fmtNum(d.mejor) : '-',
      ganadorTxt
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Puesto', 'Departamento', 'Participantes', 'Promedio Depto', 'Record Depto', 'Ganador(a) del Area']],
    body: tablaDeptosBody,
    theme: 'striped',
    margin: { left: marginX, right: marginX, top: 22, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: 8.2,
      textColor: cTextoOscuro,
      cellPadding: 2.3,
      valign: 'middle'
    },
    headStyles: {
      fillColor: cSecundario,
      textColor: [255, 244, 224],
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [247, 248, 252]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 48, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'left', cellWidth: 56, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.row.index === 0) {
          data.cell.styles.fillColor = [254, 243, 199];
          if (data.column.index === 0 || data.column.index === 5) {
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    }
  });

  // ==========================================
  // SECCIÓN 3: RANKING DE JUGADORES POR DEPARTAMENTO
  // ==========================================

  doc.addPage();
  currentY = 22;

  renderTituloSeccion(
    '3',
    'Ranking Detallado de Jugadores por Departamento',
    'Desglose departamento por departamento identificando claramente al ganador de cada area y la posicion de todos sus colaboradores:'
  );

  const deptosParaListar = resumenDepartamentos;

  for (let dIdx = 0; dIdx < deptosParaListar.length; dIdx++) {
    const d = deptosParaListar[dIdx];
    const listaJgs = d.jugadores || [];

    // Validar espacio restante en la página
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 22;
    }

    // Cabecera institucional del departamento
    doc.setFillColor(...cFondoGris);
    doc.setDrawColor(...cSecundario);
    doc.roundedRect(marginX, currentY, contentWidth, 7.5, 1.5, 1.5, 'FD');

    // Borde izquierdo distintivo
    doc.setFillColor(...cSecundario);
    doc.rect(marginX, currentY, 2.5, 7.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...cPrimario);
    doc.text(`DEPARTAMENTO: ${d.area.toUpperCase()}`, marginX + 5, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...cTextoClaro);
    const resumenTxt = d.participantes > 0
      ? `${d.participantes} participante${d.participantes > 1 ? 's' : ''}  |  Promedio: ${fmtNum(d.promedio)} pts  |  Record: ${fmtNum(d.mejor)} pts`
      : 'Sin partidas registradas aun';
    doc.text(resumenTxt, pageWidth - marginX - 4, currentY + 5, { align: 'right' });

    currentY += 9.5;

    if (listaJgs.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...cTextoClaro);
      doc.text('No hay colaboradores registrados en este departamento para la presente edicion.', marginX + 4, currentY + 2);
      currentY += 9;
    } else {
      // Recuadro destacado: QUIÉN GANÓ EL DEPARTAMENTO
      const ganador = d.ganador;
      if (ganador) {
        doc.setFillColor(254, 243, 199); // Fondo oro suave
        doc.setDrawColor(217, 119, 6);   // Borde ámbar
        doc.roundedRect(marginX, currentY, contentWidth, 7, 1.2, 1.2, 'FD');

        doc.setFillColor(217, 119, 6);
        doc.roundedRect(marginX, currentY, 2.5, 7, 1, 1, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setTextColor(180, 83, 9);
        doc.text('GANADOR(A) DEL DEPARTAMENTO:', marginX + 5, currentY + 4.8);

        doc.setTextColor(34, 27, 71);
        doc.text(`${ganador.nombreVal}`, marginX + 58, currentY + 4.8);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const infoGanador = `(C.C. ${ganador.cedulaVal})  -  ${fmtNum(ganador.puntosVal)} pts  [Puesto General #${ganador.posGeneral}]`;
        doc.text(infoGanador, marginX + 58 + doc.getTextWidth(`${ganador.nombreVal}  `), currentY + 4.8);

        currentY += 9.5;
      }

      // Filas de colaboradores del departamento
      const filasDepto = listaJgs.map((j, idxInterno) => {
        let puestoDeptoTxt = `${idxInterno + 1}°`;
        let reconocimiento = 'Participante';

        if (idxInterno === 0) {
          puestoDeptoTxt = '1° LUGAR';
          reconocimiento = 'GANADOR DEL AREA';
        } else if (idxInterno === 1) {
          puestoDeptoTxt = '2° Puesto';
          reconocimiento = '2° Lugar (Finalista)';
        } else if (idxInterno === 2) {
          puestoDeptoTxt = '3° Puesto';
          reconocimiento = '3° Lugar (Podio)';
        }

        return [
          puestoDeptoTxt,
          `#${j.posGeneral}`,
          j.nombreVal,
          j.cedulaVal,
          reconocimiento,
          j.dificultadVal,
          j.vencioVal,
          fmtNum(j.puntosVal)
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Puesto Depto', 'Puesto General', 'Colaborador', 'Cedula', 'Reconocimiento', 'Dificultad', '¿Completo?', 'Puntaje']],
        body: filasDepto,
        theme: 'striped',
        margin: { left: marginX, right: marginX, top: 22, bottom: 18 },
        styles: {
          font: 'helvetica',
          fontSize: 7.6,
          textColor: cTextoOscuro,
          cellPadding: 1.8,
          valign: 'middle'
        },
        headStyles: {
          fillColor: [71, 85, 105], // Gris pizarra elegante
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [248, 249, 252]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
          1: { halign: 'center', cellWidth: 18 },
          2: { halign: 'left', cellWidth: 42, fontStyle: 'bold' },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 32, fontStyle: 'bold' },
          5: { halign: 'center', cellWidth: 16 },
          6: { halign: 'center', cellWidth: 16 },
          7: { halign: 'right', cellWidth: 18, fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === 0) {
            // Fila del ganador del departamento con tono dorado distintivo
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [34, 27, 71];
            if (data.column.index === 0 || data.column.index === 4) {
              data.cell.styles.textColor = [180, 83, 9];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      currentY = doc.lastAutoTable.finalY + 8;
    }
  }

  // ==========================================
  // PIE DE PÁGINA Y ENCABEZADOS RECURRENTES
  // ==========================================

  const totalPaginas = doc.internal.getNumberOfPages();

  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);

    // Encabezado recurrente solo en páginas > 1
    if (i > 1) {
      doc.setFillColor(...cPrimario);
      doc.rect(0, 0, pageWidth, 3, 'F');

      let offsetDerecha = 0;
      if (logoInfo?.dataUrl) {
        try {
          const miniLogoW = 24;
          const miniLogoH = miniLogoW / (logoInfo.aspectRatio || 3.15);
          doc.addImage(logoInfo.dataUrl, 'PNG', pageWidth - marginX - miniLogoW, 5.5, miniLogoW, miniLogoH);
          offsetDerecha = 28;
        } catch (e) {}
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...cTextoClaro);
      doc.text('SISTEMAS PALACIOS S.A.S. - REPORTE OFICIAL DE RANKING Y RESULTADOS SST', marginX, 10);
      doc.text(`Generado: ${fechaGeneracion}`, pageWidth - marginX - offsetDerecha, 10, { align: 'right' });

      doc.setDrawColor(...cBordeGris);
      doc.setLineWidth(0.3);
      doc.line(marginX, 13.5, pageWidth - marginX, 13.5);
    }

    // Pie de página en todas las páginas
    doc.setDrawColor(...cBordeGris);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...cTextoClaro);
    doc.text('Documento Oficial de Resultados - Bateria al 100 - Uso Interno Corporativo', marginX, pageHeight - 7);
    doc.text(`Pagina ${i} de ${totalPaginas}`, pageWidth - marginX, pageHeight - 7, { align: 'right' });
  }

  // 6. Nombre de archivo con marca de tiempo
  const pad = (n) => String(n).padStart(2, '0');
  const fechaStr = `${ahora.getFullYear()}${pad(ahora.getMonth() + 1)}${pad(ahora.getDate())}_${pad(ahora.getHours())}${pad(ahora.getMinutes())}`;
  const nombreArchivo = `Ranking_SST_Sistemas_Palacios_${fechaStr}.pdf`;

  // Descarga directa en el navegador si está habilitada
  if (descargar && typeof doc.save === 'function') {
    doc.save(nombreArchivo);
  }

  return {
    ok: true,
    doc,
    nombreArchivo,
    totalPaginas,
    totalParticipantes,
    totalDeptos: resumenDepartamentos.length
  };
}
