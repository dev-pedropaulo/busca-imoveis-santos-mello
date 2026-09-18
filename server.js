const express = require('express');
const cors = require('cors');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const app = express();
const PORT = process.env.PORT || 3333;
const XML_URL = 'https://universal-ftp2.s3.us-west-2.amazonaws.com/vr/santosemello-vivareal-8835-ambos.xml';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

  return {
    id: listingId,
    title: cleanText(raw.Title) || `Imóvel #${listingId}`,
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
    websiteUrl: `https://www.santosemello.com.br/imovel/${listingId}`,
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

    listingsMap = newMap;
    listingsList = newList;
    metadata.lastSync = new Date().toISOString();
    metadata.total = listingsList.length;

    console.log(`✅ Sincronização concluída! ${metadata.total} imóveis indexados.`);
    return { success: true, count: metadata.total, lastSync: metadata.lastSync };
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

// Rotas da API
app.get('/api/imovel/:id', (req, res) => {
  const code = (req.params.id || '').trim().toLowerCase();
  const imovel = listingsMap.get(code);

  if (!imovel) {
    return res.status(404).json({ error: 'Imóvel não encontrado com o código fornecido.' });
  }

  res.json({ success: true, data: imovel });
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
    { id: 'pets', label: 'Aceita Pets', icon: '🐾' },
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
  const usageType = (req.query.usageType || '').trim();
  const propertyType = (req.query.propertyType || '').trim();
  const city = (req.query.city || '').trim();
  const neighborhood = (req.query.neighborhood || '').trim();
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
  if (cleanQueryStr && (!transactionType || transactionType === 'all') && (!usageType || usageType === 'all') && (!propertyType || propertyType === 'all') && (!city || city === 'all') && (!neighborhood || neighborhood === 'all') && minPrice === 0 && maxPrice === Infinity && minBedrooms === 0 && minSuites === 0 && minBathrooms === 0 && minGarage === 0 && minArea === 0 && !hasTour && !featuresQuery) {
    const cleanId = cleanQueryStr.toLowerCase();
    const exact = listingsMap.get(cleanId);
    if (exact) {
      return res.json({ success: true, results: [exact], total: 1, isExactId: true });
    }
  }

  const queryNorm = normalizeString(cleanQueryStr);
  const cityNorm = normalizeString(city);
  const neighborhoodNorm = normalizeString(neighborhood);
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

    // Filtro por Bairro
    if (neighborhoodNorm && neighborhood !== 'all') {
      const itemNeighNorm = normalizeString(item.location.neighborhood);
      if (!itemNeighNorm.includes(neighborhoodNorm)) {
        return false;
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
setInterval(async () => {
  console.log('⏰ [Cron] Executando sincronização periódica do feed XML...');
  try {
    await syncFeed();
  } catch (err) {
    console.error('⚠️ [Cron] Falha na sincronização periódica:', err.message);
  }
}, SYNC_INTERVAL_MS);

// Inicialização
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
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


