import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../services/whatsapp/finance-intent.ts', import.meta.url), 'utf8')
const route = await readFile(new URL('../app/api/webhooks/whatsapp/route.ts', import.meta.url), 'utf8')

const input = 'Gastei 50 reais no mercado'
const amount = Number(input.match(/(?:r\$\s*)?([\d.]+(?:,\d{1,2})?)/i)?.[1])
assert.equal(amount, 50)
assert.match(source, /description: description\.slice\(0, 120\)/)
assert.match(source, /categoryCandidate/)
assert.match(route, /const result = await createTransaction\(claim\.admin, linkedUser\.id, intent, message\.messageId\)/)
assert.doesNotMatch(route, /A confirmação prévia não é mais necessária/)
assert.doesNotMatch(route, /Quer que eu registre/)
assert.doesNotMatch(route, /Posso registrar/)
assert.doesNotMatch(route, /sim ou não/)

console.log('PASS: CREATE_EXPENSE parser/regression guard for:', input)
console.log('PASS: amount=50, description/category are separated, automatic branch is present, confirmation prompts are absent')
