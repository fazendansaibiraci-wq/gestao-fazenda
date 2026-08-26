import { prisma } from './prisma'

// Resolve salário/hora extra/jornada de um funcionário numa data
// específica, via o novo model SalarioPeriodo (cadastrado em Funcionários
// → Salário Safra/Entressafra) — substitui os antigos campos fixos
// User.salarioSafra/salarioEntressafra/valorHoraExtraSafra/
// valorHoraExtraEntressafra/tipoSalario/cargaHorariaSegSex/Sabado/
// Domingo/domingosPorMes e os campos globais ConfiguracaoGlobal.
// cargaHorariaEntressafraSegQui/Sexta/Sabado/Domingo (todos ainda
// existem no schema pra não perder histórico, mas não são mais lidos por
// nenhum cálculo).

export interface PeriodoComId {
  id: string
  tipo: 'SAFRA' | 'ENTRESSAFRA'
  dataInicio: Date
  dataFim: Date
}

export interface DadosSalarioPeriodo {
  tipoSalario: 'MENSAL' | 'DIARIO' | null
  salarioMensal: number | null
  salarioDiaria: number | null
  valorHoraExtra: number | null
  cargaHorariaSegSex: number | null
  cargaHorariaSegQui: number | null
  cargaHorariaSexta: number | null
  cargaHorariaSabado: number | null
  cargaHorariaDomingo: number | null
  domingosTrabalhadosPorMes: number | null
}

function inicioDoDia(data: Date): number {
  const d = new Date(data)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Busca todos os períodos cadastrados, com id (necessário pra achar o
// SalarioPeriodo certo — diferente de lib/regimeSalarial.ts, que só
// precisa do tipo).
export async function buscarPeriodosComId(): Promise<PeriodoComId[]> {
  return prisma.periodoRegimeSalarial.findMany({ orderBy: { dataInicio: 'asc' } })
}

// Acha o período (com id) que cobre uma data específica, ou null se
// nenhum período cadastrado cobre esse dia.
export function obterPeriodoNaData(data: Date, periodos: PeriodoComId[]): PeriodoComId | null {
  const alvo = inicioDoDia(data)
  for (const periodo of periodos) {
    if (alvo >= inicioDoDia(periodo.dataInicio) && alvo <= inicioDoDia(periodo.dataFim)) {
      return periodo
    }
  }
  return null
}

// Busca TODOS os SalarioPeriodo cadastrados (de todo mundo, todo período)
// de uma vez — evita N+1 quando é preciso resolver vários
// funcionários/dias juntos (ex: resumo mensal do mês inteiro). Chave do
// Map: `${funcionarioId}:${periodoRegimeSalarialId}`.
export async function buscarTodosSalariosPeriodo(): Promise<Map<string, DadosSalarioPeriodo>> {
  const registros = await prisma.salarioPeriodo.findMany()
  const mapa = new Map<string, DadosSalarioPeriodo>()
  for (const r of registros) {
    mapa.set(`${r.funcionarioId}:${r.periodoRegimeSalarialId}`, r)
  }
  return mapa
}

// Busca o SalarioPeriodo de UM funcionário num período específico.
export async function buscarSalarioPeriodoFuncionario(
  funcionarioId: string,
  periodoRegimeSalarialId: string
): Promise<DadosSalarioPeriodo | null> {
  return prisma.salarioPeriodo.findUnique({
    where: { funcionarioId_periodoRegimeSalarialId: { funcionarioId, periodoRegimeSalarialId } },
  })
}

// Mensagem de erro padrão usada nos endpoints que bloqueiam lançamento
// quando falta salário/jornada cadastrado pro funcionário naquele
// período.
export function mensagemSalarioNaoCadastrado(nomeFuncionario: string, data: Date): string {
  const dataFormatada = data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  return `${nomeFuncionario} não tem salário/jornada cadastrado para o período que cobre ${dataFormatada}. Cadastre em Funcionários → Salário Safra/Entressafra antes de continuar.`
}

// Monta os objetos "funcionario"/"config" no formato que
// lib/calculoCargaHoraria.ts espera, a partir dos dados já resolvidos de
// SalarioPeriodo — assim a lógica de cálculo em si (jornada individual
// na Safra, jornada fixa por dia da semana na Entressafra, ambiguidade
// de domingo) continua exatamente a mesma de sempre, só a ORIGEM dos
// números muda (SalarioPeriodo em vez de User/ConfiguracaoGlobal).
export function shimsParaCargaHoraria(dados: DadosSalarioPeriodo) {
  const funcionarioShim = {
    cargaHorariaSegSex: dados.cargaHorariaSegSex,
    cargaHorariaSabado: dados.cargaHorariaSabado,
    cargaHorariaDomingo: dados.cargaHorariaDomingo,
    domingosPorMes: dados.domingosTrabalhadosPorMes,
  }
  const configShim = {
    cargaHorariaEntressafraSegQui: dados.cargaHorariaSegQui,
    cargaHorariaEntressafraSexta: dados.cargaHorariaSexta,
    cargaHorariaEntressafraSabado: dados.cargaHorariaSabado,
    cargaHorariaEntressafraDomingo: dados.cargaHorariaDomingo,
  }
  return { funcionarioShim, configShim }
}
