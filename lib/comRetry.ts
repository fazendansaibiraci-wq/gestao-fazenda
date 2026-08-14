// Reexecuta automaticamente uma operacao de banco quando o erro parece ser
// transitorio (conexao fria, timeout ao abrir conexao, servidor fechou a
// conexao) - comum em apps serverless conversando com Postgres tradicional.
// Erros de verdade (dado invalido, violacao de constraint, etc.) nao sao
// re-tentados: sobem imediatamente pra quem chamou.

const CODIGOS_TRANSITORIOS = ['P1001', 'P1002', 'P1008', 'P1017']
const TRECHOS_TRANSITORIOS = [
  "Can't reach database",
  'Timed out',
  'Connection terminated',
  'Connection reset',
  'ECONNREFUSED',
  'ETIMEDOUT',
]

function ehErroTransitorio(erro: unknown): boolean {
  const codigo = (erro as { code?: string })?.code || ''
  const mensagem = erro instanceof Error ? erro.message : String(erro)
  return CODIGOS_TRANSITORIOS.includes(codigo) || TRECHOS_TRANSITORIOS.some((t) => mensagem.includes(t))
}

export async function comRetry<T>(operacao: () => Promise<T>, tentativas = 3, esperaBaseMs = 400): Promise<T> {
  let ultimoErro: unknown
  for (let i = 0; i < tentativas; i++) {
    try {
      return await operacao()
    } catch (erro) {
      ultimoErro = erro
      if (!ehErroTransitorio(erro) || i === tentativas - 1) throw erro
      await new Promise((resolve) => setTimeout(resolve, esperaBaseMs * (i + 1)))
    }
  }
  throw ultimoErro
}