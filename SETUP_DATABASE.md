# Configuração do Banco de Dados

## Passo Importante: Corrigir a Constraint CHECK

O sistema de eventos requer que a tabela `download_events` aceite os tipos de evento `'access'` e `'download'`. Você deve executar o seguinte SQL no seu Supabase para corrigir a constraint:

### 1. Abra o Supabase SQL Editor

Vá para o seu projeto Supabase > SQL Editor > Criar nova query

### 2. Cole o SQL abaixo:

```sql
-- Drop the old constraint if it exists
ALTER TABLE download_events DROP CONSTRAINT IF EXISTS download_events_event_type_check;

-- Add the new constraint that accepts 'access' and 'download'
ALTER TABLE download_events ADD CONSTRAINT download_events_event_type_check 
  CHECK (event_type IN ('access', 'download'));

-- Create/replace RPC functions for atomic counter incrementing
CREATE OR REPLACE FUNCTION increment_access_count(link_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE download_links
  SET access_count = COALESCE(access_count, 0) + 1,
      updated_at = NOW()
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION increment_download_count(link_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE download_links
  SET download_count = COALESCE(download_count, 0) + 1,
      updated_at = NOW()
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### 3. Clique "Executar"

Depois disso, os eventos de acesso e download serão registrados corretamente.

## Como Funciona o Sistema de Eventos

- **Acesso**: Registrado quando um usuário visita a página `/d/[code]`
- **Download**: Registrado quando o usuário faz download do arquivo via `/api/download/[code]`

Cada evento registra:
- IP do usuário
- Dispositivo (desktop/mobile/tablet)
- Navegador
- Localização (país, região, cidade, timezone)
- Provedores ISP

Os contadores `access_count` e `download_count` são incrementados atomicamente via RPC.

## Deduplicação

O sistema detecta automaticamente acessos/downloads duplicados do mesmo IP dentro de 5 segundos e não registra duplicatas.
