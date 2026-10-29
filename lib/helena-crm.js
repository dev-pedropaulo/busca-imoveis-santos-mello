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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
  } catch (netErr) {
    clearTimeout(timeoutId);
    if (netErr.name === 'AbortError') {
      throw new Error(`Helena CRM API [Timeout]: Tempo limite esgotado ao consultar contato #${cleanId}`);
    }
    throw netErr;
  }
  clearTimeout(timeoutId);

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
 * Utilitário para limpar e converter números vindos de campos de texto (ex: "R$ 4.500,00" -> 4500, "2.000" -> 2000)
 */
function parsePrice(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).replace(/[^\d,.]/g, '').trim();
  if (!str) return 0;
  // Se tiver vírgula e ponto (formato brasileiro: 1.500,00)
  if (str.includes('.') && str.includes(',')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Se tiver apenas vírgula decimal (ex: 2000,50)
  if (str.includes(',')) {
    return parseFloat(str.replace(',', '.')) || 0;
  }
  // Se tiver ponto como milhar (ex: 2.000 ou 15.000)
  if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      return parseFloat(parts.join('')) || 0;
    }
    return parseFloat(str) || 0;
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
 * Analisa o campo de pet estruturado conforme instrução do agente:
 * "Comece com 'Sim' ou 'Não', e depois de uma virgula adicione informações adicionais, caso tenha. Exemplo: Sim, dois gatos."
 */
