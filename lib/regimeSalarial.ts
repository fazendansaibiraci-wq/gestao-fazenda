import { prisma } from './prisma'
import type { PeriodoRegimeSalarialSimples } from './regimeSalarialClient'

// Compara uma data (dia) contra os períodos de Safra/Entressafra
// cadastrados em PeriodoRegimeSalarial (ver comentário no schema.prisma)
// e devolve o tipo do período em que ela cai — ou null se nenhum período
// cobre esse dia.
//
// A função de comparação em si (obterRegimeNaData) mora em
// regimeSalarialClient.ts (sem import de prisma) pra poder ser reusada
// também no frontend — aqui só reexportamos, pra manter uma única
// implementação servindo servidor e cliente.
export type { PeriodoRegimeSalarialSimples }
export { obterRegimeNaData } from './regimeSalarialClient'

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
