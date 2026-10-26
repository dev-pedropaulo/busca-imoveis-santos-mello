const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabase');
const { buildPropertyWebsiteUrl } = require('./property-website-url');

/**
 * Mapeamento de Tipos de Imóveis para o padrão OpenNavent (XML ON / Imovelweb / Navent)
 * Estrutura: { idTipo, idSubTipo, tipo }
 */
const OPENNAVENT_TYPE_MAP = {
  // Residencial - Casas
  'casa': { idTipo: '1', idSubTipo: '5', tipo: 'Casa' },
  'casa de condominio': { idTipo: '1', idSubTipo: '6', tipo: 'Casa' },
  'casa de condomínio': { idTipo: '1', idSubTipo: '6', tipo: 'Casa' },
  'casa de vila': { idTipo: '1', idSubTipo: '7', tipo: 'Casa' },
  'sobrado': { idTipo: '1', idSubTipo: '33', tipo: 'Casa' },
  'sobrado em condomínio': { idTipo: '1', idSubTipo: '6', tipo: 'Casa' },
  'sobrado em condominio': { idTipo: '1', idSubTipo: '6', tipo: 'Casa' },

  // Residencial - Apartamentos
  'apartamento': { idTipo: '2', idSubTipo: '1', tipo: 'Apartamento' },
  'apto': { idTipo: '2', idSubTipo: '1', tipo: 'Apartamento' },
  'apartamento padrão': { idTipo: '2', idSubTipo: '1', tipo: 'Apartamento' },
  'apartamento padrao': { idTipo: '2', idSubTipo: '1', tipo: 'Apartamento' },
  'studio': { idTipo: '2', idSubTipo: '2', tipo: 'Apartamento' },
  'kitnet': { idTipo: '2', idSubTipo: '2', tipo: 'Apartamento' },
  'kitchenette': { idTipo: '2', idSubTipo: '2', tipo: 'Apartamento' },
  'loft': { idTipo: '2', idSubTipo: '3', tipo: 'Apartamento' },
  'flat': { idTipo: '2', idSubTipo: '4', tipo: 'Apartamento' },
  'cobertura': { idTipo: '2', idSubTipo: '26', tipo: 'Apartamento' },
  'duplex': { idTipo: '2', idSubTipo: '34', tipo: 'Apartamento' },
  'apartamento duplex': { idTipo: '2', idSubTipo: '34', tipo: 'Apartamento' },
  'triplex': { idTipo: '2', idSubTipo: '35', tipo: 'Apartamento' },
  'garden': { idTipo: '2', idSubTipo: '38', tipo: 'Apartamento' },

  // Terrenos e Lotes
  'terreno': { idTipo: '1003', idSubTipo: '8', tipo: 'Terreno' },
  'lote': { idTipo: '1003', idSubTipo: '8', tipo: 'Terreno' },
  'loteamento': { idTipo: '1003', idSubTipo: '9', tipo: 'Terreno' },
  'terreno em condomínio': { idTipo: '1003', idSubTipo: '9', tipo: 'Terreno' },
  'terreno em condominio': { idTipo: '1003', idSubTipo: '9', tipo: 'Terreno' },

  // Rural
  'chácara': { idTipo: '1004', idSubTipo: '10', tipo: 'Rural' },
  'chacara': { idTipo: '1004', idSubTipo: '10', tipo: 'Rural' },
  'sítio': { idTipo: '1004', idSubTipo: '11', tipo: 'Rural' },
  'sitio': { idTipo: '1004', idSubTipo: '11', tipo: 'Rural' },
  'fazenda': { idTipo: '1004', idSubTipo: '12', tipo: 'Rural' },

  // Comercial
  'box': { idTipo: '1005', idSubTipo: '14', tipo: 'Comercial' },
  'garagem': { idTipo: '1005', idSubTipo: '14', tipo: 'Comercial' },
  'prédio inteiro': { idTipo: '1005', idSubTipo: '15', tipo: 'Comercial' },
  'predio inteiro': { idTipo: '1005', idSubTipo: '15', tipo: 'Comercial' },
  'prédio': { idTipo: '1005', idSubTipo: '15', tipo: 'Comercial' },
  'predio': { idTipo: '1005', idSubTipo: '15', tipo: 'Comercial' },
  'edifício comercial': { idTipo: '1005', idSubTipo: '15', tipo: 'Comercial' },
  'conjunto comercial': { idTipo: '1005', idSubTipo: '16', tipo: 'Comercial' },
  'sala comercial': { idTipo: '1005', idSubTipo: '16', tipo: 'Comercial' },
  'sala': { idTipo: '1005', idSubTipo: '16', tipo: 'Comercial' },
  'casa comercial': { idTipo: '1005', idSubTipo: '17', tipo: 'Comercial' },
  'loja de shopping': { idTipo: '1005', idSubTipo: '18', tipo: 'Comercial' },
  'loja': { idTipo: '1005', idSubTipo: '19', tipo: 'Comercial' },
  'salão': { idTipo: '1005', idSubTipo: '19', tipo: 'Comercial' },
  'salao': { idTipo: '1005', idSubTipo: '19', tipo: 'Comercial' },
  'galpão': { idTipo: '1005', idSubTipo: '20', tipo: 'Comercial' },
  'galpao': { idTipo: '1005', idSubTipo: '20', tipo: 'Comercial' },
  'depósito': { idTipo: '1005', idSubTipo: '20', tipo: 'Comercial' },
  'deposito': { idTipo: '1005', idSubTipo: '20', tipo: 'Comercial' },
  'hotel': { idTipo: '1005', idSubTipo: '22', tipo: 'Comercial' }
};

