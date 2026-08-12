export const account = { id: 'acc-kevo-demo', name: 'Conta pessoal', email: 'marina@exemplo.com', whatsapp: '+55 11 98888-4421' }

export const transactions = [
  { id: 't1', date: 'Hoje, 12:18', description: 'Restaurante Manjericão', amount: -47, category: 'Alimentação', subcategory: 'Restaurante', method: 'Cartão de crédito', source: 'WhatsApp', status: 'Confirmada' },
  { id: 't2', date: 'Hoje, 09:42', description: 'Uber Viagem', amount: -32.9, category: 'Transporte', subcategory: 'Uber', method: 'Pix', source: 'Dashboard', status: 'Confirmada' },
  { id: 't3', date: 'Ontem, 18:05', description: 'Salário • Agosto', amount: 8400, category: 'Receitas', subcategory: 'Salário', method: 'Transferência', source: 'Importação', status: 'Confirmada' },
  { id: 't4', date: 'Ontem, 16:30', description: 'Mercado Pão de Açúcar', amount: -286.4, category: 'Alimentação', subcategory: 'Mercado', method: 'Cartão de débito', source: 'WhatsApp', status: 'Confirmada' },
  { id: 't5', date: '05 ago, 10:12', description: 'Netflix', amount: -55.9, category: 'Lazer', subcategory: 'Assinaturas', method: 'Cartão de crédito', source: 'Recorrente', status: 'Confirmada' },
  { id: 't6', date: '04 ago, 08:00', description: 'Aluguel • Agosto', amount: -2450, category: 'Moradia', subcategory: 'Aluguel', method: 'Pix', source: 'Recorrente', status: 'Confirmada' },
]

export const monthly = [
  { month: 'Mar', receitas: 7200, despesas: 4980 }, { month: 'Abr', receitas: 7600, despesas: 5320 }, { month: 'Mai', receitas: 8400, despesas: 6110 }, { month: 'Jun', receitas: 8400, despesas: 5780 }, { month: 'Jul', receitas: 8400, despesas: 5360 }, { month: 'Ago', receitas: 8400, despesas: 4270 },
]

export const categories = [
  { name: 'Moradia', amount: 2780, percent: 42, color: 'var(--chart-1)', subs: ['Aluguel', 'Energia', 'Internet'] },
  { name: 'Alimentação', amount: 1420, percent: 22, color: 'var(--chart-2)', subs: ['Mercado', 'Restaurante', 'Delivery'] },
  { name: 'Transporte', amount: 690, percent: 11, color: 'var(--chart-3)', subs: ['Uber', 'Combustível', 'Manutenção'] },
  { name: 'Lazer', amount: 470, percent: 7, color: 'var(--chart-4)', subs: ['Assinaturas', 'Cinema', 'Viagens'] },
]

export const budgets = [
  { name: 'Alimentação', spent: 1420, limit: 1800, percent: 79, tone: 'attention' },
  { name: 'Transporte', spent: 690, limit: 900, percent: 77, tone: 'attention' },
  { name: 'Lazer', spent: 470, limit: 600, percent: 78, tone: 'attention' },
  { name: 'Moradia', spent: 2780, limit: 3000, percent: 93, tone: 'danger' },
]

export const goals = [
  { name: 'Reserva de emergência', current: 5800, target: 10000, percent: 58, due: 'Dez 2026', monthly: 700 },
  { name: 'Viagem de fim de ano', current: 2240, target: 5000, percent: 45, due: 'Nov 2026', monthly: 460 },
]

export const timeline = [
  { time: '09:42', text: 'R$ 32,90 registrado em Transporte', type: 'Movimentação', icon: 'arrow' },
  { time: '12:18', text: 'R$ 47,00 registrado em Alimentação', type: 'Movimentação', icon: 'arrow' },
  { time: '15:30', text: 'KEVO identificou aumento nos gastos com delivery', type: 'Insight', icon: 'spark' },
  { time: '18:00', text: 'Conta de energia vence em 2 dias', type: 'Lembrete', icon: 'calendar' },
  { time: '21:15', text: 'Meta Reserva de Emergência atingiu 58%', type: 'Meta', icon: 'target' },
]

export const upcoming = [
  { name: 'Conta de energia', date: '10 ago', amount: 186.4, status: 'Vence em 2 dias' },
  { name: 'Internet fibra', date: '12 ago', amount: 119.9, status: 'Próxima' },
  { name: 'Netflix', date: '15 ago', amount: 55.9, status: 'Recorrente' },
] as const

export const navGroups = [
  { label: '', items: [{ label: 'Visão Geral', icon: 'layout', href: 'overview' }] },
  { label: 'FINANÇAS', items: ['Movimentações', 'Categorias', 'Orçamentos', 'Metas', 'Contas', 'Relatórios'].map(label => ({ label, icon: label.toLowerCase(), href: label.toLowerCase() })) },
  { label: 'ORGANIZAÇÃO', items: ['Agenda', 'Projetos', 'Drive'].map(label => ({ label, icon: label.toLowerCase(), href: label.toLowerCase() })) },
  { label: 'INTELIGÊNCIA', items: [{ label: 'KEVO Insights', icon: 'sparkles', href: 'insights' }, { label: 'Timeline', icon: 'timeline', href: 'timeline' }] },
  { label: 'DADOS', items: ['Planilhas', 'Importar', 'Exportar'].map(label => ({ label, icon: label.toLowerCase(), href: label.toLowerCase() })) },
  { label: 'CONTA', items: ['Plano', 'Integrações', 'Configurações'].map(label => ({ label, icon: label.toLowerCase(), href: label.toLowerCase() })) },
]

export const formatBRL = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(value))
export const formatSignedBRL = (value: number) => `${value >= 0 ? '+' : '−'} ${formatBRL(value)}`
export const sleep = (ms = 180) => new Promise(resolve => setTimeout(resolve, ms))

export type Transaction = (typeof transactions)[number]
export type ServiceResult<T> = { data: T; status: 'success' | 'loading' | 'error' }
export type AiActionStatus = 'suggested' | 'confirmed' | 'executed' | 'failed'

export const domainModel = {
  users: ['id', 'email'], accounts: ['id', 'account_id'], memberships: ['account_id', 'user_id'],
  whatsapp_identities: ['account_id', 'user_id', 'phone_number', 'wa_id', 'verified_at', 'last_seen_at', 'status'],
  transactions: ['account_id', 'source', 'source_message_id', 'created_by', 'confidence', 'metadata', 'currency', 'occurred_at'],
  files: ['account_id', 'storage_path', 'original_name', 'mime_type', 'size', 'uploaded_by', 'project_id', 'transaction_id', 'calendar_event_id'],
  projects: ['account_id', 'status', 'priority', 'owner_id'], calendar_events: ['account_id', 'reminder_at', 'recurrence_rule', 'source'],
  ai_actions: ['account_id', 'status: suggested|confirmed|executed|failed'],
}
