const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { supabase } = require('../lib/supabase');

const FILE_PATH = path.join(__dirname, '..', 'bkp_santosemello.xlsx');
const BATCH_SIZE = 500;

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const num = Number(val);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (str === 'NULL' || str === '') return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function parseNum(val, isFloat = false) {
  if (val === null || val === undefined) return null;
  const str = String(val).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
  if (str === '' || str === 'NULL') return null;
  const num = isFloat ? parseFloat(str) : parseInt(str, 10);
  return isNaN(num) ? null : num;
}

function parseBool(val) {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return s === 'sim' || s === 'true' || s === '1' || s === 's';
}

function cleanStr(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return (s === 'NULL' || s === '') ? null : s;
}

// 1. MIGRAÇÃO DE CONDOMÍNIOS
async function migrateCondominios(workbook) {
  console.log('\n--- 🏢 Migrando Condomínios ---');
  const sheet = workbook.getWorksheet('Condominio');
  if (!sheet) return;

  const map = new Map();
  const headers = {};
  
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '').trim();
      });
      return;
    }
    
    const obj = {};
    row.eachCell((cell, colNumber) => {
      const colName = headers[colNumber];
      if (colName) obj[colName] = cell.value;
    });

    const codigo = parseNum(obj['CodigoCondominio']);
    if (!codigo) return;

    map.set(codigo, {
      codigo_condominio: codigo,
      nome: cleanStr(obj['NomeCondominio']) || `Condomínio #${codigo}`,
      tipo: cleanStr(obj['TipoCondominio']),
      destinacao: cleanStr(obj['destinacaocondominio']),
      construtora: cleanStr(obj['ConstrutoraCondominio']),
      cep: cleanStr(obj['CepCondominio']),
      endereco: cleanStr(obj['EnderecoCondominio']),
      numero: cleanStr(obj['NumeroEnderecoCondominio']),
      bairro: cleanStr(obj['NomeBairro']),
      cidade: cleanStr(obj['NomeCidade']),
      ponto_referencia: cleanStr(obj['PontoReferenciaCondominio']),
      latitude: parseNum(obj['LatitudeCondominio'], true),
      longitude: parseNum(obj['LongitudeCondominio'], true),
      ano_construcao: parseNum(obj['AnoConstrucaoCondominio']),
      descricao: cleanStr(obj['DescricaoCondominio']),
      anotacoes: cleanStr(obj['AnotacoesCondominio']),
      cartorio: cleanStr(obj['CartorioCondominio']),
      matricula: cleanStr(obj['MatriculaCartorioCondominio'])
    });
  });

  const rows = Array.from(map.values());
  console.log(`Condomínios únicos lidos: ${rows.length}. Gravando em lotes...`);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('condominios').upsert(chunk, { onConflict: 'codigo_condominio' });
    if (error) console.error(`Erro lote condomínios ${i}:`, error.message);
    process.stdout.write(`Gravados ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }
  console.log(`\n✅ Condomínios concluídos!`);
}

// 2. MIGRAÇÃO DE PESSOAS
async function migratePessoas(workbook) {
  console.log('\n--- 👥 Migrando Pessoas ---');
  const sheet = workbook.getWorksheet('pessoas');
  if (!sheet) return;

  const map = new Map();
  const headers = {};
  
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '').trim();
      });
      return;
    }
    
    const obj = {};
    row.eachCell((cell, colNumber) => {
      const colName = headers[colNumber];
      if (colName) obj[colName] = cell.value;
    });

    const codigo = parseNum(obj['CodigoPessoa']);
    if (!codigo) return;

    map.set(codigo, {
      codigo_pessoa: codigo,
      codigo_auxiliar: cleanStr(obj['CodigoAuxiliarPessoa']),
      nome: cleanStr(obj['NomePessoa']) || `Pessoa #${codigo}`,
      cpf_cnpj: cleanStr(obj['CpfPessoa']) || cleanStr(obj['CnpjEmpresa']),
      tipo_pessoa: cleanStr(obj['TipoPessoa']) || 'PF',
      numero_documento: cleanStr(obj['NumeroDocumento']),
      data_emissao_documento: parseExcelDate(obj['DataEmissaoDocumento']),
      data_nascimento: parseExcelDate(obj['DataNascimentoPessoa']),
      estado_civil: cleanStr(obj['EstadoCivilPessoa']),
      sexo: cleanStr(obj['SexoPessoa']),
      nacionalidade: cleanStr(obj['NomeNacionalidade']),
      profissao: cleanStr(obj['NomeProfissao']),
      renda_mensal: parseNum(obj['RendaMensalPessoa'], true),
      endereco: cleanStr(obj['Endereco']),
      numero: cleanStr(obj['NumeroEndereco']),
      complemento: cleanStr(obj['ComplementoEndereco']),
      bairro: cleanStr(obj['NomeBairro']),
      cidade: cleanStr(obj['NomeCidade']),
      cep: cleanStr(obj['CepEndereco']),
      anotacoes: cleanStr(obj['AnotacoesPessoa'])
    });
  });

  const rows = Array.from(map.values());
  console.log(`Pessoas únicas lidas: ${rows.length}. Gravando em lotes...`);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('pessoas').upsert(chunk, { onConflict: 'codigo_pessoa' });
    if (error) console.error(`Erro lote pessoas ${i}:`, error.message);
    if (i % 2500 === 0 || i + BATCH_SIZE >= rows.length) {
      process.stdout.write(`Gravadas ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
    }
  }
  console.log(`\n✅ Pessoas concluídas!`);
}

// 3. MIGRAÇÃO DE CONTATOS (Pessoas x emails)
async function migratePessoasContatos(workbook) {
  console.log('\n--- 📞 Migrando Contatos de Pessoas ---');
  const sheet = workbook.getWorksheet('Pessoas x emails');
  if (!sheet) return;

  const set = new Set();
  const rows = [];
  const headers = {};
  
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '').trim();
      });
      return;
    }
    
    const obj = {};
    row.eachCell((cell, colNumber) => {
      const colName = headers[colNumber];
      if (colName) obj[colName] = cell.value;
    });

    const codigoPessoa = parseNum(obj['CodigoPessoa']);
    const email = cleanStr(obj['Email']);
    const tel = cleanStr(obj['Telefone']);
    if (!codigoPessoa || (!email && !tel)) return;

    const key = `${codigoPessoa}|${email || ''}|${tel || ''}`;
    if (set.has(key)) return;
    set.add(key);

    rows.push({
      codigo_pessoa: codigoPessoa,
      email: email,
      telefone: tel,
      tipo_contato: 'principal'
    });
  });

  console.log(`Contatos únicos lidos: ${rows.length}. Gravando em lotes...`);
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const { error } = await supabase.from('pessoa_contatos').insert(chunk);
    if (error) console.error(`Erro lote contatos ${i}:`, error.message);
    if (i % 5000 === 0 || i + 1000 >= rows.length) {
      process.stdout.write(`Gravados ${Math.min(i + 1000, rows.length)}/${rows.length}\r`);
    }
  }
  console.log(`\n✅ Contatos concluídos!`);
}

// 4. MIGRAÇÃO DE IMÓVEIS
async function migrateImoveis(workbook) {
  console.log('\n--- 🏠 Migrando Imóveis ---');
  const sheet = workbook.getWorksheet('Imoveis');
  if (!sheet) return;

  const { data: conds } = await supabase.from('condominios').select('codigo_condominio').limit(10000);
  const validConds = new Set((conds || []).map(c => c.codigo_condominio));
  console.log(`Condomínios válidos no banco: ${validConds.size}`);

  const map = new Map();
  const headers = {};
  
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '').trim();
      });
      return;
    }
    
    const obj = {};
    row.eachCell((cell, colNumber) => {
      const colName = headers[colNumber];
      if (colName) obj[colName] = cell.value;
    });

    const codigo = parseNum(obj['CodigoImovel']);
    if (!codigo) return;

    const finalidade = cleanStr(obj['FinalidadeImovel']) || 'Ambos';
    const valor = parseNum(obj['ValorImovel'], true);

    map.set(codigo, {
      codigo_imovel: codigo,
      finalidade: finalidade,
      destinacao: cleanStr(obj['DestinacaoImovel']),
      situacao: cleanStr(obj['SituacaoImovel']),
      tipo_imovel: cleanStr(obj['NomeTipoImovel']) || 'Imóvel',
      titulo: cleanStr(obj['TituloImovel']),
      descricao: cleanStr(obj['DescricaoImovel']),
      
      valor_venda: finalidade === 'Venda' || finalidade === 'Ambos' ? valor : null,
      valor_locacao: finalidade === 'Aluguel' || finalidade === 'Locação' || finalidade === 'Ambos' ? valor : null,
      valor_condominio: parseNum(obj['ValorCondominioImovel'], true),
      valor_iptu: parseNum(obj['ValorIptuImovel'], true),
      valor_fundo_reserva: parseNum(obj['ValorFundoReservaCondominio'], true),
      
      codigo_condominio: (parseNum(obj['CodigoCondominio']) && validConds.has(parseNum(obj['CodigoCondominio']))) ? parseNum(obj['CodigoCondominio']) : null,
      nome_condominio: cleanStr(obj['NomeCondominio']),
      edificio: cleanStr(obj['EdificioImovel']),
      bloco: cleanStr(obj['BlocoImovel']),
      andar: cleanStr(obj['AndarImovel']),
      numero_andar: parseNum(obj['NumeroAndarImovel']),
      endereco: cleanStr(obj['EnderecoImovel']),
      numero: cleanStr(obj['NumeroEnderecoImovel']),
      complemento: cleanStr(obj['ComplementoEnderecoImovel']),
      bairro: cleanStr(obj['NomeBairro']),
      cidade: cleanStr(obj['NomeCidade']),
      estado: cleanStr(obj['EstadoCidade']) || 'SP',
      cep: cleanStr(obj['CepImovel']),
      ponto_referencia: cleanStr(obj['PontoReferenciaImovel']),
      latitude: parseNum(obj['LatitudeImovel'], true),
      longitude: parseNum(obj['LongitudeImovel'], true),
      
      quartos: parseNum(obj['NumeroQuartoImovel']) || 0,
      suites: parseNum(obj['NumeroSuiteImovel']) || 0,
      salas: parseNum(obj['NumeroSalaImovel']) || 0,
      banheiros: parseNum(obj['NumeroBanheiroImovel']) || 0,
      varandas: parseNum(obj['NumeroVarandaImovel']) || 0,
      vagas: parseNum(obj['NumeroVagaImovel']) || 0,
      tipo_vaga: cleanStr(obj['tipovagaImovel']),
      area_interna: parseNum(obj['AreaInternaImovel'], true),
      area_externa: parseNum(obj['AreaExternaImovel'], true),
      area_privativa: parseNum(obj['AreaPrivativaImovel'], true),
      area_lote: parseNum(obj['AreaLoteImovel'], true),
      
      portaria_24h: parseBool(obj['Portaria24HrsImovel']),
      portao_eletronico: parseBool(obj['PortaoEletronicoImovel']),
      interfone: parseBool(obj['InterfoneImovel']),
      elevador: (parseNum(obj['NumeroElevadorImovel']) || 0) > 0,
      ar_condicionado: parseBool(obj['ArCondicionadoImovel']),
      aquecimento_solar: parseBool(obj['AquecimentoSolarImovel']),
      area_servico: parseBool(obj['AreaServicoImovel']),
      varanda_gourmet: parseBool(obj['VarandaGourmetImovel']),
      closet: parseBool(obj['ClosetImovel']),
      dce: parseBool(obj['DceImovel']),
      lavabo: parseBool(obj['LavaboImovel']),
      mobiliado: parseBool(obj['MobiliadoImovel']),
      aceita_financiamento: parseBool(obj['AceitaFinanciamentoImovel']),
      aceita_permuta: parseBool(obj['AceitaPermutaImovel']),
      exclusivo: parseBool(obj['ExclusivoImovel']),
      exibir_site: cleanStr(obj['ExibirMeuSiteImovel']) !== 'Não',
      
      local_chave: cleanStr(obj['NomeLocalChave']) || 'Imobiliária',
      anotacoes_internas: cleanStr(obj['AnotacoesImovel']),
      ativo: true
    });
  });

  const rows = Array.from(map.values());
  console.log(`Imóveis únicos lidos: ${rows.length}. Gravando em lotes...`);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('imoveis').upsert(chunk, { onConflict: 'codigo_imovel' });
    if (error) console.error(`Erro lote imóveis ${i}:`, error.message);
    process.stdout.write(`Gravados ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }
  console.log(`\n✅ Imóveis concluídos!`);
}

