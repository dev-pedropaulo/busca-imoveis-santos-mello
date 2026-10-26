const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabase');
const { buildPropertyWebsiteUrl } = require('./property-website-url');

/**
 * Mapeamento reverso de comodidades em português para tags oficiais do padrão VivaReal/VRSync
 */
const FEATURE_TAG_MAP = {
  'portaria 24h': 'Security Guard on Duty',
  'portão eletrônico': 'Alarm System',
  'portao eletronico': 'Alarm System',
  'interfone': 'Intercom',
  'elevador': 'Elevator',
  'ar condicionado': 'Cooling',
  'aquecimento solar': 'Heating',
  'área de serviço': 'Laundry',
  'area de servico': 'Laundry',
  'varanda gourmet': 'Gourmet Area',
  'closet': 'Closet',
  'dep. empregada': "Maid's Quarters",
  'lavabo': 'Half Bath',
  'mobiliado': 'Furnished',
  'piscina': 'Pool',
  'churrasqueira': 'BBQ',
  'academia': 'Gym',
  'salão de festas': 'Party Room',
  'salao de festas': 'Party Room',
  'playground': 'Playground',
  'quadra poliesportiva': 'Sports Court',
  'salão de jogos': 'Game room',
  'salao de jogos': 'Game room',
  'quintal': 'Backyard',
  'varanda': 'Balcony',
  'sacada': 'Balcony',
  'sauna': 'Sauna',
  'jardim': 'Garden',
  'home office': 'Home Office'
};

const DEFAULT_FEED_CONFIG = {
  provider: 'S & M',
  email: 'Financeiro@santosemello.com.br',
  contactName: 'S & M',
  companyName: 'SANTOS E MELLO IMOVEIS LTDA',
  telephone: '1144692121',
  logo: 'https://cdn.imoview.com.br/santosemello/logo-1771518225.png',
  website: 'https://www.santosemello.com.br',
  officeLocation: {
    country: 'Brasil',
    countryAbbr: 'BR',
    state: 'São Paulo',
    stateAbbr: 'SP',
    city: 'Santo André',
    neighborhood: 'Parque Novo Oratório',
    address: 'Avenida Araucária',
    streetNumber: '615',
    postalCode: '09250000'
  },
  cacheTtlMs: 30 * 60 * 1000, // 30 minutos de cache
  cacheFilePath: path.join(__dirname, '..', 'data', 'feed-vivareal.xml')
};

/**
 * Escapa caracteres reservados em atributos e nós simples de XML
 */
function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * Escapa e sanitiza blocos CDATA para evitar quebra com ']]>'
 */
function escapeCdata(str) {
  if (str === null || str === undefined) return '';
  const clean = String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return clean.split(']]>').join(']]]]><![CDATA[>');
}

/**
 * Formata data no formato ISO compatível com padrão Imoview / VivaReal: YYYY-MM-DDTHH:mm:ss
 */
function formatIso(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 19);
  return d.toISOString().slice(0, 19);
}

/**
 * Resolve UsageType e PropertyType conforme especificação do VivaReal/ZAP
 */
function resolvePropertyType(tipo, destinacao) {
  const isCom = (destinacao || '').toLowerCase().includes('comerc');
  const t = (tipo || '').toLowerCase();

  if (t.includes('sobrado')) return { usage: 'Residential', type: 'Residential / Sobrado' };
  if (t.includes('apartamento duplex') || t.includes('cobertura')) return { usage: 'Residential', type: 'Residential / Penthouse' };
  if (t.includes('apartamento') || t.includes('apto')) return { usage: 'Residential', type: 'Residential / Apartment' };
  if (t.includes('kitnet') || t.includes('studio') || t.includes('flat')) return { usage: 'Residential', type: 'Residential / Kitnet' };
  if (t.includes('chácara') || t.includes('sitio') || t.includes('fazenda')) return { usage: 'Residential', type: 'Residential / Farm Ranch' };
  if (t.includes('casa')) return { usage: isCom ? 'Commercial' : 'Residential', type: isCom ? 'Commercial / Home' : 'Residential / Home' };
  if (t.includes('terreno') || t.includes('lote')) return { usage: isCom ? 'Commercial' : 'Residential', type: isCom ? 'Commercial / Land Lot' : 'Residential / Land Lot' };

  if (t.includes('salão') || t.includes('salao') || t.includes('loja')) return { usage: 'Commercial', type: 'Commercial / Store' };
  if (t.includes('sala') || t.includes('conjunto')) return { usage: 'Commercial', type: 'Commercial / Office' };
  if (t.includes('prédio') || t.includes('predio') || t.includes('edificio')) return { usage: 'Commercial', type: 'Commercial / Edificio Comercial' };
  if (t.includes('galpão') || t.includes('galpao') || t.includes('depósito')) return { usage: 'Commercial', type: 'Commercial / Industrial' };

  return isCom
    ? { usage: 'Commercial', type: 'Commercial / Business' }
    : { usage: 'Residential', type: 'Residential / Apartment' };
}

