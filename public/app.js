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

  // Filtros
  const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
  const filtersPanel = document.getElementById('filtersPanel');
  const filterCountBadge = document.getElementById('filterCountBadge');
  const filterType = document.getElementById('filterType');
  const filterPropertyType = document.getElementById('filterPropertyType');
  const filterNeighborhood = document.getElementById('filterNeighborhood');
  const filterMaxPrice = document.getElementById('filterMaxPrice');
  const filterBeds = document.getElementById('filterBeds');
  const filterGarage = document.getElementById('filterGarage');
  const filterSortBy = document.getElementById('filterSortBy');
  const applyFiltersBtn = document.getElementById('applyFiltersBtn');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

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
  const specBeds = document.getElementById('specBeds');
  const specBaths = document.getElementById('specBaths');
  const specGarage = document.getElementById('specGarage');

  // Ações
  const copyLinkBtn = document.getElementById('copyLinkBtn');
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

  // Estado de Paginação
  const PAGE_SIZE = 40;
  let currentOffset = 0;
  let totalAvailable = 0;
  let loadedPropertiesList = [];
  let isLoadingMore = false;

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
    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('app-theme', next);
  });

  // --- Toast Notification ---
  let toastTimer = null;
  function showToast(msg) {
    toastMessage.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
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
        const total = stats.data?.total || 1174;
        feedStatusText.textContent = `${total.toLocaleString('pt-BR')} imóveis disponíveis`;
      } else {
        feedStatusText.textContent = '1.174 imóveis disponíveis';
      }

      if (optionsRes.ok) {
        const json = await optionsRes.json();
        const neighborhoods = json.data?.neighborhoods || [];

        filterNeighborhood.innerHTML = '<option value="all">Todos os bairros</option>';
        neighborhoods.forEach(n => {
          const opt = document.createElement('option');
          opt.value = n;
          opt.textContent = n;
          filterNeighborhood.appendChild(opt);
        });
      }
    } catch (err) {
      console.warn('Backend API fallback ativo:', err.message);
      feedStatusText.textContent = '1.174 imóveis disponíveis';
    }
  }

  // --- Toggle Filtros & Contador ---
  function countActiveFilters() {
    let count = 0;
    if (filterType.value !== 'all') count++;
    if (filterPropertyType.value !== 'all') count++;
    if (filterNeighborhood.value !== 'all') count++;
    if (filterMaxPrice.value !== 'all') count++;
    if (filterBeds.value !== '0') count++;
    if (filterGarage.value !== '0') count++;
    if (filterSortBy.value !== 'relevance') count++;

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
    filterType.value = 'all';
    filterPropertyType.value = 'all';
    filterNeighborhood.value = 'all';
    filterMaxPrice.value = 'all';
    filterBeds.value = '0';
    filterGarage.value = '0';
    filterSortBy.value = 'relevance';
    countActiveFilters();
    searchProperties();
  });

  applyFiltersBtn.addEventListener('click', () => {
    searchProperties();
  });

  [filterType, filterPropertyType, filterNeighborhood, filterMaxPrice, filterBeds, filterGarage, filterSortBy].forEach(el => {
    el.addEventListener('change', countActiveFilters);
  });

  // --- Tags de Filtros Ativos ---
  function updateActiveFilterTags() {
    if (!activeFilterTags) return;
    activeFilterTags.innerHTML = '';
    const tags = [];
    if (filterType.value !== 'all') tags.push(filterType.value);
    if (filterPropertyType.value !== 'all') {
      const optText = filterPropertyType.options[filterPropertyType.selectedIndex]?.text || filterPropertyType.value;
      tags.push(optText);
    }
    if (filterNeighborhood.value !== 'all') tags.push(filterNeighborhood.value);
    if (filterMaxPrice.value !== 'all') {
      const optText = filterMaxPrice.options[filterMaxPrice.selectedIndex]?.text || filterMaxPrice.value;
      tags.push(optText);
    }
    if (filterBeds.value !== '0') tags.push(`${filterBeds.value}+ quartos`);
    if (filterGarage.value !== '0') tags.push(`${filterGarage.value}+ vagas`);

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
    if (filterType.value !== 'all') params.append('type', filterType.value);
    if (filterPropertyType.value !== 'all') params.append('propertyType', filterPropertyType.value);
    if (filterNeighborhood.value !== 'all') params.append('neighborhood', filterNeighborhood.value);
    if (filterMaxPrice.value !== 'all') params.append('maxPrice', filterMaxPrice.value);
    if (filterBeds.value !== '0') params.append('minBedrooms', filterBeds.value);
    if (filterGarage.value !== '0') params.append('minGarage', filterGarage.value);
    if (filterSortBy.value !== 'relevance') params.append('sortBy', filterSortBy.value);
    params.append('offset', currentOffset);
    params.append('limit', PAGE_SIZE);

    clearBtn.style.display = rawQuery ? 'flex' : 'none';

    try {
      const res = await fetch(`${API_BASE}/api/search?${params.toString()}`);
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
      resultsCountText.textContent = `Exibindo ${loadedPropertiesList.length} de ${totalAvailable} imóvel${totalAvailable > 1 ? 'is' : ''} encontrado${totalAvailable > 1 ? 's' : ''}`;

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
    }

    properties.forEach(prop => {
      const card = document.createElement('div');
      card.className = 'property-mini-card';

      const isRental = prop.transactionType.toLowerCase().includes('locação');
      const mainPrice = isRental ? (prop.rentalPrice || prop.price) : (prop.price || prop.rentalPrice);
      const priceText = formatMoney(mainPrice) + (isRental ? '/mês' : '');
      const photo = prop.primaryImage || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';
      const cleanType = prop.propertyType.replace('Residential / ', '').replace('Commercial / ', '');

      card.innerHTML = `
        <div class="mini-card-thumb">
          <img src="${photo}" alt="${prop.title}" loading="lazy" />
          <div class="mini-card-badges">
            <span class="badge ${isRental ? 'badge-rent' : 'badge-sale'}">${prop.transactionType}</span>
            <span class="badge badge-category">${cleanType}</span>
          </div>
          <span class="mini-card-code">#${prop.id}</span>
        </div>
        <div class="mini-card-content">
          <div class="mini-card-price-row">
            <span class="mini-card-price">${priceText}</span>
          </div>
          <h4 class="mini-card-title">${prop.title}</h4>
          <div class="mini-card-location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>${prop.location.neighborhood || 'Santo André'}</span>
          </div>
          <div class="mini-card-specs">
            ${prop.livingArea > 0 ? `<span class="mini-spec-item">📐 ${prop.livingArea}m²</span>` : ''}
            ${prop.bedrooms > 0 ? `<span class="mini-spec-item">🛏️ ${prop.bedrooms} dorms</span>` : ''}
            ${prop.garage > 0 ? `<span class="mini-spec-item">🚗 ${prop.garage} vagas</span>` : ''}
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        backToGridBtn.style.display = 'inline-flex';
        renderSingleProperty(prop);
        showState('single');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      propertiesGrid.appendChild(card);
    });
  }

  // Evento do Botão Carregar Mais
  loadMoreBtn.addEventListener('click', () => {
    currentOffset += PAGE_SIZE;
    searchProperties(true);
  });

  // Botão Voltar para Resultados
  backToGridBtn.addEventListener('click', () => {
    if (lastSearchResults && lastSearchResults.length > 1) {
      showState('grid');
    } else {
      showState('initial');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // --- Renderização da Ficha Completa Única ---
  function renderSingleProperty(prop) {
    currentProperty = prop;
    currentPhotoIndex = 0;

    // Badges & Cabeçalho
    const isRental = prop.transactionType.toLowerCase().includes('locação');
    propCode.textContent = `#${prop.id}`;
    propTransType.textContent = prop.transactionType;
    propTransType.className = `badge ${isRental ? 'badge-rent' : 'badge-sale'}`;
    propCategory.textContent = prop.propertyType.replace('Residential / ', '').replace('Commercial / ', '');
    propStatus.textContent = prop.status || 'Disponível';

    propTitle.textContent = prop.title;
    
    const addressParts = [
      prop.location.neighborhood,
      prop.location.city ? `${prop.location.city} - ${prop.location.state}` : ''
    ].filter(Boolean);
    propAddress.textContent = addressParts.join(' • ') || 'Localização não informada';

    // Link oficial
    viewWebsiteBtn.href = prop.websiteUrl || `https://www.santosemello.com.br/imovel/${prop.id}`;

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

  // --- Ações de Link e Compartilhamento ---

  // 1. Copiar Link do Imóvel
  copyLinkBtn.addEventListener('click', async () => {
    if (!currentProperty) return;
    const link = currentProperty.websiteUrl || `https://www.santosemello.com.br/imovel/${currentProperty.id}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('🔗 Link do imóvel copiado para a área de transferência!');
    } catch (e) {
      showToast(`Link: ${link}`);
    }
  });

  // 2. Compartilhar no WhatsApp
  shareWhatsAppBtn.addEventListener('click', () => {
    if (!currentProperty) return;

    const p = currentProperty;
    const isRental = p.transactionType.toLowerCase().includes('locação');
    const priceText = formatMoney(isRental ? (p.rentalPrice || p.price) : (p.price || p.rentalPrice));
    const link = p.websiteUrl || `https://www.santosemello.com.br/imovel/${p.id}`;

    let msg = `🏠 *${p.title}*\n`;
    msg += `🔖 *Código:* #${p.id}\n`;
    msg += `📍 *Localização:* ${p.location.neighborhood || 'Santo André'} - ${p.location.city || 'SP'}\n`;
    msg += `💰 *Valor (${p.transactionType}):* ${priceText}\n`;
    
    if (p.livingArea > 0 || p.bedrooms > 0 || p.garage > 0) {
      msg += `📐 *Detalhes:* ${p.livingArea ? p.livingArea + 'm²' : ''} ${p.bedrooms ? '• ' + p.bedrooms + ' dorms' : ''} ${p.garage ? '• ' + p.garage + ' vagas' : ''}\n`;
    }
    
    msg += `\n🔗 *Veja fotos e ficha completa aqui:* \n${link}`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  });

  // 3. Copiar Ficha Técnica Completa em Texto
  copySummaryBtn.addEventListener('click', async () => {
    if (!currentProperty) return;

    const p = currentProperty;
    const isRental = p.transactionType.toLowerCase().includes('locação');
    const priceText = formatMoney(isRental ? (p.rentalPrice || p.price) : (p.price || p.rentalPrice));
    const link = p.websiteUrl || `https://www.santosemello.com.br/imovel/${p.id}`;

    let summary = `FICHA DO IMÓVEL #${p.id}\n`;
    summary += `------------------------------\n`;
    summary += `Título: ${p.title}\n`;
    summary += `Tipo: ${p.propertyType} (${p.transactionType})\n`;
    summary += `Valor: ${priceText}\n`;
    if (p.condo > 0) summary += `Condomínio: ${formatMoney(p.condo)}/mês\n`;
    if (p.iptu > 0) summary += `IPTU: ${formatMoney(p.iptu)}/mês\n`;
    summary += `Área Útil: ${p.livingArea || '--'} m²\n`;
    summary += `Quartos: ${p.bedrooms} (Suítes: ${p.suites})\n`;
    summary += `Banheiros: ${p.bathrooms}\n`;
    summary += `Vagas de Garagem: ${p.garage}\n`;
    summary += `Endereço: ${p.location.address || ''}, ${p.location.streetNumber || ''} - ${p.location.neighborhood || ''}, ${p.location.city || 'Santo André'}/${p.location.state || 'SP'}\n`;
    summary += `Link Direto: ${link}\n`;

    try {
      await navigator.clipboard.writeText(summary);
      showToast('📋 Ficha técnica copiada!');
    } catch (e) {
      showToast('Erro ao copiar ficha.');
    }
  });

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

  // --- Inicialização ao Carregar a Página ---
  initTheme();
  loadFilterOptions().then(() => {
    // Parâmetro ?codigo=8797 na URL
    const urlParams = new URLSearchParams(window.location.search);
    const paramCode = urlParams.get('codigo') || urlParams.get('c') || urlParams.get('id');
    if (paramCode) {
      searchInput.value = paramCode;
      searchProperties();
    } else {
      // Carrega catálogo inicial automaticamente
      searchProperties();
    }
  });

})();