// 5. MIGRAÇÃO DE VÍNCULOS PROPRIETÁRIOS & CAPTADORES
async function migrateProprietariosECaptadores(workbook) {
  console.log('\n--- 🤝 Migrando Proprietários dos Imóveis ---');
  const sheetProp = workbook.getWorksheet('Imoveis x proprietarios');
  if (sheetProp) {
    const map = new Map();
    const headers = {};
    sheetProp.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((c, col) => headers[col] = String(c.value || '').trim());
        return;
      }
      const obj = {};
      row.eachCell((c, col) => { if (headers[col]) obj[headers[col]] = c.value; });
      const imovel = parseNum(obj['CodigoImovel']);
      const prop = parseNum(obj['CodigoProprietario']);
      if (imovel && prop) {
        const key = `${imovel}_${prop}`;
        map.set(key, {
          codigo_imovel: imovel,
          codigo_proprietario: prop,
          percentual_participacao: parseNum(obj['PercentualProprietario'], true) || 100
        });
      }
    });

    const rows = Array.from(map.values());
    console.log(`Vínculos de Proprietários únicos: ${rows.length}. Gravando...`);
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000);
      const { error } = await supabase.from('imovel_proprietarios').upsert(chunk, { onConflict: 'codigo_imovel,codigo_proprietario' });
      if (error) console.error(`Erro lote proprietários ${i}:`, error.message);
      process.stdout.write(`Gravados ${Math.min(i + 1000, rows.length)}/${rows.length}\r`);
    }
    console.log(`\n✅ Proprietários concluídos!`);
  }

  console.log('\n--- 🎖️ Migrando Captadores dos Imóveis ---');
  const sheetCap = workbook.getWorksheet('Imoveis x captadores');
  if (sheetCap) {
    const map = new Map();
    const headers = {};
    sheetCap.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((c, col) => headers[col] = String(c.value || '').trim());
        return;
      }
      const obj = {};
      row.eachCell((c, col) => { if (headers[col]) obj[headers[col]] = c.value; });
      const imovel = parseNum(obj['CodigoImovel']);
      const cap = parseNum(obj['CodigoCaptador']);
      if (imovel && cap) {
        const key = `${imovel}_${cap}`;
        map.set(key, {
          codigo_imovel: imovel,
          codigo_captador: cap,
          percentual_comissao: parseNum(obj['PercentualCaptador'], true),
          principal: parseBool(obj['PrincipalCaptador'])
        });
      }
    });

    const rows = Array.from(map.values());
    console.log(`Vínculos de Captadores únicos: ${rows.length}. Gravando...`);
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000);
      const { error } = await supabase.from('imovel_captadores').upsert(chunk, { onConflict: 'codigo_imovel,codigo_captador' });
      if (error) console.error(`Erro lote captadores ${i}:`, error.message);
      process.stdout.write(`Gravados ${Math.min(i + 1000, rows.length)}/${rows.length}\r`);
    }
    console.log(`\n✅ Captadores concluídos!`);
  }
}