function parsePetInfo(valStr) {
  if (!valStr) return { exigePet: false, isSim: false, isNao: false, detalhes: '' };
  const raw = String(valStr).trim();
  const parts = raw.split(',');
  const prefix = parts[0].trim().toLowerCase();
  const details = parts.slice(1).join(',').trim();

  const isSim = /^(sim\b|aceita\b|tem\b|possui\b)/i.test(prefix);
  const isNao = /^(n[ãa]o\b|nao\b|sem\b|nenhum\b|zero\b)/i.test(prefix);

  let exigePet = false;
  let detalhes = details;

  if (isSim) {
    exigePet = true;
  } else if (isNao) {
    exigePet = false;
  } else if (/sme pet/i.test(raw)) {
    exigePet = false;
  } else {
    // Fallback caso o agente informe direto o tipo de animal sem "Sim" explícito
    if (/(gato|cachorro|pet|animal|animais)/i.test(raw) && !/(sem\s*pet|n[ãa]o\b|nao\b)/i.test(raw)) {
      exigePet = true;
      detalhes = raw;
    }
  }

  return { exigePet, isSim, isNao, detalhes };
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
 * Suporta com prioridade absoluta os campos do "Perfil de Qualificação 02" e desconsidera campos do perfil original.
 * 
 * @param {Object} contact Objeto retornado pela API da Helena
 * @returns {Object} Critérios estruturados de busca imobiliária
 */
function extractLeadCriteriaFromContact(contact) {
  if (!contact) {
    const emptyCriteria = {
      tipo: '',
      finalidade: '',
      uso: '',
      orcamentoMax: 0,
      orcamentoMin: 0,
      quartos: 0,
      suites: 0,
      moradores: 0,
      aceitaPet: false,
      petDetalhes: '',
      vagas: 0,
      regiao: '',
      cidade: '',
      caracteristicas: '',
      contexto: ''
    };
    return { ...emptyCriteria, criteria: emptyCriteria, criteriosConsiderados: [] };
  }

  // Normalização de customFields (pode vir como objeto { chave: valor } ou array [ { name, value } ])
  let entries = [];
  const rawFields = contact.customFields || contact.customFieldValues || {};
  if (Array.isArray(rawFields)) {
    entries = rawFields.map(f => [
      f.name || f.key || f.title || f.fieldName || '',
      f.value !== undefined ? f.value : (f.text || f.val || '')
    ]);
  } else if (typeof rawFields === 'object' && rawFields !== null) {
    entries = Object.entries(rawFields);
  }

  const criteria = {
    tipo: '',
    finalidade: '',
    uso: '',
    orcamentoMax: 0,
    orcamentoMin: 0,
    quartos: 0,
    suites: 0,
    moradores: 0,
    aceitaPet: false,
    petDetalhes: '',
    vagas: 0,
    regiao: '',
    cidade: '',
    caracteristicas: '',
    contexto: ''
  };

  const criteriosConsiderados = [];

  // Chaves do Perfil Original a serem estritamente ignoradas em favor do Perfil de Qualificação 02
  const ORIGINAL_PROFILE_KEYS = new Set([
    'destina-o',
    'tipo-do-im-vel-56',
    'bairros',
    'or-amento',
    'n-quartos',
    'pet',
    'particularidades',
    'garantia',
    'motivo',
    'tempo'
  ]);

  let rawQuartosEntry = null;
  let rawMoradoresEntry = null;

  // Mapeamento direcionado ao Perfil de Qualificação 02
  for (const [key, rawValue] of entries) {
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;

    const keyClean = String(key).trim();
    if (ORIGINAL_PROFILE_KEYS.has(keyClean)) {
      continue;
    }

    const kNorm = normKey(keyClean);
    const valStr = Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue).trim();
    if (!valStr || valStr === '-') continue;

    // 1. Destinação (Perfil 02: destina-o-75)
    if (
      keyClean === 'destina-o-75' ||
      (kNorm.includes('destina') && kNorm.includes('75')) ||
      (!ORIGINAL_PROFILE_KEYS.has(keyClean) && (kNorm.includes('destina') || kNorm.includes('finalidade') || kNorm.includes('transacao')))
    ) {
      const valLower = valStr.toLowerCase();
      let impacto = [];
      if (valLower.includes('loca') || valLower.includes('alug') || valLower.includes('rent')) {
        criteria.finalidade = 'Locação';
        impacto.push('Finalidade: Locação');
      } else if (valLower.includes('venda') || valLower.includes('compra') || valLower.includes('sale')) {
        criteria.finalidade = 'Venda';
        impacto.push('Finalidade: Venda');
      }
      if (valLower.includes('comerc')) {
        criteria.uso = 'Comercial';
        impacto.push('Uso: Comercial');
      } else if (valLower.includes('resid')) {
        criteria.uso = 'Residencial';
        impacto.push('Uso: Residencial');
      }
      if (!criteria.finalidade && !criteria.uso) {
        criteria.finalidade = valStr;
        impacto.push(`Destinação: ${valStr}`);
      }
      criteriosConsiderados.push({
        campo: 'Destinação',
        campoOriginal: keyClean,
        icone: '🎯',
        valorOriginal: valStr,
        impacto: impacto.join(' • ') || `Destinação: ${valStr}`
      });
    }

    // 2. Tipo do Imóvel (Perfil 02: tipo-do-im-vel-24)
    else if (
      keyClean === 'tipo-do-im-vel-24' ||
      (kNorm.includes('tipo') && kNorm.includes('24')) ||
      (!ORIGINAL_PROFILE_KEYS.has(keyClean) && (kNorm.includes('tipodoimovel') || kNorm.includes('tipodoimvel') || kNorm.includes('tipoimovel')))
    ) {
      criteria.tipo = valStr;
      criteriosConsiderados.push({
        campo: 'Tipo do Imóvel',
        campoOriginal: keyClean,
        icone: '🏠',
        valorOriginal: valStr,
        impacto: `Tipo: ${valStr} (com busca de sinônimos)`
      });
    }

    // 3. Bairros / Região (Perfil 02: bairros-77)
    else if (
      keyClean === 'bairros-77' ||
      (kNorm.includes('bairro') && kNorm.includes('77')) ||
      (!ORIGINAL_PROFILE_KEYS.has(keyClean) && (kNorm.includes('bairro') || kNorm.includes('regiao') || kNorm.includes('localizacao')))
    ) {
      if (!criteria.regiao) criteria.regiao = valStr;
      else criteria.regiao += `, ${valStr}`;

      criteriosConsiderados.push({
        campo: 'Bairros',
        campoOriginal: keyClean,
        icone: '📍',
        valorOriginal: valStr,
        impacto: `Bairros de interesse: ${valStr}`
      });
    }

    // 4. Orçamento (Perfil 02: or-amento-35)
    else if (
      keyClean === 'or-amento-35' ||
      (kNorm.includes('oramento') && kNorm.includes('35')) ||
      (kNorm.includes('orcamento') && kNorm.includes('35')) ||
      (!ORIGINAL_PROFILE_KEYS.has(keyClean) && (kNorm.includes('orcamento') || kNorm.includes('oramento') || kNorm.includes('precomax') || kNorm.includes('valormax')))
    ) {
      const parsed = parsePrice(valStr);
      if (parsed > 0) {
        criteria.orcamentoMax = parsed;
        criteriosConsiderados.push({
          campo: 'Orçamento',
          campoOriginal: keyClean,
          icone: '💰',
          valorOriginal: valStr,
          impacto: `Teto de orçamento: ${parsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
        });
      }
    }

    // 5. N° Suítes (Perfil 02: n-su-tes-)
    else if (
      keyClean === 'n-su-tes-' ||
      kNorm.includes('nsutes') ||
      kNorm.includes('suite') ||
      kNorm.includes('sute')
    ) {
      const s = parseNumber(valStr);
      if (s > 0) {
        criteria.suites = s;
        criteriosConsiderados.push({
          campo: 'Suítes',
          campoOriginal: keyClean,
          icone: '🚿',
          valorOriginal: valStr,
          impacto: `Mínimo de ${s} suíte(s)`
        });
      }
    }

    // 6. N° Quartos (Perfil 02: n-quartos-14)
    else if (
      keyClean === 'n-quartos-14' ||
      (kNorm.includes('quarto') && kNorm.includes('14')) ||
      (!ORIGINAL_PROFILE_KEYS.has(keyClean) && (kNorm.includes('nquarto') || kNorm.includes('quarto') || kNorm.includes('dormitorio')))
    ) {
      rawQuartosEntry = { key: keyClean, valStr };
    }

    // 7. Moradores (Perfil 02: moradores-21)
    else if (
      keyClean === 'moradores-21' ||
      (kNorm.includes('morador') && kNorm.includes('21')) ||
      (!ORIGINAL_PROFILE_KEYS.has(keyClean) && (kNorm.includes('morador') || kNorm.includes('moradores') || kNorm.includes('pessoas')))
    ) {
      rawMoradoresEntry = { key: keyClean, valStr };
    }

    // 8. Pet (Perfil 02: pet-81) - Informativo na ficha do lead
    else if (
      keyClean === 'pet-81' ||
      (kNorm.includes('pet') && kNorm.includes('81')) ||
      (!ORIGINAL_PROFILE_KEYS.has(keyClean) && (kNorm.includes('pet') || kNorm.includes('animal')))
    ) {
      const petInfo = parsePetInfo(valStr);
      criteria.aceitaPet = petInfo.exigePet;
      criteria.petDetalhes = petInfo.detalhes;
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | Pet: ${valStr}` : `Pet: ${valStr}`;

      criteriosConsiderados.push({
        campo: 'Pet',
        campoOriginal: keyClean,
        icone: '🐾',
        valorOriginal: valStr,
        impacto: petInfo.exigePet ? (petInfo.detalhes ? `Tem pet (${petInfo.detalhes})` : 'Tem pet') : (petInfo.isNao ? 'Não tem pet' : `Pet: ${valStr}`)
      });
    }

    // 9. Particularidades (Perfil 02: particularidades-3)
    else if (
      keyClean === 'particularidades-3' ||
      (kNorm.includes('particularidade') && kNorm.includes('3')) ||
      (!ORIGINAL_PROFILE_KEYS.has(keyClean) && (kNorm.includes('particularidade') || kNorm.includes('comodidade') || kNorm.includes('caracteristica') || kNorm.includes('diferencial')))
    ) {
      criteria.caracteristicas = criteria.caracteristicas ? `${criteria.caracteristicas}, ${valStr}` : valStr;
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | Particularidades: ${valStr}` : `Particularidades: ${valStr}`;
      criteriosConsiderados.push({
        campo: 'Particularidades',
        campoOriginal: keyClean,
        icone: '✨',
        valorOriginal: valStr,
        impacto: `Comodidades e contexto: ${valStr}`
      });
    }

    // 10. Garantia (Perfil 02: garantia-7)
    else if (
      keyClean === 'garantia-7' ||
      (kNorm.includes('garantia') && kNorm.includes('7')) ||
      (!ORIGINAL_PROFILE_KEYS.has(keyClean) && (kNorm.includes('garantia') || kNorm.includes('fianca')))
    ) {
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | Garantia: ${valStr}` : `Garantia: ${valStr}`;
      criteriosConsiderados.push({
        campo: 'Garantia',
        campoOriginal: keyClean,
        icone: '🛡️',
        valorOriginal: valStr,
        impacto: `Garantia pretendida: ${valStr}`
      });
    }

    // 11. Motivo da Mudança (Perfil 02: motivo-da-mudan-a)
    else if (
      keyClean === 'motivo-da-mudan-a' ||
      kNorm.includes('mudan') ||
      (!ORIGINAL_PROFILE_KEYS.has(keyClean) && (kNorm.includes('motivo') || kNorm.includes('razao')))
    ) {
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | Motivo: ${valStr}` : `Motivo: ${valStr}`;
      criteriosConsiderados.push({
        campo: 'Motivo da Mudança',
        campoOriginal: keyClean,
        icone: '📦',
        valorOriginal: valStr,
        impacto: `Motivo: ${valStr}`
      });
    }

    // 12. Tempo estimado para mudança (Perfil 02: tempo-estimado-para-)
    else if (
      keyClean === 'tempo-estimado-para-' ||
      kNorm.includes('tempoestimado') ||
      (!ORIGINAL_PROFILE_KEYS.has(keyClean) && (kNorm.includes('tempo') || kNorm.includes('prazo') || kNorm.includes('urgencia')))
    ) {
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | Prazo: ${valStr}` : `Prazo: ${valStr}`;
      criteriosConsiderados.push({
        campo: 'Prazo',
        campoOriginal: keyClean,
        icone: '⏱️',
        valorOriginal: valStr,
        impacto: `Prazo estimado: ${valStr}`
      });
    }

    // Suporte adicional a vagas
    else if (kNorm.includes('vaga') || kNorm.includes('garagem')) {
      const v = parseNumber(valStr);
      if (v > 0) {
        criteria.vagas = v;
        criteriosConsiderados.push({ campo: 'Vagas', campoOriginal: keyClean, icone: '🚗', valorOriginal: valStr, impacto: `Mínimo de ${v} vaga(s)` });
      }
    }
  }

  // Resolução combinada de Quartos e Moradores com prioridade para Quartos
  if (rawQuartosEntry) {
    const q = parseNumber(rawQuartosEntry.valStr);
    if (q > 0) {
      criteria.quartos = q;
      criteriosConsiderados.push({
        campo: 'Quartos',
        campoOriginal: rawQuartosEntry.key,
        icone: '🛏️',
        valorOriginal: rawQuartosEntry.valStr,
        impacto: `Mínimo de ${q} dormitório(s)`
      });
    }
  }

  if (rawMoradoresEntry) {
    const numMoradores = parseNumber(rawMoradoresEntry.valStr);
    criteria.moradores = numMoradores;
    criteria.contexto = criteria.contexto ? `${criteria.contexto} | Moradores: ${rawMoradoresEntry.valStr}` : `Moradores: ${rawMoradoresEntry.valStr}`;

    criteriosConsiderados.push({
      campo: 'Moradores',
      campoOriginal: rawMoradoresEntry.key,
      icone: '👨‍👩‍👧',
      valorOriginal: rawMoradoresEntry.valStr,
      impacto: `Moradores: ${rawMoradoresEntry.valStr} (Informativo)`
    });
  }

  // Anotações nativas da Helena (`annotation`) - exibida no card informativo de anotação do lead
  if (contact.annotation) {
    criteria.contexto = criteria.contexto
      ? `${criteria.contexto} | Anotação Helena: ${contact.annotation}`
      : contact.annotation;
  }

  // Tags do contato
  if (Array.isArray(contact.tagNames) && contact.tagNames.length > 0) {
    const tagsText = contact.tagNames.join(', ');
    criteria.contexto = criteria.contexto
      ? `${criteria.contexto} | Tags: ${tagsText}`
      : `Tags: ${tagsText}`;

    const tagsLower = tagsText.toLowerCase();
    if (!criteria.finalidade) {
      if (tagsLower.includes('locação') || tagsLower.includes('locacao') || tagsLower.includes('aluguel')) {
        criteria.finalidade = 'Locação';
        criteriosConsiderados.push({ campo: 'Tag Helena', campoOriginal: 'tagNames', icone: '🏷️', valorOriginal: tagsText, impacto: 'Finalidade deduzida: Locação' });
      } else if (tagsLower.includes('venda') || tagsLower.includes('compra')) {
        criteria.finalidade = 'Venda';
        criteriosConsiderados.push({ campo: 'Tag Helena', campoOriginal: 'tagNames', icone: '🏷️', valorOriginal: tagsText, impacto: 'Finalidade deduzida: Venda' });
      }
    }
  }

  criteria.criteriosConsiderados = criteriosConsiderados;
  return {
    ...criteria,
    criteria,
    criteriosConsiderados
  };
}

const HELENA_CHAT_BASE_URL = process.env.HELENA_CHAT_API_URL || 'https://api.wts.chat/chat';
const HELENA_CRM_BASE_URL = process.env.HELENA_CRM_API_URL || 'https://api.wts.chat/crm';
const DEFAULT_PANEL_ID = process.env.HELENA_PANEL_ID || '813ecce6-69cf-4fc6-b5df-73c8d4db35d2';

/**
 * Consulta sessões de atendimento associadas a um contato no Helena CRM
 * Documentação: https://flwchat.readme.io/reference/get_v2-session
 * 
 * @param {string} contactId UUID do contato
 * @param {string} [tokenOverride] Token opcional
 * @returns {Promise<{ sessions: Array, activeSession: Object|null }>}
 */
async function fetchHelenaContactSessions(contactId, tokenOverride = null) {
  if (!contactId) throw new Error('ID do contato não fornecido.');
  const token = tokenOverride || process.env.HELENA_API_TOKEN || process.env.CRM_API_TOKEN;
  if (!token) throw new Error('Token de API do Helena CRM não configurado.');

  const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const cleanId = String(contactId).trim();
  const url = `${HELENA_CHAT_BASE_URL}/v2/session?ContactId=${encodeURIComponent(cleanId)}&limit=15&OrderBy=createdat&OrderDirection=DESCENDING`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
  } catch (netErr) {
    clearTimeout(timeoutId);
    if (netErr.name === 'AbortError') {
      throw new Error(`Helena Session API [Timeout]: Tempo limite esgotado ao consultar sessões do contato #${cleanId}`);
    }
    throw netErr;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Helena Session API [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  const sessions = Array.isArray(data.items) ? data.items : [];
  
  // Prioriza sessão ativa / em andamento
  const activeSession = sessions.find(s => 
    s.status === 'IN_PROGRESS' || s.status === 'STARTED' || s.status === 'PENDING'
  ) || sessions[0] || null;

  return {
    sessions,
    activeSession
  };
}

/**
 * Consulta uma sessão de atendimento pelo ID
 * Documentação: https://flwchat.readme.io/reference/get_v2-session-id
 * 
 * @param {string} sessionId UUID da sessão
 * @param {string} [tokenOverride] Token opcional
 * @returns {Promise<Object>}
 */
async function fetchHelenaSession(sessionId, tokenOverride = null) {
  if (!sessionId) throw new Error('ID da sessão não fornecido.');
  const token = tokenOverride || process.env.HELENA_API_TOKEN || process.env.CRM_API_TOKEN;
  if (!token) throw new Error('Token de API do Helena CRM não configurado.');

  const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const cleanId = String(sessionId).trim();
  const url = `${HELENA_CHAT_BASE_URL}/v2/session/${encodeURIComponent(cleanId)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
  } catch (netErr) {
    clearTimeout(timeoutId);
    if (netErr.name === 'AbortError') {
      throw new Error(`Helena Session API [Timeout]: Tempo limite esgotado ao consultar sessão #${cleanId}`);
    }
    throw netErr;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Helena Session API [${response.status}]: ${errorText}`);
  }

  return await response.json();
}

/**
 * Atualiza o metadata de uma sessão de atendimento
 * Documentação: https://flwchat.readme.io/reference/put_v2-session-id-partial
 * 
 * @param {string} sessionId UUID da sessão
 * @param {Object} metadata Objeto de metadados a ser salvo
 * @param {string} [tokenOverride] Token opcional
 * @returns {Promise<Object>}
 */
async function updateHelenaSessionMetadata(sessionId, metadata, tokenOverride = null) {
  if (!sessionId) throw new Error('ID da sessão não fornecido.');
  const token = tokenOverride || process.env.HELENA_API_TOKEN || process.env.CRM_API_TOKEN;
  if (!token) throw new Error('Token de API do Helena CRM não configurado.');

  const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const cleanId = String(sessionId).trim();
  const url = `${HELENA_CHAT_BASE_URL}/v2/session/${encodeURIComponent(cleanId)}/partial`;

  const body = {
    metadata: metadata || {},
    fields: ['Metadata']
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  let response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (netErr) {
    clearTimeout(timeoutId);
    if (netErr.name === 'AbortError') {
      throw new Error(`Helena Session Partial Update [Timeout]: Tempo limite esgotado ao atualizar metadados da sessão #${cleanId}`);
    }
    throw netErr;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Helena Session Partial Update [${response.status}]: ${errorText}`);
  }

  return await response.json();
}

/**
 * Registra imóveis enviados na sessão de atendimento do Helena CRM
 * Acumula os imóveis sem duplicar por ID, atualizando contadores e timestamps
 * 
 * @param {Object} params
 * @param {string} [params.sessionId] ID da sessão (se conhecido)
 * @param {string} [params.contactId] ID do contato (se sessionId não for passado)
 * @param {Array<Object>} params.properties Lista de imóveis enviados
 * @param {string} [params.tokenOverride] Token opcional
 * @returns {Promise<Object>}
 */
async function recordSentPropertiesInHelenaSession({ sessionId, contactId, properties, tokenOverride = null }) {
  let targetSessionId = sessionId;

  // Se não temos sessionId, busca a sessão ativa do contato
  if (!targetSessionId && contactId) {
    const sessionResult = await fetchHelenaContactSessions(contactId, tokenOverride);
    if (sessionResult.activeSession && sessionResult.activeSession.id) {
      targetSessionId = sessionResult.activeSession.id;
    }
  }

  if (!targetSessionId) {
    throw new Error('Nenhuma sessão de atendimento encontrada no Helena CRM para registrar os metadados.');
  }

  // 1. Obtém a sessão atual para ler metadados prévios
  const currentSession = await fetchHelenaSession(targetSessionId, tokenOverride);
  const currentMetadata = currentSession.metadata && typeof currentSession.metadata === 'object' 
    ? { ...currentSession.metadata } 
    : {};

  const existingList = Array.isArray(currentMetadata.imoveisEnviados) ? currentMetadata.imoveisEnviados : [];
  const propertyMap = new Map();

  // Preserva imóveis anteriores
  existingList.forEach(item => {
    if (item && item.id) {
      propertyMap.set(String(item.id), item);
    }
  });

  const nowIso = new Date().toISOString();
  const incomingList = Array.isArray(properties) ? properties : [properties].filter(Boolean);

  // Adiciona ou atualiza os novos imóveis
  incomingList.forEach(prop => {
    const pId = String(prop.id || prop.codigo || '').trim();
    if (!pId) return;

    const existing = propertyMap.get(pId) || {};
    propertyMap.set(pId, {
      id: pId,
      codigo: pId,
      titulo: prop.titulo || prop.title || existing.titulo || '',
      tipo: prop.tipo || prop.propertyType || existing.tipo || '',
      bairro: prop.bairro || (prop.location && prop.location.neighborhood) || existing.bairro || '',
      cidade: prop.cidade || (prop.location && prop.location.city) || existing.cidade || 'Santo André',
      valor: prop.valor || prop.price || prop.rentalPrice || existing.valor || '',
      valorFormatado: prop.valorFormatado || prop.priceText || existing.valorFormatado || '',
      finalidade: prop.finalidade || prop.transactionType || existing.finalidade || '',
      url: prop.url || prop.websiteUrl || existing.url || '',
      matchScore: prop.matchScore !== undefined ? prop.matchScore : (existing.matchScore || null),
      primeiroEnvioEm: existing.primeiroEnvioEm || nowIso,
      ultimoEnvioEm: nowIso,
      totalEnvios: (existing.totalEnvios || 0) + 1
    });
  });

  const updatedImoveisEnviados = Array.from(propertyMap.values());

  const updatedMetadata = {
    ...currentMetadata,
    imoveisEnviados: updatedImoveisEnviados,
    totalImoveisEnviados: updatedImoveisEnviados.length,
    ultimoEnvioEm: nowIso,
    ultimaInteracaoImoveis: {
      data: nowIso,
      quantidadeEnviada: incomingList.length,
      imoveisCodigos: incomingList.map(p => String(p.id || p.codigo || '')).filter(Boolean)
    }
  };

  // 2. Salva na API da Helena via PUT partial
  const updatedSession = await updateHelenaSessionMetadata(targetSessionId, updatedMetadata, tokenOverride);

  return {
    success: true,
    sessionId: targetSessionId,
    contactId: currentSession.contactId || contactId,
    sessionStatus: currentSession.status,
    totalImoveisEnviados: updatedImoveisEnviados.length,
    imoveisEnviados: updatedImoveisEnviados,
    metadata: updatedSession.metadata || updatedMetadata
  };
}

/**
 * Registra visitas agendadas no session metadata do Helena CRM
 * 
 * @param {Object} params
 * @param {string} [params.sessionId] ID da sessão
 * @param {string} [params.contactId] ID do contato
 * @param {Array<Object>} params.visits Lista de visitas agendadas { propertyId, date, time, notes, broker }
 * @param {string} [params.tokenOverride] Token opcional
 * @returns {Promise<Object>}
 */
async function recordScheduledVisitsInHelenaSession({ sessionId, contactId, visits, tokenOverride = null }) {
  let targetSessionId = sessionId;

  if (!targetSessionId && contactId) {
    const sessionResult = await fetchHelenaContactSessions(contactId, tokenOverride);
    if (sessionResult.activeSession && sessionResult.activeSession.id) {
      targetSessionId = sessionResult.activeSession.id;
    }
  }

  if (!targetSessionId) {
    throw new Error('Nenhuma sessão de atendimento encontrada no Helena CRM para registrar as visitas.');
  }

  const currentSession = await fetchHelenaSession(targetSessionId, tokenOverride);
  const currentMetadata = currentSession.metadata && typeof currentSession.metadata === 'object'
    ? { ...currentSession.metadata }
    : {};

  const existingVisits = Array.isArray(currentMetadata.visitasAgendadas) ? currentMetadata.visitasAgendadas : [];
  const nowIso = new Date().toISOString();
  const incomingVisits = Array.isArray(visits) ? visits : [visits].filter(Boolean);

  // Mapeia visitas por ID do imóvel
  const visitMap = new Map();
  existingVisits.forEach(v => {
    if (v && v.propertyId) visitMap.set(String(v.propertyId), v);
  });

  incomingVisits.forEach(v => {
    const pId = String(v.propertyId || v.id || '').trim();
    if (!pId) return;

    visitMap.set(pId, {
      propertyId: pId,
      propertyTitle: v.propertyTitle || v.titulo || '',
      propertyNeighborhood: v.propertyNeighborhood || v.bairro || '',
      propertyType: v.propertyType || v.tipo || '',
      propertyUrl: v.propertyUrl || v.url || '',
      propertyPrice: v.propertyPrice || v.valor || '',
      date: v.date || '',
      time: v.time || '',
      notes: v.notes || '',
      broker: v.broker || 'Corretor de Plantão',
      status: 'Confirmada para Visita',
      agendadoEm: nowIso
    });
  });

  const updatedVisitasAgendadas = Array.from(visitMap.values());

  // Atualiza também os imóveis na lista imoveisEnviados marcando que foram agendados para visita
  const imoveisEnviados = Array.isArray(currentMetadata.imoveisEnviados) ? currentMetadata.imoveisEnviados.map(prop => {
    const matchingVisit = visitMap.get(String(prop.id));
    if (matchingVisit) {
      return {
        ...prop,
        visitaAgendada: true,
        dataVisita: matchingVisit.date,
        horarioVisita: matchingVisit.time,
        obsVisita: matchingVisit.notes
      };
    }
    return prop;
  }) : [];

  const updatedMetadata = {
    ...currentMetadata,
    imoveisEnviados,
    visitasAgendadas: updatedVisitasAgendadas,
    totalVisitasAgendadas: updatedVisitasAgendadas.length,
    ultimaAtualizacaoVisitasEm: nowIso
  };

  const updatedSession = await updateHelenaSessionMetadata(targetSessionId, updatedMetadata, tokenOverride);

  return {
    success: true,
    sessionId: targetSessionId,
    contactId: currentSession.contactId || contactId,
    totalVisitasAgendadas: updatedVisitasAgendadas.length,
    visitasAgendadas: updatedVisitasAgendadas,
    metadata: updatedSession.metadata || updatedMetadata
  };
}

/**
 * Consulta o Card do Lead no Painel do Helena CRM
 * Documentação: https://api.wts.chat/crm/v2/panel/card
 * 
 * @param {string} contactId UUID do contato
 * @param {string} [panelId] UUID do painel (default: 813ecce6-69cf-4fc6-b5df-73c8d4db35d2)
 * @param {string} [tokenOverride] Token opcional
 * @returns {Promise<Object|null>} Card do lead ou null
 */
async function fetchHelenaContactCard(contactId, panelId = null, tokenOverride = null) {
  if (!contactId) throw new Error('ID do contato não fornecido para busca do card.');
  const token = tokenOverride || process.env.HELENA_API_TOKEN || process.env.CRM_API_TOKEN;
  if (!token) throw new Error('Token de API do Helena CRM não configurado.');

  const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const targetPanelId = panelId || process.env.HELENA_PANEL_ID || DEFAULT_PANEL_ID;
  const cleanContactId = String(contactId).trim();
  const url = `${HELENA_CRM_BASE_URL}/v2/panel/card?PanelId=${encodeURIComponent(targetPanelId)}&ContactId=${encodeURIComponent(cleanContactId)}&IncludeDetails=CustomFields`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
  } catch (netErr) {
    clearTimeout(timeoutId);
    if (netErr.name === 'AbortError') {
      throw new Error(`Helena CRM Card API [Timeout]: Tempo limite esgotado ao buscar card do contato #${cleanContactId}`);
    }
    throw netErr;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Helena CRM Card API [${response.status}]: ${errorText}`);
  }

  const json = await response.json();
  const items = Array.isArray(json.items) ? json.items : [];
  return items.length > 0 ? items[0] : null;
}

/**
 * Adiciona uma anotação (note) ao card do lead com texto e fotos anexas opcionais
 * Documentação: https://flwchat.readme.io/reference/post_v1-panel-card-cardid-note
 * 
 * @param {string} cardId UUID do card
 * @param {Object} data { text: string, fileUrls?: Array<string> }
 * @param {string} [tokenOverride] Token opcional
 * @returns {Promise<Object>} Resposta da criação da anotação
 */
async function addHelenaCardNote(cardId, { text, fileUrls = [] }, tokenOverride = null) {
  if (!cardId) throw new Error('ID do card não fornecido para adicionar anotação.');
  const token = tokenOverride || process.env.HELENA_API_TOKEN || process.env.CRM_API_TOKEN;
  if (!token) throw new Error('Token de API do Helena CRM não configurado.');

  const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const cleanCardId = String(cardId).trim();
  const url = `${HELENA_CRM_BASE_URL}/v1/panel/card/${encodeURIComponent(cleanCardId)}/note`;

  const validFiles = Array.isArray(fileUrls) 
    ? fileUrls.filter(u => typeof u === 'string' && u.startsWith('http')) 
    : [];

  const body = {
    text: text || '',
    ...(validFiles.length > 0 ? { fileUrls: validFiles } : {})
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (netErr) {
    clearTimeout(timeoutId);
    if (netErr.name === 'AbortError') {
      throw new Error(`Helena CRM Card Note API [Timeout]: Tempo limite esgotado ao adicionar anotação no card #${cleanCardId}`);
    }
    throw netErr;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Helena CRM Card Note API [${response.status}]: ${errorText}`);
  }

  return await response.json();
}

/**
 * Registra os imóveis enviados nas notas e anexos do card do lead no painel
 * 
 * @param {Object} params
 * @param {string} [params.contactId] UUID do contato
 * @param {string} [params.sessionId] UUID da sessão
 * @param {Array<Object>} params.properties Lista de imóveis
 * @param {string} [params.panelId] UUID do painel (opcional)
 * @param {string} [params.tokenOverride] Token opcional
 * @returns {Promise<Object>}
 */
async function recordSentPropertiesInHelenaCard({ contactId, sessionId, properties, panelId = null, tokenOverride = null }) {
  let targetContactId = contactId;

  // Se não temos contactId mas temos sessionId, tenta obter o contactId através da sessão
  if (!targetContactId && sessionId) {
    try {
      const sess = await fetchHelenaSession(sessionId, tokenOverride);
      if (sess && sess.contactId) {
        targetContactId = sess.contactId;
      }
    } catch (_) {}
  }

  if (!targetContactId) {
    return {
      success: false,
      skipped: true,
      reason: 'contactId não fornecido e não encontrado na sessão.'
    };
  }

  const incomingList = (Array.isArray(properties) ? properties : [properties]).filter(Boolean);
  if (incomingList.length === 0) {
    return {
      success: false,
      skipped: true,
      reason: 'Nenhum imóvel para registrar no card.'
    };
  }

  // 1. Busca o card do contato no painel
  const card = await fetchHelenaContactCard(targetContactId, panelId, tokenOverride);
  if (!card || !card.id) {
    return {
      success: false,
      cardFound: false,
      reason: 'Nenhum card encontrado para este lead no painel informado.'
    };
  }

  // 2. Formata o texto da anotação
  const totalCount = incomingList.length;
  const lines = [
    `🏠 **Imóveis Ofertados no Atendimento** (${totalCount} opção${totalCount > 1 ? 'ões' : ''})`,
    ``
  ];

  incomingList.forEach((p, idx) => {
    const pId = p.id || p.codigo || '';
    const valor = p.valorFormatado || p.priceText || (p.valor ? `R$ ${p.valor}` : '');
    const bairro = p.bairro || (p.location && p.location.neighborhood) || '';
    const endereco = p.enderecoCompleto || p.endereco || (bairro ? `${bairro}, Santo André - SP` : '');
    const link = p.url || p.websiteUrl || `https://www.santosemello.com.br/imovel/${pId}`;

    const specs = [];
    if (p.bedrooms > 0) {
      specs.push(`🛏️ ${p.bedrooms} dormitório${p.bedrooms > 1 ? 's' : ''}${p.suites > 0 ? ` (${p.suites} suíte${p.suites > 1 ? 's' : ''})` : ''}`);
    }
    if (p.garage > 0) {
      specs.push(`🚗 ${p.garage} vaga${p.garage > 1 ? 's' : ''}`);
    }

    lines.push(`📌 **Opção ${idx + 1} (Cód. #${pId})**`);
    if (endereco) lines.push(`📍 Endereço: ${endereco}`);
    if (valor) lines.push(`💰 Valor: ${valor}`);
    if (specs.length) lines.push(specs.join(' • '));
    lines.push(`🔗 Link do imóvel: ${link}`);
    lines.push(``); // Espaçamento entre cada imóvel
  });

  const nowBr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  lines.push(`📅 *Registrado pelo Painel Santos & Mello em: ${nowBr}*`);

  const noteText = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // 3. Coleta fotos principais para anexar como imagens no card (até 5 imagens)
  const fileUrls = incomingList
    .map(p => p.primaryImage || p.foto || (Array.isArray(p.images) ? p.images[0] : null))
    .filter(url => typeof url === 'string' && url.startsWith('http'))
    .slice(0, 5);

  // 4. Salva a anotação no card
  const noteResult = await addHelenaCardNote(card.id, { text: noteText, fileUrls }, tokenOverride);

  return {
    success: true,
    cardId: card.id,
    cardKey: card.key,
    cardTitle: card.title,
    noteId: noteResult ? noteResult.id : null,
    totalImoveis: totalCount,
    anexosEnviados: fileUrls.length
  };
}

