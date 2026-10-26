const { test, describe } = require('node:test');
const assert = require('node:assert');
const { XMLParser } = require('fast-xml-parser');
const {
  XmlFeedGenerator,
  xmlFeedGenerator,
  renderListingXml,
  escapeXml,
  escapeCdata,
  resolvePropertyType,
  resolveTransactionType,
  extractPropertyFeatures,
  DEFAULT_FEED_CONFIG
} = require('../lib/xml-feed-generator');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true
});

describe('Gerador de XML Feed VivaReal / VRSync (Imoview)', () => {

  describe('1. Segurança e Sanitização de Dados', () => {
    test('escapeXml deve escapar caracteres reservados e remover caracteres de controle inválidos', () => {
      const input = 'Apartamento & Sobrado <Luxo> "Top" \'Especial\' \x00\x08';
      const output = escapeXml(input);
      assert.strictEqual(output.includes('&amp;'), true);
      assert.strictEqual(output.includes('&lt;'), true);
      assert.strictEqual(output.includes('&gt;'), true);
      assert.strictEqual(output.includes('&quot;'), true);
      assert.strictEqual(output.includes('&apos;'), true);
      assert.strictEqual(output.includes('\x00'), false);
      assert.strictEqual(output.includes('\x08'), false);
    });

    test('escapeCdata deve neutralizar injeção de fechamento de CDATA ]]>', () => {
      const malicious = 'Texto normal ]]> <script>alert(1)</script> <![CDATA[continuação';
      const safe = escapeCdata(malicious);
      assert.strictEqual(safe.includes(']]]]><![CDATA[>'), true);
      // Ao colocar dentro de CDATA não deve quebrar
      const fullXml = `<Description><![CDATA[${safe}]]></Description>`;
      const parsed = parser.parse(fullXml);
      assert.strictEqual(typeof parsed.Description, 'string');
      assert.strictEqual(parsed.Description.includes('alert(1)'), true);
    });

    test('Nenhum dado confidencial ou sensível deve vazar no XML do imóvel', () => {
      const mockImovel = {
        codigo_imovel: 9999,
        titulo: 'Apartamento Seguro',
        tipo_imovel: 'Apartamento',
        finalidade: 'Venda',
        destinacao: 'Residencial',
        valor_venda: 500000,
        // Campos que NUNCA podem aparecer no feed
        nome_proprietario: 'João da Silva Sigiloso',
        cpf_proprietario: '123.456.789-00',
        telefone_proprietario: '(11) 98888-7777',
        codigo_chave: 'CLAV-9999',
        local_chave: 'Gaveta 3',
        placa: 'PLACA-1234',
        anotacoes_internas: 'Proprietário aceita negociar 10% a menos'
      };

      const xml = renderListingXml(mockImovel, ['https://exemplo.com/foto1.jpg']);

      // Asserções estritas de sigilo e segurança
      assert.strictEqual(xml.includes('João da Silva Sigiloso'), false, 'Vazou nome do proprietário!');
      assert.strictEqual(xml.includes('123.456.789-00'), false, 'Vazou CPF do proprietário!');
      assert.strictEqual(xml.includes('(11) 98888-7777'), false, 'Vazou telefone pessoal!');
      assert.strictEqual(xml.includes('CLAV-9999'), false, 'Vazou código de chave física!');
      assert.strictEqual(xml.includes('Gaveta 3'), false, 'Vazou localização de chave!');
      assert.strictEqual(xml.includes('aceita negociar 10%'), false, 'Vazou anotação confidencial!');

      // Contato deve ser EXCLUSIVAMENTE institucional
      assert.strictEqual(xml.includes('Financeiro@santosemello.com.br'), true);
      assert.strictEqual(xml.includes('1144692121'), true);
      assert.strictEqual(xml.includes('SANTOS E MELLO IMOVEIS LTDA'), true);
      assert.strictEqual(xml.includes('displayAddress="Neighborhood"'), true, 'Endereço deve exibir apenas Neighborhood no portal');
    });
  });

  describe('2. Mapeamento de Tipos, Transações e Features', () => {
    test('resolveTransactionType deve classificar corretamente Venda, Locação e Ambos', () => {
      assert.strictEqual(resolveTransactionType('Venda', 500000, 0), 'For Sale');
      assert.strictEqual(resolveTransactionType('Aluguel', 0, 2500), 'For Rent');
      assert.strictEqual(resolveTransactionType('Locação', 0, 2500), 'For Rent');
      assert.strictEqual(resolveTransactionType('Venda e Aluguel', 500000, 2500), 'Sale/Rent');
      assert.strictEqual(resolveTransactionType('Venda', 500000, 2500), 'Sale/Rent');
    });

    test('resolvePropertyType deve mapear tipos residenciais e comerciais conforme padrão VivaReal', () => {
      const sobrado = resolvePropertyType('Sobrado', 'Residencial');
      assert.strictEqual(sobrado.usage, 'Residential');
      assert.strictEqual(sobrado.type, 'Residential / Sobrado');

      const apto = resolvePropertyType('Apartamento', 'Residencial');
      assert.strictEqual(apto.usage, 'Residential');
      assert.strictEqual(apto.type, 'Residential / Apartment');

      const cob = resolvePropertyType('Cobertura', 'Residencial');
      assert.strictEqual(cob.usage, 'Residential');
      assert.strictEqual(cob.type, 'Residential / Penthouse');

      const loja = resolvePropertyType('Salão', 'Comercial');
      assert.strictEqual(loja.usage, 'Commercial');
      assert.strictEqual(loja.type, 'Commercial / Store');

      const sala = resolvePropertyType('Sala', 'Comercial');
      assert.strictEqual(sala.usage, 'Commercial');
      assert.strictEqual(sala.type, 'Commercial / Office');

      const galpao = resolvePropertyType('Galpão', 'Comercial');
      assert.strictEqual(galpao.usage, 'Commercial');
      assert.strictEqual(galpao.type, 'Commercial / Industrial');
    });

    test('extractPropertyFeatures deve traduzir comodidades para vocabulário oficial VivaReal', () => {
      const imovel = {
        vagas: 2,
        portaria_24h: true,
        elevador: true,
        interfone: true,
        ar_condicionado: true,
        varanda_gourmet: true,
        closet: true,
        mobiliado: true,
        features: ['Piscina', 'Churrasqueira', 'Academia', 'Salão de Festas']
      };

      const feats = extractPropertyFeatures(imovel);
      assert.strictEqual(feats.includes('Parking Garage'), true);
      assert.strictEqual(feats.includes('Kitchen'), true);
      assert.strictEqual(feats.includes('Security Guard on Duty'), true);
      assert.strictEqual(feats.includes('Elevator'), true);
      assert.strictEqual(feats.includes('Intercom'), true);
      assert.strictEqual(feats.includes('Cooling'), true);
      assert.strictEqual(feats.includes('Gourmet Area'), true);
      assert.strictEqual(feats.includes('Balcony'), true);
      assert.strictEqual(feats.includes('Closet'), true);
      assert.strictEqual(feats.includes('Furnished'), true);
      assert.strictEqual(feats.includes('Pool'), true);
      assert.strictEqual(feats.includes('BBQ'), true);
      assert.strictEqual(feats.includes('Gym'), true);
      assert.strictEqual(feats.includes('Party Room'), true);
    });
  });

  describe('3. Renderização e Conformance com Schema VRSync', () => {
    test('renderListingXml deve produzir XML válido e parseável', () => {
      const imovel = {
        codigo_imovel: 8797,
        titulo: 'Sobrado para Venda no Jardim Santo Antônio',
        finalidade: 'Venda',
        destinacao: 'Residencial',
        tipo_imovel: 'Sobrado',
        valor_venda: 620000,
        valor_locacao: 0,
        valor_condominio: 0,
        valor_iptu: 65,
        area_interna: 170,
        quartos: 2,
        banheiros: 2,
        suites: 0,
        vagas: 2,
        descricao: 'Excelente sobrado para locação e venda muito bem localizado.',
        cidade: 'Santo André',
        bairro: 'Jardim Santo Antônio',
        endereco: 'Avenida Alfredo Maluf',
        numero: '712',
        cep: '09240410',
        latitude: -23.6282751,
        longitude: -46.5199708
      };

      const photos = [
        'https://cdn.imoview.com.br/santosemello/Imoveis/8797/foto1.jpg',
        'https://cdn.imoview.com.br/santosemello/Imoveis/8797/foto2.jpg'
      ];

      const xml = renderListingXml(imovel, photos);
      assert.strictEqual(typeof xml, 'string');

      // Validar parser
      const parsed = parser.parse(`<Root>${xml}</Root>`);
      const listing = parsed.Root.Listing;
      assert.ok(listing);
      assert.strictEqual(String(listing.ListingID), '8797');
      assert.strictEqual(listing.TransactionType, 'For Sale');
      assert.strictEqual(listing.Details.PropertyType, 'Residential / Sobrado');
      assert.strictEqual(Number(listing.Details.ListPrice['#text']), 620000);
      assert.strictEqual(listing.Details.ListPrice['@_currency'], 'BRL');
      assert.strictEqual(Number(listing.Details.LivingArea['#text']), 170);
      assert.strictEqual(listing.Details.LivingArea['@_unit'], 'square metres');

      // Validar fotos e atributos primary
      const mediaItems = Array.isArray(listing.Media.Item) ? listing.Media.Item : [listing.Media.Item];
      assert.strictEqual(mediaItems.length, 2);
      assert.strictEqual(mediaItems[0]['@_primary'], 'true');
      assert.strictEqual(mediaItems[1]['@_primary'], 'false');
    });

    test('generateXml deve produzir feed completo com cabeçalho e estrutura ListingDataFeed', async () => {
      const mockList = [
        {
          codigo_imovel: 101,
          titulo: 'Apartamento Teste 1',
          finalidade: 'Venda',
          destinacao: 'Residencial',
          tipo_imovel: 'Apartamento',
          valor_venda: 350000,
          foto_destaque: 'https://cdn.imoview.com.br/foto101.jpg',
          ativo: true,
          exibir_site: true
        },
        {
          codigo_imovel: 102,
          titulo: 'Salão Comercial Teste 2',
          finalidade: 'Aluguel',
          destinacao: 'Comercial',
          tipo_imovel: 'Salão',
          valor_locacao: 4000,
          foto_destaque: 'https://cdn.imoview.com.br/foto102.jpg',
          ativo: true,
          exibir_site: true
        }
      ];

      const generator = new XmlFeedGenerator();
      const result = await generator.generateXml(mockList);

      assert.strictEqual(result.count, 2);
      assert.ok(result.xml.startsWith('<?xml version="1.0" encoding="utf-8"?>'));
      assert.ok(result.xml.includes('<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"'));
      assert.ok(result.xml.includes('</ListingDataFeed>'));

      // Parsear o documento completo
      const parsed = parser.parse(result.xml);
      const feed = parsed.ListingDataFeed;
      assert.ok(feed);
      assert.strictEqual(feed.Header.Provider, 'S & M');
      assert.strictEqual(feed.Header.Telephone, 1144692121);
      assert.ok(feed.Header.PublishDate);

      const listings = Array.isArray(feed.Listings.Listing) ? feed.Listings.Listing : [feed.Listings.Listing];
      assert.strictEqual(listings.length, 2);
      assert.strictEqual(String(listings[0].ListingID), '101');
      assert.strictEqual(String(listings[1].ListingID), '102');
    });
  });

  describe('4. Integração Real com o Supabase e Cache', () => {
    test('generateXml deve consultar imóveis reais do Supabase com limit e carregar fotos reais', async () => {
      const generator = new XmlFeedGenerator();
      const result = await generator.generateXml(null, { limit: 3, situacao: '1' });

      assert.ok(result.count > 0, 'Deveria retornar pelo menos 1 imóvel do Supabase');
      assert.ok(result.xml.includes('<ListingID>'));

      const parsed = parser.parse(result.xml);
      const feed = parsed.ListingDataFeed;
      assert.ok(feed.Listings.Listing);

      const items = Array.isArray(feed.Listings.Listing) ? feed.Listings.Listing : [feed.Listings.Listing];
      assert.ok(items.length <= 3);

      for (const item of items) {
        assert.ok(item.ListingID, 'Cada item deve ter ListingID');
        assert.ok(item.Title, 'Cada item deve ter Title');
        assert.ok(item.TransactionType, 'Cada item deve ter TransactionType');
        assert.ok(item.Details, 'Cada item deve ter Details');
        assert.ok(item.Location, 'Cada item deve ter Location');
        assert.ok(item.Media, 'Cada item deve ter Media');
      }
    });

    test('getFeedXml com id específico deve gerar feed com exatamente o imóvel solicitado', async () => {
      const generator = new XmlFeedGenerator();
      const xml = await generator.getFeedXml({ id: '8797' });

      assert.ok(xml.includes('<ListingID>8797</ListingID>'));
      const parsed = parser.parse(xml);
      const listing = parsed.ListingDataFeed.Listings.Listing;
      assert.strictEqual(String(listing.ListingID), '8797');
      assert.strictEqual(listing.TransactionType, 'For Sale');
      assert.strictEqual(listing.Details.PropertyType, 'Residential / Sobrado');
    });
  });

  describe('5. Endpoints HTTP do Express (/feed.xml e /api/feed.xml)', () => {
    test('GET /feed.xml deve retornar 200 OK com Content-Type application/xml e XML válido', async () => {
      const http = require('node:http');
      const app = require('../server');
      const server = http.createServer(app);
      await new Promise(resolve => server.listen(0, resolve));
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/feed.xml?limit=2`);
        assert.strictEqual(res.status, 200);
        const contentType = res.headers.get('content-type') || '';
        assert.ok(contentType.includes('application/xml'), `Content-Type deve ser application/xml, recebido: ${contentType}`);

        const xmlText = await res.text();
        assert.ok(xmlText.includes('<ListingDataFeed'));
        assert.ok(xmlText.includes('</ListingDataFeed>'));

        const parsed = parser.parse(xmlText);
        assert.ok(parsed.ListingDataFeed);
        assert.strictEqual(parsed.ListingDataFeed.Header.Provider, 'S & M');
      } finally {
        server.close();
      }
    });

    test('GET /api/feed.xml com ?id=8797 deve retornar XML do imóvel específico', async () => {
      const http = require('node:http');
      const app = require('../server');
      const server = http.createServer(app);
      await new Promise(resolve => server.listen(0, resolve));
      const port = server.address().port;

      try {
        const res = await fetch(`http://localhost:${port}/api/feed.xml?id=8797`);
        assert.strictEqual(res.status, 200);
        const xmlText = await res.text();
        assert.ok(xmlText.includes('<ListingID>8797</ListingID>'));
      } finally {
        server.close();
      }
    });
  });

});

