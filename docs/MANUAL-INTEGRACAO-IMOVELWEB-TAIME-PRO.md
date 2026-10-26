# Manual de Integração: Taime Pro ↔ Imovelweb / Navent

Este guia orienta imobiliárias, corretores e administradores a conectar o catálogo de imóveis do **Taime Pro** aos portais do grupo Navent (**Imovelweb** e **Wimoveis**) através do feed de cargas automatizadas **XML ON (OpenNavent)** e configurar o recebimento de leads em tempo real.

---

## 1. Visão Geral da Integração

* **Formato de Carga:** XML ON (OpenNavent) padrão Navent/Imovelweb.
* **Frequência de Atualização:** Dinâmica com cache de alta performance (sincronização automática de preços, status e fotos).
* **Captação de Contatos:** Webhook/Callback em tempo real + Vínculo por Código da Sucursal.
* **Compatibilidade:** Todos os tipos de imóveis (Residenciais, Comerciais, Terrenos e Rurais) com fotos em alta resolução e atributos completos (CFTs).

---

## 2. Passo a Passo: Como Extrair a URL do Feed no Taime Pro

1. Acesse o painel administrativo do **Taime Pro** com suas credenciais de gestor.
2. No menu lateral, navegue até **Configurações** > **Portais e Integrações**.
3. Na seção **Imovelweb / Grupo Navent**, localize o campo **URL do Feed XML ON**:
   * **URL de Produção Oficial:**  
     `https://[SEU-DOMINIO]/feed/imovelweb.xml`
   * **URL com Sucursal Específica (Opcional):**  
     `https://[SEU-DOMINIO]/feed/imovelweb.xml?sucursal=[CODIGO_DA_SUCURSAL]`
4. Clique no botão **"Copiar URL"**.

---

## 3. Passo a Passo: Ativação na Central do Anunciante (CA) do Imovelweb

1. Acesse a **Central do Anunciante** do Imovelweb ([centraldoanunciante.imovelweb.com.br](https://centraldoanunciante.imovelweb.com.br)) com o login da sua imobiliária.
2. No menu superior ou lateral, clique em **Minha Conta** > **Integração / Carga de Imóveis**.
3. Na lista de integradores parceiros homologados, selecione **Taime Pro**.
4. No campo **URL do Feed XML**, cole a URL copiada no Passo 2.
5. Em **Periodicidade / Modo de Carga**, mantenha a opção **Automática (Carga Diária / Periódica)** ativada.
6. Clique em **Salvar e Validar Carga**.

> 💡 **Nota Técnica:** A engenharia do Imovelweb fará a primeira varredura para validação de bairros, fotos e valores. Assim que concluído, os imóveis passarão a ser publicados automaticamente.

---

## 4. Estrutura para Recepção de Leads em Tempo Real

O Taime Pro disponibiliza recepção de leads com triagem inteligente:

* **Endpoint de Webhook:**  
  `POST https://[SEU-DOMINIO]/api/leads/imovelweb`
* **Formato Suportado:** JSON / Form-Data (Navent Callback).
* **Campos Mapeados:**
  * `clientName` / `nome`: Nome do interessado
  * `clientEmail` / `email`: E-mail de contato
  * `clientPhone` / `telefone`: Telefone/WhatsApp do lead
  * `propertyId` / `codigoReferencia`: Código do imóvel no Taime Pro
  * `message` / `mensagem`: Mensagem enviada pelo cliente no portal
* **Fluxo Operacional:** O lead recebido pelo webhook é instantaneamente direcionado para o robô de IA / Helena CRM, iniciando o atendimento e notificando a equipe de corretores em tempo recorde.

---

## 5. Dúvidas Frequentes (FAQ)

### Como publicar ou despublicar um imóvel?
Basta marcar ou desmarcar a opção **"Exibir no Site / Portais"** no cadastro do imóvel no Taime Pro. O feed XML removerá automaticamente o anúncio na próxima leitura do Imovelweb, retirando-o do ar.

### As fotos são atualizadas automaticamente?
Sim. O Taime Pro entrega a lista ordenada de fotos diretamente do storage em alta definição, preservando a foto de destaque como imagem principal.

### O que fazer caso algum bairro não seja reconhecido no Imovelweb?
Na Central do Anunciante, acesse a aba **"De-Para de Localidades"** para vincular qualquer bairro novo da imobiliária à base de dados geográfica oficial do Imovelweb.

---

## 6. Suporte Técnico ao Integrador

* **Empresa Responsável:** Santos e Mello Imóveis Ltda. / Taime Pro
* **E-mail de Suporte:** `Financeiro@santosemello.com.br`
* **Telefone / WhatsApp:** `(11) 4469-2121`
