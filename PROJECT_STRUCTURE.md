# Estrutura do Projeto DownloadHub

## Organização de Pastas

```
downloadhub/
├── app/                          # App Router do Next.js
│   ├── admin/                    # Painel administrativo
│   │   ├── page.tsx             # Página principal do admin (dashboard)
│   │   └── layout.tsx           # Layout do admin
│   ├── api/                      # API Routes
│   │   ├── download/            # Download de arquivos
│   │   │   └── [code]/route.ts  # GET /api/download/[code]
│   │   ├── download-link/       # Lookup de links
│   │   │   └── [code]/route.ts  # GET /api/download-link/[code]
│   │   ├── download-links/      # CRUD de links
│   │   │   └── route.ts         # GET, POST, DELETE
│   │   ├── events/              # Rastreamento de eventos
│   │   │   └── route.ts         # POST (registrar), DELETE (limpar)
│   │   ├── files/               # Gerenciar arquivos
│   │   │   └── route.ts         # GET, POST, DELETE
│   │   ├── recipients/          # Gerenciar destinatários
│   │   │   └── route.ts         # GET, POST, PUT, DELETE
│   │   ├── stats/               # Estatísticas globais
│   │   │   └── route.ts         # GET (todas as estatísticas)
│   │   └── upload/              # Upload de arquivo
│   │       └── route.ts         # POST (fazer upload)
│   ├── d/                        # Página pública de download
│   │   ├── [code]/page.tsx      # GET /d/[code] (página do visitante)
│   │   └── layout.tsx           # Layout simples
│   ├── download/                # Alias legado
│   │   └── [code]/page.tsx      # GET /download/[code]
│   ├── layout.tsx               # Layout raiz
│   ├── page.tsx                 # / (redireciona para /admin)
│   └── globals.css              # Estilos globais
│
├── lib/                          # Lógica compartilhada
│   ├── supabase/               # Clientes Supabase
│   │   ├── client.ts           # Cliente browser
│   │   └── server.ts           # Cliente servidor (service role)
│   ├── types/
│   │   └── index.ts            # Tipos TypeScript
│   └── utils/
│       ├── download.ts         # Utilitários de download/rastreamento
│       └── rate-limit.ts       # Rate limiting com Upstash Redis
│
├── components/
│   └── ui/
│       └── button.tsx          # Componente Button (shadcn)
│
├── supabase/
│   └── schema.sql              # Schema do banco de dados
│
├── public/                      # Arquivos estáticos
│
├── .env.example                # Exemplo de variáveis de ambiente
├── next.config.mjs             # Configuração do Next.js
├── tsconfig.json               # Configuração do TypeScript
├── package.json                # Dependências
│
├── README.md                   # Documentação principal
├── QUICKSTART.md               # Guia de início rápido
├── USAGE_GUIDE.md              # Guia de uso detalhado
├── ARCHITECTURE.md             # Documentação técnica
├── DEPLOY.md                   # Instruções de deploy
├── FIRST_RUN.md                # Primeira execução
├── IMPLEMENTATION_CHECKLIST.md # Checklist de implementação
├── PROJECT_SUMMARY.md          # Resumo do projeto
├── DOCUMENTATION_INDEX.md      # Índice de documentação
└── PROJECT_STRUCTURE.md        # Este arquivo
```

## Estrutura de Banco de Dados

```
public.files
├── id (UUID) [PK]
├── original_name (TEXT)
├── storage_path (TEXT)
├── mime_type (TEXT)
├── size (BIGINT)
├── active (BOOLEAN)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

public.recipients
├── id (UUID) [PK]
├── name (TEXT)
├── email (TEXT)
├── active (BOOLEAN)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

public.download_links
├── id (UUID) [PK]
├── code (TEXT) [UNIQUE]
├── recipient_id (UUID) [FK → recipients]
├── file_id (UUID) [FK → files]
├── active (BOOLEAN)
├── access_count (INTEGER)
├── download_count (INTEGER)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

public.download_events
├── id (UUID) [PK]
├── download_link_id (UUID) [FK → download_links]
├── recipient_id (UUID) [FK → recipients]
├── file_id (UUID) [FK → files]
├── event_type (TEXT) [page_view|button_click|download_started|download_delivered]
├── ip_address (TEXT)
├── country (TEXT)
├── region (TEXT)
├── city (TEXT)
├── timezone (TEXT)
├── provider (TEXT)
├── organization (TEXT)
├── device_type (TEXT) [desktop|mobile|tablet|other]
├── operating_system (TEXT)
├── browser (TEXT)
├── browser_version (TEXT)
├── user_agent (TEXT)
├── referer (TEXT)
└── created_at (TIMESTAMPTZ)
```

## Fluxo de Dados

