# API de Relatórios (`/api/system/reports`)

Documentação dos endpoints de dashboard e exportação Excel do módulo `system`.

---

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/reports` | Dados agregados para dashboard |
| `POST` | `/reports/export` | Exportação Excel (streaming) |
| `GET` | `/reports/export-test` | Mesma exportação, para testes via browser/curl |

Listagem de clientes para o multi-select do front: `GET /api/system/clients`.

---

## Exportação Excel

### `POST /reports/export`

Gera um arquivo `.xlsx` em streaming.

#### Body (JSON)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `type` | `"services"` \| `"schedules"` | Sim | Tipo de relatório |
| `dateFrom` | `string` (`YYYY-MM-DD`) | Não | Início do período (UTC, início do dia) |
| `dateTo` | `string` (`YYYY-MM-DD`) | Não | Fim do período (UTC, fim do dia) |
| `includeOldData` | `boolean` | Não | Inclui planilha de serviços legados. **Somente** `type: "services"`. Padrão: `false` |
| `clientIds` | `string[]` | Não | Um ou mais IDs de cliente/subcliente para filtrar a exportação |
| `clientId` | `string` | Não | Atalho retrocompatível para um único cliente (equivalente a `clientIds: [clientId]`) |

Se `clientIds` / `clientId` forem omitidos, o comportamento permanece o de antes: **todos os clientes** no período informado.

#### Exemplo — exportação completa (sem filtro de cliente)

```json
{
  "type": "services",
  "dateFrom": "2026-01-01",
  "dateTo": "2026-05-18",
  "includeOldData": true
}
```

#### Exemplo — um ou mais clientes

```json
{
  "type": "services",
  "dateFrom": "2026-01-01",
  "dateTo": "2026-05-18",
  "includeOldData": false,
  "clientIds": [
    "664a1b2c3d4e5f6012345678",
    "664a1b2c3d4e5f6012345679"
  ]
}
```

#### Resposta

- **200**: stream `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **400**: tipo inválido ou `includeOldData` em agendamentos
- **500**: erro interno

Nome do arquivo (exemplo):

`services-report-com-legado-clientes-2-2026-05-18.xlsx`

---

### `GET /reports/export-test`

Mesmos parâmetros via **query string**, útil para testes rápidos.

```
GET /api/system/reports/export-test?type=services&dateFrom=2026-01-01&dateTo=2026-05-18&includeOldData=true&clientIds=id1,id2
```

| Query | Descrição |
|-------|-----------|
| `clientIds` | IDs separados por vírgula, ou repetir o parâmetro |
| `clientId` | Um único ID (retrocompatível) |

---

## Filtro por cliente — comportamento

### Dados atuais (`Service`, `Schedule`)

- Campo `client` é `ObjectId` referenciando a collection `clients`.
- Para cada ID em `clientIds`, o backend expande o escopo:
  - **Cliente pai**: inclui o pai e **todos os subclientes**.
  - **Subcliente**: inclui **apenas** aquele subcliente.
- Vários IDs são unidos (união) sem duplicar ObjectIds.

Implementação: `buildClientMatchIds` / `buildClientMatchIdsMany` em `services/reportAggregations.js`.

### Dados legados (`ServiceLegacy`, só em `includeOldData: true`)

- Campo `client` é **string** (nome gravado na importação).
- O filtro usa os **nomes** dos documentos `Client` resolvidos a partir dos mesmos IDs.
- Registros legados cujo nome não bater com nenhum nome resolvido **não entram** na exportação.

### Período de datas

- Sem alteração: mesma lógica de `buildDateRange` (serviços usam `validatedAt` ou `createdAt` quando não validado).
- Filtro de cliente é **combinado** com o de data via `$and`.

### Stepper no front (sugestão de passos)

1. Tipo: `services` ou `schedules`
2. Período: `dateFrom`, `dateTo`
3. Legado: `includeOldData` (apenas se `type === "services"`)
4. Clientes (opcional): multi-select → enviar `clientIds: string[]`
5. Confirmar → `POST /reports/export`

---

## Dashboard (sem alteração nesta entrega)

`GET /reports?startDate=&endDate=&clientId=`

Continua aceitando **um único** `clientId` na query para agregações do dashboard. A exportação usa `clientIds` no body; são contratos distintos de propósito.

---

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `services/reportAggregations.js` | `parseClientIdsFromInput`, `buildClientMatchIdsMany`, `buildLegacyClientNames*` |
| `services/reportExport.js` | Filtro de cliente na exportação (atual + legado) |
| `controllers/ReportController.js` | Lê `clientIds` / `clientId` no `exportData` |
| `routes/ReportRoutes.js` | `export-test` com `clientIds` |
| `routes/ExportTestRoute.js` | Idem |
| `docs/REPORTS.md` | Esta documentação |
