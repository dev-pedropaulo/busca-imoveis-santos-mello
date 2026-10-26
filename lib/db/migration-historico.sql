-- ========================================================
-- Migração: Tabela de Histórico e Auditoria do Imóvel
-- Projeto: busca-imoveis-santos-mello
-- ========================================================

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
