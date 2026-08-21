import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseFinanceIntent, getBrazilCivilDate, inferCategoryCandidate } from '../services/whatsapp/finance-intent.ts'

const route = await readFile(new URL('../app/api/webhooks/whatsapp/route.ts', import.meta.url), 'utf8')
assert.match(route, /contextual greeting failed/)
assert.match(route, /Transação registrada com sucesso/)
assert.match(route, /Se precisar de algo a mais, é só me chamar! 😊/)
assert.match(route, /firstName = displayName\?\.trim\(\)\.split\(\/\\s\+\/\)\[0\] \|\| null/)
assert.match(route, /Não há nome confiável disponível; não invente um/)
assert.match(route, /sem repetir valor, descrição ou categoria/)
assert.match(route, /persisted\.description/)
assert.match(route, /persisted\.amount/)
assert.match(route, /id: `edit_transaction:\$\{transactionId\}`/)
assert.match(route, /id: `delete_transaction:\$\{transactionId\}`/)

const cases = [
  ['gastei 50 reais com sinuca', 'expense', 50, 'Sinuca', 'Lazer'],
  ['gastei 90 reais no iFood', 'expense', 90, 'iFood', 'Alimentação'],
  ['paguei 120 reais de internet', 'expense', 120, 'Internet', 'Moradia'],
  ['gastei 50 reais na farmácia', 'expense', 50, 'Farmácia', 'Saúde'],
  ['gastei 200 reais no mercado', 'expense', 200, 'Mercado', 'Alimentação'],
  ['paguei 80 reais de academia', 'expense', 80, 'Academia', 'Saúde'],
  ['gastei 60 reais no cinema', 'expense', 60, 'Cinema', 'Lazer'],
  ['recebi 500 reais de um freela', 'income', 500, 'Freela', 'Freelance'],
]

for (const [input, type, amount, description, category] of cases) {
  const intent = parseFinanceIntent(input)
  assert.ok(intent, `intent ausente: ${input}`)
  assert.equal(intent.type, type)
  assert.equal(intent.amount, amount)
  assert.equal(intent.description, description)
  assert.equal(intent.categoryCandidate, category)
  assert.notEqual(intent.categoryCandidate, 'Sem categoria')
  assert.match(intent.transactionDate, /^\d{4}-\d{2}-\d{2}$/)
}

assert.equal(inferCategoryCandidate('Sinuca', 'expense'), 'Lazer')
assert.equal(inferCategoryCandidate('Netflix', 'expense'), 'Assinaturas')
assert.equal(getBrazilCivilDate(new Date('2026-08-21T02:30:00.000Z')), '2026-08-20')
assert.equal(getBrazilCivilDate(new Date('2026-08-21T03:30:00.000Z')), '2026-08-21')
const yesterday = parseFinanceIntent('gastei 50 reais no cinema ontem')?.transactionDate
assert.match(yesterday ?? '', /^\d{4}-\d{2}-\d{2}$/)
assert.notEqual(yesterday, getBrazilCivilDate())
assert.equal(parseFinanceIntent('gastei 50 reais em 20/08/2026')?.transactionDate, '2026-08-20')

console.log('PASS: finance parser, canonical categories, Brazil civil date and boundary regressions')
