import ExcelJS from 'exceljs';
import {
  obtenerRankingJugadores,
  obtenerRankingAreas,
  obtenerDepartamentosAPI,
  obtenerEvento
} from './api.js';
import { DEPARTAMENTOS_OFICIALES, DIFS } from './constants.js';

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
 * Exporta el ranking completo a un archivo Excel (.xlsx) estructurado en hojas de cálculo:
 * 1. Resumen Ejecutivo de la Competencia
 * 2. Ranking General de Todos los Jugadores
 * 3. Ranking de Departamentos (con Ganador de cada área)
 * 4. Ranking de Jugadores por Departamento (con Ganador destacado de cada área)
 */
export async function exportarRankingExcel({
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

  // 2. Normalizar lista de todos los jugadores
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
    vencioVal: j.vencio_drenador ? 'Sí' : 'No',
    fechaVal: j.logrado_en || j.jugada_en || ''
  }));

  // 3. Agrupar por departamento y definir el ganador de cada área
  const jugadoresPorDeptoMap = new Map();
  jugadoresOrdenados.forEach((j) => {
    const depto = j.areaVal;
    if (!jugadoresPorDeptoMap.has(depto)) {
      jugadoresPorDeptoMap.set(depto, []);
    }
    jugadoresPorDeptoMap.get(depto).push(j);
  });

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
    .sort((a, b) => {
      if (b.promedio !== a.promedio) return b.promedio - a.promedio;
      if (b.participantes !== a.participantes) return b.participantes - a.participantes;
      return a.area.localeCompare(b.area, 'es');
    })
    .map((d, idx) => ({
      ...d,
      posicion: idx + 1
    }));

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

  // 4. Crear libro de trabajo Excel
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistemas Palacios S.A.S. - Batería al 100';
  workbook.lastModifiedBy = session?.nombre || 'Administrador SST';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Estilos corporativos comunes
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF221B47' } // Morado institucional #221B47
  };

  const headerFont = {
    name: 'Segoe UI',
    size: 11,
    bold: true,
    color: { argb: 'FFFFF4E0' } // Crema
  };

  const winnerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEF3C7' } // Ámbar / Oro suave #FEF3C7
  };

  const winnerFont = {
    name: 'Segoe UI',
    size: 10.5,
    bold: true,
    color: { argb: 'FF92400E' } // Ámbar oscuro
  };

  const baseFont = {
    name: 'Segoe UI',
    size: 10
  };

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  // =========================================================================
  // HOJA 1: RESUMEN EJECUTIVO
  // =========================================================================
  const wsResumen = workbook.addWorksheet('Resumen Ejecutivo', {
    views: [{ showGridLines: true }]
  });

  wsResumen.columns = [
    { width: 28 },
    { width: 45 }
  ];

  // Título
  wsResumen.mergeCells('A1:B1');
  const titleCell = wsResumen.getCell('A1');
  titleCell.value = 'SISTEMAS PALACIOS S.A.S. - REPORTE DE RESULTADOS SST 2026';
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = headerFill;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsResumen.getRow(1).height = 32;

  wsResumen.mergeCells('A2:B2');
  const subCell = wsResumen.getCell('A2');
  subCell.value = `Juego Batería al 100 - ${evento?.nombre || 'Semana SST 2026'}`;
  subCell.font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FFD97706' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF30286A' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsResumen.getRow(2).height = 24;

  const totalParticipantes = jugadoresOrdenados.length;
  const totalDeptosConPart = resumenDepartamentos.filter((d) => d.participantes > 0).length;
  const puntajeRecord = jugadoresOrdenados.length > 0 ? jugadoresOrdenados[0].puntosVal : 0;
  const jugadorRecord = jugadoresOrdenados.length > 0 ? jugadoresOrdenados[0].nombreVal : 'Sin partidas';
  const promedioGeneral = totalParticipantes > 0
    ? Math.round(jugadoresOrdenados.reduce((s, j) => s + j.puntosVal, 0) / totalParticipantes)
    : 0;
  const deptoLider = resumenDepartamentos.length > 0 && resumenDepartamentos[0].participantes > 0
    ? resumenDepartamentos[0].area
    : 'N/A';

  const datosResumen = [
    ['Fecha de Emisión', new Date().toLocaleString('es-CO')],
    ['Generado Por', `${session?.nombre || 'Administrador SST'} (C.C. ${session?.cedula || 'N/A'})`],
    ['Criterio Oficial de Ranking', 'Puntaje obtenido en el 2º intento oficial de juego'],
    ['Total Colaboradores Participantes', totalParticipantes],
    ['Departamentos con Participación', `${totalDeptosConPart} de ${resumenDepartamentos.length} áreas`],
    ['Promedio General del Torneo', promedioGeneral],
    ['Puntaje Récord Individual', `${puntajeRecord} pts (${jugadorRecord})`],
    ['Departamento Líder (1° Puesto)', deptoLider]
  ];

  datosResumen.forEach((fila, idx) => {
    const rowNum = idx + 4;
    const r = wsResumen.getRow(rowNum);
    r.values = fila;
    r.height = 22;

    const c1 = wsResumen.getCell(`A${rowNum}`);
    c1.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF221B47' } };
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    c1.border = thinBorder;
    c1.alignment = { vertical: 'middle' };

    const c2 = wsResumen.getCell(`B${rowNum}`);
    c2.font = baseFont;
    c2.border = thinBorder;
    c2.alignment = { vertical: 'middle' };
    if (typeof fila[1] === 'number') {
      c2.numFmt = '#,##0';
    }
  });

  // =========================================================================
  // HOJA 2: RANKING GENERAL DE JUGADORES
  // =========================================================================
  const wsJugadores = workbook.addWorksheet('Ranking Jugadores', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
  });

  wsJugadores.columns = [
    { header: 'Puesto', key: 'puesto', width: 14, style: { alignment: { horizontal: 'center' } } },
    { header: 'Colaborador', key: 'colaborador', width: 34 },
    { header: 'Cédula', key: 'cedula', width: 18, style: { alignment: { horizontal: 'center' } } },
    { header: 'Departamento', key: 'departamento', width: 30 },
    { header: 'Dificultad', key: 'dificultad', width: 16, style: { alignment: { horizontal: 'center' } } },
    { header: '¿Completó Aventura?', key: 'completo', width: 22, style: { alignment: { horizontal: 'center' } } },
    { header: 'Puntaje Oficial', key: 'puntaje', width: 20, style: { alignment: { horizontal: 'right' } } },
    { header: 'Distinción', key: 'distincion', width: 22, style: { alignment: { horizontal: 'center' } } }
  ];

  // Estilo fila de cabecera
  const rJugadoresHead = wsJugadores.getRow(1);
  rJugadoresHead.height = 26;
  rJugadoresHead.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: cell.alignment?.horizontal || 'left' };
  });

  jugadoresOrdenados.forEach((j) => {
    let distincion = 'Participante';
    if (j.posGeneral === 1) distincion = '1° LUGAR (ORO)';
    else if (j.posGeneral === 2) distincion = '2° LUGAR (PLATA)';
    else if (j.posGeneral === 3) distincion = '3° LUGAR (BRONCE)';

    const row = wsJugadores.addRow({
      puesto: `${j.posGeneral}°`,
      colaborador: j.nombreVal,
      cedula: j.cedulaVal,
      departamento: j.areaVal,
      dificultad: j.dificultadVal,
      completo: j.vencioVal,
      puntaje: j.puntosVal,
      distincion
    });

    row.height = 20;
    row.font = baseFont;
    row.getCell('puntaje').numFmt = '#,##0';

    row.eachCell((cell) => {
      cell.border = thinBorder;
      cell.alignment = Object.assign({ vertical: 'middle' }, cell.alignment);
    });

    // Destacar podio general
    if (j.posGeneral === 1) {
      row.eachCell((cell) => {
        cell.fill = winnerFill;
      });
      row.getCell('puesto').font = winnerFont;
      row.getCell('distincion').font = winnerFont;
    } else if (j.posGeneral === 2) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      row.getCell('puesto').font = { ...baseFont, bold: true };
    } else if (j.posGeneral === 3) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
      });
      row.getCell('puesto').font = { ...baseFont, bold: true };
    }
  });

  wsJugadores.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(jugadoresOrdenados.length + 1, 1), column: 8 }
  };

  // =========================================================================
  // HOJA 3: RANKING DE DEPARTAMENTOS
  // =========================================================================
  const wsDeptos = workbook.addWorksheet('Ranking Departamentos', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
  });

  wsDeptos.columns = [
    { header: 'Puesto', key: 'puesto', width: 14, style: { alignment: { horizontal: 'center' } } },
    { header: 'Departamento', key: 'departamento', width: 34 },
    { header: 'Participantes', key: 'participantes', width: 18, style: { alignment: { horizontal: 'center' } } },
    { header: 'Promedio Depto', key: 'promedio', width: 20, style: { alignment: { horizontal: 'right' } } },
    { header: 'Récord Depto', key: 'record', width: 18, style: { alignment: { horizontal: 'right' } } },
    { header: 'Ganador(a) del Departamento', key: 'ganador', width: 34 },
    { header: 'Cédula Ganador', key: 'cedulaGanador', width: 18, style: { alignment: { horizontal: 'center' } } },
    { header: 'Puntaje Ganador', key: 'puntajeGanador', width: 20, style: { alignment: { horizontal: 'right' } } }
  ];

  const rDeptosHead = wsDeptos.getRow(1);
  rDeptosHead.height = 26;
  rDeptosHead.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3A3170' } }; // Secundario
    cell.font = headerFont;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: cell.alignment?.horizontal || 'left' };
  });

  resumenDepartamentos.forEach((d) => {
    const row = wsDeptos.addRow({
      puesto: `${d.posicion}°`,
      departamento: d.area,
      participantes: d.participantes,
      promedio: d.participantes > 0 ? d.promedio : null,
      record: d.participantes > 0 ? d.mejor : null,
      ganador: d.ganador ? d.ganador.nombreVal : 'Sin participantes',
      cedulaGanador: d.ganador ? d.ganador.cedulaVal : '-',
      puntajeGanador: d.ganador ? d.ganador.puntosVal : null
    });

    row.height = 20;
    row.font = baseFont;
    row.getCell('participantes').numFmt = '#,##0';
    if (d.participantes > 0) {
      row.getCell('promedio').numFmt = '#,##0';
      row.getCell('record').numFmt = '#,##0';
      row.getCell('puntajeGanador').numFmt = '#,##0';
    }

    row.eachCell((cell) => {
      cell.border = thinBorder;
      cell.alignment = Object.assign({ vertical: 'middle' }, cell.alignment);
    });

    // Destacar departamento líder
    if (d.posicion === 1 && d.participantes > 0) {
      row.eachCell((cell) => {
        cell.fill = winnerFill;
      });
      row.getCell('puesto').font = winnerFont;
      row.getCell('departamento').font = winnerFont;
      row.getCell('ganador').font = winnerFont;
    }
  });

  wsDeptos.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(resumenDepartamentos.length + 1, 1), column: 8 }
  };

  // =========================================================================
  // HOJA 4: RANKING DE JUGADORES POR DEPARTAMENTO
  // =========================================================================
  const wsJugadoresDepto = workbook.addWorksheet('Jugadores por Depto', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
  });

  wsJugadoresDepto.columns = [
    { header: 'Departamento', key: 'departamento', width: 30 },
    { header: 'Puesto en Depto', key: 'puestoDepto', width: 18, style: { alignment: { horizontal: 'center' } } },
    { header: 'Puesto General', key: 'puestoGeneral', width: 16, style: { alignment: { horizontal: 'center' } } },
    { header: 'Colaborador', key: 'colaborador', width: 32 },
    { header: 'Cédula', key: 'cedula', width: 18, style: { alignment: { horizontal: 'center' } } },
    { header: 'Condición / Reconocimiento', key: 'reconocimiento', width: 26, style: { alignment: { horizontal: 'center' } } },
    { header: 'Dificultad', key: 'dificultad', width: 16, style: { alignment: { horizontal: 'center' } } },
    { header: '¿Completó?', key: 'completo', width: 16, style: { alignment: { horizontal: 'center' } } },
    { header: 'Puntaje', key: 'puntaje', width: 18, style: { alignment: { horizontal: 'right' } } }
  ];

  const rJugDeptoHead = wsJugadoresDepto.getRow(1);
  rJugDeptoHead.height = 26;
  rJugDeptoHead.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }; // Gris pizarra
    cell.font = headerFont;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: cell.alignment?.horizontal || 'left' };
  });

  resumenDepartamentos.forEach((d) => {
    const jgs = d.jugadores || [];

    jgs.forEach((j, idxInterno) => {
      const esGanador = idxInterno === 0;
      let puestoDeptoTxt = `${idxInterno + 1}°`;
      let reconocimiento = 'Participante';

      if (esGanador) {
        puestoDeptoTxt = '1° LUGAR';
        reconocimiento = '★ GANADOR DEL ÁREA ★';
      } else if (idxInterno === 1) {
        puestoDeptoTxt = '2° Puesto';
        reconocimiento = '2° Lugar (Finalista)';
      } else if (idxInterno === 2) {
        puestoDeptoTxt = '3° Puesto';
        reconocimiento = '3° Lugar (Podio)';
      }

      const row = wsJugadoresDepto.addRow({
        departamento: d.area,
        puestoDepto: puestoDeptoTxt,
        puestoGeneral: `#${j.posGeneral}`,
        colaborador: j.nombreVal,
        cedula: j.cedulaVal,
        reconocimiento,
        dificultad: j.dificultadVal,
        completo: j.vencioVal,
        puntaje: j.puntosVal
      });

      row.height = 20;
      row.font = baseFont;
      row.getCell('puntaje').numFmt = '#,##0';

      row.eachCell((cell) => {
        cell.border = thinBorder;
        cell.alignment = Object.assign({ vertical: 'middle' }, cell.alignment);
      });

      // Resaltar con fondo ámbar/oro al GANADOR de cada departamento
      if (esGanador) {
        row.eachCell((cell) => {
          cell.fill = winnerFill;
        });
        row.getCell('puestoDepto').font = winnerFont;
        row.getCell('colaborador').font = winnerFont;
        row.getCell('reconocimiento').font = winnerFont;
      }
    });
  });

  wsJugadoresDepto.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(wsJugadoresDepto.rowCount, 1), column: 9 }
  };

  // 5. Generar archivo y descargar en navegador
  const ahora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fechaStr = `${ahora.getFullYear()}${pad(ahora.getMonth() + 1)}${pad(ahora.getDate())}_${pad(ahora.getHours())}${pad(ahora.getMinutes())}`;
  const nombreArchivo = `Ranking_SST_Sistemas_Palacios_${fechaStr}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();

  if (descargar && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  return {
    ok: true,
    workbook,
    buffer,
    nombreArchivo,
    totalParticipantes,
    totalDeptos: resumenDepartamentos.length
  };
}
