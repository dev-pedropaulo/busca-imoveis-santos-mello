const path = require('path');
const ExcelJS = require('exceljs');
const { supabase } = require('../lib/supabase');

async function syncExibirSite() {
  console.log('📖 1. Lendo arquivo Excel bkp_santosemello.xlsx...');
  const filePath = path.join(__dirname, '..', 'bkp_santosemello.xlsx');
  const stream = new ExcelJS.stream.xlsx.WorkbookReader(filePath, { entries: 'emit', worksheets: 'emit' });

  let headerIndexExibir = -1;
  let headerIndexCodigo = -1;
  const idsHabilitados = [];
  const idsDesabilitados = [];

  for await (const entry of stream) {
    if (entry.name === 'Imoveis') {
      for await (const row of entry) {
        if (!row.values) continue;
        if (headerIndexExibir === -1) {
          row.values.forEach((v, idx) => {
            if (v === 'ExibirMeuSiteImovel') headerIndexExibir = idx;
            if (v === 'CodigoImovel') headerIndexCodigo = idx;
          });
          continue;
        }

        const codigo = parseInt(row.values[headerIndexCodigo], 10);
        if (!codigo || isNaN(codigo)) continue;

        const valExibir = String(row.values[headerIndexExibir]).trim();
        if (valExibir === '1') {
          idsHabilitados.push(codigo);
        } else {
          idsDesabilitados.push(codigo);
        }
      }
      break;
    }
  }

  console.log(`✅ Leitura concluída:`);
  console.log(`- Imóveis com ExibirMeuSiteImovel = 1: ${idsHabilitados.length}`);
  console.log(`- Imóveis com ExibirMeuSiteImovel != 1: ${idsDesabilitados.length}`);
  console.log(`- Total lidos: ${idsHabilitados.length + idsDesabilitados.length}`);

  console.log('\n🔄 2. Atualizando Supabase em lotes...');

  // Primeiro passo: desabilita todos os imóveis no banco (ou seta exibir_site = false)
  console.log('Definindo exibir_site = false como base para todos os imóveis...');
  const { error: resetError } = await supabase
    .from('imoveis')
    .update({ exibir_site: false })
    .neq('codigo_imovel', 0);

  if (resetError) {
    console.error('❌ Erro no reset inicial:', resetError.message);
    throw resetError;
  }
  console.log('✅ Reset inicial concluído.');

  // Segundo passo: habilita os 1.316 imóveis em lotes de 200
  const BATCH_SIZE = 200;
  console.log(`Habilitando os ${idsHabilitados.length} imóveis em lotes de ${BATCH_SIZE}...`);

  for (let i = 0; i < idsHabilitados.length; i += BATCH_SIZE) {
    const chunk = idsHabilitados.slice(i, i + BATCH_SIZE);
    const { error: batchError } = await supabase
      .from('imoveis')
      .update({ exibir_site: true })
      .in('codigo_imovel', chunk);

    if (batchError) {
      console.error(`❌ Erro no lote ${i} a ${i + chunk.length}:`, batchError.message);
    } else {
      process.stdout.write(`Atualizados ${Math.min(i + BATCH_SIZE, idsHabilitados.length)}/${idsHabilitados.length}\r`);
    }
  }

  console.log('\n\n🔍 3. Verificando resultado no Supabase...');
  const { count: totalAtivos } = await supabase.from('imoveis').select('*', { count: 'exact', head: true }).eq('ativo', true);
  const { count: totalHabilitados } = await supabase.from('imoveis').select('*', { count: 'exact', head: true }).eq('exibir_site', true);
  const { count: totalDesabilitados } = await supabase.from('imoveis').select('*', { count: 'exact', head: true }).eq('exibir_site', false);

  console.log({
    totalAtivos,
    totalHabilitados,
    totalDesabilitados
  });

  console.log('🎉 Sincronização de exibir_site concluída com sucesso!');
}

syncExibirSite().catch(err => {
  console.error('Falha geral:', err);
  process.exit(1);
});
