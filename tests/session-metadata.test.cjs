const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../server');
const { recordSentPropertiesInHelenaSession } = require('../lib/helena-crm');

test('Session Metadata - Validação dos endpoints e regras de negócio', async (t) => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(() => {
    server.close();
  });

  await t.test('POST /api/leads/session-metadata deve rejeitar requisição sem contactId nem sessionId', async () => {
    const res = await fetch(`${baseUrl}/api/leads/session-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: [{ id: '123' }] })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes('contactId ou sessionId'));
  });

  await t.test('POST /api/leads/session-metadata deve rejeitar requisição sem lista de imóveis', async () => {
    const res = await fetch(`${baseUrl}/api/leads/session-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: 'a9f747f3-1cde-41a1-8c21-66b14bede7e9', properties: [] })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes('Nenhum imóvel fornecido'));
  });

  await t.test('GET /api/leads/session-metadata deve rejeitar consulta sem parâmetros de identificação', async () => {
    const res = await fetch(`${baseUrl}/api/leads/session-metadata`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes('contactId ou sessionId'));
  });
});
