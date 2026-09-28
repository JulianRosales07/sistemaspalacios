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
