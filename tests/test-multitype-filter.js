const http = require('node:http');
const assert = require('assert');
const app = require('../server');
const { extractLeadCriteriaFromContact } = require('../lib/helena-crm');

const OFFICIAL_PROPERTY_TYPES = [
  'Casa',
  'Sobrado',
  'Assobradada',
  'Apartamento',
  'Apartamento S/ Condominio',
  'Cobertura',
  'Kitnet',
  'Salão',
  'Sala Comercial',
  'Galpão',
  'Loja',
  'Sobreloja',
  'Terreno'
];

function normalizeStr(str) {
  if (!str) return '';
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Simula a lógica de marcação automática do frontend
function parseAndSelectPropertyTypes(rawTipo) {
  const selected = new Set();
  if (rawTipo && rawTipo !== 'Qualquer') {
    const tList = rawTipo.split(',').map(t => t.trim()).filter(Boolean);
    tList.forEach(t => {
      const tNorm = normalizeStr(t);
      const matched = OFFICIAL_PROPERTY_TYPES.find(opt => normalizeStr(opt) === tNorm) ||
                      OFFICIAL_PROPERTY_TYPES.find(opt => normalizeStr(opt).includes(tNorm) || tNorm.includes(normalizeStr(opt)));
      if (matched) {
        selected.add(matched);
      } else {
        selected.add(t);
      }
    });
  }
  return selected;
}

async function runMultiTypeTests() {
  console.log('🚀 Iniciando validação de Seleção Múltipla do Tipo de Imóvel...\n');

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
    // -----------------------------------------------------------------
    // TESTE 1: Validação da decomposição e marcação automática por vírgula
    // -----------------------------------------------------------------
    console.log('📌 Teste 1: Decomposição de múltiplos tipos recebidos na string do lead...');
    {
      const caso1 = parseAndSelectPropertyTypes('Apartamento,Casa');
      assert.strictEqual(caso1.size, 2);
      assert.ok(caso1.has('Apartamento'), 'Deve conter Apartamento individualmente');
      assert.ok(caso1.has('Casa'), 'Deve conter Casa individualmente');
      assert.ok(!caso1.has('Apartamento,Casa'), 'NÃO deve criar a opção concatenada Apartamento,Casa');
      console.log('  ✅ "Apartamento,Casa" marcou com sucesso:', Array.from(caso1));

      const caso2 = parseAndSelectPropertyTypes('Sobrado, Assobradada, Cobertura');
      assert.strictEqual(caso2.size, 3);
      assert.ok(caso2.has('Sobrado'));
      assert.ok(caso2.has('Assobradada'));
      assert.ok(caso2.has('Cobertura'));
      console.log('  ✅ "Sobrado, Assobradada, Cobertura" marcou com sucesso:', Array.from(caso2));

      const caso3 = parseAndSelectPropertyTypes('Salão,Sala Comercial');
      assert.strictEqual(caso3.size, 2);
      assert.ok(caso3.has('Salão'));
      assert.ok(caso3.has('Sala Comercial'));
      console.log('  ✅ "Salão,Sala Comercial" marcou com sucesso:', Array.from(caso3));

      const caso4 = parseAndSelectPropertyTypes('Apartamento S/ Condominio, Kitnet');
      assert.strictEqual(caso4.size, 2);
      assert.ok(caso4.has('Apartamento S/ Condominio'));
      assert.ok(caso4.has('Kitnet'));
      console.log('  ✅ "Apartamento S/ Condominio, Kitnet" marcou com sucesso:', Array.from(caso4));
    }

    // -----------------------------------------------------------------
    // TESTE 2: Busca no catálogo com múltiplos tipos: "Apartamento,Casa"
    // -----------------------------------------------------------------
    console.log('\n📌 Teste 2: Busca no catálogo (/api/search) com "propertyType=Apartamento,Casa"...');
    {
      const { status, items } = await query('/api/search?propertyType=Apartamento,Casa&limit=50');
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve retornar imóveis para Apartamento ou Casa');

      let countApartamento = 0;
      let countCasa = 0;

      items.forEach(p => {
        const tNorm = normalizeStr(p.propertyType || '');
        const isApto = tNorm.includes('apartamento') || tNorm.includes('apartment') || tNorm.includes('studio') || tNorm.includes('duplex');
        const isCasa = tNorm.includes('casa') || tNorm.includes('home');
        assert.ok(isApto || isCasa, `Imóvel #${p.id} com tipo "${p.propertyType}" não é nem Apartamento nem Casa`);
        if (isApto) countApartamento++;
        if (isCasa) countCasa++;
      });

      console.log(`  ✅ ${items.length} imóveis retornados (Apartamentos: ${countApartamento}, Casas: ${countCasa}). Todos 100% válidos!`);
    }

    // -----------------------------------------------------------------
    // TESTE 3: Busca no catálogo com múltiplos tipos: "Casa,Sobrado"
    // -----------------------------------------------------------------
    console.log('\n📌 Teste 3: Busca no catálogo (/api/search) com "propertyType=Casa,Sobrado"...');
    {
      const { status, items } = await query('/api/search?propertyType=Casa,Sobrado&limit=50');
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0);

      items.forEach(p => {
        const tNorm = normalizeStr(p.propertyType || '');
        const isCasa = tNorm.includes('casa') || tNorm.includes('home');
        const isSobrado = tNorm.includes('sobrado');
        assert.ok(isCasa || isSobrado, `Imóvel #${p.id} com tipo "${p.propertyType}" não é Casa nem Sobrado`);
      });

      console.log(`  ✅ ${items.length} imóveis retornados para Casa e Sobrado (100% válidos)`);
    }

    // -----------------------------------------------------------------
    // TESTE 4: Busca com múltiplos tipos comerciais: "Salão,Sala Comercial"
    // -----------------------------------------------------------------
    console.log('\n📌 Teste 4: Busca no catálogo com tipos comerciais múltiplos: "Salão,Sala Comercial"...');
    {
      const { status, items } = await query('/api/search?propertyType=Sal%C3%A3o,Sala%20Comercial&limit=50');
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0);

      items.forEach(p => {
        const tNorm = normalizeStr(p.propertyType || '');
        const isSala = tNorm.includes('sala') || tNorm.includes('office') || tNorm.includes('andar corporativo');
        const isSalao = tNorm.includes('salao');
        assert.ok(isSala || isSalao, `Imóvel #${p.id} com tipo "${p.propertyType}" não é Salão nem Sala Comercial`);
      });

      console.log(`  ✅ ${items.length} imóveis retornados para Salão e Sala Comercial (100% válidos)`);
    }

    // -----------------------------------------------------------------
    // TESTE 5: Busca combinada completa com seleção múltipla de tipos
    // -----------------------------------------------------------------
    console.log('\n📌 Teste 5: Busca combinada completa (Múltiplos Tipos + 4 outros filtros)...');
    {
      // Filtros: Destinação Residencial + Tipos Apartamento,Casa + Locação + Max 3500 + Min 2 quartos + Bairros Campestre,Jardim
      const endpoint = '/api/search?usageType=Residencial&type=Loca%C3%A7%C3%A3o&propertyType=Apartamento,Casa&maxPrice=3500&minBedrooms=2&neighborhoods=Campestre,Jardim';
      const { status, items } = await query(endpoint);
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0, 'Deve retornar imóveis atendendo a todos os critérios');

      items.forEach(p => {
        // Uso
        assert.ok((p.usageType || '').toLowerCase().includes('resid'));
        // Tipo múltiplo
        const tNorm = normalizeStr(p.propertyType || '');
        const isApto = tNorm.includes('apartamento') || tNorm.includes('apartment') || tNorm.includes('studio');
        const isCasa = tNorm.includes('casa') || tNorm.includes('home');
        assert.ok(isApto || isCasa);
        // Preço
        assert.ok((p.rentalPrice || p.price || 0) <= 3500);
        // Quartos
        assert.ok((p.bedrooms || 0) >= 2);
        // Bairros
        const nNorm = (p.location?.neighborhood || p.bairro || '').toLowerCase();
        assert.ok(nNorm.includes('campestre') || nNorm.includes('jardim'));
      });

      console.log(`  ✅ ${items.length} imóveis validados com sucesso atendendo aos filtros concomitantes!`);
    }

    // -----------------------------------------------------------------
    // TESTE 6: Endpoint /api/leads/match com tipos múltiplos vindo do CRM
    // -----------------------------------------------------------------
    console.log('\n📌 Teste 6: Endpoint /api/leads/match recebendo tipo múltiplo...');
    {
      const endpoint = '/api/leads/match?uso=Residencial&finalidade=Loca%C3%A7%C3%A3o&tipo=Apartamento,Casa&orcamento=3500&quartos=2&bairros=Campestre,Jardim';
      const { status, items } = await query(endpoint);
      assert.strictEqual(status, 200);
      assert.ok(items.length > 0);

      items.forEach(p => {
        assert.ok((p.usageType || '').toLowerCase().includes('resid'));
        const tNorm = normalizeStr(p.propertyType || '');
        const isApto = tNorm.includes('apartamento') || tNorm.includes('apartment') || tNorm.includes('studio');
        const isCasa = tNorm.includes('casa') || tNorm.includes('home');
        assert.ok(isApto || isCasa);
        assert.ok((p.rentalPrice || p.price || 0) <= 3500);
        assert.ok((p.bedrooms || 0) >= 2);
      });

      console.log(`  ✅ Endpoint /api/leads/match validado com múltiplos tipos: ${items.length} imóveis compatíveis!`);
    }

    console.log('\n🎉 TODOS OS 6 TESTES DE SELEÇÃO MÚLTIPLA DE TIPOS PASSARAM COM 100% DE SUCESSO!\n');
  } finally {
    server.close();
  }
}

runMultiTypeTests().catch(err => {
  console.error('\n❌ Falha no teste:', err);
  process.exit(1);
});
