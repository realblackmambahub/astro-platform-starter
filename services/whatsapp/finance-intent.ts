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

const DESCRIPTION_CANONICAL: Record<string, string> = {
  farmacia: 'Farmácia',
  mercado: 'Mercado',
  supermercado: 'Supermercado',
  uber: 'Uber',
  ifood: 'iFood',
  netflix: 'Netflix',
  academia: 'Academia',
  gasolina: 'Gasolina',
  aluguel: 'Aluguel',
  salario: 'Salário',
  freela: 'Freela',
  restaurante: 'Restaurante',
  onibus: 'Ônibus',
  agua: 'Água',
  'energia eletrica': 'Energia elétrica',
}

export function normalizeTransactionDescription(description: string) {
  const cleaned = description.trim().replace(/\s+/g, ' ')
  const key = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return DESCRIPTION_CANONICAL[key] ?? cleaned.replace(/\b\p{L}/u, (letter) => letter.toUpperCase())
}

export function normalizeCategoryName(name: string) {
  return name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function inferCategoryCandidate(description: string, type: FinanceIntent['type']) {
  const text = normalizeCategoryName(description)
  const groups = type === 'income'
    ? [{ name: 'Salário', terms: ['salario', 'pagamento', 'ordenado'] }, { name: 'Freelance', terms: ['freela', 'freelance', 'job', 'servico'] }]
    : [
        { name: 'Saúde', terms: ['farmacia', 'drogaria', 'remedio', 'medicamento', 'consulta', 'medico', 'dentista', 'hospital', 'exame', 'terapia', 'academia'] },
        { name: 'Alimentação', terms: ['mercado', 'supermercado', 'restaurante', 'lanche', 'almoco', 'jantar', 'padaria', 'ifood', 'delivery', 'comida', 'cafe'] },
        { name: 'Transporte', terms: ['uber', 'taxi', 'onibus', 'metro', 'gasolina', 'combustivel', 'estacionamento', 'pedagio'] },
        { name: 'Moradia', terms: ['aluguel', 'condominio', 'agua', 'energia', 'luz', 'gas', 'internet residencial'] },
        { name: 'Lazer', terms: ['cinema', 'bar', 'show', 'jogo', 'viagem', 'passeio', 'streaming'] },
        { name: 'Educação', terms: ['curso', 'faculdade', 'escola', 'livro', 'material escolar', 'mensalidade escolar'] },
        { name: 'Assinaturas', terms: ['netflix', 'spotify', 'youtube premium', 'prime video', 'icloud', 'google one', 'assinatura'] },
      ]
  return groups.find((group) => group.terms.some((term) => text.includes(term)))?.name ?? null
}

function parseAmount(text: string) {
  const match = text.match(AMOUNT_PATTERN)
  if (!match) return null
  const raw = match[1]
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export function parseFinanceIntent(text: string, options?: { source?: 'text' | 'audio' }): FinanceIntent | null {
  console.info(`[WA DISPATCH] source=${options?.source ?? 'text'}`)
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

  const type = isExpense ? 'expense' : 'income'
  const description = normalizeTransactionDescription(cleaned)

  return {
    type,
    amount: Number(amount.toFixed(2)),
    description: description.slice(0, 120),
    categoryCandidate: inferCategoryCandidate(description, type),
    transactionDate: new Date().toISOString().slice(0, 10),
  }
}

export function formatIntent(intent: FinanceIntent) {
  const label = intent.type === 'expense' ? 'despesa' : 'receita'
  return `${label} de R$ ${intent.amount.toFixed(2).replace('.', ',')} em ${intent.description}`
}

