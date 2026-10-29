const http = require('node:http');
const assert = require('assert');
const app = require('../server');
const { extractLeadCriteriaFromContact } = require('../lib/helena-crm');

async function runFilterTests() {
  console.log('🚀 Iniciando bateria completa de testes de validação dos filtros...\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  async function query(endpoint) {
    const res = await fetch(`${baseUrl}${endpoint}`);
    const body = await res.json();
    const items = Array.isArray(body.results) ? body.results : (Array.isArray(body.data) ? body.data : (body.matchedItems || []));
    return { status: res.status, body, items };
  }

  try {
    // -------------------------------------------------------------
    // TESTE 1: Destinação (Residencial e Comercial)
    // -------------------------------------------------------------
    console.log('📌 Testando Filtro 1: Destinação (Uso)...');
    {
      const { status, items } = await query('/api/search?usageType=Residencial&limit=50');
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve retornar imóveis residenciais');
      items.forEach(p => {
        assert.ok(
          (p.usageType || '').toLowerCase().includes('resid'),
          `Imóvel #${p.id} deveria ser Residencial, mas tem usageType: ${p.usageType}`
        );
      });
      console.log(`  ✅ Destinação Residencial: ${items.length} imóveis validados (100% residenciais)`);
    }

    {
      const { status, items } = await query('/api/search?usageType=Comercial&limit=50');
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve retornar imóveis comerciais');
      items.forEach(p => {
        assert.ok(
          (p.usageType || '').toLowerCase().includes('comerc'),
          `Imóvel #${p.id} deveria ser Comercial, mas tem usageType: ${p.usageType}`
        );
      });
      console.log(`  ✅ Destinação Comercial: ${items.length} imóveis validados (100% comerciais)`);
    }

    // -------------------------------------------------------------
    // TESTE 2: Bairros (Separados por vírgula, sem espaço)
    // -------------------------------------------------------------
    console.log('\n📌 Testando Filtro 2: Bairros...');
    {
      const bairrosAlvo = ['Campestre', 'Jardim'];
      const { status, items } = await query(`/api/search?neighborhoods=${bairrosAlvo.join(',')}&limit=50`);
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve retornar imóveis nos bairros solicitados');
      items.forEach(p => {
        const nNorm = (p.location?.neighborhood || p.bairro || '').toLowerCase();
        const matches = bairrosAlvo.some(b => nNorm.includes(b.toLowerCase()));
        assert.ok(matches, `Imóvel #${p.id} em bairro "${p.location?.neighborhood}" não pertence aos bairros filtrados (${bairrosAlvo.join(', ')})`);
      });
      console.log(`  ✅ Bairros múltiplos (${bairrosAlvo.join(',')}): ${items.length} imóveis validados (100% corretos)`);
    }

    // -------------------------------------------------------------
    // TESTE 3: Tipo do Imóvel (Simples e Múltiplos)
    // -------------------------------------------------------------
    console.log('\n📌 Testando Filtro 3: Tipo do Imóvel...');
    {
      // Tipo único: Apartamento
      const { status, items } = await query('/api/search?propertyType=Apartamento&limit=50');
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve retornar apartamentos');
      items.forEach(p => {
        const tNorm = (p.propertyType || '').toLowerCase();
        assert.ok(
          tNorm.includes('apartamento') || tNorm.includes('apartment') || tNorm.includes('studio') || tNorm.includes('duplex'),
          `Imóvel #${p.id} com tipo ${p.propertyType} não é Apartamento`
        );
      });
      console.log(`  ✅ Tipo único (Apartamento): ${items.length} imóveis validados`);
    }

    {
      // Tipos múltiplos separados por vírgula: Casa,Sobrado
      const { status, items } = await query('/api/search?propertyType=Casa,Sobrado&limit=50');
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve retornar Casas e Sobrados');
      items.forEach(p => {
        const tNorm = (p.propertyType || '').toLowerCase();
        assert.ok(
          tNorm.includes('casa') || tNorm.includes('home') || tNorm.includes('sobrado'),
          `Imóvel #${p.id} com tipo ${p.propertyType} não é Casa nem Sobrado`
        );
      });
      console.log(`  ✅ Tipos múltiplos (Casa,Sobrado): ${items.length} imóveis validados`);
    }

    {
      // Tipo comercial: Sala Comercial
      const { status, items } = await query('/api/search?propertyType=Sala%20Comercial&limit=50');
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve retornar salas comerciais');
      items.forEach(p => {
        const tNorm = (p.propertyType || '').toLowerCase();
        assert.ok(
          tNorm.includes('sala') || tNorm.includes('office') || tNorm.includes('andar corporativo'),
          `Imóvel #${p.id} com tipo ${p.propertyType} não é Sala Comercial`
        );
      });
      console.log(`  ✅ Tipo comercial (Sala Comercial): ${items.length} imóveis validados`);
    }

    // -------------------------------------------------------------
    // TESTE 4: Orçamento (Teto Máximo com números inteiros)
    // -------------------------------------------------------------
    console.log('\n📌 Testando Filtro 4: Orçamento Máximo...');
    {
      const tetoMaximo = 2500;
      const { status, items } = await query(`/api/search?type=Loca%C3%A7%C3%A3o&maxPrice=${tetoMaximo}&limit=50`);
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve retornar imóveis para locação dentro do teto');
      items.forEach(p => {
        const preco = p.rentalPrice || p.price || 0;
        assert.ok(
          preco <= tetoMaximo,
          `Imóvel #${p.id} tem valor R$ ${preco}, que ultrapassa o teto de R$ ${tetoMaximo}`
        );
      });
      console.log(`  ✅ Orçamento teto R$ ${tetoMaximo}: ${items.length} imóveis validados (100% dentro do teto)`);
    }

    // -------------------------------------------------------------
    // TESTE 5: N° Quartos (Mínimo exigido)
    // -------------------------------------------------------------
    console.log('\n📌 Testando Filtro 5: N° Quartos...');
    {
      const minQuartos = 3;
      const { status, items } = await query(`/api/search?minBedrooms=${minQuartos}&limit=50`);
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve retornar imóveis com no mínimo 3 quartos');
      items.forEach(p => {
        assert.ok(
          (p.bedrooms || 0) >= minQuartos,
          `Imóvel #${p.id} tem ${p.bedrooms} quartos, menos que o mínimo de ${minQuartos}`
        );
      });
      console.log(`  ✅ Mínimo de ${minQuartos} quartos: ${items.length} imóveis validados (100% possuem >= ${minQuartos} quartos)`);
    }

    // -------------------------------------------------------------
    // TESTE 6: Combinação Completa dos 5 Filtros Concomitantes
    // -------------------------------------------------------------
    console.log('\n📌 Testando Combinação Simultânea dos 5 Filtros...');
    {
      const endpoint = '/api/search?usageType=Residencial&type=Loca%C3%A7%C3%A3o&propertyType=Apartamento&maxPrice=3500&minBedrooms=2&neighborhoods=Campestre,Jardim,Centro';
      const { status, items } = await query(endpoint);
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve encontrar imóveis que atendam aos 5 filtros simultaneamente');
      
      items.forEach(p => {
        // 1. Destinação
        assert.ok((p.usageType || '').toLowerCase().includes('resid'), `Imóvel #${p.id} não é residencial`);
        // 2. Tipo
        const tNorm = (p.propertyType || '').toLowerCase();
        assert.ok(tNorm.includes('apartamento') || tNorm.includes('apartment') || tNorm.includes('studio'), `Imóvel #${p.id} não é apartamento`);
        // 3. Orçamento
        const preco = p.rentalPrice || p.price || 0;
        assert.ok(preco <= 3500, `Imóvel #${p.id} ultrapassa teto: R$ ${preco}`);
        // 4. Quartos
        assert.ok((p.bedrooms || 0) >= 2, `Imóvel #${p.id} tem menos de 2 quartos`);
        // 5. Bairros
        const nNorm = (p.location?.neighborhood || p.bairro || '').toLowerCase();
        assert.ok(nNorm.includes('campestre') || nNorm.includes('jardim') || nNorm.includes('centro'), `Imóvel #${p.id} bairro ${p.location?.neighborhood} fora da lista`);
      });
      console.log(`  ✅ Combinação 5 Filtros Concomitantes: ${items.length} imóveis atendem 100% de todos os critérios!`);
    }

    // -------------------------------------------------------------
    // TESTE 7: Garantia de que Moradores e Pets NÃO filtram o catálogo
    // -------------------------------------------------------------
    console.log('\n📌 Testando Não-Interferência de Campos Informativos (Moradores e Pets)...');
    {
      const contactSimulado = {
        id: 'contact-test-isolamento',
        name: 'Lead Teste Isolamento',
        customFields: {
          'destina-o-75': 'Locação Residencial',
          'tipo-do-im-vel-24': 'Apartamento',
          'or-amento-35': '3000',
          'n-quartos-14': '1', // 1 quarto explícito
          'moradores-21': '5 pessoas', // 5 pessoas não deve forçar 3 quartos!
          'pet-81': 'Sim, dois cachorros grandes', // Não deve excluir imóveis sem tag pet!
          'particularidades-3': 'Vista livre'
        }
      };

      const extracted = extractLeadCriteriaFromContact(contactSimulado);
      // Moradores não altera quartos
      assert.strictEqual(extracted.quartos, 1, 'Quartos deve ser 1 (moradores não pode sobrescrever)');
      assert.strictEqual(extracted.moradores, 5, 'Moradores deve ser informativo');
      assert.strictEqual(extracted.caracteristicas.includes('Aceita Pets'), false, 'Não deve injetar restrição de pet');

      console.log('  ✅ Moradores e Pet isolados com sucesso (zero interferência no filtro de busca)');
    }

    // -------------------------------------------------------------
    // TESTE 8: Validação do endpoint /api/leads/match com Perfil 02
    // -------------------------------------------------------------
    console.log('\n📌 Testando Endpoint /api/leads/match diretamente com os 5 filtros...');
    {
      const endpoint = '/api/leads/match?uso=Residencial&finalidade=Loca%C3%A7%C3%A3o&tipo=Apartamento&orcamento=3500&quartos=2&bairros=Campestre,Jardim';
      const { status, items } = await query(endpoint);
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve retornar imóveis compatíveis na busca de leads');
      items.forEach(p => {
        assert.ok((p.usageType || '').toLowerCase().includes('resid'));
        const tNorm = (p.propertyType || '').toLowerCase();
        assert.ok(tNorm.includes('apartamento') || tNorm.includes('apartment') || tNorm.includes('studio'));
        const preco = p.rentalPrice || p.price || 0;
        assert.ok(preco <= 3500);
        assert.ok((p.bedrooms || 0) >= 2);
        const nNorm = (p.neighborhood || p.location?.neighborhood || '').toLowerCase();
        assert.ok(nNorm.includes('campestre') || nNorm.includes('jardim'));
      });
      console.log(`  ✅ Endpoint /api/leads/match: ${items.length} imóveis validados com 100% de compatibilidade!`);
    }

    console.log('\n🎉 TODOS OS 8 TESTES DE FILTRAGEM FORAM EXECUTADOS E PASSARAM COM 100% DE SUCESSO!\n');
  } finally {
    server.close();
  }
}

runFilterTests().catch(err => {
  console.error('\n❌ Falha na bateria de testes:', err);
  process.exit(1);
});
