const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fetchImoviewPropertyDetails,
  getOperationalPropertyData,
  buildChaveFormatada,
  buildEnderecoCompleto,
  clearOperationalCache
} = require('../lib/imoview-api');

test('Imoview API - Formatação de chave', () => {
  const chaveCompleta = buildChaveFormatada({
    local: 'Imobiliária',
    identificador: 'PARQUE DAS NAÇÕES',
    numero: 25
  });
  assert.equal(chaveCompleta, 'Imobiliária • Unidade/Setor: PARQUE DAS NAÇÕES • Chave nº 25');

  const chaveApenasLocal = buildChaveFormatada({
    local: 'Portaria'
  });
  assert.equal(chaveApenasLocal, 'Portaria');

  const chaveVazia = buildChaveFormatada({});
  assert.equal(chaveVazia, 'Não informada na Imoview');
});

test('Imoview API - Formatação de endereço completo', () => {
  const endCompleto = buildEnderecoCompleto({
    endereco: 'Rua das Figueiras',
    numero: '450',
    complemento: 'Apto 12',
    bairro: 'Jardim',
    cidade: 'Santo André',
    estado: 'SP',
    cep: '09080-300',
    pontoReferencia: 'Próximo ao Parque Celso Daniel'
  });
  assert.ok(endCompleto.includes('Rua das Figueiras, 450 - Apto 12'));
  assert.ok(endCompleto.includes('Jardim'));
  assert.ok(endCompleto.includes('Santo André - SP'));
  assert.ok(endCompleto.includes('CEP 09080-300'));
  assert.ok(endCompleto.includes('Ref: Próximo ao Parque Celso Daniel'));

  // Descarta máscara de número asterisco
  const endMascarado = buildEnderecoCompleto({
    endereco: 'Rua Almada',
    numero: '***',
    complemento: '**************',
    bairro: 'Jardim Santo Alberto',
    cidade: 'Santo André',
    estado: 'SP',
    cep: '09260-420'
  });
  assert.ok(!endMascarado.includes('*'));
  assert.ok(endMascarado.includes('Rua Almada'));
  assert.ok(endMascarado.includes('Jardim Santo Alberto'));
});

test('Imoview API - Consulta de detalhes e dados operacionais (Imóvel 3271)', async () => {
  clearOperationalCache();

  const details = await fetchImoviewPropertyDetails('3271');
  assert.equal(details.success, true);
  assert.ok(details.imovel);
  assert.equal(details.imovel.codigo, 3271);
  assert.equal(details.imovel.localchave, 'Imobiliária');
  assert.equal(details.imovel.identificadorchave, 'PARQUE DAS NAÇÕES');
  assert.equal(details.imovel.numerochave, 25);
  assert.equal(details.imovel.captadores[0].nome, 'S & M');

  const opData = await getOperationalPropertyData('3271');
  assert.equal(opData.success, true);
  assert.equal(opData.propertyId, '3271');
  assert.equal(opData.chave.local, 'Imobiliária');
  assert.equal(opData.chave.identificador, 'PARQUE DAS NAÇÕES');
  assert.equal(opData.chave.numero, 25);
  assert.equal(opData.chave.encontrado, true);
  assert.ok(opData.chave.formatado.includes('PARQUE DAS NAÇÕES'));
  assert.ok(opData.chave.formatado.includes('25'));

  // Endereço Completo
  assert.ok(opData.enderecoCompleto);
  assert.ok(opData.enderecoCompleto.includes('Rua Almada'));
  assert.ok(opData.enderecoCompleto.includes('Jardim Santo Alberto'));
  assert.ok(opData.enderecoCompleto.includes('Santo André'));

  // Captadores
  assert.ok(Array.isArray(opData.captadores));
  assert.equal(opData.captadores.length, 1);
  assert.equal(opData.captadores[0].nome, 'S & M');
  assert.equal(opData.captadores[0].telefone, '(11) 4469-2121');

  // Cache em memória
  const cachedData = await getOperationalPropertyData('3271');
  assert.equal(cachedData.consultedAt, opData.consultedAt);
});

test('Imoview API - Rejeita código inválido ou vazio', async () => {
  const result = await getOperationalPropertyData('');
  assert.equal(result.success, false);
  assert.ok(result.error);
});

test('GET /api/imoveis/:id/detalhes-operacionais - Endpoint HTTP', async () => {
  const http = require('node:http');
  const app = require('../server');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/imoveis/3271/detalhes-operacionais`);
    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.success, true);
    assert.equal(json.propertyId, '3271');
    assert.equal(json.chave.local, 'Imobiliária');
    assert.equal(json.chave.identificador, 'PARQUE DAS NAÇÕES');
    assert.equal(json.chave.numero, 25);
    assert.ok(json.captadores.length > 0);
    assert.equal(json.captadores[0].nome, 'S & M');

    // Validação do endereço completo no payload HTTP
    assert.ok(json.enderecoCompleto);
    assert.ok(json.enderecoCompleto.includes('Rua Almada'));
    assert.ok(json.enderecoCompleto.includes('Jardim Santo Alberto'));
    assert.ok(json.enderecoCompleto.includes('Santo André'));
  } finally {
    server.close();
  }
});

