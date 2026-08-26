import { prisma } from './prisma'

// Compara uma data (dia) contra os períodos de Safra/Entressafra
// cadastrados em PeriodoRegimeSalarial (ver comentário no schema.prisma)
// e devolve o tipo do período em que ela cai — ou null se nenhum período
// cobre esse dia.
//
// Comparação é por DIA (zera horas/minutos/segundos dos dois lados), pra
// não depender de qual horário exato cada data carrega internamente.

export interface PeriodoRegimeSalarialSimples {
  tipo: 'SAFRA' | 'ENTRESSAFRA'
  dataInicio: Date
  dataFim: Date
}

function inicioDoDia(data: Date): number {
  const d = new Date(data)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function obterRegimeNaData(
  data: Date,
  periodos: PeriodoRegimeSalarialSimples[]
): 'SAFRA' | 'ENTRESSAFRA' | null {
  const alvo = inicioDoDia(data)
  for (const periodo of periodos) {
    if (alvo >= inicioDoDia(periodo.dataInicio) && alvo <= inicioDoDia(periodo.dataFim)) {
      return periodo.tipo
    }
  }
  return null
}

// Busca todos os períodos cadastrados (usado pelas rotas que precisam
// resolver o regime de uma ou mais datas). Sem cache — o volume de
// períodos cadastrados ao longo do tempo é pequeno (poucos por ano).
export async function buscarPeriodosRegimeSalarial(): Promise<PeriodoRegimeSalarialSimples[]> {
  const periodos = await prisma.periodoRegimeSalarial.findMany({
    orderBy: { dataInicio: 'asc' },
    select: { tipo: true, dataInicio: true, dataFim: true },
  })
  return periodos
}

// Mensagem de erro padrão usada nos endpoints que bloqueiam lançamento
// quando a data não cai em nenhum período cadastrado.
export function mensagemPeriodoNaoCadastrado(data: Date): string {
  const dataFormatada = data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  return `Nenhum período de Safra/Entressafra cadastrado para o dia ${dataFormatada}. Cadastre esse período em Configurações → Safra/Entressafra antes de continuar.`
}