/**
 * Registra as visitas agendadas nas notas e anexos do card do lead no painel
 * 
 * @param {Object} params
 * @param {string} [params.contactId] UUID do contato
 * @param {string} [params.sessionId] UUID da sessão
 * @param {Array<Object>} params.visits Lista de visitas
 * @param {string} [params.clientName] Nome do cliente
 * @param {string} [params.clientPhone] Telefone do cliente
 * @param {string} [params.panelId] UUID do painel (opcional)
 * @param {string} [params.tokenOverride] Token opcional
 * @returns {Promise<Object>}
 */
async function recordScheduledVisitsInHelenaCard({ contactId, sessionId, visits, clientName = '', clientPhone = '', panelId = null, tokenOverride = null }) {
  let targetContactId = contactId;

  // Se não temos contactId mas temos sessionId, tenta obter o contactId através da sessão
  if (!targetContactId && sessionId) {
    try {
      const sess = await fetchHelenaSession(sessionId, tokenOverride);
      if (sess && sess.contactId) {
        targetContactId = sess.contactId;
      }
    } catch (_) {}
  }

  if (!targetContactId) {
    return {
      success: false,
      skipped: true,
      reason: 'contactId não fornecido e não encontrado na sessão.'
    };
  }

  const incomingVisits = (Array.isArray(visits) ? visits : [visits]).filter(Boolean);
  if (incomingVisits.length === 0) {
    return {
      success: false,
      skipped: true,
      reason: 'Nenhuma visita para registrar no card.'
    };
  }

  // 1. Busca o card do contato no painel
  const card = await fetchHelenaContactCard(targetContactId, panelId, tokenOverride);
  if (!card || !card.id) {
    return {
      success: false,
      cardFound: false,
      reason: 'Nenhum card encontrado para este lead no painel informado.'
    };
  }

  // 2. Formata o texto da anotação
  const totalCount = incomingVisits.length;
  const clientHeader = clientName ? `👤 *Cliente:* ${clientName}${clientPhone ? ` (${clientPhone})` : ''}` : '';
  const lines = [
    `📅 *Visita(s) Agendada(s) com o Lead* (${totalCount} imóvel${totalCount > 1 ? 'is' : ''}):`
  ];
  if (clientHeader) lines.push(clientHeader);
  lines.push('');

  incomingVisits.forEach((v, idx) => {
    const pId = v.propertyId || v.id || v.codigo || '';
    const valor = v.propertyPrice || v.valorFormatado || v.valor || '';
    const endereco = v.propertyAddress || v.enderecoCompleto || '';
    const dataVisita = v.date ? v.date.split('-').reverse().join('/') : 'A definir';
    const horaVisita = v.time || 'A definir';
    const corretor = v.broker || 'Corretor de Plantão';
    const obs = v.notes || '';
    const link = v.propertyUrl || v.url || v.websiteUrl || `https://www.santosemello.com.br/imovel/${pId}`;

    let block = `📌 **Visita ${idx + 1} (Cód. #${pId})**`;
    if (endereco) block += `\n📍 Endereço: ${endereco}`;
    if (valor) block += `\n💰 Valor: ${valor}`;
    block += `\n📅 Data & Horário: ${dataVisita} às ${horaVisita}`;
    if (corretor) block += `\n👨‍💼 Corretor: ${corretor}`;

    if (v.chave && v.chave.formatado) {
      block += `\n🔑 Chave: ${v.chave.formatado}`;
    }

    if (Array.isArray(v.captadores) && v.captadores.length > 0) {
      const cap = v.captadores[0];
      block += `\n🤝 Captador: ${cap.nome}${cap.telefone ? ` (${cap.telefone})` : ''}`;
    }

    if (Array.isArray(v.proprietarios) && v.proprietarios.length > 0) {
      const prop = v.proprietarios[0];
      block += `\n👥 Proprietário/Locador: ${prop.nome}${prop.telefone ? ` (${prop.telefone})` : ''}`;
    }

    if (obs) {
      block += `\n📝 Observações: ${obs}`;
    }

    block += `\n🔗 Link do imóvel: ${link}\n`;
    lines.push(block);
  });

  const nowBr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  lines.push(`📅 *Agendamento registrado pelo Módulo de Visitas Santos & Mello em: ${nowBr}*`);

  const noteText = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // 3. Coleta fotos dos imóveis visitados para anexar (até 5 imagens)
  const fileUrls = incomingVisits
    .map(v => v.propertyPhoto || v.primaryImage || v.foto || (Array.isArray(v.images) ? v.images[0] : null))
    .filter(url => typeof url === 'string' && url.startsWith('http'))
    .slice(0, 5);

  // 4. Salva a anotação no card
  const noteResult = await addHelenaCardNote(card.id, { text: noteText, fileUrls }, tokenOverride);

  return {
    success: true,
    cardId: card.id,
    cardKey: card.key,
    cardTitle: card.title,
    noteId: noteResult ? noteResult.id : null,
    totalVisitas: totalCount,
    anexosEnviados: fileUrls.length
  };
}

