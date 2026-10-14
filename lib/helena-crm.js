const fs = require('fs');
const path = require('path');

// Carregamento simples de variáveis de ambiente de .env se existir
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        const key = k.trim();
        const val = v.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
} catch (e) {
  // Ignora erro de leitura do .env
}

const HELENA_BASE_URL = process.env.HELENA_API_URL || 'https://api.wts.chat/core';

/**
 * Consulta um contato no Helena CRM pelo ID com os CustomFields e Tags inclusos
 * Documentação oficial: https://flwchat.readme.io/reference/get_v1-contact-id
 * 
 * @param {string} contactId ID (UUID ou código) do contato no Helena CRM
 * @param {string} [tokenOverride] Token opcional passado na requisição
 * @returns {Promise<Object>} Dados do contato retornado pela API da Helena
 */
async function fetchHelenaContact(contactId, tokenOverride = null) {
  if (!contactId) {
    throw new Error('ID do contato não fornecido.');
  }

  const token = tokenOverride || process.env.HELENA_API_TOKEN || process.env.CRM_API_TOKEN;
  if (!token) {
    throw new Error(
      'Token de API do Helena CRM não configurado. Defina a variável de ambiente HELENA_API_TOKEN ou passe o token no header x-helena-token.'
    );
  }

  // Prepara o cabeçalho Authorization com Bearer
  const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const cleanId = String(contactId).trim();
  const url = `${HELENA_BASE_URL}/v1/contact/${encodeURIComponent(cleanId)}?IncludeDetails=CustomFields&IncludeDetails=Tags`;

  console.log(`📡 Consultando Helena CRM: ${url}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedMessage = errorText;
    try {
      const errJson = JSON.parse(errorText);
      parsedMessage = errJson.text || errJson.message || errJson.title || errorText;
    } catch (_) {}
    throw new Error(`Helena CRM API [${response.status}]: ${parsedMessage}`);
  }

  const contact = await response.json();
  return contact;
}

/**
 * Utilitário para limpar e converter números vindos de campos de texto (ex: "R$ 4.500,00" -> 4500)
 */
function parsePrice(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).replace(/[^\d,.]/g, '');
  if (!str) return 0;
  // Se tiver vírgula como separador decimal (formato brasileiro: 1.500,00)
  if (str.includes(',') && !str.includes('.')) {
    return parseFloat(str.replace(',', '.')) || 0;
  }
  if (str.includes('.') && str.includes(',')) {
    // 1.500,00 -> 1500.00
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(str) || 0;
}

/**
 * Utilitário para extrair inteiros (ex: "3 quartos" -> 3)
 */
function parseNumber(val) {
  if (typeof val === 'number') return Math.floor(val);
  if (!val) return 0;
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Normaliza strings para comparação de chaves
 */
function normKey(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Extrai os critérios de busca a partir do contato e de seus CustomFields
 * Suporta variações flexíveis nos nomes dos campos cadastrados no Helena CRM
 * 
 * @param {Object} contact Objeto retornado pela API da Helena
 * @returns {Object} Critérios estruturados de busca imobiliária
 */
function extractLeadCriteriaFromContact(contact) {
  if (!contact) return {};

  const customFields = contact.customFields || {};
  const entries = Object.entries(customFields);

  const criteria = {
    tipo: '',
    finalidade: '',
    uso: '',
    orcamentoMax: 0,
    orcamentoMin: 0,
    quartos: 0,
    suites: 0,
    vagas: 0,
    regiao: '',
    cidade: '',
    caracteristicas: '',
    contexto: ''
  };

  // Mapeamento dinâmico inspecionando cada chave cadastrada no CRM
  for (const [key, rawValue] of entries) {
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;

    const kNorm = normKey(key);
    const valStr = Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue).trim();

    // Região / Bairro (prioridade para não colidir com 'interesse')
    if (
      kNorm.includes('bairro') ||
      kNorm.includes('regiao') ||
      kNorm.includes('localizacao') ||
      kNorm.includes('zona')
    ) {
      if (!criteria.regiao) criteria.regiao = valStr;
      else criteria.regiao += `, ${valStr}`;
    }

    // Tipo de Imóvel
    else if (
      kNorm.includes('tipoimovel') ||
      kNorm.includes('tipologia') ||
      kNorm.includes('propertytype') ||
      (kNorm.includes('tipo') && (kNorm.includes('propriedade') || kNorm.includes('casa') || kNorm.includes('apto') || kNorm.includes('imovel')))
    ) {
      if (!criteria.tipo) criteria.tipo = valStr;
    }

    // Finalidade / Transação (Locação / Venda)
    else if (
      kNorm.includes('finalidade') ||
      kNorm.includes('transacao') ||
      kNorm.includes('tiponegocio') ||
      kNorm.includes('modalidade') ||
      (kNorm.includes('interesse') && !kNorm.includes('bairro') && !kNorm.includes('regiao') && !kNorm.includes('imovel'))
    ) {
      if (!criteria.finalidade) criteria.finalidade = valStr;
    }

    // Uso (Residencial / Comercial)
    else if (kNorm.includes('tipouso') || kNorm.includes('usodoimovel') || (kNorm === 'uso')) {
      if (!criteria.uso) criteria.uso = valStr;
    }

    // Orçamento Máximo / Preço
    else if (
      kNorm.includes('orcamentomax') ||
      kNorm.includes('precomax') ||
      kNorm.includes('valormax') ||
      kNorm.includes('orcamentoate') ||
      kNorm.includes('valorate') ||
      kNorm.includes('orcamento') ||
      kNorm.includes('faixadepreco') ||
      kNorm.includes('limitepreco') ||
      kNorm.includes('investimento')
    ) {
      if (!criteria.orcamentoMax) criteria.orcamentoMax = parsePrice(valStr);
    }

    // Orçamento Mínimo
    else if (kNorm.includes('orcamentomin') || kNorm.includes('precomin') || kNorm.includes('valormin')) {
      if (!criteria.orcamentoMin) criteria.orcamentoMin = parsePrice(valStr);
    }

    // Quartos / Dormitórios
    else if (
      kNorm.includes('quarto') ||
      kNorm.includes('dormitorio') ||
      kNorm.includes('qtdquarto') ||
      kNorm.includes('qtddormitorio')
    ) {
      if (!criteria.quartos) criteria.quartos = parseNumber(valStr);
    }

    // Suítes
    else if (kNorm.includes('suite') || kNorm.includes('qtdsuite')) {
      if (!criteria.suites) criteria.suites = parseNumber(valStr);
    }

    // Vagas / Garagem
    else if (
      kNorm.includes('vaga') ||
      kNorm.includes('garagem') ||
      kNorm.includes('qtdvaga') ||
      kNorm.includes('qtdgaragem')
    ) {
      if (!criteria.vagas) criteria.vagas = parseNumber(valStr);
    }

    // Cidade
    else if (kNorm.includes('cidade') || kNorm.includes('municipio')) {
      if (!criteria.cidade) criteria.cidade = valStr;
    }

    // Características / Comodidades
    else if (
      kNorm.includes('caracteristica') ||
      kNorm.includes('comodidade') ||
      kNorm.includes('diferencial') ||
      kNorm.includes('requisito') ||
      kNorm.includes('preferencia')
    ) {
      if (!criteria.caracteristicas) criteria.caracteristicas = valStr;
      else criteria.caracteristicas += `, ${valStr}`;
    }

    // Observações / Contexto
    else if (
      kNorm.includes('observac') ||
      kNorm.includes('obs') ||
      kNorm.includes('contexto') ||
      kNorm.includes('perfil') ||
      kNorm.includes('nota') ||
      kNorm.includes('necessidade')
    ) {
      if (!criteria.contexto) criteria.contexto = valStr;
      else criteria.contexto += ` | ${valStr}`;
    }
  }

  // Se o contato tiver anotações nativas na Helena (`annotation`), soma ao contexto
  if (contact.annotation) {
    criteria.contexto = criteria.contexto
      ? `${criteria.contexto} | Anotação CRM: ${contact.annotation}`
      : contact.annotation;
  }

  // Se houver tags informadas que contenham dicas de interesse (ex: "Interesse: Locação", "Bairro Jardim")
  if (Array.isArray(contact.tagNames) && contact.tagNames.length > 0) {
    const tagsText = contact.tagNames.join(', ');
    criteria.contexto = criteria.contexto
      ? `${criteria.contexto} | Tags: ${tagsText}`
      : `Tags: ${tagsText}`;

    // Dedução rápida se a finalidade não foi especificada
    const tagsLower = tagsText.toLowerCase();
    if (!criteria.finalidade) {
      if (tagsLower.includes('locação') || tagsLower.includes('locacao') || tagsLower.includes('aluguel')) {
        criteria.finalidade = 'Locação';
      } else if (tagsLower.includes('venda') || tagsLower.includes('compra')) {
        criteria.finalidade = 'Venda';
      }
    }
  }

  return criteria;
}

module.exports = {
  HELENA_BASE_URL,
  fetchHelenaContact,
  extractLeadCriteriaFromContact,
  parsePrice,
  parseNumber
};
