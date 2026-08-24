# 🏠 Buscador de Imóveis • Santos & Mello

Interface web moderna, minimalista e de alta performance para consulta e filtragem de imóveis em tempo real a partir do feed XML (padrão VivaReal / Imoview).

![Logo Santos & Mello](public/logo.png)

---

## 🚀 Funcionalidades

- **🔍 Busca Instantânea por Código:** Digite o código do imóvel (ex: `8797`, `2375`, `8830`) para obter resposta em menos de 5 milissegundos.
- **🎯 Filtros Avançados:**
  - Finalidade: Venda ou Locação.
  - Tipo de Imóvel: Apartamento, Sobrado, Casa, Cobertura, Kitnet, Terreno, Comercial, Galpão.
  - Bairro: Seleção dinâmica com mais de 130 bairros cadastrados.
  - Faixas de Preço Máximo, Quartos e Vagas.
  - Ordenação por Menor/Maior Preço, Maior Área e Mais Quartos.
- **📸 Galeria de Fotos em Alta Resolução:**
  - Carrossel com navegação por setas e miniaturas inferiores.
  - Modo tela cheia (zoom/modal) para inspecionar fotos.
- **🔗 Ações Rápidas de Compartilhamento:**
  - **Copiar Link:** Copia o link direto do imóvel para a área de transferência.
  - **Compartilhar no WhatsApp:** Gera uma mensagem formatada com o resumo do imóvel e link pronta para envio.
  - **Copiar Ficha:** Gera um texto estruturado para propostas ou e-mails.
  - **Abrir no Site:** Link direto para a página oficial do imóvel.
- **🌓 Design System Responsivo:**
  - Tema Claro e Escuro com alternância instantânea.
  - Tipografia moderna (*Inter* e *Plus Jakarta Sans*).
  - Tags de alto contraste e layout 100% responsivo para mobile e desktop.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5 Semântico, Vanilla CSS (Design Tokens, Dark/Light Mode), JavaScript ES6+.
- **Backend:** Node.js, Express, `fast-xml-parser`, `cors`.
- **Feed de Dados:** Feed XML VivaReal sincronizado da Santos & Mello (~1.174 imóveis).

---

## 💻 Como Rodar Localmente

### 1. Clonar o repositório
```bash
git clone https://github.com/dev-pedropaulo/busca-imoveis-santos-mello.git
cd busca-imoveis-santos-mello
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Iniciar o servidor
```bash
npm start
```

Acesse no navegador:
👉 **`http://localhost:3333`**

---

## 📄 Licença
Projeto desenvolvido para Santos & Mello Imóveis.
