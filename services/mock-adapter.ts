import * as mock from '@/lib/mock-data'

export const { account, budgets, categories, goals, monthly, navGroups, timeline, transactions, upcoming, formatBRL } = mock
export type { Transaction } from '@/lib/mock-data'

export const mockFiles = [
  { id: 'f1', name: 'Recibo supermercado.pdf', type: 'Comprovante', size: '1,2 MB', date: '08 ago 2026', origin: 'WhatsApp', project: null },
  { id: 'f2', name: 'Nota fiscal notebook.pdf', type: 'Nota fiscal', size: '842 KB', date: '06 ago 2026', origin: 'Importação', project: 'Setup escritório' },
  { id: 'f3', name: 'Contrato apartamento.pdf', type: 'Documento', size: '2,4 MB', date: '01 ago 2026', origin: 'Dashboard', project: null },
  { id: 'f4', name: 'Recibo Uber 07-08.jpg', type: 'Recibo', size: '318 KB', date: '07 ago 2026', origin: 'WhatsApp', project: null },
]
export const mockProjects = [
  { id: 'p1', name: 'Setup escritório', description: 'Montar espaço de trabalho em casa', status: 'Em andamento', priority: 'Alta', owner: 'Marina S.', due: '28 ago 2026', progress: 68, budget: 12000, spent: 8160, tasks: 8 },
  { id: 'p2', name: 'Viagem para Lisboa', description: 'Planejamento financeiro da viagem', status: 'Planejamento', priority: 'Média', owner: 'Marina S.', due: '15 out 2026', progress: 34, budget: 18000, spent: 6120, tasks: 12 },
  { id: 'p3', name: 'Reserva de emergência', description: 'Construção da reserva de 6 meses', status: 'Ativo', priority: 'Alta', owner: 'Marina S.', due: '30 dez 2026', progress: 58, budget: 30000, spent: 17400, tasks: 5 },
]
export const mockEvents = [
  { id: 'e1', title: 'Conta de energia', type: 'Conta', date: '2026-08-10', time: '09:00', status: 'Pendente', color: 'primary' },
  { id: 'e2', title: 'Reunião de projeto', type: 'Projeto', date: '2026-08-12', time: '14:30', status: 'Agendado', color: 'blue' },
  { id: 'e3', title: 'Assinatura Netflix', type: 'Recorrência', date: '2026-08-15', time: '00:00', status: 'Próximo', color: 'muted' },
]
export const mockSheetRows = transactions.map((t, i) => ({ ...t, project: i % 2 ? 'Setup escritório' : '—' }))
export const mockAccount = { email: 'marina@exemplo.com', name: 'Marina Salles', phone: '+55 11 99876-4321', whatsappStatus: 'Não conectado / demonstrativo' }
