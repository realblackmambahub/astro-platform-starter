# Upload Route Fixes

## Alterações Realizadas

### 1. Rota de Upload (`/api/upload/route.ts`)

**Alterações principais:**

- **Validação de variáveis de ambiente aprimorada**
  - Aceita `NEXT_PUBLIC_SUPABASE_URL` ou `URL_SUPABASE`
  - Aceita `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`
  - Retorna erro específico se alguma variável estiver ausente

- **Cliente Supabase melhorado**
  - Usa `@supabase/supabase-js` diretamente
  - Configuração com `persistSession: false` e `autoRefreshToken: false`
  - Não usa `createServerClient`, cookies ou sessão de usuário

- **Tratamento de erros detalhado**
  - Retorna campo `details` em caso de erro no Storage
  - Retorna campo `details` em caso de erro ao salvar no banco
  - Todos os erros agora têm estrutura: `{ error: "...", details: "..." }`

- **Rollback de operações**
  - Se o upload no Storage funcionar mas salvar no banco falhar
  - Arquivo é removido do Storage antes de retornar o erro

- **Logs seguros**
  - `console.log` mostra apenas caminhos do arquivo
  - `console.error` não imprime chaves secretas
  - Padrão: `[v0] descrição: mensagem`

### 2. Frontend - FilesTab (`app/admin/page.tsx`)

**Alterações principais:**

- **Mensagem de erro aprimorada**
  - Exibe `error` e `details` juntos
  - Formato: `"Erro ao enviar para o Storage: CORS error"`

- **Tratamento de exceções**
  - Captura erros de rede e conexão
  - Exibe mensagem clara ao usuário

## Estrutura de Erro Retornada

### Sucesso (201)
```json
{
  "id": "uuid",
  "original_name": "arquivo.pdf",
  "storage_path": "1234567890-arquivo.pdf",
  "mime_type": "application/pdf",
  "size": 1024,
  "active": true
}
```

### Erro no Storage (500)
```json
{
  "error": "Erro ao enviar para o Storage",
  "details": "CORS error" ou "Bucket not found" etc
}
```

### Erro no Banco (500)
```json
{
  "error": "Erro ao salvar arquivo no banco",
  "details": "duplicate key value violates unique constraint"
}
```

### Erro de Configuração (500)
```json
{
  "error": "Erro ao configurar upload",
  "details": "Supabase URL não configurada" ou "Supabase Secret Key não configurada"
}
```

## Testes Realizados

- ✓ Build compila sem erros
- ✓ Interface do painel carrega corretamente
- ✓ Aba de arquivos exibe "Nenhum arquivo cadastrado"
- ✓ Botão "Upload de arquivo" funciona
- ✓ Tratamento de erros no frontend implementado

## Próximos Passos

1. Conectar Supabase com credenciais válidas
2. Testar upload de arquivo real
3. Verificar rollback em caso de erro
4. Validar logs no console do servidor
