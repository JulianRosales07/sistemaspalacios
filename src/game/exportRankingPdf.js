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
 * Capitaliza nombres de personas
 */
function capitalizarNombre(n) {
  if (!n) return 'Colaborador';
  const menores = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von']);
  return String(n)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && menores.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Genera y descarga el reporte en PDF con los 3 rankings:
 * 1. Ranking de todos los jugadores que participaron
 * 2. Ranking de departamentos
 * 3. Ranking de jugadores por departamento
 */
export async function exportarRankingPDF({
  session = null,
  jugadoresData = null,
  areasData = null,
  deptosData = null,
  eventoData = null,
  descargar = true
} = {}) {
  const token = session?.token;

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
    areaVal: String(j.area || '').trim() || 'Sin área',
    nombreVal: capitalizarNombre(j.nombre),
    cedulaVal: j.cedula ? String(j.cedula).trim() : 'N/A',
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
    ...deptosAPI,
    ...DEPARTAMENTOS_OFICIALES,
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

      return {
        area: nombreDepto,
        participantes,
        promedio,
        mejor,
        jugadores: jgs
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

  // Si hay colaboradores "Sin área", agregarlos también si existen
  if (jugadoresPorDeptoMap.has('Sin área') && jugadoresPorDeptoMap.get('Sin área').length > 0) {
    const jgs = jugadoresPorDeptoMap.get('Sin área');
    const ptsList = jgs.map((j) => j.puntosVal);
    resumenDepartamentos.push({
      posicion: resumenDepartamentos.length + 1,
      area: 'Sin área asignada',
      participantes: jgs.length,
      promedio: Math.round(ptsList.reduce((acc, p) => acc + p, 0) / jgs.length),
      mejor: Math.max(...ptsList),
      jugadores: jgs
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

  // Paleta de Colores
  const cPrimario = [34, 27, 71];      // #221B47 - Morado profundo institucional
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

  currentY = 16;

  // Encabezado de la empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...cDorado);
  doc.text('SISTEMAS PALACIOS S.A.S. • SEGURIDAD Y SALUD EN EL TRABAJO', marginX, currentY);

  currentY += 6;
  doc.setFontSize(18);
  doc.setTextColor(...cPrimario);
  doc.text('REPORTE OFICIAL DE RANKING Y RESULTADOS', marginX, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...cTextoClaro);
  const nombreEvento = evento?.nombre || 'Semana SST 2026';
  doc.text(`Juego "Batería al 100" • ${nombreEvento}`, marginX, currentY);

  currentY += 8;

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
  doc.text('Fecha de emisión:', col1X, metaY);
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
  const adminNombre = session?.nombre || 'Administrador SST';
  const adminCedula = session?.cedula ? `(C.C. ${session.cedula})` : '';
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
  doc.text('Depto líder:', col1X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...cTextoOscuro);
  doc.text(`${deptoLider}`, col1X + 19, metaY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...cPrimario);
  doc.text('Récord individual:', col2X, metaY);
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
    doc.text(`SECCIÓN ${numSec}: ${titulo.toUpperCase()}`, marginX + 4, currentY + 5.2);

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
    'Listado oficial de todos los colaboradores ordenados por su puntaje definitivo en la competencia:'
  );

  const tablaJugadoresBody = jugadoresOrdenados.length > 0
    ? jugadoresOrdenados.map((j) => {
        let posTxt = `#${j.posGeneral}`;
        if (j.posGeneral === 1) posTxt = '🥇 #1';
        else if (j.posGeneral === 2) posTxt = '🥈 #2';
        else if (j.posGeneral === 3) posTxt = '🥉 #3';

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
    : [['-', 'No se registran partidas aún', '-', '-', '-', '-', '0']];

  autoTable(doc, {
    startY: currentY,
    head: [['Puesto', 'Colaborador', 'Cédula', 'Departamento', 'Dificultad', '¿Completó?', 'Puntaje']],
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
      0: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 44, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'left', cellWidth: 42 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 20, fontStyle: 'bold' }
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
    'Clasificación por dependencias de Sistemas Palacios, ordenada por el promedio de puntajes:'
  );

  const tablaDeptosBody = resumenDepartamentos.map((d) => {
    let posTxt = `#${d.posicion}`;
    if (d.posicion === 1 && d.participantes > 0) posTxt = '🥇 #1';
    else if (d.posicion === 2 && d.participantes > 0) posTxt = '🥈 #2';
    else if (d.posicion === 3 && d.participantes > 0) posTxt = '🥉 #3';

    const estadoParticipacion = d.participantes > 0
      ? `${d.participantes} jugador${d.participantes > 1 ? 'es' : ''}`
      : 'Sin participantes';

    return [
      posTxt,
      d.area,
      fmtNum(d.participantes),
      d.participantes > 0 ? fmtNum(d.promedio) : '-',
      d.participantes > 0 ? fmtNum(d.mejor) : '-',
      estadoParticipacion
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Puesto', 'Departamento', 'Participantes', 'Promedio Depto', 'Récord Depto', 'Estado']],
    body: tablaDeptosBody,
    theme: 'striped',
    margin: { left: marginX, right: marginX, top: 22, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: cTextoOscuro,
      cellPadding: 2.4,
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
      0: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 62, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'center', cellWidth: 26 }
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
    'Desglose departamento por departamento con el listado de sus colaboradores y posiciones individuales:'
  );

  // Iterar por cada departamento ordenado según su mérito
  const deptosParaListar = resumenDepartamentos;

  for (let dIdx = 0; dIdx < deptosParaListar.length; dIdx++) {
    const d = deptosParaListar[dIdx];
    const listaJgs = d.jugadores || [];

    // Validar espacio restante en la página
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 22;
    }

    // Cabecera del departamento
    doc.setFillColor(...cFondoGris);
    doc.setDrawColor(...cSecundario);
    doc.roundedRect(marginX, currentY, contentWidth, 7, 1.5, 1.5, 'FD');

    // Borde izquierdo distintivo
    doc.setFillColor(...cSecundario);
    doc.rect(marginX, currentY, 2, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...cPrimario);
    doc.text(`🏢 ${d.area.toUpperCase()}`, marginX + 5, currentY + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...cTextoClaro);
    const resumenTxt = d.participantes > 0
      ? `${d.participantes} participante${d.participantes > 1 ? 's' : ''}  |  Promedio: ${fmtNum(d.promedio)} pts  |  Récord: ${fmtNum(d.mejor)} pts`
      : 'Sin partidas registradas aún';
    doc.text(resumenTxt, pageWidth - marginX - 4, currentY + 4.8, { align: 'right' });

    currentY += 9;

    if (listaJgs.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...cTextoClaro);
      doc.text('No hay colaboradores registrados en este departamento para la presente edición.', marginX + 4, currentY + 2);
      currentY += 8;
    } else {
      // Ordenar colaboradores de este depto por puntaje DESC
      const jgsDeptoOrdenados = [...listaJgs].sort((a, b) => b.puntosVal - a.puntosVal);

      const filasDepto = jgsDeptoOrdenados.map((j, idxInterno) => {
        let medalla = `#${idxInterno + 1}`;
        if (idxInterno === 0) medalla = '🥇 #1';
        else if (idxInterno === 1) medalla = '🥈 #2';
        else if (idxInterno === 2) medalla = '🥉 #3';

        return [
          medalla,
          `#${j.posGeneral}`,
          j.nombreVal,
          j.cedulaVal,
          j.dificultadVal,
          j.vencioVal,
          fmtNum(j.puntosVal)
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Puesto Depto', 'Puesto General', 'Colaborador', 'Cédula', 'Dificultad', '¿Completó?', 'Puntaje']],
        body: filasDepto,
        theme: 'striped',
        margin: { left: marginX, right: marginX, top: 22, bottom: 18 },
        styles: {
          font: 'helvetica',
          fontSize: 7.8,
          textColor: cTextoOscuro,
          cellPadding: 1.8,
          valign: 'middle'
        },
        headStyles: {
          fillColor: [71, 85, 105], // Slate gray
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [248, 249, 252]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'left', cellWidth: 50, fontStyle: 'bold' },
          3: { halign: 'center', cellWidth: 26 },
          4: { halign: 'center', cellWidth: 24 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'right', cellWidth: 22, fontStyle: 'bold' }
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

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...cTextoClaro);
      doc.text('SISTEMAS PALACIOS S.A.S. • REPORTE OFICIAL DE RANKING Y RESULTADOS SST', marginX, 10);
      doc.text(`Generado: ${fechaGeneracion}`, pageWidth - marginX, 10, { align: 'right' });

      doc.setDrawColor(...cBordeGris);
      doc.setLineWidth(0.3);
      doc.line(marginX, 12, pageWidth - marginX, 12);
    }

    // Pie de página en todas las páginas
    doc.setDrawColor(...cBordeGris);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...cTextoClaro);
    doc.text('Documento Oficial de Resultados • Batería al 100 • Uso Interno Corporativo', marginX, pageHeight - 7);
    doc.text(`Página ${i} de ${totalPaginas}`, pageWidth - marginX, pageHeight - 7, { align: 'right' });
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
