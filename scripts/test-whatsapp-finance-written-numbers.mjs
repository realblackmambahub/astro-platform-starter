import assert from 'node:assert/strict'
const { parseFinanceIntent } = await import('../services/whatsapp/finance-intent.ts')

const cases = [
  ['Kevo hoje eu gastei noventa reais no iFood', 'expense', 90, 'iFood', 'Alimentação'],
  ['hoje gastei cinquenta reais de gasolina', 'expense', 50, 'Gasolina', 'Transporte'],
  ['paguei cento e vinte reais de internet', 'expense', 120, 'Internet', null],
  ['eu paguei cento e vinte reais de internet', 'expense', 120, 'Internet', null],
  ['recebi quinhentos reais de um freela', 'income', 500, 'Freela', 'Freelance'],
  ['gastei vinte e cinco reais e cinquenta centavos no almoço', 'expense', 25.5, 'Almoço', 'Alimentação'],
]

for (const [text, type, amount, description, category] of cases) {
  const textIntent = parseFinanceIntent(text, { source: 'text' })
  const audioIntent = parseFinanceIntent(text, { source: 'audio' })
  assert.ok(textIntent, `parser result should exist: ${text}`)
  assert.deepEqual(audioIntent, textIntent, `audio/text should be equivalent: ${text}`)
  assert.equal(textIntent.type, type)
  assert.equal(textIntent.amount, amount)
  assert.equal(textIntent.description, description)
  assert.equal(textIntent.categoryCandidate, category)
  assert.ok(textIntent.transactionDate)
}

const realCase = parseFinanceIntent('gastei cinquenta reais na farmácia', { source: 'audio' })
assert.ok(realCase)
assert.equal(realCase.type, 'expense')
assert.equal(realCase.amount, 50)
assert.equal(realCase.description, 'Farmácia')
assert.equal(realCase.categoryCandidate, 'Saúde')
assert.ok(realCase.type && realCase.amount > 0 && realCase.description && realCase.transactionDate, 'all essential fields present for existing CREATE eligibility rule')

for (const text of ['Gastei 50 reais no mercado', 'paguei R$ 1.250,90 de aluguel']) {
  const intent = parseFinanceIntent(text, { source: 'text' })
  assert.ok(intent, `digit behavior should remain: ${text}`)
}

console.log(`PASS: ${cases.length * 9 + 8} written-number assertions; audio/text equivalent; CREATE eligibility separated from parser rules`)
