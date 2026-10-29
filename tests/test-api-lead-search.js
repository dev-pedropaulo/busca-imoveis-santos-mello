const http = require('node:http');
const app = require('../server');

async function testMatchEndpoint() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  console.log(`📡 Servidor de teste ouvindo na porta ${port}...`);

  // Simula requisição com parâmetros derivados do Perfil 02
  const url = `http://localhost:${port}/api/leads/match?tipo=Apartamento&finalidade=Loca%C3%A7%C3%A3o&orcamento=3000&quartos=2&pet=Sim,%20dois%20gatos`;
  const res = await fetch(url);
  const data = await res.json();

  console.log('Status HTTP:', res.status);
  console.log('Success:', data.success);
  console.log('Total de imóveis compatíveis:', data.totalMatches);
  console.log('Lead Profile:', JSON.stringify(data.leadProfile, null, 2));

  if (data.matchedItems && data.matchedItems.length > 0) {
    console.log('\nExemplo de Imóvel compatível:', {
      id: data.matchedItems[0].id,
      titulo: data.matchedItems[0].title,
      preco: data.matchedItems[0].rentalPrice || data.matchedItems[0].price,
      matchScore: data.matchedItems[0].matchScore,
      highlights: data.matchedItems[0].matchHighlights
    });
  }

  server.close();
  console.log('\n✅ Teste do endpoint /api/leads/match concluído com sucesso!');
}

testMatchEndpoint().catch(err => {
  console.error('❌ Erro no teste do endpoint:', err);
  process.exit(1);
});
