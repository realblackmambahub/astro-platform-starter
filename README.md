# Sistema de Gerenciamento e Rastreamento de Downloads

Um sistema completo para compartilhar arquivos com rastreamento detalhado de downloads, incluindo dados de localização, dispositivo, navegador e mais.

## Características

- ✅ Painel administrativo intuitivo
- ✅ Geração de links únicos por destinatário
- ✅ Rastreamento completo: IP, geolocalização, device, browser, SO
- ✅ Arquivo privado no Supabase Storage
- ✅ Estatísticas e gráficos em tempo real
- ✅ Log detalhado de eventos
- ✅ Sem autenticação (acesso direto ao admin)
- ✅ Data no fuso horário America/Sao_Paulo

## Stack Tecnológico

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Gráficos**: Recharts
- **Ícones**: Lucide React
- **Backend**: Next.js API Routes
- **Banco de dados**: Supabase PostgreSQL
- **Armazenamento**: Supabase Storage (privado)
- **Fetching**: SWR

## Estrutura das Tabelas

### files
- `id` (UUID): Identificador único
- `original_name` (TEXT): Nome original do arquivo
- `storage_path` (TEXT): Caminho no Supabase Storage
- `mime_type` (TEXT): Tipo MIME
- `size` (BIGINT): Tamanho em bytes
- `active` (BOOLEAN): Se está ativo
- `created_at` (TIMESTAMPTZ): Data de criação
- `updated_at` (TIMESTAMPTZ): Data de atualização

### recipients
- `id` (UUID): Identificador único
- `name` (TEXT): Nome do destinatário
- `email` (TEXT): E-mail
- `active` (BOOLEAN): Se está ativo
- `created_at` (TIMESTAMPTZ): Data de criação
- `updated_at` (TIMESTAMPTZ): Data de atualização

### download_links
- `id` (UUID): Identificador único
- `code` (TEXT): Código único do link (ex: Ab3dEfGhIjKlMnOpQrStUvWx)
- `recipient_id` (UUID): Referência ao destinatário
- `file_id` (UUID): Referência ao arquivo
- `active` (BOOLEAN): Se o link está ativo
- `access_count` (INTEGER): Número de acessos (page_view)
- `download_count` (INTEGER): Número de downloads
- `created_at` (TIMESTAMPTZ): Data de criação
- `updated_at` (TIMESTAMPTZ): Data de atualização

### download_events
- `id` (UUID): Identificador único
- `download_link_id` (UUID): Referência ao link
- `recipient_id` (UUID): Referência ao destinatário
- `file_id` (UUID): Referência ao arquivo
- `event_type` (TEXT): Tipo de evento (page_view, button_click, download_started, download_delivered)
- `ip_address` (TEXT): IP do cliente
- `country` (TEXT): País (via ipapi.co)
- `region` (TEXT): Região/Estado
- `city` (TEXT): Cidade
- `timezone` (TEXT): Fuso horário
- `provider` (TEXT): Provedor de internet (ASN)
- `organization` (TEXT): Organização
- `device_type` (TEXT): Tipo (desktop, mobile, tablet, other)
- `operating_system` (TEXT): Sistema operacional
- `browser` (TEXT): Nome do navegador
- `browser_version` (TEXT): Versão do navegador
- `user_agent` (TEXT): User-Agent completo
- `referer` (TEXT): Página de origem
- `created_at` (TIMESTAMPTZ): Data do evento

## Setup Passo a Passo

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Clique em "New Project"
3. Preencha os dados:
   - Name: "download-tracking" (ou seu nome)
   - Database Password: Gere uma senha forte
   - Region: Escolha a mais próxima
4. Aguarde a criação (leva ~2 minutos)

### 2. Criar Bucket Privado

1. No Supabase, vá para "Storage"
2. Clique em "Create a new bucket"
3. Nome: `downloads`
4. **Desabilite "Public bucket"** (mantenha privado)
5. Clique em "Create bucket"

### 3. Executar SQL

1. No Supabase, vá para "SQL Editor"
2. Clique em "New Query"
3. Cole o conteúdo de `supabase/schema.sql`
4. Clique em "Run" (Ctrl+Enter)

### 4. Configurar Variáveis de Ambiente

1. No Supabase, vá para "Project Settings" → "API"
2. Copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

3. Na raiz do projeto, crie `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
```

### 5. Instalar Dependências

```bash
pnpm install
```

### 6. Executar Localmente

```bash
pnpm dev
```

Acesse http://localhost:3000 (redirecionará para /admin automaticamente)

## Uso

### Painel Admin (/admin)

1. **Visão Geral**: Dashbaord com estatísticas, gráficos e tabelas
2. **Destinatários**: Adicionar/gerenciar destinatários
3. **Arquivo**: Upload do arquivo principal
4. **Análise**: Resumo dos dados
5. **Configurações**: Zerar dados (eventos e contadores)

### Criar Destinatário

1. Vá para "Destinatários"
2. Clique em "Adicionar destinatário"
3. Preencha Nome e E-mail
4. Um link único será gerado automaticamente

### Enviar Arquivo

1. Vá para "Arquivo"
2. Clique em "Upload de arquivo"
3. Selecione o arquivo
4. O arquivo anterior será substituído automaticamente

### Compartilhar Link

1. Cada destinatário tem um link único em `/d/[code]`
2. Ao acessar, um evento `page_view` é registrado
3. Ao clicar "Baixar arquivo", um evento `button_click` é registrado
4. Rastreamento completo de download_started e download_delivered

## Tipos de Eventos

- **page_view**: Quando a página de download é aberta
- **button_click**: Quando o botão "Baixar" é clicado
- **download_started**: Quando o servidor inicia o envio
- **download_delivered**: Quando o download é completado

## Segurança

- Arquivo armazenado **privadamente** no Supabase Storage
- Download apenas via rota `/api/download/[code]`
- Row Level Security (RLS) habilitado em todas as tabelas
- Acesso apenas via Service Role (backend)
- Validação de código do link
- Verificação de status ativo do link

## Deploy na Vercel

1. Crie um repositório Git
2. Push para GitHub
3. Vá para [vercel.com](https://vercel.com)
4. Clique em "New Project"
5. Selecione o repositório
6. Configure as variáveis de ambiente (Production + Preview)
7. Deploy!

## Endpoints da API

### POST /api/events
Registrar evento de rastreamento

```json
{
  "code": "Ab3dEfGhIjKlMnOpQrStUvWx",
  "event_type": "page_view"
}
```

### GET /api/stats
Obter estatísticas globais

### GET /api/recipients
Listar destinatários

### POST /api/recipients
Criar destinatário

```json
{
  "name": "João Silva",
  "email": "joao@example.com"
}
```

### GET /api/files
Listar arquivos

### POST /api/upload
Upload de arquivo (multipart/form-data)

### GET /api/download/[code]
Baixar arquivo

### DELETE /api/events
Limpar eventos e resetar contadores

## Licença

MIT
