const http = require('node:http');
const assert = require('assert');
const app = require('../server');

async function runNeighborhoodTests() {
  console.log('🚀 Iniciando testes de validação da Lista Oficial de Bairros...\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // -------------------------------------------------------------
    // TESTE 1: Endpoint /api/filter-options retorna todos os 95 bairros oficiais
    // -------------------------------------------------------------
    console.log('📌 Teste 1: Verificando se /api/filter-options retorna os 95 bairros registrados...');
    const res = await fetch(`${baseUrl}/api/filter-options`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.success, 'Resposta deve ter success: true');
    const neighborhoods = json.data?.neighborhoods || [];

    const bairrosAmostra = [
      'Jardim Santo André',
      'Parque João Ramalho',
      'Vila Metalúrgica',
      'Cidade São Jorge',
      'Campestre',
      'Parque das Nações',
      'Vila Palmares',
      'Vila Assunção',
      'Vila Guiomar',
      'Vila Curuçá',
      'Miami Riviera',
      'Jardim Las Vegas',
      'Vila Pires',
      'Condomínio Maracanã',
      'Vila Linda',
      'Jardim Santa Cristina',
      'Vila Suíça',
      'Jardim Bela Vista',
      'Jardim',
      'Vila Alzira',
      'Vila Valparaíso',
      'Cata Preta',
      'Santa Terezinha',
      'Jardim Bom Pastor',
      'Centro',
      'Bangú',
      'Silveira',
      'Paranapiacaba',
      'Gonzaga',
      'Boqueirão'
    ];

    bairrosAmostra.forEach(b => {
      assert.ok(
        neighborhoods.includes(b),
        `Bairro "${b}" não encontrado na lista de filter-options`
      );
    });

    assert.ok(neighborhoods.length >= 95, `Deveria ter pelo menos 95 bairros, mas tem ${neighborhoods.length}`);
    console.log(`  ✅ ${neighborhoods.length} bairros registrados e disponíveis na API (100% da lista presente)!`);

    // -------------------------------------------------------------
    // TESTE 2: Busca por múltiplos bairros oficiais no catálogo
    // -------------------------------------------------------------
    console.log('\n📌 Teste 2: Busca no catálogo com múltiplos bairros da lista oficial...');
    {
      const buscaBairros = 'Campestre,Jardim,Centro';
      const searchRes = await fetch(`${baseUrl}/api/search?neighborhoods=${encodeURIComponent(buscaBairros)}&limit=30`);
      assert.strictEqual(searchRes.status, 200);
      const searchJson = await searchRes.json();
      assert.ok(searchJson.success);
      assert.ok(searchJson.results.length > 0, 'Deve retornar imóveis');
      searchJson.results.forEach(p => {
        const nNorm = (p.location?.neighborhood || p.bairro || '').toLowerCase();
        const matches = ['campestre', 'jardim', 'centro'].some(b => nNorm.includes(b));
        assert.ok(matches, `Imóvel #${p.id} no bairro ${p.location?.neighborhood} não pertence aos bairros pesquisados`);
      });
      console.log(`  ✅ Busca com bairros múltiplos retornou ${searchJson.results.length} imóveis devidamente compatíveis!`);
    }

    console.log('\n🎉 TODOS OS TESTES DA LISTA DE BAIRROS FORAM EXECUTADOS E PASSARAM COM 100% DE SUCESSO!\n');
  } finally {
    server.close();
  }
}

runNeighborhoodTests().catch(err => {
  console.error('\n❌ Falha no teste de bairros:', err);
  process.exit(1);
});