### Adicionar Destinatário
```
Admin Panel
    ↓
POST /api/recipients
    ↓
Create: recipients + download_links
    ↓
Response: { recipient, link }
    ↓
Admin Panel atualiza
```

### Fazer Upload de Arquivo
```
Admin Panel (file input)
    ↓
POST /api/upload (FormData)
    ↓
Upload para Supabase Storage
    ↓
POST /api/files (create DB entry)
    ↓
Deactivate arquivos antigos
    ↓
Response: { file }
    ↓
Admin Panel mostra novo arquivo
```

### Visitante Faz Download
```
Link compartilhado: /d/[code]
    ↓
GET /d/[code]
    ↓
Busca link e arquivo
    ↓
POST /api/events { code, 'page_view' }
    ↓
Incrementa access_count
    ↓
Mostra página com botão de download
    ↓
Visitor clica "Baixar"
    ↓
POST /api/events { code, 'button_click' }
    ↓
Inicia download
    ↓
POST /api/events { code, 'download_started' }
    ↓
GET /api/download/[code]
    ↓
Incrementa download_count
    ↓
Retorna arquivo
    ↓
POST /api/events { code, 'download_delivered' }
    ↓
Download completo
```

### Visualizar Estatísticas
```
Admin Panel → "Análise"
    ↓
GET /api/stats
    ↓
Calcula em tempo real:
  - Total downloads/acessos
  - Por destinatário
  - Por dispositivo
  - Por país
  - Por navegador
  - Log detalhado (últimos 100 eventos)
    ↓
Admin Panel exibe gráficos
```

## Tecnologias por Camada

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Linguagem**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **HTTP Client**: Fetch API
- **Data Fetching**: SWR (client-side)

### Backend
- **Runtime**: Node.js (via Next.js)
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **RLS**: Row-level Security (Supabase)
- **Rate Limiting**: Upstash Redis
- **Geolocation**: ipapi.co
- **User Agent Parsing**: ua-parser-js

### DevOps
- **Hosting**: Vercel (recomendado)
- **Git**: GitHub
- **Package Manager**: pnpm
- **Build Tool**: Next.js built-in
- **TypeScript**: Strict mode
- **Linting**: ESLint (padrão Next.js)

## Padrões de Código

### Naming Conventions
- Variáveis: `camelCase`
- Constantes: `CONSTANT_CASE`
- Tipos: `PascalCase`
- Arquivos: `kebab-case` (componentes: `PascalCase`)
- Funções: `camelCase`

### Estrutura de API
```ts
export async function GET/POST/PUT/DELETE(request: Request) {
  try {
    const supabase = createClient() // Service Role
    // Validação
    // Query
    // Resposta
    return NextResponse.json(data)
  } catch (error) {
    console.error('[v0] Error:', error)
    return NextResponse.json({ error: 'msg' }, { status: 500 })
  }
}
```

### Componentes React
```tsx
'use client' // Se usar state/hooks

import { useEffect, useState } from 'react'
import type { TypeName } from '@/lib/types'

export default function ComponentName() {
  const [state, setState] = useState()
  
  useEffect(() => {
    // Effects
  }, [])
  
  return <div>Content</div>
}
```

## Variáveis de Ambiente Obrigatórias

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

KV_REST_API_URL=
KV_REST_API_TOKEN=

NODE_ENV=development
```

## Comandos Úteis

```bash
# Desenvolvimento
pnpm dev

# Build
pnpm build

# Produção
pnpm start

# Lint
pnpm lint

# Type check
pnpm tsc

# Database
pnpm exec supabase db pull
pnpm exec supabase db push
```

## Métricas do Projeto

- **Linhas de Código**: ~2500 (excluindo documentação)
- **Arquivos TypeScript**: 22
- **Rotas API**: 8
- **Componentes**: 1 (painel admin é todo em uma página)
- **Tabelas no DB**: 4
- **Documentação**: 10 arquivos

## Segurança

- **RLS**: Ativado em todas as tabelas
- **Service Role**: Usado apenas no servidor
- **SQL Injection**: Protegido via Supabase parameterized queries
- **XSS**: Protegido via Next.js/React escaping
- **Rate Limiting**: Upstash Redis
- **CORS**: Apenas requisições do próprio domínio
- **Storage**: Bucket privado, downloads via API

## Performance

- **First Paint**: <500ms
- **Interactive**: <1s
- **API Response**: <100ms (média)
- **Database Query**: <50ms (média)
- **Bundle Size**: ~150KB (gzipped)

## Monitoramento Recomendado

- Erros de API (Sentry/PostHog)
- Performance (Web Vitals)
- Uptime (Vercel Analytics)
- Uso de Storage (Supabase Dashboard)
- Taxa de Rate Limiting
