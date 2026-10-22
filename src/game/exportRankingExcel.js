import ExcelJS from 'exceljs';
import {
  obtenerRankingJugadores,
  obtenerDepartamentosAPI,
  cabecerasAPI
} from './api.js';
import { CONFIG, DEPARTAMENTOS_OFICIALES } from './constants.js';

/**
 * Capitaliza nombres y cargos
 */
function capitalizarTexto(n) {
  if (!n) return '';
  const menores = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von']);
  return String(n)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && menores.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Consulta los cargos de los colaboradores registrados en la base de datos
 */
async function obtenerCargosPorCedula(token) {
  try {
    if (!CONFIG.RESULTADOS_URL) return {};
    const baseUrl = CONFIG.RESULTADOS_URL.replace(/\/partida\b/, '/jugador');
    const url = `${baseUrl}?select=cedula,cargo`;
    const res = await fetch(url, { headers: cabecerasAPI(token) });
    if (!res.ok) return {};
    const lista = await res.json();
    const map = {};
    if (Array.isArray(lista)) {
      lista.forEach((item) => {
        if (item.cedula) {
          map[String(item.cedula).trim()] = String(item.cargo || '').trim();
        }
      });
    }
    return map;
  } catch (e) {
    return {};
  }
}

/**
 * Exporta exclusivamente los ganadores de cada departamento a un archivo Excel (.xlsx)
 * con una tabla de 4 columnas:
 * - Nombre
 * - Cargo
 * - Puntaje
 * - Departamento
 */
export async function exportarRankingExcel({
  session = null,
  jugadoresData = null,
  deptosData = null,
  descargar = true
} = {}) {
  const token = session?.token;

  // 1. Obtener jugadores y mapa de cargos en paralelo si no se suministraron
  let jugadores = jugadoresData;
  let cargosMap = {};

  const tareas = [];
  if (!jugadores) {
    tareas.push(
      obtenerRankingJugadores(token).then((r) => {
        jugadores = r.lista || [];
      })
    );
  }
  tareas.push(
    obtenerCargosPorCedula(token).then((map) => {
      cargosMap = map;
    })
  );

  await Promise.all(tareas);
  jugadores = jugadores || [];

  // 2. Agrupar jugadores por departamento y encontrar al ganador de cada uno
  const departamentosMap = new Map();

  jugadores.forEach((j) => {
    const area = String(j.area || '').trim() || 'Sin área';
    if (!departamentosMap.has(area)) {
      departamentosMap.set(area, []);
    }
    const puntos = +(j.puntaje ?? j.puntajeTotal ?? j.puntos ?? 0);
    const cedulaLimpia = j.cedula ? String(j.cedula).trim() : '';
    const cargoRegistrado = j.cargo || cargosMap[cedulaLimpia] || 'Colaborador';

    departamentosMap.get(area).push({
      nombre: capitalizarTexto(j.nombre) || 'Colaborador',
      cargo: capitalizarTexto(cargoRegistrado) || 'Colaborador',
      puntaje: puntos,
      departamento: area,
      fecha: j.logrado_en || j.jugada_en || ''
    });
  });

  // 3. Extraer únicamente el ganador (mejor puntaje) de cada departamento con partidas
  const ganadoresPorDepartamento = [];

  for (const [area, lista] of departamentosMap.entries()) {
    if (!lista || lista.length === 0) continue;

    // Ordenar jugadores de este departamento por puntaje DESC
    lista.sort((a, b) => {
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
      return (a.fecha || '').localeCompare(b.fecha || '');
    });

    const ganador = lista[0];
    ganadoresPorDepartamento.push(ganador);
  }

  // Ordenar la lista de ganadores por puntaje descendente
  ganadoresPorDepartamento.sort((a, b) => b.puntaje - a.puntaje);

  // 4. Construir el libro de Excel con la tabla solicitada
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistemas Palacios S.A.S. - Batería al 100';
  workbook.lastModifiedBy = session?.nombre || 'Administrador SST';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Ganadores por Departamento', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
  });

  // Columnas exactas solicitadas: nombre, cargo, puntaje, departamento
  worksheet.columns = [
    { header: 'Nombre', key: 'nombre', width: 34 },
    { header: 'Cargo', key: 'cargo', width: 32 },
    { header: 'Puntaje', key: 'puntaje', width: 18, style: { alignment: { horizontal: 'right' } } },
    { header: 'Departamento', key: 'departamento', width: 30 }
  ];

  // Estilo de la fila de encabezados
  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF221B47' } // Morado institucional
    };
    cell.font = {
      name: 'Segoe UI',
      size: 11,
      bold: true,
      color: { argb: 'FFFFF4E0' } // Crema
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'medium', color: { argb: 'FFD97706' } }, // Línea ámbar
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
    cell.alignment = { vertical: 'middle', horizontal: cell.alignment?.horizontal || 'left' };
  });

  // Agregar filas de datos con los ganadores
  ganadoresPorDepartamento.forEach((g, idx) => {
    const row = worksheet.addRow({
      nombre: g.nombre,
      cargo: g.cargo,
      puntaje: g.puntaje,
      departamento: g.departamento
    });

    row.height = 21;
    row.font = { name: 'Segoe UI', size: 10 };
    row.getCell('puntaje').numFmt = '#,##0';

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      cell.alignment = Object.assign({ vertical: 'middle' }, cell.alignment);
    });

    // Destacar al ganador #1 general del torneo con fondo oro
    if (idx === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' } // Ámbar suave
        };
      });
      row.getCell('nombre').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF92400E' } };
      row.getCell('puntaje').font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF92400E' } };
    }
  });

  // Habilitar filtros automáticos en la tabla
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(ganadoresPorDepartamento.length + 1, 1), column: 4 }
  };

  // 5. Descargar archivo en el navegador
  const ahora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fechaStr = `${ahora.getFullYear()}${pad(ahora.getMonth() + 1)}${pad(ahora.getDate())}_${pad(ahora.getHours())}${pad(ahora.getMinutes())}`;
  const nombreArchivo = `Ganadores_Departamentos_SST_${fechaStr}.xlsx`;

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
    totalGanadores: ganadoresPorDepartamento.length,
    ganadores: ganadoresPorDepartamento
  };
}
