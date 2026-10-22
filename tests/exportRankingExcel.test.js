import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { exportarRankingExcel } from '../src/game/exportRankingExcel.js';

describe('Exportación de Ganadores por Departamento a Excel (.xlsx)', () => {
  test('Exporta exclusivamente los ganadores de cada departamento con columnas nombre, cargo, puntaje, departamento', async () => {
    const mockJugadores = [
      {
        cedula: '1193051330',
        nombre: 'Julian Rosales',
        cargo: 'PRACTICANTE UNIVERSITARIO',
        area: 'PROYECTOS TI',
        puntaje: 28500, // Ganador Proyectos TI
        dificultad: 'dificil',
        logrado_en: '2026-10-20T10:00:00Z'
      },
      {
        cedula: '1004567890',
        nombre: 'Carlos Perez',
        cargo: 'DESARROLLADOR JUNIOR',
        area: 'PROYECTOS TI',
        puntaje: 21500, // Segundo lugar Proyectos TI (NO DEBE SALIR)
        dificultad: 'facil',
        logrado_en: '2026-10-22T09:00:00Z'
      },
      {
        cedula: '1085268734',
        nombre: 'Maria Gomez',
        cargo: 'ANALISTA DE SELECCION',
        area: 'GESTIÓN HUMANA',
        puntaje: 24000, // Ganadora Gestión Humana
        dificultad: 'media',
        logrado_en: '2026-10-21T11:00:00Z'
      },
      {
        cedula: '1085339941',
        nombre: 'Hector Villota',
        cargo: 'TECNICO OPERATIVO',
        area: 'OPERACIONES',
        puntaje: 26200, // Ganador Operaciones
        dificultad: 'dificil',
        logrado_en: '2026-10-21T15:00:00Z'
      }
    ];

    const resultado = await exportarRankingExcel({
      jugadoresData: mockJugadores,
      descargar: false
    });

    assert.equal(resultado.ok, true);
    // Solo deben salir 3 ganadores (1 por cada uno de los 3 departamentos: Proyectos TI, Operaciones, Gestión Humana)
    assert.equal(resultado.totalGanadores, 3);
    assert(resultado.nombreArchivo.startsWith('Ganadores_Departamentos_SST_'));
    assert(resultado.nombreArchivo.endsWith('.xlsx'));
    assert(resultado.buffer != null && resultado.buffer.byteLength > 0);

    const ws = resultado.workbook.getWorksheet('Ganadores por Departamento');
    assert(ws != null, 'Debe existir la hoja "Ganadores por Departamento"');

    // Verificar nombres de columnas en la fila 1
    const headers = ws.getRow(1).values.filter(Boolean);
    assert.deepEqual(headers, ['Nombre', 'Cargo', 'Puntaje', 'Departamento']);

    // Extraer filas de datos
    const filas = [];
    ws.eachRow((r, rowNumber) => {
      if (rowNumber > 1) {
        filas.push(r.values.filter(Boolean));
      }
    });

    assert.equal(filas.length, 3, 'Debe haber exactamente 3 filas de ganadores');

    // Verificar que Carlos Perez (2° de Proyectos TI) NO esté en la lista
    const nombres = filas.map(f => f[0]);
    assert(nombres.includes('Julian Rosales'));
    assert(nombres.includes('Hector Villota'));
    assert(nombres.includes('Maria Gomez'));
    assert(!nombres.includes('Carlos Perez'), 'Carlos Perez no debe estar porque no ganó su departamento');

    // Verificar cargos
    const cargos = filas.map(f => f[1]);
    assert(cargos.includes('Practicante Universitario'));
    assert(cargos.includes('Tecnico Operativo'));
    assert(cargos.some(c => c.toLowerCase() === 'analista de seleccion'));
  });
});
