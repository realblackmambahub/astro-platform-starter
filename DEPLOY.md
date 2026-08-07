# 🚀 Deploy em Produção

## Opção 1: Deploy em Vercel (Recomendado)

### Pré-requisitos
- Código no GitHub
- Conta no Vercel (gratuita)
- Projeto Supabase já configurado

### Passo a Passo

#### 1. Preparar Repositório Git

```bash
# Na raiz do projeto
git init
git add .
git commit -m "Initial commit: DownloadHub"
git branch -M main
git remote add origin https://github.com/seu-usuario/seu-repo.git
git push -u origin main
```

#### 2. Conectar no Vercel

1. Acesse https://vercel.com
2. Clique "New Project"
3. Selecione "Import Git Repository"
4. Escolha o repositório GitHub
5. Clique "Import"

#### 3. Configurar Variáveis de Ambiente

Na tela "Configure Project":

```
NEXT_PUBLIC_SUPABASE_URL = https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sua-chave-anonima
SUPABASE_SERVICE_ROLE_KEY = sua-chave-service-role (SECRETO!)
```

**IMPORTANTE:** Marque `SUPABASE_SERVICE_ROLE_KEY` como "Sensitive" ✅

#### 4. Deploy

Clique "Deploy" e aguarde (~2 minutos)

#### 5. Verificar

- Acesse: https://seu-projeto.vercel.app/admin
- Teste upload, destinatários, downloads
- Verifique estatísticas

### Próximas Deploys

Toda vez que você fizer push para `main`, o Vercel automaticamente:
1. Detecta as mudanças
2. Roda build
3. Testa
4. Deploy automático

```bash
# Fazer mudanças
git add .
git commit -m "Feature: adicionar exportação CSV"
git push origin main
# ✅ Deploy automático em ~2 minutos
```

## Opção 2: Deploy em Heroku

### Pré-requisitos
- Conta no Heroku
- Heroku CLI instalado
- Projeto Supabase configurado

### Passo a Passo

#### 1. Criar app no Heroku

```bash
heroku create seu-app-nome
```

#### 2. Configurar variáveis

```bash
heroku config:set NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
heroku config:set NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-chave-anonima"
heroku config:set SUPABASE_SERVICE_ROLE_KEY="sua-chave-service-role"
```

#### 3. Deploy

```bash
git push heroku main
```

#### 4. Ver logs

```bash
heroku logs --tail
```

## Opção 3: Docker (Self-Hosted)

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copiar arquivos
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

# Build
RUN pnpm build

# Expor porta
EXPOSE 3000

