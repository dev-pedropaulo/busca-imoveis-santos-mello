const http = require('http');
const assert = require('assert');
const app = require('../server');

async function runFilterBattery() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  const contactId = 'a9f747f3-1cde-41a1-8c21-66b14bede7e9';

  console.log('\n===============================================================');
  console.log('🧪 INICIANDO BATERIA DE TESTES COM DIFERENTES FILTROS E SCORES');
  console.log('===============================================================');

  // Helper para chamar e validar regras comuns
  async function testQuery(title, queryParams) {
    console.log(`\n▶ [CENÁRIO] ${title}`);
    const qs = new URLSearchParams(queryParams).toString();
    const url = `${baseUrl}/api/leads/match?contactId=${contactId}&${qs}`;
    console.log(`  🔗 Chamando: ${url}`);
    
    const res = await fetch(url);
    assert.equal(res.status, 200, `Status HTTP deve ser 200`);
    const data = await res.json();
    assert.equal(data.success, true, `Resposta deve ter success: true`);

    console.log(`  📊 Total de Matches (>= 60%): ${data.totalMatches} | Exibidos: ${data.results.length}`);
    
    // 1. Validação de Score >= 60
    const minThreshold = data.minScoreThreshold || 60;
    for (const item of data.results) {
      assert.ok(
        item.matchScore >= minThreshold,
        `Item ${item.id} tem score ${item.matchScore}%, menor que o limiar ${minThreshold}%`
      );
    }

    // 2. Validação de Ordem Estritamente Decrescente
    for (let i = 0; i < data.results.length - 1; i++) {
      const current = data.results[i].matchScore;
      const next = data.results[i + 1].matchScore;
      assert.ok(
        current >= next,
        `Ordem decrescente violada: item [${i}] (${current}%) < item [${i + 1}] (${next}%)`
      );
    }

    // Exibe top 3
    data.results.slice(0, 3).forEach((item, idx) => {
      console.log(`     ${idx + 1}. Score: ${item.matchScore}% | Ref: ${item.id} | ${item.propertyType} em ${item.location?.neighborhood || item.neighborhood} | R$ ${item.rentalPrice || item.price}`);
    });

    return data;
  }

  // --- CENÁRIO 1: Perfil Padrão do Helena CRM (Locação, Apartamento, 4500, Bairros Casa Branca/Jardim Jamaica, 2 quartos) ---
  const res1 = await testQuery('1. Perfil Original do Helena CRM', {
    limit: '5'
  });
  assert.ok(res1.totalMatches >= 1, 'Deve encontrar pelo menos 1 imóvel no Jardim Jamaica');
  const critOrcamento = res1.criteriosConsiderados.find(c => c.campo === 'Orçamento');
  assert.equal(critOrcamento.ativo, true);

  // --- CENÁRIO 2: Desativar Filtro de Bairros (ignoreBairros=true) ---
  const res2 = await testQuery('2. Desativar Restrição de Bairros (ignoreBairros=true)', {
    ignoreBairros: 'true',
    limit: '5'
  });
  console.log(`  💡 Observação: Ao ignorar bairros específicos, encontramos ${res2.totalMatches} apartamentos disponíveis.`);
  assert.ok(res2.totalMatches > res1.totalMatches, 'Sem restrição de bairros, total de matches deve ser maior');
  const critBairros = res2.criteriosConsiderados.find(c => c.campo === 'Bairros');
  assert.equal(critBairros.ativo, false, 'Critério Bairros deve estar desativado');

  // --- CENÁRIO 3: Aumentar Teto Orçamentário (orcamentoMax=6000) ---
  const res3 = await testQuery('3. Editar Orçamento Localmente (orcamentoMax=6000 e ignoreBairros=true)', {
    orcamentoMax: '6000',
    ignoreBairros: 'true',
    limit: '5'
  });
  assert.ok(res3.totalMatches >= res2.totalMatches, 'Com orçamento de 6000, deve haver igual ou mais opções');
  const critOrcEditado = res3.criteriosConsiderados.find(c => c.campo === 'Orçamento');
  assert.equal(critOrcEditado.editado, true, 'Critério Orçamento deve estar marcado como editado');
  assert.equal(critOrcEditado.valorEfetivo, '6000');

  // --- CENÁRIO 4: Desativar Tipo do Imóvel (ignoreTipo=true) ---
  const res4 = await testQuery('4. Desativar Tipo de Imóvel (Permitir Casas e Sobrados também)', {
    ignoreTipo: 'true',
    ignoreBairros: 'true',
    limit: '5'
  });
  assert.ok(res4.totalMatches >= res2.totalMatches, 'Ao aceitar qualquer tipo, opções devem ser maiores ou iguais');
  const critTipo = res4.criteriosConsiderados.find(c => c.campo === 'Tipo do Imóvel');
  assert.equal(critTipo.ativo, false, 'Critério Tipo deve estar desativado');

  // --- CENÁRIO 5: Alterar para Venda até 700k (finalidade=Venda & orcamentoMax=700000) ---
  const res5 = await testQuery('5. Alterar Destinação para Venda até R$ 700.000', {
    finalidade: 'Venda',
    orcamentoMax: '700000',
    ignoreBairros: 'true',
    limit: '5'
  });
  assert.ok(res5.totalMatches > 0, 'Deve encontrar imóveis para venda até 700k');
  for (const item of res5.results) {
    const isSale = (item.transactionType || '').toLowerCase().includes('venda') || (item.transactionType || '').toLowerCase().includes('sale');
    assert.ok(isSale, `Imóvel ${item.id} deve ser para Venda`);
    assert.ok(item.price <= 700000, `Preço de venda ${item.price} deve ser <= 700000`);
    assert.ok(item.matchScore >= 60, `Score deve ser >= 60%`);
  }

  // --- CENÁRIO 6: Testar Variação de Quartos (quartos=1 & quartos=3) ---
  const res6a = await testQuery('6A. Editar Mínimo de Quartos para 1 (ampliando busca)', {
    quartos: '1',
    ignoreBairros: 'true',
    limit: '5'
  });
  const res6b = await testQuery('6B. Editar Mínimo de Quartos para 3 (restringindo busca)', {
    quartos: '3',
    ignoreBairros: 'true',
    limit: '5'
  });
  assert.ok(res6a.totalMatches >= res6b.totalMatches, '1 quarto deve trazer mais opções que 3 quartos');

  // --- CENÁRIO 7: Validar Limiar Customizado (minScore=80) ---
  const res7 = await testQuery('7. Testar Limiar Alto de Afinidade (minScore=80)', {
    ignoreBairros: 'true',
    minScore: '80',
    limit: '5'
  });
  for (const item of res7.results) {
    assert.ok(item.matchScore >= 80, `Todos os imóveis devem ter score >= 80% (item ${item.id}: ${item.matchScore}%)`);
  }

  console.log('\n===============================================================');
  console.log('✅ TODAS AS VALIDAÇÕES DA BATERIA DE TESTES PASSARAM COM SUCESSO!');
  console.log('   - Limiar de matching >= 60% respeitado rigorosamente.');
  console.log('   - Ordenação estritamente decrescente de afinidade confirmada.');
  console.log('   - Ativação, desativação e edição local de filtros validados.');
  console.log('===============================================================\n');

  server.close();
  process.exit(0);
}

runFilterBattery().catch(err => {
  console.error('\n❌ Falha na bateria de testes:', err);
  process.exit(1);
});
