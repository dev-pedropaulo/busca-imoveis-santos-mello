# Plataforma de Imóveis - Especificação de Arquitetura

## Objetivo

Transformar o buscador de imóveis baseado em XML em uma aplicação operacional cuja fonte de verdade seja o Supabase. A aplicação terá consulta pública de imóveis publicados e uma área administrativa, com um único perfil de administrador, para gerir imóveis, mídia, status e importações.

## Decisões validadas

- O XML externo é uma fonte de importação, nunca a fonte de verdade em tempo de consulta.
- A primeira carga será feita a partir de um XML, cuja qualidade e origem ainda precisam ser validadas.
- Após uma importação ser revisada e aprovada, o Supabase será a fonte oficial dos dados.
- Administradores podem criar e editar imóveis, mídia e status diretamente no sistema.
- A reimportação de XML será controlada por lote; ela não pode apagar nem sobrescrever silenciosamente alterações administrativas.
- Somente administradores autenticados acessam a área de gestão. Não haverá níveis administrativos diferentes nesta fase.
- A consulta pública exibe somente imóveis com status `disponivel` e marcados como publicados.
- A geração de XML a partir do Supabase é a fase 2 e fica fora da primeira entrega, mas o modelo deve permitir sua implementação sem migração estrutural.

## Arquitetura

```text
Fonte XML externa
  -> lote de importação e validação
  -> prévia de inclusões, alterações e conflitos
  -> aprovação administrativa
  -> Supabase: catálogo oficial
  -> API Express
  -> consulta pública e painel /admin

Fase 2: Supabase -> exportador XML compatível com o parceiro definido
```

O backend Node.js/Express atual será mantido, mas dividido em módulos. Ele será o único componente com acesso à chave de serviço do Supabase e aos fluxos privilegiados de importação. O navegador usa a chave anônima apenas para autenticação e consultas que as políticas RLS permitirem.

O Supabase fornece PostgreSQL, Auth e Storage. O frontend público pode continuar leve; a área administrativa será uma interface separada em `/admin`. Os dois consomem contratos de API versionados pelo backend.

## Modelo de dados

### Imóveis e catálogo

`properties` representa o imóvel oficial. Campos essenciais:

- Identidade: UUID interno, `external_code`, `source_name`, `source_listing_id` e timestamps.
- Publicação: `status`, `is_published`, `published_at` e `archived_at`.
- Comercial: finalidade de venda, locação ou ambas; preço de venda; preço de locação; condomínio; IPTU; tipo e uso.
- Características: título, descrição, áreas útil/construída/terreno, quartos, suítes, banheiros e vagas.
- Localização: endereço, número, complemento, bairro, cidade, estado, CEP, latitude e longitude.
- Links: URL pública do parceiro e tour virtual, quando existirem.

`property_media` mantém fotos e vídeos em linhas individuais, com ordem, descrição, origem, URL externa e caminho no Supabase Storage. URLs externas do XML podem permanecer temporariamente, mas novas mídias devem ser enviadas ao Storage.

`features` e `property_features` modelam comodidades sem repetir colunas no imóvel.

Os estados permitidos são `rascunho`, `disponivel`, `reservado`, `vendido`, `alugado` e `inativo`. As transições são validadas na API; `vendido` e `alugado` não são públicos e não podem voltar a `disponivel` sem uma ação explícita de reativação registrada em auditoria.

### Importação e auditoria

`import_batches` registra cada tentativa: fonte, nome e hash do arquivo, início/fim, autor, estado, quantidade de registros e resumo de erro.

`import_records` armazena o resultado de cada item do XML, inclusive a carga normalizada, o código externo, a propriedade correspondente, a ação proposta (`criar`, `atualizar`, `sem_alteracao`, `conflito` ou `ignorar`) e mensagens de validação.

`property_audit_log` grava quem criou, editou, aprovou uma importação, mudou status ou reativou um imóvel, com valores anteriores e posteriores.

`admin_users` referencia `auth.users`. Nesta fase, todo registro ativo é administrador; as políticas RLS bloqueiam os demais usuários de ler ou editar tabelas administrativas.

## Importação XML controlada

1. Um administrador inicia uma importação a partir de uma URL permitida ou do upload de um arquivo XML.
2. O backend baixa ou recebe o XML, aceita no máximo 25 MiB, usa timeout de download de 15 segundos, valida a estrutura e converte cada item ao formato interno.
3. O sistema cria um lote e registra a prévia sem alterar o catálogo oficial.
4. A prévia destaca novos imóveis, alterações, itens inválidos, códigos duplicados e imóveis que desapareceram da fonte.
5. Um administrador aprova explicitamente o lote. Apenas então o backend aplica criação e atualização em transação.
6. Itens ausentes no novo XML são marcados para revisão no lote; jamais são removidos automaticamente.
7. Campos alterados manualmente não são sobrescritos pela importação sem uma ação explícita de resolução de conflito.

