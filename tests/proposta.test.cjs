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

    assert.ok(html.includes('btnOpenFeedbackModal'), 'Deve conter o botão de Feedback de Visita no cabeçalho');
    assert.ok(html.includes('feedbackModalOverlay'), 'Deve conter o modal de Feedback de Visita & Fechamento');
    assert.ok(html.includes('feedbackScheduledPropsList'), 'Deve conter o container de imóveis da visita');

    // 2. Rota alternativa /ficha-visita
    const res2 = await fetch(`http://localhost:${port}/ficha-visita`);
    assert.equal(res2.status, 200);

    // 3. Rota estática direta /proposta.html
    const res3 = await fetch(`http://localhost:${port}/proposta.html`);
    assert.equal(res3.status, 200);

    // 4. Teste da API POST /api/leads/visit-feedback - Validações
    const resFeedbackBad = await fetch(`http://localhost:${port}/api/leads/visit-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(resFeedbackBad.status, 400);

    const resFeedbackOk = await fetch(`http://localhost:${port}/api/leads/visit-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: 'dummy-lead-test',
        sessionId: 'dummy-sess-test',
        status: '🟢 Proposta Fechada / Aprovada',
        imoveisFechados: [
          { id: '5586', address: 'Rua Almada, 270', neighborhood: 'Jardim Santo Alberto', value: 'R$ 1.600,00' }
        ],
        valor: '1.600,00',
        termo: '30 meses',
        garantia: 'Seguro Fiança',
        observacoes: 'Cliente aprovado e contrato em confecção',
        clientName: 'Kelly Teste',
        corretor: 'Matheus dos Santos Cruz'
      })
    });
    assert.equal(resFeedbackOk.status, 200);
    const feedbackData = await resFeedbackOk.json();
    assert.equal(feedbackData.success, true);
    assert.ok(feedbackData.summary);
  } finally {
    server.close();
  }
});

