const express = require('express');
const cors = require('cors');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const { buildPropertyWebsiteUrl } = require('./lib/property-website-url');
const { 
  fetchHelenaContact, 
  extractLeadCriteriaFromContact,
  fetchHelenaContactSessions,
  fetchHelenaSession,
  updateHelenaSessionMetadata,
  recordSentPropertiesInHelenaSession,
  recordScheduledVisitsInHelenaSession
} = require('./lib/helena-crm');
const { crmStore, KANBAN_STAGES } = require('./lib/crm-store');
const PORT = process.env.PORT || 3333;
const XML_URL = 'https://universal-ftp2.s3.us-west-2.amazonaws.com/vr/santosemello-vivareal-8835-ambos.xml';

const app = express();

app.use(cors());
app.use(express.json());

// Permite incorporação segura no Helena CRM (flw.chat / wts.chat) em Menus Personalizados e Iframes
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Interface Dedicada para Agendamento de Visitas dos Imóveis Enviados (Helena CRM Menu Personalizado)
app.get(['/visitas', '/agendar-visitas', '/visitas.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'visitas.html'));
});

// Estado em memória dos imóveis
let listingsMap = new Map();
let listingsList = [];
let metadata = {
  provider: 'Santos & Mello',
  lastSync: null,
  total: 0,
  logo: 'https://cdn.imoview.com.br/santosemello/logo-1771518225.png',
  phone: '1144692121'
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  cdataPropName: '__cdata',
  isArray: (name) => ['Listing', 'Item', 'Feature'].includes(name)
});

function cleanText(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && val.__cdata !== undefined) return String(val.__cdata).trim();
  if (typeof val === 'object' && val['#text'] !== undefined) return String(val['#text']).trim();
  if (typeof val === 'object') return '';
  return String(val).trim();
}

const FEATURE_TRANSLATIONS = {
  'Pool': 'Piscina',
  'BBQ': 'Churrasqueira',
  'Elevator': 'Elevador',
  'Pets Allowed': 'Aceita Pets',
  'Balcony': 'Varanda / Sacada',
  'Balcony/Terrace': 'Varanda / Terraço',
  'Furnished': 'Mobiliado',
  'Gym': 'Academia',
  'Party Room': 'Salão de Festas',
  'Playground': 'Playground',
  'Veranda': 'Varanda',
  'Sports Court': 'Quadra Poliesportiva',
  'Security Guard on Duty': 'Segurança 24h',
  'Doorman': 'Portaria',
  'Backyard': 'Quintal',
  'Fenced Yard': 'Quintal',
  'Gourmet Area': 'Espaço Gourmet',
  'Home Office': 'Home Office',
  'Game room': 'Salão de Jogos',
  'Heating': 'Aquecimento',
  'Air Conditioning': 'Ar Condicionado',
  'Cooling': 'Ar Condicionado',
  'Kitchen': 'Cozinha',
  'Laundry': 'Lavanderia',
  'Intercom': 'Interfone',
  "Maid's Quarters": 'Dep. Empregada',
  'Alarm System': 'Alarme',
  'Closet': 'Closet',
  'Fireplace': 'Lareira',
  'Parking Garage': 'Garagem Coberta',
  'Cable Television': 'TV a Cabo',
  'Garden': 'Jardim',
  'Sauna': 'Sauna'
};

