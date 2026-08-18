import assert from 'node:assert/strict'

const { parseEditFields, isCancellationText, isConfirmationText } = await import('../services/whatsapp/pending-actions.ts')

const amountCases = [
  ['mude o valor para 25', 25], ['muda o valor pra 25', 25], ['altera o valor pra 25', 25],
  ['troca pra 25', 25], ['corrige pra 25', 25], ['ajusta o valor para 25', 25],
  ['coloca 25', 25], ['valor 25', 25], ['valor: 25', 25], ['o valor é 25', 25],
  ['era 25', 25], ['na verdade era 25', 25], ['pode colocar 25', 25], ['deixa 25', 25],
  ['bota 25 reais', 25], ['25 reais', 25], ['R$25', 25], ['25,50', 25.5],
  ['R$ 25,50', 25.5], ['R$ 1.250,90', 1250.9], ['altera pra 25,50', 25.5],
]

for (const [input, expected] of amountCases) {
  assert.equal(parseEditFields(input)?.amount, expected, `amount parser: ${input}`)
}

const fieldCases = [
  ['descrição: Farmácia', 'description'], ['mude a descrição para Farmácia', 'description'],
  ['categoria Saúde', 'categoryName'], ['mude a categoria pra Saúde', 'categoryName'],
  ['data 17/08/2026', 'transactionDate'], ['foi ontem', 'transactionDate'],
  ['mude o valor para 35 e a descrição para Farmácia', 'description'],
  ['valor 80 e categoria Saúde', 'categoryName'],
]

for (const [input, field] of fieldCases) {
  assert.ok(parseEditFields(input)?.[field], `field parser: ${input}`)
}

for (const input of ['cancelar', 'cancela', 'cancel', 'sair', 'deixa assim', 'não quero alterar', 'voltar']) {
  assert.equal(isCancellationText(input), true, `cancel: ${input}`)
}
for (const input of ['confirmar', 'confirma', 'sim', 'sim pode excluir', 'excluir', 'apaga', 'confirmo']) {
  assert.equal(isConfirmationText(input), true, `confirm: ${input}`)
}

assert.equal(parseEditFields('-25')?.amount ?? null, null)
assert.equal(parseEditFields('gastei 50 no mercado'), null)
console.log(`WhatsApp pending parser passed (${amountCases.length + fieldCases.length + 7 + 7 + 2} cases)`)
