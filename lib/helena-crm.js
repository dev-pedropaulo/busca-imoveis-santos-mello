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
  if (!contact) {
    const emptyCriteria = {
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
    vagas: 0,
    regiao: '',
    cidade: '',
    caracteristicas: '',
    contexto: ''
  };

  const criteriosConsiderados = [];

  // Mapeamento dinâmico inspecionando cada chave cadastrada no CRM (com foco no Perfil de Qualificação)
  for (const [key, rawValue] of entries) {
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;

    const kNorm = normKey(key);
    const valStr = Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue).trim();
    if (!valStr || valStr === '-') continue;

    // 1. Destinação (Locação / Venda / Residencial / Comercial)
    if (kNorm.includes('destinacao') || kNorm.includes('destinao') || kNorm.includes('finalidade') || kNorm.includes('transacao') || kNorm.includes('tiponegocio')) {
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
        campoOriginal: key,
        icone: '🎯',
        valorOriginal: valStr,
        impacto: impacto.join(' • ')
      });
    }

    // 2. Tipo do Imóvel (Apartamento, Casa, Sobrado, etc.)
    else if (
      kNorm.includes('tipodoimovel') ||
      kNorm.includes('tipodoimvel') ||
      kNorm.includes('tipoimovel') ||
      kNorm.includes('tipoimvel') ||
      kNorm.includes('tipologia') ||
      (kNorm.includes('tipo') && (kNorm.includes('propriedade') || kNorm.includes('casa') || kNorm.includes('apto') || kNorm.includes('imovel') || kNorm.includes('imvel')))
    ) {
      criteria.tipo = valStr;
      criteriosConsiderados.push({
        campo: 'Tipo do Imóvel',
        campoOriginal: key,
        icone: '🏠',
        valorOriginal: valStr,
        impacto: `Tipo: ${valStr} (com busca de sinônimos)`
      });
    }

    // 3. Bairros / Região
    else if (
      kNorm.includes('bairro') ||
      kNorm.includes('regiao') ||
      kNorm.includes('localizacao') ||
      kNorm.includes('zona')
    ) {
      if (!criteria.regiao) criteria.regiao = valStr;
      else criteria.regiao += `, ${valStr}`;

      criteriosConsiderados.push({
        campo: 'Bairros',
        campoOriginal: key,
        icone: '📍',
        valorOriginal: valStr,
        impacto: `Bairros de interesse: ${valStr}`
      });
    }

    // 4. Orçamento
    else if (
      kNorm.includes('orcamento') ||
      kNorm.includes('oramento') ||
      kNorm.includes('precomax') ||
      kNorm.includes('valormax') ||
      kNorm.includes('valorate') ||
      kNorm.includes('faixadepreco') ||
      kNorm.includes('limitepreco') ||
      kNorm.includes('investimento')
    ) {
      const parsed = parsePrice(valStr);
      if (parsed > 0) {
        criteria.orcamentoMax = parsed;
        criteriosConsiderados.push({
          campo: 'Orçamento',
          campoOriginal: key,
          icone: '💰',
          valorOriginal: valStr,
          impacto: `Teto de orçamento: ${parsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
        });
      }
    }

    // 5. Pet (mantido no contexto do lead, mas removido da lista de filtros acionáveis)
    else if (kNorm.includes('pet') || kNorm.includes('animal')) {
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | Pet: ${valStr}` : `Pet: ${valStr}`;
    }

    // 6. Moradores (Deduz estimativa de quartos)
    else if (kNorm.includes('morador') || kNorm.includes('moradores') || kNorm.includes('pessoas')) {
      const numMoradores = parseNumber(valStr);
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | Moradores: ${valStr}` : `Moradores: ${valStr}`;
      let impactoQuartos = `Moradores: ${valStr}`;

      if (numMoradores >= 4 && !criteria.quartos) {
        criteria.quartos = 3;
        impactoQuartos += ' (Estimado mínimo de 3 dormitórios)';
      } else if (numMoradores === 3 && !criteria.quartos) {
        criteria.quartos = 2;
        impactoQuartos += ' (Estimado mínimo de 2 dormitórios)';
      } else if (numMoradores >= 1 && !criteria.quartos) {
        criteria.quartos = 1;
        impactoQuartos += ' (Estimado mínimo de 1 dormitório)';
      }

      criteriosConsiderados.push({
        campo: 'Moradores',
        campoOriginal: key,
        icone: '👨‍👩‍👧',
        valorOriginal: valStr,
        impacto: impactoQuartos
      });
    }

    // 7. Particularidades & Comodidades
    else if (kNorm.includes('particularidade') || kNorm.includes('comodidade') || kNorm.includes('caracteristica') || kNorm.includes('diferencial') || kNorm.includes('requisito') || kNorm.includes('preferencia')) {
      criteria.caracteristicas = criteria.caracteristicas ? `${criteria.caracteristicas}, ${valStr}` : valStr;
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | Particularidades: ${valStr}` : `Particularidades: ${valStr}`;
      criteriosConsiderados.push({
        campo: 'Particularidades',
        campoOriginal: key,
        icone: '✨',
        valorOriginal: valStr,
        impacto: `Comodidades e contexto: ${valStr}`
      });
    }

    // 8. Motivo (mantido no contexto do lead, mas removido da lista de filtros)
    else if (kNorm.includes('motivo') || kNorm.includes('razao')) {
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | Motivo: ${valStr}` : `Motivo: ${valStr}`;
    }

    // 9. Tempo (mantido no contexto do lead, mas removido da lista de filtros)
    else if (kNorm.includes('tempo') || kNorm.includes('prazo') || kNorm.includes('urgencia')) {
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | Prazo: ${valStr}` : `Prazo: ${valStr}`;
    }

    // 10. Garantia
    else if (kNorm.includes('garantia') || kNorm.includes('fianca')) {
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | Garantia: ${valStr}` : `Garantia: ${valStr}`;
      criteriosConsiderados.push({
        campo: 'Garantia',
        campoOriginal: key,
        icone: '🛡️',
        valorOriginal: valStr,
        impacto: `Garantia pretendida: ${valStr}`
      });
    }

    // Suporte adicional a campos numéricos diretos se existirem
    else if (kNorm.includes('quarto') || kNorm.includes('dormitorio')) {
      const q = parseNumber(valStr);
      if (q > 0) {
        criteria.quartos = q;
        criteriosConsiderados.push({ campo: key, valorOriginal: valStr, impacto: `Mínimo de ${q} dormitórios` });
      }
    } else if (kNorm.includes('vaga') || kNorm.includes('garagem')) {
      const v = parseNumber(valStr);
      if (v > 0) {
        criteria.vagas = v;
        criteriosConsiderados.push({ campo: key, valorOriginal: valStr, impacto: `Mínimo de ${v} vagas` });
      }
    } else if (kNorm.includes('suite')) {
      const s = parseNumber(valStr);
      if (s > 0) {
        criteria.suites = s;
        criteriosConsiderados.push({ campo: key, valorOriginal: valStr, impacto: `Mínimo de ${s} suítes` });
      }
    } else if (kNorm.includes('observac') || kNorm.includes('obs') || kNorm.includes('nota') || kNorm.includes('anotac')) {
      criteria.contexto = criteria.contexto ? `${criteria.contexto} | ${valStr}` : valStr;
      // Mantido apenas no contexto informativo do lead, removido dos filtros acionáveis conforme solicitado
    }
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

module.exports = {
  HELENA_BASE_URL,
  HELENA_CHAT_BASE_URL,
  fetchHelenaContact,
  fetchHelenaContactSessions,
  fetchHelenaSession,
  updateHelenaSessionMetadata,
  recordSentPropertiesInHelenaSession,
  recordScheduledVisitsInHelenaSession,
  extractLeadCriteriaFromContact,
  parsePrice,
  parseNumber
};
