# Validação Simplificada de Arquivo

## Resumo de Alterações

Removidas todas as validações complexas de MIME type. Implementada validação única e simples: apenas extensão do arquivo.

## Arquivos Modificados

### 1. Frontend - `components/upload-file.tsx`

**Removido:**
- Array `allowedMimeTypes` com 7 variações de MIME types
- Validação condicional de MIME type
- Accept complexo com múltiplos MIME types

**Adicionado:**
- Função `getFileExtension()` para extrair extensão corretamente
- Validação simples de extensão: `.rar` ou `.zip`
- Input `accept=".rar,.zip"` simplificado

**Exemplo de Validação:**
```typescript
function getFileExtension(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase()
  const lastDotIndex = normalizedName.lastIndexOf('.')
  if (lastDotIndex === -1) return ''
  return normalizedName.slice(lastDotIndex)
}

const extension = getFileExtension(file.name)
const allowedExtensions = ['.rar', '.zip']

if (!allowedExtensions.includes(extension)) {
  onError('Tipo de arquivo não permitido. Use um arquivo .rar ou .zip')
  return
}
```

### 2. Backend - `app/api/upload/sign/route.ts`

**Removido:**
- Array `allowedMimeTypes` com 7 variações
- Validação condicional `if (mime_type && !allowedMimeTypes.includes(mime_type))`
- Verificação obrigatória de MIME type

**Adicionado:**
- Mesma função de extração de extensão
- Validação simples: apenas `.rar` ou `.zip`
- MIME type agora é apenas metadado, não validação

**Exemplo de Validação:**
```typescript
const normalizedName = original_name.trim().toLowerCase()
const lastDotIndex = normalizedName.lastIndexOf('.')
const extension = lastDotIndex === -1 ? '' : normalizedName.slice(lastDotIndex)

if (!['.rar', '.zip'].includes(extension)) {
  return NextResponse.json(
    {
      error: 'Tipo de arquivo não permitido',
      details: 'Envie um arquivo com extensão .rar ou .zip'
    },
    { status: 400 }
  )
}
```

## Arquivos Aceitos Agora

Todos os arquivos com extensão `.rar` ou `.zip` são aceitos:

✓ `Nota.rar`  
✓ `WindowsApp.rar`  
✓ `documento.rar`  
✓ `arquivo-2026.rar`  
✓ `backup_final.RAR`  
✓ `documentos.zip`  
✓ `pasta compactada.zip`  
✓ `ARQUIVO.ZIP`  

## MIME Type

- Frontend envia `file.type` (pode ser vazio, pode ser qualquer valor)
- Backend não rejeita por MIME type
- Backend usa MIME type apenas como metadado no banco de dados

## Build Status

✓ Compilação bem-sucedida  
✓ Sem erros  
✓ Interface funcional  

## Validações Removidas

- ✓ `allowedMimeTypes` no frontend
- ✓ `allowedExtensions` no frontend (substituído por `getFileExtension`)
- ✓ `allowedMimeTypes` no backend
- ✓ Validação de `file.type` específico no frontend
- ✓ Validação de MIME type no backend
- ✓ Nenhuma regra específica por nome de arquivo
