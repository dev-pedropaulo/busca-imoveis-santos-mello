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
    'bairros-77': 'Parque João Ramalho,Vila Metalúrgica',
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

// Validações dos 5 campos filtráveis
assert.strictEqual(res1.finalidade, 'Locação', 'Finalidade deve ser extraída de destina-o-75 e não do legado');
assert.strictEqual(res1.uso, 'Residencial', 'Uso deve ser Residencial');
assert.strictEqual(res1.tipo, 'Apartamento', 'Tipo deve vir de tipo-do-im-vel-24 e não tipo-do-im-vel-56');
assert.strictEqual(res1.regiao, 'Parque João Ramalho,Vila Metalúrgica');
assert.strictEqual(res1.orcamentoMax, 2500, 'Orçamento deve ser convertido de "2.500,00" para 2500');
assert.strictEqual(res1.quartos, 2, 'Quartos deve ser 2 vindo de n-quartos-14 (ignorando n-quartos=5 do legado)');

// Validações dos campos informativos (não interferem no filtro)
assert.strictEqual(res1.moradores, 3, 'Moradores deve ser registrado para informação');
assert.strictEqual(res1.aceitaPet, true, 'Pet deve ser registrado para informação');
assert.strictEqual(res1.petDetalhes, 'dois gatos', 'Detalhes do pet deve ser "dois gatos"');
// Pet não deve ser injetado em características para não filtrar o catálogo
assert.strictEqual(res1.caracteristicas.includes('Aceita Pets'), false, 'Pet NÃO deve ser adicionado em características para não interferir no filtro');

console.log('✅ Teste 1 passou: Perfil 02 priorizado, 5 filtros extraídos e campos informativos isolados!');

// Teste 2: Lead com Moradores preenchido mas SEM n-quartos-14
const contactApenasMoradores = {
  id: 'test-moradores',
  customFields: {
    'moradores-21': '4 pessoas'
  }
};
const res2 = extractLeadCriteriaFromContact(contactApenasMoradores);
assert.strictEqual(res2.moradores, 4);
assert.strictEqual(res2.quartos, 0, 'Moradores NÃO deve mais estimar quartos (Moradores é 100% informativo)');
console.log('✅ Teste 2 passou: Moradores é puramente informativo e não interfere nos quartos!');

console.log('\n🎉 TODOS OS TESTES DE UNIDADE PASSARAM COM SUCESSO!');
