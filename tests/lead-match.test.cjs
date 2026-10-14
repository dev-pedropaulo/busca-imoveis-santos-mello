const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../server');
const { extractLeadCriteriaFromContact, parsePrice, parseNumber } = require('../lib/helena-crm');

test('Helena CRM - Parser e Extração de Campos Personalizados', () => {
  // Teste de parse de valores monetários
  assert.equal(parsePrice('R$ 4.500,00'), 4500);
  assert.equal(parsePrice('3500'), 3500);
  assert.equal(parsePrice('1.250.000,00'), 1250000);
  assert.equal(parsePrice(null), 0);

  // Teste de parse de números inteiros
  assert.equal(parseNumber('3 quartos'), 3);
  assert.equal(parseNumber(2), 2);
  assert.equal(parseNumber('2 vagas de garagem'), 2);

  // Teste de mapeamento do contato com customFields
  const mockContact = {
    id: 'f83a4290-7d34-4b47-a4c3-a309990ffb5a',
    name: 'Carlos Alberto Ferreira',
    phoneNumber: '5511988887777',
    email: 'carlos.ferreira@teste.com',
    annotation: 'Trabalha em home office, precisa de ambiente calmo.',
    tagNames: ['Interesse Locação', 'Lead Quente'],
    customFields: {
      'tipo_imovel': 'Apartamento',
      'orcamento_maximo': 'R$ 4.200,00',
      'quantidade_quartos': '3',
      'vagas_garagem': '2',
      'bairro_interesse': 'Bairro Jardim',
      'comodidades_desejadas': ['Piscina', 'Varanda Gourmet'],
      'observacoes_gerais': 'Casal com 1 filho e pet'
    }
  };

  const criteria = extractLeadCriteriaFromContact(mockContact);
  assert.equal(criteria.tipo, 'Apartamento');
  assert.equal(criteria.finalidade, 'Locação');
  assert.equal(criteria.orcamentoMax, 4200);
  assert.equal(criteria.quartos, 3);
  assert.equal(criteria.vagas, 2);
  assert.equal(criteria.regiao, 'Bairro Jardim');
  assert.ok(criteria.caracteristicas.includes('Piscina'));
  assert.ok(criteria.contexto.includes('home office'));
  assert.ok(criteria.contexto.includes('Casal com 1 filho'));
});

test('GET /api/leads/match - Validação do endpoint com filtros e Helena CRM', async (t) => {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(() => {
    server.close();
  });

  await t.test('Deve retornar status 200 com aviso caso contactId seja passado sem token configurado', async () => {
    const res = await fetch(`${baseUrl}/api/leads/match?contactId=contato-invalido-123`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.contactWarning.includes('Helena CRM'));
    assert.ok(Array.isArray(body.results));
  });

  await t.test('Deve filtrar e pontuar por tipo, orçamento e quartos diretamente via query', async () => {
    const query = new URLSearchParams({
      tipo: 'apartamento',
      finalidade: 'locacao',
      orcamentoMax: '5000',
      quartos: '2',
      limit: '5'
    });

    const res = await fetch(`${baseUrl}/api/leads/match?${query.toString()}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.leadProfile);
    assert.equal(body.leadProfile.tipo, 'apartamento');
    assert.equal(body.leadProfile.orcamentoMax, 5000);
    assert.equal(body.leadProfile.quartosMin, 2);

    for (const item of body.results) {
      assert.ok(item.matchScore > 0, 'Score deve ser maior que zero');
      assert.ok(Array.isArray(item.matchHighlights), 'Deve conter destaques do match');
      assert.ok((item.bedrooms || 0) >= 2, 'Deve respeitar o mínimo de 2 quartos');
      const price = item.rentalPrice || item.price || 0;
      if (price > 0) {
        assert.ok(price <= 5000, `Preço ${price} deve ser menor ou igual a 5000`);
      }
    }
  });

  await t.test('Deve suportar formato compact/ai para o agente de IA do n8n', async () => {
    const query = new URLSearchParams({
      tipo: 'casa',
      finalidade: 'venda',
      formato: 'ai',
      limit: '3'
    });

    const res = await fetch(`${baseUrl}/api/leads/match?${query.toString()}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    if (body.results.length > 0) {
      const first = body.results[0];
      assert.ok(first.id);
      assert.ok(first.title);
      assert.ok(typeof first.matchScore === 'number');
      assert.ok(Array.isArray(first.matchHighlights));
    }
  });
});
