# Correções Definitivas - TUS Upload com Supabase

## Problemas Resolvidos

Erro: `Invalid Compact JWS`, `Unauthorized`, `AccessDenied`

### Causa Raiz
- Token assinado sendo usado em `Authorization: Bearer` (incorreto)
- Endpoint incorreto sendo construído dinamicamente
- Validação incorreta de metadados MIME type

## Soluções Implementadas

### 1. API `/api/upload/sign/route.ts`

**Antes:**
```typescript
const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)
const { data, error } = await supabaseAdmin.storage
  .from('downloads')
  .createSignedUploadUrl(storage_path)

return NextResponse.json({
  storage_path,
  signed_url: data.signedUrl,
  upload_url: `${supabaseUrl}/storage/v1/upload/resumable`,
})
```

**Depois:**
```typescript
const { data, error } = await supabaseAdmin.storage
  .from('downloads')
  .createSignedUploadUrl(storage_path, { upsert: false })

return NextResponse.json({
  storage_path,
  token: data.token  // Retorna apenas o token
})
```

**Alterações:**
- Retorna apenas `storage_path` e `token`
- Nunca expõe `signed_url` ou `signedUrl`
- Token é usado apenas em header `x-signature`

### 2. Frontend `/components/upload-file.tsx`

**Antes:**
```typescript
const { signed_url, storage_path, upload_url } = await signResponse.json()

const tusUpload = new tus.Upload(file, {
  endpoint: upload_url,
  headers: {
    authorization: `Bearer ${signed_url}`,  // ERRADO!
  },
  metadata: {
    filename: file.name,
    filetype: file.type,
  },
})
```

**Depois:**
```typescript
const { token, storage_path } = await signResponse.json()

const tusEndpoint = 'https://tjdnktlorloqjhydsnvq.storage.supabase.co/storage/v1/upload/resumable'
const tusUpload = new tus.Upload(file, {
  endpoint: tusEndpoint,  // Endpoint correto e fixo
  retryDelays: [0, 3000, 5000, 10000, 20000],
  headers: {
    'x-signature': token,      // Token aqui
    'x-upsert': 'false',
  },
  metadata: {
    bucketName: 'downloads',
    objectName: storage_path,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
  },
  chunkSize: 6 * 1024 * 1024,
  uploadDataDuringCreation: true,
  removeFingerprintOnSuccess: true,
  onProgress: (bytesUploaded, bytesTotal) => {
    const percentage = Math.round((bytesUploaded / bytesTotal) * 100)
    setProgress(percentage)
  },
  onSuccess: async () => {
    // Registra metadados
    const metadataResponse = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_name: file.name,
        storage_path,
        mime_type: file.type || 'application/octet-stream',
        size: file.size,
      }),
    })
  },
})
```

**Alterações:**
- Endpoint fixo: `https://tjdnktlorloqjhydsnvq.storage.supabase.co/storage/v1/upload/resumable`
- Header `x-signature` com o token
- Metadados corretos: `bucketName`, `objectName`, `contentType`, `cacheControl`
- Retry delays ajustados: `[0, 3000, 5000, 10000, 20000]`
- Configurações TUS otimizadas: `chunkSize: 6MB`, `uploadDataDuringCreation: true`

### 3. API `/api/upload/route.ts`

**Validação Corrigida:**
- Apenas `original_name`, `storage_path`, `size` são obrigatórios
- `mime_type` agora é opcional
- Registra metadados na tabela `files`

### 4. Verificação de Segurança

Removidos completamente:
- ✓ `Authorization: Bearer` no upload TUS
- ✓ `apikey` no frontend
- ✓ `SUPABASE_SERVICE_ROLE_KEY` exposto no frontend
- ✓ Uso de `createSignedUrl()` 
- ✓ Validações complexas de MIME type

## Fluxo Correto Agora

1. **Frontend pede token assinado**
   - `POST /api/upload/sign` com `{ original_name, mime_type, size }`

2. **Backend retorna token**
   - `{ storage_path, token }`

3. **Frontend faz upload com TUS**
   - Endpoint: `https://tjdnktlorloqjhydsnvq.storage.supabase.co/storage/v1/upload/resumable`
   - Header: `x-signature: <token>`
   - Metadados TUS

4. **Frontend registra metadados**
   - `POST /api/upload` com `{ original_name, storage_path, mime_type, size }`

## Build Status

- ✓ Compilação bem-sucedida
- ✓ Sem erros de tipo
- ✓ Interface renderiza corretamente
- ✓ Pronto para teste com Supabase real

## Checklist de Validação

- ✓ Endpoint correto: `https://tjdnktlorloqjhydsnvq.storage.supabase.co/storage/v1/upload/resumable`
- ✓ Token em header `x-signature`
- ✓ Bucket: `downloads`
- ✓ Metadados registrados após upload
- ✓ Nenhum `Authorization: Bearer` com token
- ✓ Nenhuma chave secreta no frontend