/**
 * Resolve TransactionType (For Sale, For Rent, Sale/Rent)
 */
function resolveTransactionType(finalidade, valorVenda, valorLocacao) {
  const fin = (finalidade || '').toLowerCase();
  const vVenda = parseFloat(valorVenda) || 0;
  const vLoc = parseFloat(valorLocacao) || 0;

  if (fin.includes('ambos') || (vVenda > 0 && vLoc > 0)) {
    return 'Sale/Rent';
  }
  if (fin.includes('aluguel') || fin.includes('loca') || (vLoc > 0 && vVenda <= 0)) {
    return 'For Rent';
  }
  return 'For Sale';
}

/**
 * Coleta lista de Features do imóvel
 */
function extractPropertyFeatures(imovel) {
  const featureSet = new Set();

  // Comodidades estruturais básicas
  if (imovel.vagas > 0) featureSet.add('Parking Garage');
  featureSet.add('Kitchen');

  // Flags booleanas
  if (imovel.portaria_24h) featureSet.add('Security Guard on Duty');
  if (imovel.interfone) featureSet.add('Intercom');
  if (imovel.elevador) featureSet.add('Elevator');
  if (imovel.ar_condicionado) featureSet.add('Cooling');
  if (imovel.aquecimento_solar) featureSet.add('Heating');
  if (imovel.area_servico) featureSet.add('Laundry');
  if (imovel.varanda_gourmet) {
    featureSet.add('Gourmet Area');
    featureSet.add('Balcony');
  }
  if (imovel.closet) featureSet.add('Closet');
  if (imovel.dce) featureSet.add("Maid's Quarters");
  if (imovel.mobiliado) featureSet.add('Furnished');
  if (imovel.portao_eletronico) featureSet.add('Alarm System');

  // Se o objeto já possui array de features (do propertiesRepository)
  if (Array.isArray(imovel.features)) {
    for (const f of imovel.features) {
      const lower = String(f).toLowerCase().trim();
      const mapped = FEATURE_TAG_MAP[lower];
      if (mapped) featureSet.add(mapped);
    }
  }

  return Array.from(featureSet);
}

/**
 * Renderiza um único imóvel no formato <Listing>
 */
