# Webhook n8n de Consulta de Imóveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um fluxo n8n importável que receba um código numérico por GET e devolva os dados textuais de um dos três imóveis do MVP.

**Architecture:** Um nó Webhook recebe `codigo` por query string e um nó Code normaliza a entrada, consulta um catálogo local e monta a resposta. Um nó Respond to Webhook envia o objeto JSON e o status HTTP correspondente, permitindo que o agente consuma uma mensagem pronta e também os dados estruturados.

**Tech Stack:** n8n workflow JSON; nós nativos Webhook, Code e Respond to Webhook; JavaScript no nó Code; Node.js para a validação estática do arquivo exportado.

**Spec:** `docs/superpowers/specs/2026-09-30-n8n-property-agent-webhook-design.md`

## Global Constraints

- O endpoint deve usar `GET /webhook/imovel` e o parâmetro `codigo`.
- Os únicos códigos do MVP são numéricos: `1001`, `1002` e `1003`.
- Não há imagens nesta fase; imóveis bem-sucedidos devolvem `imagens: []`.
- A resposta deve manter `encontrado`, `codigo`, `mensagem` e, no sucesso, `imovel`.
- Código ausente retorna HTTP 400; código desconhecido retorna HTTP 404; código conhecido retorna HTTP 200.
- A busca remove espaços externos e não exige prefixos como `SM-`.

## Review Focus

- Query string sem `codigo`: deve orientar com um exemplo e nunca lançar erro de JavaScript.
- Código numérico com espaços externos, como ` 1001 `: deve localizar o mesmo imóvel.
- Código inexistente, como `9999`: deve retornar HTTP 404, sem campo `imovel`.
- Catálogo futuro com valor zero: o formatador deve exibir `R$ 0`, em vez de omitir o preço por avaliar o valor como falso.
- Texto de descrição contendo aspas: deve continuar sendo devolvido como JSON válido, sem interpolação manual de JSON.

---

### Task 1: Criar o fluxo importável do n8n

**Files:**
- Create: `n8n/workflows/consulta-imovel-mvp.json`

**Interfaces:**
- Consumes: `GET /webhook/imovel?codigo=<codigo-numérico>`.
- Produces: JSON com `encontrado: boolean`, `mensagem: string`, `codigo?: string` e `imovel?: Property`.
- `Property`: `{ codigo, titulo, tipo, finalidade, bairro, cidade, uf, preco, area_m2, quartos, suites, banheiros, vagas, descricao, imagens }`.

- [ ] **Step 1: Criar a exportação mínima do workflow com o webhook**

Criar `n8n/workflows/consulta-imovel-mvp.json` com versão de exportação do n8n, `active: false`, nó `Webhook` chamado `Receber código do imóvel`, método `GET`, caminho `imovel` e modo de resposta `responseNode`.

```json
{
  "name": "MVP - Consulta de imóvel por código",
  "nodes": [
    {
      "name": "Receber código do imóvel",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "parameters": {
        "httpMethod": "GET",
        "path": "imovel",
        "responseMode": "responseNode"
      }
    }
  ],
  "connections": {},
  "active": false,
  "settings": {}
}
```

- [ ] **Step 2: Adicionar o nó Code com teste de entrada ausente**

No nó `Buscar imóvel`, ler `String($input.first().json.query?.codigo ?? '').trim()`. Quando o resultado for vazio, devolver um único item com `statusCode: 400` e `body` exatamente igual a:

```javascript
{
  encontrado: false,
  mensagem: 'Informe o código do imóvel no parâmetro codigo. Exemplo: ?codigo=1001'
}
```

- [ ] **Step 3: Implementar catálogo e teste de sucesso**

No mesmo nó `Buscar imóvel`, definir os três registros `1001`, `1002` e `1003`, cada qual com todos os campos de `Property` e `imagens: []`. Para `1001`, usar o imóvel especificado no documento de design: apartamento à venda no Gonzaga, Santos/SP, R$ 690.000, 78 m², dois quartos, uma suíte, dois banheiros e uma vaga.

Para um código presente, retornar:

```javascript
{
  statusCode: 200,
  body: {
    encontrado: true,
    codigo: imovel.codigo,
    mensagem: `${imovel.titulo}. ${imovel.tipo} para ${imovel.finalidade.toLowerCase()} no ${imovel.bairro}, ${imovel.cidade}/${imovel.uf}. ${imovel.quartos} dormitórios, ${imovel.suites} suíte(s), ${imovel.area_m2} m², ${imovel.vagas} vaga(s). Valor: ${formatarMoeda(imovel.preco)}. ${imovel.descricao}`,
    imovel
  }
}
```

Definir a função usada acima antes da consulta:

```javascript
const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
}).format(valor);
```

Assim `0` permanece um valor válido. A mensagem contém título, finalidade, bairro/cidade/UF, quartos, suítes, área, vagas, valor e descrição.

- [ ] **Step 4: Implementar o teste de código desconhecido**

Quando não existir registro para o código, retornar:

```javascript
{
  statusCode: 404,
  body: {
    encontrado: false,
    codigo,
    mensagem: `Não encontrei um imóvel disponível com o código ${codigo}. Confirme o código e tente novamente.`
  }
}
```

- [ ] **Step 5: Adicionar o nó de resposta e as conexões**

Adicionar `Responder ao agente` do tipo `n8n-nodes-base.respondToWebhook`. Ele usa `={{ $json.body }}` como corpo JSON e `={{ $json.statusCode }}` como status HTTP. Conectar `Receber código do imóvel` -> `Buscar imóvel` -> `Responder ao agente`.

- [ ] **Step 6: Validar a estrutura do JSON e os casos de aceitação**

Executar um script Node temporário em modo somente leitura que: faz `JSON.parse` no arquivo, confirma os três nomes de nós, confirma as conexões e extrai/avalia o código do nó `Buscar imóvel` para as entradas abaixo. O arquivo de workflow não precisa de dependências novas.

```javascript
assert.equal(consultar({ query: {} }).json.statusCode, 400);
assert.equal(consultar({ query: { codigo: ' 1001 ' } }).json.body.codigo, '1001');
assert.equal(consultar({ query: { codigo: '1002' } }).json.statusCode, 200);
assert.equal(consultar({ query: { codigo: '9999' } }).json.statusCode, 404);
```

- [ ] **Step 7: Commit**

```bash
git add n8n/workflows/consulta-imovel-mvp.json
git commit -m "feat: add n8n property lookup MVP workflow"
```
