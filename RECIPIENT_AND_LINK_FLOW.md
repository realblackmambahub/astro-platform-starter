# Fluxo de Destinatário e Geração de Link

## Visão Geral

Implementei o fluxo completo de criação de destinatário e geração de link de download, permitindo que administradores cadastrem rapidamente destinatários com emails e gerem links personalizados.

## Endpoint: POST /api/recipients

### Entrada
```json
{
  "name": "João Silva",
  "email": "joao@exemplo.com"
}
```

### Validação
- Nome e email obrigatórios
- Email deve conter "@"

### Lógica
1. Busca arquivo ativo mais recente na tabela `files`:
   ```typescript
   .eq('active', true)
   .order('created_at', { ascending: false })
   .limit(1)
   .single()
   ```

2. Se não houver arquivo, retorna erro 404:
   ```json
   { "error": "Nenhum arquivo ativo encontrado" }
   ```

3. Cria destinatário na tabela `recipients`:
   - Campos: `name`, `email`, `active: true`

4. Gera código seguro usando `crypto.randomUUID().replaceAll('-', '')`:
   - Resulta em código de 32 caracteres

5. Cria registro em `download_links`:
   ```typescript
   {
     code,
     recipient_id: recipient.id,
     file_id: activeFile.id,
     active: true,
     access_count: 0,
     download_count: 0
   }
   ```

6. Se falhar, deleta destinatário (rollback) para evitar órfão

### Saída
```json
{
  "recipient": { "id", "name", "email", "active", ... },
  "downloadLink": { "id", "code", "recipient_id", "file_id", ... },
  "code": "2c28e1bff1904f868cfe08b1d69da19"
}
```

## Frontend: Aba "Destinatários"

### Componente RecipientsTab

#### Funcionalidades
- Formulário para criar destinatário + gerar link
- Validação de nome e email
- Mensagem de sucesso verde
- Exibição do link gerado com botão de copiar
- Lista de destinatários com informações

#### Campos do Formulário
- **Nome**: obrigatório
- **Email**: obrigatório, validação email
- Botão: "Cadastrar e gerar link"

#### Após Sucesso
1. Exibe link gerado: `${window.location.origin}/d/${code}`
2. Disponibiliza botão de copiar via `navigator.clipboard.writeText()`
3. Mostra "Link copiado!" ao clicar
4. Atualiza SWR:
   - `mutate('/api/recipients')`
   - `mutate('/api/download-links')`
5. Formulário reseta após 5 segundos

#### Lista de Destinatários
Mostra para cada destinatário:
- Nome
- Email
- Status (Ativo/Inativo)
- Link completo com botão de copiar
- 3 métricas em cards:
  - **Acessos**: `access_count` do download_link
  - **Downloads**: `download_count` do download_link
  - **Status**: "Ativo" ou "Inativo"

### SWR Integration
```typescript
const { data: recipients, mutate: mutateRecipients } = useSWR('/api/recipients')
const { data: downloadLinks, mutate: mutateDownloadLinks } = useSWR('/api/download-links')
```

## Fluxo de Dados

### Tabelas Utilizadas
1. **files**: busca arquivo ativo
2. **recipients**: cria novo destinatário
3. **download_links**: cria link com relacionamentos

### Relacionamentos
No GET `/api/download-links`:
```typescript
.select('*, recipient:recipients(*), file:files(*)')
```

Retorna dados expandidos para exibição no admin.

## Segurança

- Geração de código com `crypto.randomUUID()` (32 caracteres)
- Validação de email simples (`@`)
- Transação implícita: rollback de destinatário se link falhar
- Sem password ou autenticação necessária para o link público
- Links permanecem ativos indefinidamente até desativação

## Exemplo Real

1. Admin preenche: "João Silva" + "joao@exemplo.com"
2. Sistema gera código: `2c28e1bff1904f868cfe08b1d69da19`
3. Link gerado: `https://seu-app.com/d/2c28e1bff1904f868cfe08b1d69da19`
4. Admin copia link e compartilha
5. Qualquer pessoa acessa `/d/code` para download
6. Métricas de acesso e download são registradas

## Build Status

✓ Compilação bem-sucedida
✓ Endpoint funcionando
✓ Frontend renderizando corretamente
✓ Geração de link real com UUIDs
✓ Cópia de link ao clipboard
✓ Sincronização SWR após criação
