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
  const features = rawFeatures.map(f => cleanText(f)).filter(Boolean);

  return {
    id: listingId,
    title: cleanText(raw.Title) || `Imóvel #${listingId}`,
    transactionType,
    propertyType: cleanText(details.PropertyType) || 'Imóvel',
    usageType: cleanText(details.UsageType) || 'Residencial',
    price: parseFloat(cleanText(details.ListPrice)) || 0,
    rentalPrice: parseFloat(cleanText(details.RentalPrice)) || 0,
    iptu: parseFloat(cleanText(details.Iptu)) || 0,
    condo: parseFloat(cleanText(details.PropertyAdministrationFee)) || 0,
    livingArea: parseFloat(cleanText(details.LivingArea)) || parseFloat(cleanText(details.ConstructedArea)) || 0,
    lotArea: parseFloat(cleanText(details.LotArea)) || 0,
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
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

app.get('/api/filter-options', (req, res) => {
  const neighborhoodsSet = new Set();
  const propertyTypesSet = new Set();

  for (const item of listingsList) {
    if (item.location.neighborhood) {
      neighborhoodsSet.add(item.location.neighborhood.trim());
    }
    if (item.propertyType) {
      const cleanType = item.propertyType.replace('Residential / ', '').replace('Commercial / ', '').trim();
      if (cleanType) propertyTypesSet.add(cleanType);
    }
  }

  const neighborhoods = Array.from(neighborhoodsSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const propertyTypes = Array.from(propertyTypesSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  res.json({
    success: true,
    data: {
      neighborhoods,
      propertyTypes,
      transactionTypes: ['Venda', 'Locação']
    }
  });
});

app.get('/api/search', (req, res) => {
  const rawQuery = (req.query.q || '').trim();
  const transactionType = (req.query.type || '').trim();
  const propertyType = (req.query.propertyType || '').trim();
  const neighborhood = (req.query.neighborhood || '').trim();
  const minPrice = parseFloat(req.query.minPrice) || 0;
  const maxPrice = parseFloat(req.query.maxPrice) || Infinity;
  const minBedrooms = parseInt(req.query.minBedrooms) || 0;
  const minGarage = parseInt(req.query.minGarage) || 0;
  const minArea = parseFloat(req.query.minArea) || 0;
  const sortBy = req.query.sortBy || 'relevance';
  const limit = Math.min(parseInt(req.query.limit) || 40, 100);
  const offset = parseInt(req.query.offset) || 0;

  // Se o termo de busca for exatamente um código conhecido e nenhum outro filtro complexo foi aplicado, retorna direto
  if (rawQuery && !transactionType && !propertyType && !neighborhood && minPrice === 0 && maxPrice === Infinity && minBedrooms === 0 && minGarage === 0) {
    const cleanId = rawQuery.replace('#', '').toLowerCase();
    const exact = listingsMap.get(cleanId);
    if (exact) {
      return res.json({ success: true, results: [exact], total: 1, isExactId: true });
    }
  }

  const queryNorm = normalizeString(rawQuery);
  const neighborhoodNorm = normalizeString(neighborhood);
  const propertyTypeNorm = normalizeString(propertyType);

  let filtered = listingsList.filter(item => {
    // Filtro por termo livre (ID, título, bairro, cidade ou descrição)
    if (queryNorm) {
      const idNorm = normalizeString(item.id);
      const titleNorm = normalizeString(item.title);
      const itemNeighNorm = normalizeString(item.location.neighborhood);
      const itemPropNorm = normalizeString(item.propertyType);
      const itemCityNorm = normalizeString(item.location.city);

      const matchesText = idNorm.includes(queryNorm) ||
        titleNorm.includes(queryNorm) ||
        itemNeighNorm.includes(queryNorm) ||
        itemPropNorm.includes(queryNorm) ||
        itemCityNorm.includes(queryNorm);

      if (!matchesText) return false;
    }

    // Filtro por Tipo de Transação (Venda / Locação)
    if (transactionType && transactionType !== 'all') {
      if (!item.transactionType.toLowerCase().includes(transactionType.toLowerCase())) {
        return false;
      }
    }

    // Filtro por Tipo de Imóvel
    if (propertyTypeNorm && propertyType !== 'all') {
      const itemTypeNorm = normalizeString(item.propertyType);
      if (!itemTypeNorm.includes(propertyTypeNorm)) {
        return false;
      }
    }

    // Filtro por Bairro
    if (neighborhoodNorm && neighborhood !== 'all') {
      const itemNeighNorm = normalizeString(item.location.neighborhood);
      if (!itemNeighNorm.includes(neighborhoodNorm)) {
        return false;
      }
    }

    // Filtro por Preço
    const priceToCheck = item.transactionType.toLowerCase().includes('locação') ? (item.rentalPrice || item.price) : (item.price || item.rentalPrice);
    if (priceToCheck > 0) {
      if (priceToCheck < minPrice || priceToCheck > maxPrice) return false;
    }

    // Filtro por Quartos
    if (minBedrooms > 0 && item.bedrooms < minBedrooms) return false;

    // Filtro por Vagas
    if (minGarage > 0 && item.garage < minGarage) return false;

    // Filtro por Área Útil
    if (minArea > 0 && item.livingArea < minArea) return false;

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
  } else if (sortBy === 'beds_desc') {
    filtered.sort((a, b) => (b.bedrooms || 0) - (a.bedrooms || 0));
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

// Inicialização
app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  try {
    await syncFeed();
  } catch (err) {
    console.error('Falha ao iniciar sync inicial:', err.message);
  }
});
