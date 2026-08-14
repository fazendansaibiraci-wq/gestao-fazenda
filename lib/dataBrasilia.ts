// Converte uma string de horario "local" vinda de um input datetime-local
// (ex: "2026-08-13T14:30", sem informacao de fuso) para o Date/instante UTC
// correspondente, interpretando-a como horario de Brasilia (UTC-3, sem
// horario de verao desde 2019).
//
// Por que isso e necessario: o navegador manda a hora que o usuario digitou
// e ve na tela, sem fuso. O servidor (Vercel) roda em UTC, entao um
// `new Date("2026-08-13T14:30")` direto no servidor seria interpretado como
// 14:30 UTC (= 11:30 em Brasilia), nao como 14:30 Brasilia - um erro de 3h.
// Esta funcao corrige isso adicionando o offset de Brasilia explicitamente
// antes de converter.
//
// Se a string ja vier com fuso explicito (termina em "Z" ou "+HH:mm"/"-HH:mm"),
// interpreta direto, sem forcar Brasilia por cima.
export function paraDataBrasilia(valor: string): Date {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(valor)) {
    return new Date(valor)
  }
  const comSegundos = valor.length === 16 ? valor + ':00' : valor
  return new Date(comSegundos + '-03:00')
}