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
    if (filter.status && filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }
    if (filter.broker) {
      query = query.ilike('broker', `%${filter.broker}%`);
    }
    if (filter.sessionId) {
      query = query.eq('session_id', filter.sessionId);
    }
    if (filter.contactId) {
      query = query.eq('contact_id', filter.contactId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('⚠️ Erro ao consultar visitas no Supabase, usando crmStore local:', error.message);
      return crmStore.getVisits(filter);
    }

    const dbVisits = (data || []).map(v => ({
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
      createdAt: v.created_at,
      updatedAt: v.updated_at
    }));

    // Se houver visitas locais no crmStore (ex: geradas em testes de memória), mescla sem duplicar
    const localVisits = crmStore.getVisits(filter);
    const dbIds = new Set(dbVisits.map(v => v.id));
    for (const lv of localVisits) {
      if (!dbIds.has(lv.id)) {
        dbVisits.push(lv);
      }
    }

    return dbVisits;
  }

  async addVisit(visitData) {
    // 1. Salva localmente em crmStore para consistência imediata
    const createFn = (crmStore.createVisit || crmStore.addVisit).bind(crmStore);
    const localVisit = createFn(visitData);
    
    // 2. Grava no banco de dados Supabase
    try {
      const numId = parseInt(String(visitData.propertyId).replace(/\D/g, ''), 10);
      const { error } = await supabase.from('crm_visitas').upsert({
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

      if (error) {
        console.warn('⚠️ Falha ao persistir visita no Supabase:', error.message);
      }
    } catch (err) {
      console.warn('⚠️ Exceção ao persistir visita no Supabase:', err.message);
    }

    // 3. Registra no Histórico & Auditoria do Imóvel
    try {
      await this.recordPropertyHistory({
        propertyId: visitData.propertyId,
        tipo: 'visita',
        titulo: `Visita Agendada (${localVisit.date} às ${localVisit.time})`,
        descricao: `Visita agendada para o cliente ${visitData.clientName || 'Cliente'} (Tel: ${visitData.clientPhone || 'N/I'}). Corretor: ${visitData.broker || 'Não informado'}.${visitData.notes ? ' Obs: ' + visitData.notes : ''}`,
        autor: visitData.broker || 'Corretor',
        detalhes: { visitId: localVisit.id, clientName: visitData.clientName, date: visitData.date, time: visitData.time }
      });
    } catch (histErr) {
      console.warn('Aviso histórico visita:', histErr.message);
    }

    return localVisit;
  }

  async createVisit(visitData) {
    return this.addVisit(visitData);
  }

  async updateVisit(id, patch) {
    const localUpdated = crmStore.updateVisit(id, patch);

    try {
      const dbPatch = {};
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      if (patch.time !== undefined) dbPatch.time = patch.time;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.broker !== undefined) dbPatch.broker = patch.broker;
      if (patch.clientName !== undefined) dbPatch.client_name = patch.clientName;
      if (patch.clientPhone !== undefined) dbPatch.client_phone = patch.clientPhone;
      dbPatch.updated_at = new Date().toISOString();

      await supabase.from('crm_visitas').update(dbPatch).eq('id', id);
    } catch (err) {
      console.warn('⚠️ Falha ao atualizar visita no Supabase:', err.message);
    }

    return localUpdated;
  }

  async deleteVisit(id) {
    const localDeleted = crmStore.deleteVisit(id);

    try {
      await supabase.from('crm_visitas').delete().eq('id', id);
    } catch (err) {
      console.warn('⚠️ Falha ao excluir visita no Supabase:', err.message);
    }

    return localDeleted;
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
    if (filter.status && filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('⚠️ Erro ao consultar chaves no Supabase, usando crmStore local:', error.message);
      return crmStore.getKeyMovements(filter);
    }

    const dbMovements = (data || []).map(k => ({
      id: k.id,
      propertyId: k.property_custom_id || String(k.codigo_imovel),
      keyTag: k.key_tag,
      takenAt: k.taken_at,
      returnedAt: k.returned_at,
      status: k.status,
      takenBy: k.taken_by,
      notes: k.notes
    }));

    const localMovements = crmStore.getKeyMovements(filter);
    const dbIds = new Set(dbMovements.map(m => m.id));
    for (const lm of localMovements) {
      if (!dbIds.has(lm.id)) {
        dbMovements.push(lm);
      }
    }

    return dbMovements;
  }

  async checkoutKey(data) {
    const fn = (crmStore.checkoutKey || crmStore.takeKey).bind(crmStore);
    const localMovement = fn(data);

    try {
      const numId = parseInt(String(data.propertyId).replace(/\D/g, ''), 10);
      const { error } = await supabase.from('crm_chaves_movimentacoes').upsert({
        id: localMovement.id,
        codigo_imovel: isNaN(numId) ? null : numId,
        property_custom_id: String(data.propertyId || ''),
        key_tag: data.keyTag || null,
        taken_at: localMovement.takenAt || new Date().toISOString(),
        status: 'Retirada',
        taken_by: data.takenBy || null,
        notes: data.notes || null
      }, { onConflict: 'id' });

      if (error) {
        console.warn('⚠️ Falha ao persistir retirada de chave no Supabase:', error.message);
      }
    } catch (err) {
      console.warn('⚠️ Exceção ao persistir retirada de chave no Supabase:', err.message);
    }

    // 3. Registra no Histórico & Auditoria do Imóvel
    try {
      await this.recordPropertyHistory({
        propertyId: data.propertyId,
        tipo: 'chave',
        titulo: `Chave Retirada (${data.keyTag || 'Claviculário'})`,
        descricao: `Chave retirada no claviculário por ${data.takenBy || 'Responsável'}.${data.notes ? ' Obs: ' + data.notes : ''}`,
        autor: data.takenBy || 'Sistema',
        detalhes: { keyId: localMovement.id, keyTag: data.keyTag, takenBy: data.takenBy }
      });
    } catch (histErr) {
      console.warn('Aviso histórico retirada chave:', histErr.message);
    }

    return localMovement;
  }

  async takeKey(data) {
    return this.checkoutKey(data);
  }

  async returnKey(id, notes = '') {
    const localMovement = crmStore.returnKey(id, notes);
    try {
      const { error } = await supabase.from('crm_chaves_movimentacoes').update({
        returned_at: localMovement.returnedAt || new Date().toISOString(),
        status: 'Devolvida',
        notes: localMovement.notes
      }).eq('id', id);

      if (error) {
        console.warn('⚠️ Falha ao atualizar devolução de chave no Supabase:', error.message);
      }
    } catch (err) {
      console.warn('⚠️ Exceção ao atualizar devolução de chave no Supabase:', err.message);
    }

    // Registra no Histórico & Auditoria do Imóvel
    try {
      if (localMovement && localMovement.propertyId) {
        await this.recordPropertyHistory({
          propertyId: localMovement.propertyId,
          tipo: 'chave',
          titulo: `Chave Devolvida ao Claviculário (${localMovement.keyTag || 'Chave'})`,
          descricao: `Chave devolvida ao claviculário.${notes ? ' Obs: ' + notes : ''}`,
          autor: localMovement.takenBy || 'Sistema',
          detalhes: { keyId: localMovement.id, keyTag: localMovement.keyTag, returnNotes: notes }
        });
      }
    } catch (histErr) {
      console.warn('Aviso histórico devolução chave:', histErr.message);
    }

    return localMovement;
  }

  // --- HISTÓRICO & AUDITORIA DO IMÓVEL (TIMELINE) ---
  async recordPropertyHistory(eventData) {
    if (!eventData || !eventData.propertyId) return null;
    const propertyId = String(eventData.propertyId).trim();

    // 1. Grava no crmStore local para consistência e fallback
    const localEvent = crmStore.recordPropertyHistory({
      propertyId,
      tipo: eventData.tipo || eventData.tipo_evento || 'anotacao',
      titulo: eventData.titulo || eventData.titulo_evento || 'Registro no Imóvel',
      descricao: eventData.descricao || '',
      autor: eventData.autor || 'Sistema',
      detalhes: eventData.detalhes || null,
      createdAt: eventData.createdAt || eventData.created_at || new Date().toISOString()
    });

    // 2. Grava no Supabase (crm_imovel_historico)
    try {
      const numId = parseInt(propertyId.replace(/\D/g, ''), 10);
      await supabase.from('crm_imovel_historico').upsert({
        id: localEvent.id,
        codigo_imovel: isNaN(numId) ? null : numId,
        property_custom_id: propertyId,
        tipo_evento: localEvent.tipo,
        titulo_evento: localEvent.titulo,
        descricao: localEvent.descricao,
        autor: localEvent.autor,
        detalhes: localEvent.detalhes,
        created_at: localEvent.createdAt
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn('⚠️ [Histórico] Gravação Supabase falhou (usando store local):', err.message);
    }

    return localEvent;
  }

  async getPropertyHistory(propertyId) {
    if (!propertyId) return [];
    const cleanId = String(propertyId).trim();
    const numId = parseInt(cleanId.replace(/\D/g, ''), 10);

    const timeline = [];
    const seenEventKeys = new Set();

    // 1. Consulta crm_imovel_historico no Supabase
    try {
      let query = supabase.from('crm_imovel_historico').select('*');
      if (!isNaN(numId)) {
        query = query.or(`codigo_imovel.eq.${numId},property_custom_id.eq.${cleanId}`);
      } else {
        query = query.eq('property_custom_id', cleanId);
      }
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const item = {
            id: row.id,
            propertyId: row.property_custom_id || String(row.codigo_imovel),
            tipo: row.tipo_evento,
            titulo: row.titulo_evento,
            descricao: row.descricao,
            autor: row.autor || 'Sistema',
            detalhes: row.detalhes,
            createdAt: row.created_at
          };
          seenEventKeys.add(row.id);
          timeline.push(item);
        }
      }
    } catch (err) {
      console.warn('Aviso consulta histórico Supabase:', err.message);
    }

    // 2. Mescla eventos locais de crmStore
    const localEvents = crmStore.getPropertyHistory(cleanId);
    for (const le of localEvents) {
      if (!seenEventKeys.has(le.id)) {
        seenEventKeys.add(le.id);
        timeline.push(le);
      }
    }

    // 3. Sintetiza visitas vinculadas ao imóvel
    try {
      const visits = await this.getVisits({ propertyId: cleanId });
      for (const v of visits) {
        const visitKey = `vis-event-${v.id}`;
        if (!seenEventKeys.has(visitKey) && !seenEventKeys.has(v.id)) {
          seenEventKeys.add(visitKey);
          timeline.push({
            id: visitKey,
            propertyId: cleanId,
            tipo: 'visita',
            titulo: `Visita ${v.status} (${v.date} às ${v.time})`,
            descricao: `Cliente: ${v.clientName || 'Cliente'} (Tel: ${v.clientPhone || 'N/I'}) • Corretor: ${v.broker || 'Não informado'}${v.notes ? ' • Obs: ' + v.notes : ''}`,
            autor: v.broker || 'Corretor',
            detalhes: { visitId: v.id, clientName: v.clientName, date: v.date, time: v.time, status: v.status },
            createdAt: v.createdAt || new Date(v.date + 'T' + (v.time || '10:00')).toISOString()
          });
        }
      }
    } catch (e) {
      console.warn('Aviso agregação visitas timeline:', e.message);
    }

    // 4. Sintetiza movimentações de chaves vinculadas ao imóvel
    try {
      const keys = await this.getKeyMovements({ propertyId: cleanId });
      for (const k of keys) {
        const keyEventId = `key-event-${k.id}`;
        if (!seenEventKeys.has(keyEventId) && !seenEventKeys.has(k.id)) {
          seenEventKeys.add(keyEventId);
          timeline.push({
            id: keyEventId,
            propertyId: cleanId,
            tipo: 'chave',
            titulo: `Chave ${k.status} (${k.keyTag || 'Claviculário'})`,
            descricao: `Responsável: ${k.takenBy || 'Não informado'}${k.notes ? ' • Obs: ' + k.notes : ''}${k.returnedAt ? ' • Devolvida em: ' + new Date(k.returnedAt).toLocaleString('pt-BR') : ''}`,
            autor: k.takenBy || 'Sistema',
            detalhes: { keyId: k.id, keyTag: k.keyTag, status: k.status, takenAt: k.takenAt, returnedAt: k.returnedAt },
            createdAt: k.returnedAt || k.takenAt || new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.warn('Aviso agregação chaves timeline:', e.message);
    }

    // 5. Ordena cronologicamente decrescente (mais recentes no topo)
    timeline.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return timeline;
  }
}

const crmRepository = new CrmRepository();

module.exports = { crmRepository };
