# FAQ - DownloadHub

## Geral

### O que é DownloadHub?
DownloadHub é um sistema completo de gerenciamento e rastreamento de downloads. Permite criar links únicos por destinatário, fazer upload de arquivos e acompanhar cada acesso com detalhes completos de geolocalização, dispositivo e navegador.

### Quanto custa?
DownloadHub é gratuito e open-source. Você paga apenas pelos serviços que usa:
- Supabase: ~$25/mês para plano básico
- Vercel: Gratuito para até 100GB/mês
- Upstash Redis: Gratuito para até 100 conexões/dia

### Posso usar em produção?
Sim! O sistema está pronto para produção e segue as melhores práticas de segurança.

### Preciso de conhecimento técnico para usar?
Não para o painel admin. Para deploy ou customização, sim é necessário conhecimento básico de Git, Node.js e SQL.

---

## Funcionalidades

### Quantos arquivos posso fazer upload?
Teoricamente ilimitado. Mas apenas 1 arquivo ativo por vez. Arquivos antigos são desativados automaticamente.

### Qual é o tamanho máximo de arquivo?
Depende do plano Supabase. No plano padrão, é 5GB por arquivo. Verifique sua cota no dashboard Supabase.

### Os links de download expiram?
Não automaticamente. Mas você pode desativar um link manualmente no painel. Links inativos retornam erro 403.

### Posso ter múltiplos arquivos simultâneos?
No design atual, apenas 1 ativo por vez. Para múltiplos arquivos simultâneos, seria necessário modificação no código.

### Os links são sequáveis? (brute force)
Não. Os códigos são gerados com 16 caracteres aleatórios usando `crypto.getRandomValues()`, resultando em ~2^94 combinações possíveis.

---

## Rastreamento e Privacidade

### Quais dados são coletados?
Para cada download:
- IP (geolocalizado)
- País, região, cidade, timezone
- Tipo de dispositivo
- Sistema operacional
- Navegador e versão
- Referer

### Posso deletar eventos?
Sim. Use o botão "Limpar Análise" no painel ou chame `DELETE /api/events`.

### Os dados estão seguros?
Sim. O banco é privado, RLS está ativado, e apenas o servidor pode acessar os dados.

### Dou consentimento aos visitantes?
Sim, você é responsável por informar aos visitantes sobre o rastreamento. Considere adicionar um banner de privacidade.

### Posso desativar o rastreamento?
Sim, comentando o código que faz `POST /api/events` na página de download.

---

## Técnico

### Como faço deploy?
Veja o arquivo `DEPLOY.md` para instruções passo a passo.

### Posso usar outro banco de dados?
Sim, mas precisaria adaptar o código. Supabase foi escolhido por simplicidade. Alternativas: Firebase, MongoDB, PostgreSQL puro.

### Posso usar outro storage?
Sim. O código está em `app/api/upload/route.ts`. Pode ser adaptado para AWS S3, Google Cloud Storage, etc.

### Posso remover o rate limiting?
Sim, comentando as linhas que usam Upstash Redis. Mas não é recomendado em produção.

### Qual é o SLA?
Depende do Supabase e Vercel. Ambos oferecem 99.9% uptime em planos pagos.

### Posso escalar isso?
Sim. A arquitetura é stateless e pode ser escalada horizontalmente. O gargalo seria o banco de dados (considere read replicas).

---

## Desenvolvimento

### Como adiciono uma nova coluna na tabela de eventos?
1. Execute a query SQL via Supabase Dashboard
2. Atualize `lib/types/index.ts` com o novo tipo
3. Atualize `app/api/events/route.ts` para incluir a nova coluna
4. Atualize a página de análise para exibir a nova informação

### Como mudo a cor do painel?
Edite `app/globals.css` e atualize as variáveis de cor CSS.

### Como adiciono autenticação?
Adicione um middleware em `app/admin/middleware.ts` que valida cookies ou JWT.

### Posso integrar com um CRM?
Sim. Cada vez que um destinatário é criado ou um download ocorre, você pode chamar uma API webhook externa.

### Como faço backup dos dados?
```bash
# Via Supabase CLI
supabase db pull > backup.sql

# Via psql
pg_dump postgresql://user:pass@host/db > backup.sql
```

---

## Troubleshooting

### O painel não carrega
- Verifique se as variáveis de ambiente estão corretas
- Verifique se o Supabase está acessível
- Abra o DevTools (F12) e veja se há erros

### Links não funcionam
- Verifique se o código do link está correto
- Verifique se o link está ativo (não desativado)
- Verifique se o destinatário está ativo
- Verifique se o arquivo está ativo

### Downloads não registram eventos
- Verifique se o Upstash Redis está configurado (opcional)
- Verifique os logs do servidor
- Verifique se há dados em `download_events` no Supabase

### Rate limit está bloqueando
- Os limites são: 100 eventos por minuto por IP
- Espere 1 minuto e tente novamente
- Se for legítimo, aumente os limites em `app/api/events/route.ts`

### Geolocalização não funciona
- ipapi.co pode estar indisponível
- Tente novamente em alguns minutos
- Ou use outro serviço de geolocalização

---

## Segurança

### O banco está exposto?
Não. Supabase usa RLS (Row-level Security) e apenas o servidor (service role) pode acessar os dados.

### Como os arquivos são protegidos?
O bucket Supabase Storage é privado. Downloads ocorrem via API, que valida o link antes de autorizar.

### Há proteção contra DDoS?
Não está implementada. Para proteção, use Cloudflare ou AWS CloudFront.

### Como limpo dados antigos?
Execute uma query SQL periódica:
```sql
DELETE FROM download_events WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Suporte

### Há documentação em outros idiomas?
Não. Toda documentação está em português (Brasil).

### Há comunidade ou fórum?
Ainda não. Você pode abrir issues no GitHub ou enviar pull requests.

### Quanto tempo leva para configurar?
- Desenvolvimento local: 15-30 minutos
- Deploy em produção: 30-60 minutos
- Integração customizada: varia

### Há exemplo de implementação?
Sim, veja `USAGE_GUIDE.md` para instruções completas com exemplos.

---

## Roadmap

### O que vem a seguir?
- Suporte a múltiplos arquivos simultâneos
- Autenticação (2FA)
- Webhooks para eventos
- Integração com CRM (Pipedrive, HubSpot)
- App mobile (React Native)
- Suporte a S3 direto
- Cache com Redis

---

## Últimas Dúvidas?

- Verifique os arquivos de documentação
- Abra uma issue no GitHub
- Leia o código-fonte (está bem comentado)
- Execute localmente e teste
