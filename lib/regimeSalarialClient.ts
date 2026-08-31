// VersÃ£o client-safe (sem import de prisma) da comparaÃ§Ã£o de data x
// perÃ­odo de Safra/Entressafra. Existe separada de lib/regimeSalarial.ts
// pra poder ser importada em componentes 'use client' (ex:
// RegistroAtividadeForm) sem puxar o prisma client pro bundle do
// navegador. lib/regimeSalarial.ts (uso server-side) reexporta os mesmos
// tipo/funÃ§Ã£o a partir daqui, pra nÃ£o duplicar a lÃ³gica de comparaÃ§Ã£o.

export interface PeriodoRegimeSalarialSimples {
  tipo: 'SAFRA' | 'ENTRESSAFRA'
  dataInicio: Date | string
  dataFim: Date | string
}

function inicioDoDia(data: Date | string): number {
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
