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

  await t.test('GET /visitas deve servir a página HTML de agendamento com permissão de iframe', async () => {
    const res = await fetch(`${baseUrl}/visitas`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Agendamento de Visitas'));
    assert.ok(text.includes('visitas.js'));
    assert.equal(res.headers.get('content-security-policy'), 'frame-ancestors *');
    assert.equal(res.headers.get('x-frame-options'), null);
  });

  await t.test('POST /api/leads/schedule-visits deve rejeitar sem identificadores ou sem visitas', async () => {
    const res1 = await fetch(`${baseUrl}/api/leads/schedule-visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visits: [{ propertyId: '100' }] })
    });
    assert.equal(res1.status, 400);

    const res2 = await fetch(`${baseUrl}/api/leads/schedule-visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'sess-123', visits: [] })
    });
    assert.equal(res2.status, 400);
  });

  await t.test('POST /api/leads/schedule-visits deve agendar visitas e salvar no crmStore', async () => {
    const res = await fetch(`${baseUrl}/api/leads/schedule-visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess-teste-visita',
        contactId: 'contato-teste-visita',
        clientName: 'Pedro Santos',
        clientPhone: '11988887777',
        visits: [
          {
            propertyId: '8713',
            propertyTitle: 'Apartamento Jardim Jamaica',
            date: '2026-10-18',
            time: '14:30',
            notes: 'Avisar portaria'
          }
        ]
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.crmVisits.length >= 1);
    assert.equal(body.data.crmVisits[0].propertyId, '8713');
    assert.equal(body.data.crmVisits[0].time, '14:30');
  });

  await t.test('Helena CRM Card - Validações de integridade e registro em card', async () => {
    const { fetchHelenaContactCard, recordSentPropertiesInHelenaCard, recordScheduledVisitsInHelenaCard } = require('../lib/helena-crm');

    // Rejeita busca de card sem contactId
    await assert.rejects(
      async () => fetchHelenaContactCard(''),
      /ID do contato não fornecido/
    );

    // Ignora graciosamente quando lista de imóveis vazia
    const emptyResult = await recordSentPropertiesInHelenaCard({
      contactId: 'a9f747f3-1cde-41a1-8c21-66b14bede7e9',
      properties: []
    });
    assert.equal(emptyResult.success, false);
    assert.equal(emptyResult.skipped, true);

    // Ignora graciosamente quando lista de visitas vazia
    const emptyVisitsResult = await recordScheduledVisitsInHelenaCard({
      contactId: 'a9f747f3-1cde-41a1-8c21-66b14bede7e9',
      visits: []
    });
    assert.equal(emptyVisitsResult.success, false);
    assert.equal(emptyVisitsResult.skipped, true);

    // Ignora graciosamente quando nem contactId nem sessionId são fornecidos
    const noContactResult = await recordScheduledVisitsInHelenaCard({
      visits: [{ propertyId: '3271' }]
    });
    assert.equal(noContactResult.success, false);
    assert.equal(noContactResult.skipped, true);
  });
});
