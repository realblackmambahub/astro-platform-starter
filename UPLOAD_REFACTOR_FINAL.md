# Upload Refactor - Solução Definitiva com uploadToSignedUrl

## Problema Original
- tus-js-client falhando com "Invalid Compact JWS" e "AccessDenied"
- Arquivo passando por Vercel (overhead desnecessário)
- Complexidade de protocolo resumível

## Solução Implementada

### 1. Remover tus-js-client
- Removido `pnpm remove tus-js-client @types/tus-js-client`
- Eliminadas todas as referências ao protocolo TUS
- Sem mais headers `x-signature`, `x-upsert`, etc.

### 2. Rota `/api/upload/sign` Corrigida
**Entrada (JSON):**
```json
{
  "originalName": "Nota.rar",
  "mimeType": "application/octet-stream",
  "size": 5242880
}
```

**Validação:**
- Extensão final: `.rar` ou `.zip` (case-insensitive)
- Tamanho máximo: 100MB
- Nenhuma validação de MIME type

**Processo:**
1. Cria cliente admin com `createClient()` usando `SUPABASE_SECRET_KEY`
2. Gera `storagePath` único: `${timestamp}-${uuid}.rar`
3. Chama `createSignedUploadUrl(storagePath, { upsert: false })`
4. Valida que `data.token` existe e é válido (>20 chars)

**Saída (JSON):**
```json
{
  "storagePath": "1721996400000-a1b2c3d4-e5f6-g7h8-i9j0.rar",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Frontend `components/upload-file.tsx` Refatorado
**Fluxo Correto:**

1. **Validação de Arquivo**
   - Extensão: `.rar` ou `.zip` (case-insensitive)
   - Tamanho: até 100MB
   - Sem validação de MIME type

2. **Obter Token Assinado**
   ```javascript
   POST /api/upload/sign
   {
     originalName: file.name,
     mimeType: file.type || 'application/octet-stream',
     size: file.size
   }
   ```

3. **Upload Direto para Supabase** (cliente público)
   ```javascript
   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
   )

   await supabase.storage
     .from('downloads')
     .uploadToSignedUrl(
       storagePath,
       token,
       file,
       { contentType, cacheControl }
     )
   ```

4. **Registrar Metadados**
   ```javascript
   POST /api/upload
   {
     original_name: file.name,
     storage_path: storagePath,
     mime_type: file.type,
     size: file.size
   }
   ```

### 4. Arquivo NUNCA passa por Vercel
- Vercel apenas gera o token e registra metadados
- Arquivo vai direto do navegador para Supabase Storage
- Sem overhead de Vercel

### 5. Interface
- Simples: "Clique para selecionar arquivo (.rar ou .zip)"
- Sem barra de progresso (não é suportada por uploadToSignedUrl)
- Mensagem "Enviando arquivo..." durante upload
- Mensagem de sucesso após upload + registro no banco

## Verificação de Segurança
- ✓ Nenhuma referência a `tus-js-client`
- ✓ Nenhuma referência a `x-signature`
- ✓ Nenhuma referência a `resumable upload`
- ✓ Nenhum `Bearer token` com signed token
- ✓ Chave secreta apenas no servidor (não exposta)
- ✓ Token do servidor para cliente (seguro)

## Build Status
- ✓ Compilação bem-sucedida
- ✓ Zero erros TypeScript
- ✓ Interface renderiza corretamente
- ✓ Pronto para Supabase real

## Arquivo de Compatibilidade
Aceita qualquer arquivo que termine em:
- `.rar` (maiúscula/minúscula)
- `.zip` (maiúscula/minúscula)

Exemplos válidos:
- `Nota.rar`
- `dados.ZIP`
- `ARQUIVO.Rar`
- `backup.zip`
