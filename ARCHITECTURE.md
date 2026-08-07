# 🏗️ Arquitetura Técnica

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Styling** | Tailwind CSS 4, Shadcn UI |
| **Estado** | SWR (data fetching + caching) |
| **Database** | Supabase PostgreSQL |
| **Storage** | Supabase Storage (privado) |
| **Gráficos** | Recharts |
| **Ícones** | Lucide React |

## Fluxo de Dados

### 1. Criar Destinatário

```
POST /api/recipients
├── Criar recipient em DB
├── Buscar arquivo ativo (files)
├── Gerar código único (generateSecureCode)
└── Criar download_link
```

### 2. Acessar Link de Download Público

```
GET /d/[code]
├── Buscar link via API
├── Registrar page_view event
└── Mostrar página de download
```

### 3. Baixar Arquivo

```
GET /api/download/[code]
├── Validar código
├── Registrar download_started
├── Buscar arquivo no Storage
├── Registrar download_delivered
├── Incrementar contadores
└── Retornar arquivo com headers corretos
```

### 4. Registrar Evento Customizado

```
POST /api/events
├── Validar código
├── Coletar dados (IP, User-Agent, etc)
├── Fazer geolocalização (ipapi.co)
├── Parsear User-Agent
├── Inserir em download_events
└── Incrementar access_count se page_view
```

### 5. Obter Estatísticas

```
GET /api/stats
├── Buscar todos os links
├── Buscar todos os eventos
├── Buscar destinatários e arquivos
├── Calcular totais (downloads, acessos, IPs únicos)
├── Agregar por device, país, browser
├── Preparar dados dos últimos 7 dias
└── Retornar JSON com todas as stats
```

## Banco de Dados

### Tabelas

#### files
```sql
id (UUID) - PK
original_name (TEXT)
storage_path (TEXT) - Caminho no Supabase Storage
mime_type (TEXT)
size (BIGINT)
active (BOOLEAN) - Apenas 1 ativo por vez
created_at, updated_at
```

#### recipients
```sql
id (UUID) - PK
name (TEXT)
email (TEXT)
active (BOOLEAN)
created_at, updated_at
```

#### download_links
```sql
id (UUID) - PK
code (TEXT UNIQUE) - 32 caracteres (base62)
recipient_id (UUID) - FK → recipients
file_id (UUID) - FK → files
active (BOOLEAN)
access_count (INTEGER) - page_view events
download_count (INTEGER) - download_delivered events
created_at, updated_at
```

#### download_events
```sql
id (UUID) - PK
download_link_id (UUID) - FK
recipient_id (UUID) - FK (pode ser NULL)
file_id (UUID) - FK (pode ser NULL)
event_type (TEXT) - enum: page_view, button_click, download_started, download_delivered
ip_address (TEXT)
country, region, city, timezone (TEXT)
provider, organization (TEXT)
device_type (TEXT) - enum: desktop, mobile, tablet, other
operating_system, browser, browser_version (TEXT)
user_agent, referer (TEXT)
created_at (TIMESTAMPTZ)
```

### Índices

- `download_links.code` - Para lookup rápido
- `download_links.recipient_id` - Para queries por destinatário
- `download_events.download_link_id` - Para buscar eventos de um link
- `download_events.recipient_id` - Para agregações
- `download_events.created_at` - Para range queries (últimos 7 dias)
- `download_events.event_type` - Para filtrar por tipo
- `download_events.ip_address` - Para IPs únicos

### RLS (Row Level Security)

Todas as tabelas têm RLS **habilitado** mas **sem políticas**. Isso significa:
- Acesso apenas via Service Role (backend)
- Não há risco de usuários acessarem dados diretamente
- Admin panel acessa via Next.js APIs (Server Actions)

## APIs

### POST /api/events
Registra evento de rastreamento

**Request:**
```json
{
  "code": "Ab3dEfGhIjKlMnOpQrStUvWx",
  "event_type": "page_view"
}
```

**Response:**
```json
{
  "id": "uuid",
  "download_link_id": "uuid",
  "recipient_id": "uuid",
  "event_type": "page_view",
  "ip_address": "203.0.113.45",
  "country": "Brazil",
  "device_type": "mobile",
  ...
}
```

### POST /api/recipients
Criar novo destinatário

**Request:**
```json
{
  "name": "João Silva",
  "email": "joao@example.com"
}
```

**Response:**
```json
{
  "recipient": { "id": "uuid", "name": "João Silva", ... },
  "link": { "id": "uuid", "code": "Ab3dEfGhIjKlMnOpQrStUvWx", ... }
}
```

### GET /api/stats
Obter estatísticas globais

