import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { exportarRankingExcel } from '../src/game/exportRankingExcel.js';

describe('Exportación de Ranking a Excel (.xlsx)', () => {
  test('Genera un archivo Excel con las 4 hojas de trabajo requeridas', async () => {
    const mockJugadores = [
      {
        cedula: '1193051330',
        nombre: 'Julian Rosales',
        area: 'PROYECTOS TI',
        puntaje: 28500, // Ganador Proyectos TI
        dificultad: 'dificil',
        vencio_drenador: true,
        logrado_en: '2026-10-20T10:00:00Z'
      },
      {
        cedula: '1085268734',
        nombre: 'Maria Gomez',
        area: 'GESTIÓN HUMANA',
        puntaje: 24000, // Ganadora Gestión Humana
        dificultad: 'media',
        vencio_drenador: false,
        logrado_en: '2026-10-21T11:00:00Z'
      },
      {
        cedula: '1004567890',
        nombre: 'Carlos Perez',
        area: 'PROYECTOS TI',
        puntaje: 21500,
        dificultad: 'facil',
        vencio_drenador: false,
        logrado_en: '2026-10-22T09:00:00Z'
      }
    ];

    const mockSession = {
      nombre: 'Julian Rosales',
      cedula: '1193051330',
      token: 'fake-token'
    };

    const resultado = await exportarRankingExcel({
      session: mockSession,
      jugadoresData: mockJugadores,
      deptosData: ['PROYECTOS TI', 'GESTIÓN HUMANA', 'OPERACIONES'],
      eventoData: { nombre: 'Semana SST 2026' },
      descargar: false
    });

    assert.equal(resultado.ok, true);
    assert.equal(resultado.totalParticipantes, 3);
    assert(resultado.nombreArchivo.startsWith('Ranking_SST_Sistemas_Palacios_'));
    assert(resultado.nombreArchivo.endsWith('.xlsx'));
    assert(resultado.buffer != null && resultado.buffer.byteLength > 0);

    const sheetNames = resultado.workbook.worksheets.map(w => w.name);
    assert.deepEqual(sheetNames, [
      'Resumen Ejecutivo',
      'Ranking Jugadores',
      'Ranking Departamentos',
      'Jugadores por Depto'
    ]);

    // Verificar que en la hoja de Departamentos figure el ganador
    const wsDeptos = resultado.workbook.getWorksheet('Ranking Departamentos');
    const rowsDeptos = [];
    wsDeptos.eachRow((r, i) => {
      if (i > 1) rowsDeptos.push(r.values);
    });

    // Proyectos TI ganador debe ser Julian Rosales
    const filaProyectos = rowsDeptos.find(r => r.includes('PROYECTOS TI'));
    assert(filaProyectos != null);
    assert(filaProyectos.includes('Julian Rosales'));

    // Gestión Humana ganadora debe ser Maria Gomez
    const filaGestion = rowsDeptos.find(r => r.includes('GESTIÓN HUMANA'));
    assert(filaGestion != null);
    assert(filaGestion.includes('Maria Gomez'));
  });
});
