# NEXT_PUBLIC_APP_URL - Configuração de Domínio

## Resumo

Implementado suporte para domínio configurável via variável de ambiente `NEXT_PUBLIC_APP_URL`. Todos os links de download agora usam esse domínio em vez do `window.location.origin`.

## Mudanças Realizadas

### Frontend (app/admin/page.tsx)

**RecipientsTab - Geração de Link:**
```tsx
const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
const url = `${appUrl.replace(/\/$/, '')}/d/${code}`
```

**RecipientsTab - Lista de Destinatários:**
- Usa mesma lógica para gerar linkUrl completo
- Exibe coluna "Arquivo vinculado" mostrando o nome do arquivo
- Link é copiável com botão de copy

**FilesTab - Indicador de Arquivo Ativo:**
- Card azul exibindo "ARQUIVO ATIVO" na topo
- Arquivo ativo destacado com badge "Ativo"
- Cores diferenciadas para arquivos ativos/inativos

### Características

✓ **Sem Barra Dupla**: `.replace(/\/$/, '')` remove barra final se existir
✓ **Link Salvado**: Apenas o código é salvo no banco, domínio é configurável
✓ **Compatibilidade**: Links antigos continuam funcionando
✓ **Arquivo Vinculado**: Mostra qual arquivo cada link utiliza
✓ **Arquivo Ativo**: Destaque visual do arquivo ativo para novos links

## Configuração

### Variável de Ambiente

```
NEXT_PUBLIC_APP_URL=https://downloads.seudominio.com.br
```

**Sem trailing slash!** O código remove automaticamente se houver.

### Fallback

Se não configurado, usa `window.location.origin`:
```tsx
const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
```

## Exemplo de Link Gerado

**Com NEXT_PUBLIC_APP_URL=https://downloads.example.com:**
```
https://downloads.example.com/d/2c28e1bff1904f868cfe08b1d69da19
```

**Sem configuração (desenvolvimento):**
```
https://sb-2d674ju15zmd.vercel.run/d/2c28e1bff1904f868cfe08b1d69da19
```

## Status

- Build: ✓ Compilado com sucesso
- Frontend: ✓ Exibição correta
- Links: ✓ Usando NEXT_PUBLIC_APP_URL
- Arquivo: ✓ Coluna exibida na lista de destinatários
