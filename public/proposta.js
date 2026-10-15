/**
 * ============================================================================
 * JAVASCRIPT • FICHA DE VISITA & PROPOSTA (SANTOS & MELLO IMÓVEIS)
 * Integração com Helena CRM, busca de imóveis, sincronização em tempo real e PDF
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
    properties: [
      {
        id: '5586',
        address: 'Rua Almada, 270, Individual, CEP 09260-420',
        neighborhood: 'Jardim Santo Alberto - Santo André',
        value: 'R$ 1.600,00'
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
  // Ações do Cabeçalho
  const btnPrintPdf = document.getElementById('btnPrintPdf');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  const btnCopyProposalWhatsApp = document.getElementById('btnCopyProposalWhatsApp');
  const leadSessionChip = document.getElementById('leadSessionChip');
  const leadSessionText = document.getElementById('leadSessionText');
  const headerLinkVisitas = document.getElementById('headerLinkVisitas');

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
  const propertiesEditorList = document.getElementById('propertiesEditorList');
  const btnAddEmptyRow = document.getElementById('btnAddEmptyRow');
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
   * Formata uma data YYYY-MM-DD para extenso em português
   * Ex: "Santo André, quinta-feira, 15 de outubro de 2026"
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

  function formatMoneyValue(val) {
    if (typeof val === 'number') {
      return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    const clean = String(val || '').replace(/[^\d,.]/g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? String(val || '') : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- Atualização da Interface (Formulário + Folha A4) ---
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

    // 3. Data por Extenso
    docCityDateVal.textContent = formatDateToPortugueseFull(state.dataDocumento);

    // 4. Tabela de Imóveis (Folha A4)
    docPropertiesTbody.innerHTML = '';
    state.properties.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-cod">${p.id || ''}</td>
        <td class="col-endereco">${p.address || ''}</td>
        <td class="col-bairro">${p.neighborhood || ''}</td>
        <td class="col-valor">${p.value || ''}</td>
      `;
      docPropertiesTbody.appendChild(tr);
    });

    badgePropsCount.textContent = `${state.properties.length} imóvel${state.properties.length !== 1 ? 'is' : ''}`;

    // 5. Bloco da Proposta (Digital vs Manual)
    if (state.isManualMode) {
      docValorAluguelVal.textContent = '______________________________';
      docPrazoLocacaoVal.textContent = '________';
      docDiaVencimentoVal.textContent = '__________';

      // Caixas de garantia todas em branco
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

      // Garantia marcada
      const g = state.proposal.guarantee;
      docGuaranteeChecks.innerHTML = `
        <span class="guarantee-box-item">${g === 'seguro' ? '[ X ]' : '[ &nbsp; ]'} Seguro Fiança</span>
        <span class="guarantee-box-item">${g === 'fiador' ? '[ X ]' : '[ &nbsp; ]'} Fiador</span>
        <span class="guarantee-box-item">${g === 'titulo' ? '[ X ]' : '[ &nbsp; ]'} Título de Capitalização</span>
        ${g === 'caucao' ? '<span class="guarantee-box-item">[ X ] Caução</span>' : ''}
      `;

      // Observações preenchidas
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

      // Data nos traços
      if (state.dataDocumento) {
        const [y, m, d] = state.dataDocumento.split('-');
        docSignatureDateDay.textContent = d;
        docSignatureDateMonth.textContent = m;
        docSignatureDateYear.textContent = y;
      }
    }

    // Renderiza a lista de edição de imóveis na barra lateral
    renderPropertiesEditorList();
  }

  function renderPropertiesEditorList() {
    propertiesEditorList.innerHTML = '';
    state.properties.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'property-edit-item';
      item.innerHTML = `
        <div class="prop-edit-header">
          <span class="prop-badge-cod">#${p.id || 'Sem Código'}</span>
          <button type="button" class="btn-remove-prop" data-index="${idx}" title="Remover imóvel desta proposta">✕ Remover</button>
        </div>
        <div class="form-row-2">
          <div class="form-field">
            <label class="field-label">Código</label>
            <input type="text" class="field-input input-prop-id" data-index="${idx}" value="${p.id || ''}">
          </div>
          <div class="form-field">
            <label class="field-label">Valor (R$)</label>
            <input type="text" class="field-input input-prop-val" data-index="${idx}" value="${p.value || ''}">
          </div>
        </div>
        <div class="form-field">
          <label class="field-label">Endereço Completo</label>
          <input type="text" class="field-input input-prop-addr" data-index="${idx}" value="${p.address || ''}">
        </div>
        <div class="form-field">
          <label class="field-label">Bairro / Cidade</label>
          <input type="text" class="field-input input-prop-neigh" data-index="${idx}" value="${p.neighborhood || ''}">
        </div>
      `;
      propertiesEditorList.appendChild(item);
    });

    // Conecta eventos de edição dos itens
    propertiesEditorList.querySelectorAll('.btn-remove-prop').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        if (!isNaN(index) && state.properties.length > 1) {
          state.properties.splice(index, 1);
          renderAll();
        } else if (state.properties.length <= 1) {
          showToast('A ficha deve possuir pelo menos 1 imóvel.', '⚠️');
        }
      });
    });

    propertiesEditorList.querySelectorAll('.input-prop-id').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        state.properties[idx].id = e.target.value.trim();
        renderAll();
      });
    });

    propertiesEditorList.querySelectorAll('.input-prop-val').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        state.properties[idx].value = e.target.value.trim();
        renderAll();
      });
    });

    propertiesEditorList.querySelectorAll('.input-prop-addr').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        state.properties[idx].address = e.target.value.trim();
        renderAll();
      });
    });

    propertiesEditorList.querySelectorAll('.input-prop-neigh').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        state.properties[idx].neighborhood = e.target.value.trim();
        renderAll();
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
      // Consulta endpoint operacional consolidado
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
        // Fallback para endpoint /api/imovel/:id
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

      // Se já houver apenas 1 imóvel genérico com código 5586 e usuário estiver buscando o primeiro, substitui
      if (state.properties.length === 1 && state.properties[0].id === '5586' && cleanCode !== '5586') {
        state.properties = [{
          id: cleanCode,
          address: endereco || `Rua do Imóvel #${cleanCode}`,
          neighborhood: bairro,
          value: valorFormatado
        }];
      } else {
        state.properties.push({
          id: cleanCode,
          address: endereco || `Rua do Imóvel #${cleanCode}`,
          neighborhood: bairro,
          value: valorFormatado
        });
      }

      // Se o valor do aluguel da proposta estiver zerado ou default, sugere o valor deste imóvel
      if (valorFormatado && valorFormatado.includes('R$')) {
        const valClean = valorFormatado.replace(/[^\d,]/g, '');
        if (valClean) {
          state.proposal.rentValue = valClean;
          inputValorAluguel.value = valClean;
        }
      }

      inputQuickCode.value = '';
      renderAll();
      showToast(`Imóvel #${cleanCode} adicionado à proposta!`, '✅');
    } catch (err) {
      console.warn('Erro ao consultar imóvel:', err);
      state.properties.push({
        id: cleanCode,
        address: `Imóvel #${cleanCode}`,
        neighborhood: 'Santo André - SP',
        value: 'Sob Consulta'
      });
      renderAll();
      showToast(`Adicionado imóvel #${cleanCode} (modo offline/manual).`, 'ℹ️');
    } finally {
      btnQuickAddProp.disabled = false;
      btnQuickAddProp.textContent = '+ Adicionar';
    }
  }

  // --- Integração com Helena CRM via Query Params ---
  async function initFromQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get('contactId') || urlParams.get('contact_id');
    const sessionId = urlParams.get('sessionId') || urlParams.get('session_id');
    const propertyId = urlParams.get('propertyId') || urlParams.get('codigo') || urlParams.get('id');
    const idsList = urlParams.get('ids');
    const corretorParam = urlParams.get('corretor');
    const atendimentoParam = urlParams.get('atendimento');

    // Configura data inicial para hoje no input date
    inputDataDoc.value = state.dataDocumento;

    if (corretorParam) {
      state.corretor = decodeURIComponent(corretorParam);
      inputCorretor.value = state.corretor;
    }

    if (atendimentoParam) {
      state.atendimento = atendimentoParam;
      inputAtendimento.value = state.atendimento;
    }

    // Se houver contactId ou sessionId, sincroniza atendimento
    if (contactId || sessionId) {
      leadSessionChip.style.display = 'inline-flex';
      leadSessionText.textContent = sessionId ? `Sessão #${sessionId.slice(0, 8)}...` : `Lead #${contactId.slice(0, 8)}...`;
      state.atendimento = sessionId ? sessionId.slice(0, 6).toUpperCase() : (contactId ? contactId.slice(0, 6).toUpperCase() : state.atendimento);
      inputAtendimento.value = state.atendimento;

      if (headerLinkVisitas) {
        headerLinkVisitas.href = `/visitas?${urlParams.toString()}`;
      }

      // Busca dados do contato no Helena CRM
      try {
        const contactRes = await fetch(`/api/leads/match?contactId=${encodeURIComponent(contactId || '')}&limit=1`);
        const contactData = await contactRes.json();
        if (contactData.contact) {
          state.client.name = contactData.contact.name || state.client.name;
          state.client.phone = contactData.contact.phoneNumber || state.client.phone;
          inputClienteNome.value = state.client.name;
          inputClienteTel.value = state.client.phone;
        }
      } catch (e) {
        console.warn('Aviso ao sincronizar dados do contato Helena CRM:', e.message);
      }

      // Busca visitas agendadas ou imóveis enviados no session metadata
      if (sessionId) {
        try {
          const metaRes = await fetch(`/api/leads/session-metadata?sessionId=${encodeURIComponent(sessionId)}`);
          const metaData = await metaRes.json();
          if (metaData.success && Array.isArray(metaData.visitasAgendadas) && metaData.visitasAgendadas.length > 0) {
            state.properties = metaData.visitasAgendadas.map(v => ({
              id: String(v.propertyId || ''),
              address: v.propertyAddress || v.enderecoCompleto || `Imóvel #${v.propertyId}`,
              neighborhood: v.propertyNeighborhood ? `${v.propertyNeighborhood} - Santo André` : 'Santo André - SP',
              value: v.propertyPrice || 'Sob Consulta'
            }));
          }
        } catch (e) {
          console.warn('Aviso ao consultar metadados de visitas:', e.message);
        }
      }
    }

    // Se foram passados IDs específicos via query params
    if (idsList) {
      const arr = idsList.split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length > 0) {
        state.properties = [];
        for (const code of arr) {
          await fetchAndAddPropertyByCode(code);
        }
      }
    } else if (propertyId) {
      state.properties = [];
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

    // Busca rápida de imóvel
    btnQuickAddProp.addEventListener('click', () => {
      fetchAndAddPropertyByCode(inputQuickCode.value);
    });

    inputQuickCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fetchAndAddPropertyByCode(inputQuickCode.value);
      }
    });

    btnAddEmptyRow.addEventListener('click', () => {
      state.properties.push({
        id: '',
        address: '',
        neighborhood: '',
        value: ''
      });
      renderAll();
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
        // Fallback para impressão nativa do navegador
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

      const lines = [
        `📄 *FICHA DE VISITA & PROPOSTA DE LOCAÇÃO*`,
        `🏢 *Santos & Mello Imóveis* • Atendimento #${state.atendimento}`,
        `👤 *Cliente:* ${state.client.name || 'Cliente'} (${state.client.phone || ''})`,
        `----------------------------------------`,
        `📍 *Imóveis Visitados:*`
      ];

      state.properties.forEach((p, i) => {
        lines.push(`• *Opção ${i + 1} (Cód. #${p.id}):* ${p.address} - ${p.neighborhood} (${p.value})`);
      });

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
