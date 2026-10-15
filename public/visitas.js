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
  const operationalDataMap = new Map(); // key: propertyId, value: { loading, data, error }

  // --- Consulta de Dados Operacionais Imoview (Chave, Captador, Locador) ---
  async function fetchOperationalData(pId, force = false) {
    if (!pId) return;

    if (!force && operationalDataMap.has(pId)) {
      const cached = operationalDataMap.get(pId);
      if (!cached.loading) {
        renderOperationalPanel(pId);
        return;
      }
    }

    operationalDataMap.set(pId, { loading: true, data: null, error: null });
    renderOperationalPanel(pId);

    try {
      const res = await fetch(`${API_BASE}/api/imoveis/${encodeURIComponent(pId)}/detalhes-operacionais`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro na consulta do Imoview');
      }
      operationalDataMap.set(pId, { loading: false, data, error: null });
    } catch (err) {
      console.warn(`Aviso ao consultar Imoview para imóvel #${pId}:`, err.message);
      operationalDataMap.set(pId, { loading: false, data: null, error: err.message });
    }

    renderOperationalPanel(pId);
  }

  // --- Renderização do Painel Operacional Imoview ---
  function renderOperationalPanel(pId) {
    const panel = document.getElementById(`op-panel-${pId}`);
    if (!panel) return;

    const state = operationalDataMap.get(pId);
    if (!state || state.loading) {
      panel.innerHTML = `
        <div class="op-loading-state">
          <div class="op-mini-spinner"></div>
          <span>Consultando localização da chave, captador e locador no Imoview...</span>
        </div>
      `;
      return;
    }

    if (state.error && !state.data) {
      panel.innerHTML = `
        <div class="op-loading-state" style="color: #b91c1c;">
          <span>⚠️ Não foi possível obter os dados do Imoview: ${state.error}</span>
        </div>
      `;
      return;
    }

    const d = state.data || {};
    const chave = d.chave || { local: 'Não informada', formatado: 'Não informada' };
    const captadores = Array.isArray(d.captadores) && d.captadores.length > 0 ? d.captadores : [];
    const proprietarios = Array.isArray(d.proprietarios) && d.proprietarios.length > 0 ? d.proprietarios : [];

    const keyNumberBadge = (chave.numero !== null && chave.numero !== undefined && String(chave.numero).trim() !== '' && String(chave.numero) !== '0')
      ? `<span class="op-key-badge">Chave nº ${chave.numero}</span>`
      : '';

    // Bloco Captador
    let captadorHtml = '<span class="op-sub-val" style="color: #94a3b8;">Não informado</span>';
    if (captadores.length > 0) {
      const c = captadores[0];
      const telClean = (c.telefone || '').replace(/\\D/g, '');
      const telLink = c.telefone ? `<a href="tel:${telClean}" class="op-contact-link">📞 ${c.telefone}</a>` : '';
      const emailText = c.email ? ` • ✉️ ${c.email}` : '';
      captadorHtml = `
        <div class="op-main-val">${c.nome}</div>
        <div class="op-sub-val">${telLink}${emailText}</div>
      `;
    }

    // Bloco Proprietário / Locador
    let propHtml = '';
    if (proprietarios.length > 0) {
      const p = proprietarios[0];
      const percText = p.percentual && p.percentual !== '100,00' ? ` (${p.percentual}%)` : '';
      const telClean = (p.telefone || '').replace(/\\D/g, '');
      const telLink = p.telefone ? `<a href="https://wa.me/55${telClean}" target="_blank" rel="noopener" class="op-contact-link">📱 ${p.telefone}</a>` : '';
      const emailText = p.email ? ` • ✉️ ${p.email}` : '';
      propHtml = `
        <div class="op-main-val">${p.nome}${percText}</div>
        <div class="op-sub-val">${telLink || 'Telefone não cadastrado'}${emailText}</div>
      `;
    } else {
      const subMsg = d.ownersInfo?.notConfigured
        ? 'Sessão interna do app Imoview não configurada'
        : (d.ownersInfo?.sessionExpired ? 'Sessão do app Imoview expirou' : 'Não informado na API pública');
      propHtml = `
        <div class="op-main-val" style="color: #64748b; font-size: 0.84rem;">Não informado</div>
        <div class="op-sub-val" style="font-size: 0.72rem; color: #94a3b8;">(${subMsg})</div>
      `;
    }

    // Bloco de Notas Internas
    const notesHtml = d.anotacoes ? `
      <div class="op-notes-banner">
        <span>📌</span>
        <div><strong>Nota interna Imoview:</strong> ${d.anotacoes.replace(/\\r?\\n/g, ' • ')}</div>
      </div>
    ` : '';

    panel.innerHTML = `
      <div class="op-panel-header">
        <div class="op-panel-title-group">
          <span class="op-panel-title">🔑 Logística da Visita • Imoview</span>
          <span class="op-source-badge">${d.codigoAuxiliar ? `Ref: ${d.codigoAuxiliar}` : `#${pId}`}</span>
          ${d.situacao ? `<span class="op-source-badge" style="background: #dcfce7; color: #166534;">${d.situacao}</span>` : ''}
        </div>
        <button type="button" class="btn-op-refresh" data-id="${pId}" title="Atualizar dados do Imoview">
          <span>🔄 Atualizar</span>
        </button>
      </div>

      <div class="op-grid-cards">
        <!-- Caixa da Chave -->
        <div class="op-box">
          <div class="op-box-header">
            <span class="op-box-title">🔑 Local da Chave</span>
            ${keyNumberBadge}
          </div>
          <div class="op-main-val">${chave.local || 'Imobiliária'}</div>
          <div class="op-sub-val">${chave.identificador ? `Unidade: ${chave.identificador}` : 'Identificação no chaveiro da imobiliária'}</div>
        </div>

        <!-- Caixa do Captador -->
        <div class="op-box">
          <div class="op-box-header">
            <span class="op-box-title">🤝 Captador do Imóvel</span>
          </div>
          ${captadorHtml}
        </div>

        <!-- Caixa do Locador / Proprietário -->
        <div class="op-box">
          <div class="op-box-header">
            <span class="op-box-title">👤 Locador / Proprietário</span>
          </div>
          ${propHtml}
        </div>
      </div>

      ${notesHtml}
    `;

    // Botão de refresh individual
    const btnRefresh = panel.querySelector('.btn-op-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', (e) => {
        e.stopPropagation();
        fetchOperationalData(pId, true);
      });
    }
  }

  // Pré-carrega dados operacionais em segundo plano assim que a tela abre
  function preloadOperationalData(properties) {
    if (!Array.isArray(properties)) return;
    properties.forEach((prop, idx) => {
      const pId = String(prop.id || prop.codigo);
      if (!pId || pId.startsWith('TEST')) return;
      setTimeout(() => {
        fetchOperationalData(pId);
      }, idx * 120);
    });
  }

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

  // Constrói ou valida a URL oficial funcional do site Santos & Mello (com slug do título)
  function resolvePropertyWebsiteUrl(prop) {
    const pId = String(prop.id || prop.codigo || '').trim();
    const candidateUrl = prop.websiteUrl || prop.url || '';

    // Se já tiver slug válido no padrão do site oficial (ex: https://www.santosemello.com.br/imovel/slug-do-titulo/1234)
    if (candidateUrl.includes('santosemello.com.br/imovel/') && candidateUrl.replace(/\/+$/, '').split('/').length >= 6) {
      return candidateUrl;
    }

    const title = prop.titulo || prop.title || '';
    if (title && pId) {
      const slug = title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[.,]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `https://www.santosemello.com.br/imovel/${slug}/${encodeURIComponent(pId)}`;
    }

    return candidateUrl || `https://www.santosemello.com.br/imovel/${encodeURIComponent(pId)}`;
  }

  // --- Renderização dos Cards de Imóveis Enviados ---
  function renderPropertiesList(properties) {
    visitasPropertiesList.innerHTML = '';
    const defaultDate = getDefaultSuggestedDate();

    // Filtra IDs de teste ou mocks
    const validProperties = properties.filter(p => {
      const pId = String(p.id || p.codigo || '').toUpperCase();
      return !pId.startsWith('TEST') && pId !== 'MOCK';
    });

    if (validProperties.length === 0) {
      visitasLoadingState.style.display = 'none';
      visitasEmptyState.style.display = 'block';
      visitasPropertiesList.style.display = 'none';
      updateSummaryUI();
      return;
    }

    validProperties.forEach((prop, index) => {
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

      const photo = prop.primaryImage || prop.foto || (Array.isArray(prop.images) && prop.images[0]) || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80';
      const cleanType = (prop.tipo || prop.propertyType || 'Imóvel').replace('Residential / ', '').replace('Commercial / ', '');
      const transType = prop.finalidade || prop.transactionType || 'Imóvel';
      const title = prop.titulo || prop.title || `${cleanType} em ${prop.bairro || 'Santo André'}`;
      const location = [prop.bairro, prop.cidade].filter(Boolean).join(', ') || 'Santo André - SP';
      const priceFormatted = prop.valorFormatado || prop.priceText || (prop.valor ? `R$ ${Number(prop.valor).toLocaleString('pt-BR')}` : 'Sob Consulta');
      const url = resolvePropertyWebsiteUrl(prop);
      const matchScore = prop.matchScore ? `<span class="visit-card-match-pill">🔥 ${prop.matchScore}% Match</span>` : '';

      card.innerHTML = `
        <div class="visit-card-main">
          <div class="visit-card-thumb-wrap">
            <img src="${photo}" alt="${title}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80';">
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
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="visit-card-link-ext" title="Ver ficha completa no site da imobiliária">
                <span>Ver Imóvel ↗</span>
              </a>
            </div>
            <!-- Botão de Expandir Chave, Captador e Locador -->
            <div class="visit-card-actions-row">
              <button type="button" class="btn-toggle-logistics" data-id="${pId}" title="Consultar localização da chave, captador e locador no Imoview">
                <span>🔑 Chave, Captador e Locador</span>
                <span class="logistics-chevron">▼</span>
              </button>
            </div>
          </div>

          <label class="visit-card-toggle" title="Marcar este imóvel para visita">
            <input type="checkbox" class="visit-toggle-checkbox" data-id="${pId}" ${isSelected ? 'checked' : ''}>
            <span class="visit-toggle-label">${isSelected ? '✓ Selecionado' : 'Agendar Visita'}</span>
          </label>
        </div>

        <!-- Painel Operacional Imoview (Chave, Captador, Locador) -->
        <div class="visit-operational-panel" id="op-panel-${pId}">
          <div class="op-loading-state">
            <div class="op-mini-spinner"></div>
            <span>Consultando localização da chave, captador e locador no Imoview...</span>
          </div>
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

      // Eventos de Logística Operacional (Chave, Captador, Locador)
      const btnLogistics = card.querySelector('.btn-toggle-logistics');
      const opPanel = card.querySelector(`#op-panel-${pId}`);

      btnLogistics.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = opPanel.classList.toggle('is-open');
        btnLogistics.classList.toggle('is-active', isOpen);
        if (isOpen) {
          fetchOperationalData(pId);
        }
      });

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

          // Ao marcar para agendar, abre automaticamente o painel de logística e busca os dados
          opPanel.classList.add('is-open');
          btnLogistics.classList.add('is-active');
          fetchOperationalData(pId);

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

    // Pré-carrega os dados do Imoview em background assim que a tela abre
    preloadOperationalData(validProperties);

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
      visitas: visits.map(v => {
        const op = operationalDataMap.get(v.propertyId)?.data;
        return {
          propertyId: v.propertyId,
          codigoAuxiliar: op?.codigoAuxiliar || null,
          titulo: v.propertyTitle,
          bairro: v.propertyNeighborhood,
          tipo: v.propertyType,
          valor: v.propertyPrice,
          data: v.date,
          dataPtBr: formatDatePtBr(v.date),
          horario: v.time,
          observacoes: v.notes,
          corretor: v.broker,
          url: v.propertyUrl,
          logistica: {
            chave: op?.chave || null,
            captadores: op?.captadores || [],
            proprietarios: op?.proprietarios || [],
            anotacoesInternas: op?.anotacoes || null
          }
        };
      })
    };

    await copyToClipboard(JSON.stringify(payload, null, 2));
    triggerButtonFeedback(btnCopyJsonData, '✅ JSON Copiado!');
    showToast('📋 Estrutura JSON copiada com sucesso para o n8n!');
  });

  // --- Inicialização ---
  loadSessionVisitasData();

})();
