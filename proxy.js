const http = require('http');

const PORT = process.env.PORT || 3001;

const server = http.createServer(async (req, res) => {
  // Configuración de cabeceras CORS permisivas
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Responder a peticiones preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Página de comprobación de estado si entran directamente desde el navegador
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Proxy Activo - Sistemas Palacios</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #1a1433; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #2a2352; padding: 2.5rem; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 500px; text-align: center; }
          h2 { color: #3ddc84; margin-top: 0; }
          code { background: #150f2e; padding: 4px 8px; border-radius: 6px; color: #4fc3f7; font-size: 0.95rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>⚡ Proxy Local Activo</h2>
          <p>El proxy de desarrollo para Sistemas Palacios está funcionando y listo para recibir peticiones sin problemas de CORS.</p>
          <p>Endpoint disponible:<br><br><code>http://localhost:${PORT}/api/employees/active-basic/{cedula}</code></p>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Almacenamiento en memoria para gestión de intentos y ranking en proxy local
  if (!global._attemptsStore) {
    global._attemptsStore = new Map();
    global._auditLogs = [];
  }

  // Endpoint: Registrar Intento
  if ((req.url === '/api/attempts/register' || req.url === '/api/partida') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const cedula = String(payload.cedula || '').replace(/\D/g, '').trim();
        if (!cedula) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Cédula requerida' }));
          return;
        }

        let user = global._attemptsStore.get(cedula);
        if (!user) {
          user = {
            cedula,
            nombre: payload.nombre || 'Colaborador',
            area: payload.area || '',
            attemptsUsed: 0,
            firstAttemptScore: null,
            secondAttemptScore: null,
            rankingScore: null,
            dificultad: payload.dificultad || 'media'
          };
          global._attemptsStore.set(cedula, user);
        }

        // Rechazo inmediato si ya agotó sus 2 intentos
        if (user.attemptsUsed >= 2) {
          res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            ok: false,
            error: 'CONFLICT',
            message: 'El usuario ya utilizó sus 2 intentos disponibles.',
            attemptsUsed: 2,
            attemptsRemaining: 0
          }));
          return;
        }

        const score = Math.max(0, Math.round(Number(payload.puntaje) || 0));
        const currentAttempt = user.attemptsUsed + 1;
        const now = new Date().toISOString();

        if (currentAttempt === 1) {
          user.attemptsUsed = 1;
          user.firstAttemptScore = score;
          user.firstAttemptDate = now;

          global._auditLogs.push({
            cedula,
            numeroIntento: 1,
            puntaje: score,
            cuentaParaRanking: false,
            fechaHoraRegistro: now
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            ok: true,
            attempt: 1,
            score,
            countsForRanking: false,
            attemptsUsed: 1,
            attemptsRemaining: 1,
            firstAttemptScore: score,
            rankingScore: null,
            message: 'Tu primer intento fue completado. Este puntaje no afecta el ranking. Tu segundo intento será tu puntaje oficial.'
          }));
          return;
        } else if (currentAttempt === 2) {
          user.attemptsUsed = 2;
          user.secondAttemptScore = score;
          user.rankingScore = score; // Exclusivamente intento 2
          user.secondAttemptDate = now;

          global._auditLogs.push({
            cedula,
            numeroIntento: 2,
            puntaje: score,
            cuentaParaRanking: true,
            fechaHoraRegistro: now
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            ok: true,
            attempt: 2,
            score,
            countsForRanking: true,
            attemptsUsed: 2,
            attemptsRemaining: 0,
            firstAttemptScore: user.firstAttemptScore,
            secondAttemptScore: score,
            rankingScore: score,
            message: `Tu puntaje oficial es: ${score}. Este puntaje ha sido registrado en el ranking.`
          }));
          return;
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Payload JSON inválido' }));
      }
    });
    return;
  }

  // Endpoint: Consultar Intentos de Usuario
  const attemptMatch = req.url.match(/^\/api\/attempts\/(\d{5,12})$/);
  if (attemptMatch && req.method === 'GET') {
    const cedula = attemptMatch[1];
    const user = global._attemptsStore.get(cedula);
    if (!user) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        found: false,
        attemptsUsed: 0,
        attemptsRemaining: 2,
        firstAttemptScore: null,
        secondAttemptScore: null,
        rankingScore: null
      }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      found: true,
      cedula: user.cedula,
      nombre: user.nombre,
      area: user.area,
      attemptsUsed: user.attemptsUsed,
      attemptsRemaining: Math.max(0, 2 - user.attemptsUsed),
      firstAttemptScore: user.firstAttemptScore,
      secondAttemptScore: user.secondAttemptScore,
      rankingScore: user.rankingScore
    }));
    return;
  }

  // Endpoint: Ranking Oficial (Solo intento 2)
  if (req.url === '/api/ranking' && req.method === 'GET') {
    const ranking = [];
    for (const u of global._attemptsStore.values()) {
      if (u.attemptsUsed === 2 && u.rankingScore !== null) {
        ranking.push({
          cedula: u.cedula,
          nombre: u.nombre,
          area: u.area,
          puntaje: u.rankingScore,
          dificultad: u.dificultad
        });
      }
    }
    ranking.sort((a, b) => b.puntaje - a.puntaje);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(ranking.map((r, i) => ({ posicion: i + 1, ...r }))));
    return;
  }

  // Si la ruta pide la lista general de empleados o departamentos
  if (req.url.startsWith('/api/employees') && !req.url.match(/(\d{5,12})/)) {
    try {
      const apiRes = await fetch('https://sp-empresarial.com/api/employees');
      const data = await apiRes.text();
      res.writeHead(apiRes.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
      console.log(`[${new Date().toLocaleTimeString()}] Consulta lista empleados -> HTTP ${apiRes.status}`);
      return;
    } catch (err) {
      console.error(`[ERROR] Fallo al consultar empleados generales:`, err.message);
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Error al conectar con la API de empleados', detalle: err.message }));
      return;
    }
  }

  // Extraer la cédula buscando cualquier secuencia numérica de 5 a 12 dígitos en la ruta
  const match = req.url.match(/(\d{5,12})/);
  if (!match) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Cédula no proporcionada o formato no válido' }));
    return;
  }

  const cedula = match[1];
  const targetUrl = `https://sp-empresarial.com/api/employees/active-basic/${cedula}`;

  try {
    const apiRes = await fetch(targetUrl);
    const data = await apiRes.text();

    res.writeHead(apiRes.status, {
      'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(data);
    console.log(`[${new Date().toLocaleTimeString()}] Consulta cédula: ${cedula} -> HTTP ${apiRes.status}`);
  } catch (err) {
    console.error(`[ERROR] Fallo al consultar API externa para cédula ${cedula}:`, err.message);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Error al conectar con la API de Sistemas Palacios', detalle: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Proxy de Sistemas Palacios corriendo`);
  console.log(`📡 URL local: http://localhost:${PORT}`);
  console.log(`⚡ Endpoint:  http://localhost:${PORT}/api/employees/active-basic/{cedula}`);
  console.log(`=======================================================`);
});