O identificador de reconciliação primário é `source_name + source_listing_id`; `external_code` é exibido ao usuário e recebe índice único por fonte. Se o XML não contiver um identificador estável, o lote deve ficar pendente e não pode ser aprovado até o administrador definir a regra de correspondência.

## Acesso e segurança

- O backend valida sessão de administrador em todas as rotas `/api/admin/*`.
- A chave de serviço do Supabase nunca é enviada ao navegador nem versionada no repositório.
- CORS fica limitado aos domínios da aplicação.
- O endpoint de importação não é público e aplica limite de taxa, limite de tamanho, timeout e validação de content type.
- Todo conteúdo do XML é tratado como dado não confiável; a interface usa criação de elementos e `textContent`, não interpolação de dados em `innerHTML`.
- O Storage organiza arquivos por UUID de imóvel e valida extensão, MIME, tamanho e propriedade do arquivo.

## Interfaces da primeira fase

### Consulta pública

- Busca por código, texto, localização e características.
- Filtros de finalidade, tipo, uso, cidade, bairros, preço, área, dormitórios, suítes, banheiros, vagas, tour e comodidades.
- Paginação, ordenação coerente com a finalidade e página individual do imóvel.
- Apenas imóveis `disponivel` e publicados aparecem no resultado.

### Painel administrativo

- Login/logout de administrador.
- Listagem com busca, filtros e paginação.
- Criar, editar, arquivar, reativar e alterar status de um imóvel.
- Gerenciar fotos, tour virtual e comodidades.
- Importar XML, consultar prévia, revisar conflitos, aprovar ou descartar lote.
- Consultar histórico de alterações de cada imóvel e de cada importação.

## Organização planejada do repositório

```text
src/
  config/                 ambiente e clientes de infraestrutura
  middleware/             autenticação, autorização e tratamento de erros
  modules/
    auth/                 sessão do administrador
    properties/           domínio, CRUD, busca pública e status
    media/                upload e metadados do Storage
    imports/              parser, normalizador, prévia e aplicação de lotes
    audit/                escrita e consulta de eventos de auditoria
    exports/              reservado para a fase 2
  routes/                 composição dos contratos HTTP
admin/                    interface administrativa
public/                   interface pública
supabase/
  migrations/             SQL incremental e idempotente para execução manual
  seed/                   dados não produtivos para desenvolvimento
tests/
  unit/                   regras de domínio e normalização XML
  integration/            API, RLS e Supabase local/teste
  fixtures/               XMLs válidos, inválidos e conflitantes
docs/
  superpowers/
    specs/                esta especificação
    plans/                plano de execução para o Gemini
```

## Scripts SQL a preparar

Os scripts serão gerados em ordem incremental e executados manualmente no Supabase:

1. Extensões, tipos enumerados, tabelas, índices e constraints do catálogo.
2. Buckets e políticas de Storage para mídia de imóveis.
3. `admin_users`, funções de verificação de administrador e RLS.
4. Triggers de timestamps e auditoria.
5. Uma view `public_properties` restrita a imóveis publicados e disponíveis, usada pela busca pública; a primeira versão não cria funções SQL de busca.
6. Dados de desenvolvimento e verificações pós-migração, separados do schema produtivo.

Cada script terá instruções de pré-requisitos, ordem de execução, transação quando aplicável e uma consulta de verificação. Nenhuma credencial será incluída nos arquivos.

## Fora do escopo da primeira fase

- Geração e distribuição do novo XML.
- Integração com portais imobiliários, CRM, WhatsApp ou pagamentos.
- Múltiplas funções administrativas ou permissões por corretor.
- Exclusão física automática de imóveis por ausência em XML.
- Migração automática de imagens externas para o Storage.

## Critérios de aceite da primeira fase

- Um administrador consegue importar um XML, revisar uma prévia e aplicar ou descartar o lote.
- A importação cria e atualiza imóveis por identificador externo sem duplicação.
- Alterações administrativas ficam registradas e não são silenciosamente substituídas por reimportação.
- Um administrador consegue manter imóvel, status, comodidades e mídia sem acessar o Supabase diretamente.
- A busca pública retorna apenas imóveis disponíveis e publicados, usando dados do Supabase.
- Segredos ficam somente no ambiente de servidor e as políticas RLS impedem acesso administrativo anônimo.
- As rotas críticas, a normalização XML e as regras de publicação possuem testes automatizados.
