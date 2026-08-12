export const navGroups = [
  { label: '', items: [{ label: 'Visão Geral', icon: 'layout', href: 'overview' }] },
  { label: 'FINANÇAS', items: ['Movimentações', 'Categorias', 'Orçamentos', 'Metas', 'Contas', 'Relatórios'].map((label) => ({ label, icon: label.toLowerCase(), href: label.toLowerCase() })) },
  { label: 'ORGANIZAÇÃO', items: ['Agenda', 'Projetos', 'Drive'].map((label) => ({ label, icon: label.toLowerCase(), href: label.toLowerCase() })) },
  { label: 'INTELIGÊNCIA', items: [{ label: 'KEVO Insights', icon: 'sparkles', href: 'insights' }, { label: 'Timeline', icon: 'timeline', href: 'timeline' }] },
  { label: 'DADOS', items: ['Planilhas', 'Importar', 'Exportar'].map((label) => ({ label, icon: label.toLowerCase(), href: label.toLowerCase() })) },
  { label: 'CONTA', items: ['Plano', 'Integrações', 'Configurações'].map((label) => ({ label, icon: label.toLowerCase(), href: label.toLowerCase() })) },
] as const
