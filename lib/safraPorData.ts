// Safra agronômica (cadastro de Safras) que vale numa data: início ≤ data ≤
// fim (fim vazio = ainda aberta). Se mais de uma cobrir a data (ex: o dia
// de virada em que uma termina e a outra começa), fica a que começou por
// último — a safra nova.
export interface SafraComDatas {
  id: string
  dataInicio: Date | string
  dataFim: Date | string | null
}

const dia = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString()).slice(0, 10)

export function safraDaData<T extends SafraComDatas>(safras: T[], data: Date | string): T | null {
  const alvo = dia(data)
  const cobre = safras.filter((s) => dia(s.dataInicio) <= alvo && (!s.dataFim || alvo <= dia(s.dataFim)))
  if (cobre.length === 0) return null
  return cobre.sort((a, b) => (dia(a.dataInicio) < dia(b.dataInicio) ? 1 : -1))[0]
}
