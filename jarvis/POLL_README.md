# 🔄 Auto Poll 72h — Documentação Completa

## O que é?

Sistema automatizado que identifica veículos sem comunicação há mais de 72 horas na plataforma MZone e envia comandos de **poll** (_.poll) para tentar reestabelecer a conexão. Se após 3 tentativas o veículo não voltar, é marcado como **manutenção**.

---

## Como Funciona

### Fluxo Resumido

```
CRON (Ter & Sex 08:00)
  │
  ├─ 1. Gera token MZone (auto-refresh a cada 50 min)
  │
  ├─ 2. Busca veículos offline 72h+ via OData $filter
  │     └─ Paginado de 10k em 10k (economia de memória)
  │
  ├─ 3. Filtra veículos DESATIVADOS (não envia poll)
  │     └─ REMOVIDO, CANCELADO, CANCELAMENTO, DESATIVADO, unidade desassociada
  │
  ├─ 4. Para cada veículo ATIVO offline:
  │     ├─ Consulta histórico no MongoDB
  │     ├─ Se < 3 tentativas → envia POST _.poll
  │     └─ Se = 3 tentativas → marca como MANUTENÇÃO
  │
  ├─ 5. Detecta veículos RECUPERADOS
  │     └─ Estavam pending mas não apareceram como offline → voltaram!
  │
  └─ 6. Salva log de execução no MongoDB
```

### Ciclo de Vida de um Veículo

```
Veículo offline 72h+
  │
  ├─ 1ª execução → status: "pending" (1 tentativa)
  ├─ 2ª execução → se ainda offline: (2 tentativas)
  ├─ 3ª execução → se ainda offline: (3 tentativas)
  ├─ 4ª execução → se ainda offline: status: "maintenance" 🔧
  │
  └─ Se voltar a comunicar em qualquer ponto:
     └─ status: "recovered" ✅ (contador zera)
```

---

## API Endpoints

Base URL: `http://localhost:5000/api/jarvis/poll`
Produção: `https://seu-render.onrender.com/api/jarvis/poll`

### 1. Trigger Manual

Inicia uma execução do poll agora. **Retorna imediatamente** e o processo roda em background.

```
POST /api/jarvis/poll/run
```

**Resposta:**
```json
{
  "message": "Execução iniciada",
  "status": "running"
}
```

**cURL (Postman raw):**
```
curl -X POST http://localhost:5000/api/jarvis/poll/run
```

> ⚠️ Se já houver uma execução em andamento, retorna 409:
> ```json
> { "error": "Execução já em andamento" }
> ```

---

### 2. Status Atual

Verifica se está rodando e mostra a última execução.

```
GET /api/jarvis/poll/status
```

**Resposta:**
```json
{
  "isRunning": true,
  "lastExecution": {
    "_id": "...",
    "startedAt": "2026-05-08T17:57:38.338Z",
    "trigger": "manual",
    "status": "running",
    "totalScanned": 47853,
    "totalPolled": 1520,
    "totalSkipped": 12,
    "totalNewMaintenance": 3,
    "totalRecovered": 45,
    "totalErrors": 2,
    "tokenRefreshCount": 1,
    "pagesProcessed": 5
  }
}
```

**cURL:**
```
curl http://localhost:5000/api/jarvis/poll/status
```

---

### 3. Log de Execuções

Retorna as últimas 20 execuções (cron e manuais).

```
GET /api/jarvis/poll/executions
```

**cURL:**
```
curl http://localhost:5000/api/jarvis/poll/executions
```

---

### 4. Histórico de Veículos

Lista veículos que receberam poll, com paginação e filtro por status.

```
GET /api/jarvis/poll/history?status=pending&page=1&limit=50
```

**Parâmetros query:**
| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `status` | string | (todos) | `pending`, `recovered`, `maintenance` |
| `page` | number | 1 | Página atual |
| `limit` | number | 50 | Itens por página |

**cURL:**
```
curl "http://localhost:5000/api/jarvis/poll/history?status=pending&page=1&limit=10"
```

---

### 5. Veículos em Manutenção

Atalho para listar só os veículos que falharam em 3 tentativas.

```
GET /api/jarvis/poll/history/maintenance
```