function renderListingXml(imovel, photos = [], config = DEFAULT_FEED_CONFIG) {
  const listingId = String(imovel.codigo_imovel || imovel.id);
  const transactionType = resolveTransactionType(
    imovel.finalidade || imovel.transactionType,
    imovel.valor_venda || imovel.price,
    imovel.valor_locacao || imovel.rentalPrice
  );

  const { usage: usageType, type: propertyType } = resolvePropertyType(
    imovel.tipo_imovel || imovel.propertyType,
    imovel.destinacao || imovel.usageType
  );

  const publicationType = imovel.exclusivo ? 'PREMIERE_2' : 'STANDARD';
  const title = imovel.titulo || imovel.title || `${imovel.tipo_imovel || 'Imóvel'} para ${transactionType === 'For Rent' ? 'Locação' : 'Venda'} em ${imovel.bairro || 'Santo André'}`;
  const websiteUrl = imovel.websiteUrl || buildPropertyWebsiteUrl(title, listingId);
  const statusDate = formatIso(imovel.updated_at || imovel.data_alteracao || imovel.created_at);

  const listPrice = Math.round(parseFloat(imovel.valor_venda || imovel.price) || 0);
  const rentalPrice = Math.round(parseFloat(imovel.valor_locacao || imovel.rentalPrice) || 0);
  const condoPrice = Math.round(parseFloat(imovel.valor_condominio || imovel.condo) || 0);
  const iptuPrice = Math.round(parseFloat(imovel.valor_iptu || imovel.iptu) || 0);

  const livingArea = Math.round(parseFloat(imovel.area_interna || imovel.area_privativa || imovel.livingArea) || 0);
  const constructedArea = Math.round(parseFloat(imovel.area_externa || imovel.constructedArea) || 0);
  const lotArea = Math.round(parseFloat(imovel.area_lote || imovel.lotArea) || 0);

  const bedrooms = parseInt(imovel.quartos || imovel.bedrooms, 10) || 0;
  const bathrooms = parseInt(imovel.banheiros || imovel.bathrooms, 10) || 0;
  const suites = parseInt(imovel.suites, 10) || 0;
  const garage = parseInt(imovel.vagas || imovel.garage, 10) || 0;

  const description = imovel.descricao || imovel.description || '';
  const features = extractPropertyFeatures(imovel);

  // Localização
  const city = escapeXml(imovel.cidade || (imovel.location && imovel.location.city) || 'Santo André');
  const neighborhood = escapeXml(imovel.bairro || (imovel.location && imovel.location.neighborhood) || 'Centro');
  const address = escapeXml(imovel.endereco || (imovel.location && imovel.location.address) || '');
  const streetNumber = escapeXml(imovel.numero || (imovel.location && imovel.location.streetNumber) || '');
  const complement = escapeXml(imovel.complemento || (imovel.location && imovel.location.complement) || '');
  const postalCode = escapeXml(((imovel.cep || (imovel.location && imovel.location.postalCode)) || '').replace(/\D/g, ''));

  let latitude = (imovel.latitude || (imovel.location && imovel.location.latitude) || '').toString().trim();
  let longitude = (imovel.longitude || (imovel.location && imovel.location.longitude) || '').toString().trim();
  // Formatar com vírgula para compatibilidade fidedigna com Imoview original
  if (latitude && latitude.includes('.')) latitude = latitude.replace('.', ',');
  if (longitude && longitude.includes('.')) longitude = longitude.replace('.', ',');

  // Fotos
  let mediaList = [];
  if (photos && photos.length > 0) {
    mediaList = photos;
  } else if (Array.isArray(imovel.images) && imovel.images.length > 0) {
    mediaList = imovel.images;
  } else if (imovel.foto_destaque || imovel.primaryImage) {
    mediaList = [imovel.foto_destaque || imovel.primaryImage];
  }

  // Filtrar fotos válidas
  mediaList = mediaList.filter(url => url && typeof url === 'string' && url.startsWith('http'));

  let mediaItemsXml = '';
  mediaList.forEach((photoUrl, idx) => {
    const isPrimary = idx === 0 ? 'true' : 'false';
    mediaItemsXml += `        <Item medium="image" caption="" primary="${isPrimary}">${escapeXml(photoUrl)}</Item>\n`;
  });

  let featuresXml = '';
  features.forEach(feat => {
    featuresXml += `          <Feature>${escapeXml(feat)}</Feature>\n`;
  });

  return `    <Listing>
      <ListingID>${listingId}</ListingID>
      <Title><![CDATA[${escapeCdata(title)}]]></Title>
      <TransactionType>${transactionType}</TransactionType>
      <PublicationType>${publicationType}</PublicationType>
      <DetailViewUrl>${escapeXml(websiteUrl)}</DetailViewUrl>
      <VirtualTourLink></VirtualTourLink>
      <Building></Building>
      <Status>
        <PropertyStatus>Available</PropertyStatus>
        <StatusDate>${statusDate}</StatusDate>
        <ClosingPrice currency="BRL">0</ClosingPrice>
      </Status>
      <Details>
        <UsageType>${usageType}</UsageType>
        <PropertyType>${propertyType}</PropertyType>
        <ListPrice currency="BRL">${listPrice}</ListPrice>
        <RentalPrice currency="BRL" period="Monthly">${rentalPrice}</RentalPrice>
        <PropertyAdministrationFee currency="BRL" period="Monthly">${condoPrice}</PropertyAdministrationFee>
        <AvailableDate>${statusDate}</AvailableDate>
        <ConstructedArea unit="square metres">${constructedArea}</ConstructedArea>
        <LotArea unit="square metres">${lotArea}</LotArea>
        <LivingArea unit="square metres">${livingArea}</LivingArea>
        <DevelopmentLevel>Built</DevelopmentLevel>
        <YearBuilt>2026</YearBuilt>
        <Bedrooms>${bedrooms}</Bedrooms>
        <Bathrooms>${bathrooms}</Bathrooms>
        <Suites>${suites}</Suites>
        <Garage type="Parking Space">${garage}</Garage>
        <Floors>0</Floors>
        <UnitFloor>0</UnitFloor>
        <UnitNumber></UnitNumber>
        <Iptu currency="BRL" period="Monthly">${iptuPrice}</Iptu>
        <Description><![CDATA[${escapeCdata(description)}]]></Description>
        <Features>
${featuresXml}        </Features>
      </Details>
      <Location displayAddress="Neighborhood">
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="SP">São Paulo</State>
        <City>${city}</City>
        <Zone></Zone>
        <Neighborhood>${neighborhood}</Neighborhood>
        <Address>${address}</Address>
        <StreetNumber>${streetNumber}</StreetNumber>
        <Complement>${complement}</Complement>
        <PostalCode>${postalCode}</PostalCode>
        <Latitude>${latitude}</Latitude>
        <Longitude>${longitude}</Longitude>
      </Location>
      <ContactInfo>
        <Name>${escapeXml(config.provider)}</Name>
        <OfficeName>${escapeXml(config.companyName)}</OfficeName>
        <Email>${escapeXml(config.email)}</Email>
        <Telephone>${escapeXml(config.telephone)}</Telephone>
        <Website>${escapeXml(config.website)}</Website>
        <Photo></Photo>
        <Logo>${escapeXml(config.logo)}</Logo>
        <Location>
          <Country abbreviation="${config.officeLocation.countryAbbr}">${escapeXml(config.officeLocation.country)}</Country>
          <State abbreviation="${config.officeLocation.stateAbbr}">${escapeXml(config.officeLocation.state)}</State>
          <City>${escapeXml(config.officeLocation.city)}</City>
          <Neighborhood>${escapeXml(config.officeLocation.neighborhood)}</Neighborhood>
          <Address>${escapeXml(config.officeLocation.address)}</Address>
          <StreetNumber>${escapeXml(config.officeLocation.streetNumber)}</StreetNumber>
          <PostalCode>${escapeXml(config.officeLocation.postalCode)}</PostalCode>
        </Location>
      </ContactInfo>
      <Media>
${mediaItemsXml}      </Media>
    </Listing>`;
}

