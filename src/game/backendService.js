/**
 * Servicio Backend para Mecánica de Intentos y Ranking
 *
 * Reglas de negocio:
 * 1. Máximo 2 intentos por usuario (cédula).
 * 2. Primer intento: se guarda para historial/auditoría/estadísticas, pero NO suma ni registra en el ranking.
 * 3. Segundo intento: se guarda y se registra EXCLUSIVAMENTE este puntaje en el ranking.
 * 4. NUNCA se usa MAX(intento1, intento2). El ranking solo toma el puntaje del intento 2.
 * 5. Si intentos >= 2, cualquier intento adicional se rechaza (HTTP 409 CONFLICT).
 * 6. Concurrencia segura: bloqueo por cédula para evitar ejecuciones simultáneas entre pestañas.
 * 7. El backend ignora cualquier parámetro de número de intento enviado por el cliente.
 */

// Almacenamiento en memoria con capacidad de inicialización o hidratación
class AttemptsBackendService {
  constructor() {
    this.users = new Map(); // cedula -> UserAttemptsRecord
    this.auditLogs = [];   // Audit records
    this.locks = new Map(); // cedula -> Promise queue para serialización / bloqueo transaccional
  }

  // Reiniciar estado (útil para pruebas unitarias)
  reset() {
    this.users.clear();
    this.auditLogs = [];
    this.locks.clear();
  }

  // Bloqueo por cédula para evitar condiciones de carrera (concurrencia)
  async _withLock(cedula, fn) {
    const key = String(cedula).trim();
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolveLock;
    const lockPromise = new Promise(resolve => {
      resolveLock = resolve;
    });
    this.locks.set(key, lockPromise);

    try {
      return await fn();
    } finally {
      this.locks.delete(key);
      resolveLock();
    }
  }

