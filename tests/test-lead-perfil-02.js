const assert = require('assert');
const { extractLeadCriteriaFromContact } = require('../lib/helena-crm');

console.log('🧪 Iniciando testes de extração de critérios do Perfil de Qualificação 02...');

// Teste 1: Contato com Perfil 02 completo e valores em string
const contactPerfil02 = {
  id: 'test-lead-02',
  name: 'Cliente Teste Perfil 02',
  customFields: {
    'destina-o-75': 'Locação Residencial',
    'tipo-do-im-vel-24': 'Apartamento',
    'bairros-77': 'Parque João Ramalho, Vila Metalúrgica',
    'or-amento-35': '2.500,00',
    'n-quartos-14': '2',
    'n-su-tes-': '1',
    'moradores-21': '3',
    'pet-81': 'Sim, dois gatos',
    'particularidades-3': 'Varanda gourmet e vaga coberta',
    'garantia-7': 'Seguro Fiança',
    'motivo-da-mudan-a': 'Trabalho mais próximo',
    'tempo-estimado-para-': '30 dias',
    // Campos legados do Perfil Original que DEVEM ser ignorados
    'destina-o': 'Venda',
    'tipo-do-im-vel-56': 'Casa',
    'or-amento': 999999,
    'n-quartos': 5
  }
};

const res1 = extractLeadCriteriaFromContact(contactPerfil02);

// Validações
assert.strictEqual(res1.finalidade, 'Locação', 'Finalidade deve ser extraída de destina-o-75 e não do legado');
assert.strictEqual(res1.uso, 'Residencial', 'Uso deve ser Residencial');
assert.strictEqual(res1.tipo, 'Apartamento', 'Tipo deve vir de tipo-do-im-vel-24 e não tipo-do-im-vel-56');
assert.strictEqual(res1.regiao, 'Parque João Ramalho, Vila Metalúrgica');
assert.strictEqual(res1.orcamentoMax, 2500, 'Orçamento deve ser convertido de "2.500,00" para 2500');
assert.strictEqual(res1.quartos, 2, 'Quartos deve ser 2 vindo de n-quartos-14 (ignorando n-quartos=5 do legado)');
assert.strictEqual(res1.suites, 1, 'Suítes deve ser 1 vindo de n-su-tes-');
assert.strictEqual(res1.moradores, 3, 'Moradores deve ser 3 vindo de moradores-21');
assert.strictEqual(res1.aceitaPet, true, 'Pet deve ser aceito');
assert.strictEqual(res1.petDetalhes, 'dois gatos', 'Detalhes do pet deve ser "dois gatos"');
assert.ok(res1.caracteristicas.includes('Aceita Pets'), 'Características deve incluir "Aceita Pets"');
assert.ok(res1.caracteristicas.includes('Varanda gourmet'), 'Particularidades deve ser incluída');

console.log('✅ Teste 1 passou: Perfil 02 priorizado e campos legados ignorados!');

// Teste 2: Lead que NÃO tem pets ("Não, sem pet")
const contactSemPet = {
  id: 'test-lead-sem-pet',
  customFields: {
    'pet-81': 'Não, sem pet',
    'or-amento-35': '2000',
    'n-quartos-14': '3'
  }
};
const res2 = extractLeadCriteriaFromContact(contactSemPet);
assert.strictEqual(res2.aceitaPet, false, 'Lead que marcou Não não deve exigir pet');
assert.ok(!res2.caracteristicas.includes('Aceita Pets'), 'Não deve adicionar Aceita Pets em características');
console.log('✅ Teste 2 passou: Formato "Não" para pet validado com sucesso!');

// Teste 3: Lead sem n-quartos-14 explícito, apenas moradores (estimativa)
const contactApenasMoradores = {
  id: 'test-moradores',
  customFields: {
    'moradores-21': '4 pessoas'
  }
};
const res3 = extractLeadCriteriaFromContact(contactApenasMoradores);
assert.strictEqual(res3.moradores, 4);
assert.strictEqual(res3.quartos, 3, '4 moradores deve estimar 3 dormitórios');
console.log('✅ Teste 3 passou: Estimativa de quartos por moradores funcionando!');

console.log('\n🎉 TODOS OS TESTES DE UNIDADE PASSARAM COM SUCESSO!');
