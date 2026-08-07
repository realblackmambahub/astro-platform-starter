# DownloadHub - Guia de Uso

## Visão Geral

DownloadHub é um sistema completo de gerenciamento e rastreamento de downloads. Permite criar links únicos por destinatário, fazer upload de arquivos e acompanhar cada acesso com detalhes de geolocalização, dispositivo e navegador.

## Acessar o Painel Admin

1. **URL**: `http://localhost:3000/admin` (desenvolvimento) ou `https://seu-dominio.com/admin` (produção)
2. O painel abre automaticamente com todo o sistema pronto para uso

## Funcionalidades Principais

### 1. Upload de Arquivo

**Como fazer:**
- Na seção "Arquivos" do painel admin
- Clique no botão de upload
- Selecione um arquivo do seu computador
- O arquivo será armazenado no Supabase Storage (privado)
- Apenas 1 arquivo ativo por vez (uploads anteriores são desativados)

**Informações capturadas:**
- Nome original do arquivo
- Tipo MIME
- Tamanho em bytes
- Caminho de armazenamento no Storage

### 2. Gerenciar Destinatários

**Adicionar destinatário:**
- Clique em "Adicionar Destinatário"
- Insira nome e email
- Um link único será gerado automaticamente

**Editar destinatário:**
- Clique no ícone de edição
- Altere nome e email
- Salve as mudanças

**Deletar destinatário:**
- Clique no ícone de lixeira
- Confirme a exclusão (remove todos os links associados)

**Status:**
- Verde (ativo): Pode receber downloads
- Cinza (inativo): Links não funcionam

### 3. Criar Links de Download

**Automático:** Ao adicionar um destinatário, um link é criado automaticamente

**Manual:**
- Clique em "Novo Link"
- Selecione um destinatário
- Selecione um arquivo
- Clique "Gerar Link"
- Um código único de 16 caracteres é criado

**Compartilhar:**
- Copie a URL: `https://seu-dominio.com/d/CODIGOUNICO`
- Envie para o destinatário
- O link expira automaticamente quando desativado

### 4. Visualizar Estatísticas

**Visão Geral Global:**
- Total de downloads ontem
- Total de acessos históricos
- IPs únicos
- Percentual iOS vs Desktop vs Mobile
- Últimos 7 dias de downloads
- Top 10 países
- Top 10 navegadores

**Por Destinatário:**
- Número de acessos
- Número de downloads
- Data do último evento
- Status ativo/inativo

**Log Detalhado:**
- Últimos 100 eventos
- Tipo de evento (page_view, button_click, download_started, download_delivered)
- Dispositivo, navegador, país
- IP de origem
- Timestamp exato

### 5. Página Pública de Download

**Visitante clica no link:**
1. URL: `https://seu-dominio.com/d/CODIGOUNICO`
2. Página mostra:
   - Nome do arquivo
   - Tamanho
   - Nome do destinatário
   - Botão para fazer download
3. Eventos rastreados:
   - **page_view**: Ao abrir a página
   - **button_click**: Ao clicar em "Baixar"
   - **download_started**: Download iniciado
   - **download_delivered**: Download completado

**Dados coletados para cada evento:**
- IP (geolocalizado automaticamente)
- País, região, cidade, timezone
- Tipo de dispositivo (desktop/mobile/tablet)
- Sistema operacional
- Navegador e versão
- User-Agent completo
- Referer (de onde veio)

## Eventos de Rastreamento

O sistema registra 4 tipos de eventos:

| Evento | Quando Ocorre | Ação |
|--------|---------------|------|
| **page_view** | Visitante abre a página de download | Incrementa access_count |
| **button_click** | Visitante clica no botão "Baixar" | - |
| **download_started** | Download iniciado | - |
| **download_delivered** | Download completado com sucesso | Incrementa download_count |

## API REST

### Estatísticas
```bash
GET /api/stats
```
Retorna dados globais, por destinatário e log detalhado

### Eventos
```bash
POST /api/events
Body: { code, event_type }
```
Registra um novo evento de rastreamento

### Destinatários
```bash
GET /api/recipients
POST /api/recipients (criar)
PUT /api/recipients (editar)
DELETE /api/recipients (deletar)
```

### Arquivos
```bash
GET /api/files
POST /api/files (upload)
DELETE /api/files?id=UUID (deletar)
```

### Download
```bash
GET /api/download-link/[code]
GET /api/download/[code]
```

## Dados Rastreados

### Por Evento
- IP Address
- Geolocalização (país, região, cidade, timezone)
- Device Type (desktop/mobile/tablet/other)
- Operating System
- Browser
- Browser Version
- User Agent
- Referrer
- Event Type
- Timestamp

### Agregações
- Total de acessos por link
- Total de downloads por link
- Acessos por destinatário
- Downloads por destinatário
- Distribuição por dispositivo
- Distribuição por país
- Distribuição por navegador

## Segurança

### Banco de Dados
- RLS (Row Level Security) habilitado
- Acesso apenas via Service Role (no client)
- Todas as queries validadas no backend
- Proteção contra SQL Injection

### Armazenamento
- Bucket privado (não público)
- Downloads via API (nunca URL direta)
- Valida token antes de autorizar download

### Taxa de Limite (Rate Limiting)
- 100 eventos por minuto por IP
- Respeita proteção contra abuso

## Troubleshooting

### Link não funciona
- Verifique se o link está ativo
- Verifique se o destinatário está ativo
- Verifique se o arquivo está ativo

### Download não registra eventos
- Verifique se o Supabase Storage está configurado
- Verifique se o arquivo existe
- Verifique os logs da API

### Dados não aparecem nas estatísticas
- Aguarde 2 segundos após o evento
- Recarregue a página
- Verifique se há dados na tabela `download_events`

## Exportação de Dados

### Estatísticas Globais
Salve a saída de `/api/stats` como JSON:
```bash
curl https://seu-dominio.com/api/stats > stats.json
```

### Log Detalhado
Disponível na seção "Análise" do painel

### Backup Completo
```bash
# Backup do Supabase
pg_dump postgresql://user:pass@host/db > backup.sql
```

## Performance

- **Painel Admin**: Carrega em <2s
- **Página de Download**: Carrega em <500ms
- **Rastreamento de Evento**: <50ms
- **API de Stats**: <1s (calcula agregações em tempo real)

## Limitações Atuais

- 1 arquivo ativo por vez
- Máximo 100 eventos retornados no log detalhado
- Histórico ilimitado (considere limpeza periódica)

## Próximos Passos

1. Conecte o Supabase
2. Faça upload de um arquivo
3. Adicione destinatários
4. Copie um link e teste
5. Verifique o rastreamento no painel

## Suporte

Para problemas ou dúvidas:
- Verifique os logs do servidor: `pnpm dev`
- Inspecione a API: Use `/api/stats` para validar dados
- Revise a documentação: Veja `ARCHITECTURE.md` para detalhes técnicos
