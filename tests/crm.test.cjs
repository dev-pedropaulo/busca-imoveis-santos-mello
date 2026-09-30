const test = require('node:test');
const assert = require('node:assert/strict');
const { crmStore, KANBAN_STAGES } = require('../lib/crm-store');

test('CRM Store - KANBAN_STAGES deve possuir as 6 etapas da jornada do imóvel', () => {
  assert.equal(KANBAN_STAGES.length, 6);
  const stageIds = KANBAN_STAGES.map(s => s.id);
  assert.ok(stageIds.includes('disponivel'));
  assert.ok(stageIds.includes('visita_agendada'));
  assert.ok(stageIds.includes('chave_entregue'));
  assert.ok(stageIds.includes('com_proposta'));
  assert.ok(stageIds.includes('analise_contrato'));
  assert.ok(stageIds.includes('concluido'));
});

test('CRM Store - CRUD de imóvel manual', () => {
  const testId = `TEST-${Date.now()}`;
  const created = crmStore.createProperty({
    id: testId,
    title: 'Apartamento de Teste Santos & Mello',
    transactionType: 'Locação',
    propertyType: 'Apartment',
    price: 0,
    rentalPrice: 3200,
    location: { neighborhood: 'Campestre', city: 'Santo André' }
  });

  assert.equal(created.id, testId);
  assert.equal(created.rentalPrice, 3200);

  // Atualização
  const updated = crmStore.updateProperty(testId, {
    rentalPrice: 3500,
    kanbanStage: 'com_proposta'
  });
  assert.equal(updated.rentalPrice, 3500);

  // Override de status
  const override = crmStore.getPropertyOverride(testId);
  assert.equal(override.kanbanStage, 'com_proposta');

  // Exclusão
  const deleted = crmStore.deleteProperty(testId);
  assert.equal(deleted, true);
});

test('CRM Store - Agendamento e ciclo de Visitas', () => {
  const visit = crmStore.createVisit({
    propertyId: '8797',
    clientName: 'Cliente Teste Automatizado',
    clientPhone: '(11) 99999-0000',
    date: '2026-10-05',
    time: '15:00'
  });

  assert.ok(visit.id);
  assert.equal(visit.status, 'Agendada');

  const updated = crmStore.updateVisit(visit.id, { status: 'Realizada' });
  assert.equal(updated.status, 'Realizada');

  crmStore.deleteVisit(visit.id);
});

test('CRM Store - Movimentação de Chaves (Claviculário)', () => {
  const checkout = crmStore.checkoutKey({
    propertyId: '8830',
    keyTag: 'CLAV-TEST-99',
    takenBy: 'Corretor Teste'
  });

  assert.ok(checkout.id);
  assert.equal(checkout.status, 'Retirada');

  const returned = crmStore.returnKey(checkout.id, 'Chaves conferidas no retorno');
  assert.equal(returned.status, 'Devolvida');
  assert.ok(returned.returnedAt);
});
