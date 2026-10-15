const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../server');

test('Módulo de Proposta - Rotas HTTP e Headers de Incorporação', async () => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 1. Rota /proposta
    const res1 = await fetch(`http://localhost:${port}/proposta`);
    assert.equal(res1.status, 200);
    assert.equal(res1.headers.get('content-type')?.includes('text/html'), true);
    
    // Validação de permissão de iframe / frame-ancestors para Helena CRM
    const csp = res1.headers.get('content-security-policy') || '';
    assert.ok(csp.includes('frame-ancestors *'));

    const html = await res1.text();
    assert.ok(html.includes('FICHA DE VISITA'));
    assert.ok(html.includes('PROPOSTA'));
    assert.ok(html.includes('S & M - Rua Iugoslávia, 33'));
    assert.ok(html.includes('docPropertiesTable'));

    // 2. Rota alternativa /ficha-visita
    const res2 = await fetch(`http://localhost:${port}/ficha-visita`);
    assert.equal(res2.status, 200);

    // 3. Rota estática direta /proposta.html
    const res3 = await fetch(`http://localhost:${port}/proposta.html`);
    assert.equal(res3.status, 200);
  } finally {
    server.close();
  }
});
