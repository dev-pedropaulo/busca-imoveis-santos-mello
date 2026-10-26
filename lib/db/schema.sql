-- ========================================================
-- Schema do Banco de Dados Proprietário Santos & Mello
-- Projeto: busca-imoveis-santos-mello
-- Data: 2026-10-23
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE PESSOAS (Proprietários, Captadores, Clientes)
CREATE TABLE IF NOT EXISTS pessoas (
    codigo_pessoa INTEGER PRIMARY KEY,
    codigo_auxiliar VARCHAR(100),
    nome VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(30),
    tipo_pessoa VARCHAR(10) DEFAULT 'PF',
    numero_documento VARCHAR(50),
    data_emissao_documento DATE,
    data_nascimento DATE,
    estado_civil VARCHAR(50),
    sexo VARCHAR(20),
    nacionalidade VARCHAR(100),
    profissao VARCHAR(150),
    renda_mensal NUMERIC(15, 2),
    endereco VARCHAR(255),
    numero VARCHAR(50),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    cep VARCHAR(20),
    anotacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pessoas_cpf_cnpj ON pessoas(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_pessoas_nome ON pessoas(nome);

-- 2. TABELA DE CONTATOS DAS PESSOAS
CREATE TABLE IF NOT EXISTS pessoa_contatos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_pessoa INTEGER NOT NULL REFERENCES pessoas(codigo_pessoa) ON DELETE CASCADE,
    email TEXT,
    telefone TEXT,
    tipo_contato VARCHAR(50) DEFAULT 'principal',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pessoa_contatos_pessoa ON pessoa_contatos(codigo_pessoa);
CREATE INDEX IF NOT EXISTS idx_pessoa_contatos_tel ON pessoa_contatos(telefone);

-- 3. TABELA DE CONDOMÍNIOS
CREATE TABLE IF NOT EXISTS condominios (
    codigo_condominio INTEGER PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(100),
    destinacao VARCHAR(100),
    construtora VARCHAR(255),
    cep VARCHAR(20),
    endereco VARCHAR(255),
    numero VARCHAR(50),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    ponto_referencia TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    ano_construcao INTEGER,
    descricao TEXT,
    anotacoes TEXT,
    cartorio VARCHAR(150),
    matricula VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_condominios_cidade_bairro ON condominios(cidade, bairro);

-- 4. FOTOS DE CONDOMÍNIOS
CREATE TABLE IF NOT EXISTS condominio_fotos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_condominio INTEGER NOT NULL REFERENCES condominios(codigo_condominio) ON DELETE CASCADE,
    url_original TEXT NOT NULL,
    url_propria TEXT,
    tipo_foto VARCHAR(50),
    descricao TEXT,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_condominio_fotos_cond ON condominio_fotos(codigo_condominio);

-- 5. TABELA MESTRE DE IMÓVEIS
CREATE TABLE IF NOT EXISTS imoveis (
    codigo_imovel INTEGER PRIMARY KEY,
    finalidade VARCHAR(50) NOT NULL,
    destinacao VARCHAR(50),
    situacao VARCHAR(50),
    tipo_imovel VARCHAR(100) NOT NULL,
    titulo VARCHAR(255),
    descricao TEXT,
    
    -- Valores
    valor_venda NUMERIC,
    valor_locacao NUMERIC,
    valor_condominio NUMERIC,
    valor_iptu NUMERIC,
    valor_fundo_reserva NUMERIC,
    
    -- Localização
    codigo_condominio INTEGER REFERENCES condominios(codigo_condominio) ON DELETE SET NULL,
    nome_condominio VARCHAR(255),
    edificio VARCHAR(150),
    bloco VARCHAR(50),
    andar VARCHAR(20),
    numero_andar INTEGER,
    endereco VARCHAR(255),
    numero VARCHAR(50),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(10) DEFAULT 'SP',
    cep VARCHAR(20),
    ponto_referencia TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    
    -- Cômodos e Áreas
    quartos INTEGER DEFAULT 0,
    suites INTEGER DEFAULT 0,
    salas INTEGER DEFAULT 0,
    banheiros INTEGER DEFAULT 0,
    varandas INTEGER DEFAULT 0,
    vagas INTEGER DEFAULT 0,
    tipo_vaga VARCHAR(50),
    area_interna NUMERIC,
    area_externa NUMERIC,
    area_privativa NUMERIC,
    area_lote NUMERIC,
    
    -- Comodidades (Flags)
    portaria_24h BOOLEAN DEFAULT FALSE,
    portao_eletronico BOOLEAN DEFAULT FALSE,
    interfone BOOLEAN DEFAULT FALSE,
    elevador BOOLEAN DEFAULT FALSE,
    ar_condicionado BOOLEAN DEFAULT FALSE,
    aquecimento_solar BOOLEAN DEFAULT FALSE,
    area_servico BOOLEAN DEFAULT FALSE,
    varanda_gourmet BOOLEAN DEFAULT FALSE,
    closet BOOLEAN DEFAULT FALSE,
    dce BOOLEAN DEFAULT FALSE,
    lavabo BOOLEAN DEFAULT FALSE,
    mobiliado BOOLEAN DEFAULT FALSE,
    aceita_financiamento BOOLEAN DEFAULT FALSE,
    aceita_permuta BOOLEAN DEFAULT FALSE,
    exclusivo BOOLEAN DEFAULT FALSE,
    exibir_site BOOLEAN DEFAULT TRUE,
    
    -- Claviculário e Gestão Física
    local_chave VARCHAR(100) DEFAULT 'Imobiliária',
    codigo_chave VARCHAR(50),
    placa VARCHAR(50),
    anotacoes_internas TEXT,
    
    -- Metadados
    ativo BOOLEAN DEFAULT TRUE,
    data_inclusao TIMESTAMPTZ,
    data_alteracao TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imoveis_finalidade ON imoveis(finalidade);
CREATE INDEX IF NOT EXISTS idx_imoveis_tipo ON imoveis(tipo_imovel);
CREATE INDEX IF NOT EXISTS idx_imoveis_cidade_bairro ON imoveis(cidade, bairro);
CREATE INDEX IF NOT EXISTS idx_imoveis_valor_locacao ON imoveis(valor_locacao);
CREATE INDEX IF NOT EXISTS idx_imoveis_valor_venda ON imoveis(valor_venda);
CREATE INDEX IF NOT EXISTS idx_imoveis_quartos ON imoveis(quartos);
CREATE INDEX IF NOT EXISTS idx_imoveis_vagas ON imoveis(vagas);
CREATE INDEX IF NOT EXISTS idx_imoveis_ativo ON imoveis(ativo);

-- 6. FOTOS DOS IMÓVEIS (173.342 fotos)
CREATE TABLE IF NOT EXISTS imovel_fotos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_imovel INTEGER NOT NULL REFERENCES imoveis(codigo_imovel) ON DELETE CASCADE,
    url_original TEXT NOT NULL,
    url_propria TEXT,
    tipo_foto VARCHAR(50),
    descricao TEXT,
    ordem INTEGER DEFAULT 0,
    destaque BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imovel_fotos_imovel ON imovel_fotos(codigo_imovel);
CREATE INDEX IF NOT EXISTS idx_imovel_fotos_ordem ON imovel_fotos(codigo_imovel, ordem);

-- 7. VÍNCULO IMÓVEL X PROPRIETÁRIOS
CREATE TABLE IF NOT EXISTS imovel_proprietarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_imovel INTEGER NOT NULL REFERENCES imoveis(codigo_imovel) ON DELETE CASCADE,
    codigo_proprietario INTEGER NOT NULL REFERENCES pessoas(codigo_pessoa) ON DELETE RESTRICT,
    percentual_participacao NUMERIC(5, 2) DEFAULT 100.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(codigo_imovel, codigo_proprietario)
);

CREATE INDEX IF NOT EXISTS idx_imovel_proprietarios_imovel ON imovel_proprietarios(codigo_imovel);
CREATE INDEX IF NOT EXISTS idx_imovel_proprietarios_prop ON imovel_proprietarios(codigo_proprietario);

-- 8. VÍNCULO IMÓVEL X CAPTADORES (Corretores)
CREATE TABLE IF NOT EXISTS imovel_captadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_imovel INTEGER NOT NULL REFERENCES imoveis(codigo_imovel) ON DELETE CASCADE,
    codigo_captador INTEGER NOT NULL REFERENCES pessoas(codigo_pessoa) ON DELETE RESTRICT,
    percentual_comissao NUMERIC(5, 2),
    principal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(codigo_imovel, codigo_captador)
);

CREATE INDEX IF NOT EXISTS idx_imovel_captadores_imovel ON imovel_captadores(codigo_imovel);

-- 9. GESTÃO DE CLAVICULÁRIO E CHAVES
CREATE TABLE IF NOT EXISTS crm_chaves_movimentacoes (
    id VARCHAR(100) PRIMARY KEY,
    codigo_imovel INTEGER NOT NULL REFERENCES imoveis(codigo_imovel) ON DELETE CASCADE,
    key_tag VARCHAR(50),
    taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'Retirada',
    taken_by VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chaves_imovel ON crm_chaves_movimentacoes(codigo_imovel);
CREATE INDEX IF NOT EXISTS idx_chaves_status ON crm_chaves_movimentacoes(status);

-- 10. AGENDAMENTO DE VISITAS
CREATE TABLE IF NOT EXISTS crm_visitas (
    id VARCHAR(100) PRIMARY KEY,
    codigo_imovel INTEGER NOT NULL REFERENCES imoveis(codigo_imovel) ON DELETE CASCADE,
    property_title VARCHAR(255),
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    date DATE NOT NULL,
    time VARCHAR(20) NOT NULL,
    broker VARCHAR(150),
    status VARCHAR(50) DEFAULT 'Agendada',
    notes TEXT,
    session_id VARCHAR(150),
    contact_id VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitas_imovel ON crm_visitas(codigo_imovel);
CREATE INDEX IF NOT EXISTS idx_visitas_data ON crm_visitas(date);
CREATE INDEX IF NOT EXISTS idx_visitas_session ON crm_visitas(session_id);

-- 11. HISTÓRICO, LINHA DO TEMPO & AUDITORIA DO IMÓVEL
CREATE TABLE IF NOT EXISTS crm_imovel_historico (
    id VARCHAR(100) PRIMARY KEY,
    codigo_imovel INTEGER,
    property_custom_id VARCHAR(100),
    tipo_evento VARCHAR(50) NOT NULL, -- 'criacao', 'alteracao', 'visita', 'chave', 'proposta', 'oferta', 'status', 'anotacao'
    titulo_evento VARCHAR(255) NOT NULL,
    descricao TEXT,
    autor VARCHAR(150) DEFAULT 'Sistema',
    detalhes JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imovel_historico_imovel ON crm_imovel_historico(codigo_imovel);
CREATE INDEX IF NOT EXISTS idx_imovel_historico_custom_id ON crm_imovel_historico(property_custom_id);
CREATE INDEX IF NOT EXISTS idx_imovel_historico_data ON crm_imovel_historico(created_at DESC);

