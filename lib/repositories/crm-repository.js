const { supabase } = require('../supabase');
const { crmStore } = require('../crm-store');

class CrmRepository {
  // --- VISITAS ---
  async getVisits(filter = {}) {
    let query = supabase.from('crm_visitas').select('*').order('date', { ascending: true });
    
    if (filter.propertyId) {
      const num = parseInt(String(filter.propertyId).replace(/\D/g, ''), 10);
      if (!isNaN(num)) {
        query = query.or(`codigo_imovel.eq.${num},property_custom_id.eq.${filter.propertyId}`);
      } else {
        query = query.eq('property_custom_id', filter.propertyId);
      }
    }
    if (filter.status) {
      query = query.eq('status', filter.status);
    }
    if (filter.broker) {
      query = query.ilike('broker', `%${filter.broker}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('⚠️ Erro ao consultar visitas no Supabase, usando crmStore local:', error.message);
      return crmStore.getVisits(filter);
    }

    return (data || []).map(v => ({
      id: v.id,
      propertyId: v.property_custom_id || String(v.codigo_imovel),
      propertyTitle: v.property_title,
      clientName: v.client_name,
      clientPhone: v.client_phone,
      date: v.date,
      time: v.time,
      broker: v.broker,
      status: v.status,
      notes: v.notes,
      sessionId: v.session_id,
      contactId: v.contact_id,
      createdAt: v.created_at
    }));
  }

  async addVisit(visitData) {
    const localVisit = crmStore.addVisit(visitData);
    
    // Grava no Supabase
    try {
      const numId = parseInt(String(visitData.propertyId).replace(/\D/g, ''), 10);
      await supabase.from('crm_visitas').upsert({
        id: localVisit.id,
        codigo_imovel: isNaN(numId) ? null : numId,
        property_custom_id: String(visitData.propertyId || ''),
        property_title: visitData.propertyTitle || null,
        client_name: visitData.clientName || null,
        client_phone: visitData.clientPhone || null,
        date: visitData.date,
        time: visitData.time || '10:00',
        broker: visitData.broker || null,
        status: localVisit.status || 'Agendada',
        notes: visitData.notes || null,
        session_id: visitData.sessionId || null,
        contact_id: visitData.contactId || null,
        created_at: localVisit.createdAt || new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn('⚠️ Falha ao persistir visita no Supabase:', err.message);
    }

    return localVisit;
  }

  // --- CLAVICULÁRIO / CHAVES ---
  async getKeyMovements(filter = {}) {
    let query = supabase.from('crm_chaves_movimentacoes').select('*').order('taken_at', { ascending: false });

    if (filter.propertyId) {
      const num = parseInt(String(filter.propertyId).replace(/\D/g, ''), 10);
      if (!isNaN(num)) {
        query = query.or(`codigo_imovel.eq.${num},property_custom_id.eq.${filter.propertyId}`);
      } else {
        query = query.eq('property_custom_id', filter.propertyId);
      }
    }
    if (filter.status) {
      query = query.eq('status', filter.status);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('⚠️ Erro ao consultar chaves no Supabase, usando crmStore local:', error.message);
      return crmStore.getKeyMovements(filter);
    }

    return (data || []).map(k => ({
      id: k.id,
      propertyId: k.property_custom_id || String(k.codigo_imovel),
      keyTag: k.key_tag,
      takenAt: k.taken_at,
      returnedAt: k.returned_at,
      status: k.status,
      takenBy: k.taken_by,
      notes: k.notes
    }));
  }

  async takeKey(data) {
    const localMovement = crmStore.takeKey(data);
    try {
      const numId = parseInt(String(data.propertyId).replace(/\D/g, ''), 10);
      await supabase.from('crm_chaves_movimentacoes').upsert({
        id: localMovement.id,
        codigo_imovel: isNaN(numId) ? null : numId,
        property_custom_id: String(data.propertyId || ''),
        key_tag: data.keyTag || null,
        taken_at: localMovement.takenAt || new Date().toISOString(),
        status: 'Retirada',
        taken_by: data.takenBy || null,
        notes: data.notes || null
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn('⚠️ Falha ao persistir retirada de chave no Supabase:', err.message);
    }
    return localMovement;
  }

  async returnKey(id, notes = '') {
    const localMovement = crmStore.returnKey(id, notes);
    try {
      await supabase.from('crm_chaves_movimentacoes').update({
        returned_at: localMovement.returnedAt || new Date().toISOString(),
        status: 'Devolvida',
        notes: localMovement.notes
      }).eq('id', id);
    } catch (err) {
      console.warn('⚠️ Falha ao atualizar devolução de chave no Supabase:', err.message);
    }
    return localMovement;
  }
}

const crmRepository = new CrmRepository();

module.exports = { crmRepository };
