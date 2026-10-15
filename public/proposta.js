/**
 * ============================================================================
 * JAVASCRIPT • FICHA DE VISITA & PROPOSTA (SANTOS & MELLO IMÓVEIS)
 * Integração com Helena CRM, seleção de imóveis enviados/agendados e PDF A4
 * ============================================================================
 */

(function () {
  'use strict';

  // --- Estado Global da Proposta ---
  const state = {
    atendimento: '5861',
    dataDocumento: new Date().toISOString().split('T')[0],
    corretor: 'Matheus dos Santos Cruz',
    client: {
      name: 'Kelly',
      phone: '(11) 95340-7249',
      address: ''
    },
    // Lista completa de imóveis do atendimento (enviados no chat + agendados para visita)
    allProperties: [
      {
        id: '5586',
        address: 'Rua Almada, 270, Individual, CEP 09260-420',
        neighborhood: 'Jardim Santo Alberto - Santo André',
        value: 'R$ 1.600,00',
        selected: true,
        isScheduled: true,
        source: 'visita'
      }
    ],
    proposal: {
      rentValue: '1.600,00',
      termMonths: '30',
      dueDay: '10',
      guarantee: 'seguro',
      notes: ''
    },
    isManualMode: false,
    zoomLevel: 1.0
  };

  // --- Elementos do DOM ---
  // Ações do Cabeçalho e Navegação
  const btnPrintPdf = document.getElementById('btnPrintPdf');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  const btnCopyProposalWhatsApp = document.getElementById('btnCopyProposalWhatsApp');
  const leadSessionChip = document.getElementById('leadSessionChip');
  const leadSessionText = document.getElementById('leadSessionText');
  const headerLinkCatalog = document.getElementById('headerLinkCatalog');
  const headerLinkVisitas = document.getElementById('headerLinkVisitas');
  const headerLinkProposta = document.getElementById('headerLinkProposta');

  // Modo Manual vs Digital
  const checkManualMode = document.getElementById('checkManualMode');
  const manualModeLabel = document.getElementById('manualModeLabel');

  // Formulário: Atendimento & Corretor
  const inputAtendimento = document.getElementById('inputAtendimento');
  const inputDataDoc = document.getElementById('inputDataDoc');
  const inputCorretor = document.getElementById('inputCorretor');

  // Formulário: Cliente
  const inputClienteNome = document.getElementById('inputClienteNome');
  const inputClienteTel = document.getElementById('inputClienteTel');
  const inputClienteEnd = document.getElementById('inputClienteEnd');

  // Formulário: Imóveis
  const inputQuickCode = document.getElementById('inputQuickCode');
  const btnQuickAddProp = document.getElementById('btnQuickAddProp');
  const attendancePropsChecklist = document.getElementById('attendancePropsChecklist');
  const btnSelectAllProps = document.getElementById('btnSelectAllProps');
  const btnSelectScheduledOnly = document.getElementById('btnSelectScheduledOnly');
  const btnUnselectAllProps = document.getElementById('btnUnselectAllProps');
  const badgePropsCount = document.getElementById('badgePropsCount');

  // Formulário: Proposta
  const inputValorAluguel = document.getElementById('inputValorAluguel');
  const inputPrazoLocacao = document.getElementById('inputPrazoLocacao');
  const selectDiaVencimento = document.getElementById('selectDiaVencimento');
  const wrapDiaCustom = document.getElementById('wrapDiaCustom');
  const inputDiaCustom = document.getElementById('inputDiaCustom');
  const inputObsProposta = document.getElementById('inputObsProposta');

  // Folha A4 • Elementos de Preview
  const printableSheet = document.getElementById('printableSheet');
  const docAtendimentoVal = document.getElementById('docAtendimentoVal');
  const docClienteNomeVal = document.getElementById('docClienteNomeVal');
  const docClienteEndVal = document.getElementById('docClienteEndVal');
  const docClienteTelVal = document.getElementById('docClienteTelVal');
  const docCorretorVal = document.getElementById('docCorretorVal');
  const docPropertiesTbody = document.getElementById('docPropertiesTbody');
  const docCityDateVal = document.getElementById('docCityDateVal');
  const docSignerName1 = document.getElementById('docSignerName1');
  const docValorAluguelVal = document.getElementById('docValorAluguelVal');
  const docPrazoLocacaoVal = document.getElementById('docPrazoLocacaoVal');
  const docDiaVencimentoVal = document.getElementById('docDiaVencimentoVal');
  const docGuaranteeChecks = document.getElementById('docGuaranteeChecks');
  const docObsContent = document.getElementById('docObsContent');
  const docSignatureDateDay = document.getElementById('docSignatureDateDay');
  const docSignatureDateMonth = document.getElementById('docSignatureDateMonth');
  const docSignatureDateYear = document.getElementById('docSignatureDateYear');
  const docSignerName2 = document.getElementById('docSignerName2');

  // Controles de Zoom
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const btnZoomReset = document.getElementById('btnZoomReset');
  const zoomLevelText = document.getElementById('zoomLevelText');

  // Toast
  const toastNotification = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  // --- Funções Utilitárias ---
  function showToast(text, icon = '📋') {
    toastMsg.textContent = text;
    toastIcon.textContent = icon;
    toastNotification.classList.add('is-visible');
    setTimeout(() => {
      toastNotification.classList.remove('is-visible');
    }, 2800);
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  /**
   * Formata data para o padrão por extenso: "Santo André, quinta-feira, 15 de outubro de 2026"
   */
  function formatDateToPortugueseFull(dateStr) {
    if (!dateStr) return 'Santo André, SP';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];

    const diaSemana = diasSemana[date.getDay()];
    const diaNum = date.getDate();
    const mesNome = meses[date.getMonth()];
    const anoNum = date.getFullYear();

    return `Santo André, ${diaSemana}, ${diaNum} de ${mesNome} de ${anoNum}`;
  }

  // --- Renderização Geral (Preview A4 + Checklist Lateral) ---
  function renderAll() {
    // 1. Dados do Atendimento e Corretor
    docAtendimentoVal.textContent = state.atendimento || '__________';
    docCorretorVal.textContent = state.corretor || 'Corretor Autônomo';

    // 2. Dados do Cliente
    docClienteNomeVal.textContent = state.client.name || '______________________________';
    docClienteEndVal.textContent = state.client.address || '';
    docClienteTelVal.textContent = state.client.phone || '______________________________';
    docSignerName1.textContent = state.client.name || 'Cliente';
    docSignerName2.textContent = state.client.name || 'Cliente';

    // 3. Data por Extenso na Folha
    docCityDateVal.textContent = formatDateToPortugueseFull(state.dataDocumento);

    // 4. Imóveis Selecionados para a Folha A4
    const selectedProps = state.allProperties.filter(p => p.selected);
    docPropertiesTbody.innerHTML = '';

    if (selectedProps.length === 0) {
      const trEmpty = document.createElement('tr');
      trEmpty.innerHTML = `
        <td class="col-cod">____</td>
        <td class="col-endereco">____________________________________________________________</td>
        <td class="col-bairro">______________________________</td>
        <td class="col-valor">R$ __________</td>
      `;
      docPropertiesTbody.appendChild(trEmpty);
    } else {
      selectedProps.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="col-cod">${p.id || ''}</td>
          <td class="col-endereco">${p.address || ''}</td>
          <td class="col-bairro">${p.neighborhood || ''}</td>
          <td class="col-valor">${p.value || ''}</td>
        `;
        docPropertiesTbody.appendChild(tr);
      });
    }

    badgePropsCount.textContent = `${selectedProps.length} selecionado${selectedProps.length !== 1 ? 's' : ''} de ${state.allProperties.length}`;

    // 5. Proposta (Digital vs. Manual)
    if (state.isManualMode) {
      docValorAluguelVal.textContent = '______________________________';
      docPrazoLocacaoVal.textContent = '________';
      docDiaVencimentoVal.textContent = '__________';

      docGuaranteeChecks.innerHTML = `
        <span class="guarantee-box-item">[ &nbsp; ] Seguro Fiança</span>
        <span class="guarantee-box-item">[ &nbsp; ] Fiador</span>
        <span class="guarantee-box-item">[ &nbsp; ] Título de Capitalização</span>
      `;

      docObsContent.innerHTML = `
        <div class="obs-line">_________________________________________________________________________________________________</div>
        <div class="obs-line">_________________________________________________________________________________________________</div>
      `;

      docSignatureDateDay.textContent = '___________';
      docSignatureDateMonth.textContent = '___________';
      docSignatureDateYear.textContent = '___________';
    } else {
      docValorAluguelVal.textContent = state.proposal.rentValue || '______________________________';
      docPrazoLocacaoVal.textContent = state.proposal.termMonths || '30';
      docDiaVencimentoVal.textContent = state.proposal.dueDay || '10';

      const g = state.proposal.guarantee;
      docGuaranteeChecks.innerHTML = `
        <span class="guarantee-box-item">${g === 'seguro' ? '[ X ]' : '[ &nbsp; ]'} Seguro Fiança</span>
        <span class="guarantee-box-item">${g === 'fiador' ? '[ X ]' : '[ &nbsp; ]'} Fiador</span>
        <span class="guarantee-box-item">${g === 'titulo' ? '[ X ]' : '[ &nbsp; ]'} Título de Capitalização</span>
        ${g === 'caucao' ? '<span class="guarantee-box-item">[ X ] Caução</span>' : ''}
      `;

      if (state.proposal.notes && state.proposal.notes.trim()) {
        docObsContent.innerHTML = `
          <div class="obs-line" style="font-weight: 600; text-decoration: underline;">${state.proposal.notes.trim()}</div>
        `;
      } else {
        docObsContent.innerHTML = `
          <div class="obs-line">_________________________________________________________________________________________________</div>
          <div class="obs-line">_________________________________________________________________________________________________</div>
        `;
      }

      if (state.dataDocumento) {
        const [y, m, d] = state.dataDocumento.split('-');
        docSignatureDateDay.textContent = d;
        docSignatureDateMonth.textContent = m;
        docSignatureDateYear.textContent = y;
      }
    }

    // Renderiza a lista interativa de seleção na barra lateral
    renderChecklist();
  }

  // --- Renderização da Checklist Interativa de Imóveis ---
  function renderChecklist() {
    attendancePropsChecklist.innerHTML = '';

    if (state.allProperties.length === 0) {
      attendancePropsChecklist.innerHTML = `
        <div class="empty-checklist-msg">
          Nenhum imóvel vinculado a este atendimento. Utilize o campo abaixo para buscar e adicionar por código.
        </div>
      `;
      return;
    }

    state.allProperties.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = `prop-check-card ${p.selected ? 'is-selected' : ''}`;
      card.dataset.index = idx;

      let tagHtml = '';
      if (p.isScheduled) {
        tagHtml = '<span class="prop-tag-badge prop-tag-scheduled">📅 Marcado p/ Visita</span>';
      } else if (p.source === 'enviado') {
        tagHtml = '<span class="prop-tag-badge prop-tag-sent">📤 Enviado</span>';
      } else {
        tagHtml = '<span class="prop-tag-badge prop-tag-manual">➕ Adicionado</span>';
      }

      card.innerHTML = `
        <div class="prop-check-top">
          <label class="prop-check-label">
            <input type="checkbox" class="prop-check-checkbox" data-index="${idx}" ${p.selected ? 'checked' : ''}>
            <span>#${p.id || 'Imóvel'}</span>
          </label>
          ${tagHtml}
        </div>
        <div class="prop-check-addr">
          <strong>${p.neighborhood || 'Santo André'}</strong><br>
          ${p.address || 'Endereço sob consulta'}
        </div>
        <div class="prop-check-bottom">
          <span class="prop-check-val">${p.value || 'Sob Consulta'}</span>
          <button type="button" class="btn-use-as-rent" data-index="${idx}" title="Definir este valor como o aluguel ofertado na proposta">
            Usar como Aluguel
          </button>
        </div>
      `;

      attendancePropsChecklist.appendChild(card);
    });

    // Conecta eventos de marcar/desmarcar individualmente
    attendancePropsChecklist.querySelectorAll('.prop-check-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        if (!isNaN(idx)) {
          state.allProperties[idx].selected = e.target.checked;
          renderAll();
        }
      });
    });

    // Conecta botão de usar o valor do imóvel como aluguel da proposta
    attendancePropsChecklist.querySelectorAll('.btn-use-as-rent').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        const prop = state.allProperties[idx];
        if (prop && prop.value) {
          const cleanNum = prop.value.replace(/[^\d,]/g, '');
          if (cleanNum) {
            state.proposal.rentValue = cleanNum;
            inputValorAluguel.value = cleanNum;
            renderAll();
            showToast(`Valor de R$ ${cleanNum} definido na proposta!`, '💰');
          }
        }
      });
    });
  }

  // --- Consulta de Imóvel por Código na API Santos & Mello ---
  async function fetchAndAddPropertyByCode(code) {
    const cleanCode = String(code || '').trim();
    if (!cleanCode) return;

    btnQuickAddProp.disabled = true;
    btnQuickAddProp.textContent = 'Buscando...';

    try {
      const res = await fetch(`/api/imoveis/${encodeURIComponent(cleanCode)}/detalhes-operacionais`);
      const data = await res.json();

      let endereco = '';
      let bairro = 'Santo André - SP';
      let valorFormatado = 'R$ 0,00';

      if (res.ok && data.success) {
        endereco = data.enderecoCompleto || data.endereco || '';
        bairro = data.bairro ? `${data.bairro} - ${data.cidade || 'Santo André'}` : (data.cidade ? `${data.cidade} - SP` : 'Santo André - SP');
        valorFormatado = data.valor ? (typeof data.valor === 'number' ? `R$ ${data.valor.toLocaleString('pt-BR')}` : String(data.valor)) : 'Sob Consulta';
      } else {
        const resFb = await fetch(`/api/imovel/${encodeURIComponent(cleanCode)}`);
        const jsonFb = await resFb.json();
        if (resFb.ok && jsonFb.data) {
          const item = jsonFb.data;
          endereco = item.enderecoCompleto || item.location?.enderecoCompleto || item.location?.address || '';
          bairro = item.location?.neighborhood ? `${item.location.neighborhood} - ${item.location.city || 'Santo André'}` : 'Santo André - SP';
          const valNum = item.rentalPrice || item.price || 0;
          valorFormatado = valNum > 0 ? `R$ ${valNum.toLocaleString('pt-BR')}` : 'Sob Consulta';
        } else {
          endereco = `Imóvel #${cleanCode}`;
        }
      }

      // Se for o imóvel mock inicial 5586, substitui para não poluir
      if (state.allProperties.length === 1 && state.allProperties[0].id === '5586' && cleanCode !== '5586') {
        state.allProperties = [];
      }

      // Verifica se já existe na lista
      const existing = state.allProperties.find(p => String(p.id).toLowerCase() === cleanCode.toLowerCase());
      if (existing) {
        existing.selected = true;
        showToast(`Imóvel #${cleanCode} já estava na lista e foi marcado!`, 'ℹ️');
      } else {
        state.allProperties.push({
          id: cleanCode,
          address: endereco || `Rua do Imóvel #${cleanCode}`,
          neighborhood: bairro,
          value: valorFormatado,
          selected: true,
          isScheduled: false,
          source: 'manual'
        });
        showToast(`Imóvel #${cleanCode} adicionado e marcado para a proposta!`, '✅');
      }

      // Sugere valor do aluguel se ainda estiver default
      if (valorFormatado && valorFormatado.includes('R$')) {
        const valClean = valorFormatado.replace(/[^\d,]/g, '');
        if (valClean) {
          state.proposal.rentValue = valClean;
          inputValorAluguel.value = valClean;
        }
      }

      inputQuickCode.value = '';
      renderAll();
    } catch (err) {
      console.warn('Erro ao consultar imóvel:', err);
      state.allProperties.push({
        id: cleanCode,
        address: `Imóvel #${cleanCode}`,
        neighborhood: 'Santo André - SP',
        value: 'Sob Consulta',
        selected: true,
        isScheduled: false,
        source: 'manual'
      });
      renderAll();
      showToast(`Adicionado imóvel #${cleanCode} (modo manual).`, 'ℹ️');
    } finally {
      btnQuickAddProp.disabled = false;
      btnQuickAddProp.textContent = '+ Adicionar';
    }
  }

  // --- Inicialização a partir da URL e do Endpoint Unificado (/api/proposta/dados) ---
  async function initFromQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get('contactId') || urlParams.get('contact_id');
    const sessionId = urlParams.get('sessionId') || urlParams.get('session_id');
    const propertyId = urlParams.get('propertyId') || urlParams.get('codigo') || urlParams.get('id');
    const idsList = urlParams.get('ids');
    const corretorParam = urlParams.get('corretor');
    const atendimentoParam = urlParams.get('atendimento');

    // Configura data inicial para hoje
    inputDataDoc.value = state.dataDocumento;

    if (corretorParam) {
      state.corretor = decodeURIComponent(corretorParam);
      inputCorretor.value = state.corretor;
    }

    if (atendimentoParam) {
      state.atendimento = atendimentoParam;
      inputAtendimento.value = state.atendimento;
    }

    // Atualiza links de navegação entre módulos preservando a query string ativa do Helena CRM
    const qString = urlParams.toString();
    if (headerLinkCatalog) {
      headerLinkCatalog.href = qString ? `/?${qString}` : '/';
    }
    if (headerLinkVisitas) {
      headerLinkVisitas.href = qString ? `/visitas?${qString}` : '/visitas';
    }
    if (headerLinkProposta) {
      headerLinkProposta.href = qString ? `/proposta?${qString}` : '/proposta';
    }

    // Se houver contactId ou sessionId, consulta o endpoint unificado de dados
    if (contactId || sessionId) {
      leadSessionChip.style.display = 'inline-flex';
      leadSessionText.textContent = sessionId ? `Sessão #${sessionId.slice(0, 8)}...` : `Lead #${contactId.slice(0, 8)}...`;

      try {
        const res = await fetch(`/api/proposta/dados?${qString}`);
        const data = await res.json();

        if (res.ok && data.success) {
          if (data.atendimento) {
            state.atendimento = data.atendimento;
            inputAtendimento.value = state.atendimento;
          }
          if (data.client) {
            if (data.client.name) {
              state.client.name = data.client.name;
              inputClienteNome.value = state.client.name;
            }
            if (data.client.phone) {
              state.client.phone = data.client.phone;
              inputClienteTel.value = state.client.phone;
            }
            if (data.client.address) {
              state.client.address = data.client.address;
              inputClienteEnd.value = state.client.address;
            }
          }

          // Monta lista consolidada de imóveis do atendimento
          const propsMap = new Map();

          // 1. Visitas Agendadas (têm prioridade de seleção)
          const scheduledList = Array.isArray(data.visitasAgendadas) ? data.visitasAgendadas : [];
          scheduledList.forEach(v => {
            const vId = String(v.propertyId || '');
            if (vId) {
              propsMap.set(vId.toLowerCase(), {
                id: vId,
                address: v.propertyAddress || v.enderecoCompleto || `Imóvel #${vId}`,
                neighborhood: v.propertyNeighborhood ? `${v.propertyNeighborhood} - Santo André` : 'Santo André - SP',
                value: v.propertyPrice || 'Sob Consulta',
                selected: true,
                isScheduled: true,
                source: 'visita'
              });
            }
          });

          // 2. Imóveis Enviados no Chat (disponíveis para o corretor marcar/desmarcar)
          const sentList = Array.isArray(data.imoveisEnviados) ? data.imoveisEnviados : [];
          sentList.forEach(p => {
            const pId = String(p.id || p.codigo || '');
            if (pId && !propsMap.has(pId.toLowerCase())) {
              const fullAddr = p.enderecoCompleto || p.endereco || [p.bairro, p.cidade].filter(Boolean).join(', ') || 'Santo André - SP';
              const priceFmt = p.valorFormatado || p.priceText || (p.valor ? `R$ ${Number(p.valor).toLocaleString('pt-BR')}` : 'Sob Consulta');
              propsMap.set(pId.toLowerCase(), {
                id: pId,
                address: fullAddr,
                neighborhood: p.bairro ? `${p.bairro} - ${p.cidade || 'Santo André'}` : 'Santo André - SP',
                value: priceFmt,
                // Se não houver nenhuma visita agendada, deixa todos os enviados marcados por padrão
                selected: scheduledList.length === 0,
                isScheduled: false,
                source: 'enviado'
              });
            }
          });

          if (propsMap.size > 0) {
            state.allProperties = Array.from(propsMap.values());
            // Sugere o valor do primeiro imóvel selecionado como aluguel da proposta
            const firstSelected = state.allProperties.find(p => p.selected);
            if (firstSelected && firstSelected.value) {
              const cleanVal = firstSelected.value.replace(/[^\d,]/g, '');
              if (cleanVal) {
                state.proposal.rentValue = cleanVal;
                inputValorAluguel.value = cleanVal;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Aviso ao consultar dados unificados da proposta:', err.message);
      }
    }

    // Se foram passados IDs específicos via query params (ex: ?ids=3271,5586)
    if (idsList) {
      const arr = idsList.split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length > 0) {
        state.allProperties = [];
        for (const code of arr) {
          await fetchAndAddPropertyByCode(code);
        }
      }
    } else if (propertyId) {
      state.allProperties = [];
      await fetchAndAddPropertyByCode(propertyId);
    }

    renderAll();
  }

  // --- Zoom do Documento na Tela ---
  function setZoom(level) {
    state.zoomLevel = Math.max(0.5, Math.min(1.5, level));
    zoomLevelText.textContent = `${Math.round(state.zoomLevel * 100)}%`;
    printableSheet.style.transform = `scale(${state.zoomLevel})`;
  }

  // --- Listeners de Eventos do Formulário ---
  function setupEventListeners() {
    // Modo Manual vs Digital
    checkManualMode.addEventListener('change', (e) => {
      state.isManualMode = e.target.checked;
      manualModeLabel.textContent = state.isManualMode ? 'Preenchimento Manual (Em Branco)' : 'Preenchimento Digital';
      renderAll();
    });

    // Atendimento e Corretor
    inputAtendimento.addEventListener('input', (e) => {
      state.atendimento = e.target.value.trim();
      renderAll();
    });

    inputDataDoc.addEventListener('change', (e) => {
      state.dataDocumento = e.target.value;
      renderAll();
    });

    inputCorretor.addEventListener('input', (e) => {
      state.corretor = e.target.value.trim();
      renderAll();
    });

    // Cliente
    inputClienteNome.addEventListener('input', (e) => {
      state.client.name = e.target.value.trim();
      renderAll();
    });

    inputClienteTel.addEventListener('input', (e) => {
      state.client.phone = e.target.value.trim();
      renderAll();
    });

    inputClienteEnd.addEventListener('input', (e) => {
      state.client.address = e.target.value.trim();
      renderAll();
    });

    // Filtros Rápidos de Seleção de Imóveis
    btnSelectAllProps.addEventListener('click', () => {
      state.allProperties.forEach(p => p.selected = true);
      btnSelectAllProps.classList.add('active');
      btnSelectScheduledOnly.classList.remove('active');
      btnUnselectAllProps.classList.remove('active');
      renderAll();
    });

    btnSelectScheduledOnly.addEventListener('click', () => {
      state.allProperties.forEach(p => {
        p.selected = Boolean(p.isScheduled);
      });
      btnSelectScheduledOnly.classList.add('active');
      btnSelectAllProps.classList.remove('active');
      btnUnselectAllProps.classList.remove('active');
      renderAll();
    });

    btnUnselectAllProps.addEventListener('click', () => {
      state.allProperties.forEach(p => p.selected = false);
      btnUnselectAllProps.classList.add('active');
      btnSelectAllProps.classList.remove('active');
      btnSelectScheduledOnly.classList.remove('active');
      renderAll();
    });

    // Busca rápida de imóvel por código
    btnQuickAddProp.addEventListener('click', () => {
      fetchAndAddPropertyByCode(inputQuickCode.value);
    });

    inputQuickCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fetchAndAddPropertyByCode(inputQuickCode.value);
      }
    });

    // Proposta
    inputValorAluguel.addEventListener('input', (e) => {
      state.proposal.rentValue = e.target.value.trim();
      renderAll();
    });

    inputPrazoLocacao.addEventListener('input', (e) => {
      state.proposal.termMonths = e.target.value.trim();
      renderAll();
    });

    selectDiaVencimento.addEventListener('change', (e) => {
      if (e.target.value === 'outro') {
        wrapDiaCustom.style.display = 'flex';
        state.proposal.dueDay = inputDiaCustom.value || '10';
      } else {
        wrapDiaCustom.style.display = 'none';
        state.proposal.dueDay = e.target.value;
      }
      renderAll();
    });

    inputDiaCustom.addEventListener('input', (e) => {
      state.proposal.dueDay = e.target.value.trim() || '10';
      renderAll();
    });

    document.querySelectorAll('input[name="garantiaOption"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        state.proposal.guarantee = e.target.value;
        renderAll();
      });
    });

    inputObsProposta.addEventListener('input', (e) => {
      state.proposal.notes = e.target.value;
      renderAll();
    });

    // Zoom
    btnZoomIn.addEventListener('click', () => setZoom(state.zoomLevel + 0.1));
    btnZoomOut.addEventListener('click', () => setZoom(state.zoomLevel - 0.1));
    btnZoomReset.addEventListener('click', () => setZoom(1.0));

    // Ações de Saída: Imprimir
    btnPrintPdf.addEventListener('click', () => {
      window.print();
    });

    // Ações de Saída: Baixar PDF com html2pdf
    btnDownloadPdf.addEventListener('click', async () => {
      if (typeof html2pdf === 'undefined') {
        window.print();
        return;
      }

      btnDownloadPdf.disabled = true;
      const originalText = btnDownloadPdf.innerHTML;
      btnDownloadPdf.innerHTML = '<span>⏳ Gerando PDF...</span>';

      try {
        const clientNameClean = (state.client.name || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `Ficha_Visita_Proposta_${clientNameClean}.pdf`;

        const opt = {
          margin: [8, 10, 8, 10],
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(printableSheet).save();
        showToast('📄 Download do PDF concluído!', '✅');
      } catch (err) {
        console.error('Erro ao gerar PDF via html2pdf:', err);
        window.print();
      } finally {
        btnDownloadPdf.disabled = false;
        btnDownloadPdf.innerHTML = originalText;
      }
    });

    // Copiar Texto da Proposta para WhatsApp
    btnCopyProposalWhatsApp.addEventListener('click', async () => {
      const gMap = {
        seguro: 'Seguro Fiança',
        fiador: 'Fiador',
        titulo: 'Título de Capitalização',
        caucao: 'Depósito Caução',
        nenhuma: 'A definir'
      };

      const selectedProps = state.allProperties.filter(p => p.selected);

      const lines = [
        `📄 *FICHA DE VISITA & PROPOSTA DE LOCAÇÃO*`,
        `🏢 *Santos & Mello Imóveis* • Atendimento #${state.atendimento}`,
        `👤 *Cliente:* ${state.client.name || 'Cliente'} (${state.client.phone || ''})`,
        `----------------------------------------`,
        `📍 *Imóveis da Ficha de Visita:*`
      ];

      if (selectedProps.length === 0) {
        lines.push(`• Nenhum imóvel selecionado.`);
      } else {
        selectedProps.forEach((p, i) => {
          lines.push(`• *Opção ${i + 1} (Cód. #${p.id}):* ${p.address} - ${p.neighborhood} (${p.value})`);
        });
      }

      lines.push(
        `----------------------------------------`,
        `💰 *PROPOSTA OFERTADA:*`,
        `• *Valor do Aluguel:* R$ ${state.proposal.rentValue || 'A combinar'}`,
        `• *Prazo da Locação:* ${state.proposal.termMonths || '30'} meses`,
        `• *Vencimento Desejado:* Todo dia ${state.proposal.dueDay || '10'} de cada mês`,
        `• *Garantia Pretendida:* ${gMap[state.proposal.guarantee] || 'Seguro Fiança'}`
      );

      if (state.proposal.notes && state.proposal.notes.trim()) {
        lines.push(`• *Observações:* ${state.proposal.notes.trim()}`);
      }

      lines.push(
        `----------------------------------------`,
        `Ficamos à disposição para darmos andamento na documentação e análise! 😊`
      );

      const msg = lines.join('\n');
      await copyToClipboard(msg);
      showToast('📋 Resumo da proposta copiado para o WhatsApp!', '✅');
    });
  }

  // Inicialização
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initFromQueryParams();
  });

})();