function normalizeListing(raw) {
  const details = raw.Details || {};
  const location = raw.Location || {};
  const media = raw.Media || {};
  const mediaItems = Array.isArray(media.Item) ? media.Item : (media.Item ? [media.Item] : []);

  // Extração das fotos
  const images = mediaItems
    .map(item => cleanText(item))
    .filter(url => url && url.startsWith('http'));

  const listingId = cleanText(raw.ListingID);
  const transactionTypeRaw = cleanText(raw.TransactionType);
  let transactionType = 'Venda';
  if (transactionTypeRaw.toLowerCase().includes('rent')) {
    transactionType = 'Locação';
  } else if (transactionTypeRaw.toLowerCase().includes('sale/rent') || transactionTypeRaw.toLowerCase().includes('both')) {
    transactionType = 'Venda / Locação';
  }

  const rawFeatures = details.Features ? (Array.isArray(details.Features.Feature) ? details.Features.Feature : [details.Features.Feature]) : [];
  const features = Array.from(new Set(
    rawFeatures
      .map(f => {
        const txt = cleanText(f);
        return FEATURE_TRANSLATIONS[txt] || txt;
      })
      .filter(Boolean)
  ));

  const usageTypeRaw = cleanText(details.UsageType);
  let usageType = 'Residencial';
  if (usageTypeRaw.toLowerCase().includes('commercial') || usageTypeRaw.toLowerCase().includes('comercial')) {
    usageType = 'Comercial';
  }

  const livingArea = parseFloat(cleanText(details.LivingArea)) || 0;
  const constructedArea = parseFloat(cleanText(details.ConstructedArea)) || 0;
  const lotArea = parseFloat(cleanText(details.LotArea)) || 0;
  const title = cleanText(raw.Title) || `Imóvel #${listingId}`;

  return {
    id: listingId,
    title,
    transactionType,
    propertyType: cleanText(details.PropertyType) || 'Imóvel',
    usageType,
    price: parseFloat(cleanText(details.ListPrice)) || 0,
    rentalPrice: parseFloat(cleanText(details.RentalPrice)) || 0,
    iptu: parseFloat(cleanText(details.Iptu)) || 0,
    condo: parseFloat(cleanText(details.PropertyAdministrationFee)) || 0,
    livingArea: livingArea || constructedArea,
    constructedArea,
    lotArea,
    bedrooms: parseInt(cleanText(details.Bedrooms)) || 0,
    bathrooms: parseInt(cleanText(details.Bathrooms)) || 0,
    suites: parseInt(cleanText(details.Suites)) || 0,
    garage: parseInt(cleanText(details.Garage)) || 0,
    description: cleanText(details.Description),
    features,
    location: {
      address: cleanText(location.Address),
      streetNumber: cleanText(location.StreetNumber),
      complement: cleanText(location.Complement),
      neighborhood: cleanText(location.Neighborhood),
      city: cleanText(location.City) || 'Santo André',
      state: cleanText(location.State) || 'SP',
      postalCode: cleanText(location.PostalCode),
      latitude: cleanText(location.Latitude),
      longitude: cleanText(location.Longitude)
    },
    images,
    primaryImage: images[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
    websiteUrl: buildPropertyWebsiteUrl(title, listingId),
    virtualTourLink: cleanText(raw.VirtualTourLink),
    status: cleanText(raw.Status?.PropertyStatus) || 'Disponível'
  };
}

async function syncFeed() {
  console.log('🔄 Sincronizando feed XML...');
  try {
    const response = await fetch(XML_URL);
    if (!response.ok) {
      throw new Error(`Falha HTTP ao carregar XML: ${response.status} ${response.statusText}`);
    }
    const xmlText = await response.text();
    const parsed = xmlParser.parse(xmlText);

    const feed = parsed.ListingDataFeed;
    if (!feed || !feed.Listings || !feed.Listings.Listing) {
      throw new Error('Estrutura do XML inválida ou sem listagens.');
    }

    const header = feed.Header || {};
    metadata.provider = cleanText(header.Provider) || metadata.provider;
    metadata.logo = cleanText(header.Logo) || metadata.logo;
    metadata.phone = cleanText(header.Telephone) || metadata.phone;

    const rawList = Array.isArray(feed.Listings.Listing) ? feed.Listings.Listing : [feed.Listings.Listing];
    
    const newMap = new Map();
    const newList = [];

    for (const raw of rawList) {
      const normalized = normalizeListing(raw);
      if (normalized.id) {
        newMap.set(normalized.id.toLowerCase(), normalized);
        newList.push(normalized);
      }
    }

    let countRent = 0;
    let countSale = 0;
    for (const item of newList) {
      const t = (item.transactionType || '').toLowerCase();
      if (t.includes('locação') || t.includes('locacao') || t.includes('rent')) countRent++;
      if (t.includes('venda') || t.includes('sale')) countSale++;
    }

    listingsMap = newMap;
    listingsList = newList;
    metadata.lastSync = new Date().toISOString();
    metadata.total = listingsList.length;
    metadata.totalRent = countRent;
    metadata.totalSale = countSale;

    console.log(`✅ Sincronização concluída! ${metadata.total} imóveis indexados (${countRent} locação, ${countSale} venda).`);
    return { success: true, count: metadata.total, totalRent: countRent, totalSale: countSale, lastSync: metadata.lastSync };
  } catch (err) {
    console.error('❌ Erro na sincronização:', err.message);
    throw err;
  }
}

// Middleware para garantir que o feed esteja carregado (essencial para Vercel Serverless)
let syncPromise = null;
async function ensureDataLoaded(req, res, next) {
  if (listingsList.length > 0) return next();
  try {
    if (!syncPromise) {
      syncPromise = syncFeed().finally(() => { syncPromise = null; });
    }
    await syncPromise;
    next();
  } catch (err) {
    console.error('Erro ao carregar dados sob demanda:', err.message);
    res.status(500).json({ error: 'Falha ao carregar o catálogo de imóveis.' });
  }
}

app.use('/api', ensureDataLoaded);

// Helpers para enriquecimento de dados e mesclagem com CRM Store
function enrichProperty(item) {
  if (!item) return null;
  const override = crmStore.getPropertyOverride(item.id) || {};
  if (override.deleted) return null;

  return {
    ...item,
    kanbanStage: override.kanbanStage || item.kanbanStage || 'disponivel',
    status: override.status || item.status || 'Vago / Disponível',
    keyTag: override.keyTag || item.keyTag || `CLAV-${item.id}`
  };
}

function getAllPropertiesMerged() {
  const customList = crmStore.getCustomProperties().map(p => enrichProperty(p)).filter(Boolean);
  const customIds = new Set(customList.map(p => String(p.id).toLowerCase()));

  const merged = [...customList];
  for (const item of listingsList) {
    if (!customIds.has(String(item.id).toLowerCase())) {
      const enriched = enrichProperty(item);
      if (enriched) merged.push(enriched);
    }
  }
  return merged;
}

/**
 * Enriquece um objeto de imóvel com os dados oficiais do catálogo (foto real, título e URL com slug)
 * Filtra dados mock ou de teste (ex: TEST-101)
 */
function enrichPropertyWithCatalog(prop) {
  if (!prop) return null;
  const pId = String(prop.id || prop.codigo || '').trim();
  if (!pId) return null;

  // Descarta estritamente IDs de teste ou mocks
  if (pId.toUpperCase().startsWith('TEST') || pId.toUpperCase() === 'MOCK') {
    return null;
  }

  // Busca o imóvel real no mapa de listagens ou no catálogo mesclado
  let catalogItem = listingsMap.get(pId);
  if (!catalogItem) {
    const pIdLower = pId.toLowerCase();
    catalogItem = getAllPropertiesMerged().find(item => String(item.id).toLowerCase() === pIdLower);
  }

  if (catalogItem) {
    const isRental = (catalogItem.transactionType || '').toLowerCase().includes('locação');
    const mainPrice = isRental ? (catalogItem.rentalPrice || catalogItem.price) : (catalogItem.price || catalogItem.rentalPrice);
    const priceFormatted = mainPrice > 0 
      ? `R$ ${mainPrice.toLocaleString('pt-BR')}${isRental ? '/mês' : ''}` 
      : (prop.valorFormatado || 'Sob Consulta');
    
    // Constrói a URL oficial e funcional com o slug do título
    const realWebsiteUrl = buildPropertyWebsiteUrl(catalogItem.title, catalogItem.id);
    const photo = catalogItem.primaryImage || (catalogItem.images && catalogItem.images[0]) || prop.primaryImage || prop.foto || '';

    return {
      ...prop,
      id: catalogItem.id,
      codigo: catalogItem.id,
      titulo: catalogItem.title,
      title: catalogItem.title,
      tipo: catalogItem.propertyType,
      propertyType: catalogItem.propertyType,
      finalidade: catalogItem.transactionType,
      transactionType: catalogItem.transactionType,
      bairro: catalogItem.location?.neighborhood || prop.bairro || 'Santo André',
      cidade: catalogItem.location?.city || prop.cidade || 'Santo André',
      valor: mainPrice || prop.valor || 0,
      valorFormatado: priceFormatted,
      primaryImage: photo,
      foto: photo,
      images: catalogItem.images || [],
      url: realWebsiteUrl,
      websiteUrl: realWebsiteUrl,
      visitaAgendada: prop.visitaAgendada || false,
      dataVisita: prop.dataVisita || null,
      horarioVisita: prop.horarioVisita || null,
      obsVisita: prop.obsVisita || ''
    };
  }

  // Fallback caso não seja encontrado no catálogo atual mas possua título ou ID numérico válido
  const fallbackTitle = prop.titulo || prop.title || `Imóvel #${pId}`;
  const realWebsiteUrl = buildPropertyWebsiteUrl(fallbackTitle, pId);
  return {
    ...prop,
    id: pId,
    codigo: pId,
    titulo: fallbackTitle,
    title: fallbackTitle,
    url: realWebsiteUrl,
    websiteUrl: realWebsiteUrl,
    primaryImage: prop.primaryImage || prop.foto || '',
    foto: prop.primaryImage || prop.foto || ''
  };
}

// Rotas da API
app.get('/api/imovel/:id', (req, res) => {
  const code = (req.params.id || '').trim().toLowerCase();

  // Verifica primeiro em customProperties
  const custom = crmStore.getCustomProperties().find(p => String(p.id).toLowerCase() === code);
  if (custom) {
    const enriched = enrichProperty(custom);
    if (enriched) return res.json({ success: true, data: enriched });
  }

  const imovel = listingsMap.get(code);
  if (!imovel) {
    return res.status(404).json({ error: 'Imóvel não encontrado com o código fornecido.' });
  }

  const enriched = enrichProperty(imovel);
  if (!enriched) {
    return res.status(404).json({ error: 'Imóvel inativo ou excluído.' });
  }

  res.json({ success: true, data: enriched });
});

function normalizeString(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

app.get('/api/filter-options', (req, res) => {
  const neighborhoodsSet = new Set();
  const propertyTypesSet = new Set();
  const citiesSet = new Set();

  for (const item of listingsList) {
    if (item.location.city) {
      citiesSet.add(item.location.city.trim());
    }
    if (item.location.neighborhood) {
      neighborhoodsSet.add(item.location.neighborhood.trim());
    }
    if (item.propertyType) {
      const cleanType = item.propertyType.replace('Residential / ', '').replace('Commercial / ', '').trim();
      if (cleanType) propertyTypesSet.add(cleanType);
    }
  }

  // Santo André em primeiro, depois as demais cidades em ordem alfabética
  const cities = Array.from(citiesSet).sort((a, b) => {
    if (a.includes('Santo André')) return -1;
    if (b.includes('Santo André')) return 1;
    return a.localeCompare(b, 'pt-BR');
  });

  const neighborhoods = Array.from(neighborhoodsSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const propertyTypes = Array.from(propertyTypesSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const popularFeatures = [
    { id: 'piscina', label: 'Piscina', icon: '🏊' },
    { id: 'churrasqueira', label: 'Churrasqueira', icon: '🍖' },
    { id: 'elevador', label: 'Elevador', icon: '🛗' },
    { id: 'varanda', label: 'Varanda / Sacada', icon: '🌅' },
    { id: 'mobiliado', label: 'Mobiliado', icon: '🛋️' },
    { id: 'academia', label: 'Academia', icon: '🏋️' },
    { id: 'festa', label: 'Salão de Festas', icon: '🎉' },
    { id: 'playground', label: 'Playground', icon: '🛝' },
    { id: 'quadra', label: 'Quadra Esportiva', icon: '⚽' },
    { id: 'quintal', label: 'Quintal', icon: '🌳' },
    { id: 'gourmet', label: 'Espaço Gourmet', icon: '🍳' }
  ];

  res.json({
    success: true,
    data: {
      cities,
      neighborhoods,
      propertyTypes,
      transactionTypes: ['Venda', 'Locação'],
      usageTypes: ['Residencial', 'Comercial'],
      popularFeatures
    }
  });
});

app.get('/api/search', (req, res) => {
  const rawQuery = (req.query.q || '').trim();
  const transactionType = (req.query.type || '').trim();
  const statusParam = (req.query.status || req.query.situacao || '').trim();
  const usageType = (req.query.usageType || '').trim();
  const propertyType = (req.query.propertyType || '').trim();
  const city = (req.query.city || '').trim();
  
  const rawNeighborhoods = req.query.neighborhoods || req.query.neighborhood || '';
  let selectedNeighborhoods = [];
  if (Array.isArray(rawNeighborhoods)) {
    selectedNeighborhoods = rawNeighborhoods.map(n => normalizeString(n)).filter(n => n && n !== 'all');
  } else if (typeof rawNeighborhoods === 'string' && rawNeighborhoods.trim()) {
    selectedNeighborhoods = rawNeighborhoods.split(',').map(n => normalizeString(n)).filter(n => n && n !== 'all');
  }

  const minPrice = parseFloat(req.query.minPrice) || 0;
  const maxPrice = parseFloat(req.query.maxPrice) || Infinity;
  const minBedrooms = parseInt(req.query.minBedrooms) || 0;
  const minSuites = parseInt(req.query.minSuites) || 0;
  const minBathrooms = parseInt(req.query.minBathrooms) || 0;
  const minGarage = parseInt(req.query.minGarage) || 0;
  const minArea = parseFloat(req.query.minArea) || 0;
  const maxArea = parseFloat(req.query.maxArea) || Infinity;
  const hasTour = req.query.hasTour === 'true' || req.query.hasTour === '1';
  const featuresQuery = (req.query.features || '').trim();
  const sortBy = req.query.sortBy || 'relevance';
  const limit = Math.min(parseInt(req.query.limit) || 40, 100);
  const offset = parseInt(req.query.offset) || 0;

  // Limpa o termo de busca (remove # se presente)
  const cleanQueryStr = rawQuery.replace(/#/g, '').trim();

  // Se o termo de busca for exatamente um código conhecido e nenhum outro filtro complexo foi aplicado, retorna direto
  if (cleanQueryStr && (!transactionType || transactionType === 'all') && (!statusParam || statusParam === 'all' || statusParam === 'disponivel') && (!usageType || usageType === 'all') && (!propertyType || propertyType === 'all') && (!city || city === 'all') && selectedNeighborhoods.length === 0 && minPrice === 0 && maxPrice === Infinity && minBedrooms === 0 && minSuites === 0 && minBathrooms === 0 && minGarage === 0 && minArea === 0 && !hasTour && !featuresQuery) {
    const cleanId = cleanQueryStr.toLowerCase();
    const exact = listingsMap.get(cleanId);
    if (exact) {
      return res.json({ success: true, results: [exact], total: 1, isExactId: true });
    }
  }

  const queryNorm = normalizeString(cleanQueryStr);
  const cityNorm = normalizeString(city);
  const propertyTypeNorm = normalizeString(propertyType);
  const requiredFeatures = featuresQuery ? featuresQuery.split(',').map(f => f.trim()).filter(Boolean) : [];

  let filtered = listingsList.filter(item => {
    // Filtro por termo livre (ID, título, bairro, cidade, endereço ou descrição)
    if (queryNorm) {
      const idNorm = normalizeString(item.id);
      const titleNorm = normalizeString(item.title);
      const itemNeighNorm = normalizeString(item.location.neighborhood);
      const itemPropNorm = normalizeString(item.propertyType);
      const itemCityNorm = normalizeString(item.location.city);
      const itemAddressNorm = normalizeString(item.location.address);
      const itemDescNorm = normalizeString(item.description);

      const matchesText = idNorm === queryNorm ||
        idNorm.includes(queryNorm) ||
        titleNorm.includes(queryNorm) ||
        itemNeighNorm.includes(queryNorm) ||
        itemPropNorm.includes(queryNorm) ||
        itemCityNorm.includes(queryNorm) ||
        itemAddressNorm.includes(queryNorm) ||
        itemDescNorm.includes(queryNorm);

      if (!matchesText) return false;
    }

    // Filtro por Tipo de Transação (Venda / Locação)
    if (transactionType && transactionType !== 'all') {
      const transNorm = normalizeString(transactionType);
      const itemTransNorm = normalizeString(item.transactionType);
      if (!itemTransNorm.includes(transNorm)) {
        return false;
      }
    }

    // Filtro por Uso do Imóvel (Residencial / Comercial)
    if (usageType && usageType !== 'all') {
      const usageNorm = normalizeString(usageType);
      const itemUsageNorm = normalizeString(item.usageType);
      if (!itemUsageNorm.includes(usageNorm)) {
        return false;
      }
    }

    // Filtro por Cidade
    if (cityNorm && city !== 'all') {
      const itemCityNorm = normalizeString(item.location.city);
      if (!itemCityNorm.includes(cityNorm)) {
        return false;
      }
    }

    // Filtro por Tipo de Imóvel com suporte a sinônimos
    if (propertyTypeNorm && propertyType !== 'all') {
      const itemTypeNorm = normalizeString(item.propertyType);
      let matchesType = itemTypeNorm.includes(propertyTypeNorm);

      if (!matchesType) {
        if (propertyTypeNorm === 'apartment' || propertyTypeNorm === 'apartamento') {
          matchesType = itemTypeNorm.includes('apartment') || itemTypeNorm.includes('apartamento') || itemTypeNorm.includes('flat') || itemTypeNorm.includes('studio');
        } else if (propertyTypeNorm === 'home' || propertyTypeNorm === 'casa') {
          matchesType = itemTypeNorm.includes('home') || itemTypeNorm.includes('casa') || itemTypeNorm.includes('sobrado');
        } else if (propertyTypeNorm === 'commercial' || propertyTypeNorm === 'comercial') {
          matchesType = itemTypeNorm.includes('commercial') || itemTypeNorm.includes('comercial') || itemTypeNorm.includes('business') || itemTypeNorm.includes('office') || itemTypeNorm.includes('edificio') || itemTypeNorm.includes('floor');
        } else if (propertyTypeNorm === 'land lot' || propertyTypeNorm === 'terreno') {
          matchesType = itemTypeNorm.includes('land') || itemTypeNorm.includes('terreno') || itemTypeNorm.includes('lote');
        } else if (propertyTypeNorm === 'penthouse' || propertyTypeNorm === 'cobertura') {
          matchesType = itemTypeNorm.includes('penthouse') || itemTypeNorm.includes('cobertura');
        } else if (propertyTypeNorm === 'industrial' || propertyTypeNorm === 'galpao') {
          matchesType = itemTypeNorm.includes('industrial') || itemTypeNorm.includes('galpao');
        }
      }

      if (!matchesType) return false;
    }

    // Filtro por Bairro (suporte a múltiplos bairros)
    if (selectedNeighborhoods.length > 0) {
      const itemNeighNorm = normalizeString(item.location.neighborhood);
      const matchesAnyNeigh = selectedNeighborhoods.some(nNorm => itemNeighNorm.includes(nNorm));
      if (!matchesAnyNeigh) {
        return false;
      }
    }

    // Filtro por Situação / Status
    if (statusParam && statusParam !== 'all') {
      const statusNorm = normalizeString(statusParam);
      if (statusNorm.includes('locacao') || statusNorm.includes('rent')) {
        const itemTransNorm = normalizeString(item.transactionType);
        if (!itemTransNorm.includes('locacao') && !itemTransNorm.includes('rent')) return false;
      } else if (statusNorm.includes('venda') || statusNorm.includes('sale')) {
        const itemTransNorm = normalizeString(item.transactionType);
        if (!itemTransNorm.includes('venda') && !itemTransNorm.includes('sale')) return false;
      }
    }

    // Filtro por Preço
    let priceToCheck = 0;
    const filterTransNorm = normalizeString(transactionType);
    if (filterTransNorm.includes('locacao') || filterTransNorm.includes('rent')) {
      priceToCheck = item.rentalPrice || item.price || 0;
    } else if (filterTransNorm.includes('venda') || filterTransNorm.includes('sale')) {
      priceToCheck = item.price || item.rentalPrice || 0;
    } else {
      priceToCheck = item.transactionType.toLowerCase().includes('locação') ? (item.rentalPrice || item.price) : (item.price || item.rentalPrice);
    }

    if (minPrice > 0) {
      if (priceToCheck < minPrice) return false;
    }

    if (maxPrice < Infinity) {
      if (priceToCheck === 0 || priceToCheck > maxPrice) return false;
    }

    // Filtro por Quartos
    if (minBedrooms > 0 && item.bedrooms < minBedrooms) return false;

    // Filtro por Suítes
    if (minSuites > 0 && item.suites < minSuites) return false;

    // Filtro por Banheiros
    if (minBathrooms > 0 && item.bathrooms < minBathrooms) return false;

    // Filtro por Vagas
    if (minGarage > 0 && item.garage < minGarage) return false;

    // Filtro por Área Útil
    if (minArea > 0 && item.livingArea < minArea) return false;
    if (maxArea < Infinity && item.livingArea > maxArea) return false;

    // Filtro por Tour Virtual
    if (hasTour && !item.virtualTourLink) return false;

    // Filtro por Comodidades (Features)
    if (requiredFeatures.length > 0) {
      const itemFeaturesText = normalizeString((item.features || []).join(' '));
      const matchesAllFeatures = requiredFeatures.every(f => {
        const fNorm = normalizeString(f);
        return itemFeaturesText.includes(fNorm);
      });
      if (!matchesAllFeatures) return false;
    }

    return true;
  });

  // Ordenação
  if (sortBy === 'price_asc') {
    filtered.sort((a, b) => {
      const pA = a.price || a.rentalPrice || 0;
      const pB = b.price || b.rentalPrice || 0;
      return pA - pB;
    });
  } else if (sortBy === 'price_desc') {
    filtered.sort((a, b) => {
      const pA = a.price || a.rentalPrice || 0;
      const pB = b.price || b.rentalPrice || 0;
      return pB - pA;
    });
  } else if (sortBy === 'area_desc') {
    filtered.sort((a, b) => (b.livingArea || 0) - (a.livingArea || 0));
  } else if (sortBy === 'area_asc') {
    filtered.sort((a, b) => (a.livingArea || 0) - (b.livingArea || 0));
  } else if (sortBy === 'beds_desc') {
    filtered.sort((a, b) => (b.bedrooms || 0) - (a.bedrooms || 0));
  } else if (sortBy === 'suites_desc') {
    filtered.sort((a, b) => (b.suites || 0) - (a.suites || 0));
  }

  const paginated = filtered.slice(offset, offset + limit);

  res.json({
    success: true,
    results: paginated,
    total: filtered.length,
    offset,
    limit
  });
});

// --- ROTA DE BUSCA CONTEXTUAL POR PERFIL DE LEAD (GET) ---
// Utilizada pelo corretor no CRM e pelo Agente de IA no n8n
app.get(['/api/leads/match', '/api/imoveis/lead-search'], async (req, res) => {
  // Se for informado o ID do contato (ex: dashboard enviando contactId), consulta no Helena CRM
  const contactId = (req.query.contactId || req.query.contact_id || req.query.id || req.query.leadId || req.query.contatoId || '').trim();
  let contactData = null;
  let contactWarning = null;
  let criteriaFromContact = {};
  let criteriosConsiderados = [];

  if (contactId) {
    try {
      const customToken = req.headers['x-helena-token'] || req.headers['x-crm-token'] || req.query.token;
      contactData = await fetchHelenaContact(contactId, customToken);
      const extracted = extractLeadCriteriaFromContact(contactData);
      criteriaFromContact = extracted.criteria || {};
      criteriosConsiderados = extracted.criteriosConsiderados || [];
    } catch (err) {
      console.warn(`⚠️ Aviso ao consultar contato #${contactId} no Helena CRM:`, err.message);
      contactWarning = `Aviso Helena CRM: ${err.message}`;
      // Não aborta com 502: segue como fallback para permitir que o Menu Personalizado valide a URL com HTTP 200
    }
  }

  // Helper para resolver parâmetros com suporte a desativação (ignore*) e edição explícita
  function isIgnored(flag) {
    const v = req.query[flag];
    return v === 'true' || v === '1' || v === true;
  }

  // 1. Tipo do Imóvel
  let rawPropertyType = '';
  if (!isIgnored('ignoreTipo') && !isIgnored('ignorePropertyType')) {
    if (req.query.tipo !== undefined) rawPropertyType = req.query.tipo;
    else if (req.query.propertyType !== undefined) rawPropertyType = req.query.propertyType;
    else rawPropertyType = criteriaFromContact.tipo || '';
  }
  rawPropertyType = rawPropertyType.trim();

  // 2. Destinação / Finalidade
  let rawTransactionType = '';
  if (!isIgnored('ignoreFinalidade') && !isIgnored('ignoreDestinacao') && !isIgnored('ignoreTransacao')) {
    if (req.query.finalidade !== undefined) rawTransactionType = req.query.finalidade;
    else if (req.query.destinacao !== undefined) rawTransactionType = req.query.destinacao;
    else if (req.query.transacao !== undefined) rawTransactionType = req.query.transacao;
    else if (req.query.transactionType !== undefined) rawTransactionType = req.query.transactionType;
    else if (req.query.type !== undefined) rawTransactionType = req.query.type;
    else rawTransactionType = criteriaFromContact.finalidade || '';
  }
  rawTransactionType = rawTransactionType.trim();

  // 3. Uso
  let rawUsageType = '';
  if (!isIgnored('ignoreUso')) {
    if (req.query.uso !== undefined) rawUsageType = req.query.uso;
    else if (req.query.usageType !== undefined) rawUsageType = req.query.usageType;
    else rawUsageType = criteriaFromContact.uso || '';
  }
  rawUsageType = rawUsageType.trim();

  // 4. Orçamento Máximo
  let rawMaxPrice = 0;
  if (!isIgnored('ignoreOrcamento') && !isIgnored('ignorePreco') && !isIgnored('ignoreValor')) {
    if (req.query.orcamento !== undefined && req.query.orcamento !== '') rawMaxPrice = parseFloat(req.query.orcamento) || 0;
    else if (req.query.orcamentoMax !== undefined && req.query.orcamentoMax !== '') rawMaxPrice = parseFloat(req.query.orcamentoMax) || 0;
    else if (req.query.maxPrice !== undefined && req.query.maxPrice !== '') rawMaxPrice = parseFloat(req.query.maxPrice) || 0;
    else if (req.query.precoMax !== undefined && req.query.precoMax !== '') rawMaxPrice = parseFloat(req.query.precoMax) || 0;
    else rawMaxPrice = parseFloat(criteriaFromContact.orcamentoMax) || 0;
  }

  // 5. Orçamento Mínimo
  let rawMinPrice = 0;
  if (!isIgnored('ignoreOrcamentoMin')) {
    if (req.query.orcamentoMin !== undefined && req.query.orcamentoMin !== '') rawMinPrice = parseFloat(req.query.orcamentoMin) || 0;
    else if (req.query.minPrice !== undefined && req.query.minPrice !== '') rawMinPrice = parseFloat(req.query.minPrice) || 0;
    else rawMinPrice = parseFloat(criteriaFromContact.orcamentoMin) || 0;
  }

  // 6. Quartos / Moradores
  let rawBedrooms = 0;
  if (!isIgnored('ignoreQuartos') && !isIgnored('ignoreMoradores') && !isIgnored('ignoreDormitorios')) {
    if (req.query.quartos !== undefined && req.query.quartos !== '') rawBedrooms = parseInt(req.query.quartos, 10) || 0;
    else if (req.query.minBedrooms !== undefined && req.query.minBedrooms !== '') rawBedrooms = parseInt(req.query.minBedrooms, 10) || 0;
    else if (req.query.dormitorios !== undefined && req.query.dormitorios !== '') rawBedrooms = parseInt(req.query.dormitorios, 10) || 0;
    else if (req.query.moradores !== undefined && req.query.moradores !== '') {
      const m = parseInt(req.query.moradores, 10) || 0;
      rawBedrooms = m >= 4 ? 3 : (m === 3 ? 2 : (m >= 1 ? 1 : 0));
    } else {
      rawBedrooms = parseInt(criteriaFromContact.quartos, 10) || 0;
    }
  }

  // 7. Suítes / Banheiros / Vagas
  let rawSuites = isIgnored('ignoreSuites') ? 0 : (req.query.suites !== undefined && req.query.suites !== '' ? parseInt(req.query.suites, 10) || 0 : (criteriaFromContact.suites || 0));
  let rawBathrooms = isIgnored('ignoreBanheiros') ? 0 : (req.query.banheiros !== undefined && req.query.banheiros !== '' ? parseInt(req.query.banheiros, 10) || 0 : (criteriaFromContact.banheiros || 0));
  let rawGarage = (isIgnored('ignoreVagas') || isIgnored('ignoreGaragem')) ? 0 : (req.query.vagas !== undefined && req.query.vagas !== '' ? parseInt(req.query.vagas, 10) || 0 : (criteriaFromContact.vagas || 0));

  // 8. Bairros / Região
  let rawNeighborhoods = '';
  if (!isIgnored('ignoreBairros') && !isIgnored('ignoreRegiao')) {
    if (req.query.regiao !== undefined) rawNeighborhoods = req.query.regiao;
    else if (req.query.bairro !== undefined) rawNeighborhoods = req.query.bairro;
    else if (req.query.neighborhood !== undefined) rawNeighborhoods = req.query.neighborhood;
    else if (req.query.bairros !== undefined) rawNeighborhoods = req.query.bairros;
    else rawNeighborhoods = criteriaFromContact.regiao || '';
  }
  rawNeighborhoods = rawNeighborhoods.trim();

  // 9. Cidade
  let rawCity = '';
  if (!isIgnored('ignoreCidade')) {
    if (req.query.cidade !== undefined) rawCity = req.query.cidade;
    else if (req.query.city !== undefined) rawCity = req.query.city;
    else rawCity = criteriaFromContact.cidade || '';
  }
  rawCity = rawCity.trim();

  // 10. Características / Pet / Particularidades
  let rawFeatures = '';
  if (!isIgnored('ignoreCaracteristicas') && !isIgnored('ignoreComodidades') && !isIgnored('ignoreParticularidades')) {
    if (req.query.caracteristicas !== undefined) rawFeatures = req.query.caracteristicas;
    else if (req.query.features !== undefined) rawFeatures = req.query.features;
    else if (req.query.comodidades !== undefined) rawFeatures = req.query.comodidades;
    else rawFeatures = criteriaFromContact.caracteristicas || '';
  }
  if (isIgnored('ignorePet') && rawFeatures) {
    rawFeatures = rawFeatures.split(',').map(f => f.trim()).filter(f => !f.toLowerCase().includes('pet')).join(', ');
  }
  if (req.query.pet !== undefined) {
    const pLow = String(req.query.pet).toLowerCase();
    if (pLow.includes('sim') || pLow === 'true' || pLow === '1') {
      if (!rawFeatures.toLowerCase().includes('pet')) {
        rawFeatures = rawFeatures ? `${rawFeatures}, Aceita Pets` : 'Aceita Pets';
      }
    } else if (pLow.includes('nao') || pLow === 'false' || pLow === '0') {
      rawFeatures = rawFeatures.split(',').map(f => f.trim()).filter(f => !f.toLowerCase().includes('pet')).join(', ');
    }
  }

  // 11. Contexto / Motivo / Tempo / Garantia
  let rawContext = '';
  if (!isIgnored('ignoreContexto')) {
    if (req.query.contexto !== undefined) rawContext = req.query.contexto;
    else if (req.query.q !== undefined) rawContext = req.query.q;
    else if (req.query.perfil !== undefined) rawContext = req.query.perfil;
    else if (req.query.observacoes !== undefined) rawContext = req.query.observacoes;
    else rawContext = criteriaFromContact.contexto || '';
  }

  // Limiar mínimo de afinidade: padrão 60% (requisito de negócio: mostrar imóveis com matching >= 60%)
  const minScoreThreshold = req.query.minScore !== undefined ? Math.max(0, parseInt(req.query.minScore, 10) || 0) : 60;
  const onlyAvailable = req.query.somenteDisponiveis !== 'false' && req.query.onlyAvailable !== 'false';
  const format = (req.query.formato || req.query.format || 'full').toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  // Normalização de filtros
  const propTypeNorm = normalizeString(rawPropertyType);
  const transTypeNorm = normalizeString(rawTransactionType);
  const usageTypeNorm = normalizeString(rawUsageType);
  const cityNorm = normalizeString(rawCity);

  const targetNeighborhoods = rawNeighborhoods
    ? rawNeighborhoods.split(',').map(n => normalizeString(n)).filter(n => n && n !== 'all')
    : [];

  const targetFeatures = rawFeatures
    ? rawFeatures.split(',').map(f => normalizeString(f)).filter(Boolean)
    : [];

  // Extração de palavras-chave do contexto do lead (remove stopwords comuns)
  const stopWords = new Set([
    'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
    'com', 'sem', 'para', 'pra', 'por', 'que', 'um', 'uma', 'uns', 'umas',
    'o', 'a', 'os', 'as', 'e', 'ou', 'se', 'ja', 'bem', 'muito', 'cliente',
    'lead', 'busca', 'procura', 'quer', 'deseja', 'precisa', 'gostaria'
  ]);

  const contextKeywords = rawContext
    ? normalizeString(rawContext)
        .split(/[\s,.;:!?/\\()\-]+/)
        .filter(w => w.length >= 3 && !stopWords.has(w))
    : [];

  // Obter catálogo unificado (XML + Overrides e Imóveis cadastrados no CRM)
  const allProperties = getAllPropertiesMerged();

  const matchedItems = [];

  for (const item of allProperties) {
    // 1. Filtro de Disponibilidade (somente imóveis disponíveis / não concluídos)
    const stage = item.kanbanStage || 'disponivel';
    if (onlyAvailable) {
      if (stage === 'concluido' || stage === 'excluido') continue;
      if (item.status && (item.status.toLowerCase().includes('alugado') || item.status.toLowerCase().includes('vendido') || item.status.toLowerCase().includes('inativo'))) {
        continue;
      }
    }

    // 2. Filtro de Finalidade (Locação / Venda)
    const itemTransNorm = normalizeString(item.transactionType);
    let isRent = itemTransNorm.includes('locacao') || itemTransNorm.includes('rent');
    let isSale = itemTransNorm.includes('venda') || itemTransNorm.includes('sale');

    if (transTypeNorm && transTypeNorm !== 'all' && transTypeNorm !== 'ambos') {
      if (transTypeNorm.includes('locacao') || transTypeNorm.includes('aluguel') || transTypeNorm.includes('rent')) {
        if (!isRent) continue;
      } else if (transTypeNorm.includes('venda') || transTypeNorm.includes('compra') || transTypeNorm.includes('sale')) {
        if (!isSale) continue;
      }
    }

    // 3. Filtro de Uso (Residencial / Comercial)
    if (usageTypeNorm && usageTypeNorm !== 'all') {
      const itemUsageNorm = normalizeString(item.usageType);
      if (!itemUsageNorm.includes(usageTypeNorm)) continue;
    }

    // 4. Filtro por Tipo de Imóvel com sinônimos imobiliários
    if (propTypeNorm && propTypeNorm !== 'all') {
      const itemTypeNorm = normalizeString(item.propertyType);
      let matchType = itemTypeNorm.includes(propTypeNorm);

      if (!matchType) {
        if (propTypeNorm.includes('apto') || propTypeNorm.includes('apartamento') || propTypeNorm.includes('apartment')) {
          matchType = itemTypeNorm.includes('apartment') || itemTypeNorm.includes('apartamento') || itemTypeNorm.includes('flat') || itemTypeNorm.includes('studio') || itemTypeNorm.includes('cobertura') || itemTypeNorm.includes('penthouse');
        } else if (propTypeNorm.includes('casa') || propTypeNorm.includes('home')) {
          matchType = itemTypeNorm.includes('home') || itemTypeNorm.includes('casa') || itemTypeNorm.includes('sobrado');
        } else if (propTypeNorm.includes('sobrado')) {
          matchType = itemTypeNorm.includes('sobrado') || itemTypeNorm.includes('casa');
        } else if (propTypeNorm.includes('cobertura') || propTypeNorm.includes('penthouse')) {
          matchType = itemTypeNorm.includes('penthouse') || itemTypeNorm.includes('cobertura');
        } else if (propTypeNorm.includes('comercial') || propTypeNorm.includes('sala') || propTypeNorm.includes('office')) {
          matchType = itemTypeNorm.includes('commercial') || itemTypeNorm.includes('comercial') || itemTypeNorm.includes('office') || itemTypeNorm.includes('business') || itemTypeNorm.includes('sala') || itemTypeNorm.includes('edificio');
        } else if (propTypeNorm.includes('terreno') || propTypeNorm.includes('lote') || propTypeNorm.includes('land')) {
          matchType = itemTypeNorm.includes('land') || itemTypeNorm.includes('terreno') || itemTypeNorm.includes('lote');
        } else if (propTypeNorm.includes('galpao') || propTypeNorm.includes('industrial') || propTypeNorm.includes('deposito')) {
          matchType = itemTypeNorm.includes('industrial') || itemTypeNorm.includes('galpao') || itemTypeNorm.includes('deposito');
        }
      }

      if (!matchType) continue;
    }

    // 5. Filtro de Orçamento
    let priceToCheck = 0;
    if (transTypeNorm.includes('locacao') || transTypeNorm.includes('aluguel') || transTypeNorm.includes('rent')) {
      priceToCheck = item.rentalPrice || item.price || 0;
    } else if (transTypeNorm.includes('venda') || transTypeNorm.includes('compra') || transTypeNorm.includes('sale')) {
      priceToCheck = item.price || item.rentalPrice || 0;
    } else {
      priceToCheck = isRent ? (item.rentalPrice || item.price || 0) : (item.price || item.rentalPrice || 0);
    }

    if (rawMinPrice > 0 && priceToCheck > 0 && priceToCheck < rawMinPrice) {
      continue;
    }

    if (rawMaxPrice > 0 && priceToCheck > 0) {
      if (priceToCheck > rawMaxPrice) {
        continue;
      }
    }

    // 6. Filtros Estruturais Mínimos
    if (rawBedrooms > 0 && (item.bedrooms || 0) < rawBedrooms) continue;
    if (rawSuites > 0 && (item.suites || 0) < rawSuites) continue;
    if (rawBathrooms > 0 && (item.bathrooms || 0) < rawBathrooms) continue;
    if (rawGarage > 0 && (item.garage || 0) < rawGarage) continue;

    // 7. Filtro de Cidade
    if (cityNorm && cityNorm !== 'all') {
      const itemCityNorm = normalizeString(item.location?.city);
      if (!itemCityNorm.includes(cityNorm)) continue;
    }

    // 8. Filtro de Bairro (se especificado, deve conferir com pelo menos um da lista)
    const itemNeighNorm = normalizeString(item.location?.neighborhood);
    const itemAddressNorm = normalizeString(item.location?.address);
    let matchedNeighborhood = null;
    if (targetNeighborhoods.length > 0) {
      const matched = targetNeighborhoods.some(n => {
        if (itemNeighNorm.includes(n) || itemAddressNorm.includes(n)) {
          matchedNeighborhood = item.location?.neighborhood || n;
          return true;
        }
        return false;
      });
      if (!matched) continue;
    }

    // --- CÁLCULO DO SCORE DE COMPATIBILIDADE & HIGHLIGHTS ---
    let matchScore = 50; // Base por atender todos os requisitos rígidos
    const matchHighlights = [];

    // Highlight e bônus de preço
    if (rawMaxPrice > 0 && priceToCheck > 0) {
      const formattedPrice = priceToCheck.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const formattedMax = rawMaxPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const savingsPercent = Math.round(((rawMaxPrice - priceToCheck) / rawMaxPrice) * 100);

      if (savingsPercent >= 10) {
        matchScore += 15;
        matchHighlights.push(`Excelente custo-benefício (${savingsPercent}% abaixo do orçamento máximo: ${formattedPrice} vs ${formattedMax})`);
      } else {
        matchScore += 10;
        matchHighlights.push(`Dentro do orçamento planejado (${formattedPrice} de teto ${formattedMax})`);
      }
    }

    // Highlight e bônus de localização
    if (matchedNeighborhood) {
      matchScore += 15;
      matchHighlights.push(`Localizado no bairro de interesse: ${matchedNeighborhood}`);
    } else if (item.location?.neighborhood) {
      matchHighlights.push(`Bairro: ${item.location.neighborhood}`);
    }

    // Highlight e bônus de quartos/suítes/vagas adicionais
    if (rawBedrooms > 0) {
      if (item.bedrooms > rawBedrooms) {
        matchScore += 5;
        matchHighlights.push(`${item.bedrooms} dormitórios (${item.bedrooms - rawBedrooms} a mais que o solicitado)`);
      } else {
        matchHighlights.push(`${item.bedrooms} dormitórios`);
      }
    }
    if (item.suites > 0) {
      matchScore += Math.min(item.suites * 3, 6);
      matchHighlights.push(`${item.suites} suíte(s)`);
    }
    if (item.garage > 0) {
      matchScore += Math.min(item.garage * 3, 6);
      matchHighlights.push(`${item.garage} vaga(s) de garagem`);
    }

    // Avaliação de comodidades / features desejadas
    const itemFeaturesText = normalizeString((item.features || []).join(' '));
    const matchedFeaturesList = [];
    for (const feat of targetFeatures) {
      if (itemFeaturesText.includes(feat)) {
        matchedFeaturesList.push(feat);
        matchScore += 6;
      }
    }
    if (matchedFeaturesList.length > 0) {
      matchHighlights.push(`Atende comodidades desejadas: ${matchedFeaturesList.join(', ')}`);
    }

    // Avaliação contextual por palavras-chave na descrição
    const fullSearchableText = normalizeString(`${item.title} ${item.description || ''} ${item.features ? item.features.join(' ') : ''}`);
    const matchedContextWords = [];
    for (const kw of contextKeywords) {
      if (fullSearchableText.includes(kw)) {
        matchedContextWords.push(kw);
        matchScore += 5;
      }
    }
    if (matchedContextWords.length > 0) {
      matchHighlights.push(`Termos contextuais encontrados: ${matchedContextWords.join(', ')}`);
    }

    // Limitar score a 100
    matchScore = Math.min(100, Math.max(1, matchScore));

    // Regra: Sempre mostrar imóveis com matching acima de 60% (ou minScoreThreshold configurado)
    if (matchScore < minScoreThreshold) {
      continue;
    }

    // Formatação do resultado (compacta para IA ou completa para CRM)
    let outputItem;
    if (format === 'compact' || format === 'ai') {
      outputItem = {
        id: item.id,
        title: item.title,
        transactionType: item.transactionType,
        propertyType: item.propertyType,
        usageType: item.usageType,
        price: item.price || 0,
        rentalPrice: item.rentalPrice || 0,
        condo: item.condo || 0,
        iptu: item.iptu || 0,
        livingArea: item.livingArea || 0,
        bedrooms: item.bedrooms || 0,
        suites: item.suites || 0,
        bathrooms: item.bathrooms || 0,
        garage: item.garage || 0,
        neighborhood: item.location?.neighborhood || '',
        city: item.location?.city || '',
        address: item.location?.address || '',
        features: item.features || [],
        description: item.description ? item.description.slice(0, 400) + (item.description.length > 400 ? '...' : '') : '',
        primaryImage: item.primaryImage || (item.images && item.images[0]) || '',
        websiteUrl: item.websiteUrl || '',
        kanbanStage: item.kanbanStage || 'disponivel',
        status: item.status || 'Vago / Disponível',
        matchScore,
        matchHighlights
      };
    } else {
      outputItem = {
        ...item,
        matchScore,
        matchHighlights
      };
    }

    matchedItems.push(outputItem);
  }

  // Ordenar por maior afinidade / Match Score em ordem rigorosamente decrescente
  matchedItems.sort((a, b) => b.matchScore - a.matchScore);

  const paginated = matchedItems.slice(offset, offset + limit);

  // Enriquecer critérios considerados com status de ativo e editado para exibição dinâmica no painel
  const criteriosEnriquecidos = (criteriosConsiderados || []).map(c => {
    const kNorm = normalizeString((c.campoOriginal || '') + ' ' + (c.campo || '')).replace(/[^a-z0-9]/g, '');
    let ativo = true;
    let valorEfetivo = c.valorOriginal;

    if (kNorm.includes('destina') || kNorm.includes('finalidade')) {
      if (isIgnored('ignoreFinalidade') || isIgnored('ignoreDestinacao') || isIgnored('ignoreTransacao')) {
        ativo = false;
      } else if (rawTransactionType) {
        valorEfetivo = rawTransactionType;
      }
    } else if (kNorm.includes('tipo')) {
      if (isIgnored('ignoreTipo') || isIgnored('ignorePropertyType')) {
        ativo = false;
      } else if (rawPropertyType) {
        valorEfetivo = rawPropertyType;
      }
    } else if (kNorm.includes('orcam') || kNorm.includes('oram') || kNorm.includes('preco')) {
      if (isIgnored('ignoreOrcamento') || isIgnored('ignorePreco') || isIgnored('ignoreValor')) {
        ativo = false;
      } else if (rawMaxPrice > 0) {
        valorEfetivo = String(rawMaxPrice);
      }
    } else if (kNorm.includes('bairro') || kNorm.includes('regiao')) {
      if (isIgnored('ignoreBairros') || isIgnored('ignoreRegiao')) {
        ativo = false;
      } else if (rawNeighborhoods) {
        valorEfetivo = rawNeighborhoods;
      }
    } else if (kNorm.includes('morador') || kNorm.includes('quarto')) {
      if (isIgnored('ignoreQuartos') || isIgnored('ignoreMoradores')) {
        ativo = false;
      } else if (rawBedrooms > 0) {
        valorEfetivo = `${rawBedrooms} quartos`;
      }
    } else if (kNorm.includes('pet')) {
      if (isIgnored('ignorePet')) {
        ativo = false;
      } else if (req.query.pet !== undefined) {
        valorEfetivo = req.query.pet;
      }
    } else if (kNorm.includes('particularidade') || kNorm.includes('comodidade')) {
      if (isIgnored('ignoreParticularidades') || isIgnored('ignoreComodidades')) {
        ativo = false;
      }
    } else if (kNorm.includes('motivo')) {
      if (isIgnored('ignoreMotivo') || isIgnored('ignoreContexto')) {
        ativo = false;
      }
    } else if (kNorm.includes('tempo') || kNorm.includes('prazo')) {
      if (isIgnored('ignoreTempo')) {
        ativo = false;
      }
    } else if (kNorm.includes('garantia')) {
      if (isIgnored('ignoreGarantia')) {
        ativo = false;
      }
    }

    return {
      ...c,
      ativo,
      editado: String(valorEfetivo).trim() !== String(c.valorOriginal).trim(),
      valorEfetivo
    };
  });

  res.json({
    success: true,
    endpoint: '/api/leads/match',
    minScoreThreshold,
    contact: contactData ? {
      id: contactData.id,
      name: contactData.name,
      phoneNumber: contactData.phoneNumber || contactData.phoneNumberFormatted,
      email: contactData.email,
      customFields: contactData.customFields || {},
      annotation: contactData.annotation || null,
      tags: contactData.tagNames || []
    } : null,
    contactWarning: contactWarning || undefined,
    leadProfile: {
      tipo: rawPropertyType || 'Qualquer',
      finalidade: rawTransactionType || 'Qualquer',
      uso: rawUsageType || 'Qualquer',
      orcamentoMax: rawMaxPrice || null,
      orcamentoMin: rawMinPrice || null,
      quartosMin: rawBedrooms || null,
      suitesMin: rawSuites || null,
      banheirosMin: rawBathrooms || null,
      vagasMin: rawGarage || null,
      regiao: rawNeighborhoods || 'Qualquer',
      cidade: rawCity || 'Qualquer',
      caracteristicas: targetFeatures,
      contexto: rawContext || null,
      somenteDisponiveis: onlyAvailable
    },
    criteriosConsiderados: criteriosEnriquecidos,
    totalMatches: matchedItems.length,
    offset,
    limit,
    results: paginated
  });
});

// --- ROTAS DE SESSION METADATA DO HELENA CRM ---

/**
 * POST /api/leads/session-metadata (ou /api/leads/record-sent)
 * Registra os imóveis enviados na sessão de atendimento ativa no Helena CRM
 * Recebe: { contactId, sessionId, properties, token }
 */
app.post(['/api/leads/session-metadata', '/api/leads/record-sent'], async (req, res) => {
  try {
    const contactId = req.body.contactId || req.query.contactId;
    const sessionId = req.body.sessionId || req.query.sessionId;
    const properties = req.body.properties || req.body.imoveis || [];
    const token = req.headers['x-helena-token'] || req.body.token || req.query.token || null;

    if (!contactId && !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'É obrigatório informar contactId ou sessionId.'
      });
    }

    const propList = Array.isArray(properties) ? properties : [properties].filter(Boolean);
    if (propList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum imóvel fornecido para registro.'
      });
    }

    // Enriquece com dados oficiais do catálogo (foto real, título e URL com slug) e descarta mocks
    const enrichedList = propList
      .map(enrichPropertyWithCatalog)
      .filter(Boolean);

    const result = await recordSentPropertiesInHelenaSession({
      sessionId,
      contactId,
      properties: enrichedList.length > 0 ? enrichedList : propList,
      tokenOverride: token
    });

    res.json({
      success: true,
      message: `${propList.length} imóvel(is) registrado(s) no session metadata do Helena CRM com sucesso!`,
      data: result
    });
  } catch (err) {
    console.error('⚠️ Falha ao registrar imóveis no session metadata do Helena CRM:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/leads/session-metadata
 * Obtém os imóveis já enviados e o metadata da sessão atual do atendimento
 * Recebe: ?contactId=... ou ?sessionId=...
 */
app.get('/api/leads/session-metadata', async (req, res) => {
  try {
    const contactId = req.query.contactId || req.query.contact_id;
    const sessionId = req.query.sessionId || req.query.session_id;
    const token = req.headers['x-helena-token'] || req.query.token || null;

    if (!contactId && !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'É obrigatório informar contactId ou sessionId.'
      });
    }

    let session = null;
    let targetSessionId = sessionId;

    if (targetSessionId) {
      session = await fetchHelenaSession(targetSessionId, token);
    } else if (contactId) {
      const sessionResult = await fetchHelenaContactSessions(contactId, token);
      session = sessionResult.activeSession;
      targetSessionId = session ? session.id : null;
    }

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Nenhuma sessão de atendimento encontrada para este contato no Helena CRM.'
      });
    }

    const meta = session.metadata || {};
    const rawImoveis = Array.isArray(meta.imoveisEnviados) ? meta.imoveisEnviados : [];

    // Enriquece cada imóvel com foto real e URL oficial funcional do catálogo, filtrando mocks
    const imoveisEnviados = rawImoveis
      .map(enrichPropertyWithCatalog)
      .filter(Boolean);

    const rawVisitas = Array.isArray(meta.visitasAgendadas) ? meta.visitasAgendadas : [];
    const visitasAgendadas = rawVisitas
      .filter(v => {
        const id = String(v.propertyId || '').toUpperCase();
        return !id.startsWith('TEST') && id !== 'MOCK';
      })
      .map(v => {
        const enriched = enrichPropertyWithCatalog({ id: v.propertyId, titulo: v.propertyTitle });
        return {
          ...v,
          propertyTitle: enriched?.titulo || v.propertyTitle,
          propertyPhoto: enriched?.primaryImage || v.propertyPhoto || '',
          propertyUrl: enriched?.websiteUrl || v.propertyUrl
        };
      });

    res.json({
      success: true,
      sessionId: session.id,
      sessionStatus: session.status,
      contactId: session.contactId || contactId,
      totalImoveisEnviados: imoveisEnviados.length,
      imoveisEnviados,
      visitasAgendadas,
      metadata: {
        ...meta,
        imoveisEnviados,
        visitasAgendadas
      }
    });
  } catch (err) {
    console.error('⚠️ Erro ao consultar session metadata do Helena CRM:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * POST /api/leads/schedule-visits
 * Salva as visitas escolhidas pelo lead no Session Metadata do Helena CRM
 * e no CRM Store Santos & Mello
 */
app.post('/api/leads/schedule-visits', async (req, res) => {
  try {
    const { sessionId, contactId, visits, clientName, clientPhone } = req.body;
    const token = req.headers['x-helena-token'] || req.body.token || req.query.token || null;

    if (!sessionId && !contactId) {
      return res.status(400).json({ success: false, error: 'É obrigatório informar sessionId ou contactId.' });
    }

    const visitList = Array.isArray(visits) ? visits : [visits].filter(Boolean);
    if (visitList.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhuma visita informada para agendamento.' });
    }

    // 1. Salva cada visita no crmStore
    const savedCrmVisits = [];
    visitList.forEach(v => {
      if (v.propertyId && v.date && v.time) {
        try {
          const created = crmStore.createVisit({
            propertyId: String(v.propertyId),
            propertyTitle: v.propertyTitle || `Imóvel #${v.propertyId}`,
            clientName: clientName || v.clientName || 'Lead Helena CRM',
            clientPhone: clientPhone || v.clientPhone || '',
            date: v.date,
            time: v.time,
            broker: v.broker || 'Corretor de Plantão',
            notes: v.notes || '',
            sessionId: sessionId || undefined,
            contactId: contactId || undefined
          });
          savedCrmVisits.push(created);
        } catch (crmErr) {
          console.warn('Aviso ao salvar visita no crmStore:', crmErr.message);
        }
      }
    });

    // 2. Salva no session metadata do Helena CRM
    let sessionResult = null;
    try {
      sessionResult = await recordScheduledVisitsInHelenaSession({
        sessionId,
        contactId,
        visits: visitList,
        tokenOverride: token
      });
    } catch (helenaErr) {
      console.warn('Aviso ao salvar visitas no metadata da Helena:', helenaErr.message);
    }

    res.json({
      success: true,
      message: `${visitList.length} visita(s) agendada(s) com sucesso!`,
      data: {
        crmVisits: savedCrmVisits,
        helenaSession: sessionResult
      }
    });
  } catch (err) {
    console.error('Erro ao processar agendamento de visitas:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ROTAS DO CRM & GESTÃO DE IMÓVEIS (CRUD) ---

// Listar imóveis gerenciais com paginação e filtros
app.get('/api/imoveis', (req, res) => {
  const query = normalizeString(req.query.q || '');
  const typeFilter = normalizeString(req.query.type || '');
  const stageFilter = (req.query.kanbanStage || req.query.stage || '').trim();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

  let all = getAllPropertiesMerged();

  if (query) {
    all = all.filter(p => {
      const idN = normalizeString(p.id);
      const titleN = normalizeString(p.title);
      const neighN = normalizeString(p.location?.neighborhood);
      const cityN = normalizeString(p.location?.city);
      const typeN = normalizeString(p.propertyType);
      return idN.includes(query) || titleN.includes(query) || neighN.includes(query) || cityN.includes(query) || typeN.includes(query);
    });
  }

  if (typeFilter && typeFilter !== 'all') {
    all = all.filter(p => normalizeString(p.transactionType).includes(typeFilter));
  }

  if (stageFilter && stageFilter !== 'all') {
    all = all.filter(p => (p.kanbanStage || 'disponivel') === stageFilter);
  }

  const total = all.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const items = all.slice(startIndex, startIndex + limit);

  res.json({
    success: true,
    data: items,
    pagination: {
      total,
      page,
      limit,
      totalPages
    },
    stages: KANBAN_STAGES
  });
});

// Criar novo imóvel
app.post('/api/imoveis', (req, res) => {
  try {
    const data = req.body;
    if (!data.title) {
      return res.status(400).json({ error: 'O título do imóvel é obrigatório.' });
    }

    const created = crmStore.createProperty(data);
    res.status(201).json({ success: true, data: created, message: 'Imóvel cadastrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar imóvel: ' + err.message });
  }
});

// Atualizar imóvel existente
app.put('/api/imoveis/:id', (req, res) => {
  try {
    const id = req.params.id;
    const updated = crmStore.updateProperty(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Imóvel não encontrado para atualização.' });
    }
    res.json({ success: true, data: updated, message: 'Imóvel atualizado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar imóvel: ' + err.message });
  }
});

// Excluir imóvel
app.delete('/api/imoveis/:id', (req, res) => {
  try {
    const id = req.params.id;
    crmStore.deleteProperty(id);
    res.json({ success: true, message: `Imóvel #${id} excluído com sucesso.` });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir imóvel: ' + err.message });
  }
});

// Alteração rápida de etapa do Kanban / Status do Imóvel
app.patch('/api/imoveis/:id/status', (req, res) => {
  try {
    const id = req.params.id;
    const { kanbanStage, status, keyTag } = req.body;

    const stageObj = KANBAN_STAGES.find(s => s.id === kanbanStage);
    const finalStatus = status || (stageObj ? stageObj.label : 'Vago / Disponível');

    const updated = crmStore.savePropertyOverride(id, {
      kanbanStage,
      status: finalStatus,
      ...(keyTag ? { keyTag } : {})
    });

    res.json({ success: true, data: updated, message: 'Status do imóvel atualizado!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status: ' + err.message });
  }
});

// --- ROTA DO KANBAN DA JORNADA DO IMÓVEL ---
app.get('/api/kanban', (req, res) => {
  const all = getAllPropertiesMerged();
  const columns = {};

  for (const stage of KANBAN_STAGES) {
    columns[stage.id] = [];
  }

  for (const prop of all) {
    const stageId = prop.kanbanStage || 'disponivel';
    if (columns[stageId]) {
      // Limite inteligente para evitar sobrecarga no DOM do kanban (até 30 por coluna)
      if (columns[stageId].length < 30) {
        columns[stageId].push({
          id: prop.id,
          title: prop.title,
          transactionType: prop.transactionType,
          propertyType: prop.propertyType,
          price: prop.price,
          rentalPrice: prop.rentalPrice,
          livingArea: prop.livingArea,
          bedrooms: prop.bedrooms,
          garage: prop.garage,
          neighborhood: prop.location?.neighborhood || 'Santo André',
          primaryImage: prop.primaryImage,
          keyTag: prop.keyTag || `CLAV-${prop.id}`,
          status: prop.status,
          kanbanStage: stageId
        });
      }
    }
  }

  // Contadores totais reais em cada coluna
  const counts = {};
  for (const stage of KANBAN_STAGES) {
    counts[stage.id] = all.filter(p => (p.kanbanStage || 'disponivel') === stage.id).length;
  }

  res.json({
    success: true,
    stages: KANBAN_STAGES,
    columns,
    counts,
    totalProperties: all.length
  });
});

// --- ROTAS DE AGENDAMENTO DE VISITAS ---
app.get('/api/visits', (req, res) => {
  const visits = crmStore.getVisits({
    status: req.query.status,
    propertyId: req.query.propertyId
  });
  res.json({ success: true, data: visits });
});

app.post('/api/visits', (req, res) => {
  try {
    const data = req.body;
    if (!data.propertyId || !data.clientName || !data.date || !data.time) {
      return res.status(400).json({ error: 'Preencha o imóvel, cliente, data e horário da visita.' });
    }

    const created = crmStore.createVisit(data);
    res.status(201).json({ success: true, data: created, message: 'Visita agendada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao agendar visita: ' + err.message });
  }
});

app.patch('/api/visits/:id', (req, res) => {
  try {
    const updated = crmStore.updateVisit(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Visita não encontrada.' });
    }
    res.json({ success: true, data: updated, message: 'Visita atualizada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar visita: ' + err.message });
  }
});

app.delete('/api/visits/:id', (req, res) => {
  try {
    crmStore.deleteVisit(req.params.id);
    res.json({ success: true, message: 'Visita cancelada/removida com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover visita: ' + err.message });
  }
});

// --- ROTAS DE CONTROLE DE CHAVES (CLAVICULÁRIO) ---
app.get('/api/keys', (req, res) => {
  const movements = crmStore.getKeyMovements({
    status: req.query.status,
    propertyId: req.query.propertyId
  });
  res.json({ success: true, data: movements });
});

app.post('/api/keys/checkout', (req, res) => {
  try {
    const data = req.body;
    if (!data.propertyId || !data.takenBy) {
      return res.status(400).json({ error: 'Informe o imóvel e o responsável pela retirada da chave.' });
    }

    const created = crmStore.checkoutKey(data);
    res.status(201).json({ success: true, data: created, message: 'Saída de chave registrada!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar saída de chave: ' + err.message });
  }
});

app.post('/api/keys/:id/return', (req, res) => {
  try {
    const updated = crmStore.returnKey(req.params.id, req.body.notes);
    if (!updated) {
      return res.status(404).json({ error: 'Registro de chave não encontrado.' });
    }
    res.json({ success: true, data: updated, message: 'Devolução de chave confirmada no claviculário!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao devolver chave: ' + err.message });
  }
});

// --- ROTA DE RELATÓRIOS & BI IMOBILIÁRIO ---
app.get('/api/bi/reports', (req, res) => {
  const all = getAllPropertiesMerged();
  const visits = crmStore.getVisits();
  const keys = crmStore.getKeyMovements();

  let countRent = 0;
  let countSale = 0;
  let countBoth = 0;
  let sumRentPrice = 0;
  let rentPriceCount = 0;
  let sumSalePrice = 0;
  let salePriceCount = 0;

  const neighborhoodCounts = {};
  const typeCounts = {};
  const stageCounts = {};

  for (const s of KANBAN_STAGES) {
    stageCounts[s.id] = 0;
  }

  for (const p of all) {
    const trans = (p.transactionType || '').toLowerCase();
    if (trans.includes('locação') && trans.includes('venda')) {
      countBoth++;
    } else if (trans.includes('locação') || trans.includes('rent')) {
      countRent++;
    } else {
      countSale++;
    }

    if (p.rentalPrice > 0) {
      sumRentPrice += p.rentalPrice;
      rentPriceCount++;
    }
    if (p.price > 0) {
      sumSalePrice += p.price;
      salePriceCount++;
    }

    const neigh = p.location?.neighborhood?.trim() || 'Outros';
    neighborhoodCounts[neigh] = (neighborhoodCounts[neigh] || 0) + 1;

    const propType = p.propertyType ? p.propertyType.replace('Residential / ', '').replace('Commercial / ', '').trim() : 'Outros';
    typeCounts[propType] = (typeCounts[propType] || 0) + 1;

    const stageId = p.kanbanStage || 'disponivel';
    if (stageCounts[stageId] !== undefined) {
      stageCounts[stageId]++;
    }
  }

  const topNeighborhoods = Object.entries(neighborhoodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, percent: ((count / all.length) * 100).toFixed(1) }));

  const topPropertyTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([type, count]) => ({ type, count, percent: ((count / all.length) * 100).toFixed(1) }));

  // Métricas do PDF:
  // "hj por exemplo eu integrei com o chaves na mão e meu 512 imóveis disponiveis, aqui no nosso esta 1200"
  const totalXmlCatalog = metadata.total || all.length;
  const chavesNaMaoAvailable = 512;
  const currentlyAvailable = stageCounts['disponivel'] || 0;
  const inPipelineCount = all.length - currentlyAvailable;

  res.json({
    success: true,
    data: {
      overview: {
        totalProperties: all.length,
        totalXmlCatalog,
        totalRent: countRent + countBoth,
        totalSale: countSale + countBoth,
        totalBoth: countBoth,
        avgRentalPrice: rentPriceCount ? Math.round(sumRentPrice / rentPriceCount) : 0,
        avgSalePrice: salePriceCount ? Math.round(sumSalePrice / salePriceCount) : 0
      },
      chavesNaMaoPortalComparison: {
        totalXmlFeed: totalXmlCatalog,
        chavesNaMaoPublished: chavesNaMaoAvailable,
        crmAvailableForPortals: currentlyAvailable,
        inNegotiationOrReserved: inPipelineCount,
        discrepancyNote: 'No portal Chaves na Mão estão ativos 512 imóveis com fotos aprovadas e regras de publicação. No feed XML geral constam 1.200 imóveis cadastrados, dos quais parte estão em visita, proposta ou pendentes de atualização de mídia.'
      },
      kanbanFunnel: {
        stages: KANBAN_STAGES.map(s => ({
          ...s,
          count: stageCounts[s.id] || 0,
          percent: all.length ? (((stageCounts[s.id] || 0) / all.length) * 100).toFixed(1) : 0
        }))
      },
      visitsMetrics: {
        total: visits.length,
        scheduled: visits.filter(v => v.status === 'Agendada').length,
        confirmed: visits.filter(v => v.status === 'Confirmada').length,
        completed: visits.filter(v => v.status === 'Realizada').length,
        cancelled: visits.filter(v => v.status === 'Cancelada').length
      },
      keysMetrics: {
        totalMovements: keys.length,
        checkedOut: keys.filter(k => k.status === 'Retirada').length,
        delayed: keys.filter(k => k.status === 'Atrasada').length,
        returned: keys.filter(k => k.status === 'Devolvida').length
      },
      topNeighborhoods,
      topPropertyTypes
    }
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    data: metadata
  });
});

app.post('/api/sync', async (req, res) => {
  try {
    const result = await syncFeed();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Configuração de sincronização periódica automática a cada 6 horas
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const syncCron = setInterval(async () => {
  console.log('⏰ [Cron] Executando sincronização periódica do feed XML...');
  try {
    await syncFeed();
  } catch (err) {
    console.error('⚠️ [Cron] Falha na sincronização periódica:', err.message);
  }
}, SYNC_INTERVAL_MS);
if (syncCron && syncCron.unref) syncCron.unref();

// Inicialização (apenas se executado diretamente, não quando importado por testes)
if (require.main === module && (!process.env.VERCEL || process.env.NODE_ENV !== 'production')) {
  app.listen(PORT, async () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`⏱️ Sincronização periódica configurada a cada 6 horas.`);
    try {
      await syncFeed();
    } catch (err) {
      console.error('Falha ao iniciar sync inicial:', err.message);
    }
  });
}

module.exports = app;


