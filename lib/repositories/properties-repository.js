const { supabase } = require('../supabase');
const { buildPropertyWebsiteUrl } = require('../property-website-url');
const { crmStore } = require('../crm-store');

function cleanText(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function extractFeatures(row) {
  const feats = [];
  if (row.portaria_24h) feats.push('Portaria 24h');
  if (row.portao_eletronico) feats.push('Portão Eletrônico');
  if (row.interfone) feats.push('Interfone');
  if (row.elevador) feats.push('Elevador');
  if (row.ar_condicionado) feats.push('Ar Condicionado');
  if (row.aquecimento_solar) feats.push('Aquecimento Solar');
  if (row.area_servico) feats.push('Área de Serviço');
  if (row.varanda_gourmet) feats.push('Varanda Gourmet');
  if (row.closet) feats.push('Closet');
  if (row.dce) feats.push('Dep. Empregada');
  if (row.lavabo) feats.push('Lavabo');
  if (row.mobiliado) feats.push('Mobiliado');
  if (row.aceita_financiamento) feats.push('Aceita Financiamento');
  if (row.aceita_permuta) feats.push('Aceita Permuta');
  return feats;
}

function formatAddress(row) {
  const parts = [];
  if (row.endereco) {
    let street = row.endereco;
    if (row.numero && !row.numero.includes('*')) street += `, ${row.numero}`;
    if (row.complemento && !row.complemento.includes('*')) street += ` - ${row.complemento}`;
    parts.push(street);
  }
  if (row.bairro) parts.push(row.bairro);
  parts.push(`${row.cidade || 'Santo André'} - ${row.estado || 'SP'}`);
  if (row.cep && row.cep !== '00000-000') parts.push(`CEP ${row.cep}`);
  return parts.join(', ');
}

function mapDatabaseToProperty(row, galleryUrls = []) {
  if (!row) return null;
  const listingId = String(row.codigo_imovel);

  let transactionType = 'Venda';
  const fin = (row.finalidade || '').toLowerCase();
  if (fin.includes('aluguel') || fin.includes('loca')) {
    transactionType = 'Locação';
  } else if (fin.includes('ambos') || (row.valor_venda > 0 && row.valor_locacao > 0)) {
    transactionType = 'Venda / Locação';
  }

  const title = row.titulo || `${row.tipo_imovel || 'Imóvel'} para ${transactionType} em ${row.bairro || 'Santo André'}`;
  const enderecoCompleto = formatAddress(row);
  
  const primaryImage = row.foto_destaque || galleryUrls[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';
  const images = galleryUrls.length > 0 ? galleryUrls : (row.foto_destaque ? [row.foto_destaque] : [primaryImage]);

  const override = crmStore.getPropertyOverride(listingId) || {};
  if (override.deleted) return null;

  return {
    id: listingId,
    title,
    transactionType,
    propertyType: row.tipo_imovel || 'Imóvel',
    usageType: row.destinacao || 'Residencial',
    price: parseFloat(row.valor_venda) || 0,
    rentalPrice: parseFloat(row.valor_locacao) || 0,
    iptu: parseFloat(row.valor_iptu) || 0,
    condo: parseFloat(row.valor_condominio) || 0,
    livingArea: parseFloat(row.area_interna || row.area_privativa) || 0,
    constructedArea: parseFloat(row.area_lote || row.area_externa) || 0,
    lotArea: parseFloat(row.area_lote) || 0,
    bedrooms: parseInt(row.quartos, 10) || 0,
    bathrooms: parseInt(row.banheiros, 10) || 0,
    suites: parseInt(row.suites, 10) || 0,
    garage: parseInt(row.vagas, 10) || 0,
    description: row.descricao || '',
    features: extractFeatures(row),
    location: {
      address: row.endereco || '',
      streetNumber: row.numero || '',
      complement: row.complemento || '',
      neighborhood: row.bairro || 'Santo André',
      city: row.cidade || 'Santo André',
      state: row.estado || 'SP',
      postalCode: row.cep || '',
      latitude: row.latitude ? String(row.latitude) : '',
      longitude: row.longitude ? String(row.longitude) : '',
      enderecoCompleto
    },
    endereco: row.endereco || '',
    numero: row.numero || '',
    complemento: row.complemento || '',
    bairro: row.bairro || 'Santo André',
    cidade: row.cidade || 'Santo André',
    estado: row.estado || 'SP',
    cep: row.cep || '',
    enderecoCompleto,
    images,
    primaryImage,
    websiteUrl: buildPropertyWebsiteUrl(title, listingId),
    virtualTourLink: '',
    status: override.status || row.situacao || 'Disponível',
    kanbanStage: override.kanbanStage || 'disponivel',
    keyTag: override.keyTag || row.codigo_chave || `CLAV-${listingId}`,
    localChave: row.local_chave || 'Imobiliária',
    codigoCondominio: row.codigo_condominio,
    nomeCondominio: row.nome_condominio
  };
}

class PropertiesRepository {
  constructor() {
    this.cachedList = [];
    this.cachedMap = new Map();
    this.metadata = {
      provider: 'Santos & Mello (Banco Proprietário Supabase)',
      lastSync: null,
      total: 0,
      totalRent: 0,
      totalSale: 0,
      logo: 'https://cdn.imoview.com.br/santosemello/logo-1771518225.png',
      phone: '1144692121'
    };
  }

  async loadAllProperties() {
    console.log('🔄 Carregando catálogo de imóveis do banco de dados Supabase...');
    const startTime = Date.now();

    // Consulta paginada em paralelo para performance máxima
    const batchPromises = [];
    for (let offset = 0; offset < 15000; offset += 1000) {
      batchPromises.push(
        supabase
          .from('imoveis')
          .select('*')
          .eq('ativo', true)
          .range(offset, offset + 999)
      );
    }

    const results = await Promise.all(batchPromises);
    const allDbRows = [];
    for (const r of results) {
      if (r.data && r.data.length > 0) {
        allDbRows.push(...r.data);
      }
    }

    const newMap = new Map();
    const newList = [];
    let countRent = 0;
    let countSale = 0;

    for (const row of allDbRows) {
      const prop = mapDatabaseToProperty(row);
      if (prop && prop.id) {
        newMap.set(prop.id.toLowerCase(), prop);
        newList.push(prop);

        const t = (prop.transactionType || '').toLowerCase();
        if (t.includes('locação') || t.includes('locacao') || t.includes('rent')) countRent++;
        if (t.includes('venda') || t.includes('sale')) countSale++;
      }
    }

    this.cachedMap = newMap;
    this.cachedList = newList;
    this.metadata.lastSync = new Date().toISOString();
    this.metadata.total = newList.length;
    this.metadata.totalRent = countRent;
    this.metadata.totalSale = countSale;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Catálogo Supabase carregado em ${duration}s! ${this.metadata.total} imóveis ativos (${countRent} locação, ${countSale} venda).`);

    return {
      success: true,
      count: this.metadata.total,
      totalRent: countRent,
      totalSale: countSale,
      lastSync: this.metadata.lastSync
    };
  }

  getPropertiesList() {
    return this.cachedList;
  }

  getPropertiesMap() {
    return this.cachedMap;
  }

  getMetadata() {
    return this.metadata;
  }

  async getPropertyById(id) {
    if (!id) return null;
    const cleanId = String(id).trim().toLowerCase();
    
    // 1. Tenta recuperar do cache em memória
    let prop = this.cachedMap.get(cleanId);
    
    // 2. Se for número e não estiver com galeria completa no cache, busca fotos do Supabase
    const numId = parseInt(cleanId, 10);
    if (!isNaN(numId)) {
      const { data: dbProp } = await supabase
        .from('imoveis')
        .select('*, imovel_fotos(url_original, url_propria, ordem, destaque), imovel_proprietarios(percentual_participacao, pessoas(codigo_pessoa, nome, cpf_cnpj)), imovel_captadores(percentual_comissao, principal, pessoas(codigo_pessoa, nome, cpf_cnpj))')
        .eq('codigo_imovel', numId)
        .single();

      if (dbProp) {
        const sortedFotos = (dbProp.imovel_fotos || []).sort((a, b) => a.ordem - b.ordem);
        const gallery = sortedFotos.map(f => f.url_propria || f.url_original);
        prop = mapDatabaseToProperty(dbProp, gallery);

        // Adiciona dados proprietários e captadores caso existam
        if (prop) {
          prop.proprietarios = (dbProp.imovel_proprietarios || []).map(p => ({
            codigo: p.pessoas?.codigo_pessoa,
            nome: p.pessoas?.nome,
            cpfCnpj: p.pessoas?.cpf_cnpj,
            percentual: p.percentual_participacao
          }));
          prop.captadores = (dbProp.imovel_captadores || []).map(c => ({
            codigo: c.pessoas?.codigo_pessoa,
            nome: c.pessoas?.nome,
            cpfCnpj: c.pessoas?.cpf_cnpj,
            comissao: c.percentual_comissao,
            principal: c.principal
          }));
        }
      }
    }

    return prop || null;
  }
}

const propertiesRepository = new PropertiesRepository();

module.exports = {
  propertiesRepository,
  mapDatabaseToProperty
};
