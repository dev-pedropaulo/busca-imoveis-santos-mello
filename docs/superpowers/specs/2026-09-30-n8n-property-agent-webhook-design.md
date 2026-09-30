# MVP: webhook n8n para consulta de imóveis por agente

## Objetivo

Permitir que um agente de atendimento imobiliário consulte, durante uma conversa, informações de um imóvel a partir do seu código. A primeira versão é demonstrável sem dependências externas: três imóveis fictícios vivem no próprio fluxo n8n e a resposta é textual, pronta para exibição ao cliente.

## Escopo do MVP

- Um webhook n8n público com método `GET`.
- Entrada por query string: `codigo`, por exemplo `?codigo=SM-1001`.
- Catálogo em memória com os códigos `SM-1001`, `SM-1002` e `SM-1003`.
- Resposta JSON com uma mensagem humanizada e os dados estruturados do imóvel.
- Resposta JSON de erro para código ausente ou inexistente.

Fotos não serão entregues nesta etapa. O modelo terá o campo opcional `imagens` para inclusão posterior, sem quebrar o contrato.

## Contrato HTTP

Após ativar o fluxo no n8n, a URL de produção seguirá o padrão:

```text
GET https://SEU-N8N/webhook/imovel?codigo=SM-1001
```

### Sucesso: HTTP 200

```json
{
  "encontrado": true,
  "codigo": "SM-1001",
  "mensagem": "Apartamento à venda no Gonzaga, Santos/SP. 2 dormitórios, 1 suíte, 78 m², 1 vaga. Valor: R$ 690.000. Próximo à praia, com varanda e lazer completo.",
  "imovel": {
    "codigo": "SM-1001",
    "titulo": "Apartamento com varanda no Gonzaga",
    "tipo": "Apartamento",
    "finalidade": "Venda",
    "bairro": "Gonzaga",
    "cidade": "Santos",
    "uf": "SP",
    "preco": 690000,
    "area_m2": 78,
    "quartos": 2,
    "suites": 1,
    "banheiros": 2,
    "vagas": 1,
    "descricao": "Apartamento bem iluminado, a poucos minutos da praia.",
    "imagens": []
  }
}
```

### Não encontrado: HTTP 404

```json
{
  "encontrado": false,
  "codigo": "SM-9999",
  "mensagem": "Não encontrei um imóvel disponível com o código SM-9999. Confirme o código e tente novamente."
}
```

### Código não informado: HTTP 400

```json
{
  "encontrado": false,
  "mensagem": "Informe o código do imóvel no parâmetro codigo. Exemplo: ?codigo=SM-1001"
}
```

## Fluxo n8n

```text
Webhook (GET /imovel)
  -> Code: normaliza o código e consulta o catálogo mockado
  -> Respond to Webhook: retorna HTTP 200, 400 ou 404
```

O nó `Code` aceita códigos sem distinguir maiúsculas de minúsculas e remove espaços externos. Ele concentra o catálogo e a montagem da mensagem, mantendo o fluxo pequeno e simples de importar.

## Evolução posterior

Quando o catálogo real estiver pronto, substituir somente o catálogo mockado por uma chamada HTTP ao endpoint existente `GET /api/imovel/:id`. Esse endpoint já contém detalhes e URLs de imagens. O nó de formatação preservará o contrato acima e preencherá `imagens` com essas URLs.

## Testes de aceitação

1. `?codigo=SM-1001`, `SM-1002` e `SM-1003` retornam HTTP 200, com `encontrado: true` e uma mensagem em português.
2. `?codigo=sm-1001` também localiza o imóvel.
3. `?codigo=SM-9999` retorna HTTP 404 e mensagem de orientação.
4. A chamada sem `codigo` retorna HTTP 400 e exemplo de uso.
