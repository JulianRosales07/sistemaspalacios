import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { backendService } from '../src/game/backendService.js';
import { perfilVacio, puedeJugar, haJugado } from '../src/game/storage.js';

describe('Mecánica de 2 Intentos y Ranking Oficial', () => {
  beforeEach(() => {
    backendService.reset();
  });

  test('Caso 1: Usuario nuevo realiza primer intento con 800 puntos', async () => {
    const cedula = '10000001';

    // Estado inicial
    const estadoInicial = await backendService.getAttempts(cedula);
    assert.strictEqual(estadoInicial.attemptsUsed, 0);
    assert.strictEqual(estadoInicial.attemptsRemaining, 2);

    // Ejecución intento 1 con 800 puntos
    const resp = await backendService.registerAttempt({
      cedula,
      nombre: 'Carlos Perez',
      area: 'OPERACIONES',
      puntaje: 800
    });

    assert.strictEqual(resp.ok, true);
    assert.strictEqual(resp.attempt, 1);
    assert.strictEqual(resp.score, 800);
    assert.strictEqual(resp.countsForRanking, false);
    assert.strictEqual(resp.attemptsUsed, 1);
    assert.strictEqual(resp.attemptsRemaining, 1);
    assert.strictEqual(resp.firstAttemptScore, 800);
    assert.strictEqual(resp.rankingScore, null);

    // Validar estado persistido en el backend
    const estadoActual = await backendService.getAttempts(cedula);
    assert.strictEqual(estadoActual.firstAttemptScore, 800);
    assert.strictEqual(estadoActual.attemptsUsed, 1);
    assert.strictEqual(estadoActual.rankingScore, null);

    // El ranking NO debe mostrar al usuario ni los 800 puntos
    const ranking = await backendService.getRanking();
    const enRanking = ranking.find(r => r.cedula === cedula);
    assert.strictEqual(enRanking, undefined, 'El usuario del intento 1 no debe aparecer en el ranking');
  });

  test('Caso 2: El mismo usuario realiza segundo intento con 500 puntos', async () => {
    const cedula = '10000002';

    // Intento 1: 800 pts
    await backendService.registerAttempt({
      cedula,
      nombre: 'Maria Gomez',
      area: 'LOGÍSTICA',
      puntaje: 800
    });

    // Intento 2: 500 pts
    const resp2 = await backendService.registerAttempt({
      cedula,
      nombre: 'Maria Gomez',
      area: 'LOGÍSTICA',
      puntaje: 500
    });

    assert.strictEqual(resp2.ok, true);
    assert.strictEqual(resp2.attempt, 2);
    assert.strictEqual(resp2.score, 500);
    assert.strictEqual(resp2.countsForRanking, true);
    assert.strictEqual(resp2.attemptsUsed, 2);
    assert.strictEqual(resp2.attemptsRemaining, 0);
    assert.strictEqual(resp2.firstAttemptScore, 800);
    assert.strictEqual(resp2.secondAttemptScore, 500);
    assert.strictEqual(resp2.rankingScore, 500);

    // Validar estado persistido
    const estado = await backendService.getAttempts(cedula);
    assert.strictEqual(estado.firstAttemptScore, 800);
    assert.strictEqual(estado.secondAttemptScore, 500);
    assert.strictEqual(estado.rankingScore, 500);
    assert.strictEqual(estado.attemptsUsed, 2);

    // En el ranking oficial debe aparecer con 500 puntos
    const ranking = await backendService.getRanking();
    const enRanking = ranking.find(r => r.cedula === cedula);
    assert.ok(enRanking, 'El usuario debe aparecer en el ranking');
    assert.strictEqual(enRanking.puntaje, 500, 'El ranking debe mostrar 500 puntos');
  });

  test('Caso 3: Primer intento menor que el segundo (400 vs 900) -> Ranking = 900', async () => {
    const cedula = '10000003';

    await backendService.registerAttempt({ cedula, nombre: 'Ana Lopez', puntaje: 400 });
    const resp2 = await backendService.registerAttempt({ cedula, nombre: 'Ana Lopez', puntaje: 900 });

    assert.strictEqual(resp2.rankingScore, 900);

    const ranking = await backendService.getRanking();
    const entry = ranking.find(r => r.cedula === cedula);
    assert.strictEqual(entry.puntaje, 900);
  });

  test('Caso 4: Primer intento mayor que el segundo (1000 vs 300) -> Ranking = 300 (NO MAX)', async () => {
    const cedula = '10000004';

    // Intento 1 con puntaje alto (1000)
    await backendService.registerAttempt({ cedula, nombre: 'Pedro Ramos', puntaje: 1000 });
    // Intento 2 con puntaje menor (300)
    const resp2 = await backendService.registerAttempt({ cedula, nombre: 'Pedro Ramos', puntaje: 300 });

    assert.strictEqual(resp2.rankingScore, 300);
    assert.strictEqual(resp2.firstAttemptScore, 1000);
    assert.strictEqual(resp2.secondAttemptScore, 300);

    const ranking = await backendService.getRanking();
    const entry = ranking.find(r => r.cedula === cedula);
    assert.strictEqual(entry.puntaje, 300, 'El ranking debe ser 300, NUNCA 1000');
  });

  test('Caso 5: Usuario intenta jugar una tercera vez -> Debe rechazarse con 409 CONFLICT', async () => {
    const cedula = '10000005';

    // 2 intentos válidos
    await backendService.registerAttempt({ cedula, puntaje: 600 });
    await backendService.registerAttempt({ cedula, puntaje: 700 });

    // Intento 3: debe ser rechazado
    const resp3 = await backendService.registerAttempt({ cedula, puntaje: 950 });

    assert.strictEqual(resp3.ok, false);
    assert.strictEqual(resp3.status, 409);
    assert.strictEqual(resp3.error, 'CONFLICT');
    assert.strictEqual(resp3.message, 'El usuario ya utilizó sus 2 intentos disponibles.');
    assert.strictEqual(resp3.attemptsUsed, 2);
    assert.strictEqual(resp3.attemptsRemaining, 0);

    // El ranking no debe haber cambiado
    const ranking = await backendService.getRanking();
    const entry = ranking.find(r => r.cedula === cedula);
    assert.strictEqual(entry.puntaje, 700);
  });

  test('Caso 6: Usuario recarga la aplicación después del primer intento', async () => {
    const cedula = '10000006';

    // Usuario juega intento 1
    await backendService.registerAttempt({ cedula, puntaje: 750 });

    // Simular recarga: consulta limpia al backend por cédula
    const estadoRecarga = await backendService.getAttempts(cedula);

    assert.strictEqual(estadoRecarga.attemptsUsed, 1);
    assert.strictEqual(estadoRecarga.attemptsRemaining, 1);
    assert.strictEqual(estadoRecarga.firstAttemptScore, 750);
    assert.strictEqual(estadoRecarga.rankingScore, null);

    // Mapear al perfil frontend
    const perfil = perfilVacio();
    perfil.intentosUsados = estadoRecarga.attemptsUsed;
    perfil.intentosRestantes = estadoRecarga.attemptsRemaining;
    perfil.primerIntentoPuntaje = estadoRecarga.firstAttemptScore;
    perfil.rankingScore = estadoRecarga.rankingScore;
    perfil.yaJugo = estadoRecarga.attemptsUsed >= 2;

    assert.strictEqual(perfil.intentosUsados, 1);
    assert.strictEqual(perfil.intentosRestantes, 1);
    assert.strictEqual(puedeJugar(perfil), true, 'Debe permitir jugar el segundo intento');
    assert.strictEqual(haJugado(perfil), false, 'No debe considerarse agotado');
  });

  test('Caso 7: Usuario recarga después del segundo intento -> 2 utilizados, 0 disponibles, no permitir jugar', async () => {
    const cedula = '10000007';

    await backendService.registerAttempt({ cedula, puntaje: 850 });
    await backendService.registerAttempt({ cedula, puntaje: 920 });

    // Simular recarga
    const estadoRecarga = await backendService.getAttempts(cedula);

    assert.strictEqual(estadoRecarga.attemptsUsed, 2);
    assert.strictEqual(estadoRecarga.attemptsRemaining, 0);
    assert.strictEqual(estadoRecarga.rankingScore, 920);

    // Mapear al perfil frontend
    const perfil = perfilVacio();
    perfil.intentosUsados = estadoRecarga.attemptsUsed;
    perfil.intentosRestantes = estadoRecarga.attemptsRemaining;
    perfil.primerIntentoPuntaje = estadoRecarga.firstAttemptScore;
    perfil.segundoIntentoPuntaje = estadoRecarga.secondAttemptScore;
    perfil.rankingScore = estadoRecarga.rankingScore;
    perfil.yaJugo = estadoRecarga.attemptsUsed >= 2;

    assert.strictEqual(perfil.intentosUsados, 2);
    assert.strictEqual(perfil.intentosRestantes, 0);
    assert.strictEqual(puedeJugar(perfil), false, 'No debe permitir jugar');
    assert.strictEqual(haJugado(perfil), true, 'Debe considerarse agotado');
  });

  test('Caso 8: Frontend manipula attemptNumber -> Backend lo ignora y usa la DB', async () => {
    const cedula = '10000008';

    // Intento malicioso 1: el usuario intenta engañar al backend diciendo que es el intento 2
    const resp1 = await backendService.registerAttempt({
      cedula,
      puntaje: 850,
      attemptNumber: 2, // Manipulado por el frontend
      attempt: 2,
      countsForRanking: true
    });

    // El backend ignora la manipulación y detecta que en la DB attemptsUsed era 0 -> Procesado como intento 1
    assert.strictEqual(resp1.attempt, 1, 'Debe ser tratado como intento 1');
    assert.strictEqual(resp1.countsForRanking, false);
    assert.strictEqual(resp1.rankingScore, null);

    // El ranking NO debe tener registro
    const ranking1 = await backendService.getRanking();
    assert.strictEqual(ranking1.find(r => r.cedula === cedula), undefined);

    // Intento malicioso 2: el usuario intenta decir que sigue siendo intento 1
    const resp2 = await backendService.registerAttempt({
      cedula,
      puntaje: 710,
      attemptNumber: 1, // Manipulado
      attempt: 1
    });

    // El backend consulta la DB donde attemptsUsed es 1 -> Procesa como intento 2 oficial
    assert.strictEqual(resp2.attempt, 2, 'Debe ser tratado como intento 2');
    assert.strictEqual(resp2.countsForRanking, true);
    assert.strictEqual(resp2.rankingScore, 710);

    const ranking2 = await backendService.getRanking();
    const entry = ranking2.find(r => r.cedula === cedula);
    assert.strictEqual(entry.puntaje, 710);
  });

  test('Seguridad y Concurrencia: Peticiones simultáneas desde múltiples pestañas', async () => {
    const cedula = '10000009';

    // Intento 1 ya realizado
    await backendService.registerAttempt({ cedula, puntaje: 500 });

    // Dos peticiones disparadas simultáneamente compitiendo por registrar el segundo intento
    const [p1, p2] = await Promise.all([
      backendService.registerAttempt({ cedula, puntaje: 650 }),
      backendService.registerAttempt({ cedula, puntaje: 670 })
    ]);

    // Exactamente una debe haber triunfado y la otra debe haber sido rechazada con 409
    const exitosas = [p1, p2].filter(p => p.ok);
    const rechazadas = [p1, p2].filter(p => !p.ok);

    assert.strictEqual(exitosas.length, 1, 'Solo una petición debe ganar la carrera');
    assert.strictEqual(rechazadas.length, 1, 'La petición sobrante debe ser rechazada');
    assert.strictEqual(rechazadas[0].status, 409);
    assert.strictEqual(rechazadas[0].error, 'CONFLICT');

    // Estado final en base de datos debe ser exactamente 2 intentos usados
    const finalState = await backendService.getAttempts(cedula);
    assert.strictEqual(finalState.attemptsUsed, 2);
  });

  test('Auditoría: Registro inmutable para cada intento realizado', async () => {
    const cedula = '10000010';

    await backendService.registerAttempt({
      cedula,
      nombre: 'Lucia Diaz',
      dificultad: 'dificil',
      puntaje: 920,
      porcentajeAciertos: 90,
      vencioDrenador: true
    });

    await backendService.registerAttempt({
      cedula,
      nombre: 'Lucia Diaz',
      dificultad: 'media',
      puntaje: 780,
      porcentajeAciertos: 80,
      vencioDrenador: false
    });

    const logs = await backendService.getAudit(cedula);
    assert.strictEqual(logs.length, 2, 'Deben existir 2 registros de auditoría');

    // Registro 1
    assert.strictEqual(logs[0].numeroIntento, 1);
    assert.strictEqual(logs[0].puntaje, 920);
    assert.strictEqual(logs[0].cuentaParaRanking, false);
    assert.strictEqual(logs[0].dificultad, 'dificil');

    // Registro 2
    assert.strictEqual(logs[1].numeroIntento, 2);
    assert.strictEqual(logs[1].puntaje, 780);
    assert.strictEqual(logs[1].cuentaParaRanking, true);
    assert.strictEqual(logs[1].dificultad, 'media');
  });
});
