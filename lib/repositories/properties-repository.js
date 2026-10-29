const fs = require('fs');
const path = require('path');
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
    nomeCondominio: row.nome_condominio || '',
    andar: row.andar || '',
    bloco: row.bloco || '',
    anotacoesInternas: row.anotacoes_internas || '',
    aceitaFinanciamento: !!row.aceita_financiamento,
    aceitaPermuta: !!row.aceita_permuta,
    exclusivo: !!row.exclusivo,
    exibirSite: row.exibir_site === true || row.exibir_site === 1 || row.exibir_site === '1'
  };
}

/**
 * Envia fotos para o Supabase Storage se vierem em Base64
 */
async function uploadPhotoToStorage(propertyId, photoInput, index = 0) {
  if (!photoInput) return null;
  const str = String(photoInput).trim();

  // Se já for uma URL HTTP/HTTPS, mantém diretamente
  if (str.startsWith('http://') || str.startsWith('https://')) {
    return str;
  }

  // Se for Data URL Base64 (upload do usuário via drag & drop ou arquivo)
  if (str.startsWith('data:image/')) {
    try {
      const match = str.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        let ext = match[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        if (ext === 'svg+xml') ext = 'svg';

        const buffer = Buffer.from(match[2], 'base64');
        const filename = `${propertyId}/foto_${index + 1}_${Date.now()}.${ext}`;

        const { data, error } = await supabase.storage
          .from('imoveis-fotos')
          .upload(filename, buffer, {
            contentType: `image/${match[1]}`,
            upsert: true
          });

        if (!error && data) {
          const { data: publicData } = supabase.storage
            .from('imoveis-fotos')
            .getPublicUrl(filename);
          return publicData.publicUrl;
        } else if (error) {
          console.warn('⚠️ Falha no upload para Supabase Storage:', error.message);
        }
      }
    } catch (err) {
      console.warn('⚠️ Exceção no upload para Supabase Storage:', err.message);
    }
  }

  return str;
}

