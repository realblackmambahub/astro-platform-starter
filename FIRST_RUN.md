# 🎯 Primeira Execução - Passo a Passo

## 1️⃣ Clone/Setup do Projeto (2 minutos)

```bash
# Se ainda não tiver:
npm install

# Ou com pnpm:
pnpm install
```

**Esperado:** Sem erros de instalação ✅

## 2️⃣ Crie uma Conta Supabase (5 minutos)

1. Acesse https://supabase.com
2. Clique "Start your project"
3. Entre com GitHub ou Email
4. Confirme email (verifique spam!)

## 3️⃣ Crie um Novo Projeto (5 minutos)

1. Dashboard → "New Project"
2. Preencha:
   - **Name:** `download-tracking` (ou qualquer nome)
   - **Database Password:** Gere senha forte (ex: `Abc123!@#XYZ`)
   - **Region:** Escolha perto de você
   - **Pricing Plan:** Gratuito (Free)
3. Clique "Create new project"
4. ⏳ Aguarde ~2-3 minutos...

## 4️⃣ Crie o Bucket Privado (2 minutos)

1. No projeto Supabase, vá para **Storage** (esquerda)
2. Clique "+ Create a new bucket"
3. Preencha:
   - **Bucket name:** `downloads`
   - **Private bucket:** ☑️ ATIVADO (importante!)
4. Clique "Create bucket"

**Esperado:** Bucket `downloads` aparece na lista ✅

## 5️⃣ Crie as Tabelas (2 minutos)

1. Vá para **SQL Editor** (esquerda)
2. Clique "+ New Query"
3. **Copie todo o conteúdo** de `supabase/schema.sql`
4. **Cole** na janela de query
5. Clique **Run** (ou Ctrl+Enter)

**Esperado:** Mensagens "Query Executed" ✅

## 6️⃣ Copie as Chaves (2 minutos)

1. Vá para **Settings** (rodapé esquerdo)
2. Clique em **API**
3. Você verá três chaves:

```
Project URL (copie):
https://seu-projeto.supabase.co

Anon public (copie):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Service role secret (MUITO IMPORTANTE - copie com cuidado):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 7️⃣ Configure `.env.local` (2 minutos)

1. Na **raiz do projeto**, crie arquivo `.env.local`
2. Preencha com as chaves do Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
```

**Importante:** Nunca commit este arquivo! (.gitignore já protege)

## 8️⃣ Reinicie Dev Server (1 minuto)

```bash
# Se está rodando:
Ctrl+C (para parar)

# Reinicie:
npm run dev

# Você verá:
# ▲ Next.js 16.2.6
# - Local:        http://localhost:3000
# - Environments: .env.local
```

## 9️⃣ Acesse o Admin (1 minuto)

1. Abra browser: http://localhost:3000/admin
2. Você verá:
   - Header "DownloadHub"
   - Tabs: Visão Geral, Destinatários, Arquivo, etc
   - Cards com "0" (ainda sem dados)

**Esperado:** Dashboard carrega sem erros ✅

## 🔟 Teste o Upload (3 minutos)

1. No admin, vá para aba **"Arquivo"**
2. Clique "+ Upload de arquivo"
3. Escolha um arquivo pequeno (< 10 MB)
   - Recomendado: PDF, imagem ou texto
4. Clique para selecionar
5. Aguarde upload completar

**Esperado:** Arquivo aparece na lista ✅

## 1️⃣1️⃣ Crie um Destinatário (2 minutos)

1. Vá para aba **"Destinatários"**
2. Clique "+ Adicionar destinatário"
3. Preencha:
   - **Nome:** seu nome (ex: "João Silva")
   - **E-mail:** seu email (ex: "joao@example.com")
4. Clique "Criar"

**Esperado:** Destinatário aparece na lista ✅

## 1️⃣2️⃣ Copie o Link (1 minuto)

1. Na lista de destinatários, você verá algo como:
   ```
   João Silva
   joao@example.com
   Link: d/Ab3dEfGhIjKlMnOpQrStUvWx
   ```
2. **Copie o código**: `Ab3dEfGhIjKlMnOpQrStUvWx`

## 1️⃣3️⃣ Teste o Download (2 minutos)

1. Novo abrir: http://localhost:3000/d/Ab3dEfGhIjKlMnOpQrStUvWx
2. Você verá:
   - Ícone de download
   - Nome do arquivo
   - Tamanho do arquivo
   - Nome do destinatário
   - Botão "Baixar arquivo"
3. Clique "Baixar arquivo"
4. Arquivo deve baixar para seu PC ✅

## 1️⃣4️⃣ Veja as Estatísticas (1 minuto)

1. Volta para admin: http://localhost:3000/admin
2. Vá para aba **"Visão Geral"**
3. Você verá:
   - Total de downloads: 1
   - Total de acessos: 1
   - IPs únicos: 1
   - Gráficos começam a preencher

**Esperado:** Números não são mais 0 ✅

## 🎉 Parabéns! Está Funcionando!

Se chegou aqui, o sistema está **100% operacional**!

## Troubleshooting

### Erro: "Arquivo não fornecido"
- Selecione um arquivo antes de enviar

### Erro: "Link não encontrado"
- Verifique se o código está correto
- Destinatário foi criado? Arquivo foi upload?

### Erro: "NEXT_PUBLIC_SUPABASE_URL is not set"
- Verifique `.env.local`
- Reinicie dev server (`npm run dev`)

### Statistísticas mostram 0
- Acesse a página de download primeiro
- Depois verifique admin

### Erro ao baixar arquivo
- Verifique se bucket é **privado**
- Verifique se Service Role Key está correto

## Próximos Passos

1. ✅ Teste com mais arquivos
2. ✅ Crie mais destinatários
3. ✅ Teste compartilhando o link com amigos
4. ✅ Veja como as estatísticas crescem
5. ✅ Deploy em Vercel (veja DEPLOY.md)

## Dicas Pro

### Copiar Link Facilmente
1. Na página de download pública (`/d/[code]`)
2. Pressione Ctrl+L para copiar URL
3. Compartilhe!

### Resetar Dados
1. Admin → Configurações
2. "Zerar dados"
3. Todos os eventos e contadores resets

### Ver Dados Brutos
1. Supabase → SQL Editor
2. Execute: `SELECT * FROM download_events LIMIT 10;`
3. Veja events registrados

### Monitorar em Tempo Real
1. Admin é auto-atualizado a cada 30s
2. Teste abrindo página de download em abas múltiplas
3. Veja contadores crescerem em tempo real

## Performance Notes

- ⚡ Primeira carga: ~2s
- ⚡ Admin auto-atualiza: 30s
- ⚡ Download: ~1s
- ⚡ Stats recalculadas: ~5s

## Segurança Verificada

✅ Arquivo privado  
✅ Link único por destinatário  
✅ RLS no banco  
✅ Service Role apenas  
✅ Inputs validados  

## Video Tutorial (Opcional)

Se preferir ver em ação:
1. Abra admin
2. Registre tela (ou foto)
3. Siga os mesmos passos acima

## Pronto?

**Vamos começar! 🚀**

```bash
npm run dev
# Acesse: http://localhost:3000/admin
```

---

**Dúvidas?** Veja:
- README.md - Documentação completa
- QUICKSTART.md - Guia rápido
- ARCHITECTURE.md - Detalhes técnicos

**Sucesso! 🎉**