**Resposta:**
```json
{
  "count": 15,
  "items": [
    {
      "vehicleId": "...",
      "vin": "9BWCH6CH6RP069957",
      "description": "VOLKSWAGEN - NIVUS...",
      "totalAttempts": 3,
      "status": "maintenance",
      "flaggedAt": "2026-05-22T09:00:00.000Z",
      "attempts": [...]
    }
  ]
}
```

**cURL:**
```
curl http://localhost:5000/api/jarvis/poll/history/maintenance
```

---

### 6. Resetar Veículo

Remove um veículo da lista de manutenção (ex: após troca de equipamento).

```
POST /api/jarvis/poll/reset/:vehicleId
```

**cURL:**
```
curl -X POST http://localhost:5000/api/jarvis/poll/reset/5725fd04-f625-4c13-8ff3-000280c58233
```

---

### 7. Cleanup (Execuções travadas)

Corrige execuções que ficaram em "running" por crash do servidor.

```
POST /api/jarvis/poll/cleanup
```

**cURL:**
```
curl -X POST http://localhost:5000/api/jarvis/poll/cleanup
```

---

### 8. Limpar Tudo (⚠️ Testes)

Deleta TODOS os dados de poll (históricos + execuções). Usar só em desenvolvimento.

```
DELETE /api/jarvis/poll/clear
```

**cURL:**
```
curl -X DELETE http://localhost:5000/api/jarvis/poll/clear
```

---

## Comportamento em Produção

### Agendamento Automático
- **Quando**: Terças e Sextas às 06:00 (horário de Brasília)
- **Timezone**: `America/Sao_Paulo`
- **Expressão cron**: `0 6 * * 2,5`

### Token MZone
- Credenciais: `brazil-support@scopetechnology.com`
- Token dura 1 hora
- Renova automaticamente aos **50 minutos** (margem de 10 min)

### Performance Esperada
| Cenário | Offline | Ativos (após filtro) | Tempo estimado |
|---------|---------|---------------------|----------------|
| Normal | ~48k | ~5-8k | ~40-70 min |
| Após manutenções | ~30k | ~3-5k | ~25-40 min |

### Filtro de Desativados
Veículos com QUALQUER dessas características são ignorados:
- `description` começa com **REMOVIDO**
- `description` começa com **CANCELADO**
- `description` começa com **CANCELAMENTO**
- `description` começa com **DESATIVADO**
- `unit_Description` contém **_** (unidade desassociada)

---

## Estrutura de Arquivos

```
jarvis/
├── jobs/
│   └── PollCron.js              ← Agendamento cron
├── models/
│   ├── PollHistory.js           ← Histórico por veículo
│   └── PollExecution.js         ← Log de cada execução
├── routes/
│   └── PollRoutes.js            ← 8 endpoints REST
├── services/
│   ├── TokenManager.js          ← Cache + auto-refresh token
│   ├── PollScanner.js           ← Varredura OData paginada
│   ├── PollQueue.js             ← Fila sequencial de poll
│   └── PollOrchestrator.js      ← Coordenador geral
└── index.js                     ← (modificado) importa rotas + cron
```

---

## MongoDB Collections

### `pollhistories`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `vehicleId` | String | ID do veículo na MZone |
| `vin` | String | Chassi |
| `description` | String | Descrição do veículo |
| `status` | String | `pending` / `recovered` / `maintenance` |
| `totalAttempts` | Number | Contador de polls enviados |
| `attempts` | Array | Histórico detalhado de cada tentativa |
| `lastPollDate` | Date | Data do último poll |
| `lastSeenOffline` | Date | Última vez que apareceu offline |
| `flaggedAt` | Date | Data que virou manutenção |

### `pollexecutions`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `startedAt` | Date | Início da execução |
| `finishedAt` | Date | Fim da execução |
| `trigger` | String | `cron` ou `manual` |
| `status` | String | `running` / `completed` / `failed` |
| `totalScanned` | Number | Veículos retornados pela API |
| `totalPolled` | Number | Polls enviados com sucesso |
| `totalSkipped` | Number | Pulados (já em manutenção) |
| `totalNewMaintenance` | Number | Novos veículos → manutenção |
| `totalRecovered` | Number | Veículos que voltaram |
| `totalErrors` | Number | Erros no processo |
| `tokenRefreshCount` | Number | Renovações de token |
| `pagesProcessed` | Number | Páginas OData processadas |
