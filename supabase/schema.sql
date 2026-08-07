-- Criar extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de arquivos
CREATE TABLE IF NOT EXISTS public.files (
  id uuid primary key default gen_random_uuid(),
  original_name text not null,
  storage_path text not null,
  mime_type text not null,
  size bigint not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de destinatários
CREATE TABLE IF NOT EXISTS public.recipients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de links de download
CREATE TABLE IF NOT EXISTS public.download_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  recipient_id uuid not null references public.recipients(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  active boolean not null default true,
  access_count integer not null default 0,
  download_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de eventos de download
CREATE TABLE IF NOT EXISTS public.download_events (
  id uuid primary key default gen_random_uuid(),
  download_link_id uuid not null references public.download_links(id) on delete cascade,
  recipient_id uuid references public.recipients(id) on delete set null,
  file_id uuid references public.files(id) on delete set null,
  event_type text not null check (event_type in ('page_view', 'button_click', 'download_started', 'download_delivered')),
  ip_address text,
  country text,
  region text,
  city text,
  timezone text,
  provider text,
  organization text,
  device_type text check (device_type in ('desktop', 'mobile', 'tablet', 'other')),
  operating_system text,
  browser text,
  browser_version text,
  user_agent text,
  referer text,
  created_at timestamptz not null default now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_download_links_code ON public.download_links(code);
CREATE INDEX IF NOT EXISTS idx_download_links_recipient_id ON public.download_links(recipient_id);
CREATE INDEX IF NOT EXISTS idx_download_links_file_id ON public.download_links(file_id);
CREATE INDEX IF NOT EXISTS idx_download_events_download_link_id ON public.download_events(download_link_id);
CREATE INDEX IF NOT EXISTS idx_download_events_recipient_id ON public.download_events(recipient_id);
CREATE INDEX IF NOT EXISTS idx_download_events_file_id ON public.download_events(file_id);
CREATE INDEX IF NOT EXISTS idx_download_events_created_at ON public.download_events(created_at);
CREATE INDEX IF NOT EXISTS idx_download_events_ip_address ON public.download_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_download_events_event_type ON public.download_events(event_type);

-- Habilitar RLS (sem políticas = acesso apenas via service role)
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_events ENABLE ROW LEVEL SECURITY;