# Iniciar
CMD ["pnpm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_SUPABASE_URL: https://seu-projeto.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: sua-chave-anonima
      SUPABASE_SERVICE_ROLE_KEY: sua-chave-service-role
```

### Deploy

```bash
docker-compose up -d
```

## Domínio Customizado

### Em Vercel

1. Projeto Settings → Domains
2. "Add Domain"
3. Siga as instruções de DNS
4. Aguarde ~10 minutos para propagação

### Em Heroku

1. Projeto Settings → Domains
2. "Add Domain" (adicione o domínio)
3. Configure DNS apontando para: `seu-app-nome.herokuapp.com`

## SSL/TLS

- ✅ Vercel: Automático (Let's Encrypt)
- ✅ Heroku: Automático (Let's Encrypt)
- 🔧 Docker: Configure Nginx com Let's Encrypt

## Checklist de Deployment

- [ ] Variáveis de ambiente configuradas
- [ ] Bucket Supabase privado ✅
- [ ] SQL executado e tabelas criadas
- [ ] Arquivo de teste enviado (parabéns!)
- [ ] Destinatário de teste criado
- [ ] Link de download testado
- [ ] Estatísticas funcionando
- [ ] Domínio customizado (opcional)
- [ ] SSL/TLS ativo
- [ ] Backup do banco configurado (Supabase → Settings → Backups)

## Monitoramento

### Logs em Produção

#### Vercel
1. Projeto → Deployments
2. Clique no último deploy
3. Veja "Logs"

#### Heroku
```bash
heroku logs --tail
```

### Monitoramento de Performance

#### Vercel Analytics
1. Projeto → Analytics
2. Veja: Core Web Vitals, Performance
3. Configure alertas

#### Supabase Monitoring
1. Project → Monitoring
2. Veja: Database Performance
3. Configure alertas

## Rollback

### Vercel
1. Projeto → Deployments
2. Clique no deploy anterior
3. "Promote to Production"

### Heroku
```bash
heroku releases
heroku releases:rollback
```

### Git
```bash
git revert HEAD
git push origin main
# Vercel/Heroku re-deploy automaticamente
```

## Troubleshooting de Deploy

### Erro: "BUILD_FAILURE"

```bash
# Verifique logs
vercel logs

# Causas comuns:
# 1. Erro de TypeScript
pnpm run type-check

# 2. Import faltando
grep -r "from '@/lib/" app/

# 3. Variáveis de ambiente não setadas
echo $NEXT_PUBLIC_SUPABASE_URL
```

### Erro: "503 Service Unavailable"

- Supabase pode estar down → Veja https://status.supabase.com
- Database quota atingida → Upgrade plano
- Rate limit → Aguarde ou upgrade

### Erro: "Arquivo não encontra"

- Verificar se bucket existe em Supabase Storage
- Verificar permissões do Service Role
- Verificar `storage_path` no banco

### Links não funcionam

```bash
# Teste a API localmente
curl http://localhost:3000/api/stats

# Verifique logs do Supabase
# Project → Logs → API Logs
```

## Performance em Produção

### Recomendações

1. **Supabase Plan**
   - Gratuito: ~1000 MAU, OK para teste
   - Pro: $25/mês, recomendado
   - Enterprise: >10k MAU

2. **Vercel Plan**
   - Hobby: Gratuito, OK para teste
   - Pro: $20/mês, recomendado
   - Enterprise: Alta demanda

3. **Database Indexes**
   - ✅ Já inclusos no `schema.sql`
   - Verificar performance com: `EXPLAIN ANALYZE`

4. **Cache**
   - Admin panel: 30 segundos (SWR)
   - Considere edge caching

## Backup e Recuperação

### Backup Automático (Supabase)

1. Project → Settings → Backups
2. Habilite "Daily Backups"
3. Backups retem até 7 dias

### Backup Manual

```bash
# Export do Supabase
pg_dump -h seu-projeto.supabase.co -U postgres -d postgres > backup.sql

# Import
psql -h seu-projeto.supabase.co -U postgres -d postgres < backup.sql
```

## Atualizações e Manutenção

### Atualizar dependências

```bash
pnpm update
pnpm outdated # Ver versões desatualizadas
```

### Teste antes de deploy

```bash
pnpm run type-check # TypeScript
pnpm run build      # Build
pnpm run dev        # Teste local
```

## Segurança em Produção

### Checklist de Segurança

- [ ] `SUPABASE_SERVICE_ROLE_KEY` marcado como "Sensitive" em Vercel
- [ ] `.env.local` nunca commitado (.gitignore)
- [ ] RLS habilitado em todas as tabelas Supabase
- [ ] Bucket privado ✅
- [ ] HTTPS/SSL ativo
- [ ] Firewall Supabase configurado (optional)
- [ ] Rotação de chaves periodicamente
- [ ] Backup verificado regularmente

### Variáveis de Ambiente Seguras

```bash
# NUNCA faça isso:
git commit .env.local

# SEMPRE use:
.env.local (no .gitignore)
Variáveis de ambiente na plataforma (Vercel/Heroku)
```

## Suporte

Se encontrar problemas:

1. **Vercel Support**: https://vercel.com/support
2. **Supabase Support**: https://supabase.com/support
3. **GitHub Issues**: Reporte bugs
4. **Documentação**: README.md e QUICKSTART.md

---

**Sucesso! 🎉**

Seu aplicativo está em produção e pronto para rastrear downloads!