/**
 * Mapeamento de comodidades e infraestrutura para IDs numéricos OpenNavent
 * 20xxx: Área privativa / comodidades da unidade
 * 10xxx / 30xxx: Áreas comuns / infraestrutura do condomínio
 */
const AMENITY_TAG_MAP = {
  // Privativas (20xxx)
  ar_condicionado: { id: '20012', nome: 'AREA_PRIVATIVA|AR_CONDICIONADO' },
  churrasqueira: { id: '20048', nome: 'AREA_PRIVATIVA|CHURRASQUEIRA' },
  closet: { id: '20050', nome: 'AREA_PRIVATIVA|CLOSET' },
  cozinha: { id: '20056', nome: 'AREA_PRIVATIVA|COZINHA' },
  dce: { id: '20062', nome: 'AREA_PRIVATIVA|DEPENDENCIA_DE_EMPREGADOS' },
  mobiliado: { id: '20126', nome: 'AREA_PRIVATIVA|MOBILIADO' },
  varanda_gourmet: { id: '20080', nome: 'AREA_PRIVATIVA|ESPACO_GOURMET' },
  varanda: { id: '20199', nome: 'AREA_PRIVATIVA|VARANDA' },
  area_servico: { id: '20017', nome: 'AREA_PRIVATIVA|AREA_DE_SERVICO' },
  lavabo: { id: '20115', nome: 'AREA_PRIVATIVA|LAVABO' },

  // Comuns / Infraestrutura (10xxx / 30xxx)
  portaria_24h: { id: '10158', nome: 'AREAS_COMUNS|PORTARIA_24H' },
  portao_eletronico: { id: '10030', nome: 'AREAS_COMUNS|SEGURANCA' },
  interfone: { id: '10103', nome: 'AREAS_COMUNS|INTERFONE' },
  elevador: { id: '10071', nome: 'AREAS_COMUNS|ELEVADOR' },
  aquecimento_solar: { id: '20011', nome: 'AREAS_COMUNS|AQUECIMENTO_CENTRAL' },
  academia: { id: '10090', nome: 'AREAS_COMUNS|ACADEMIA' },
  salao_festas: { id: '10181', nome: 'AREAS_COMUNS|SALAO_DE_FESTAS' },
  salao_jogos: { id: '10182', nome: 'AREAS_COMUNS|SALAO_DE_JOGOS' },
  playground: { id: '10152', nome: 'AREAS_COMUNS|PLAYGROUND' },
  quadra_poliesportiva: { id: '10165', nome: 'AREAS_COMUNS|QUADRA_POLIESPORTIVA' },
  piscina: { id: '30025', nome: 'AREAS_COMUNS|PISCINA' }
};

