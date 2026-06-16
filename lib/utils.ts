// Formatação de datas
export const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export const formatDateTime = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatTime = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Validação de email
export const validateEmail = (email: string) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

// Geração de ID único
export const generateId = () => {
  return Math.random().toString(36).substring(2, 11)
}

// Formatação de moeda
export const formatCurrency = (value: number, currency = 'BRL') => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
  }).format(value)
}

// Formatação de número
export const formatNumber = (value: number, decimals = 2) => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

// Cálculo de dias restantes
export const daysUntil = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const time = d.getTime() - today.getTime()
  return Math.ceil(time / (1000 * 3600 * 24))
}

// Status badge colors
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    ATIVO: 'bg-green-100 text-green-800',
    INATIVO: 'bg-gray-100 text-gray-800',
    PREPARACAO: 'bg-blue-100 text-blue-800',
    COLHEITA: 'bg-orange-100 text-orange-800',
    MANUTENCAO: 'bg-yellow-100 text-yellow-800',
    pendente: 'bg-gray-100 text-gray-800',
    em_progresso: 'bg-blue-100 text-blue-800',
    concluida: 'bg-green-100 text-green-800',
    PLANEJAMENTO: 'bg-purple-100 text-purple-800',
    PLANTIO: 'bg-green-100 text-green-800',
    DESENVOLVIMENTO: 'bg-blue-100 text-blue-800',
    FINALIZADA: 'bg-gray-100 text-gray-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

// Tradução de status
export const translateStatus = (status: string): string => {
  const translations: Record<string, string> = {
    ATIVO: 'Ativo',
    INATIVO: 'Inativo',
    PREPARACAO: 'Preparação',
    COLHEITA: 'Colheita',
    MANUTENCAO: 'Manutenção',
    pendente: 'Pendente',
    em_progresso: 'Em Progresso',
    concluida: 'Concluída',
    PLANEJAMENTO: 'Planejamento',
    PLANTIO: 'Plantio',
    DESENVOLVIMENTO: 'Desenvolvimento',
    FINALIZADA: 'Finalizada',
  }
  return translations[status] || status
}
