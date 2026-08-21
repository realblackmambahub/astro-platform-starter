export type FinanceIntent = {
  type: 'income' | 'expense'
  amount: number
  description: string
  categoryCandidate: string | null
  transactionDate: string
}

const AMOUNT_PATTERN = /(?:r\$\s*)?([\d.]+(?:,\d{1,2})?|[\d]+(?:\.\d{1,2})?)/i
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900,
}
const WRITTEN_NUMBER_TOKEN = Object.keys(NUMBER_WORDS).join('|')
const WRITTEN_AMOUNT_PATTERN = new RegExp(`\\b((?:${WRITTEN_NUMBER_TOKEN}|mil)(?:\\s+(?:e\\s+)?(?:${WRITTEN_NUMBER_TOKEN}|mil)){0,8})(?:\\s+(?:reais?|real))?(?:\\s+e\\s+((?:${WRITTEN_NUMBER_TOKEN})(?:\\s+e\\s+(?:${WRITTEN_NUMBER_TOKEN})){0,3})\\s+centavos?)?\\b`, 'i')
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

export const CANONICAL_CATEGORY_NAMES = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Assinaturas', 'Freelance', 'Outros'] as const

export function getBrazilCivilDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function shiftCivilDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

export function inferCategoryCandidate(description: string, type: FinanceIntent['type']) {
  const text = normalizeCategoryName(description)
  const groups = type === 'income'
    ? [{ name: 'Salário', terms: ['salario', 'pagamento', 'ordenado'] }, { name: 'Freelance', terms: ['freela', 'freelance', 'job', 'servico'] }]
    : [
        { name: 'Assinaturas', terms: ['netflix', 'spotify', 'youtube premium', 'prime video', 'icloud', 'google one', 'assinatura', 'streaming'] },
        { name: 'Saúde', terms: ['farmacia', 'drogaria', 'remedio', 'medicamento', 'consulta', 'medico', 'dentista', 'hospital', 'exame', 'terapia', 'academia'] },
        { name: 'Alimentação', terms: ['mercado', 'supermercado', 'restaurante', 'lanche', 'almoco', 'jantar', 'padaria', 'ifood', 'delivery', 'comida', 'cafe'] },
        { name: 'Transporte', terms: ['uber', 'taxi', 'onibus', 'metro', 'gasolina', 'combustivel', 'estacionamento', 'pedagio'] },
        { name: 'Moradia', terms: ['aluguel', 'condominio', 'agua', 'energia', 'luz', 'gas', 'internet'] },
        { name: 'Lazer', terms: ['sinuca', 'cinema', 'bar', 'show', 'jogo', 'viagem', 'passeio'] },
        { name: 'Educação', terms: ['curso', 'faculdade', 'escola', 'livro', 'material escolar', 'mensalidade escolar'] },
      ]
  return groups.find((group) => group.terms.some((term) => text.includes(term)))?.name ?? null
}

function parseWrittenInteger(value: string) {
  const tokens = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+e\s+|\s+/).filter(Boolean)
  let total = 0
  let current = 0
  for (const token of tokens) {
    if (token === 'mil') {
      total += (current || 1) * 1000
      current = 0
      continue
    }
    const number = NUMBER_WORDS[token]
    if (number === undefined) return null
    if (number >= 100) current = current ? current + number : number
    else current += number
  }
  const result = total + current
  return Number.isFinite(result) && result > 0 ? result : null
}

function parseAmount(text: string) {
  const numericMatch = text.match(AMOUNT_PATTERN)
  if (numericMatch) {
    const raw = numericMatch[1]
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
    const amount = Number(normalized)
    if (Number.isFinite(amount) && amount > 0) return { amount, raw: numericMatch[0] }
  }
  const normalizedText = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const writtenMatch = normalizedText.match(WRITTEN_AMOUNT_PATTERN)
  if (!writtenMatch) return null
  const integer = parseWrittenInteger(writtenMatch[1])
  if (!integer) return null
  const cents = writtenMatch[2] ? parseWrittenInteger(writtenMatch[2]) : 0
  if (cents === null || cents > 99) return null
  return { amount: integer + (cents / 100), raw: writtenMatch[0] }
}

export function parseFinanceIntent(text: string, options?: { source?: 'text' | 'audio' }): FinanceIntent | null {
  console.info(`[WA DISPATCH] source=${options?.source ?? 'text'}`)
  const parsedAmount = parseAmount(text)
  if (!parsedAmount) return null
  const amount = parsedAmount.amount

  const isExpense = EXPENSE_PATTERN.test(text)
  const isIncome = INCOME_PATTERN.test(text)
  if (isExpense === isIncome) return null
  const actionMatch = text.match(isExpense ? EXPENSE_PATTERN : INCOME_PATTERN)
  const actionText = actionMatch?.index !== undefined ? text.slice(actionMatch.index) : text

  const cleaned = actionText
    .replace(new RegExp(parsedAmount.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
    .replace(EXPENSE_PATTERN, '')
    .replace(INCOME_PATTERN, '')
    .replace(/\b(kevo|kev[oô]|hoje|ontem|amanhã|amanha|eu)\b/gi, ' ')
    .replace(/\b(reais?|r\$)\b/gi, ' ')
    .replace(/^[\s,.-]*(?:no|na|em|de|do|da|com|por)\s+/i, ' ')
    .replace(/\b(?:de\s+)?(?:um|uma)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s&-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned || cleaned.length < 2) return null

  const type = isExpense ? 'expense' : 'income'
  const description = normalizeTransactionDescription(cleaned)
  const today = getBrazilCivilDate()
  const explicitDate = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  const transactionDate = /\bontem\b/i.test(text)
    ? shiftCivilDate(today, -1)
    : /\bamanh(?:ã|a)\b/i.test(text)
      ? shiftCivilDate(today, 1)
      : explicitDate
        ? `${explicitDate[3] ? (explicitDate[3].length === 2 ? `20${explicitDate[3]}` : explicitDate[3]) : today.slice(0, 4)}-${explicitDate[2].padStart(2, '0')}-${explicitDate[1].padStart(2, '0')}`
        : today

  return {
    type,
    amount: Number(amount.toFixed(2)),
    description: description.slice(0, 120),
    categoryCandidate: inferCategoryCandidate(description, type),
    transactionDate,
  }
}

export function formatIntent(intent: FinanceIntent) {
  const label = intent.type === 'expense' ? 'despesa' : 'receita'
  return `${label} de R$ ${intent.amount.toFixed(2).replace('.', ',')} em ${intent.description}`
}