const DEFAULT_OPENNAVENT_CONFIG = {
  provider: 'Taime Pro',
  companyName: 'SANTOS E MELLO IMOVEIS LTDA',
  cnpj: '04.394.852/0001-61',
  email: 'Financeiro@santosemello.com.br',
  contactName: 'S & M / Taime Pro',
  telephone: '1144692121',
  codigoImobiliaria: '04394852000161', // Sucursal ou CNPJ sem formatação
  cacheTtlMs: 30 * 60 * 1000, // 30 minutos de cache
  cacheFilePath: path.join(__dirname, '..', 'data', 'feed-imovelweb.xml')
};

/**
 * Envolve conteúdo em bloco CDATA sanitizado
 */
function wrapCdata(str) {
  if (str === null || str === undefined) return '<![CDATA[]]>';
  const clean = String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return `<![CDATA[${clean.split(']]>').join(']]]]><![CDATA[>')}]]>`;
}

/**
 * Resolve o tipo e subtipo OpenNavent para o imóvel
 */
function resolveOpenNaventType(tipoImovel, destinacao) {
  const t = (tipoImovel || '').toLowerCase().trim();
  const isCom = (destinacao || '').toLowerCase().includes('comerc');

  if (OPENNAVENT_TYPE_MAP[t]) {
    return OPENNAVENT_TYPE_MAP[t];
  }

  for (const [key, val] of Object.entries(OPENNAVENT_TYPE_MAP)) {
    if (t.includes(key)) {
      return val;
    }
  }

  if (isCom) {
    return { idTipo: '1005', idSubTipo: '16', tipo: 'Comercial' };
  }

  return { idTipo: '2', idSubTipo: '1', tipo: 'Apartamento' };
}

/**
 * Renderiza um único imóvel no padrão <Imovel> do OpenNavent
 */
