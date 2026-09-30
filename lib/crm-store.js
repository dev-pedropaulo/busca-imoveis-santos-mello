const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'crm-store.json');

// Status disponíveis na Jornada do Imóvel (Kanban)
const KANBAN_STAGES = [
  { id: 'disponivel', label: 'Vago / Disponível', color: '#10b981', icon: '🟢', description: 'Pronto para anúncio e visitas' },
  { id: 'visita_agendada', label: 'Visita Agendada', color: '#3b82f6', icon: '📅', description: 'Cliente com visita marcada' },
  { id: 'chave_entregue', label: 'Chave Entregue (Em Visita)', color: '#8b5cf6', icon: '🔑', description: 'Chave retirada pelo corretor/cliente' },
  { id: 'com_proposta', label: 'Com Proposta', color: '#f59e0b', icon: '📝', description: 'Proposta em negociação ativa' },
  { id: 'analise_contrato', label: 'Análise / Contrato', color: '#ec4899', icon: '🔍', description: 'Fiança cadastral e minuta' },
  { id: 'concluido', label: 'Concluído (Alugado/Vendido)', color: '#06b6d4', icon: '🤝', description: 'Contrato assinado e chaves finais' }
];

// Dados iniciais fictícios realistas para demonstração imediata
const INITIAL_DATA = {
  customProperties: [
    {
      id: 'SM-9001',
      title: 'Apartamento Alto Padrão com Varanda Gourmet - Bairro Jardim',
      transactionType: 'Locação',
      propertyType: 'Apartment',
      usageType: 'Residencial',
      price: 0,
      rentalPrice: 4200,
      condo: 780,
      iptu: 210,
      livingArea: 118,
      constructedArea: 145,
      lotArea: 0,
      bedrooms: 3,
      suites: 2,
      bathrooms: 3,
      garage: 2,
      description: 'Lindo apartamento no prestigiado Bairro Jardim em Santo André. Acabamento de primeira linha, varanda gourmet envidraçada, armários planejados na cozinha e suíte máster. Condomínio clube completo.',
      features: ['Piscina', 'Varanda / Sacada', 'Espaço Gourmet', 'Elevador', 'Academia', 'Churrasqueira', 'Aceita Pets'],
      location: {
        address: 'Rua das Figueiras',
        streetNumber: '1420',
        complement: 'Apto 82',
        neighborhood: 'Bairro Jardim',
        city: 'Santo André',
        state: 'SP',
        postalCode: '09080-300'
      },
      images: [
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
      ],
      primaryImage: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
      virtualTourLink: 'https://matterport.com/discover',
      status: 'Visita Agendada',
      kanbanStage: 'visita_agendada',
      keyTag: 'CLAV-042',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'SM-9002',
      title: 'Sobrado Triplex Moderno em Condomínio Fechado - Campestre',
      transactionType: 'Venda / Locação',
      propertyType: 'Sobrado',
      usageType: 'Residencial',
      price: 950000,
      rentalPrice: 5500,
      condo: 450,
      iptu: 180,
      livingArea: 210,
      constructedArea: 230,
      lotArea: 180,
      bedrooms: 4,
      suites: 2,
      bathrooms: 4,
      garage: 3,
      description: 'Sobrado espetacular com terraço panorâmico, churrasqueira privativa, suíte máster com closet e hidromassagem. Excelente localização próximo à Estação Prefeito Saladino e comércios da Rua das Figueiras.',
      features: ['Churrasqueira', 'Varanda / Sacada', 'Espaço Gourmet', 'Quintal', 'Garagem Coberta', 'Alarme'],
      location: {
        address: 'Rua Vitória Régia',
        streetNumber: '310',
        complement: 'Casa 4',
        neighborhood: 'Campestre',
        city: 'Santo André',
        state: 'SP',
        postalCode: '09080-320'
      },
      images: [
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=800&q=80'
      ],
      primaryImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      virtualTourLink: '',
      status: 'Chave Entregue (Em Visita)',
      kanbanStage: 'chave_entregue',
      keyTag: 'CLAV-015',
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'SM-9003',
      title: 'Conjunto Comercial Pronto para Escritório ou Clínica - Centro',
      transactionType: 'Locação',
      propertyType: 'Office',
      usageType: 'Comercial',
      price: 0,
      rentalPrice: 2800,
      condo: 620,
      iptu: 140,
      livingArea: 68,
      constructedArea: 75,
      lotArea: 0,
      bedrooms: 0,
      suites: 0,
      bathrooms: 2,
      garage: 1,
      description: 'Sala comercial recém-reformada no Centro de Santo André, piso em porcelanato, ar condicionado instalado, recepção montada, 2 salas de atendimento e copa privativa.',
      features: ['Elevador', 'Ar Condicionado', 'Portaria', 'Segurança 24h', 'Interfone'],
      location: {
        address: 'Avenida Portugal',
        streetNumber: '750',
        complement: 'Conj. 41',
        neighborhood: 'Centro',
        city: 'Santo André',
        state: 'SP',
        postalCode: '09040-000'
      },
      images: [
        'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80'
      ],
      primaryImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
      virtualTourLink: '',
      status: 'Com Proposta',
      kanbanStage: 'com_proposta',
      keyTag: 'CLAV-089',
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  // Overrides de status para imóveis vindos do XML ou cadastrados
  propertyOverrides: {
    '8797': {
      kanbanStage: 'visita_agendada',
      status: 'Visita Agendada',
      keyTag: 'CLAV-012',
      updatedAt: new Date().toISOString()
    },
    '2375': {
      kanbanStage: 'com_proposta',
      status: 'Com Proposta',
      keyTag: 'CLAV-088',
      updatedAt: new Date().toISOString()
    },
    '8830': {
      kanbanStage: 'chave_entregue',
      status: 'Chave Entregue (Em Visita)',
      keyTag: 'CLAV-034',
      updatedAt: new Date().toISOString()
    },
    '8825': {
      kanbanStage: 'analise_contrato',
      status: 'Análise / Contrato',
      keyTag: 'CLAV-055',
      updatedAt: new Date().toISOString()
    },
    '8816': {
      kanbanStage: 'concluido',
      status: 'Concluído (Alugado/Vendido)',
      keyTag: 'CLAV-009',
      updatedAt: new Date().toISOString()
    }
  },

  // Agendamentos de Visitas
  visits: [
    {
      id: 'vis-101',
      propertyId: '8797',
      propertyTitle: 'Sobrado em Condomínio Vila Alzira',
      clientName: 'Fernanda Martins Oliveira',
      clientPhone: '(11) 98765-4321',
      clientEmail: 'fernanda.martins@gmail.com',
      brokerName: 'Carlos Silva (CRECI 124589)',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      time: '14:30',
      status: 'Confirmada',
      notes: 'Cliente busca imóvel para locação imediata. Já possui fiador com imóvel na cidade.',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'vis-102',
      propertyId: 'SM-9001',
      propertyTitle: 'Apartamento Alto Padrão - Bairro Jardim',
      clientName: 'Rodrigo Medeiros Souza',
      clientPhone: '(11) 97123-8899',
      clientEmail: 'rodrigo.medeiros@empresa.com.br',
      brokerName: 'Mariana Costa (CRECI 187652)',
      date: new Date().toISOString().split('T')[0],
      time: '16:00',
      status: 'Agendada',
      notes: 'Família com 2 filhos e cachorro de pequeno porte. Solicitaram confirmação 1h antes.',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: 'vis-103',
      propertyId: '8830',
      propertyTitle: 'Apartamento 3 Dormitórios Vila Bastos',
      clientName: 'Juliana Pires Albuquerque',
      clientPhone: '(11) 99876-1234',
      clientEmail: 'juliana.pires@outlook.com',
      brokerName: 'Roberto Santos (CRECI 98451)',
      date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      time: '10:00',
      status: 'Agendada',
      notes: 'Visita acompanhada com o noivo. Avaliando locação ou compra direta.',
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
    },
    {
      id: 'vis-104',
      propertyId: 'SM-9002',
      propertyTitle: 'Sobrado Triplex Moderno Campestre',
      clientName: 'Eduardo Guimarães',
      clientPhone: '(11) 98444-5566',
      clientEmail: 'eduardo.g@techcorp.com',
      brokerName: 'Carlos Silva (CRECI 124589)',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      time: '11:00',
      status: 'Realizada',
      notes: 'Cliente gostou bastante. Disse que enviará proposta de compra até o fim do dia.',
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
    }
  ],

  // Movimentações de Chaves (Key Checkouts / Claviculário)
  keyMovements: [
    {
      id: 'km-201',
      propertyId: '8830',
      keyTag: 'CLAV-034',
      takenBy: 'Roberto Santos (Corretor)',
      takenByType: 'Corretor',
      takenAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      expectedReturn: new Date(Date.now() + 3600000 * 2).toISOString(),
      returnedAt: null,
      status: 'Retirada',
      purpose: 'Visita presencial com cliente Juliana Pires',
      notes: 'Chave principal + controle da garagem'
    },
    {
      id: 'km-202',
      propertyId: 'SM-9002',
      keyTag: 'CLAV-015',
      takenBy: 'Carlos Silva (Corretor)',
      takenByType: 'Corretor',
      takenAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      expectedReturn: new Date(Date.now() - 3600000 * 2).toISOString(),
      returnedAt: null,
      status: 'Atrasada',
      purpose: 'Vistoria fotográfica e visita com cliente',
      notes: 'Corretor avisou que fará 2 visitas consecutivas'
    },
    {
      id: 'km-203',
      propertyId: '8797',
      keyTag: 'CLAV-012',
      takenBy: 'Mariana Costa (Corretor)',
      takenByType: 'Corretor',
      takenAt: new Date(Date.now() - 86400000).toISOString(),
      expectedReturn: new Date(Date.now() - 86400000 + 3600000 * 3).toISOString(),
      returnedAt: new Date(Date.now() - 86400000 + 3600000 * 2.5).toISOString(),
      status: 'Devolvida',
      purpose: 'Visita agendada com cliente',
      notes: 'Chaves devolvidas com integridade no claviculário'
    }
  ]
};

// Gerenciador de armazenamento em memória com persistência segura em disco
class CrmStore {
  constructor() {
    this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const fileContent = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        this.data = {
          customProperties: parsed.customProperties || INITIAL_DATA.customProperties,
          propertyOverrides: parsed.propertyOverrides || INITIAL_DATA.propertyOverrides,
          visits: parsed.visits || INITIAL_DATA.visits,
          keyMovements: parsed.keyMovements || INITIAL_DATA.keyMovements
        };
        console.log('📦 Dados do CRM Santos & Mello carregados do disco.');
      } else {
        this.saveToDisk();
      }
    } catch (err) {
      console.warn('⚠️ Não foi possível ler crm-store.json, usando dados em memória:', err.message);
    }
  }

  saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('⚠️ Falha ao salvar em crm-store.json (possível ambiente somente leitura):', err.message);
    }
  }

  // --- Imóveis Customizados & Overrides ---
  getCustomProperties() {
    return this.data.customProperties;
  }

  getPropertyOverride(id) {
    if (!id) return null;
    return this.data.propertyOverrides[String(id).toLowerCase()] || null;
  }

  savePropertyOverride(id, patch) {
    if (!id) return;
    const cleanId = String(id).toLowerCase();
    const current = this.data.propertyOverrides[cleanId] || {};
    this.data.propertyOverrides[cleanId] = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.saveToDisk();
    return this.data.propertyOverrides[cleanId];
  }

  createProperty(propData) {
    const newId = propData.id ? String(propData.id).trim() : `SM-${Math.floor(1000 + Math.random() * 9000)}`;
    const newProp = {
      ...propData,
      id: newId,
      status: propData.status || 'Vago / Disponível',
      kanbanStage: propData.kanbanStage || 'disponivel',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Remove se já existia com esse ID para evitar duplicatas
    this.data.customProperties = this.data.customProperties.filter(p => p.id.toLowerCase() !== newId.toLowerCase());
    this.data.customProperties.unshift(newProp);
    
    // Registra override
    this.savePropertyOverride(newId, {
      kanbanStage: newProp.kanbanStage,
      status: newProp.status,
      keyTag: newProp.keyTag || `CLAV-${newId}`
    });

    this.saveToDisk();
    return newProp;
  }

  updateProperty(id, propData) {
    const cleanId = String(id).toLowerCase();
    const index = this.data.customProperties.findIndex(p => p.id.toLowerCase() === cleanId);
    
    if (index >= 0) {
      this.data.customProperties[index] = {
        ...this.data.customProperties[index],
        ...propData,
        id: this.data.customProperties[index].id, // preserva ID original
        updatedAt: new Date().toISOString()
      };
      const updated = this.data.customProperties[index];
      this.savePropertyOverride(updated.id, {
        kanbanStage: updated.kanbanStage,
        status: updated.status,
        keyTag: updated.keyTag
      });
      this.saveToDisk();
      return updated;
    }

    // Se o imóvel veio originalmente do feed XML, cria um clone nos customProperties ou salva overrides
    const updated = {
      ...propData,
      id: id,
      updatedAt: new Date().toISOString()
    };
    this.data.customProperties.unshift(updated);
    this.savePropertyOverride(id, {
      kanbanStage: updated.kanbanStage || 'disponivel',
      status: updated.status || 'Vago / Disponível',
      keyTag: updated.keyTag
    });
    this.saveToDisk();
    return updated;
  }

  deleteProperty(id) {
    const cleanId = String(id).toLowerCase();
    this.data.customProperties = this.data.customProperties.filter(p => p.id.toLowerCase() !== cleanId);
    // Também marca o override como 'Excluído'
    this.savePropertyOverride(cleanId, {
      kanbanStage: 'excluido',
      status: 'Inativo / Excluído',
      deleted: true
    });
    this.saveToDisk();
    return true;
  }

  // --- Visitas ---
  getVisits(filter = {}) {
    let list = [...this.data.visits];
    if (filter.status && filter.status !== 'all') {
      list = list.filter(v => v.status.toLowerCase() === filter.status.toLowerCase());
    }
    if (filter.propertyId) {
      list = list.filter(v => String(v.propertyId).toLowerCase() === String(filter.propertyId).toLowerCase());
    }
    // Ordenar por data e horário (mais recentes/próximos primeiro)
    list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return list;
  }

  createVisit(visitData) {
    const newVisit = {
      id: `vis-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'Agendada',
      createdAt: new Date().toISOString(),
      ...visitData
    };
    this.data.visits.unshift(newVisit);

    // Se configurado, atualiza o status do imóvel para 'visita_agendada'
    if (visitData.propertyId) {
      this.savePropertyOverride(visitData.propertyId, {
        kanbanStage: 'visita_agendada',
        status: 'Visita Agendada'
      });
    }

    this.saveToDisk();
    return newVisit;
  }

  updateVisit(id, patch) {
    const item = this.data.visits.find(v => v.id === id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    this.saveToDisk();
    return item;
  }

  deleteVisit(id) {
    this.data.visits = this.data.visits.filter(v => v.id !== id);
    this.saveToDisk();
    return true;
  }

  // --- Chaves (Key Movements) ---
  getKeyMovements(filter = {}) {
    let list = [...this.data.keyMovements];
    if (filter.status && filter.status !== 'all') {
      list = list.filter(k => k.status.toLowerCase() === filter.status.toLowerCase());
    }
    if (filter.propertyId) {
      list = list.filter(k => String(k.propertyId).toLowerCase() === String(filter.propertyId).toLowerCase());
    }
    list.sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));
    return list;
  }

  checkoutKey(movementData) {
    const newKey = {
      id: `km-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      takenAt: new Date().toISOString(),
      returnedAt: null,
      status: 'Retirada',
      ...movementData
    };
    this.data.keyMovements.unshift(newKey);

    // Atualiza status do imóvel para chave entregue se aplicável
    if (movementData.propertyId) {
      this.savePropertyOverride(movementData.propertyId, {
        kanbanStage: 'chave_entregue',
        status: 'Chave Entregue (Em Visita)',
        keyTag: movementData.keyTag
      });
    }

    this.saveToDisk();
    return newKey;
  }

  returnKey(id, returnNotes = '') {
    const item = this.data.keyMovements.find(k => k.id === id);
    if (!item) return null;

    item.returnedAt = new Date().toISOString();
    item.status = 'Devolvida';
    if (returnNotes) {
      item.notes = (item.notes ? item.notes + ' | ' : '') + `Devolução: ${returnNotes}`;
    }

    // Se o imóvel estava com chave entregue, podemos voltar para visita realizada ou vago/disponível
    if (item.propertyId) {
      const override = this.getPropertyOverride(item.propertyId);
      if (override && override.kanbanStage === 'chave_entregue') {
        this.savePropertyOverride(item.propertyId, {
          kanbanStage: 'disponivel',
          status: 'Vago / Disponível'
        });
      }
    }

    this.saveToDisk();
    return item;
  }
}

const crmStore = new CrmStore();

module.exports = {
  crmStore,
  KANBAN_STAGES
};