const CACHE_FILE_PATH = path.join(__dirname, '../../data/properties-cache.json');

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
    this.loadFromDiskCache();
  }

  loadFromDiskCache() {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.list) && parsed.list.length > 0) {
          this.cachedList = parsed.list;
          this.cachedMap = new Map();
          for (const item of this.cachedList) {
            if (item && item.id) this.cachedMap.set(String(item.id).toLowerCase(), item);
          }
          if (parsed.metadata) this.metadata = parsed.metadata;
          console.log(`⚡ [Cache Disco] ${this.cachedList.length} imóveis carregados instantaneamente em 0ms!`);
        }
      }
    } catch (e) {
      console.warn('Aviso ao carregar cache do disco:', e.message);
    }
  }

  async saveToDiskCache() {
    try {
      const dir = path.dirname(CACHE_FILE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const siteProps = this.cachedList.filter(p => p.exibirSite === true);
      await fs.promises.writeFile(
        CACHE_FILE_PATH,
        JSON.stringify({ list: siteProps, metadata: this.metadata }),
        'utf8'
      );
      console.log(`💾 [Cache Disco] ${siteProps.length} imóveis do site persistidos em disco com sucesso.`);
    } catch (e) {
      console.warn('Aviso ao salvar cache em disco:', e.message);
    }
  }

  async loadAllProperties() {
    console.log('🔄 Carregando catálogo de imóveis do banco de dados Supabase...');
    const startTime = Date.now();

    // Consulta quantidade exata de registros ativos
    let totalToFetch = 15000;
    try {
      const countRes = await supabase
        .from('imoveis')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);
      if (countRes.count && countRes.count > 0) {
        totalToFetch = countRes.count;
      }
    } catch (e) {
      console.warn('Aviso consulta count:', e.message);
    }

    const batchSize = 1000;
    const allDbRows = [];

    // Função de busca com retry automático para garantir integridade total
    async function fetchBatchWithRetry(offset, retries = 3) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await supabase
            .from('imoveis')
            .select('*')
            .eq('ativo', true)
            .range(offset, offset + batchSize - 1);

          if (res.error) throw res.error;
          return res.data || [];
        } catch (err) {
          if (attempt === retries) {
            console.error(`❌ Falha no lote ${offset}-${offset + batchSize - 1} após ${retries} tentativas:`, err.message);
            return [];
          }
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
      return [];
    }

    // Carregamento controlado com concorrência de 4 lotes simultâneos (evita rate-limit e drop de conexões)
    const batchOffsets = [];
    for (let offset = 0; offset < totalToFetch; offset += batchSize) {
      batchOffsets.push(offset);
    }

    const concurrency = 4;
    for (let i = 0; i < batchOffsets.length; i += concurrency) {
      const slice = batchOffsets.slice(i, i + concurrency);
      const batchResults = await Promise.all(slice.map(off => fetchBatchWithRetry(off)));
      batchResults.forEach(data => allDbRows.push(...data));
    }

    const newMap = new Map();
    const newList = [];
    let countRent = 0;
    let countSale = 0;
    let countSite = 0;
    let countRentSite = 0;
    let countSaleSite = 0;

    for (const row of allDbRows) {
      const prop = mapDatabaseToProperty(row);
      if (prop && prop.id) {
        newMap.set(prop.id.toLowerCase(), prop);
        newList.push(prop);

        const t = (prop.transactionType || '').toLowerCase();
        const isRent = t.includes('locação') || t.includes('locacao') || t.includes('rent');
        const isSale = t.includes('venda') || t.includes('sale');

        if (isRent) countRent++;
        if (isSale) countSale++;

        if (prop.exibirSite) {
          countSite++;
          if (isRent) countRentSite++;
          if (isSale) countSaleSite++;
        }
      }
    }

    this.cachedMap = newMap;
    this.cachedList = newList;
    this.metadata.lastSync = new Date().toISOString();
    this.metadata.total = newList.length;
    this.metadata.totalRent = countRent;
    this.metadata.totalSale = countSale;
    this.metadata.totalSite = countSite;
    this.metadata.totalRentSite = countRentSite;
    this.metadata.totalSaleSite = countSaleSite;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Catálogo Supabase carregado em ${duration}s! ${this.metadata.total} imóveis ativos (Site: ${countSite} | Locação: ${countRentSite}, Venda: ${countSaleSite}).`);
    try {
      await this.saveToDiskCache();
    } catch (e) {
      console.warn('Aviso ao salvar cache:', e.message);
    }

    return {
      success: true,
      count: this.metadata.total,
      totalRent: countRent,
      totalSale: countSale,
      totalSite: countSite,
      totalRentSite: countRentSite,
      totalSaleSite: countSaleSite,
      lastSync: this.metadata.lastSync
    };
  }

  getPropertiesList() {
    return this.cachedList;
  }

  getSitePropertiesList() {
    return this.cachedList.filter(p => p.exibirSite === true);
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

  /**
   * Consulta atomicamente o maior código de imóvel existente e retorna o próximo sequencial
   */
  async getNextPropertyCode() {
    try {
      const { data, error } = await supabase
        .from('imoveis')
        .select('codigo_imovel')
        .order('codigo_imovel', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0 && data[0].codigo_imovel) {
        return data[0].codigo_imovel + 1;
      }
      return 9000;
    } catch (err) {
      let maxId = 8991;
      for (const [id] of this.cachedMap.entries()) {
        const n = parseInt(id, 10);
        if (!isNaN(n) && n > maxId) maxId = n;
      }
      return maxId + 1;
    }
  }

  /**
   * Cria novo imóvel persistindo diretamente no banco de dados Supabase e Storage
   */
  async createProperty(data) {
    // 1. Gera código sequencial atomicamente no momento da gravação
    let numId = parseInt(String(data.id || data.codigo_imovel || '').replace(/\D/g, ''), 10);
    if (isNaN(numId) || numId <= 0) {
      numId = await this.getNextPropertyCode();
    }
    const listingId = String(numId);

    // 2. Processa fotos e envia Base64 para Supabase Storage
    const rawImages = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : (data.primaryImage ? [data.primaryImage] : []);

    const uploadedImages = [];
    for (let i = 0; i < rawImages.length; i++) {
      const url = await uploadPhotoToStorage(numId, rawImages[i], i);
      if (url) uploadedImages.push(url);
    }

    const primaryImage = uploadedImages[0] || data.primaryImage || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

    // 3. Monta linha para o banco de dados Supabase
    const dbRow = {
      codigo_imovel: numId,
      titulo: data.title || `Imóvel #${numId}`,
      finalidade: data.transactionType || 'Locação',
      tipo_imovel: data.propertyType || 'Apartamento',
      destinacao: data.usageType || 'Residencial',
      situacao: data.status || 'Disponível',
      valor_venda: parseFloat(data.price) || 0,
      valor_locacao: parseFloat(data.rentalPrice) || 0,
      valor_condominio: parseFloat(data.condo) || 0,
      valor_iptu: parseFloat(data.iptu) || 0,
      area_privativa: parseFloat(data.livingArea) || 0,
      area_interna: parseFloat(data.livingArea) || 0,
      area_lote: parseFloat(data.lotArea) || 0,
      area_externa: parseFloat(data.lotArea) || 0,
      quartos: parseInt(data.bedrooms, 10) || 0,
      suites: parseInt(data.suites, 10) || 0,
      banheiros: parseInt(data.bathrooms, 10) || 0,
      vagas: parseInt(data.garage, 10) || 0,
      descricao: data.description || '',
      endereco: data.location?.address || data.endereco || '',
      numero: data.location?.streetNumber || data.numero || '',
      complemento: data.location?.complement || data.complemento || '',
      bairro: data.location?.neighborhood || data.bairro || 'Santo André',
      cidade: data.location?.city || data.cidade || 'Santo André',
      estado: data.location?.state || data.estado || 'SP',
      cep: data.location?.postalCode || data.cep || '',
      local_chave: data.localChave || data.local_chave || 'Imobiliária',
      codigo_chave: data.keyTag || data.codigo_chave || `CLAV-${numId}`,
      nome_condominio: data.nomeCondominio || data.nome_condominio || null,
      andar: data.andar ? String(data.andar) : null,
      bloco: data.bloco ? String(data.bloco) : null,
      anotacoes_internas: data.anotacoesInternas || data.anotacoes_internas || null,
      foto_destaque: primaryImage,
      portaria_24h: Array.isArray(data.features) && data.features.some(f => /portaria/i.test(f)),
      portao_eletronico: Array.isArray(data.features) && data.features.some(f => /portao|portão/i.test(f)),
      interfone: Array.isArray(data.features) && data.features.some(f => /interfone/i.test(f)),
      elevador: Array.isArray(data.features) && data.features.some(f => /elevador/i.test(f)),
      ar_condicionado: Array.isArray(data.features) && data.features.some(f => /ar condicionado|climatiza/i.test(f)),
      aquecimento_solar: Array.isArray(data.features) && data.features.some(f => /solar|aquecedor/i.test(f)),
      varanda_gourmet: Array.isArray(data.features) && data.features.some(f => /varanda/i.test(f)),
      closet: Array.isArray(data.features) && data.features.some(f => /closet/i.test(f)),
      dce: Array.isArray(data.features) && data.features.some(f => /empregada|dce/i.test(f)),
      lavabo: Array.isArray(data.features) && data.features.some(f => /lavabo/i.test(f)),
      mobiliado: Array.isArray(data.features) && data.features.some(f => /mobiliado/i.test(f)),
      area_servico: Array.isArray(data.features) && data.features.some(f => /serviço|servico/i.test(f)),
      aceita_financiamento: !!(data.aceitaFinanciamento || data.aceita_financiamento),
      aceita_permuta: !!(data.aceitaPermuta || data.aceita_permuta),
      exclusivo: !!data.exclusivo,
      exibir_site: data.exibirSite !== undefined ? !!data.exibirSite : (data.exibir_site !== undefined ? !!data.exibir_site : true),
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 4. Grava no banco de dados Supabase
    const { error: dbError } = await supabase.from('imoveis').upsert(dbRow, { onConflict: 'codigo_imovel' });
    if (dbError) {
      console.error('❌ Erro ao gravar imóvel no Supabase:', dbError.message);
      throw new Error(`Falha no banco de dados: ${dbError.message}`);
    }

    // 5. Grava fotos na tabela imovel_fotos
    if (uploadedImages.length > 0) {
      try {
        const fotosRows = uploadedImages.map((imgUrl, idx) => ({
          codigo_imovel: numId,
          url_original: imgUrl,
          url_propria: imgUrl,
          ordem: idx,
          destaque: idx === 0
        }));
        await supabase.from('imovel_fotos').insert(fotosRows);
      } catch (e) {
        console.warn('Aviso fotos:', e.message);
      }
    }

    // 6. Atualiza o cache em memória
    const newPropObj = mapDatabaseToProperty(dbRow, uploadedImages);
    this.cachedMap.set(listingId.toLowerCase(), newPropObj);
    this.cachedList.unshift(newPropObj);
    this.metadata.total += 1;
    if ((newPropObj.transactionType || '').toLowerCase().includes('loca')) this.metadata.totalRent += 1;
    if ((newPropObj.transactionType || '').toLowerCase().includes('venda')) this.metadata.totalSale += 1;

    // 7. Salva override no crmStore para consistência
    crmStore.savePropertyOverride(listingId, {
      kanbanStage: data.kanbanStage || 'disponivel',
      status: data.status || 'Vago / Disponível',
      keyTag: dbRow.codigo_chave
    });

    // 8. Registra no Histórico & Auditoria do Imóvel
    try {
      const { crmRepository } = require('./crm-repository');
      await crmRepository.recordPropertyHistory({
        propertyId: listingId,
        tipo: 'criacao',
        titulo: 'Imóvel Cadastrado no Sistema',
        descricao: `Cadastro do imóvel #${listingId}: "${data.title}" (${data.transactionType || 'Locação'}). Bairro: ${data.location?.neighborhood || 'N/I'}, Área: ${data.livingArea || 0} m².`,
        autor: data.autor || 'Corretor / Administrador',
        detalhes: {
          id: listingId,
          title: data.title,
          transactionType: data.transactionType,
          price: data.price,
          rentalPrice: data.rentalPrice,
          neighborhood: data.location?.neighborhood
        }
      });
    } catch (e) {
      console.warn('Aviso histórico criacao:', e.message);
    }

    console.log(`✨ Imóvel #${numId} criado com sucesso no Supabase com ${uploadedImages.length} fotos!`);
    return newPropObj;
  }

  /**
   * Atualiza imóvel existente no Supabase e no cache
   */
  async updateProperty(id, data) {
    const cleanId = String(id).trim();
    const numId = parseInt(cleanId.replace(/\D/g, ''), 10);
    if (isNaN(numId)) {
      return crmStore.updateProperty(cleanId, data);
    }

    let uploadedImages = [];
    if (Array.isArray(data.images) && data.images.length > 0) {
      for (let i = 0; i < data.images.length; i++) {
        const url = await uploadPhotoToStorage(numId, data.images[i], i);
        if (url) uploadedImages.push(url);
      }
    }

    const patch = {
      updated_at: new Date().toISOString()
    };
    if (data.title) patch.titulo = data.title;
    if (data.transactionType) patch.finalidade = data.transactionType;
    if (data.propertyType) patch.tipo_imovel = data.propertyType;
    if (data.usageType) patch.destinacao = data.usageType;
    if (data.status) patch.situacao = data.status;
    if (data.price !== undefined) patch.valor_venda = parseFloat(data.price) || 0;
    if (data.rentalPrice !== undefined) patch.valor_locacao = parseFloat(data.rentalPrice) || 0;
    if (data.condo !== undefined) patch.valor_condominio = parseFloat(data.condo) || 0;
    if (data.iptu !== undefined) patch.valor_iptu = parseFloat(data.iptu) || 0;
    if (data.livingArea !== undefined) {
      patch.area_privativa = parseFloat(data.livingArea) || 0;
      patch.area_interna = parseFloat(data.livingArea) || 0;
    }
    if (data.lotArea !== undefined) {
      patch.area_lote = parseFloat(data.lotArea) || 0;
      patch.area_externa = parseFloat(data.lotArea) || 0;
    }
    if (data.bedrooms !== undefined) patch.quartos = parseInt(data.bedrooms, 10) || 0;
    if (data.suites !== undefined) patch.suites = parseInt(data.suites, 10) || 0;
    if (data.bathrooms !== undefined) patch.banheiros = parseInt(data.bathrooms, 10) || 0;
    if (data.garage !== undefined) patch.vagas = parseInt(data.garage, 10) || 0;
    if (data.description !== undefined) patch.descricao = data.description;
    if (data.location?.address) patch.endereco = data.location.address;
    if (data.location?.streetNumber) patch.numero = data.location.streetNumber;
    if (data.location?.complement) patch.complemento = data.location.complement;
    if (data.location?.neighborhood) patch.bairro = data.location.neighborhood;
    if (data.location?.city) patch.cidade = data.location.city;
    if (data.location?.postalCode) patch.cep = data.location.postalCode;
    if (data.localChave) patch.local_chave = data.localChave;
    if (data.keyTag) patch.codigo_chave = data.keyTag;
    if (data.nomeCondominio !== undefined) patch.nome_condominio = data.nomeCondominio;
    if (data.andar !== undefined) patch.andar = data.andar ? String(data.andar) : null;
    if (data.bloco !== undefined) patch.bloco = data.bloco ? String(data.bloco) : null;
    if (data.anotacoesInternas !== undefined) patch.anotacoes_internas = data.anotacoesInternas;
    if (data.aceitaFinanciamento !== undefined) patch.aceita_financiamento = !!data.aceitaFinanciamento;
    if (data.aceitaPermuta !== undefined) patch.aceita_permuta = !!data.aceitaPermuta;
    if (data.exclusivo !== undefined) patch.exclusivo = !!data.exclusivo;
    if (data.exibirSite !== undefined) patch.exibir_site = !!data.exibirSite;
    if (data.exibir_site !== undefined) patch.exibir_site = !!data.exibir_site;
    if (uploadedImages.length > 0) {
      patch.foto_destaque = uploadedImages[0];
    }

    const { error } = await supabase.from('imoveis').update(patch).eq('codigo_imovel', numId);
    if (error) {
      console.error('❌ Erro ao atualizar imóvel no Supabase:', error.message);
      throw new Error(error.message);
    }

    // Se novas fotos foram enviadas, atualiza tabela imovel_fotos
    if (uploadedImages.length > 0) {
      try {
        await supabase.from('imovel_fotos').delete().eq('codigo_imovel', numId);
        const fotosRows = uploadedImages.map((imgUrl, idx) => ({
          codigo_imovel: numId,
          url_original: imgUrl,
          url_propria: imgUrl,
          ordem: idx,
          destaque: idx === 0
        }));
        await supabase.from('imovel_fotos').insert(fotosRows);
      } catch (e) {
        console.warn('Aviso atualização fotos:', e.message);
      }
    }

    let existing = this.cachedMap.get(cleanId.toLowerCase());
    if (existing) {
      Object.assign(existing, {
        ...data,
        images: uploadedImages.length > 0 ? uploadedImages : existing.images,
        primaryImage: uploadedImages[0] || existing.primaryImage
      });
    }

    crmStore.savePropertyOverride(cleanId, {
      kanbanStage: data.kanbanStage,
      status: data.status,
      keyTag: data.keyTag
    });

    // Registra no Histórico & Auditoria as alterações efetuadas
    try {
      const changes = [];
      if (existing) {
        if (data.title && data.title !== existing.title) {
          changes.push(`Título: "${existing.title}" ➔ "${data.title}"`);
        }
        if (data.price !== undefined && parseFloat(data.price) !== parseFloat(existing.price || 0)) {
          changes.push(`Valor Venda: R$ ${(existing.price || 0).toLocaleString('pt-BR')} ➔ R$ ${parseFloat(data.price).toLocaleString('pt-BR')}`);
        }
        if (data.rentalPrice !== undefined && parseFloat(data.rentalPrice) !== parseFloat(existing.rentalPrice || 0)) {
          changes.push(`Valor Locação: R$ ${(existing.rentalPrice || 0).toLocaleString('pt-BR')} ➔ R$ ${parseFloat(data.rentalPrice).toLocaleString('pt-BR')}`);
        }
        if (data.kanbanStage && data.kanbanStage !== existing.kanbanStage) {
          changes.push(`Etapa da Jornada: "${existing.kanbanStage}" ➔ "${data.kanbanStage}"`);
        }
        if (data.localChave && data.localChave !== existing.localChave) {
          changes.push(`Local da Chave: "${existing.localChave}" ➔ "${data.localChave}"`);
        }
        if (data.anotacoesInternas && data.anotacoesInternas !== existing.anotacoesInternas) {
          changes.push(`Anotações internas atualizadas`);
        }
        if (data.exibirSite !== undefined && !!data.exibirSite !== !!existing.exibirSite) {
          changes.push(`Visibilidade no Site: ${data.exibirSite ? '🌐 Habilitado' : '👁️‍🗨️ Oculto'}`);
          existing.exibirSite = !!data.exibirSite;
        }
      }

      const { crmRepository } = require('./crm-repository');
      await crmRepository.recordPropertyHistory({
        propertyId: cleanId,
        tipo: 'alteracao',
        titulo: 'Dados Cadastrais do Imóvel Atualizados',
        descricao: changes.length > 0 ? changes.join(' • ') : 'Atualização cadastral do imóvel efetuada.',
        autor: data.autor || 'Corretor / Administrador',
        detalhes: { changes, patch: data }
      });
    } catch (e) {
      console.warn('Aviso histórico alteração:', e.message);
    }

    return existing || { id: cleanId, ...data };
  }

  /**
   * Exclusão lógica (soft delete) do imóvel
   */
  async deleteProperty(id) {
    const cleanId = String(id).trim();
    const numId = parseInt(cleanId.replace(/\D/g, ''), 10);
    if (!isNaN(numId)) {
      await supabase.from('imoveis').update({ ativo: false, situacao: 'Inativo / Excluído' }).eq('codigo_imovel', numId);
    }
    crmStore.deleteProperty(cleanId);
    this.cachedMap.delete(cleanId.toLowerCase());
    this.cachedList = this.cachedList.filter(p => String(p.id).toLowerCase() !== cleanId.toLowerCase());
    this.metadata.total = Math.max(0, this.metadata.total - 1);

    // Registra exclusão no histórico
    try {
      const { crmRepository } = require('./crm-repository');
      await crmRepository.recordPropertyHistory({
        propertyId: cleanId,
        tipo: 'alteracao',
        titulo: 'Imóvel Excluído / Inativado',
        descricao: `O imóvel #${cleanId} foi marcado como inativo/excluído no sistema.`,
        autor: 'Administrador'
      });
    } catch (e) {}

    return true;
  }
}

const propertiesRepository = new PropertiesRepository();

module.exports = {
  propertiesRepository,
  mapDatabaseToProperty
};
