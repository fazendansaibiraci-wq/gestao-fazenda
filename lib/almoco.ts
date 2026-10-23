import { calcularHorasBrutas } from './calculoHorasBrutas'

// Almoço da fazenda: sempre das 11:00 às 12:00.
//
// Regra (a partir de 01/10/2026): cada lançamento desconta só o tempo que
// cai DENTRO do horário de almoço. Lançamento que não toca 11h–12h não
// desconta nada (meio período, lançamentos picados com intervalo); dia
// cheio 07–17 desconta 1h; 07:00–11:30 desconta 30min. "Passou direto no
// almoço" marcado = não desconta (trabalhou no almoço, vira extra).
//
// Antes de 01/10/2026 vale a regra antiga (desconto fixo de 1h por
// lançamento, salvo "passou direto"), pra não mexer em mês já pago.
export const ALMOCO_INICIO = '11:00'
export const ALMOCO_FIM = '12:00'
export const REGRA_ALMOCO_FIXO_DESDE = '2026-10-01'

const INICIO_MIN = 11 * 60
const FIM_MIN = 12 * 60

const paraMinutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

const chaveDia = (data: Date | string) =>
  typeof data === 'string' ? data.slice(0, 10) : data.toISOString().slice(0, 10)

export function usaRegraAlmocoFixo(data: Date | string): boolean {
  return chaveDia(data) >= REGRA_ALMOCO_FIXO_DESDE
}

// Horas do lançamento que caem dentro do almoço (11h–12h). Considera turno
// que atravessa a meia-noite.
export function horasDentroDoAlmoco(horaEntrada: string, horaSaida: string): number {
  const entrada = paraMinutos(horaEntrada)
  let saida = paraMinutos(horaSaida)
  if (saida <= entrada) saida += 1440
  let minutos = 0
  for (const base of [0, 1440]) {
    const ini = Math.max(entrada, INICIO_MIN + base)
    const fim = Math.min(saida, FIM_MIN + base)
    if (fim > ini) minutos += fim - ini
  }
  return minutos / 60
}

// Quanto descontar de almoço neste lançamento (em horas).
export function descontoAlmocoHoras(p: {
  data: Date | string
  horaEntrada: string
  horaSaida: string
  passouDiretoAlmoco?: boolean | null
}): number {
  if (p.passouDiretoAlmoco) return 0
  if (!usaRegraAlmocoFixo(p.data)) return 1
  return horasDentroDoAlmoco(p.horaEntrada, p.horaSaida)
}

// Horas trabalhadas do lançamento (bruto − almoço).
export function horasLiquidasLancamento(p: {
  data: Date | string
  horaEntrada: string
  horaSaida: string
  passouDiretoAlmoco?: boolean | null
}): number {
  const bruto = calcularHorasBrutas(p.horaEntrada, p.horaSaida)
  return Math.max(0, bruto - descontoAlmocoHoras(p))
}