/**
 * Registra o feedback de visita e fechamento no Card do Lead no Helena CRM
 * 
 * @param {Object} params
 * @param {string} [params.contactId] ID do contato no Helena CRM
 * @param {string} [params.sessionId] ID da sessão de atendimento
 * @param {string} [params.status] Status da negociação (ex: 'Proposta Fechada / Aprovada')
 * @param {Array<Object>} [params.imoveisFechados] Lista de imóveis fechados/negociados
 * @param {string|number} [params.valor] Valor acordado
 * @param {string} [params.termo] Termo / Prazo da locação ou venda
 * @param {string} [params.garantia] Tipo de garantia locatícia ou condição
 * @param {string} [params.observacoes] Observações do corretor
 * @param {string} [params.clientName] Nome do cliente
 * @param {string} [params.clientPhone] Telefone do cliente
 * @param {string} [params.corretor] Corretor responsável
 * @param {string} [params.panelId] ID do painel
 * @param {string} [params.tokenOverride] Token de API
 * @returns {Promise<Object>} Resultado da gravação no card
 */
async function recordVisitFeedbackInHelenaCard({
  contactId,
  sessionId,
  status = 'Proposta Fechada / Aprovada',
  imoveisFechados = [],
  valor = '',
  termo = '',
  garantia = '',
  observacoes = '',
  clientName = '',
  clientPhone = '',
  corretor = '',
  panelId = null,
  tokenOverride = null
}) {
  let targetContactId = contactId;

  if (!targetContactId && sessionId) {
    try {
      const sess = await fetchHelenaSession(sessionId, tokenOverride);
      if (sess && sess.contactId) {
        targetContactId = sess.contactId;
      }
    } catch (_) {}
  }

  if (!targetContactId) {
    return {
      success: false,
      skipped: true,
      reason: 'contactId não fornecido e não encontrado na sessão.'
    };
  }

  const card = await fetchHelenaContactCard(targetContactId, panelId, tokenOverride);
  if (!card || !card.id) {
    return {
      success: false,
      cardFound: false,
      reason: 'Nenhum card encontrado para este lead no painel informado.'
    };
  }

  const closedProps = (Array.isArray(imoveisFechados) ? imoveisFechados : [imoveisFechados]).filter(Boolean);
  const nowBr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const lines = [
    `🤝 **Feedback de Visita & Fechamento de Proposta**`,
    `🏆 *Resultado da Negociação:* ${status}`,
    ``
  ];

  if (clientName) lines.push(`👤 *Cliente:* ${clientName}${clientPhone ? ` (${clientPhone})` : ''}`);
  if (corretor) lines.push(`👨‍💼 *Corretor Responsável:* ${corretor}`);
  lines.push('');

  if (closedProps.length > 0) {
    lines.push(`🏠 **Imóvel(is) Selecionado(s) no Fechamento:**`, ``);
    closedProps.forEach((p, idx) => {
      const pId = p.id || p.propertyId || p.codigo || '';
      const end = p.address || p.propertyAddress || p.enderecoCompleto || '';
      const val = p.value || p.propertyPrice || p.valorFormatado || '';
      const link = p.url || p.propertyUrl || `https://www.santosemello.com.br/imovel/${pId}`;

      let block = `📌 **Opção Fechada ${idx + 1} (Cód. #${pId})**`;
      if (end) block += `\n📍 Endereço: ${end}`;
      if (val) block += `\n💰 Valor: ${val}`;
      if (link) block += `\n🔗 Link do imóvel: ${link}\n`;
      lines.push(block);
    });
  }

  if (valor) lines.push(`💰 *Valor Acordado / Negociado:* R$ ${valor}`);
  if (termo) lines.push(`📄 *Termo / Prazo:* ${termo}`);
  if (garantia) lines.push(`🛡️ *Garantia / Condição:* ${garantia}`);
  if (observacoes) lines.push(`📝 *Observações da Visita:*\n${observacoes}`);

  lines.push(`\n📅 Registrado via Portal Santos & Mello em: ${nowBr}`);

  const noteText = lines.join('\n');

  // Coleta fotos dos imóveis para anexar
  const fileUrls = [];
  closedProps.forEach(p => {
    const photo = p.photo || p.foto || p.primaryImage;
    if (photo && typeof photo === 'string' && photo.startsWith('http')) {
      fileUrls.push(photo);
    }
  });

  const noteResult = await addHelenaCardNote(card.id, { text: noteText, fileUrls }, tokenOverride);

  return {
    success: true,
    cardId: card.id,
    cardKey: card.key,
    cardTitle: card.title,
    noteId: noteResult ? noteResult.id : null,
    totalImoveisFechados: closedProps.length
  };
}

module.exports = {
  HELENA_BASE_URL,
  HELENA_CHAT_BASE_URL,
  HELENA_CRM_BASE_URL,
  DEFAULT_PANEL_ID,
  fetchHelenaContact,
  fetchHelenaContactSessions,
  fetchHelenaSession,
  updateHelenaSessionMetadata,
  recordSentPropertiesInHelenaSession,
  recordScheduledVisitsInHelenaSession,
  fetchHelenaContactCard,
  addHelenaCardNote,
  recordSentPropertiesInHelenaCard,
  recordScheduledVisitsInHelenaCard,
  recordVisitFeedbackInHelenaCard,
  extractLeadCriteriaFromContact,
  parsePrice,
  parseNumber
};
