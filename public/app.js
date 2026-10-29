/**
 * Buscador Minimalista de Imóveis por Código & Filtros Avançados
 * Santos & Mello • Feed XML VivaReal
 */

(function () {
  'use strict';

  // --- Elementos DOM ---
  const themeToggle = document.getElementById('themeToggle');
  const feedStatusText = document.getElementById('feedStatusText');
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');
  const chipsList = document.getElementById('chipsList');

  // Abas Rápidas de Finalidade / Situação
  const quickStatusTabs = document.getElementById('quickStatusTabs');
  const tabBadgeAll = document.getElementById('tabBadgeAll');
  const tabBadgeRent = document.getElementById('tabBadgeRent');
  const tabBadgeSale = document.getElementById('tabBadgeSale');

  // Filtros
  const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
  const filtersPanel = document.getElementById('filtersPanel');
  const filterCountBadge = document.getElementById('filterCountBadge');
  const filterType = document.getElementById('filterType');
  const filterStatus = document.getElementById('filterStatus');
  const filterUsageType = document.getElementById('filterUsageType');
  const filterPropertyType = document.getElementById('filterPropertyType');
  const filterCity = document.getElementById('filterCity');
  
  // Multi-Select Tipos de Imóvel (Seleção múltipla oficial)
  const OFFICIAL_PROPERTY_TYPES = [
    'Casa',
    'Sobrado',
    'Assobradada',
    'Apartamento',
    'Apartamento S/ Condominio',
    'Cobertura',
    'Kitnet',
    'Salão',
    'Sala Comercial',
    'Galpão',
    'Loja',
    'Sobreloja',
    'Terreno'
  ];
  const propertyTypeMultiSelect = document.getElementById('propertyTypeMultiSelect');
  const propertyTypeInput = document.getElementById('propertyTypeInput');
  const propertyTypeDropdown = document.getElementById('propertyTypeDropdown');
  const propertyTypeOptionsList = document.getElementById('propertyTypeOptionsList');
  const propertyTypeTags = document.getElementById('propertyTypeTags');
  const clearPropertyTypesBtn = document.getElementById('clearPropertyTypesBtn');
  const togglePropertyTypeDropdown = document.getElementById('togglePropertyTypeDropdown');
  const selectedPropertyTypes = new Set();
  
  // Multi-Select Bairros
  const neighborhoodMultiSelect = document.getElementById('neighborhoodMultiSelect');
  const neighborhoodInput = document.getElementById('neighborhoodInput');
  const neighborhoodDropdown = document.getElementById('neighborhoodDropdown');
  const neighborhoodOptionsList = document.getElementById('neighborhoodOptionsList');
  const neighborhoodTags = document.getElementById('neighborhoodTags');
  const clearNeighborhoodsBtn = document.getElementById('clearNeighborhoodsBtn');
  const toggleNeighborhoodDropdown = document.getElementById('toggleNeighborhoodDropdown');

  // Faixa de Preços
  const filterMinPrice = document.getElementById('filterMinPrice');
  const filterMaxPrice = document.getElementById('filterMaxPrice');

  const filterMinArea = document.getElementById('filterMinArea');
  const filterBeds = document.getElementById('filterBeds');
  const filterSuites = document.getElementById('filterSuites');
  const filterBathrooms = document.getElementById('filterBathrooms');
  const filterGarage = document.getElementById('filterGarage');
  const filterSortBy = document.getElementById('filterSortBy');
  const filterHasTour = document.getElementById('filterHasTour');
  const featuresChipsList = document.getElementById('featuresChipsList');
  const applyFiltersBtn = document.getElementById('applyFiltersBtn');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const selectedFeatures = new Set();
  const selectedNeighborhoods = new Set();
  let searchAbortController = null;
    // Lista oficial canônica de 95 bairros registrados
  const OFFICIAL_NEIGHBORHOODS = [
  "Bangú",
  "Boqueirão",
  "Campestre",
  "Casa Branca",
  "Cata Preta",
  "Centreville",
  "Centro",
  "Cidade São Jorge",
  "Condomínio Maracanã",
  "Gonzaga",
  "Jardim",
  "Jardim Alvorada",
  "Jardim Alzira Franco",
  "Jardim Ana Maria",
  "Jardim Bela Vista",
  "Jardim Bom Pastor",
  "Jardim Cipreste",
  "Jardim Clube de Campo",
  "Jardim Cristiane",
  "Jardim das Maravilhas",
  "Jardim do Estádio",
  "Jardim Guarará",
  "Jardim Ipanema",
  "Jardim Irene",
  "Jardim Itapoan",
  "Jardim Jamaica",
  "Jardim Joaquim Eugênio de Lima",
  "Jardim Las Vegas",
  "Jardim Marek",
  "Jardim Rina",
  "Jardim Santa Cristina",
  "Jardim Santo Alberto",
  "Jardim Santo André",
  "Jardim Santo Antônio",
  "Jardim Stella",
  "Jardim Telles de Menezes",
  "Jardim Utinga",
  "Jardim Vila Rica",
  "Miami Riviera",
  "Novo Homero Thon",
  "Paraíso",
  "Paranapiacaba",
  "Parque América",
  "Parque Capuava",
  "Parque das Nações",
  "Parque do Pedroso",
  "Parque Erasmo Assunção",
  "Parque Gerassi",
  "Parque Jaçatuba",
  "Parque João Ramalho",
  "Parque Marajoara",
  "Parque Novo Oratório",
  "Parque Oratório",
  "Parque Represa Billings III",
  "Pinheirinho",
  "Recreio da Borda do Campo",
  "Santa Maria",
  "Santa Terezinha",
  "Silveira",
  "Sítio dos Vianas",
  "Vila Alice",
  "Vila Alpina",
  "Vila Alzira",
  "Vila América",
  "Vila Aquilino",
  "Vila Assunção",
  "Vila Bastos",
  "Vila Camilópolis",
  "Vila Curuçá",
  "Vila Floresta",
  "Vila Francisco Matarazzo",
  "Vila Gilda",
  "Vila Guaraciaba",
  "Vila Guarani",
  "Vila Guiomar",
  "Vila Helena",
  "Vila Homero Thon",
  "Vila Humaitá",
  "Vila João Ramalho",
  "Vila Junqueira",
  "Vila Linda",
  "Vila Lucinda",
  "Vila Lutécia",
  "Vila Luzita",
  "Vila Metalúrgica",
  "Vila Palmares",
  "Vila Pires",
  "Vila Príncipe de Gales",
  "Vila Progresso",
  "Vila Sacadura Cabral",
  "Vila Scarpelli",
  "Vila Suíça",
  "Vila Tibiriçá",
  "Vila Valparaíso",
  "Vila Vitória"
];
  let allNeighborhoods = [...OFFICIAL_NEIGHBORHOODS];


  // Estados de visualização
  const initialState = document.getElementById('initialState');
  const loadingState = document.getElementById('loadingState');
  const notFoundState = document.getElementById('notFoundState');
  const notFoundTitle = document.getElementById('notFoundTitle');
  const notFoundMsg = document.getElementById('notFoundMsg');
  const resultsGridSection = document.getElementById('resultsGridSection');
  const resultsCountText = document.getElementById('resultsCountText');
  const propertiesGrid = document.getElementById('propertiesGrid');
  const propertyResult = document.getElementById('propertyResult');
  const backToGridBtn = document.getElementById('backToGridBtn');
  const loadMoreWrapper = document.getElementById('loadMoreWrapper');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const loadMoreCount = document.getElementById('loadMoreCount');
  const activeFilterTags = document.getElementById('activeFilterTags');

  // Elementos da Ficha Única do Imóvel
  const propCode = document.getElementById('propCode');
  const propTransType = document.getElementById('propTransType');
  const propUsage = document.getElementById('propUsage');
  const propCategory = document.getElementById('propCategory');
  const propStatus = document.getElementById('propStatus');
  const propTitle = document.getElementById('propTitle');
  const propAddress = document.getElementById('propAddress');
  const viewWebsiteBtn = document.getElementById('viewWebsiteBtn');

  // Galeria
  const mainImage = document.getElementById('mainImage');
  const photoCounter = document.getElementById('photoCounter');
  const prevPhotoBtn = document.getElementById('prevPhotoBtn');
  const nextPhotoBtn = document.getElementById('nextPhotoBtn');
  const expandPhotoBtn = document.getElementById('expandPhotoBtn');
  const thumbnailsContainer = document.getElementById('thumbnailsContainer');

  // Preço e Métricas
  const priceLabel = document.getElementById('priceLabel');
  const propPrice = document.getElementById('propPrice');
  const condoPrice = document.getElementById('condoPrice');
  const iptuPrice = document.getElementById('iptuPrice');
  const specArea = document.getElementById('specArea');
  const specLotAreaItem = document.getElementById('specLotAreaItem');
  const specLotArea = document.getElementById('specLotArea');
  const specConstAreaItem = document.getElementById('specConstAreaItem');
  const specConstArea = document.getElementById('specConstArea');
  const specBeds = document.getElementById('specBeds');
  const specBaths = document.getElementById('specBaths');
  const specGarage = document.getElementById('specGarage');

  // Ações
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const copyChatMsgBtn = document.getElementById('copyChatMsgBtn');
  const viewTourBtn = document.getElementById('viewTourBtn');
  const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
  const copySummaryBtn = document.getElementById('copySummaryBtn');

  // Descrição e Features
  const propDesc = document.getElementById('propDesc');
  const expandDescBtn = document.getElementById('expandDescBtn');
  const featuresSection = document.getElementById('featuresSection');
  const featuresList = document.getElementById('featuresList');

  // Modal e Toast
  const photoModal = document.getElementById('photoModal');
  const modalImg = document.getElementById('modalImg');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  // Estado Local
  let currentProperty = null;
  let currentPhotoIndex = 0;
  let lastSearchResults = [];
  let isFiltersOpen = false;
  let savedScrollPosition = 0;

  // Estado de Seleção Múltipla de Imóveis (para Atendimento no CRM)
  const selectedPropertyIds = new Set();

  // Imóveis registrados no Session Metadata do Helena CRM para o atendimento atual
  const sentPropertiesInSession = new Set();

  // Estado de Paginação
  const PAGE_SIZE = 40;
  let currentOffset = 0;
  let totalAvailable = 0;
  let loadedPropertiesList = [];
  let isLoadingMore = false;

  function formatTitle(str) {
    if (!str) return '';
    if (str === str.toUpperCase()) {
      return str.toLowerCase().replace(/(?:^|\s|-|\/)\S/g, (a) => a.toUpperCase());
    }
    return str;
  }

  // --- Formatadores ---
  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  });

  function formatMoney(value) {
    if (!value || isNaN(value) || value <= 0) return 'Sob Consulta';
    return currencyFormatter.format(value);
  }

  // --- Tema Claro / Escuro ---
  function initTheme() {
    const urlParams = new URLSearchParams(window.location.search);
    const isLeadView = urlParams.has('contactId') || urlParams.has('contact_id') || urlParams.has('leadId') || window.location.pathname.includes('simplificada');

    if (isLeadView) {
      document.documentElement.setAttribute('data-theme', 'light');
      if (themeToggle) themeToggle.style.display = 'none';
      return;
    }

    const savedTheme = localStorage.getItem('app-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('app-theme', next);
    });
  }

  // --- Toast Notification ---
  let toastTimer = null;
  function showToast(msg) {
    toastMessage.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // --- Cópia Segura Universal com Fallback para Iframes (Helena CRM) ---
  async function copyToClipboard(text) {
    if (!text) return false;
    let success = false;

    // 1. Tenta API moderna do Clipboard
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch (err) {
        console.warn('Clipboard API restrita no iframe, ativando fallback...', err);
      }
    }

    // 2. Fallback universal via textarea temporário (funciona mesmo com restrição de permissão de iframe)
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

  // Feedback Visual Instantâneo no Botão Clicado
  function triggerCopiedFeedback(btn, feedbackText = '✅ Copiado!') {
    if (!btn) return;
    const originalHtml = btn.dataset.originalHtml || btn.innerHTML;
    if (!btn.dataset.originalHtml) {
      btn.dataset.originalHtml = originalHtml;
    }
    btn.classList.add('copied');
    btn.innerHTML = feedbackText;

    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = btn.dataset.originalHtml || originalHtml;
    }, 2200);
  }

  // --- Formatadores de Mensagem para Atendimento / WhatsApp ---
  function getPropertyShareData(prop) {
    const isRental = String(prop.transactionType || '').toLowerCase().includes('locação');
    let cleanType = (prop.propertyType || prop.tipo || 'Imóvel')
      .replace('Residential / ', '')
      .replace('Commercial / ', '')
      .trim();

    const typeTranslations = {
      'Apartment': 'Apartamento',
      'Home': 'Casa',
      'Two-Story House': 'Sobrado',
      'Penthouse': 'Cobertura',
      'Studio': 'Studio',
      'Kitnet': 'Kitnet',
      'Loft': 'Loft',
      'Land': 'Terreno',
      'Allotment / Land': 'Terreno',
      'Commercial Building': 'Prédio Comercial',
      'Office': 'Sala Comercial',
      'Shed': 'Galpão'
    };
    if (typeTranslations[cleanType]) {
      cleanType = typeTranslations[cleanType];
    }

    const mainPrice = isRental ? (prop.rentalPrice || prop.price) : (prop.price || prop.rentalPrice);
    const priceText = formatMoney(mainPrice) + (isRental ? '/mês' : '');
    const linkImovel = prop.websiteUrl || `https://www.santosemello.com.br/imovel/${prop.id}`;

    // Apenas dormitórios e vagas (metragem removida para deixar o texto limpo e direto)
    const specs = [];
    if (prop.bedrooms > 0) {
      specs.push(`🛏️ ${prop.bedrooms} dormitório${prop.bedrooms > 1 ? 's' : ''}${prop.suites > 0 ? ` (${prop.suites} suíte${prop.suites > 1 ? 's' : ''})` : ''}`);
    }
    if (prop.garage > 0) {
      specs.push(`🚗 ${prop.garage} vaga${prop.garage > 1 ? 's' : ''}`);
    }

    const custos = [];
    if (prop.condo > 0) custos.push(`Condomínio: ${formatMoney(prop.condo)}`);
    if (prop.iptu > 0) custos.push(`IPTU: ${formatMoney(prop.iptu)}`);

    const loc = prop.location || {};
    const street = loc.address || prop.endereco || '';
    const num = (loc.streetNumber || prop.numero) && !String(loc.streetNumber || prop.numero).includes('*') ? `, ${loc.streetNumber || prop.numero}` : '';
    const comp = (loc.complement || prop.complemento) && !String(loc.complement || prop.complemento).includes('*') ? ` - ${loc.complement || prop.complemento}` : '';
    const logradouro = street ? `${street}${num}${comp}` : '';
    const bairro = loc.neighborhood || prop.bairro || 'Santo André';
    const cid = loc.city || prop.cidade || 'Santo André';
    const uf = loc.state || prop.estado || 'SP';
    const cep = loc.postalCode || prop.cep || '';

    const parts = [];
    if (logradouro) parts.push(logradouro);
    if (bairro) parts.push(bairro);
    if (cid && uf) parts.push(`${cid} - ${uf}`);
    else if (cid) parts.push(cid);
    if (cep && cep !== '00000-000') parts.push(`CEP ${cep}`);

    const fullAddress = prop.enderecoCompleto || (parts.length > 0 ? parts.join(', ') : `${bairro} - ${cid}`);

    return {
      isRental,
      cleanType,
      priceText,
      linkImovel,
      specs,
      custos,
      neighborhood: bairro,
      city: cid,
      fullAddress
    };
  }

  function formatSinglePropertyChatText(prop, leadName = '') {
    const data = getPropertyShareData(prop);
    const saudacao = leadName && !leadName.toLowerCase().includes('cliente') && !leadName.toLowerCase().includes('lead')
      ? `Olá, ${leadName.split(' ')[0]}!`
      : 'Olá!';

    const lines = [
      `${saudacao} 👋 Selecionei esta opção na Santos & Mello que combina perfeitamente com você:`,
      ``,
      `*Imóvel Cód. #${prop.id}*`,
      ``
    ];

    if (data.fullAddress) {
      lines.push(`📍 *Endereço:* ${data.fullAddress}`, ``);
    } else if (data.neighborhood) {
      lines.push(`📍 *Bairro:* ${data.neighborhood}`, ``);
    }

    const custosText = data.custos.length ? ` (${data.custos.join(' | ')})` : '';
    lines.push(`💰 *Valor:* ${data.priceText}${custosText}`, ``);

    if (data.specs.length) {
      lines.push(data.specs.join(' • '), ``);
    }

    lines.push(
      `🔗 *Link do imóvel:*`,
      data.linkImovel,
      ``,
      `Podemos conversar sobre este imóvel? Estou à disposição para tirar dúvidas ou agendarmos uma visita! 😊`
    );

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function formatBulkPropertiesChatText(propsList, leadName = '') {
    const saudacao = leadName && !leadName.toLowerCase().includes('cliente') && !leadName.toLowerCase().includes('lead')
      ? `Olá, ${leadName.split(' ')[0]}!`
      : 'Olá!';

    const lines = [
      `${saudacao} 👋 Selecionei estas ${propsList.length} opções na Santos & Mello que combinam muito com você:`,
      ``
    ];

    propsList.forEach((prop, idx) => {
      const data = getPropertyShareData(prop);

      lines.push(`*Opção ${idx + 1} (Cód. #${prop.id})*`);
      lines.push(``);

      if (data.fullAddress) {
        lines.push(`📍 *Endereço:* ${data.fullAddress}`);
        lines.push(``);
      } else if (data.neighborhood) {
        lines.push(`📍 *Bairro:* ${data.neighborhood}`);
        lines.push(``);
      }

      const custosText = data.custos.length ? ` (${data.custos.join(' | ')})` : '';
      lines.push(`💰 *Valor:* ${data.priceText}${custosText}`);
      lines.push(``);

      if (data.specs.length) {
        lines.push(data.specs.join(' • '));
        lines.push(``);
      }

      lines.push(`🔗 *Link do imóvel:*`);
      lines.push(data.linkImovel);
      lines.push(``);
      lines.push(``); // Espaçamento entre opções
    });

    lines.push(`Qual dessas opções você prefere para conversarmos e agendarmos uma visita? 😊`);

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // --- Atualização Visual de Imóveis Enviados na Sessão (Badges e Contadores) ---
  function updateSentBadgesInUI() {
    sentPropertiesInSession.forEach(id => {
      const card = document.querySelector(`.property-mini-card[data-id="${id}"]`);
      if (card) {
        const badgesContainer = card.querySelector('.mini-card-badges');
        if (badgesContainer && !badgesContainer.querySelector('.badge-sent-helena')) {
          const sentBadge = document.createElement('span');
          sentBadge.className = 'badge badge-sent-helena';
          sentBadge.dataset.id = id;
          sentBadge.innerHTML = '📤 Enviado';
          sentBadge.title = 'Registrado na sessão de atendimento do Helena CRM';
          badgesContainer.prepend(sentBadge);
        }
      }
    });

    const toolbarBadge = document.getElementById('toolbarSessionSavedBadge');
    if (toolbarBadge) {
      if (sentPropertiesInSession.size > 0) {
        toolbarBadge.style.display = 'inline-flex';
        toolbarBadge.textContent = `📤 ${sentPropertiesInSession.size} salvo${sentPropertiesInSession.size > 1 ? 's' : ''} no atendimento`;
      } else {
        toolbarBadge.style.display = 'none';
      }
    }
  }

  // --- Gravação Automática no Session Metadata do Helena CRM ---
  async function recordPropertiesSentToHelena(propsList) {
    const pageParams = new URLSearchParams(window.location.search);
    const contactId = (leadSimulationState && leadSimulationState.contactId) || pageParams.get('contactId') || pageParams.get('contact_id');
    const sessionId = pageParams.get('sessionId') || pageParams.get('session_id') || window.__helenaSessionId || null;
    const tokenInQuery = pageParams.get('token') || pageParams.get('helenaToken') || '';

    // Apenas grava se estiver no contexto de um atendimento Helena CRM
    if (!contactId && !sessionId) return;

    const items = (Array.isArray(propsList) ? propsList : [propsList]).filter(Boolean);
    if (items.length === 0) return;

    // Feedback visual imediato na UI
    items.forEach(p => {
      const pId = String(p.id || p.codigo || '');
      if (pId) sentPropertiesInSession.add(pId);
    });
    updateSentBadgesInUI();

    try {
      const payload = {
        contactId,
        sessionId,
        token: tokenInQuery || undefined,
        properties: items.map(p => {
          const share = getPropertyShareData(p);
          return {
            id: String(p.id),
            codigo: String(p.id),
            titulo: p.title || p.titulo || `${p.propertyType || ''} em ${p.location?.neighborhood || ''}`,
            tipo: p.propertyType || p.tipo || '',
            bairro: p.location?.neighborhood || p.bairro || '',
            cidade: p.location?.city || p.cidade || 'Santo André',
            valor: p.rentalPrice || p.price || p.valor || 0,
            valorFormatado: share.priceText || '',
            finalidade: p.transactionType || p.finalidade || '',
            url: p.websiteUrl || `${window.location.origin}/?codigo=${p.id}`,
            websiteUrl: p.websiteUrl || `${window.location.origin}/?codigo=${p.id}`,
            primaryImage: p.primaryImage || (p.images && p.images[0]) || '',
            foto: p.primaryImage || (p.images && p.images[0]) || '',
            matchScore: p.matchScore || null
          };
        })
      };

      const res = await fetch(`${API_BASE}/api/leads/session-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const resData = await res.json();
        if (resData.data && resData.data.sessionId) {
          window.__helenaSessionId = resData.data.sessionId;
        }
        if (resData.data && Array.isArray(resData.data.imoveisEnviados)) {
          resData.data.imoveisEnviados.forEach(i => sentPropertiesInSession.add(String(i.id)));
          updateSentBadgesInUI();
        }
        console.log(`✅ [Helena CRM] ${items.length} imóvel(is) registrado(s) no Session Metadata.`);
      }
    } catch (err) {
      console.warn('⚠️ Falha ao registrar session metadata em segundo plano:', err.message);
    }
  }

  // Atualiza Barra Flutuante de Seleção em Lote
  function updateBulkActionsBar() {
    const bulkBar = document.getElementById('bulkActionsBar');
    const bulkCount = document.getElementById('bulkSelectedCount');
    const bulkText = document.getElementById('bulkSelectedText');
    const btnBulkCopyText = document.getElementById('btnBulkCopyText');
    const bulkBtnLabel = btnBulkCopyText ? btnBulkCopyText.querySelector('.bulk-btn-label') : null;

    if (!bulkBar) return;

    const count = selectedPropertyIds.size;
    if (count > 0) {
      bulkBar.style.display = 'block';
      if (bulkCount) bulkCount.textContent = count;
      if (bulkText) bulkText.textContent = count === 1 ? 'imóvel selecionado' : 'imóveis selecionados';
      if (bulkBtnLabel) {
        bulkBtnLabel.textContent = count === 1 ? 'Copiar Apresentação p/ Atendimento' : `Copiar ${count} Opções p/ Atendimento`;
      }
    } else {
      bulkBar.style.display = 'none';
    }
  }

  // Determina base da API: se aberto via file:// aponta para localhost:3333; na web (Vercel ou servidor próprio), usa rota relativa
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3333' : '';

  // --- Gerenciador de Estados da UI ---
  function showState(state) {
    initialState.style.display = state === 'initial' ? 'flex' : 'none';
    loadingState.style.display = state === 'loading' ? 'flex' : 'none';
    notFoundState.style.display = state === 'notFound' ? 'flex' : 'none';
    resultsGridSection.style.display = state === 'grid' ? 'flex' : 'none';
    propertyResult.style.display = state === 'single' ? 'block' : 'none';
  }

  // Helper de normalização de texto
  function normalizeStr(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // Helper para conversão de valores monetários
  function parsePriceInput(val) {
    if (!val) return 0;
    const clean = String(val).replace(/\D/g, '');
    return clean ? parseFloat(clean) : 0;
  }

  function setupPriceInput(input) {
    if (!input) return;
    input.addEventListener('input', () => {
      const raw = input.value.replace(/\D/g, '');
      if (raw) {
        const num = parseInt(raw, 10);
        input.value = num.toLocaleString('pt-BR');
      } else {
        input.value = '';
      }
    });
    input.addEventListener('change', () => {
      countActiveFilters();
      searchProperties();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        countActiveFilters();
        searchProperties();
      }
    });
  }

  setupPriceInput(filterMinPrice);
  setupPriceInput(filterMaxPrice);
  renderNeighborhoodOptions();
  renderPropertyTypeOptions();

  // --- Multi-Select de Bairros ---
  function renderNeighborhoodTags() {
    if (!neighborhoodTags) return;
    neighborhoodTags.innerHTML = '';
    if (selectedNeighborhoods.size === 0) {
      if (clearNeighborhoodsBtn) clearNeighborhoodsBtn.style.display = 'none';
      return;
    }
    if (clearNeighborhoodsBtn) clearNeighborhoodsBtn.style.display = 'inline-block';
    selectedNeighborhoods.forEach(bairro => {
      const tag = document.createElement('span');
      tag.className = 'neighborhood-tag';
      tag.innerHTML = `<span>${bairro}</span><button type="button" class="neighborhood-tag-remove" data-bairro="${bairro}" title="Remover bairro">×</button>`;
      neighborhoodTags.appendChild(tag);
    });
  }

  function renderNeighborhoodOptions(query = '') {
    if (!neighborhoodOptionsList) return;
    neighborhoodOptionsList.innerHTML = '';
    const qNorm = normalizeStr(query);
    const filtered = allNeighborhoods.filter(bairro => {
      if (!qNorm) return true;
      return normalizeStr(bairro).includes(qNorm);
    });

    if (filtered.length === 0) {
      neighborhoodOptionsList.innerHTML = '<div class="multi-select-empty">Nenhum bairro encontrado</div>';
      return;
    }

    filtered.forEach(bairro => {
      const isSelected = selectedNeighborhoods.has(bairro);
      const opt = document.createElement('div');
      opt.className = `multi-select-option ${isSelected ? 'selected' : ''}`;
      opt.innerHTML = `<span>${bairro}</span>${isSelected ? '<span style="color:var(--accent-primary);font-weight:700;">✓</span>' : ''}`;
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedNeighborhoods.has(bairro)) {
          selectedNeighborhoods.delete(bairro);
        } else {
          selectedNeighborhoods.add(bairro);
        }
        renderNeighborhoodTags();
        renderNeighborhoodOptions(neighborhoodInput ? neighborhoodInput.value.trim() : '');
        countActiveFilters();
        searchProperties();
      });
      neighborhoodOptionsList.appendChild(opt);
    });
  }

  function openNeighborhoodDropdown() {
    if (!neighborhoodDropdown) return;
    renderNeighborhoodOptions(neighborhoodInput ? neighborhoodInput.value.trim() : '');
    neighborhoodDropdown.style.display = 'block';
    if (toggleNeighborhoodDropdown) toggleNeighborhoodDropdown.classList.add('open');
  }

  function closeNeighborhoodDropdown() {
    if (!neighborhoodDropdown) return;
    neighborhoodDropdown.style.display = 'none';
    if (toggleNeighborhoodDropdown) toggleNeighborhoodDropdown.classList.remove('open');
  }

  if (neighborhoodInput) {
    neighborhoodInput.addEventListener('focus', openNeighborhoodDropdown);
    neighborhoodInput.addEventListener('click', openNeighborhoodDropdown);
    neighborhoodInput.addEventListener('input', () => {
      openNeighborhoodDropdown();
    });
    neighborhoodInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstOpt = neighborhoodOptionsList ? neighborhoodOptionsList.querySelector('.multi-select-option') : null;
        if (firstOpt) {
          firstOpt.click();
          neighborhoodInput.value = '';
        }
      } else if (e.key === 'Escape') {
        closeNeighborhoodDropdown();
      }
    });
  }

  if (toggleNeighborhoodDropdown) {
    toggleNeighborhoodDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      if (neighborhoodDropdown && neighborhoodDropdown.style.display === 'block') {
        closeNeighborhoodDropdown();
      } else {
        if (neighborhoodInput) neighborhoodInput.focus();
        openNeighborhoodDropdown();
      }
    });
  }

  if (neighborhoodTags) {
    neighborhoodTags.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.neighborhood-tag-remove');
      if (!removeBtn) return;
      const bairro = removeBtn.dataset.bairro;
      if (bairro) {
        selectedNeighborhoods.delete(bairro);
        renderNeighborhoodTags();
        renderNeighborhoodOptions(neighborhoodInput ? neighborhoodInput.value.trim() : '');
        countActiveFilters();
        searchProperties();
      }
    });
  }

  if (clearNeighborhoodsBtn) {
    clearNeighborhoodsBtn.addEventListener('click', () => {
      selectedNeighborhoods.clear();
      renderNeighborhoodTags();
      renderNeighborhoodOptions();
      if (neighborhoodInput) neighborhoodInput.value = '';
      countActiveFilters();
      searchProperties();
    });
  }

  // --- Multi-Select de Tipo de Imóvel ---
  function renderPropertyTypeTags() {
    if (!propertyTypeTags) return;
    propertyTypeTags.innerHTML = '';
    if (selectedPropertyTypes.size === 0) {
      if (clearPropertyTypesBtn) clearPropertyTypesBtn.style.display = 'none';
      return;
    }
    if (clearPropertyTypesBtn) clearPropertyTypesBtn.style.display = 'inline-block';
    selectedPropertyTypes.forEach(tipo => {
      const tag = document.createElement('span');
      tag.className = 'multi-select-tag';
      tag.innerHTML = `<span>${tipo}</span><button type="button" class="multi-select-tag-remove" data-tipo="${tipo}" title="Remover tipo">×</button>`;
      propertyTypeTags.appendChild(tag);
    });
  }

  function renderPropertyTypeOptions(query = '') {
    if (!propertyTypeOptionsList) return;
    propertyTypeOptionsList.innerHTML = '';
    const qNorm = normalizeStr(query);
    const filtered = OFFICIAL_PROPERTY_TYPES.filter(tipo => {
      if (!qNorm) return true;
      return normalizeStr(tipo).includes(qNorm);
    });

    if (filtered.length === 0) {
      propertyTypeOptionsList.innerHTML = '<div class="multi-select-empty">Nenhum tipo encontrado</div>';
      return;
    }

    filtered.forEach(tipo => {
      const isSelected = selectedPropertyTypes.has(tipo);
      const opt = document.createElement('div');
      opt.className = `multi-select-option ${isSelected ? 'selected' : ''}`;
      opt.innerHTML = `<span>${tipo}</span>${isSelected ? '<span style="color:var(--accent-primary);font-weight:700;">✓</span>' : ''}`;
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedPropertyTypes.has(tipo)) {
          selectedPropertyTypes.delete(tipo);
        } else {
          selectedPropertyTypes.add(tipo);
        }
        renderPropertyTypeTags();
        renderPropertyTypeOptions(propertyTypeInput ? propertyTypeInput.value.trim() : '');
        countActiveFilters();
        searchProperties();
      });
      propertyTypeOptionsList.appendChild(opt);
    });
  }

  function openPropertyTypeDropdown() {
    if (!propertyTypeDropdown) return;
    renderPropertyTypeOptions(propertyTypeInput ? propertyTypeInput.value.trim() : '');
    propertyTypeDropdown.style.display = 'block';
    if (togglePropertyTypeDropdown) togglePropertyTypeDropdown.classList.add('open');
  }

  function closePropertyTypeDropdown() {
    if (!propertyTypeDropdown) return;
    propertyTypeDropdown.style.display = 'none';
    if (togglePropertyTypeDropdown) togglePropertyTypeDropdown.classList.remove('open');
  }

  if (propertyTypeInput) {
    propertyTypeInput.addEventListener('focus', openPropertyTypeDropdown);
    propertyTypeInput.addEventListener('click', openPropertyTypeDropdown);
    propertyTypeInput.addEventListener('input', () => {
      openPropertyTypeDropdown();
    });
    propertyTypeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstOpt = propertyTypeOptionsList ? propertyTypeOptionsList.querySelector('.multi-select-option') : null;
        if (firstOpt) {
          firstOpt.click();
          propertyTypeInput.value = '';
        }
      } else if (e.key === 'Escape') {
        closePropertyTypeDropdown();
      }
    });
  }

  if (togglePropertyTypeDropdown) {
    togglePropertyTypeDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      if (propertyTypeDropdown && propertyTypeDropdown.style.display === 'block') {
        closePropertyTypeDropdown();
      } else {
        if (propertyTypeInput) propertyTypeInput.focus();
        openPropertyTypeDropdown();
      }
    });
  }

  if (propertyTypeTags) {
    propertyTypeTags.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.multi-select-tag-remove');
      if (!removeBtn) return;
      const tipo = removeBtn.dataset.tipo;
      if (tipo) {
        selectedPropertyTypes.delete(tipo);
        renderPropertyTypeTags();
        renderPropertyTypeOptions(propertyTypeInput ? propertyTypeInput.value.trim() : '');
        countActiveFilters();
        searchProperties();
      }
    });
  }

  if (clearPropertyTypesBtn) {
    clearPropertyTypesBtn.addEventListener('click', () => {
      selectedPropertyTypes.clear();
      renderPropertyTypeTags();
      renderPropertyTypeOptions();
      if (propertyTypeInput) propertyTypeInput.value = '';
      countActiveFilters();
      searchProperties();
    });
  }

  if (neighborhoodMultiSelect) {
    neighborhoodMultiSelect.addEventListener('click', (e) => {
      if (!e.target.closest('.neighborhood-tag-remove') && !e.target.closest('.multi-select-option') && !e.target.closest('.clear-sub-btn')) {
        if (neighborhoodInput) neighborhoodInput.focus();
        openNeighborhoodDropdown();
      }
    });
  }

  if (propertyTypeMultiSelect) {
    propertyTypeMultiSelect.addEventListener('click', (e) => {
      if (!e.target.closest('.multi-select-tag-remove') && !e.target.closest('.multi-select-option') && !e.target.closest('.clear-sub-btn')) {
        if (propertyTypeInput) propertyTypeInput.focus();
        openPropertyTypeDropdown();
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (neighborhoodMultiSelect && !neighborhoodMultiSelect.contains(e.target) && clearNeighborhoodsBtn && !clearNeighborhoodsBtn.contains(e.target)) {
      closeNeighborhoodDropdown();
    }
    if (propertyTypeMultiSelect && !propertyTypeMultiSelect.contains(e.target) && clearPropertyTypesBtn && !clearPropertyTypesBtn.contains(e.target)) {
      closePropertyTypeDropdown();
    }
  });

  // --- Abas Rápidas de Finalidade / Situação ---
  if (quickStatusTabs) {
    quickStatusTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.status-tab');
      if (!tab) return;
      const type = tab.dataset.type;

      quickStatusTabs.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (filterType) filterType.value = type;
      if (filterStatus) {
        if (type === 'Locação') {
          filterStatus.value = 'Locação';
        } else if (type === 'Venda') {
          filterStatus.value = 'Venda';
        } else {
          filterStatus.value = 'disponivel';
        }
      }

      countActiveFilters();
      searchProperties();
    });
  }

  if (filterType) {
    filterType.addEventListener('change', () => {
      if (quickStatusTabs) {
        quickStatusTabs.querySelectorAll('.status-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.type === filterType.value);
        });
      }
    });
  }

  // --- Inicialização e Carregamento de Opções de Filtro ---
  async function loadFilterOptions() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const [statsRes, optionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/stats`, { signal: controller.signal }),
        fetch(`${API_BASE}/api/filter-options`, { signal: controller.signal })
      ]);
      clearTimeout(timeoutId);

      if (statsRes.ok) {
        const stats = await statsRes.json();
        const total = stats.data?.total || stats.data?.totalSite || 1316;
        const totalRent = stats.data?.totalRent || stats.data?.totalRentSite || 576;
        const totalSale = stats.data?.totalSale || stats.data?.totalSaleSite || 740;

        feedStatusText.textContent = `${total.toLocaleString('pt-BR')} imóveis disponíveis (${totalRent} locação • ${totalSale} venda)`;
        if (tabBadgeAll) tabBadgeAll.textContent = total.toLocaleString('pt-BR');
        if (tabBadgeRent) tabBadgeRent.textContent = totalRent.toLocaleString('pt-BR');
        if (tabBadgeSale) tabBadgeSale.textContent = totalSale.toLocaleString('pt-BR');
      } else {
        feedStatusText.textContent = '1.316 imóveis disponíveis';
      }

      if (optionsRes.ok) {
        const json = await optionsRes.json();
        const cities = json.data?.cities || [];
        const neighborhoods = json.data?.neighborhoods || [];
        allNeighborhoods = Array.from(new Set([...OFFICIAL_NEIGHBORHOODS, ...neighborhoods])).sort((a, b) => a.localeCompare(b, 'pt-BR'));

        if (filterCity) {
          filterCity.innerHTML = '<option value="all">Todas as cidades</option>';
          cities.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            filterCity.appendChild(opt);
          });
        }

        renderNeighborhoodOptions();
        renderPropertyTypeOptions();
      }
    } catch (err) {
      console.warn('Backend API fallback ativo:', err.message);
      feedStatusText.textContent = '1.316 imóveis disponíveis';
    }
  }

  // --- Toggle Filtros & Contador ---
  function countActiveFilters() {
    let count = 0;
    if (filterType && filterType.value !== 'all') count++;
    if (filterStatus && filterStatus.value !== 'all' && filterStatus.value !== 'disponivel') count++;
    if (filterUsageType && filterUsageType.value !== 'all') count++;
    count += selectedPropertyTypes.size;
    if (filterCity && filterCity.value !== 'all') count++;
    count += selectedNeighborhoods.size;
    if (filterMinPrice && parsePriceInput(filterMinPrice.value) > 0) count++;
    if (filterMaxPrice && parsePriceInput(filterMaxPrice.value) > 0) count++;
    if (filterMinArea && filterMinArea.value !== '0') count++;
    if (filterBeds && filterBeds.value !== '0') count++;
    if (filterSuites && filterSuites.value !== '0') count++;
    if (filterBathrooms && filterBathrooms.value !== '0') count++;
    if (filterGarage && filterGarage.value !== '0') count++;
    if (filterHasTour && filterHasTour.checked) count++;
    count += selectedFeatures.size;
    if (filterSortBy && filterSortBy.value !== 'relevance') count++;

    if (count > 0) {
      filterCountBadge.textContent = count;
      filterCountBadge.style.display = 'inline-block';
      toggleFiltersBtn.classList.add('active');
    } else {
      filterCountBadge.style.display = 'none';
      toggleFiltersBtn.classList.remove('active');
    }
    return count;
  }

  toggleFiltersBtn.addEventListener('click', () => {
    isFiltersOpen = !isFiltersOpen;
    filtersPanel.style.display = isFiltersOpen ? 'block' : 'none';
  });

  resetFiltersBtn.addEventListener('click', () => {
    if (filterType) filterType.value = 'all';
    if (filterStatus) filterStatus.value = 'disponivel';
    if (filterUsageType) filterUsageType.value = 'all';
    if (filterPropertyType) filterPropertyType.value = 'all';
    if (filterCity) filterCity.value = 'all';

    selectedPropertyTypes.clear();
    renderPropertyTypeTags();
    renderPropertyTypeOptions();
    if (propertyTypeInput) propertyTypeInput.value = '';
    
    selectedNeighborhoods.clear();
    renderNeighborhoodTags();
    renderNeighborhoodOptions();
    if (neighborhoodInput) neighborhoodInput.value = '';

    if (filterMinPrice) filterMinPrice.value = '';
    if (filterMaxPrice) filterMaxPrice.value = '';
    if (filterMinArea) filterMinArea.value = '0';
    if (filterBeds) filterBeds.value = '0';
    if (filterSuites) filterSuites.value = '0';
    if (filterBathrooms) filterBathrooms.value = '0';
    if (filterGarage) filterGarage.value = '0';
    if (filterSortBy) filterSortBy.value = 'relevance';
    if (filterHasTour) filterHasTour.checked = false;

    if (quickStatusTabs) {
      quickStatusTabs.querySelectorAll('.status-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.type === 'all');
      });
    }

    selectedFeatures.clear();
    document.querySelectorAll('.feature-chip.active').forEach(c => c.classList.remove('active'));

    countActiveFilters();
    searchProperties();
  });

  applyFiltersBtn.addEventListener('click', () => {
    searchProperties();
  });

  // Interação com Chips de Comodidades
  if (featuresChipsList) {
    featuresChipsList.addEventListener('click', (e) => {
      const chip = e.target.closest('.feature-chip');
      if (!chip) return;
      const feat = chip.dataset.feature;
      if (!feat) return;

      if (selectedFeatures.has(feat)) {
        selectedFeatures.delete(feat);
        chip.classList.remove('active');
      } else {
        selectedFeatures.add(feat);
        chip.classList.add('active');
      }
      countActiveFilters();
      searchProperties();
    });
  }

  if (filterHasTour) {
    filterHasTour.addEventListener('change', () => {
      countActiveFilters();
      searchProperties();
    });
  }

  [
    filterType, filterStatus, filterUsageType, filterPropertyType, filterCity,
    filterMinArea, filterBeds, filterSuites, filterBathrooms, filterGarage, filterSortBy
  ].filter(Boolean).forEach(el => {
    el.addEventListener('change', () => {
      countActiveFilters();
      searchProperties();
    });
  });

  // --- Tags de Filtros Ativos ---
  function updateActiveFilterTags() {
    if (!activeFilterTags) return;
    activeFilterTags.innerHTML = '';
    const tags = [];
    if (filterType && filterType.value !== 'all') tags.push(filterType.value);
    if (filterStatus && filterStatus.value !== 'all' && filterStatus.value !== 'disponivel') {
      tags.push(`Situação: ${filterStatus.options[filterStatus.selectedIndex]?.text || filterStatus.value}`);
    }
    if (filterUsageType && filterUsageType.value !== 'all') tags.push(`Uso: ${filterUsageType.value}`);
    if (selectedPropertyTypes.size > 0) {
      selectedPropertyTypes.forEach(t => tags.push(`🏢 ${t}`));
    }
    if (filterCity && filterCity.value !== 'all') tags.push(`📍 ${filterCity.value}`);
    if (selectedNeighborhoods.size > 0) {
      selectedNeighborhoods.forEach(n => tags.push(`📍 ${n}`));
    }
    const minVal = parsePriceInput(filterMinPrice ? filterMinPrice.value : '');
    const maxVal = parsePriceInput(filterMaxPrice ? filterMaxPrice.value : '');
    if (minVal > 0 && maxVal > 0) {
      tags.push(`R$ ${minVal.toLocaleString('pt-BR')} até R$ ${maxVal.toLocaleString('pt-BR')}`);
    } else if (minVal > 0) {
      tags.push(`A partir de R$ ${minVal.toLocaleString('pt-BR')}`);
    } else if (maxVal > 0) {
      tags.push(`Até R$ ${maxVal.toLocaleString('pt-BR')}`);
    }
    if (filterMinArea && filterMinArea.value !== '0') tags.push(`📐 ${filterMinArea.value}+ m²`);
    if (filterBeds && filterBeds.value !== '0') tags.push(`🛏️ ${filterBeds.value}+ qts`);
    if (filterSuites && filterSuites.value !== '0') tags.push(`🚿 ${filterSuites.value}+ suíte(s)`);
    if (filterBathrooms && filterBathrooms.value !== '0') tags.push(`🛁 ${filterBathrooms.value}+ banho(s)`);
    if (filterGarage && filterGarage.value !== '0') tags.push(`🚗 ${filterGarage.value}+ vagas`);
    if (filterHasTour && filterHasTour.checked) tags.push(`🎥 Com Tour`);
    selectedFeatures.forEach(f => tags.push(`✨ ${f}`));

    tags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'active-filter-tag';
      span.textContent = tag;
      activeFilterTags.appendChild(span);
    });
  }

  // --- Busca Principal com Filtros e Paginação ---
  async function searchProperties(isLoadMore = false) {
    if (isLoadMore && isLoadingMore) return;

    const rawQuery = searchInput.value.trim();
    countActiveFilters();
    updateActiveFilterTags();

    if (!isLoadMore) {
      currentOffset = 0;
      loadedPropertiesList = [];
      showState('loading');
      loadMoreWrapper.style.display = 'none';
    } else {
      isLoadingMore = true;
      loadMoreBtn.classList.add('loading');
      loadMoreBtn.querySelector('.load-more-text').textContent = 'Carregando mais...';
    }

    // Monta Query Params
    const params = new URLSearchParams();
    if (rawQuery) params.append('q', rawQuery);
    if (filterType && filterType.value !== 'all') params.append('type', filterType.value);
    if (filterStatus && filterStatus.value !== 'all' && filterStatus.value !== 'disponivel') {
      params.append('status', filterStatus.value);
    }
    if (filterUsageType && filterUsageType.value !== 'all') params.append('usageType', filterUsageType.value);
    if (selectedPropertyTypes.size > 0) {
      params.append('propertyType', Array.from(selectedPropertyTypes).join(','));
    }
    if (filterCity && filterCity.value !== 'all') params.append('city', filterCity.value);
    
    if (selectedNeighborhoods.size > 0) {
      params.append('neighborhoods', Array.from(selectedNeighborhoods).join(','));
    }

    const minPriceVal = parsePriceInput(filterMinPrice ? filterMinPrice.value : '');
    const maxPriceVal = parsePriceInput(filterMaxPrice ? filterMaxPrice.value : '');
    if (minPriceVal > 0) params.append('minPrice', minPriceVal);
    if (maxPriceVal > 0) params.append('maxPrice', maxPriceVal);

    if (filterMinArea && filterMinArea.value !== '0') params.append('minArea', filterMinArea.value);
    if (filterBeds && filterBeds.value !== '0') params.append('minBedrooms', filterBeds.value);
    if (filterSuites && filterSuites.value !== '0') params.append('minSuites', filterSuites.value);
    if (filterBathrooms && filterBathrooms.value !== '0') params.append('minBathrooms', filterBathrooms.value);
    if (filterGarage && filterGarage.value !== '0') params.append('minGarage', filterGarage.value);
    if (filterHasTour && filterHasTour.checked) params.append('hasTour', 'true');
    if (selectedFeatures.size > 0) params.append('features', Array.from(selectedFeatures).join(','));
    if (filterSortBy && filterSortBy.value !== 'relevance') params.append('sortBy', filterSortBy.value);
    params.append('offset', currentOffset);
    params.append('limit', PAGE_SIZE);
    clearBtn.style.display = rawQuery ? 'flex' : 'none';

    if (searchAbortController) {
      searchAbortController.abort();
    }
    searchAbortController = new AbortController();

    try {
      const res = await fetch(`${API_BASE}/api/search?${params.toString()}`, {
        signal: searchAbortController.signal
      });
      if (!res.ok) throw new Error('Falha na resposta da API.');

      const data = await res.json();
      const results = data.results || [];
      totalAvailable = data.total || 0;

      if (!isLoadMore) {
        if (results.length === 0) {
          notFoundTitle.textContent = 'Nenhum imóvel encontrado';
          notFoundMsg.textContent = 'Tente ajustar o termo de busca ou remover alguns filtros aplicados.';
          showState('notFound');
          return;
        }

        // Se for apenas 1 resultado retornado da busca inicial
        if (results.length === 1 && totalAvailable === 1) {
          backToGridBtn.style.display = 'inline-flex';
          renderSingleProperty(results[0]);
          showState('single');
          return;
        }

        loadedPropertiesList = results;
        lastSearchResults = loadedPropertiesList;
        renderGrid(results, totalAvailable, false);
        showState('grid');
      } else {
        loadedPropertiesList = loadedPropertiesList.concat(results);
        lastSearchResults = loadedPropertiesList;
        renderGrid(results, totalAvailable, true);
      }

      // Atualiza contador no topo da grade
      resultsCountText.textContent = `Exibindo ${loadedPropertiesList.length} de ${totalAvailable} imóvel${totalAvailable > 1 ? 'is' : ''} encontrado${totalAvailable > 1 ? 's' : ''}`.replace('imóvelis', 'imóveis');

      // Gerencia botão Carregar Mais
      const remaining = totalAvailable - loadedPropertiesList.length;
      if (remaining > 0) {
        loadMoreWrapper.style.display = 'flex';
        loadMoreCount.textContent = `+${Math.min(remaining, PAGE_SIZE)} (${remaining} restantes)`;
        loadMoreBtn.querySelector('.load-more-text').textContent = 'Carregando mais imóveis';
      } else {
        loadMoreWrapper.style.display = 'none';
      }

    } catch (err) {
      console.error('Erro na pesquisa:', err);
      if (!isLoadMore) {
        notFoundTitle.textContent = 'Erro ao realizar a consulta';
        notFoundMsg.textContent = 'Não foi possível carregar os dados no momento. Tente novamente.';
        showState('notFound');
      } else {
        showToast('Não foi possível carregar mais imóveis.');
      }
    } finally {
      if (isLoadMore) {
        isLoadingMore = false;
        loadMoreBtn.classList.remove('loading');
      }
    }
  }

  // --- Renderização da Grade de Resultados (Múltiplos Imóveis) ---
  function renderGrid(properties, total, append = false) {
    if (!append) {
      propertiesGrid.innerHTML = '';
      selectedPropertyIds.clear();
      updateBulkActionsBar();
    }

    properties.forEach(prop => {
      const card = document.createElement('div');
      const isSelected = selectedPropertyIds.has(String(prop.id));
      card.className = `property-mini-card ${isSelected ? 'is-selected' : ''}`;
      card.dataset.id = prop.id;

      const isRental = prop.transactionType.toLowerCase().includes('locação');
      const isCommercial = prop.usageType === 'Comercial';
      const hasTour = Boolean(prop.virtualTourLink);
      const mainPrice = isRental ? (prop.rentalPrice || prop.price) : (prop.price || prop.rentalPrice);
      const priceText = formatMoney(mainPrice) + (isRental ? '/mês' : '');
      const photo = prop.primaryImage || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';
      const cleanType = prop.propertyType.replace('Residential / ', '').replace('Commercial / ', '');

      // Medida única mais confiável (Área Útil > Construída > Lote)
      let areaVal = '';
      if (prop.livingArea > 0) {
        areaVal = `${prop.livingArea} m²`;
      } else if (prop.constructedArea > 0) {
        areaVal = `${prop.constructedArea} m² const.`;
      } else if (prop.lotArea > 0) {
        areaVal = `${prop.lotArea} m² lote`;
      }

      const isSent = sentPropertiesInSession.has(String(prop.id));
      const sentBadge = isSent ? `<span class="badge badge-sent-helena" data-id="${prop.id}" title="Salvo no metadata da sessão de atendimento">📤 Enviado</span>` : '';
      const matchBadge = prop.matchScore ? `<span class="badge badge-match-score">🔥 ${prop.matchScore}% Match</span>` : '';
      let highlightsHtml = '';
      if (Array.isArray(prop.matchHighlights) && prop.matchHighlights.length > 0) {
        highlightsHtml = `
          <div class="mini-card-highlights">
            ${prop.matchHighlights.slice(0, 2).map(h => `<div class="mini-highlight-item">✓ ${h}</div>`).join('')}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="mini-card-thumb">
          <img src="${photo}" alt="${prop.title}" loading="lazy" />
          
          <!-- Checkbox de Seleção Rápida em Lote -->
          <label class="mini-card-select-label" title="Selecionar este imóvel para envio conjunto" onclick="event.stopPropagation();">
            <input type="checkbox" class="mini-card-checkbox" data-id="${prop.id}" ${isSelected ? 'checked' : ''}>
            <span class="mini-card-checkbox-custom">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          </label>

          <div class="mini-card-badges">
            ${sentBadge}
            ${matchBadge}
            <span class="badge ${isRental ? 'badge-rent' : 'badge-sale'}">${prop.transactionType}</span>
            <span class="badge badge-usage ${isCommercial ? 'commercial' : ''}">${prop.usageType}</span>
            <span class="badge badge-category">${cleanType}</span>
            ${hasTour ? '<span class="badge badge-tour">🎥 Tour</span>' : ''}
          </div>
          <a href="?codigo=${prop.id}" target="_blank" rel="noopener noreferrer" class="mini-card-newtab-btn" title="Abrir imóvel em nova aba" onclick="event.stopPropagation();">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>
            </svg>
          </a>
        </div>
        <div class="mini-card-content">
          <div class="mini-card-price-row">
            <span class="mini-card-price">${priceText}</span>
            <span class="mini-card-code-text">#${prop.id}</span>
          </div>
          <h4 class="mini-card-title">${formatTitle(prop.title)}</h4>
          <div class="mini-card-location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>${[prop.location.neighborhood, prop.location.city].filter(Boolean).join(', ') || 'Santo André'}</span>
          </div>
          <div class="mini-card-specs">
            ${areaVal ? `
              <span class="mini-spec-item" title="Área">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 3h18v18H3zM3 9h18M9 21V9"/>
                </svg>
                <span>${areaVal}</span>
              </span>
            ` : ''}
            ${prop.bedrooms > 0 ? `
              <span class="mini-spec-item" title="Dormitórios">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9M10 8v9"/>
                </svg>
                <span>${prop.bedrooms} dorms</span>
              </span>
            ` : ''}
            ${prop.suites > 0 ? `
              <span class="mini-spec-item" title="Suítes">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-2.12 0 1.5 1.5 0 0 0 0 2.12L6.88 8M4 14h16M4 14v6M20 14v6"/>
                </svg>
                <span>${prop.suites} suíte${prop.suites > 1 ? 's' : ''}</span>
              </span>
            ` : ''}
            ${prop.garage > 0 ? `
              <span class="mini-spec-item" title="Vagas">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="8" rx="2"/>
                  <path d="M5 11l2-5h10l2 5M7 15h.01M17 15h.01"/>
                </svg>
                <span>${prop.garage} vagas</span>
              </span>
            ` : ''}
          </div>
          ${highlightsHtml}
          
          <div class="mini-card-actions">
            <!-- Botão 1: Copiar Link -->
            <button type="button" class="btn-card-copy-link" title="Copiar link oficial do imóvel">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span>Copiar Link</span>
            </button>

            <!-- Botão 2: Copiar Texto de Atendimento -->
            <button type="button" class="btn-card-copy-text" title="Copiar informações formatadas para colar no atendimento">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
              <span>Copiar Texto</span>
            </button>

            <!-- Botão 3: Ver Detalhes -->
            <button type="button" class="btn-card-quick-view" title="Abrir ficha completa">Detalhes</button>
          </div>
        </div>
      `;

      // 1. Ação do Botão Copiar Link
      const copyLinkCardBtn = card.querySelector('.btn-card-copy-link');
      if (copyLinkCardBtn) {
        copyLinkCardBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const link = prop.websiteUrl || `${window.location.origin}/?codigo=${prop.id}`;
          await copyToClipboard(link);
          triggerCopiedFeedback(copyLinkCardBtn, '✅ Link Copiado!');
          showToast(`🔗 Link do imóvel #${prop.id} copiado e salvo no atendimento!`);
          recordPropertiesSentToHelena(prop);
        });
      }

      // 2. Ação do Botão Copiar Texto para Atendimento
      const copyTextCardBtn = card.querySelector('.btn-card-copy-text');
      if (copyTextCardBtn) {
        copyTextCardBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const leadNameEl = document.getElementById('leadProfileName');
          const leadName = leadNameEl ? leadNameEl.textContent.trim() : '';
          const msg = formatSinglePropertyChatText(prop, leadName);
          await copyToClipboard(msg);
          triggerCopiedFeedback(copyTextCardBtn, '✅ Texto Copiado!');
          showToast(`📋 Informações do imóvel #${prop.id} copiadas e salvas no atendimento!`);
          recordPropertiesSentToHelena(prop);
        });
      }

      // 3. Ação do Checkbox de Seleção
      const checkbox = card.querySelector('.mini-card-checkbox');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          const id = String(prop.id);
          if (checkbox.checked) {
            selectedPropertyIds.add(id);
            card.classList.add('is-selected');
          } else {
            selectedPropertyIds.delete(id);
            card.classList.remove('is-selected');
          }
          updateBulkActionsBar();
        });
      }

      // 4. Clique Geral no Card (Abre detalhes se não for botão ou checkbox)
      card.addEventListener('click', (e) => {
        if (
          e.target.closest('.mini-card-newtab-btn') || 
          e.target.closest('.btn-card-copy-link') || 
          e.target.closest('.btn-card-copy-text') || 
          e.target.closest('.mini-card-select-label')
        ) return;

        savedScrollPosition = window.scrollY || document.documentElement.scrollTop || 0;
        backToGridBtn.style.display = 'inline-flex';
        renderSingleProperty(prop);
        showState('single');
        window.scrollTo({ top: 0, behavior: 'instant' });
      });

      propertiesGrid.appendChild(card);
    });
  }

  // Evento do Botão Carregar Mais
  loadMoreBtn.addEventListener('click', () => {
    currentOffset += PAGE_SIZE;
    searchProperties(true);
  });

  // Botão Voltar para Resultados (Restaura a Posição de Scroll Exata)
  backToGridBtn.addEventListener('click', () => {
    if (lastSearchResults && lastSearchResults.length > 0) {
      showState('grid');
      window.scrollTo({ top: savedScrollPosition, behavior: 'instant' });
    } else {
      showState('initial');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // --- Renderização da Ficha Completa Única ---
  function renderSingleProperty(prop) {
    currentProperty = prop;
    currentPhotoIndex = 0;

    // Badges & Cabeçalho
    const isRental = prop.transactionType.toLowerCase().includes('locação');
    const isCommercial = prop.usageType === 'Comercial';
    propCode.textContent = `#${prop.id}`;
    propTransType.textContent = prop.transactionType;
    propTransType.className = `badge ${isRental ? 'badge-rent' : 'badge-sale'}`;
    propUsage.textContent = prop.usageType || 'Residencial';
    propUsage.className = `badge badge-usage ${isCommercial ? 'commercial' : ''}`;
    propCategory.textContent = prop.propertyType.replace('Residential / ', '').replace('Commercial / ', '');
    propStatus.textContent = prop.status || 'Disponível';

    propTitle.textContent = prop.title;
    
    const shareData = getPropertyShareData(prop);
    propAddress.textContent = shareData.fullAddress || 'Localização não informada';

    // Link oficial
    viewWebsiteBtn.href = prop.websiteUrl || `https://www.santosemello.com.br/imovel/${prop.id}`;

    // Tour Virtual / Vídeo
    if (prop.virtualTourLink) {
      viewTourBtn.href = prop.virtualTourLink;
      viewTourBtn.style.display = 'inline-flex';
    } else {
      viewTourBtn.style.display = 'none';
    }

    // Galeria de Fotos
    renderGallery(prop.images);

    // Preços
    const mainPriceValue = isRental ? (prop.rentalPrice || prop.price) : (prop.price || prop.rentalPrice);
    priceLabel.textContent = isRental ? 'Valor de Locação' : 'Valor de Venda';
    propPrice.textContent = formatMoney(mainPriceValue);

    // Sub-preços (Condomínio / IPTU)
    condoPrice.textContent = prop.condo > 0 ? `Condomínio: ${formatMoney(prop.condo)}/mês` : 'Condomínio: Isento / Não inf.';
    iptuPrice.textContent = prop.iptu > 0 ? `IPTU: ${formatMoney(prop.iptu)}/mês` : 'IPTU: Isento / Não inf.';

    // Especificações
    specArea.textContent = prop.livingArea > 0 ? `${prop.livingArea} m²` : '--';

    if (prop.lotArea > 0) {
      specLotAreaItem.style.display = 'flex';
      specLotArea.textContent = `${prop.lotArea} m²`;
    } else {
      specLotAreaItem.style.display = 'none';
    }

    if (prop.constructedArea > 0) {
      specConstAreaItem.style.display = 'flex';
      specConstArea.textContent = `${prop.constructedArea} m²`;
    } else {
      specConstAreaItem.style.display = 'none';
    }

    specBeds.textContent = prop.bedrooms > 0 ? (prop.suites > 0 ? `${prop.bedrooms} (${prop.suites} suíte${prop.suites > 1 ? 's' : ''})` : prop.bedrooms) : '0';
    specBaths.textContent = prop.bathrooms > 0 ? prop.bathrooms : '0';
    specGarage.textContent = prop.garage > 0 ? prop.garage : '0';

    // Descrição
    propDesc.textContent = prop.description || 'Nenhuma descrição detalhada fornecida.';
    propDesc.classList.remove('expanded');
    expandDescBtn.querySelector('span').textContent = 'Ler descrição completa';

    // Comodidades
    if (prop.features && prop.features.length > 0) {
      featuresSection.style.display = 'block';
      featuresList.innerHTML = prop.features.map(f => `<span class="feature-tag">${f}</span>`).join('');
    } else {
      featuresSection.style.display = 'none';
    }
  }

  // --- Gerenciador da Galeria de Fotos ---
  function renderGallery(images) {
    if (!images || images.length === 0) {
      images = ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'];
    }

    currentPhotoIndex = 0;
    updatePhotoView(images);

    // Render Miniaturas
    thumbnailsContainer.innerHTML = '';
    images.forEach((url, idx) => {
      const thumb = document.createElement('div');
      thumb.className = `thumbnail-item ${idx === 0 ? 'active' : ''}`;
      thumb.innerHTML = `<img src="${url}" alt="Foto ${idx + 1}" loading="lazy" />`;
      thumb.addEventListener('click', () => {
        currentPhotoIndex = idx;
        updatePhotoView(images);
      });
      thumbnailsContainer.appendChild(thumb);
    });
  }

  function updatePhotoView(images) {
    if (!images || images.length === 0) return;
    const currentUrl = images[currentPhotoIndex] || images[0];
    
    mainImage.src = currentUrl;
    photoCounter.textContent = `${currentPhotoIndex + 1} / ${images.length}`;

    const thumbs = thumbnailsContainer.querySelectorAll('.thumbnail-item');
    thumbs.forEach((thumb, idx) => {
      thumb.classList.toggle('active', idx === currentPhotoIndex);
      if (idx === currentPhotoIndex) {
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }

  prevPhotoBtn.addEventListener('click', () => {
    if (!currentProperty || !currentProperty.images || currentProperty.images.length <= 1) return;
    currentPhotoIndex = (currentPhotoIndex - 1 + currentProperty.images.length) % currentProperty.images.length;
    updatePhotoView(currentProperty.images);
  });

  nextPhotoBtn.addEventListener('click', () => {
    if (!currentProperty || !currentProperty.images || currentProperty.images.length <= 1) return;
    currentPhotoIndex = (currentPhotoIndex + 1) % currentProperty.images.length;
    updatePhotoView(currentProperty.images);
  });

  // Modal em tela cheia
  expandPhotoBtn.addEventListener('click', () => {
    if (!currentProperty || !currentProperty.images) return;
    modalImg.src = currentProperty.images[currentPhotoIndex] || mainImage.src;
    photoModal.classList.add('open');
  });

  modalCloseBtn.addEventListener('click', () => photoModal.classList.remove('open'));
  photoModal.addEventListener('click', (e) => {
    if (e.target === photoModal) photoModal.classList.remove('open');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && photoModal.classList.contains('open')) {
      photoModal.classList.remove('open');
    }
  });

  // --- Ações de Link e Compartilhamento na Ficha Única ---

  // 1. Copiar Link Oficial do Imóvel
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      if (!currentProperty) return;
      const link = currentProperty.websiteUrl || `https://www.santosemello.com.br/imovel/${currentProperty.id}`;
      await copyToClipboard(link);
      triggerCopiedFeedback(copyLinkBtn, '✅ Link Copiado!');
      showToast(`🔗 Link do imóvel #${currentProperty.id} copiado e salvo no atendimento!`);
      recordPropertiesSentToHelena(currentProperty);
    });
  }

  // 2. Copiar Mensagem Pronta de Atendimento
  if (copyChatMsgBtn) {
    copyChatMsgBtn.addEventListener('click', async () => {
      if (!currentProperty) return;
      const leadNameEl = document.getElementById('leadProfileName');
      const leadName = leadNameEl ? leadNameEl.textContent.trim() : '';
      const msg = formatSinglePropertyChatText(currentProperty, leadName);
      await copyToClipboard(msg);
      triggerCopiedFeedback(copyChatMsgBtn, '✅ Mensagem Copiada!');
      showToast(`📋 Apresentação do imóvel #${currentProperty.id} copiada e salva no atendimento!`);
      recordPropertiesSentToHelena(currentProperty);
    });
  }

  // 3. Compartilhar no WhatsApp
  if (shareWhatsAppBtn) {
    shareWhatsAppBtn.addEventListener('click', () => {
      if (!currentProperty) return;

      const leadNameEl = document.getElementById('leadProfileName');
      const leadName = leadNameEl ? leadNameEl.textContent.trim() : '';
      const msg = formatSinglePropertyChatText(currentProperty, leadName);

      recordPropertiesSentToHelena(currentProperty);

      const leadPhone = (leadSimulationState && leadSimulationState.contactPhone) || '';
      const cleanPhone = leadPhone.replace(/\D/g, '');
      const whatsappUrl = cleanPhone 
        ? `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(msg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
      window.open(whatsappUrl, '_blank');
    });
  }

  // 4. Copiar Ficha Técnica Completa em Texto
  if (copySummaryBtn) {
    copySummaryBtn.addEventListener('click', async () => {
      if (!currentProperty) return;

      const p = currentProperty;
      const isRental = p.transactionType.toLowerCase().includes('locação');
      const priceText = formatMoney(isRental ? (p.rentalPrice || p.price) : (p.price || p.rentalPrice));
      const link = p.websiteUrl || `https://www.santosemello.com.br/imovel/${p.id}`;

      let summary = `FICHA DO IMÓVEL #${p.id}\n`;
      summary += `------------------------------\n`;
      summary += `Título: ${p.title}\n`;
      summary += `Finalidade: ${p.transactionType}\n`;
      summary += `Uso: ${p.usageType}\n`;
      summary += `Tipo: ${p.propertyType}\n`;
      summary += `Valor: ${priceText}\n`;
      if (p.condo > 0) summary += `Condomínio: ${formatMoney(p.condo)}/mês\n`;
      if (p.iptu > 0) summary += `IPTU: ${formatMoney(p.iptu)}/mês\n`;
      summary += `Área Útil: ${p.livingArea || '--'} m²\n`;
      if (p.lotArea > 0) summary += `Área do Terreno: ${p.lotArea} m²\n`;
      if (p.constructedArea > 0) summary += `Área Construída: ${p.constructedArea} m²\n`;
      summary += `Quartos: ${p.bedrooms} (Suítes: ${p.suites})\n`;
      summary += `Banheiros: ${p.bathrooms}\n`;
      summary += `Vagas de Garagem: ${p.garage}\n`;
      summary += `Endereço: ${p.location.address || ''}, ${p.location.streetNumber || ''} - ${p.location.neighborhood || ''}, ${p.location.city || 'Santo André'}/${p.location.state || 'SP'}\n`;
      if (p.virtualTourLink) summary += `Tour Virtual / Vídeo: ${p.virtualTourLink}\n`;
      summary += `Link Direto: ${link}\n`;

      await copyToClipboard(summary);
      triggerCopiedFeedback(copySummaryBtn, '✅ Ficha Copiada!');
      showToast('📋 Ficha técnica copiada e salva no atendimento!');
      recordPropertiesSentToHelena(currentProperty);
    });
  }

  // 5. Gerar Ficha de Visita & Proposta (PDF)
  const btnCreateProposalModal = document.getElementById('btnCreateProposalModal');
  if (btnCreateProposalModal) {
    btnCreateProposalModal.addEventListener('click', () => {
      if (!currentProperty) return;
      const params = new URLSearchParams(window.location.search);
      params.set('propertyId', currentProperty.id);
      window.open(`/proposta?${params.toString()}`, '_blank');
    });
  }

  // --- Handlers da Barra de Ações em Lote (Seleção Múltipla no Atendimento) ---
  const btnBulkSaveCard = document.getElementById('btnBulkSaveCard');
  if (btnBulkSaveCard) {
    btnBulkSaveCard.addEventListener('click', async () => {
      const selectedProps = loadedPropertiesList.filter(p => selectedPropertyIds.has(String(p.id)));
      if (selectedProps.length === 0) return;

      btnBulkSaveCard.disabled = true;
      const originalText = btnBulkSaveCard.innerHTML;
      btnBulkSaveCard.innerHTML = '<span>⏳ Salvando no Card...</span>';

      try {
        await recordPropertiesSentToHelena(selectedProps);
        btnBulkSaveCard.innerHTML = '<span>✅ Salvo no Card!</span>';
        showToast(`📌 ${selectedProps.length} imóvel(is) salvo(s) nas notas do Card do Lead com sucesso!`);
      } catch (err) {
        showToast(`⚠️ Erro ao salvar no card: ${err.message}`, '⚠️');
      } finally {
        setTimeout(() => {
          btnBulkSaveCard.disabled = false;
          btnBulkSaveCard.innerHTML = originalText;
        }, 2500);
      }
    });
  }

  const btnBulkCopyText = document.getElementById('btnBulkCopyText');
  if (btnBulkCopyText) {
    btnBulkCopyText.addEventListener('click', async () => {
      const selectedProps = loadedPropertiesList.filter(p => selectedPropertyIds.has(String(p.id)));
      if (selectedProps.length === 0) return;

      const leadNameEl = document.getElementById('leadProfileName');
      const leadName = leadNameEl ? leadNameEl.textContent.trim() : '';
      const compiledMsg = formatBulkPropertiesChatText(selectedProps, leadName);

      await copyToClipboard(compiledMsg);
      triggerCopiedFeedback(btnBulkCopyText, '✅ Apresentação Copiada!');
      showToast(`📋 Apresentação com ${selectedProps.length} opções copiada e salva no atendimento!`);
      recordPropertiesSentToHelena(selectedProps);
    });
  }

  const btnBulkCopyLinks = document.getElementById('btnBulkCopyLinks');
  if (btnBulkCopyLinks) {
    btnBulkCopyLinks.addEventListener('click', async () => {
      const selectedProps = loadedPropertiesList.filter(p => selectedPropertyIds.has(String(p.id)));
      if (selectedProps.length === 0) return;

      const links = selectedProps.map(p => p.websiteUrl || `${window.location.origin}/?codigo=${p.id}`).join('\n');
      await copyToClipboard(links);
      triggerCopiedFeedback(btnBulkCopyLinks, '✅ Links Copiados!');
      showToast(`🔗 ${selectedProps.length} links copiados e salvos no atendimento!`);
      recordPropertiesSentToHelena(selectedProps);
    });
  }

  const btnBulkClear = document.getElementById('btnBulkClear');
  if (btnBulkClear) {
    btnBulkClear.addEventListener('click', () => {
      selectedPropertyIds.clear();
      document.querySelectorAll('.mini-card-checkbox').forEach(cb => { cb.checked = false; });
      document.querySelectorAll('.property-mini-card.is-selected').forEach(c => { c.classList.remove('is-selected'); });
      updateBulkActionsBar();
      showToast('Seleção de imóveis limpa.');
    });
  }

  // Expansão da Descrição
  expandDescBtn.addEventListener('click', () => {
    const isExpanded = propDesc.classList.toggle('expanded');
    expandDescBtn.querySelector('span').textContent = isExpanded ? 'Recolher descrição' : 'Ler descrição completa';
  });

  // --- Eventos de Formulário e Pesquisa ---
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    searchProperties();
  });

  searchInput.addEventListener('input', () => {
    clearBtn.style.display = searchInput.value ? 'flex' : 'none';
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    searchInput.focus();
  });

  // Chips de Códigos Rápidos
  chipsList.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip && chip.dataset.code) {
      searchInput.value = chip.dataset.code;
      searchProperties();
    }
  });

  // --- Controle do Modo Simplificado (Menu Helena CRM) ---
  const toggleSimplifiedModeBtn = document.getElementById('toggleSimplifiedModeBtn');
  const simplifiedBtnText = document.getElementById('simplifiedBtnText');
  const btnToggleProfileDetails = document.getElementById('btnToggleProfileDetails');
  const criteriosConsideradosGrid = document.getElementById('criteriosConsideradosGrid');
  const criteriosArrow = document.getElementById('criteriosArrow');

  function setSimplifiedMode(enable) {
    if (enable) {
      document.body.classList.add('simplified-view', 'helena-embedded');
      document.documentElement.setAttribute('data-theme', 'light');
      if (themeToggle) themeToggle.style.display = 'none';
      if (simplifiedBtnText) simplifiedBtnText.textContent = 'Modo Completo';
    } else {
      document.body.classList.remove('simplified-view', 'helena-embedded');
      if (simplifiedBtnText) simplifiedBtnText.textContent = 'Modo Simplificado';
    }
  }

  if (toggleSimplifiedModeBtn) {
    toggleSimplifiedModeBtn.addEventListener('click', () => {
      const isSimplified = document.body.classList.contains('simplified-view') || document.body.classList.contains('helena-embedded');
      setSimplifiedMode(!isSimplified);
    });
  }

  if (btnToggleProfileDetails && criteriosConsideradosGrid) {
    btnToggleProfileDetails.addEventListener('click', () => {
      const isCollapsed = criteriosConsideradosGrid.classList.toggle('collapsed');
      if (criteriosArrow) {
        criteriosArrow.textContent = isCollapsed ? '▸' : '▾';
      }
    });
  }

  function getFieldIcon(campo) {
    const norm = (campo || '').toLowerCase();
    if (norm.includes('destina') || norm.includes('finalidade')) return '🎯';
    if (norm.includes('tipo')) return '🏠';
    if (norm.includes('bairro') || norm.includes('regiao') || norm.includes('local')) return '📍';
    if (norm.includes('orçamento') || norm.includes('orcamento') || norm.includes('preco') || norm.includes('valor')) return '💰';
    if (norm.includes('morador') || norm.includes('pessoa')) return '👨‍👩‍👧';
    if (norm.includes('pet') || norm.includes('animal')) return '🐾';
    if (norm.includes('particularidade') || norm.includes('comodidade') || norm.includes('diferencial')) return '✨';
    if (norm.includes('motivo') || norm.includes('razao')) return '💡';
    if (norm.includes('tempo') || norm.includes('prazo') || norm.includes('urgencia')) return '⏳';
    if (norm.includes('garantia') || norm.includes('fianca')) return '🛡️';
    if (norm.includes('quarto') || norm.includes('dorm')) return '🛏️';
    if (norm.includes('vaga') || norm.includes('garagem')) return '🚗';
    if (norm.includes('suite')) return '🚿';
    return '📌';
  }

  // --- Simulação e Edição de Filtros do Perfil de Lead (Helena CRM) ---
  let leadSimulationState = {
    contactId: null,
    contactData: null,
    criteria: []
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderLeadCriteriaCards() {
    if (!criteriosConsideradosGrid) return;
    criteriosConsideradosGrid.innerHTML = '';

    // Filtra apenas campos preenchidos e válidos da qualificação
    const validFields = (leadSimulationState.criteria || []).filter(c => {
      const val = String(c.valorOriginal || c.valorAtual || '').trim();
      return val && val !== '-' && val !== '0' && val !== 'null' && val !== 'undefined';
    });

    if (validFields.length === 0) {
      criteriosConsideradosGrid.innerHTML = `
        <div style="font-size: 0.82rem; color: #64748b; padding: 0.5rem 0.2rem; font-style: italic;">
          Nenhum dado específico preenchido na qualificação deste lead.
        </div>
      `;
      return;
    }

    validFields.forEach(crit => {
      const cardEl = document.createElement('div');
      cardEl.className = 'lead-ficha-card';

      const icon = crit.icone || getFieldIcon(crit.campo);
      const displayVal = crit.valorOriginal || crit.valorAtual || '-';

      cardEl.innerHTML = `
        <div class="lead-ficha-card-icon">${icon}</div>
        <div class="lead-ficha-card-content">
          <span class="lead-ficha-card-label">${escapeHtml(crit.campo)}</span>
          <span class="lead-ficha-card-val" title="${escapeHtml(displayVal)}">${escapeHtml(displayVal)}</span>
        </div>
      `;

      criteriosConsideradosGrid.appendChild(cardEl);
    });
  }

  // --- Busca por Perfil de Lead (Helena CRM / Menu Personalizado) ---
  async function searchLeadProperties(contactId) {
    setSimplifiedMode(true);
    showState('loading');
    feedStatusText.textContent = `Consultando ficha do lead #${contactId}...`;

    const leadProfileBanner = document.getElementById('leadProfileBanner');
    const leadProfileName = document.getElementById('leadProfileName');
    const leadProfileContact = document.getElementById('leadProfileContact');
    const leadProfileTags = document.getElementById('leadProfileTags');
    const leadProfileWhatsAppBtn = document.getElementById('leadProfileWhatsAppBtn');
    const leadProfileAnnotation = document.getElementById('leadProfileAnnotation');
    const leadProfileAnnotationText = document.getElementById('leadProfileAnnotationText');

    try {
      const pageParams = new URLSearchParams(window.location.search);
      const tokenInQuery = pageParams.get('token') || pageParams.get('helenaToken') || '';
      const tokenQuery = tokenInQuery ? `&token=${encodeURIComponent(tokenInQuery)}` : '';
      const res = await fetch(`${API_BASE}/api/leads/match?contactId=${encodeURIComponent(contactId)}${tokenQuery}&minScore=60`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao buscar dados do lead.');
      }

      const contact = data.contact || {};
      const contactName = contact.name ? contact.name : `Lead #${contactId}`;
      const contactPhone = contact.phoneNumber || '';
      const leadProf = data.leadProfile || {};

      // 1. Exibe a Ficha do Lead no topo (apenas leitura, campos preenchidos)
      if (leadProfileBanner) {
        leadProfileBanner.style.display = 'block';
        if (leadProfileName) leadProfileName.textContent = contactName;
        if (leadProfileContact) {
          const contactParts = [];
          if (contactPhone) contactParts.push(`📱 ${contactPhone}`);
          if (contact.email) contactParts.push(`✉️ ${contact.email}`);
          leadProfileContact.textContent = contactParts.join(' • ') || 'Sem telefone/e-mail informado';
        }
        if (leadProfileTags) {
          const tagsList = contact.tags || contact.tagNames || [];
          leadProfileTags.innerHTML = tagsList.map(t => `<span class="lead-tag-pill">${escapeHtml(t)}</span>`).join('');
        }
        if (leadProfileWhatsAppBtn) {
          if (contactPhone) {
            const cleanPhone = contactPhone.replace(/\D/g, '');
            const firstName = contactName.split(' ')[0] || '';
            const msg = `Olá${firstName ? `, ${firstName}` : ''}! Sou da Santos & Mello. Vi seu interesse em imóveis e separei ótimas opções para você. Como posso te ajudar?`;
            leadProfileWhatsAppBtn.href = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(msg)}`;
            leadProfileWhatsAppBtn.style.display = 'inline-flex';
          } else {
            leadProfileWhatsAppBtn.style.display = 'none';
          }
        }
        if (leadProfileAnnotation && leadProfileAnnotationText) {
          if (contact.annotation) {
            leadProfileAnnotationText.textContent = contact.annotation;
            leadProfileAnnotation.style.display = 'flex';
          } else {
            leadProfileAnnotation.style.display = 'none';
          }
        }
      }

      // 2. Preenche a Ficha do Lead com todos os critérios considerados preenchidos
      leadSimulationState.contactId = contactId;
      leadSimulationState.contactData = contact;
      leadSimulationState.criteria = (data.criteriosConsiderados || []).map(c => ({
        campo: c.campo,
        campoOriginal: c.campoOriginal || c.campo,
        icone: c.icone || getFieldIcon(c.campo),
        valorOriginal: c.valorOriginal || '',
        valorAtual: c.valorEfetivo || c.valorOriginal || ''
      }));

      renderLeadCriteriaCards();

      // 3. Preenche a interface de filtros do "Catálogo & Busca" de acordo com os 5 campos autorizados
      // (a) Destinação: Residencial ou Comercial (e finalidade: Locação ou Venda)
      if (filterUsageType) {
        const usoLower = (leadProf.uso || '').toLowerCase();
        if (usoLower.includes('comerc')) filterUsageType.value = 'Comercial';
        else if (usoLower.includes('resid')) filterUsageType.value = 'Residencial';
        else filterUsageType.value = 'all';
      }

      if (filterType) {
        const finLower = (leadProf.finalidade || '').toLowerCase();
        if (finLower.includes('loca') || finLower.includes('alug')) {
          filterType.value = 'Locação';
          if (tabRent) {
            document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
            tabRent.classList.add('active');
          }
        } else if (finLower.includes('venda')) {
          filterType.value = 'Venda';
          if (tabSale) {
            document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
            tabSale.classList.add('active');
          }
        } else {
          filterType.value = 'all';
        }
      }

      // (b) Bairros (Separados por vírgula, sem espaço)
      selectedNeighborhoods.clear();
      const rawBairros = leadProf.regiao && leadProf.regiao !== 'Qualquer' ? leadProf.regiao : '';
      if (rawBairros) {
        const bList = rawBairros.split(',').map(b => b.trim()).filter(Boolean);
        bList.forEach(b => selectedNeighborhoods.add(b));
      }
      renderNeighborhoodTags();

      // (c) Tipo do Imóvel (Múltipla Seleção oficial: cada valor separado por vírgula marca automaticamente)
      selectedPropertyTypes.clear();
      const rawTipo = leadProf.tipo && leadProf.tipo !== 'Qualquer' ? String(leadProf.tipo).trim() : '';
      if (rawTipo) {
        const tList = rawTipo.split(',').map(t => t.trim()).filter(Boolean);
        tList.forEach(t => {
          const tNorm = normalizeStr(t);
          const matched = OFFICIAL_PROPERTY_TYPES.find(opt => normalizeStr(opt) === tNorm) ||
                          OFFICIAL_PROPERTY_TYPES.find(opt => normalizeStr(opt).includes(tNorm) || tNorm.includes(normalizeStr(opt)));
          if (matched) {
            selectedPropertyTypes.add(matched);
          } else {
            selectedPropertyTypes.add(t);
          }
        });
      }
      renderPropertyTypeTags();
      renderPropertyTypeOptions();

      // (d) Orçamento (Teto máximo em números inteiros)
      if (filterMaxPrice) {
        if (leadProf.orcamentoMax && leadProf.orcamentoMax > 0) {
          filterMaxPrice.value = Math.floor(leadProf.orcamentoMax).toString();
        } else {
          filterMaxPrice.value = '';
        }
      }

      // (e) N° Quartos (Mínimo de quartos exigido)
      if (filterBeds) {
        if (leadProf.quartosMin && leadProf.quartosMin > 0) {
          filterBeds.value = String(leadProf.quartosMin);
        } else {
          filterBeds.value = '0';
        }
      }

      // Limpa os campos não listados para garantir que não interfiram no filtro
      if (filterMinPrice) filterMinPrice.value = '';
      if (filterMinArea) filterMinArea.value = '0';
      if (filterSuites) filterSuites.value = '0';
      if (filterBathrooms) filterBathrooms.value = '0';
      if (filterGarage) filterGarage.value = '0';
      selectedFeatures.clear();
      if (featuresChipsList) {
        featuresChipsList.querySelectorAll('.feature-chip').forEach(c => c.classList.remove('active'));
      }
      if (filterHasTour) filterHasTour.checked = false;

      // Abre o painel de filtros para que o corretor veja e possa ajustar livremente
      isFiltersOpen = true;
      if (filtersPanel) filtersPanel.style.display = 'block';
      countActiveFilters();
      updateActiveFilterTags();

      // 4. Executa a busca padrão com os filtros pré-preenchidos do lead
      await searchProperties();

      // Consulta session metadata para identificar imóveis já enviados previamente nesta conversa
      (async () => {
        try {
          const metaRes = await fetch(`${API_BASE}/api/leads/session-metadata?contactId=${encodeURIComponent(contactId)}${tokenQuery}`);
          if (metaRes.ok) {
            const metaData = await metaRes.json();
            if (metaData.sessionId) window.__helenaSessionId = metaData.sessionId;
            if (Array.isArray(metaData.imoveisEnviados) && metaData.imoveisEnviados.length > 0) {
              metaData.imoveisEnviados.forEach(item => {
                if (item && item.id) sentPropertiesInSession.add(String(item.id));
              });
              updateSentBadgesInUI();
            }
          }
        } catch (mErr) {
          console.warn('Consulta de session metadata em segundo plano:', mErr.message);
        }
      })();

      if (resultsCountText) {
        resultsCountText.textContent = `🎯 ${total} imóveis recomendados para ${contactName}`;
      }
    } catch (err) {
      console.error('Erro ao buscar perfil do lead:', err);
      feedStatusText.textContent = `⚠️ Não foi possível sincronizar com o lead #${contactId}`;
      showToast('Aviso: Não foi possível obter dados do lead. Exibindo busca padrão.');
      searchProperties();
    }
  }

  // --- Inicialização ao Carregar a Página ---
  initTheme();

  const urlParams = new URLSearchParams(window.location.search);
  const paramCode = urlParams.get('codigo') || urlParams.get('c') || (urlParams.get('id') && !urlParams.get('id').includes('-') ? urlParams.get('id') : null);
  const paramContactId = urlParams.get('contactId') || urlParams.get('contact_id') || (urlParams.get('id') && urlParams.get('id').includes('-') ? urlParams.get('id') : null);
  const paramMode = urlParams.get('mode') || urlParams.get('view') || '';
  const isSimplifiedReq = paramMode === 'simple' || paramMode === 'simplificado' || urlParams.get('simplified') === 'true' || urlParams.get('embedded') === 'true';

  if (isSimplifiedReq) {
    setSimplifiedMode(true);
  }

  if (paramContactId) {
    loadFilterOptions();
    searchLeadProperties(paramContactId);
  } else if (paramCode) {
    searchInput.value = paramCode;
    searchProperties();
    loadFilterOptions();
  } else {
    // Executa busca e carregamento de opções em paralelo para abertura instantânea
    searchProperties();
    loadFilterOptions();
  }

})();
