/**
 * ==========================================================================
 * AGENDAMENTO DE VISITAS • HELENA CRM (SANTOS & MELLO IMÓVEIS)
 * ==========================================================================
 */

(function () {
  'use strict';

  // --- Elementos do DOM ---
  const headerSessionId = document.getElementById('headerSessionId');
  const leadNameTitle = document.getElementById('leadNameTitle');
  const leadPhoneText = document.getElementById('leadPhoneText');
  const badgeAtendimentoStatus = document.getElementById('badgeAtendimentoStatus');
  const statSentCount = document.getElementById('statSentCount');
  const statSelectedCount = document.getElementById('statSelectedCount');

  const visitasLoadingState = document.getElementById('visitasLoadingState');
  const visitasEmptyState = document.getElementById('visitasEmptyState');
  const visitasPropertiesList = document.getElementById('visitasPropertiesList');

  const bottomSelectedCount = document.getElementById('bottomSelectedCount');
  const bottomSelectedLabel = document.getElementById('bottomSelectedLabel');
  const bottomSelectedSub = document.getElementById('bottomSelectedSub');

  const btnSelectAllVisits = document.getElementById('btnSelectAllVisits');
  const btnClearVisits = document.getElementById('btnClearVisits');
  const btnRefreshSession = document.getElementById('btnRefreshSession');
  const btnSaveVisits = document.getElementById('btnSaveVisits');
  const btnCopyWhatsAppMsg = document.getElementById('btnCopyWhatsAppMsg');
  const btnCopyJsonData = document.getElementById('btnCopyJsonData');

  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  // --- Estado da Aplicação ---
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3333' : '';
  const urlParams = new URLSearchParams(window.location.search);

  const sessionIdParam = urlParams.get('sessionId') || urlParams.get('session_id') || '';
  const contactIdParam = urlParams.get('contactId') || urlParams.get('contact_id') || (urlParams.get('id') && urlParams.get('id').includes('-') ? urlParams.get('id') : '');
  const tokenParam = urlParams.get('token') || urlParams.get('helenaToken') || '';

  let currentSessionData = null;
  let sentProperties = [];
  const selectedVisitsMap = new Map(); // key: propertyId, value: { date, time, notes, broker }

  // --- Utilitário de Notificação Toast ---
  let toastTimer = null;
  function showToast(msg, icon = '✅') {
    if (!toast) return;
    toastMessage.textContent = msg;
    toastIcon.textContent = icon;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // --- Cópia Segura Universal com Fallback para Iframes do Helena CRM ---
  async function copyToClipboard(text) {
    if (!text) return false;
    let success = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch (err) {
        console.warn('Clipboard API bloqueada no iframe, usando fallback...', err);
      }
    }

    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        console.error('Falha no fallback de cópia execCommand:', err);
      }
    }

    return success;
  }

  // Feedback Visual nos Botões Clicados
  function triggerButtonFeedback(btn, feedbackText = '✅ Copiado!') {
    if (!btn) return;
    const originalHtml = btn.dataset.originalHtml || btn.innerHTML;
    if (!btn.dataset.originalHtml) {
      btn.dataset.originalHtml = originalHtml;
    }
    btn.innerHTML = `<span>${feedbackText}</span>`;
    setTimeout(() => {
      btn.innerHTML = btn.dataset.originalHtml || originalHtml;
    }, 2200);
  }

  // Calcula data padrão sugerida (amanhã ou próxima segunda-feira)
  function getDefaultSuggestedDate() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) { // Domingo -> pula para segunda
      d.setDate(d.getDate() + 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Formata data ISO para PT-BR (dd/mm/aaaa)
  function formatDatePtBr(isoDate) {
    if (!isoDate) return '';
    const parts = String(isoDate).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  }

  // --- Atualiza Barra de Resumo e Estatísticas ---
  function updateSummaryUI() {
    const count = selectedVisitsMap.size;
    statSelectedCount.textContent = count;
    bottomSelectedCount.textContent = count;

    if (count > 0) {
      bottomSelectedCount.classList.add('has-selected');
      bottomSelectedLabel.textContent = `${count} imóvel(is) marcado(s) para visita`;
      bottomSelectedSub.textContent = 'Revise as datas e horários abaixo antes de salvar ou copiar.';
      btnSaveVisits.removeAttribute('disabled');
      btnCopyWhatsAppMsg.removeAttribute('disabled');
      btnCopyJsonData.removeAttribute('disabled');
    } else {
      bottomSelectedCount.classList.remove('has-selected');
      bottomSelectedLabel.textContent = 'Nenhum imóvel marcado para visita';
      bottomSelectedSub.textContent = 'Marque acima os imóveis que o lead escolheu visitar.';
      btnSaveVisits.setAttribute('disabled', 'true');
      btnCopyWhatsAppMsg.setAttribute('disabled', 'true');
      btnCopyJsonData.setAttribute('disabled', 'true');
    }
  }

  // --- Renderização dos Cards de Imóveis Enviados ---
  function renderPropertiesList(properties) {
    visitasPropertiesList.innerHTML = '';
    const defaultDate = getDefaultSuggestedDate();

    properties.forEach((prop, index) => {
      const pId = String(prop.id || prop.codigo);
      const isSelected = selectedVisitsMap.has(pId);
      const visitData = selectedVisitsMap.get(pId) || {
        date: prop.dataVisita || defaultDate,
        time: prop.horarioVisita || '14:00',
        notes: prop.obsVisita || '',
        broker: prop.corretor || 'Corretor de Plantão'
      };

      const card = document.createElement('div');
      card.className = `visit-card ${isSelected ? 'is-selected' : ''}`;
      card.dataset.id = pId;

      const photo = prop.primaryImage || prop.foto || (prop.images && prop.images[0]) || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80';
      const cleanType = (prop.tipo || prop.propertyType || 'Imóvel').replace('Residential / ', '').replace('Commercial / ', '');
      const transType = prop.finalidade || prop.transactionType || 'Imóvel';
      const title = prop.titulo || prop.title || `${cleanType} em ${prop.bairro || 'Santo André'}`;
      const location = [prop.bairro, prop.cidade].filter(Boolean).join(', ') || 'Santo André - SP';
      const priceFormatted = prop.valorFormatado || prop.priceText || (prop.valor ? `R$ ${Number(prop.valor).toLocaleString('pt-BR')}` : 'Sob Consulta');
      const url = prop.url || prop.websiteUrl || `/?codigo=${pId}`;
      const matchScore = prop.matchScore ? `<span class="visit-card-match-pill">🔥 ${prop.matchScore}% Match</span>` : '';

      card.innerHTML = `
        <div class="visit-card-main">
          <div class="visit-card-thumb-wrap">
            <img src="${photo}" alt="${title}" loading="lazy">
            <span class="visit-card-thumb-tag">${transType}</span>
          </div>

          <div class="visit-card-info">
            <div class="visit-card-header-row">
              <span class="visit-card-code">#${pId}</span>
              <span class="visit-card-badge-type">${cleanType}</span>
              ${matchScore}
            </div>
            <h4 class="visit-card-title" title="${title}">${title}</h4>
            <div class="visit-card-sub-row">
              <span class="visit-card-location">📍 ${location}</span>
              <span class="visit-card-price">${priceFormatted}</span>
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="visit-card-link-ext" title="Ver ficha completa">
                <span>Ver Imóvel ↗</span>
              </a>
            </div>
          </div>

          <label class="visit-card-toggle" title="Marcar este imóvel para visita">
            <input type="checkbox" class="visit-toggle-checkbox" data-id="${pId}" ${isSelected ? 'checked' : ''}>
            <span class="visit-toggle-label">${isSelected ? '✓ Selecionado' : 'Agendar Visita'}</span>
          </label>
        </div>

        <!-- Painel Expansível de Agendamento da Visita -->
        <div class="visit-scheduling-panel">
          <div class="scheduling-grid">
            <div class="form-group">
              <label class="form-label" for="date-${pId}">📅 Data da Visita</label>
              <input type="date" id="date-${pId}" class="form-input input-visit-date" value="${visitData.date}" min="${new Date().toISOString().split('T')[0]}">
            </div>

            <div class="form-group">
              <label class="form-label" for="time-${pId}">⏰ Horário Previsto</label>
              <input type="time" id="time-${pId}" class="form-input input-visit-time" value="${visitData.time}">
              <div class="quick-time-buttons">
                <button type="button" class="btn-time-chip" data-time="09:30">09:30</button>
                <button type="button" class="btn-time-chip" data-time="11:00">11:00</button>
                <button type="button" class="btn-time-chip" data-time="14:00">14:00</button>
                <button type="button" class="btn-time-chip" data-time="15:30">15:30</button>
                <button type="button" class="btn-time-chip" data-time="17:00">17:00</button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="notes-${pId}">📝 Observações da Visita</label>
              <input type="text" id="notes-${pId}" class="form-input input-visit-notes" placeholder="Ex: Chave na portaria, cliente prefere no final da tarde..." value="${visitData.notes}">
            </div>
          </div>
        </div>
      `;

      // Evento de Toggle do Checkbox
      const checkbox = card.querySelector('.visit-toggle-checkbox');
      const toggleLabel = card.querySelector('.visit-toggle-label');
      const inputDate = card.querySelector('.input-visit-date');
      const inputTime = card.querySelector('.input-visit-time');
      const inputNotes = card.querySelector('.input-visit-notes');

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          card.classList.add('is-selected');
          toggleLabel.textContent = '✓ Selecionado';
          selectedVisitsMap.set(pId, {
            propertyId: pId,
            propertyTitle: title,
            propertyNeighborhood: prop.bairro || '',
            propertyType: cleanType,
            propertyUrl: url,
            propertyPrice: priceFormatted,
            date: inputDate.value || defaultDate,
            time: inputTime.value || '14:00',
            notes: inputNotes.value || '',
            broker: 'Corretor de Plantão'
          });
        } else {
          card.classList.remove('is-selected');
          toggleLabel.textContent = 'Agendar Visita';
          selectedVisitsMap.delete(pId);
        }
        updateSummaryUI();
      });

      // Atualiza valores digitados no Map
      inputDate.addEventListener('input', () => {
        if (selectedVisitsMap.has(pId)) {
          selectedVisitsMap.get(pId).date = inputDate.value;
        }
      });

      inputTime.addEventListener('input', () => {
        if (selectedVisitsMap.has(pId)) {
          selectedVisitsMap.get(pId).time = inputTime.value;
        }
      });

      inputNotes.addEventListener('input', () => {
        if (selectedVisitsMap.has(pId)) {
          selectedVisitsMap.get(pId).notes = inputNotes.value;
        }
      });

      // Botões rápidos de horário
      card.querySelectorAll('.btn-time-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = btn.dataset.time;
          inputTime.value = t;
          if (selectedVisitsMap.has(pId)) {
            selectedVisitsMap.get(pId).time = t;
          }
        });
      });

      visitasPropertiesList.appendChild(card);
    });

    visitasLoadingState.style.display = 'none';
    visitasEmptyState.style.display = 'none';
    visitasPropertiesList.style.display = 'flex';
    updateSummaryUI();
  }

  // --- Carregamento da Sessão e Metadados do Helena CRM ---
  async function loadSessionVisitasData() {
    visitasLoadingState.style.display = 'block';
    visitasEmptyState.style.display = 'none';
    visitasPropertiesList.style.display = 'none';

    const targetContactId = contactIdParam;
    const targetSessionId = sessionIdParam;

    if (!targetContactId && !targetSessionId) {
      visitasLoadingState.style.display = 'none';
      headerSessionId.textContent = 'Modo Demonstração (Sem sessão informada)';
      leadNameTitle.textContent = 'Atendimento Geral';
      leadPhoneText.textContent = 'Abra com ?sessionId=... ou ?contactId=...';
      badgeAtendimentoStatus.textContent = 'Demonstração';
      visitasEmptyState.style.display = 'block';
      return;
    }

    try {
      headerSessionId.textContent = targetSessionId ? `#${targetSessionId.slice(0, 18)}...` : `Lead #${targetContactId.slice(0, 18)}...`;

      const qParams = new URLSearchParams();
      if (targetSessionId) qParams.set('sessionId', targetSessionId);
      if (targetContactId) qParams.set('contactId', targetContactId);
      if (tokenParam) qParams.set('token', tokenParam);

      const res = await fetch(`${API_BASE}/api/leads/session-metadata?${qParams.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao consultar metadados da sessão.');
      }

      currentSessionData = data;
      headerSessionId.textContent = `#${data.sessionId || targetSessionId || 'Ativo'}`;

      // Consulta dados do contato para obter nome e telefone caso tenha contactId
      const contactIdToQuery = data.contactId || targetContactId;
      if (contactIdToQuery) {
        try {
          const contactRes = await fetch(`${API_BASE}/api/leads/match?contactId=${encodeURIComponent(contactIdToQuery)}&limit=1`);
          const contactJson = await contactRes.json();
          if (contactJson.contact) {
            leadNameTitle.textContent = contactJson.contact.name || `Lead #${contactIdToQuery.slice(0, 8)}`;
            leadPhoneText.textContent = contactJson.contact.phoneNumber ? `📱 ${contactJson.contact.phoneNumber}` : '📱 Helena CRM';
          }
        } catch (_) {
          leadNameTitle.textContent = `Atendimento Lead #${contactIdToQuery.slice(0, 8)}`;
          leadPhoneText.textContent = '📱 Helena CRM';
        }
      } else {
        leadNameTitle.textContent = 'Atendimento em Andamento';
        leadPhoneText.textContent = '📱 Helena CRM';
      }

      sentProperties = Array.isArray(data.imoveisEnviados) ? data.imoveisEnviados : [];
      statSentCount.textContent = sentProperties.length;

      // Restaura visitas previamente agendadas se existirem no metadata
      selectedVisitsMap.clear();
      const existingVisits = Array.isArray(data.visitasAgendadas) ? data.visitasAgendadas : (data.metadata?.visitasAgendadas || []);
      existingVisits.forEach(v => {
        if (v && v.propertyId) {
          selectedVisitsMap.set(String(v.propertyId), v);
        }
      });

      if (sentProperties.length === 0) {
        visitasLoadingState.style.display = 'none';
        visitasEmptyState.style.display = 'block';
        return;
      }

      renderPropertiesList(sentProperties);
    } catch (err) {
      console.error('Erro ao carregar sessão:', err);
      visitasLoadingState.style.display = 'none';
      visitasEmptyState.style.display = 'block';
      showToast(`⚠️ Não foi possível sincronizar a sessão: ${err.message}`, '⚠️');
    }
  }

  // --- Ação: Marcar Todos ---
  btnSelectAllVisits.addEventListener('click', () => {
    document.querySelectorAll('.visit-card').forEach(card => {
      const cb = card.querySelector('.visit-toggle-checkbox');
      if (cb && !cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event('change'));
      }
    });
    showToast('Todos os imóveis marcados para visita.');
  });

  // --- Ação: Desmarcar Todos ---
  btnClearVisits.addEventListener('click', () => {
    document.querySelectorAll('.visit-card').forEach(card => {
      const cb = card.querySelector('.visit-toggle-checkbox');
      if (cb && cb.checked) {
        cb.checked = false;
        cb.dispatchEvent(new Event('change'));
      }
    });
    showToast('Seleção de visitas limpa.');
  });

  if (btnRefreshSession) {
    btnRefreshSession.addEventListener('click', () => {
      loadSessionVisitasData();
    });
  }

  // --- Ação: Salvar Visitas no CRM e no Session Metadata ---
  btnSaveVisits.addEventListener('click', async () => {
    const visits = Array.from(selectedVisitsMap.values());
    if (visits.length === 0) {
      showToast('Selecione pelo menos um imóvel para visita antes de salvar.', '⚠️');
      return;
    }

    const originalText = btnSaveVisits.innerHTML;
    btnSaveVisits.innerHTML = '<span>⏳ Salvando...</span>';
    btnSaveVisits.setAttribute('disabled', 'true');

    try {
      const payload = {
        sessionId: currentSessionData?.sessionId || sessionIdParam || undefined,
        contactId: currentSessionData?.contactId || contactIdParam || undefined,
        token: tokenParam || undefined,
        clientName: leadNameTitle.textContent !== 'Identificando lead...' ? leadNameTitle.textContent : undefined,
        clientPhone: leadPhoneText.textContent.replace('📱 ', '') || undefined,
        visits
      };

      const res = await fetch(`${API_BASE}/api/leads/schedule-visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Falha ao salvar agendamento.');
      }

      triggerButtonFeedback(btnSaveVisits, '✅ Visitas Salvas com Sucesso!');
      showToast(`🎉 ${visits.length} visita(s) confirmada(s) e registradas no atendimento!`, '🎉');
    } catch (err) {
      console.error('Erro ao salvar visitas:', err);
      showToast(`Erro ao salvar: ${err.message}`, '❌');
      btnSaveVisits.innerHTML = originalText;
      btnSaveVisits.removeAttribute('disabled');
    }
  });

  // --- Ação: Copiar Mensagem de Confirmação para WhatsApp ---
  btnCopyWhatsAppMsg.addEventListener('click', async () => {
    const visits = Array.from(selectedVisitsMap.values());
    if (visits.length === 0) {
      showToast('Selecione pelo menos um imóvel para gerar a mensagem.', '⚠️');
      return;
    }

    const clientName = leadNameTitle.textContent && !leadNameTitle.textContent.includes('Lead')
      ? leadNameTitle.textContent.split(' ')[0]
      : 'Cliente';

    const lines = [
      `Olá, ${clientName}! 👋`,
      `Confirmamos o agendamento das suas visitas com a Santos & Mello Imóveis:`,
      `----------------------------------------`
    ];

    visits.forEach((v, idx) => {
      const dateFormatted = formatDatePtBr(v.date);
      lines.push(
        `📍 *Visita ${idx + 1}: ${v.propertyTitle || `Imóvel #${v.propertyId}`}*`,
        `📅 *Data:* ${dateFormatted} às ${v.time}`,
        v.propertyNeighborhood ? `📌 *Bairro:* ${v.propertyNeighborhood}` : '',
        v.notes ? `📝 *Observação:* ${v.notes}` : '',
        v.propertyUrl ? `🔗 *Ficha Completa:* ${v.propertyUrl}` : '',
        `----------------------------------------`
      );
    });

    lines.push(`Nosso corretor estará no local no horário agendado. Qualquer dúvida ou alteração, é só nos avisar por aqui! 😊`);

    const msg = lines.filter(Boolean).join('\n');
    await copyToClipboard(msg);
    triggerButtonFeedback(btnCopyWhatsAppMsg, '✅ Mensagem Copiada!');
    showToast('📋 Mensagem pronta copiada! Cole no WhatsApp do cliente.');
  });

  // --- Ação: Copiar JSON Estruturado para Integrações (n8n / CRM) ---
  btnCopyJsonData.addEventListener('click', async () => {
    const visits = Array.from(selectedVisitsMap.values());
    if (visits.length === 0) {
      showToast('Selecione pelo menos um imóvel para exportar os dados.', '⚠️');
      return;
    }

    const payload = {
      tipoEvento: 'VISITAS_AGENDADAS',
      timestamp: new Date().toISOString(),
      sessionId: currentSessionData?.sessionId || sessionIdParam || null,
      contactId: currentSessionData?.contactId || contactIdParam || null,
      leadName: leadNameTitle.textContent || null,
      leadPhone: leadPhoneText.textContent.replace('📱 ', '') || null,
      totalVisitas: visits.length,
      visitas: visits.map(v => ({
        propertyId: v.propertyId,
        titulo: v.propertyTitle,
        bairro: v.propertyNeighborhood,
        tipo: v.propertyType,
        valor: v.propertyPrice,
        data: v.date,
        dataPtBr: formatDatePtBr(v.date),
        horario: v.time,
        observacoes: v.notes,
        corretor: v.broker,
        url: v.propertyUrl
      }))
    };

    await copyToClipboard(JSON.stringify(payload, null, 2));
    triggerButtonFeedback(btnCopyJsonData, '✅ JSON Copiado!');
    showToast('📋 Estrutura JSON copiada com sucesso para o n8n!');
  });

  // --- Inicialização ---
  loadSessionVisitasData();

})();
