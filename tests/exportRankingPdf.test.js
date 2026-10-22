import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { exportarRankingPDF } from '../src/game/exportRankingPdf.js';

describe('Exportación de Ranking a PDF', () => {
  test('Genera un PDF con las 3 secciones (jugadores, departamentos, jugadores por departamento)', async () => {
    const mockJugadores = [
      {
        cedula: '1193051330',
        nombre: 'Julian Rosales',
        area: 'PROYECTOS TI',
        puntaje: 28500,
        dificultad: 'dificil',
        vencio_drenador: true,
        logrado_en: '2026-10-20T10:00:00Z'
      },
      {
        cedula: '1085268734',
        nombre: 'Maria Gomez',
        area: 'GESTIÓN HUMANA',
        puntaje: 24000,
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

    const mockAreas = [
      { area: 'PROYECTOS TI', participantes: 2, promedio: 25000, mejor: 28500 },
      { area: 'GESTIÓN HUMANA', participantes: 1, promedio: 24000, mejor: 24000 }
    ];

    const mockSession = {
      nombre: 'Julian Rosales',
      cedula: '1193051330',
      token: 'fake-token'
    };

    const resultado = await exportarRankingPDF({
      session: mockSession,
      jugadoresData: mockJugadores,
      areasData: mockAreas,
      deptosData: ['PROYECTOS TI', 'GESTIÓN HUMANA', 'OPERACIONES'],
      eventoData: { nombre: 'Semana SST 2026' },
      descargar: false
    });

    assert.equal(resultado.ok, true);
    assert.equal(resultado.totalParticipantes, 3);
    assert(resultado.totalPaginas >= 3, `Debe tener al menos 3 páginas para las 3 secciones, obtuvo ${resultado.totalPaginas}`);
    assert(resultado.nombreArchivo.startsWith('Ranking_SST_Sistemas_Palacios_'));
    assert(resultado.nombreArchivo.endsWith('.pdf'));
  });
});
