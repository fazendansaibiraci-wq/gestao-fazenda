/**
 * Calcula as horas brutas entre um horário de entrada e um de saída (strings
 * "HH:MM"), sem nenhum desconto de almoço. Se a saída for menor ou igual à
 * entrada, assume que o turno atravessou a meia-noite.
 */
export function calcularHorasBrutas(horaEntrada: string, horaSaida: string): number {
  const [hE, mE] = horaEntrada.split(':').map(Number)
  const [hS, mS] = horaSaida.split(':').map(Number)
  const entrada = hE * 60 + mE
  let saida = hS * 60 + mS
  if (saida <= entrada) {
    saida += 1440 // turno atravessou a meia-noite
  }
  return (saida - entrada) / 60
}
