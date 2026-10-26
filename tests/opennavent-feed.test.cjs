const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  OpenNaventFeedGenerator,
  openNaventFeedGenerator,
  renderOpenNaventImovelXml,
  resolveOpenNaventType
} = require('../lib/opennavent-feed-generator');

test('OpenNavent Feed - Mapeamento de Tipos de Imóveis', () => {
  // Apartamentos
  const apt = resolveOpenNaventType('Apartamento');
  assert.equal(apt.idTipo, '2');
  assert.equal(apt.idSubTipo, '1');
  assert.equal(apt.tipo, 'Apartamento');

  // Cobertura
  const cob = resolveOpenNaventType('Cobertura Duplex');
  assert.equal(cob.idTipo, '2');
  assert.equal(cob.tipo, 'Apartamento');

  // Sobrado
  const sob = resolveOpenNaventType('Sobrado');
  assert.equal(sob.idTipo, '1');
  assert.equal(sob.idSubTipo, '33');
  assert.equal(sob.tipo, 'Casa');

  // Casa padrão
  const casa = resolveOpenNaventType('Casa');
  assert.equal(casa.idTipo, '1');
  assert.equal(casa.idSubTipo, '5');
  assert.equal(casa.tipo, 'Casa');

  // Terreno
  const terreno = resolveOpenNaventType('Terreno');
  assert.equal(terreno.idTipo, '1003');
  assert.equal(terreno.idSubTipo, '8');
  assert.equal(terreno.tipo, 'Terreno');

  // Comercial
  const salao = resolveOpenNaventType('Salão Comercial');
  assert.equal(salao.idTipo, '1005');
  assert.equal(salao.tipo, 'Comercial');
});

test('OpenNavent Feed - Renderização de XML do Imóvel (<Imovel>)', () => {
  const mockImovel = {
    codigo_imovel: 9999,
    titulo: 'Lindo Apartamento no Bairro Jardim',
    descricao: 'Imóvel amplo com excelente acabamento e varanda.',
    tipo_imovel: 'Apartamento',
    finalidade: 'Venda/Locação',
    valor_venda: 650000,
    valor_locacao: 3200,
    valor_condominio: 800,
    valor_iptu: 250,
    quartos: 3,
    suites: 1,
    banheiros: 2,
    vagas: 2,
    area_interna: 98,
    area_externa: 120,
    endereco: 'Rua das Figueiras',
    numero: '123',
    complemento: 'Apto 42',
    bairro: 'Bairro Jardim',
    cidade: 'Santo André',
    estado: 'SP',
    cep: '09080300',
    latitude: -23.6543,
    longitude: -46.5321,
    ar_condicionado: true,
    churrasqueira: true,
    elevador: true,
    portaria_24h: true,
    piscina: true,
    exclusivo: true
  };

  const mockPhotos = [
    'https://img.santosemello.com.br/foto1.jpg',
    'https://img.santosemello.com.br/foto2.jpg'
  ];

  const xml = renderOpenNaventImovelXml(mockImovel, mockPhotos);

  // Valida nós essenciais
  assert.ok(xml.includes('<Imovel>'));
  assert.ok(xml.includes('<codigoAnuncio><![CDATA[9999]]></codigoAnuncio>'));
  assert.ok(xml.includes('<idTipo><![CDATA[2]]></idTipo>'));
  assert.ok(xml.includes('<tipo><![CDATA[Apartamento]]></tipo>'));
  assert.ok(xml.includes('<tipoPublicacao><![CDATA[DESTACADO]]></tipoPublicacao>'));

  // Valida preços de Venda e Locação
  assert.ok(xml.includes('<operacao><![CDATA[VENTA]]></operacao>'));
  assert.ok(xml.includes('<quantidade><![CDATA[650000]]></quantidade>'));
  assert.ok(xml.includes('<operacao><![CDATA[ALQUILER]]></operacao>'));
  assert.ok(xml.includes('<quantidade><![CDATA[3200]]></quantidade>'));

  // Valida CFTs
  assert.ok(xml.includes('<id><![CDATA[CFT2]]></id>')); // Quartos
  assert.ok(xml.includes('<id><![CDATA[CFT3]]></id>')); // Banheiros
  assert.ok(xml.includes('<id><![CDATA[CFT4]]></id>')); // Suítes
  assert.ok(xml.includes('<id><![CDATA[CFT7]]></id>')); // Vagas
  assert.ok(xml.includes('<id><![CDATA[CFT101]]></id>')); // Área útil
  assert.ok(xml.includes('<id><![CDATA[CFT6]]></id>')); // Condomínio
  assert.ok(xml.includes('<id><![CDATA[CFT400]]></id>')); // IPTU

  // Valida comodidades (20xxx e 10xxx/30xxx)
  assert.ok(xml.includes('<id><![CDATA[20012]]></id>')); // Ar condicionado
  assert.ok(xml.includes('<id><![CDATA[10071]]></id>')); // Elevador
  assert.ok(xml.includes('<id><![CDATA[10158]]></id>')); // Portaria 24h
  assert.ok(xml.includes('<id><![CDATA[30025]]></id>')); // Piscina

  // Valida fotos
  assert.ok(xml.includes('https://img.santosemello.com.br/foto1.jpg'));
  assert.ok(xml.includes('https://img.santosemello.com.br/foto2.jpg'));

  // Valida localização
  assert.ok(xml.includes('Bairro Jardim, Santo André, SP, Brasil'));
  assert.ok(xml.includes('Rua das Figueiras, 123 - Apto 42'));
  assert.ok(xml.includes('09080300'));
});

