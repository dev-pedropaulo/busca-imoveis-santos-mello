/**
 * Santos & Mello • CRM & Gestão Imobiliária Suite
 * Frontend Engine: CRUD de Imóveis, Kanban da Jornada, Agendamento de Visitas, Claviculário e BI
 */

(function () {
  'use strict';

  // --- Estado Global do CRM ---
  const state = {
    activeTab: 'catalogSection',
    crudPage: 1,
    crudLimit: 15,
    crudSearch: '',
    crudType: 'all',
    crudStage: 'all',
    propertiesList: [],
    kanbanData: null,
    visitsList: [],
    keysList: [],
    reportsData: null,
    editingPropertyId: null,
    allMergedProperties: [] // cache para selects rápidos
  };

  // --- Elementos do DOM ---
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanels = document.querySelectorAll('.crm-tab-panel');

  // Badges de navegação
  const crudNavBadge = document.getElementById('crudNavBadge');
  const visitsNavBadge = document.getElementById('visitsNavBadge');
  const keysNavBadge = document.getElementById('keysNavBadge');

  // Toast Notification
  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMessage');
    if (!toast || !toastMsg) return;
    
    toastMsg.textContent = message;
    toast.className = `toast show ${type === 'error' ? 'toast-error' : ''}`;
    setTimeout(() => {
      toast.className = 'toast';
    }, 3500);
  }

  // --- Inicialização de Navegação em Abas ---
  function initNavigation() {
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.target;
        switchTab(targetId);
      });
    });
  }

  function switchTab(targetId) {
    state.activeTab = targetId;
    navTabs.forEach(t => t.classList.toggle('active', t.dataset.target === targetId));
    tabPanels.forEach(panel => {
      if (panel.id === targetId) {
        panel.classList.add('active');
        panel.style.display = 'block';
      } else {
        panel.classList.remove('active');
        panel.style.display = 'none';
      }
    });

    // Gatilhos de carregamento sob demanda
    if (targetId === 'crudSection') {
      loadCrudProperties();
    } else if (targetId === 'kanbanSection') {
      loadKanban();
    } else if (targetId === 'visitsSection') {
      loadVisits();
    } else if (targetId === 'keysSection') {
      loadKeys();
    } else if (targetId === 'reportsSection') {
      loadReports();
    }
  }

  // Permite abrir uma aba externamente (ex: do catálogo para visitas)
  window.crmSwitchTab = switchTab;

  // --- MÓDULO 1: GESTÃO DE IMÓVEIS (CRUD) ---
  const crudSearchInput = document.getElementById('crudSearchInput');
  const crudTypeFilter = document.getElementById('crudTypeFilter');
  const crudStageFilter = document.getElementById('crudStageFilter');
  const crudTableBody = document.getElementById('crudTableBody');
  const crudPaginationText = document.getElementById('crudPaginationText');
  const crudPrevBtn = document.getElementById('crudPrevBtn');
  const crudNextBtn = document.getElementById('crudNextBtn');
  const btnNewProperty = document.getElementById('btnNewProperty');

  function initCrudEvents() {
    if (crudSearchInput) {
      let debounceTimer = null;
      crudSearchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.crudSearch = crudSearchInput.value.trim();
          state.crudPage = 1;
          loadCrudProperties();
        }, 300);
      });
    }

    if (crudTypeFilter) {
      crudTypeFilter.addEventListener('change', () => {
        state.crudType = crudTypeFilter.value;
        state.crudPage = 1;
        loadCrudProperties();
      });
    }

    if (crudStageFilter) {
      crudStageFilter.addEventListener('change', () => {
        state.crudStage = crudStageFilter.value;
        state.crudPage = 1;
        loadCrudProperties();
      });
    }

    if (crudPrevBtn) {
      crudPrevBtn.addEventListener('click', () => {
        if (state.crudPage > 1) {
          state.crudPage--;
          loadCrudProperties();
        }
      });
    }

    if (crudNextBtn) {
      crudNextBtn.addEventListener('click', () => {
        state.crudPage++;
        loadCrudProperties();
      });
    }

    if (btnNewProperty) {
      btnNewProperty.addEventListener('click', () => {
        openPropertyModal();
      });
    }
  }

  async function loadCrudProperties() {
    if (!crudTableBody) return;
    crudTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;"><div class="loading-spinner" style="margin: 0 auto 0.5rem;"></div>Carregando imóveis da imobiliária...</td></tr>`;

    try {
      const params = new URLSearchParams({
        page: state.crudPage,
        limit: state.crudLimit,
        q: state.crudSearch,
        type: state.crudType,
        kanbanStage: state.crudStage
      });

      const res = await fetch(`/api/imoveis?${params}`);
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'Erro ao carregar lista de imóveis.');

      state.propertiesList = json.data;
      const { total, page, totalPages } = json.pagination;

      if (crudPaginationText) {
        crudPaginationText.textContent = `Mostrando página ${page} de ${totalPages} (${total} imóveis encontrados)`;
      }

      if (crudPrevBtn) crudPrevBtn.disabled = page <= 1;
      if (crudNextBtn) crudNextBtn.disabled = page >= totalPages;

      if (crudNavBadge) crudNavBadge.textContent = total;

      renderCrudTable(state.propertiesList, json.stages);
    } catch (err) {
      crudTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:2rem;">Erro: ${err.message}</td></tr>`;
    }
  }

  function renderCrudTable(list, stages) {
    if (!list || list.length === 0) {
      crudTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2.5rem; color:var(--text-secondary);">Nenhum imóvel encontrado com os filtros selecionados.</td></tr>`;
      return;
    }

    const html = list.map(item => {
      const priceText = item.transactionType.toLowerCase().includes('locação')
        ? (item.rentalPrice ? `R$ ${item.rentalPrice.toLocaleString('pt-BR')}/mês` : 'Sob consulta')
        : (item.price ? `R$ ${item.price.toLocaleString('pt-BR')}` : 'Sob consulta');

      const stageKey = item.kanbanStage || 'disponivel';
      const stageObj = (stages || []).find(s => s.id === stageKey) || { label: item.status || 'Disponível' };

      return `
        <tr data-id="${item.id}">
          <td>
            <div class="prop-thumb-cell">
              <img src="${item.primaryImage || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=120'}" class="prop-thumb-img" alt="${item.title}" onerror="this.src='logo.png'" />
              <div>
                <div class="prop-info-title" title="${item.title}">${item.title}</div>
                <div class="prop-info-sub">${item.location?.neighborhood || 'Santo André'} • ${item.livingArea || 0} m² • ${item.bedrooms || 0} qts</div>
              </div>
            </div>
          </td>
          <td>
            <strong style="color:var(--accent-primary);">#${item.id}</strong>
          </td>
          <td>
            <span class="badge ${item.transactionType.includes('Locação') ? 'badge-rent' : 'badge-sale'}">${item.transactionType}</span>
          </td>
          <td>
            <strong style="color:var(--text-primary); font-size:0.92rem;">${priceText}</strong>
          </td>
          <td>
            <select class="crud-select status-select-cell" data-id="${item.id}" style="font-size:0.78rem; padding:0.35rem 0.6rem;">
              <option value="disponivel" ${stageKey === 'disponivel' ? 'selected' : ''}>🟢 Vago / Disponível</option>
              <option value="visita_agendada" ${stageKey === 'visita_agendada' ? 'selected' : ''}>📅 Visita Agendada</option>
              <option value="chave_entregue" ${stageKey === 'chave_entregue' ? 'selected' : ''}>🔑 Chave Entregue</option>
              <option value="com_proposta" ${stageKey === 'com_proposta' ? 'selected' : ''}>📝 Com Proposta</option>
              <option value="analise_contrato" ${stageKey === 'analise_contrato' ? 'selected' : ''}>🔍 Análise / Contrato</option>
              <option value="concluido" ${stageKey === 'concluido' ? 'selected' : ''}>🤝 Concluído</option>
            </select>
          </td>
          <td>
            <span class="key-tag-pill">🔑 ${item.keyTag || `CLAV-${item.id}`}</span>
          </td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn-icon-action btn-view-prop" data-id="${item.id}" title="Ver Ficha Completa">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </button>
              <button type="button" class="btn-icon-action btn-edit-prop" data-id="${item.id}" title="Editar Imóvel">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button type="button" class="btn-icon-action danger btn-del-prop" data-id="${item.id}" title="Excluir Imóvel">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    crudTableBody.innerHTML = html;

    // Listeners na tabela
    crudTableBody.querySelectorAll('.status-select-cell').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const newStage = e.target.value;
        await updatePropertyStage(id, newStage);
      });
    });

    crudTableBody.querySelectorAll('.btn-view-prop').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        viewPropertyInCatalog(id);
      });
    });

    crudTableBody.querySelectorAll('.btn-edit-prop').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = list.find(p => String(p.id) === String(id));
        if (item) openPropertyModal(item);
      });
    });

    crudTableBody.querySelectorAll('.btn-del-prop').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        confirmDeleteProperty(id);
      });
    });
  }

  async function updatePropertyStage(id, kanbanStage) {
    try {
      const res = await fetch(`/api/imoveis/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanbanStage })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erro ao alterar status.');
      showToast(`Status do imóvel #${id} atualizado com sucesso!`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function viewPropertyInCatalog(id) {
    switchTab('catalogSection');
    const searchInput = document.getElementById('searchInput');
    const searchForm = document.getElementById('searchForm');
    if (searchInput && searchForm) {
      searchInput.value = id;
      searchForm.dispatchEvent(new Event('submit'));
    }
  }

  function confirmDeleteProperty(id) {
    if (confirm(`Tem certeza que deseja excluir/desativar o imóvel #${id}? Esta ação alterará a visibilidade no sistema.`)) {
      deleteProperty(id);
    }
  }

  async function deleteProperty(id) {
    try {
      const res = await fetch(`/api/imoveis/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha ao excluir.');
      showToast(json.message || `Imóvel #${id} excluído com sucesso!`);
      loadCrudProperties();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- MODAL DE CRIAÇÃO / EDIÇÃO DE IMÓVEL ---
  const propModalOverlay = document.getElementById('propModalOverlay');
  const propForm = document.getElementById('propForm');
  const propModalTitle = document.getElementById('propModalTitle');
  const propModalClose = document.getElementById('propModalClose');
  const propModalCancel = document.getElementById('propModalCancel');

  function initPropModal() {
    if (propModalClose) propModalClose.addEventListener('click', closePropertyModal);
    if (propModalCancel) propModalCancel.addEventListener('click', closePropertyModal);

    if (propForm) {
      propForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePropertyFromForm();
      });
    }
  }

  function openPropertyModal(item = null) {
    state.editingPropertyId = item ? item.id : null;
    if (propModalTitle) {
      propModalTitle.textContent = item ? `Editar Imóvel #${item.id}` : 'Cadastrar Novo Imóvel';
    }

    if (propForm) {
      propForm.reset();

      if (item) {
        document.getElementById('formPropId').value = item.id || '';
        document.getElementById('formPropId').disabled = true;
        document.getElementById('formPropTitle').value = item.title || '';
        document.getElementById('formPropTransaction').value = item.transactionType || 'Locação';
        document.getElementById('formPropCategory').value = item.propertyType || 'Apartment';
        document.getElementById('formPropUsage').value = item.usageType || 'Residencial';
        document.getElementById('formPropStage').value = item.kanbanStage || 'disponivel';
        document.getElementById('formPropKeyTag').value = item.keyTag || `CLAV-${item.id}`;
        document.getElementById('formPropPriceSale').value = item.price || '';
        document.getElementById('formPropPriceRent').value = item.rentalPrice || '';
        document.getElementById('formPropCondo').value = item.condo || '';
        document.getElementById('formPropIptu').value = item.iptu || '';
        document.getElementById('formPropArea').value = item.livingArea || '';
        document.getElementById('formPropBeds').value = item.bedrooms || '';
        document.getElementById('formPropSuites').value = item.suites || '';
        document.getElementById('formPropBaths').value = item.bathrooms || '';
        document.getElementById('formPropGarage').value = item.garage || '';
        document.getElementById('formPropAddress').value = item.location?.address || '';
        document.getElementById('formPropNumber').value = item.location?.streetNumber || '';
        document.getElementById('formPropComplement').value = item.location?.complement || '';
        document.getElementById('formPropNeighborhood').value = item.location?.neighborhood || '';
        document.getElementById('formPropCity').value = item.location?.city || 'Santo André';
        document.getElementById('formPropCep').value = item.location?.postalCode || '';
        document.getElementById('formPropImage').value = item.primaryImage || '';
        document.getElementById('formPropTour').value = item.virtualTourLink || '';
        document.getElementById('formPropDesc').value = item.description || '';

        // Comodidades
        const featSet = new Set(item.features || []);
        document.querySelectorAll('.feat-checkbox').forEach(cb => {
          cb.checked = featSet.has(cb.value);
        });
      } else {
        document.getElementById('formPropId').value = `SM-${Math.floor(1000 + Math.random() * 9000)}`;
        document.getElementById('formPropId').disabled = false;
        document.getElementById('formPropCity').value = 'Santo André';
        document.getElementById('formPropStage').value = 'disponivel';
        document.getElementById('formPropKeyTag').value = `CLAV-${Math.floor(10 + Math.random() * 90)}`;
      }
    }

    if (propModalOverlay) {
      propModalOverlay.classList.add('active');
    }
  }

  function closePropertyModal() {
    if (propModalOverlay) propModalOverlay.classList.remove('active');
  }

  async function savePropertyFromForm() {
    const isEditing = !!state.editingPropertyId;
    const id = document.getElementById('formPropId').value.trim();
    const title = document.getElementById('formPropTitle').value.trim();

    if (!title) {
      showToast('O título do imóvel é obrigatório.', 'error');
      return;
    }

    const features = [];
    document.querySelectorAll('.feat-checkbox:checked').forEach(cb => {
      features.push(cb.value);
    });

    const payload = {
      id: id,
      title: title,
      transactionType: document.getElementById('formPropTransaction').value,
      propertyType: document.getElementById('formPropCategory').value,
      usageType: document.getElementById('formPropUsage').value,
      kanbanStage: document.getElementById('formPropStage').value,
      keyTag: document.getElementById('formPropKeyTag').value.trim() || `CLAV-${id}`,
      price: parseFloat(document.getElementById('formPropPriceSale').value) || 0,
      rentalPrice: parseFloat(document.getElementById('formPropPriceRent').value) || 0,
      condo: parseFloat(document.getElementById('formPropCondo').value) || 0,
      iptu: parseFloat(document.getElementById('formPropIptu').value) || 0,
      livingArea: parseFloat(document.getElementById('formPropArea').value) || 0,
      bedrooms: parseInt(document.getElementById('formPropBeds').value) || 0,
      suites: parseInt(document.getElementById('formPropSuites').value) || 0,
      bathrooms: parseInt(document.getElementById('formPropBaths').value) || 0,
      garage: parseInt(document.getElementById('formPropGarage').value) || 0,
      location: {
        address: document.getElementById('formPropAddress').value.trim(),
        streetNumber: document.getElementById('formPropNumber').value.trim(),
        complement: document.getElementById('formPropComplement').value.trim(),
        neighborhood: document.getElementById('formPropNeighborhood').value.trim(),
        city: document.getElementById('formPropCity').value.trim() || 'Santo André',
        state: 'SP',
        postalCode: document.getElementById('formPropCep').value.trim()
      },
      primaryImage: document.getElementById('formPropImage').value.trim() || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
      virtualTourLink: document.getElementById('formPropTour').value.trim(),
      description: document.getElementById('formPropDesc').value.trim(),
      features: features
    };

    try {
      const url = isEditing ? `/api/imoveis/${state.editingPropertyId}` : '/api/imoveis';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erro ao salvar imóvel.');

      showToast(json.message || 'Imóvel salvo com sucesso!');
      closePropertyModal();
      loadCrudProperties();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- MÓDULO 2: JORNADA DO IMÓVEL (KANBAN PIPELINE) ---
  const kanbanBoard = document.getElementById('kanbanBoard');
  const btnKanbanRefresh = document.getElementById('btnKanbanRefresh');

  function initKanbanEvents() {
    if (btnKanbanRefresh) {
      btnKanbanRefresh.addEventListener('click', loadKanban);
    }
  }

  async function loadKanban() {
    if (!kanbanBoard) return;
    kanbanBoard.innerHTML = `<div style="padding: 3rem; text-align: center; width: 100%;"><div class="loading-spinner" style="margin: 0 auto 0.75rem;"></div>Carregando funil da jornada dos imóveis...</div>`;

    try {
      const res = await fetch('/api/kanban');
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'Falha ao carregar Kanban.');

      state.kanbanData = json;
      renderKanban(json);
    } catch (err) {
      kanbanBoard.innerHTML = `<div style="padding: 2rem; color: #ef4444; width: 100%; text-align: center;">Erro: ${err.message}</div>`;
    }
  }

  function renderKanban(data) {
    const { stages, columns, counts } = data;

    const html = stages.map(stage => {
      const items = columns[stage.id] || [];
      const totalInStage = counts[stage.id] || 0;

      const cardsHtml = items.map(item => {
        const priceFmt = item.transactionType.includes('Locação')
          ? (item.rentalPrice ? `R$ ${item.rentalPrice.toLocaleString('pt-BR')}/mês` : 'R$ --')
          : (item.price ? `R$ ${item.price.toLocaleString('pt-BR')}` : 'R$ --');

        return `
          <div class="kanban-card" draggable="true" data-id="${item.id}" data-current-stage="${stage.id}">
            <div class="kanban-card-top">
              <span class="kanban-card-code">#${item.id}</span>
              <span class="badge ${item.transactionType.includes('Locação') ? 'badge-rent' : 'badge-sale'}" style="font-size:0.7rem; padding:0.15rem 0.4rem;">${item.transactionType}</span>
            </div>
            <div class="kanban-card-title" title="${item.title}">${item.title}</div>
            <div class="kanban-card-meta">
              <span>📍 ${item.neighborhood}</span>
              <span>📐 ${item.livingArea || 0} m²</span>
              <span>🛏️ ${item.bedrooms || 0}</span>
            </div>
            <div class="kanban-card-price">${priceFmt}</div>
            <div class="kanban-card-footer">
              <span class="key-tag-pill" style="font-size:0.7rem;">🔑 ${item.keyTag}</span>
              <div class="kanban-card-actions">
                <button type="button" class="btn-kanban-step btn-step-prev" data-id="${item.id}" data-stage="${stage.id}" title="Voltar etapa">◀</button>
                <button type="button" class="btn-kanban-step btn-step-next" data-id="${item.id}" data-stage="${stage.id}" title="Avançar etapa">▶</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="kanban-column" data-stage="${stage.id}">
          <div class="kanban-column-header">
            <div class="kanban-column-title">
              <span>${stage.icon}</span>
              <span>${stage.label}</span>
            </div>
            <span class="kanban-counter">${totalInStage}</span>
          </div>
          <div class="kanban-cards-list" data-stage="${stage.id}">
            ${cardsHtml || '<div style="text-align:center; padding: 2rem 1rem; color:var(--text-muted); font-size:0.8rem;">Nenhum imóvel nesta etapa</div>'}
          </div>
        </div>
      `;
    }).join('');

    kanbanBoard.innerHTML = html;

    setupKanbanDragAndDrop();
    setupKanbanStepButtons(stages);
  }

  function setupKanbanDragAndDrop() {
    const cards = kanbanBoard.querySelectorAll('.kanban-card');
    const lists = kanbanBoard.querySelectorAll('.kanban-cards-list');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.dataset.id);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
    });

    lists.forEach(list => {
      list.addEventListener('dragover', (e) => {
        e.preventDefault();
        list.style.background = 'rgba(99, 102, 241, 0.08)';
      });

      list.addEventListener('dragleave', () => {
        list.style.background = '';
      });

      list.addEventListener('drop', async (e) => {
        e.preventDefault();
        list.style.background = '';
        const id = e.dataTransfer.getData('text/plain');
        const targetStage = list.dataset.stage;

        if (id && targetStage) {
          await updatePropertyStage(id, targetStage);
          loadKanban();
        }
      });
    });
  }

  function setupKanbanStepButtons(stages) {
    const stageIds = stages.map(s => s.id);

    kanbanBoard.querySelectorAll('.btn-step-prev').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const currentStage = btn.dataset.stage;
        const currentIndex = stageIds.indexOf(currentStage);
        if (currentIndex > 0) {
          const prevStage = stageIds[currentIndex - 1];
          await updatePropertyStage(id, prevStage);
          loadKanban();
        } else {
          showToast('Este imóvel já está na primeira etapa.', 'info');
        }
      });
    });

    kanbanBoard.querySelectorAll('.btn-step-next').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const currentStage = btn.dataset.stage;
        const currentIndex = stageIds.indexOf(currentStage);
        if (currentIndex < stageIds.length - 1) {
          const nextStage = stageIds[currentIndex + 1];
          await updatePropertyStage(id, nextStage);
          loadKanban();
        } else {
          showToast('Este imóvel já atingiu a etapa final da jornada!', 'info');
        }
      });
    });
  }

  // --- MÓDULO 3: AGENDAMENTO DE VISITAS ---
  const visitsGrid = document.getElementById('visitsGrid');
  const btnNewVisit = document.getElementById('btnNewVisit');
  const visitStatusFilter = document.getElementById('visitStatusFilter');
  const visitModalOverlay = document.getElementById('visitModalOverlay');
  const visitForm = document.getElementById('visitForm');
  const visitModalClose = document.getElementById('visitModalClose');
  const visitModalCancel = document.getElementById('visitModalCancel');

  function initVisitsEvents() {
    if (btnNewVisit) {
      btnNewVisit.addEventListener('click', openVisitModal);
    }
    if (visitStatusFilter) {
      visitStatusFilter.addEventListener('change', loadVisits);
    }
    if (visitModalClose) visitModalClose.addEventListener('click', closeVisitModal);
    if (visitModalCancel) visitModalCancel.addEventListener('click', closeVisitModal);

    if (visitForm) {
      visitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveVisitFromForm();
      });
    }
  }

  async function loadVisits() {
    if (!visitsGrid) return;
    visitsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem;"><div class="loading-spinner" style="margin: 0 auto 0.5rem;"></div>Carregando agendamentos de visita...</div>`;

    try {
      const status = visitStatusFilter ? visitStatusFilter.value : 'all';
      const res = await fetch(`/api/visits?status=${status}`);
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'Falha ao buscar visitas.');

      state.visitsList = json.data;
      if (visitsNavBadge) visitsNavBadge.textContent = state.visitsList.length;

      renderVisitsGrid(state.visitsList);
    } catch (err) {
      visitsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">Erro: ${err.message}</div>`;
    }
  }

  function renderVisitsGrid(list) {
    if (!list || list.length === 0) {
      visitsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">Nenhuma visita agendada com o filtro atual.</div>`;
      return;
    }

    const html = list.map(item => {
      const cleanPhone = (item.clientPhone || '').replace(/\D/g, '');
      const whatsAppLink = cleanPhone ? `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=Ol%C3%A1%20${encodeURIComponent(item.clientName)},%20sou%20da%20Santos%20%26%20Mello.%20Confirmando%20sua%20visita%20ao%20im%C3%B3vel%20%23${item.propertyId}` : '#';

      let statusBadgeClass = 'status-disponivel';
      if (item.status === 'Confirmada') statusBadgeClass = 'status-visita_agendada';
      if (item.status === 'Realizada') statusBadgeClass = 'status-concluido';
      if (item.status === 'Cancelada') statusBadgeClass = 'status-analise_contrato';

      return `
        <div class="visit-card" data-id="${item.id}">
          <div class="visit-header">
            <span class="visit-datetime">📅 ${item.date} às ${item.time}</span>
            <span class="status-badge ${statusBadgeClass}">${item.status}</span>
          </div>

          <div class="visit-prop-box">
            <span class="visit-prop-code">Imóvel #${item.propertyId}</span>
            <div class="visit-prop-title">${item.propertyTitle || 'Imóvel Santos & Mello'}</div>
          </div>

          <div class="visit-person-row">
            <div><strong>Cliente:</strong> ${item.clientName}</div>
            <div>
              <strong>WhatsApp:</strong> 
              <a href="${whatsAppLink}" target="_blank" class="visit-whatsapp-link">
                💬 ${item.clientPhone}
              </a>
            </div>
            <div><strong>Corretor:</strong> ${item.brokerName || 'Plantão de Locação'}</div>
            ${item.notes ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.3rem;"><em>"${item.notes}"</em></div>` : ''}
          </div>

          <div class="visit-footer-actions">
            ${item.status !== 'Confirmada' && item.status !== 'Realizada' ? `
              <button type="button" class="btn-secondary-action btn-confirm-visit" data-id="${item.id}" style="font-size:0.75rem; padding:0.4rem 0.7rem;">
                ✓ Confirmar
              </button>
            ` : ''}
            ${item.status !== 'Realizada' ? `
              <button type="button" class="btn-primary-action btn-complete-visit" data-id="${item.id}" style="font-size:0.75rem; padding:0.4rem 0.7rem;">
                🤝 Concluída
              </button>
            ` : ''}
            <button type="button" class="btn-icon-action btn-view-visit-prop" data-id="${item.propertyId}" title="Ver Imóvel">
              🔍
            </button>
            <button type="button" class="btn-icon-action danger btn-cancel-visit" data-id="${item.id}" title="Cancelar Visita">
              ✕
            </button>
          </div>
        </div>
      `;
    }).join('');

    visitsGrid.innerHTML = html;

    // Listeners das ações
    visitsGrid.querySelectorAll('.btn-confirm-visit').forEach(btn => {
      btn.addEventListener('click', () => updateVisitStatus(btn.dataset.id, 'Confirmada'));
    });

    visitsGrid.querySelectorAll('.btn-complete-visit').forEach(btn => {
      btn.addEventListener('click', () => updateVisitStatus(btn.dataset.id, 'Realizada'));
    });

    visitsGrid.querySelectorAll('.btn-cancel-visit').forEach(btn => {
      btn.addEventListener('click', () => deleteVisit(btn.dataset.id));
    });

    visitsGrid.querySelectorAll('.btn-view-visit-prop').forEach(btn => {
      btn.addEventListener('click', () => viewPropertyInCatalog(btn.dataset.id));
    });
  }

  async function updateVisitStatus(id, status) {
    try {
      const res = await fetch(`/api/visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erro ao atualizar.');
      showToast(`Visita marcada como "${status}"!`);
      loadVisits();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteVisit(id) {
    if (confirm('Deseja realmente cancelar este agendamento de visita?')) {
      try {
        const res = await fetch(`/api/visits/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Erro ao cancelar.');
        showToast('Visita cancelada.');
        loadVisits();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  }

  function openVisitModal() {
    if (visitForm) {
      visitForm.reset();
      // Data padrão: hoje ou amanhã
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      document.getElementById('visitDate').value = tomorrow;
      document.getElementById('visitTime').value = '14:00';
    }
    if (visitModalOverlay) visitModalOverlay.classList.add('active');
  }

  function closeVisitModal() {
    if (visitModalOverlay) visitModalOverlay.classList.remove('active');
  }

  async function saveVisitFromForm() {
    const propertyId = document.getElementById('visitPropertySelect').value.trim();
    const clientName = document.getElementById('visitClientName').value.trim();
    const clientPhone = document.getElementById('visitClientPhone').value.trim();
    const clientEmail = document.getElementById('visitClientEmail').value.trim();
    const brokerName = document.getElementById('visitBrokerSelect').value;
    const date = document.getElementById('visitDate').value;
    const time = document.getElementById('visitTime').value;
    const notes = document.getElementById('visitNotes').value.trim();

    if (!propertyId || !clientName || !clientPhone || !date || !time) {
      showToast('Por favor, preencha os campos obrigatórios da visita.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          clientName,
          clientPhone,
          clientEmail,
          brokerName,
          date,
          time,
          notes
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha ao agendar visita.');

      showToast('Visita agendada com sucesso! O status do imóvel foi atualizado.');
      closeVisitModal();
      loadVisits();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- MÓDULO 4: CONTROLE DE CHAVES (CLAVICULÁRIO) ---
  const keysGrid = document.getElementById('keysGrid');
  const btnCheckoutKey = document.getElementById('btnCheckoutKey');
  const keyModalOverlay = document.getElementById('keyModalOverlay');
  const keyCheckoutForm = document.getElementById('keyCheckoutForm');
  const keyModalClose = document.getElementById('keyModalClose');
  const keyModalCancel = document.getElementById('keyModalCancel');

  // Banner counters
  const keyStatAvailable = document.getElementById('keyStatAvailable');
  const keyStatOut = document.getElementById('keyStatOut');
  const keyStatDelayed = document.getElementById('keyStatDelayed');

  function initKeysEvents() {
    if (btnCheckoutKey) {
      btnCheckoutKey.addEventListener('click', openKeyCheckoutModal);
    }
    if (keyModalClose) keyModalClose.addEventListener('click', closeKeyModal);
    if (keyModalCancel) keyModalCancel.addEventListener('click', closeKeyModal);

    if (keyCheckoutForm) {
      keyCheckoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveKeyCheckout();
      });
    }
  }

  async function loadKeys() {
    if (!keysGrid) return;
    keysGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem;"><div class="loading-spinner" style="margin: 0 auto 0.5rem;"></div>Carregando claviculário de chaves...</div>`;

    try {
      const res = await fetch('/api/keys');
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'Falha ao buscar movimentações de chaves.');

      state.keysList = json.data;
      if (keysNavBadge) keysNavBadge.textContent = state.keysList.filter(k => k.status !== 'Devolvida').length;

      const checkedOut = state.keysList.filter(k => k.status === 'Retirada').length;
      const delayed = state.keysList.filter(k => k.status === 'Atrasada').length;
      const returned = state.keysList.filter(k => k.status === 'Devolvida').length;

      if (keyStatOut) keyStatOut.textContent = checkedOut;
      if (keyStatDelayed) keyStatDelayed.textContent = delayed;
      if (keyStatAvailable) keyStatAvailable.textContent = returned + 45; // simulando disponíveis no claviculário

      renderKeysGrid(state.keysList);
    } catch (err) {
      keysGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">Erro: ${err.message}</div>`;
    }
  }

  function renderKeysGrid(list) {
    if (!list || list.length === 0) {
      keysGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">Nenhuma movimentação de chave registrada no momento.</div>`;
      return;
    }

    const html = list.map(item => {
      const isOut = item.status === 'Retirada' || item.status === 'Atrasada';
      const statusBadge = item.status === 'Atrasada' 
        ? '<span class="status-badge status-analise_contrato">⚠️ Atrasada</span>'
        : (item.status === 'Retirada' ? '<span class="status-badge status-chave_entregue">🔑 Em Visita</span>' : '<span class="status-badge status-disponivel">✓ Devolvida</span>');

      const takenDateFmt = new Date(item.takenAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const returnDateFmt = item.expectedReturn ? new Date(item.expectedReturn).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

      return `
        <div class="key-card ${item.status === 'Atrasada' ? 'status-delayed' : ''}" data-id="${item.id}">
          <div class="key-card-header">
            <span class="key-tag-badge">🔑 ${item.keyTag}</span>
            ${statusBadge}
          </div>

          <div style="font-weight:700; color:var(--text-primary); font-size:0.95rem;">
            Imóvel #${item.propertyId}
          </div>

          <div style="font-size:0.85rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.25rem;">
            <div><strong>Retirado por:</strong> ${item.takenBy}</div>
            <div><strong>Saída:</strong> ${takenDateFmt} • <strong>Devolução Prevista:</strong> ${returnDateFmt}</div>
            ${item.purpose ? `<div><strong>Finalidade:</strong> ${item.purpose}</div>` : ''}
            ${item.notes ? `<div style="font-size:0.78rem; color:var(--text-muted);">Obs: ${item.notes}</div>` : ''}
          </div>

          <div style="margin-top:auto; padding-top:0.75rem; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
            <button type="button" class="btn-icon-action btn-view-key-prop" data-id="${item.propertyId}" title="Ver Imóvel">
              🔍
            </button>
            ${isOut ? `
              <button type="button" class="btn-primary-action btn-return-key" data-id="${item.id}" style="font-size:0.8rem; padding:0.45rem 0.85rem;">
                📥 Confirmar Devolução
              </button>
            ` : `<span style="font-size:0.78rem; color:var(--text-muted);">Devolvida no claviculário</span>`}
          </div>
        </div>
      `;
    }).join('');

    keysGrid.innerHTML = html;

    keysGrid.querySelectorAll('.btn-return-key').forEach(btn => {
      btn.addEventListener('click', () => confirmReturnKey(btn.dataset.id));
    });

    keysGrid.querySelectorAll('.btn-view-key-prop').forEach(btn => {
      btn.addEventListener('click', () => viewPropertyInCatalog(btn.dataset.id));
    });
  }

  async function confirmReturnKey(id) {
    const notes = prompt('Observações de devolução (ex: chaves e controle conferidos com sucesso):', 'Vistoria e chaves conferidas');
    if (notes === null) return; // cancelou

    try {
      const res = await fetch(`/api/keys/${id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erro na devolução.');
      showToast('Devolução confirmada! Chave guardada no claviculário.');
      loadKeys();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function openKeyCheckoutModal() {
    if (keyCheckoutForm) keyCheckoutForm.reset();
    if (keyModalOverlay) keyModalOverlay.classList.add('active');
  }

  function closeKeyModal() {
    if (keyModalOverlay) keyModalOverlay.classList.remove('active');
  }

  async function saveKeyCheckout() {
    const propertyId = document.getElementById('keyPropertySelect').value.trim();
    const keyTag = document.getElementById('keyTagInput').value.trim() || `CLAV-${propertyId}`;
    const takenBy = document.getElementById('keyBrokerInput').value.trim();
    const purpose = document.getElementById('keyPurposeInput').value.trim();

    if (!propertyId || !takenBy) {
      showToast('Preencha o código do imóvel e o corretor responsável.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/keys/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          keyTag,
          takenBy,
          purpose,
          expectedReturn: new Date(Date.now() + 3600000 * 3).toISOString()
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erro ao registrar saída.');

      showToast('Saída de chave registrada no claviculário!');
      closeKeyModal();
      loadKeys();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- MÓDULO 5: RELATÓRIOS & BI IMOBILIÁRIO ---
  const biKpiTotal = document.getElementById('biKpiTotal');
  const biKpiRent = document.getElementById('biKpiRent');
  const biKpiSale = document.getElementById('biKpiSale');
  const biKpiAvgRent = document.getElementById('biKpiAvgRent');
  const biKpiAvgSale = document.getElementById('biKpiAvgSale');
  const biKpiVisits = document.getElementById('biKpiVisits');
  const biPortalXmlTotal = document.getElementById('biPortalXmlTotal');
  const biPortalChavesMao = document.getElementById('biPortalChavesMao');
  const biPortalDiscrepancy = document.getElementById('biPortalDiscrepancy');
  const biFunnelBars = document.getElementById('biFunnelBars');
  const biNeighborhoodBars = document.getElementById('biNeighborhoodBars');
  const biTypesBars = document.getElementById('biTypesBars');

  async function loadReports() {
    try {
      const res = await fetch('/api/bi/reports');
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'Falha ao carregar relatórios.');

      state.reportsData = json.data;
      renderReports(json.data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderReports(data) {
    const { overview, chavesNaMaoPortalComparison, kanbanFunnel, visitsMetrics, keysMetrics, topNeighborhoods, topPropertyTypes } = data;

    // KPIs
    if (biKpiTotal) biKpiTotal.textContent = overview.totalProperties.toLocaleString('pt-BR');
    if (biKpiRent) biKpiRent.textContent = overview.totalRent.toLocaleString('pt-BR');
    if (biKpiSale) biKpiSale.textContent = overview.totalSale.toLocaleString('pt-BR');
    if (biKpiAvgRent) biKpiAvgRent.textContent = `R$ ${overview.avgRentalPrice.toLocaleString('pt-BR')}`;
    if (biKpiAvgSale) biKpiAvgSale.textContent = `R$ ${overview.avgSalePrice.toLocaleString('pt-BR')}`;
    if (biKpiVisits) biKpiVisits.textContent = visitsMetrics.total;

    // Comparativo Chaves na Mão do documento PDF do usuário
    if (biPortalXmlTotal) biPortalXmlTotal.textContent = chavesNaMaoPortalComparison.totalXmlFeed.toLocaleString('pt-BR');
    if (biPortalChavesMao) biPortalChavesMao.textContent = chavesNaMaoPortalComparison.chavesNaMaoPublished.toLocaleString('pt-BR');
    if (biPortalDiscrepancy) {
      const diff = chavesNaMaoPortalComparison.totalXmlFeed - chavesNaMaoPortalComparison.chavesNaMaoPublished;
      biPortalDiscrepancy.textContent = `${diff} imóveis`;
    }

    // Funil da Jornada
    if (biFunnelBars) {
      biFunnelBars.innerHTML = kanbanFunnel.stages.map(s => `
        <div class="bi-bar-item">
          <div class="bi-bar-header">
            <span>${s.icon} ${s.label}</span>
            <strong>${s.count} (${s.percent}%)</strong>
          </div>
          <div class="bi-bar-track">
            <div class="bi-bar-fill" style="width: ${Math.max(5, s.percent)}%; background: ${s.color};"></div>
          </div>
        </div>
      `).join('');
    }

    // Top Bairros
    if (biNeighborhoodBars) {
      biNeighborhoodBars.innerHTML = topNeighborhoods.map(n => `
        <div class="bi-bar-item">
          <div class="bi-bar-header">
            <span>📍 ${n.name}</span>
            <strong>${n.count} imóveis (${n.percent}%)</strong>
          </div>
          <div class="bi-bar-track">
            <div class="bi-bar-fill" style="width: ${Math.max(4, n.percent * 2.5)}%;"></div>
          </div>
        </div>
      `).join('');
    }

    // Tipos de Imóveis
    if (biTypesBars) {
      biTypesBars.innerHTML = topPropertyTypes.map(t => `
        <div class="bi-bar-item">
          <div class="bi-bar-header">
            <span>🏢 ${t.type}</span>
            <strong>${t.count} imóveis (${t.percent}%)</strong>
          </div>
          <div class="bi-bar-track">
            <div class="bi-bar-fill" style="width: ${Math.max(4, t.percent * 1.5)}; background: #06b6d4;"></div>
          </div>
        </div>
      `).join('');
    }
  }

  // --- Inicialização Geral do CRM ---
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initCrudEvents();
    initPropModal();
    initKanbanEvents();
    initVisitsEvents();
    initKeysEvents();
  });

})();