class XmlFeedGenerator {
  constructor(customConfig = {}) {
    this.config = { ...DEFAULT_FEED_CONFIG, ...customConfig };
    this.memoryCache = null;
    this.memoryCacheTime = 0;
    this.isGenerating = false;
  }

  /**
   * Busca fotos para uma lista de códigos de imóveis no Supabase em lotes seguros
   */
  async loadPhotosMapForIds(propertyIds = []) {
    const photosMap = new Map();
    if (!propertyIds || propertyIds.length === 0) return photosMap;

    const batchSize = 60; // 60 imóveis por vez (~900 fotos por lote, seguro para limite de 1000)
    for (let i = 0; i < propertyIds.length; i += batchSize) {
      const batchIds = propertyIds.slice(i, i + batchSize);
      try {
        const { data, error } = await supabase
          .from('imovel_fotos')
          .select('codigo_imovel, url_original, destaque, ordem')
          .in('codigo_imovel', batchIds)
          .order('ordem', { ascending: true });

        if (error) {
          console.warn('⚠️ Aviso ao carregar lote de fotos no Supabase:', error.message);
          continue;
        }

        if (Array.isArray(data)) {
          for (const item of data) {
            const id = item.codigo_imovel;
            if (!photosMap.has(id)) {
              photosMap.set(id, []);
            }
            if (item.url_original) {
              if (item.destaque) {
                photosMap.get(id).unshift(item.url_original);
              } else {
                photosMap.get(id).push(item.url_original);
              }
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ Exceção ao carregar lote de fotos:', err.message);
      }
    }

    return photosMap;
  }

  /**
   * Consulta os imóveis ativos e prontos para publicação no Supabase
   */
  async fetchPublishableProperties(options = {}) {
    const { situacao = '1', limit = null, id = null } = options;

    let query = supabase
      .from('imoveis')
      .select('*')
      .eq('ativo', true)
      .eq('exibir_site', true);

    if (id) {
      query = query.eq('codigo_imovel', parseInt(id, 10));
    } else if (situacao && situacao !== 'all') {
      query = query.eq('situacao', String(situacao));
    }

    query = query.order('codigo_imovel', { ascending: false });

    if (limit && Number(limit) > 0) {
      query = query.limit(Number(limit));
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Falha ao consultar imóveis para o feed XML: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Gera o documento XML completo no padrão VivaReal / VRSync 1.0
   * @param {Array} properties Lista de imóveis (ou busca no Supabase se não fornecido)
   * @param {Object} options Filtros e configurações
   */
  async generateXml(properties = null, options = {}) {
    let list = properties;
    if (!list) {
      list = await this.fetchPublishableProperties(options);
    } else if (options.limit && Number(options.limit) > 0) {
      list = list.slice(0, Number(options.limit));
    }

    // Filtrar segurança: nunca expor imóveis com exibir_site=false ou ativo=false
    list = list.filter(item => {
      if (item.ativo === false) return false;
      if (item.exibir_site === false) return false;
      return true;
    });

    const propertyIds = list.map(p => p.codigo_imovel || p.id).filter(Boolean);
    const photosMap = await this.loadPhotosMapForIds(propertyIds);

    const publishDate = formatIso(new Date());

    let headerXml = `  <Header>
    <Provider>${escapeXml(this.config.provider)}</Provider>
    <Email>${escapeXml(this.config.email)}</Email>
    <ContactName>${escapeXml(this.config.contactName)}</ContactName>
    <Telephone>${escapeXml(this.config.telephone)}</Telephone>
    <PublishDate>${publishDate}</PublishDate>
    <Logo>${escapeXml(this.config.logo)}</Logo>
  </Header>`;

    let listingsXml = '';
    for (const item of list) {
      const id = item.codigo_imovel || item.id;
      const photos = photosMap.get(id) || [];
      listingsXml += renderListingXml(item, photos, this.config) + '\n';
    }

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
${headerXml}
  <Listings>
${listingsXml}  </Listings>
</ListingDataFeed>`;

    return {
      xml,
      count: list.length,
      publishDate
    };
  }

  /**
   * Obtém o XML gerado utilizando cache em memória ou disco se disponível e válido
   */
  async getFeedXml(options = {}) {
    const { force = false, limit = null, id = null } = options;
    const now = Date.now();

    // Se houver filtros específicos (limit, id), não grava no cache geral
    const isSpecificFilter = Boolean(limit || id);

    if (!force && !isSpecificFilter) {
      // 1. Checa cache em memória
      if (this.memoryCache && (now - this.memoryCacheTime) < this.config.cacheTtlMs) {
        return this.memoryCache;
      }

      // 2. Checa cache em disco
      try {
        if (fs.existsSync(this.config.cacheFilePath)) {
          const stats = fs.statSync(this.config.cacheFilePath);
          if ((now - stats.mtimeMs) < this.config.cacheTtlMs) {
            const cachedXml = fs.readFileSync(this.config.cacheFilePath, 'utf8');
            if (cachedXml && cachedXml.includes('</ListingDataFeed>')) {
              this.memoryCache = cachedXml;
              this.memoryCacheTime = stats.mtimeMs;
              return cachedXml;
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ Falha ao ler cache em disco do XML:', err.message);
      }
    }

    // 3. Gera novo XML
    const result = await this.generateXml(null, options);

    // Se for o feed geral completo, persiste no cache
    if (!isSpecificFilter) {
      this.memoryCache = result.xml;
      this.memoryCacheTime = now;

      try {
        const dir = path.dirname(this.config.cacheFilePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.config.cacheFilePath, result.xml, 'utf8');
      } catch (err) {
        console.warn('⚠️ Falha ao salvar cache do XML em disco:', err.message);
      }
    }

    return result.xml;
  }
}

const xmlFeedGenerator = new XmlFeedGenerator();

module.exports = {
  XmlFeedGenerator,
  xmlFeedGenerator,
  renderListingXml,
  escapeXml,
  escapeCdata,
  resolvePropertyType,
  resolveTransactionType,
  extractPropertyFeatures,
  DEFAULT_FEED_CONFIG
};