test('OpenNavent Feed - Estrutura do Documento XML Raiz (<OpenNavent>)', async () => {
  const generator = new OpenNaventFeedGenerator();
  const mockProperties = [
    {
      codigo_imovel: 101,
      titulo: 'Casa Térrea para Venda',
      tipo_imovel: 'Casa',
      finalidade: 'Venda',
      valor_venda: 450000,
      bairro: 'Campestre',
      cidade: 'Santo André',
      ativo: true,
      exibir_site: true
    }
  ];

  const result = await generator.generateXml(mockProperties);
  assert.ok(result.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(result.xml.includes('<OpenNavent>'));
  assert.ok(result.xml.includes('</OpenNavent>'));
  assert.ok(result.xml.includes('<dataModificacao>'));
  assert.ok(result.xml.includes('<Imoveis>'));
  assert.ok(result.xml.includes('</Imoveis>'));
  assert.equal(result.count, 1);
});

test('OpenNavent HTTP - Rotas do Feed e Webhook de Leads', async () => {
  const app = require('../server');
  const server = http.createServer(app);

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Testa rota de teste do XML Imovelweb
    const resXml = await fetch(`${baseUrl}/feed/imovelweb-teste.xml?limit=2`);
    assert.equal(resXml.status, 200);
    assert.ok(resXml.headers.get('content-type').includes('xml'));
    const xmlText = await resXml.text();
    assert.ok(xmlText.includes('<OpenNavent>'));
    assert.ok(xmlText.includes('</OpenNavent>'));
    assert.ok(xmlText.includes('<dataModificacao>'));

    // 2. Testa Webhook de recebimento de Leads
    const mockLead = {
      leadId: 'test-lead-navent-123',
      clientName: 'Beatriz Teste',
      clientEmail: 'beatriz.teste@navent.com',
      clientPhone: '11988889999',
      message: 'Olá, gostaria de mais informações sobre o imóvel 2.',
      propertyId: '2',
      origin: 'Imovelweb'
    };

    const resWebhook = await fetch(`${baseUrl}/api/leads/imovelweb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockLead)
    });

    assert.equal(resWebhook.status, 200);
    const bodyWebhook = await resWebhook.json();
    assert.equal(bodyWebhook.success, true);
    assert.equal(bodyWebhook.leadId, 'test-lead-navent-123');
    assert.equal(bodyWebhook.lead.nome, 'Beatriz Teste');
    assert.equal(bodyWebhook.lead.codigoImovel, '2');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