function renderOpenNaventImovelXml(imovel, photos = [], config = DEFAULT_OPENNAVENT_CONFIG) {
  const codigoAnuncio = String(imovel.codigo_imovel || imovel.id);
  const codigoReferencia = String(imovel.codigo_imovel || imovel.id);

  const { idTipo, idSubTipo, tipo } = resolveOpenNaventType(imovel.tipo_imovel, imovel.destinacao);

  const fin = (imovel.finalidade || '').toLowerCase();
  const valorVenda = Math.round(parseFloat(imovel.valor_venda) || 0);
  const valorLocacao = Math.round(parseFloat(imovel.valor_locacao) || 0);
  const valorCondo = Math.round(parseFloat(imovel.valor_condominio) || 0);
  const valorIptu = Math.round(parseFloat(imovel.valor_iptu) || 0);

  const isVenda = (valorVenda > 0) && (fin.includes('venda') || fin.includes('ambos') || valorLocacao <= 0);
  const isLocacao = (valorLocacao > 0) && (fin.includes('loca') || fin.includes('alug') || fin.includes('ambos') || valorVenda <= 0);

  // Bloco de Preços
  let precosXml = '';
  if (isVenda) {
    precosXml += `        <preco>\n          <operacao>${wrapCdata('VENTA')}</operacao>\n          <quantidade>${wrapCdata(valorVenda)}</quantidade>\n          <moeda>${wrapCdata('BRL')}</moeda>\n        </preco>\n`;
  }
  if (isLocacao) {
    precosXml += `        <preco>\n          <operacao>${wrapCdata('ALQUILER')}</operacao>\n          <quantidade>${wrapCdata(valorLocacao)}</quantidade>\n          <moeda>${wrapCdata('BRL')}</moeda>\n        </preco>\n`;
  }
  if (!isVenda && !isLocacao && valorVenda > 0) {
    precosXml += `        <preco>\n          <operacao>${wrapCdata('VENTA')}</operacao>\n          <quantidade>${wrapCdata(valorVenda)}</quantidade>\n          <moeda>${wrapCdata('BRL')}</moeda>\n        </preco>\n`;
  }

  // Título e Descrição
  const defaultTitle = `${imovel.tipo_imovel || 'Imóvel'} em ${imovel.bairro || 'Santo André'}`;
  const rawTitle = (imovel.titulo || defaultTitle).slice(0, 80);
  const rawDesc = imovel.descricao || imovel.titulo || defaultTitle;

  // Localização
  const bairro = (imovel.bairro || 'Centro').trim();
  const cidade = (imovel.cidade || 'Santo André').trim();
  const estado = (imovel.estado || 'SP').trim();
  const localidadeStr = `${bairro}, ${cidade}, ${estado}, Brasil`;

  const rua = (imovel.endereco || '').trim();
  const num = (imovel.numero || '').trim();
  const comp = (imovel.complemento || '').trim();
  let enderecoCompleto = rua;
  if (num) enderecoCompleto += `, ${num}`;
  if (comp) enderecoCompleto += ` - ${comp}`;

  const cep = (imovel.cep || '').toString().replace(/\D/g, '').padStart(8, '0');
  const lat = (imovel.latitude || '').toString().trim();
  const lng = (imovel.longitude || '').toString().trim();

  // Tipo de publicação
  const tipoPublicacao = imovel.exclusivo ? 'DESTACADO' : 'SIMPLE';

  // Fotos
  let mediaList = [];
  if (Array.isArray(photos) && photos.length > 0) {
    mediaList = photos;
  } else if (Array.isArray(imovel.images) && imovel.images.length > 0) {
    mediaList = imovel.images;
  } else if (imovel.foto_destaque) {
    mediaList = [imovel.foto_destaque];
  }
  mediaList = mediaList.filter(url => url && typeof url === 'string' && url.startsWith('http'));

  let imagensXml = '';
  mediaList.forEach((url, idx) => {
    const tituloFoto = idx === 0 ? 'Foto Principal' : `Foto ${idx + 1}`;
    imagensXml += `          <imagem>\n            <titulo>${wrapCdata(tituloFoto)}</titulo>\n            <urlImagem>${wrapCdata(url)}</urlImagem>\n          </imagem>\n`;
  });

  // Características (CFT)
  const quartos = parseInt(imovel.quartos, 10) || 0;
  const suites = parseInt(imovel.suites, 10) || 0;
  const banheiros = parseInt(imovel.banheiros, 10) || 0;
  const vagas = parseInt(imovel.vagas, 10) || 0;
  const areaUtil = Math.round(parseFloat(imovel.area_interna || imovel.area_privativa) || 0);
  const areaTotal = Math.round(parseFloat(imovel.area_externa || imovel.area_lote || areaUtil) || 0);

  let caracXml = '';
  if (quartos > 0) {
    caracXml += `        <caracteristica><id>${wrapCdata('CFT2')}</id><valor>${wrapCdata(quartos)}</valor></caracteristica>\n`;
  }
  if (banheiros > 0) {
    caracXml += `        <caracteristica><id>${wrapCdata('CFT3')}</id><valor>${wrapCdata(banheiros)}</valor></caracteristica>\n`;
  }
  if (suites > 0) {
    caracXml += `        <caracteristica><id>${wrapCdata('CFT4')}</id><valor>${wrapCdata(suites)}</valor></caracteristica>\n`;
  }
  if (vagas > 0) {
    caracXml += `        <caracteristica><id>${wrapCdata('CFT7')}</id><valor>${wrapCdata(vagas)}</valor></caracteristica>\n`;
  }
  if (areaUtil > 0) {
    caracXml += `        <caracteristica><id>${wrapCdata('CFT101')}</id><valor>${wrapCdata(areaUtil)}</valor></caracteristica>\n`;
  }
  if (areaTotal > 0) {
    caracXml += `        <caracteristica><id>${wrapCdata('CFT100')}</id><valor>${wrapCdata(areaTotal)}</valor></caracteristica>\n`;
  }
  if (areaUtil > 0 || areaTotal > 0) {
    caracXml += `        <caracteristica><id>${wrapCdata('CON1')}</id><idValor>${wrapCdata('M2')}</idValor></caracteristica>\n`;
  }
  if (valorCondo > 0) {
    caracXml += `        <caracteristica><id>${wrapCdata('CFT6')}</id><valor>${wrapCdata(valorCondo)}</valor></caracteristica>\n`;
  }
  if (valorIptu > 0) {
    caracXml += `        <caracteristica><id>${wrapCdata('CFT400')}</id><valor>${wrapCdata(valorIptu)}</valor></caracteristica>\n`;
  }

  // Tags booleanas de comodidades e infraestrutura (id + idValor)
  for (const [propKey, tagInfo] of Object.entries(AMENITY_TAG_MAP)) {
    if (imovel[propKey] === true || imovel[propKey] === 1 || imovel[propKey] === '1') {
      caracXml += `        <caracteristica><id>${wrapCdata(tagInfo.id)}</id><idValor>${wrapCdata('1')}</idValor></caracteristica>\n`;
    }
  }

  return `    <Imovel>
      <codigoAnuncio>${wrapCdata(codigoAnuncio)}</codigoAnuncio>
      <codigoReferencia>${wrapCdata(codigoReferencia)}</codigoReferencia>
      <titulo>${wrapCdata(rawTitle)}</titulo>
      <descricao>${wrapCdata(rawDesc)}</descricao>
      <tipoPropriedade>
        <idTipo>${wrapCdata(idTipo)}</idTipo>
        <idSubTipo>${wrapCdata(idSubTipo)}</idSubTipo>
        <tipo>${wrapCdata(tipo)}</tipo>
      </tipoPropriedade>
      <caracteristicas>
${caracXml}      </caracteristicas>
      <precos>
${precosXml}      </precos>
      <multimidia>
        <imagens>
${imagensXml}        </imagens>
      </multimidia>
      <localizacao>
        <endereco>${wrapCdata(enderecoCompleto)}</endereco>
        <localidade>${wrapCdata(localidadeStr)}</localidade>
${lat ? `        <latitude>${wrapCdata(lat)}</latitude>\n` : ''}${lng ? `        <longitude>${wrapCdata(lng)}</longitude>\n` : ''}        <mostrarMapa>${wrapCdata('APROXIMADO')}</mostrarMapa>
        <codigoPostal>${wrapCdata(cep)}</codigoPostal>
      </localizacao>
      <publicacao>
        <tipoPublicacao>${wrapCdata(tipoPublicacao)}</tipoPublicacao>
      </publicacao>
      <publicador>
        <codigoImobiliaria>${wrapCdata(config.codigoImobiliaria)}</codigoImobiliaria>
        <emailUsuario>${wrapCdata(config.email)}</emailUsuario>
        <emailContato>${wrapCdata(config.email)}</emailContato>
        <nomeContato>${wrapCdata(config.contactName)}</nomeContato>
        <telefoneContato>${wrapCdata(config.telephone)}</telefoneContato>
      </publicador>
    </Imovel>`;
}

