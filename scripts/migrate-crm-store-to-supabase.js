const fs = require('fs');
const path = require('path');
const { supabase } = require('../lib/supabase');

async function migrateCrmStore() {
  console.log('\n--- 📋 Migrando dados operacionais de crm-store.json ---');
  const storePath = path.join(__dirname, '..', 'data', 'crm-store.json');
  if (!fs.existsSync(storePath)) {
    console.log('crm-store.json não encontrado');
    return;
  }

  const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));

  // 1. Visitas
  if (Array.isArray(raw.visits) && raw.visits.length > 0) {
    const visits = raw.visits.map(v => {
      const numId = parseInt(String(v.propertyId).replace(/\D/g, ''), 10);
      return {
        id: v.id,
        codigo_imovel: isNaN(numId) ? null : numId,
        property_custom_id: String(v.propertyId || ''),
        property_title: v.propertyTitle || null,
        client_name: v.clientName || null,
        client_phone: v.clientPhone || null,
        date: v.date,
        time: v.time || '10:00',
        broker: v.broker || null,
        status: v.status || 'Agendada',
        notes: v.notes || null,
        session_id: v.sessionId || null,
        contact_id: v.contactId || null,
        created_at: v.createdAt || new Date().toISOString()
      };
    });

    console.log(`Visitas encontradas: ${visits.length}. Gravando...`);
    const { error } = await supabase.from('crm_visitas').upsert(visits, { onConflict: 'id' });
    if (error) console.error('Erro ao gravar visitas:', error.message);
    else console.log('✅ Visitas migradas com sucesso!');
  }

  // 2. Movimentações de chaves
  if (Array.isArray(raw.keyMovements) && raw.keyMovements.length > 0) {
    const km = raw.keyMovements.map(k => {
      const numId = parseInt(String(k.propertyId).replace(/\D/g, ''), 10);
      return {
        id: k.id,
        codigo_imovel: isNaN(numId) ? null : numId,
        property_custom_id: String(k.propertyId || ''),
        key_tag: k.keyTag || null,
        taken_at: k.takenAt || new Date().toISOString(),
        returned_at: k.returnedAt || null,
        status: k.status || 'Retirada',
        taken_by: k.takenBy || null,
        notes: k.notes || null
      };
    });

    console.log(`Movimentações de chave encontradas: ${km.length}. Gravando...`);
    const { error } = await supabase.from('crm_chaves_movimentacoes').upsert(km, { onConflict: 'id' });
    if (error) console.error('Erro ao gravar chaves:', error.message);
    else console.log('✅ Movimentações de chave migradas com sucesso!');
  }
}

migrateCrmStore().catch(console.error);