**Response:**
```json
{
  "totalDownloads": 42,
  "totalAccesses": 156,
  "uniqueIPs": 89,
  "todayDownloads": 5,
  "iosPercent": "25.0",
  "desktopPercent": "50.0",
  "mobilePercent": "25.0",
  "deviceStats": {
    "desktop": 78,
    "mobile": 39,
    "tablet": 39
  },
  "last7Days": {
    "26/07/2026": 10,
    "25/07/2026": 8,
    ...
  },
  "topCountries": [
    { "country": "Brazil", "count": 100 },
    { "country": "USA", "count": 30 }
  ],
  "topBrowsers": [
    { "browser": "Chrome", "count": 120 },
    ...
  ],
  "recipientStats": [
    {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@example.com",
      "accesses": 45,
      "downloads": 12,
      "events": 50,
      "lastEvent": "2026-07-26T15:30:00Z"
    }
  ],
  "detailedLog": [
    {
      "id": "uuid",
      "type": "download_delivered",
      "recipient": "João Silva",
      "device": "mobile",
      "browser": "Chrome",
      "country": "Brazil",
      "timestamp": "2026-07-26T15:30:00Z"
    }
  ]
}
```

### GET /api/download/[code]
Baixar arquivo

**Headers:**
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="documento.pdf"
Content-Length: 1024000
```

## Geolocalização

Usa API gratuita: **ipapi.co**

```javascript
// Endpoint: https://ipapi.co/{ip}/json/
// Retorna:
{
  "ip": "203.0.113.45",
  "country_name": "Brazil",
  "region": "São Paulo",
  "city": "São Paulo",
  "timezone": "America/Sao_Paulo",
  "asn_org": "AS123 ISP Name",
  "org": "Company Name"
}
```

**Notas:**
- Rate limit: ~1000 requests/dia para IP de servidor
- Fallback para valores NULL se falhar
- Nunca bloqueia o download

## Parsing de User-Agent

Usa biblioteca: **ua-parser-js**

Extrai:
- Device type (desktop, mobile, tablet)
- OS (Windows, macOS, iOS, Android, etc)
- Browser (Chrome, Firefox, Safari, Edge, etc)
- Browser version

## Geração de Código Único

```javascript
// generateSecureCode() em lib/utils/download.ts
function generateSecureCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  const array = new Uint8Array(16)
  crypto.getRandomValues(array) // Criptograficamente seguro
  for (let i = 0; i < array.length; i++) {
    code += chars[array[i] % chars.length]
  }
  return code // Resultado: ~32 caracteres aleatórios
}
```

## Security

### Storage Privado
- Bucket `downloads` é **privado**
- Acesso apenas via Supabase Storage API com Service Role
- Usuários não podem acessar diretamente a URL

### Validação de Links
```typescript
// 1. Buscar link por código
const link = await db.download_links.findUnique({ code })

// 2. Verificar se está ativo
if (!link.active) return 403 Forbidden

// 3. Verificar arquivo
const file = await db.files.findUnique({ id: link.file_id })
if (!file || !file.active) return 404 Not Found

// 4. Servir arquivo
return supabase.storage.download(file.storage_path)
```

### RLS
- Todas as tabelas com RLS habilitado
- Sem políticas públicas
- Acesso apenas via `createClient()` no backend (usa SERVICE_ROLE_KEY)

### Input Validation
- Código validado contra UUID
- Event type validado contra enum
- File size limitado (depende do Supabase)

## Performance

### Caching
- SWR com `refreshInterval: 30000` (30 segundos)
- Deduplicação automática de requests
- Revalidação ao focar a aba

### Otimizações
- Index em `download_links.code` para lookup O(1)
- Index em `download_events.created_at` para range queries
- Index em `download_events.event_type` para aggregações
- Sem N+1 queries (queries otimizadas)

### Escalabilidade
- PostgreSQL escala bem até ~10M eventos
- Storage ilimitado no Supabase
- API rate limits dependem do plano Supabase

## Deployment

### Vercel
- Deploy de Next.js native
- Environment variables seguros
- Automatic SSL/TLS
- Edge functions disponíveis

### Variáveis de Ambiente
```
NEXT_PUBLIC_SUPABASE_URL          # Público
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Público (seguro - tem RLS)
SUPABASE_SERVICE_ROLE_KEY         # Secreto - nunca expor
```

## Monitoramento

### Logs
- Console.log com prefixo `[v0]` para debugging
- Erros capturados em try-catch
- Erros retornados com status HTTP apropriado

### Métricas
- Dashboard mostra: downloads/dia, IPs únicos, top países
- Tabela de destinatários com stats
- Log detalhado dos últimos 100 eventos

## Futuras Melhorias

- [ ] Autenticação com senha no admin
- [ ] Limites de validade do link (data de expiração)
- [ ] Senha para links
- [ ] Notificações por e-mail
- [ ] Webhooks para eventos
- [ ] Dashboard customizável
- [ ] Dark mode automático
- [ ] Suporte a múltiplos arquivos por link
- [ ] Resumable uploads (arquivos grandes)
- [ ] CDN global para downloads

---

**Documentação mantida em**: Julho 2026
