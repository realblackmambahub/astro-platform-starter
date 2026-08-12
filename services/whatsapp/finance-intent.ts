import 'server-only'

export type FinanceIntent = {
  type: 'income' | 'expense'
  amount: number
  description: string
  categoryCandidate: string | null
  transactionDate: string
}

const AMOUNT_PATTERN = /(?:r\$\s*)?([\d.]+(?:,\d{1,2})?|[\d]+(?:\.\d{1,2})?)/i
const EXPENSE_PATTERN = /\b(gastei|paguei|comprei|despesa|saiu|pagamento)\b/i
const INCOME_PATTERN = /\b(recebi|ganhei|entrou|renda|salário|salario|vendi|receita)\b/i

function parseAmount(text: string) {
  const match = text.match(AMOUNT_PATTERN)
  if (!match) return null
  const raw = match[1]
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export function parseFinanceIntent(text: string): FinanceIntent | null {
  const amount = parseAmount(text)
  if (!amount) return null

  const isExpense = EXPENSE_PATTERN.test(text)
  const isIncome = INCOME_PATTERN.test(text)
  if (isExpense === isIncome) return null

  const cleaned = text
    .replace(AMOUNT_PATTERN, '')
    .replace(EXPENSE_PATTERN, '')
    .replace(INCOME_PATTERN, '')
    .replace(/\b(reais?|r\$|no|na|em|de|com|por|do|da)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s&-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned || cleaned.length < 2) return null

  const description = cleaned
    .replace(/\b(mercado|supermercado)\b/gi, 'Mercado')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    type: isExpense ? 'expense' : 'income',
    amount: Number(amount.toFixed(2)),
    description: description.slice(0, 120),
    categoryCandidate: /\b(mercado|supermercado|alimentação|alimentacao)\b/i.test(cleaned)
      ? 'Alimentação'
      : null,
    transactionDate: new Date().toISOString().slice(0, 10),
  }
}

export function formatIntent(intent: FinanceIntent) {
  const label = intent.type === 'expense' ? 'despesa' : 'receita'
  return `${label} de R$ ${intent.amount.toFixed(2).replace('.', ',')} em ${intent.description}`
}