class OpenNaventFeedGenerator {
  constructor(customConfig = {}) {
    this.config = { ...DEFAULT_OPENNAVENT_CONFIG, ...customConfig };
    this.memoryCache = null;
    this.memoryCacheTime = 0;
  }

  /**
   * Carrega mapa de fotos ordenadas por código de imóvel
   */
  async loadPhotosMapForIds(propertyIds = []) {
    const photosMap = new Map();
    if (!propertyIds || propertyIds.length === 0) return photosMap;

    const batchSize = 60;
    for (let i = 0; i < propertyIds.length; i += batchSize) {
      const batchIds = propertyIds.slice(i, i + batchSize);
      try {
        const { data, error } = await supabase
          .from('imovel_fotos')
          .select('codigo_imovel, url_original, destaque, ordem')
          .in('codigo_imovel', batchIds)
          .order('ordem', { ascending: true });

        if (error) {
          console.warn('⚠️ [OpenNavent] Aviso ao carregar lote de fotos:', error.message);
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
        console.warn('⚠️ [OpenNavent] Exceção ao carregar lote de fotos:', err.message);
      }
    }

    return photosMap;
  }

  /**
   * Consulta os imóveis no Supabase
   * Se isTest=true, traz uma amostra seleta de 10 a 15 imóveis com fotos e dados completos
   */
  async fetchProperties(options = {}) {
    const { limit = null, id = null, isTest = false } = options;

    let query = supabase
      .from('imoveis')
      .select('*')
      .eq('ativo', true)
      .eq('exibir_site', true);

    if (id) {
      query = query.eq('codigo_imovel', parseInt(id, 10));
    }

    // Se for modo teste para homologação da Navent / Imovelweb
    if (isTest) {
      query = query
        .not('foto_destaque', 'is', null)
        .order('codigo_imovel', { ascending: true })
        .limit(Number(limit) || 12);
    } else {
      query = query.order('codigo_imovel', { ascending: false });
      if (limit && Number(limit) > 0) {
        query = query.limit(Number(limit));
      }
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Falha ao consultar imóveis para o feed OpenNavent: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Gera o documento completo XML OpenNavent (<OpenNavent>)
   */
  async generateXml(properties = null, options = {}) {
    let list = properties;
    if (!list) {
      list = await this.fetchProperties(options);
    } else if (options.limit && Number(options.limit) > 0) {
      list = list.slice(0, Number(options.limit));
    }

    // Filtro de segurança
    list = list.filter(item => item.ativo !== false && item.exibir_site !== false);

    const propertyIds = list.map(p => p.codigo_imovel || p.id).filter(Boolean);
    const photosMap = await this.loadPhotosMapForIds(propertyIds);

    const nowUnix = Math.floor(Date.now() / 1000).toString();
    const config = {
      ...this.config,
      codigoImobiliaria: options.sucursal || this.config.codigoImobiliaria
    };

    let imoveisXml = '';
    for (const item of list) {
      const id = item.codigo_imovel || item.id;
      const photos = photosMap.get(id) || [];
      imoveisXml += renderOpenNaventImovelXml(item, photos, config) + '\n';
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenNavent>
  <dataModificacao>${wrapCdata(nowUnix)}</dataModificacao>
  <Imoveis>
${imoveisXml}  </Imoveis>
</OpenNavent>`;

    return {
      xml,
      count: list.length,
      dataModificacao: nowUnix
    };
  }

  /**
   * Retorna o feed XML com cache inteligente
   */
  async getFeedXml(options = {}) {
    const { force = false, limit = null, id = null, isTest = false } = options;
    const now = Date.now();
    const isSpecificFilter = Boolean(limit || id || isTest);

    if (!force && !isSpecificFilter) {
      if (this.memoryCache && (now - this.memoryCacheTime) < this.config.cacheTtlMs) {
        return this.memoryCache;
      }

      try {
        if (fs.existsSync(this.config.cacheFilePath)) {
          const stats = fs.statSync(this.config.cacheFilePath);
          if ((now - stats.mtimeMs) < this.config.cacheTtlMs) {
            const cachedXml = fs.readFileSync(this.config.cacheFilePath, 'utf8');
            if (cachedXml && cachedXml.includes('</OpenNavent>')) {
              this.memoryCache = cachedXml;
              this.memoryCacheTime = stats.mtimeMs;
              return cachedXml;
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ [OpenNavent] Falha ao ler cache em disco:', err.message);
      }
    }

    const result = await this.generateXml(null, options);

    if (!isSpecificFilter) {
      this.memoryCache = result.xml;
      this.memoryCacheTime = now;
      try {
        const dir = path.dirname(this.config.cacheFilePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.config.cacheFilePath, result.xml, 'utf8');
      } catch (err) {
        console.warn('⚠️ [OpenNavent] Falha ao salvar cache em disco:', err.message);
      }
    }

    return result.xml;
  }
}

const openNaventFeedGenerator = new OpenNaventFeedGenerator();

module.exports = {
  OpenNaventFeedGenerator,
  openNaventFeedGenerator,
  renderOpenNaventImovelXml,
  resolveOpenNaventType,
  wrapCdata,
  OPENNAVENT_TYPE_MAP,
  AMENITY_TAG_MAP,
  DEFAULT_OPENNAVENT_CONFIG
};
