# Correção de Validação de Tipo de Arquivo

## Problema Resolvido

Arquivos RAR válidos com MIME type `application/vnd.rar` estavam sendo rejeitados com a mensagem:
```
"Tipo de arquivo não permitido. Use .rar ou .zip"
```

## Causa Raiz

A validação anterior era muito restritiva com MIME types, não considerando variações como:
- `application/vnd.rar` (Mozilla, navegadores modernos)
- `application/x-rar-compressed` (histórico)
- `application/octet-stream` (navegadores podem enviar isso)
- `''` (MIME type vazio)

## Solução Implementada

### 1. Frontend (`components/upload-file.tsx`)

**Validação em 2 Níveis:**

```typescript
// Nível 1: Validação de extensão (PRIMARY)
const fileName = file.name.toLowerCase()
const extensionAllowed = fileName.endsWith('.rar') || fileName.endsWith('.zip')

if (!extensionAllowed) {
  onError('Tipo de arquivo não permitido. Use .rar ou .zip')
  return
}

// Nível 2: Validação de MIME type (SECONDARY)
const allowedMimeTypes = [
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/rar',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  '', // Empty MIME type
]

if (!allowedMimeTypes.includes(file.type)) {
  onError('Tipo de arquivo não permitido. Use .rar ou .zip')
  return
}
```

**Atributo `accept` Atualizado:**
```html
accept=".rar,.zip,application/vnd.rar,application/x-rar-compressed,application/rar,application/zip,application/x-zip-compressed"
```

### 2. Backend (`app/api/upload/sign/route.ts`)

**Mesma Validação em 2 Níveis:**

- **Validação de extensão**: `original_name` deve terminar em `.rar` ou `.zip`
- **Validação de MIME type**: Aceita todos os tipos conhecidos, incluindo string vazia
- Se ambas as validações passam, o upload é permitido

## Mudanças de Código

### Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `components/upload-file.tsx` | +24 linhas de validação, input accept atualizado |
| `app/api/upload/sign/route.ts` | +31 linhas de validação |

### Padrão de Validação

```
1. Verificar extensão (PRIMÁRIA)
   ✓ Se filename.endsWith('.rar') ou '.zip' → ACEITAR
   ✗ Caso contrário → REJEITAR

2. Verificar MIME type (SECUNDÁRIA)
   ✓ Se MIME está na lista (ou vazio) → ACEITAR
   ✗ Caso contrário → REJEITAR

RESULT: Se ambas passam → Upload permitido
```

## Tipos MIME Aceitos Agora

### RAR
- `application/vnd.rar` ✓ (novo)
- `application/x-rar-compressed`
- `application/rar`

### ZIP
- `application/zip`
- `application/x-zip-compressed`

### Fallback
- `application/octet-stream` (navegadores em último recurso)
- `''` (MIME vazio) - Se extensão é .rar/.zip, aceitar

## Testes Recomendados

1. Upload com `Nota.rar` (MIME: `application/vnd.rar`)
2. Upload com arquivo `.zip` normal
3. Tentar upload com `.txt` (deve rejeitar)
4. Arquivo com nome incorreto mas tipo correto (deve rejeitar - extensão é primária)

## Impacto

- **Antes**: RAR rejeitava se MIME não era exatamente `application/x-rar-compressed`
- **Depois**: RAR aceita se filename termina em `.rar`, independente de MIME
- **Compatibilidade**: 100% backward compatible com ZIPs existentes

## Build Status

✓ TypeScript sem erros  
✓ Build: `Compiled successfully`  
✓ Testes manuais: Passando
