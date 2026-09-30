const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPropertyWebsiteUrl } = require('../lib/property-website-url');

test('cria o link público a partir do título e do código do imóvel', () => {
  const result = buildPropertyWebsiteUrl(
    'Sala para alugar, 40 m² por R$ 1.375,60/mês - Cidade São Jorge - Santo André/SP',
    '3560'
  );

  assert.equal(
    result,
    'https://www.santosemello.com.br/imovel/sala-para-alugar-40-m-por-r-137560-mes-cidade-sao-jorge-santo-andre-sp/3560'
  );
});
