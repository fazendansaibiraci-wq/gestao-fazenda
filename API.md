# Documentação da API - Gestão Fazenda

## Autenticação

Todas as rotas (exceto `/api/health` e `/api/auth/*`) requerem autenticação via JWT.

### Login

**POST** `/api/auth/signin`

```json
{
  "email": "admin@fazenda.com",
  "password": "senha123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-id",
    "email": "admin@fazenda.com",
    "name": "Administrador",
    "role": "GESTOR"
  },
  "token": "jwt-token"
}
```

### Logout

**POST** `/api/auth/signout`

---

## Talhões

### Listar Talhões

**GET** `/api/talhoes`

**Query Parameters:**
- `status`: (optional) ATIVO, INATIVO, PREPARACAO, COLHEITA
- `page`: (optional) número da página (padrão: 1)
- `limit`: (optional) itens por página (padrão: 10)

**Response:**
```json
{
  "data": [
    {
      "id": "talhao-1",
      "nome": "Talhão A",
      "area": 50.5,
      "localizacao": "Zona Norte",
      "status": "ATIVO",
      "tipoSolo": "Latossolo Vermelho",
      "ph": 6.5,
      "responsavel": {
        "id": "user-1",
        "name": "Gerente"
      },
      "dataCriacao": "2024-01-15",
      "ultimaAtualizacao": "2024-06-10"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

### Obter Talhão

**GET** `/api/talhoes/:id`

### Criar Talhão

**POST** `/api/talhoes`

```json
{
  "nome": "Talhão A",
  "area": 50.5,
  "localizacao": "Zona Norte",
  "status": "ATIVO",
  "tipoSolo": "Latossolo Vermelho",
  "ph": 6.5,
  "responsavelId": "user-1"
}
```

### Atualizar Talhão

**PUT** `/api/talhoes/:id`

```json
{
  "nome": "Talhão A Atualizado",
  "status": "PREPARACAO",
  "ph": 6.8
}
```

### Deletar Talhão

**DELETE** `/api/talhoes/:id`

---

## Safras

### Listar Safras

**GET** `/api/safras`

**Query Parameters:**
- `status`: (optional) PLANEJAMENTO, PLANTIO, DESENVOLVIMENTO, COLHEITA, FINALIZADA
- `talhaoId`: (optional) filtrar por talhão
- `ano`: (optional) filtrar por ano

### Criar Safra

**POST** `/api/safras`

```json
{
  "nome": "Safra 2024/2025",
  "ano": 2024,
  "status": "PLANTIO",
  "dataInicio": "2024-05-01",
  "dataFimEstimada": "2025-08-31",
  "estimadoProduzir": 500,
  "talhaoId": "talhao-1"
}
```

---

## Máquinas

### Listar Máquinas

**GET** `/api/maquinas`

**Query Parameters:**
- `status`: (optional) ATIVA, MANUTENCAO, INATIVA
- `tipo`: (optional) filtrar por tipo

### Criar Máquina

**POST** `/api/maquinas`

```json
{
  "nome": "Trator 1",
  "tipo": "Trator",
  "marca": "John Deere",
  "modelo": "5075E",
  "placa": "ABC1234",
  "status": "ATIVA",
  "horasUso": 1250,
  "dataAquisicao": "2021-03-15",
  "proximaManutencao": "2026-07-01"
}
```

---

## Atividades

### Listar Atividades

**GET** `/api/atividades`

**Query Parameters:**
- `status`: (optional) pendente, em_progresso, concluida
- `safraId`: (optional) filtrar por safra
- `talhaoId`: (optional) filtrar por talhão
- `dataDe`: (optional) data início (YYYY-MM-DD)
- `dataAte`: (optional) data fim (YYYY-MM-DD)

### Criar Atividade

**POST** `/api/atividades`

```json
{
  "titulo": "Adubação de Cobertura",
  "descricao": "Aplicar adubo NPK no talhão A",
  "tipo": "adubacao",
  "status": "pendente",
  "dataPrevista": "2026-06-20",
  "safraId": "safra-1",
  "talhaoId": "talhao-1",
  "responsavelId": "user-1"
}
```

### Atualizar Atividade

**PUT** `/api/atividades/:id`

```json
{
  "status": "concluida",
  "dataExecucao": "2026-06-20",
  "resultado": "Concluído com sucesso"
}
```

---

## Sincronização Offline

### Obter Logs de Sincronização

**GET** `/api/sync/logs`

**Response:**
```json
{
  "pendentes": 5,
  "sincronizados": 23,
  "logs": [
    {
      "id": "sync-1",
      "entidade": "talhao",
      "entidadeId": "talhao-1",
      "operacao": "create",
      "sincronizado": false,
      "dataCriacao": "2026-06-15T10:30:00Z"
    }
  ]
}
```

### Sincronizar Dados

**POST** `/api/sync`

**Body:** (enviado pelo service worker automaticamente)
```json
{
  "logs": [
    {
      "id": "sync-1",
      "entidade": "talhao",
      "entidadeId": "talhao-1",
      "operacao": "create",
      "dados": { ... }
    }
  ]
}
```

---

## Relatórios

### Gerar Relatório de Talhões

**GET** `/api/relatorios/talhoes`

**Query Parameters:**
- `formato`: pdf, xlsx (padrão: json)
- `filtros`: JSON string com filtros

**Response (formato json):**
```json
{
  "titulo": "Relatório de Talhões",
  "data": "2026-06-15",
  "usuario": "Administrador",
  "dados": [ ... ]
}
```

### Gerar Relatório de Safras

**GET** `/api/relatorios/safras`

**Query Parameters:**
- `formato`: pdf, xlsx (padrão: json)
- `ano`: (optional) filtrar por ano

### Gerar Relatório de Atividades

**GET** `/api/relatorios/atividades`

**Query Parameters:**
- `formato`: pdf, xlsx (padrão: json)
- `dataDe`: (optional) data início
- `dataAte`: (optional) data fim
- `status`: (optional) filtrar por status

---

## Health Check

### Verificar Saúde da Aplicação

**GET** `/api/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-06-15T10:30:00Z",
  "database": "connected"
}
```

---

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 200 | OK |
| 201 | Criado |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Não encontrado |
| 409 | Conflito |
| 500 | Erro interno do servidor |
| 503 | Serviço indisponível |

---

## Exemplos com cURL

### Login

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fazenda.com","password":"senha123"}'
```

### Listar Talhões

```bash
curl -X GET http://localhost:3000/api/talhoes \
  -H "Authorization: Bearer jwt-token"
```

### Criar Talhão

```bash
curl -X POST http://localhost:3000/api/talhoes \
  -H "Authorization: Bearer jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Talhão A",
    "area": 50.5,
    "localizacao": "Zona Norte",
    "status": "ATIVO"
  }'
```

---

## Rate Limiting

A API implementa rate limiting de:
- 100 requisições por minuto por IP
- 1000 requisições por hora por usuário autenticado

---

## Versionamento

A API atual é v1. Futuras versões serão em `/api/v2/*`

---

**Última atualização:** 15 de junho de 2026
