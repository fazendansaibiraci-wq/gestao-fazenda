import { calcularHorasBrutas } from './calculoHorasBrutas'

interface RegistroParaCalculo {
  id: string
  data: Date | string
  horaEntrada: string
  horaSaida: string | null
  horasCalculadas: number | null
  horasprevistasdia: number | null
  isFalta: boolean
}

function chaveDataDoRegistro(data: Date | string): string {
  if (typeof data === 'string') return data.split('T')[0]
  return data.toISOString().split('T')[0]
}

/**
 * Calcula os totais de horas trabalhadas/extras/devidas de um funcionário a
 * partir de uma lista de registros de atividade (tipicamente já filtrada
 * para um único funcionário e um período). Agrupa os registros não-falta por
 * dia (chave de data) para evitar desconto/extra duplicado quando há mais de
 * um registro (ex: dois turnos) no mesmo dia.
 *
 * `cargaFallback` é usado quando um registro não tem `horasprevistasdia`
 * definido (ex: registros antigos).
 */
export function calcularTotaisHoras(
  registros: RegistroParaCalculo[],
  cargaFallback: number = 8
) {
  let totalHorasTrabalhadas = 0
  let totalHorasExtras = 0
  let totalHorasDevidas = 0
  let diasTrabalhados = 0

  // Agrupar registros não-falta por data (chave de dia, já que a hora é
  // sempre fixada ao meio-dia) para evitar desconto/extra duplicado quando
  // o funcionário tem mais de um registro (ex: dois turnos) no mesmo dia.
  const gruposPorData = new Map<string, RegistroParaCalculo[]>()
  for (const reg of registros) {
    if (reg.isFalta) continue
    const chaveData = chaveDataDoRegistro(reg.data)
    if (!gruposPorData.has(chaveData)) gruposPorData.set(chaveData, [])
    gruposPorData.get(chaveData)!.push(reg)
  }

  const agregadosPorData = new Map<string, {
    somaHorasDia: number
    cargaDia: number
    horasExtrasDia: number
    horasDevidasDia: number
    ultimoRegistroId: string
  }>()

  for (const [chaveData, regsDoDia] of gruposPorData) {
    // Com um único registro no dia, horasCalculadas já reflete corretamente
    // o desconto de almoço (ou a regra de passouDiretoAlmoco) daquele turno.
    let somaHorasDia: number
    if (regsDoDia.length === 1) {
      somaHorasDia = regsDoDia[0].horasCalculadas || 0
    } else {
      // Com múltiplos registros (turnos no mesmo dia), somamos as horas
      // BRUTAS de cada turno, sem o desconto de almoço já aplicado
      // individualmente em cada registro.
      const somaBruta = regsDoDia.reduce((acc, r) => {
        if (!r.horaSaida) return acc + (r.horasCalculadas || 0)
        return acc + calcularHorasBrutas(r.horaEntrada, r.horaSaida)
      }, 0)

      // Intervalo total entre turnos consecutivos (ordenados por
      // horaEntrada). Turnos colados ou sobrepostos (sem intervalo real)
      // contam 0 para aquele par.
      const regsOrdenadosPorEntrada = [...regsDoDia].sort((a, b) => a.horaEntrada.localeCompare(b.horaEntrada))
      let intervaloTotalDia = 0
      for (let i = 1; i < regsOrdenadosPorEntrada.length; i++) {
        const anterior = regsOrdenadosPorEntrada[i - 1]
        const atual = regsOrdenadosPorEntrada[i]
        if (!anterior.horaSaida) continue
        const [hSaidaAnt, mSaidaAnt] = anterior.horaSaida.split(':').map(Number)
        const [hEntradaAtual, mEntradaAtual] = atual.horaEntrada.split(':').map(Number)
        const minutosSaidaAnt = hSaidaAnt * 60 + mSaidaAnt
        const minutosEntradaAtual = hEntradaAtual * 60 + mEntradaAtual
        intervaloTotalDia += Math.max(0, minutosEntradaAtual - minutosSaidaAnt) / 60
      }

      // Um intervalo real (>= 1h) somado entre os turnos já cobre o
      // almoço, então não desconta nada a mais. Turnos colados (sem
      // intervalo, ou com menos de 1h somado) descontam 1h cheia, uma
      // única vez no dia.
      const descontoAlmocoDia = intervaloTotalDia >= 1 ? 0 : 1
      somaHorasDia = Math.max(0, somaBruta - descontoAlmocoDia)
    }
    const cargaDia = regsDoDia[0].horasprevistasdia ?? cargaFallback
    const horasExtrasDia = somaHorasDia > cargaDia ? somaHorasDia - cargaDia : 0
    const horasDevidasDia = somaHorasDia < cargaDia ? cargaDia - somaHorasDia : 0

    // O último registro do dia (por horaEntrada, com id como desempate) é
    // quem exibe o resultado líquido combinado (horasExtras/horasDevidas).
    const regsOrdenados = [...regsDoDia].sort((a, b) => {
      const cmpHora = a.horaEntrada.localeCompare(b.horaEntrada)
      return cmpHora !== 0 ? cmpHora : a.id.localeCompare(b.id)
    })
    const ultimoRegistroId = regsOrdenados[regsOrdenados.length - 1].id

    agregadosPorData.set(chaveData, { somaHorasDia, cargaDia, horasExtrasDia, horasDevidasDia, ultimoRegistroId })

    diasTrabalhados++
    totalHorasTrabalhadas += somaHorasDia
    totalHorasExtras += horasExtrasDia
    totalHorasDevidas += horasDevidasDia
  }

  return { totalHorasExtras, totalHorasDevidas, totalHorasTrabalhadas, diasTrabalhados, agregadosPorData }
}