// 6. MIGRAÇÃO DE FOTOS DOS IMÓVEIS (173.342 fotos)
async function migrateFotos(workbook) {
  console.log('\n--- 📸 Migrando Fotos dos Imóveis ---');
  const sheet = workbook.getWorksheet('Imoveis x fotos');
  if (!sheet) return;

  const { data: imovs } = await supabase.from('imoveis').select('codigo_imovel').limit(20000);
  const validImoveis = new Set((imovs || []).map(i => i.codigo_imovel));
  console.log(`Imóveis válidos para fotos no banco: ${validImoveis.size}`);

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const codigoImovel = parseNum(row.getCell(1).value);
    const tipoFoto = cleanStr(row.getCell(2).value);
    const descricao = cleanStr(row.getCell(3).value);
    const url = cleanStr(row.getCell(4).value);
    const ordem = parseNum(row.getCell(5).value) || 0;

    if (!codigoImovel || !url || !validImoveis.has(codigoImovel)) return;

    rows.push({
      codigo_imovel: codigoImovel,
      url_original: url,
      tipo_foto: tipoFoto,
      descricao: descricao,
      ordem: ordem,
      destaque: ordem === 0
    });
  });

  console.log(`Fotos válidas lidas: ${rows.length}. Gravando em lotes de 1.000...`);
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const { error } = await supabase.from('imovel_fotos').insert(chunk);
    if (error) console.error(`Erro lote fotos ${i}:`, error.message);
    if (i % 10000 === 0 || i + 1000 >= rows.length) {
      process.stdout.write(`Gravadas ${Math.min(i + 1000, rows.length)}/${rows.length}\r`);
    }
  }
  console.log(`\n✅ Fotos dos imóveis concluídas!`);
}

async function main() {
  const step = process.argv[2] || 'all';
  console.log(`Iniciando migração do arquivo: ${FILE_PATH} (Passo: ${step})`);

  console.time('Tempo de carga da planilha');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(FILE_PATH);
  console.timeEnd('Tempo de carga da planilha');

  if (step === 'all' || step === 'condominios') {
    await migrateCondominios(workbook);
  }
  if (step === 'all' || step === 'pessoas') {
    await migratePessoas(workbook);
    await migratePessoasContatos(workbook);
  }
  if (step === 'contatos') {
    await migratePessoasContatos(workbook);
  }
  if (step === 'all' || step === 'imoveis') {
    await migrateImoveis(workbook);
    await migrateProprietariosECaptadores(workbook);
  }
  if (step === 'all' || step === 'fotos') {
    await migrateFotos(workbook);
  }

  console.log('\n🚀 PROCESSO DE MIGRAÇÃO CONCLUÍDO COM SUCESSO!');
}

main().catch(err => {
  console.error('❌ Falha na migração:', err);
  process.exit(1);
});
