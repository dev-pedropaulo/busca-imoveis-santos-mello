const http = require('node:http');
const assert = require('assert');
const app = require('../server');

function normalizeStr(str) {
  if (!str) return '';
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function runAddressSearchTests() {
  console.log('🚀 Iniciando validação de busca por Rua, Número da Casa e Apartamento...\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  async function querySearch(term) {
    const res = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent(term)}&limit=20`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    return body;
  }

  try {
    // -------------------------------------------------------------
    // TESTE 1: Busca apenas pelo nome da rua
    // -------------------------------------------------------------
    console.log('📌 Teste 1: Busca pelo nome da rua ("Calábria")...');
    {
      const data = await querySearch('Calábria');
      assert.ok(data.total >= 3, 'Deve encontrar imóveis na Rua Calábria');
      data.results.forEach(p => {
        const addr = normalizeStr(p.location?.address || '');
        assert.ok(addr.includes('calabria'), `Imóvel #${p.id} não é da Rua Calábria`);
      });
      console.log(`  ✅ Rua Calábria: ${data.total} imóveis encontrados com sucesso.`);
    }

    // -------------------------------------------------------------
    // TESTE 2: Busca combinada por Rua + Número da Casa ("Calábria 192")
    // -------------------------------------------------------------
    console.log('\n📌 Teste 2: Busca por Rua + Número ("Calábria 192")...');
    {
      const data = await querySearch('Calábria 192');
      assert.ok(data.total >= 1, 'Deve encontrar o imóvel na Rua Calábria, 192');
      const item = data.results.find(p => p.id === '53');
      assert.ok(item, 'Imóvel #53 deve estar nos resultados');
      assert.strictEqual(item.location?.streetNumber, '192');
      console.log(`  ✅ Rua + Número ("Calábria 192"): Imóvel #${item.id} localizado com precisão.`);
    }

    // -------------------------------------------------------------
    // TESTE 3: Busca por endereço completo ("Rua das Monções, 1268")
    // -------------------------------------------------------------
    console.log('\n📌 Teste 3: Busca por endereço completo com vírgula ("Rua das Monções, 1268")...');
    {
      const data = await querySearch('Rua das Monções, 1268');
      assert.ok(data.total >= 1);
      const item = data.results.find(p => p.id === '2626');
      assert.ok(item, 'Imóvel #2626 deve ser retornado');
      console.log(`  ✅ Endereço com vírgula ("Rua das Monções, 1268"): Imóvel #${item.id} localizado.`);
    }

    // -------------------------------------------------------------
    // TESTE 4: Busca por número isolado ("1268")
    // -------------------------------------------------------------
    console.log('\n📌 Teste 4: Busca por número isolado ("1268")...');
    {
      const data = await querySearch('1268');
      assert.ok(data.total >= 1);
      const item = data.results.find(p => p.id === '2626');
      assert.ok(item, 'Deve retornar o imóvel cujo número de rua é 1268');
      console.log(`  ✅ Número isolado ("1268"): ${data.total} imóveis com número 1268 retornados.`);
    }

    // -------------------------------------------------------------
    // TESTE 5: Busca por complemento / apartamento / cobertura ("CO 6")
    // -------------------------------------------------------------
    console.log('\n📌 Teste 5: Busca por complemento de apartamento ("CO 6")...');
    {
      const data = await querySearch('CO 6');
      assert.strictEqual(data.total, 1, 'Deve retornar exatamente o imóvel com complemento CO 6');
      assert.strictEqual(data.results[0].id, '2623');
      console.log(`  ✅ Complemento ("CO 6"): Imóvel #${data.results[0].id} localizado com exclusividade.`);
    }

    console.log('\n🎉 TODOS OS TESTES DE BUSCA POR RUA, NÚMERO E APARTAMENTO PASSARAM COM 100% DE SUCESSO!\n');
  } finally {
    server.close();
  }
}

runAddressSearchTests().catch(err => {
  console.error('\n❌ Falha no teste:', err);
  process.exit(1);
});