  _getUser(ced) {
    let user = this.users.get(ced);
    if (!user && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('b100_perfil_' + ced);
        if (raw) {
          const perfil = JSON.parse(raw);
          const yaJugo = Boolean(perfil.yaJugo || (perfil.intentosUsados ?? 0) >= 2);
          const attemptsUsed = yaJugo ? 2 : Number(perfil.intentosUsados ?? 0);
          if (attemptsUsed > 0 || yaJugo) {
            user = {
              cedula: ced,
              nombre: perfil.nombre || 'Colaborador',
              area: perfil.area || '',
              attemptsUsed,
              firstAttemptScore: perfil.primerIntentoPuntaje ?? null,
              secondAttemptScore: perfil.segundoIntentoPuntaje ?? null,
              rankingScore: perfil.rankingScore ?? null,
              firstAttemptDate: null,
              secondAttemptDate: null,
              dificultad: perfil.difPref || 'media',
              avatar: perfil.avatar || null
            };
            this.users.set(ced, user);
          }
        }
      } catch (_) {}
    }
    return user;
  }

  /**
   * Consultar estado de intentos de un usuario
   */
  async getAttempts(cedula) {
    const ced = String(cedula || '').trim();
    const user = this._getUser(ced);

    if (!user) {
      return {
        found: false,
        cedula: ced,
        attemptsUsed: 0,
        attemptsRemaining: 2,
        firstAttemptScore: null,
        secondAttemptScore: null,
        rankingScore: null,
        firstAttemptDate: null,
        secondAttemptDate: null
      };
    }

    return {
      found: true,
      cedula: user.cedula,
      nombre: user.nombre,
      area: user.area,
      attemptsUsed: user.attemptsUsed,
      attemptsRemaining: Math.max(0, 2 - user.attemptsUsed),
      firstAttemptScore: user.firstAttemptScore,
      secondAttemptScore: user.secondAttemptScore,
      rankingScore: user.rankingScore,
      firstAttemptDate: user.firstAttemptDate,
      secondAttemptDate: user.secondAttemptDate
    };
  }

  /**
   * Registrar intento de partida.
   * Manejo transaccional con bloqueo por usuario.
   * IGNORA cualquier attempt / attemptNumber que venga en payload.
   */
  async registerAttempt(payload) {
    const {
      cedula,
      nombre = 'Colaborador',
      area = '',
      dificultad = 'media',
      puntaje = 0,
      porcentajeAciertos = null,
      vencioDrenador = false,
      capitulos = [],
      avatar = null,
      fechaInicio = null
    } = payload;

    const ced = String(cedula || '').trim();
    if (!ced || !/^[0-9]{5,12}$/.test(ced)) {
      return {
        ok: false,
        status: 400,
        error: 'CEDULA_INVALIDA',
        message: 'Cédula inválida o no proporcionada.'
      };
    }

    const score = Math.max(0, Math.round(Number(puntaje) || 0));
    const now = new Date().toISOString();

    return await this._withLock(ced, async () => {
      let user = this._getUser(ced);

      // Si no existe, inicializar registro
      if (!user) {
        user = {
          cedula: ced,
          nombre,
          area,
          attemptsUsed: 0,
          firstAttemptScore: null,
          secondAttemptScore: null,
          rankingScore: null,
          firstAttemptDate: null,
          secondAttemptDate: null,
          dificultad,
          avatar
        };
        this.users.set(ced, user);
      }

      // VALIDACIÓN ESTRICTA: ¿Ya agotó sus 2 intentos?
      if (user.attemptsUsed >= 2) {
        return {
          ok: false,
          status: 409,
          error: 'CONFLICT',
          message: 'El usuario ya utilizó sus 2 intentos disponibles.',
          attemptsUsed: 2,
          attemptsRemaining: 0
        };
      }

      // El número de intento lo dicta EXCLUSIVAMENTE la base de datos
      const currentAttempt = user.attemptsUsed + 1;

      if (currentAttempt === 1) {
        // --- PRIMER INTENTO ---
        user.attemptsUsed = 1;
        user.firstAttemptScore = score;
        user.firstAttemptDate = now;
        user.nombre = nombre || user.nombre;
        user.area = area || user.area;
        user.dificultad = dificultad;
        user.avatar = avatar || user.avatar;

        // Auditoría
        this.auditLogs.push({
          id: this.auditLogs.length + 1,
          cedula: ced,
          nombre: user.nombre,
          numeroIntento: 1,
          puntaje: score,
          dificultad,
          porcentajeAciertos,
          vencioDrenador,
          cuentaParaRanking: false,
          fechaHoraInicio: fechaInicio,
          fechaHoraFinalizacion: now,
          fechaHoraRegistro: now,
          capitulos,
          avatar
        });

        // El ranking NO se modifica (sigue siendo null)
        return {
          ok: true,
          status: 200,
          attempt: 1,
          score,
          countsForRanking: false,
          attemptsUsed: 1,
          attemptsRemaining: 1,
          firstAttemptScore: score,
          rankingScore: null,
          message: 'Tu primer intento fue completado. Este puntaje no afecta el ranking. Tu segundo intento será tu puntaje oficial.'
        };
      } else if (currentAttempt === 2) {
        // --- SEGUNDO INTENTO ---
        user.attemptsUsed = 2;
        user.secondAttemptScore = score;
        // REGLA FUNDAMENTAL: El rankingScore es EXCLUSIVAMENTE el puntaje del 2do intento
        user.rankingScore = score;
        user.secondAttemptDate = now;
        user.dificultad = dificultad;
        user.avatar = avatar || user.avatar;

        // Auditoría
        this.auditLogs.push({
          id: this.auditLogs.length + 1,
          cedula: ced,
          nombre: user.nombre,
          numeroIntento: 2,
          puntaje: score,
          dificultad,
          porcentajeAciertos,
          vencioDrenador,
          cuentaParaRanking: true,
          fechaHoraInicio: fechaInicio,
          fechaHoraFinalizacion: now,
          fechaHoraRegistro: now,
          capitulos,
          avatar
        });

        return {
          ok: true,
          status: 200,
          attempt: 2,
          score,
          countsForRanking: true,
          attemptsUsed: 2,
          attemptsRemaining: 0,
          firstAttemptScore: user.firstAttemptScore,
          secondAttemptScore: score,
          rankingScore: score,
          message: `Tu puntaje oficial es: ${score}. Este puntaje ha sido registrado en el ranking.`
        };
      } else {
        // Protección adicional contra intento >= 3
        return {
          ok: false,
          status: 409,
          error: 'CONFLICT',
          message: 'El usuario ya utilizó sus 2 intentos disponibles.',
          attemptsUsed: 2,
          attemptsRemaining: 0
        };
      }
    });
  }

  /**
   * Obtener ranking oficial.
   * REGLA: Solo los usuarios que completaron su SEGUNDO INTENTO tienen rankingScore y aparecen en la tabla.
   * El puntaje es estrictamente rankingScore (del segundo intento).
   */
  async getRanking() {
    const list = [];
    for (const user of this.users.values()) {
      if (user.attemptsUsed === 2 && user.rankingScore !== null) {
        list.push({
          cedula: user.cedula,
          nombre: user.nombre,
          area: user.area || 'Sin área',
          puntaje: user.rankingScore,
          dificultad: user.dificultad,
          logradoEn: user.secondAttemptDate
        });
      }
    }

    // Ordenar por puntaje DESC, fecha ASC
    list.sort((a, b) => {
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
      return new Date(a.logradoEn).getTime() - new Date(b.logradoEn).getTime();
    });

    return list.map((item, idx) => ({
      posicion: idx + 1,
      ...item
    }));
  }

  /**
   * Obtener registros de auditoría de un usuario
   */
  async getAudit(cedula) {
    const ced = String(cedula || '').trim();
    return this.auditLogs.filter(a => a.cedula === ced);
  }
}

export const backendService = new AttemptsBackendService();
