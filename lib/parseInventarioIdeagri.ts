// Parser do PDF de "Inventário" exportado do Ideagri. Cada linha de
// produto segue o padrão:
//   Número Nome[podem ser várias palavras] Local Quantidade EstoqueMinimo Unidade ValorMedio ValorTotal
// O mesmo produto aparece em várias linhas (uma por Local) — este parser
// já consolida tudo num total por nome de produto.

const LOCAIS_CONHECIDOS = ['CASA CAFÉ', 'BOLSA', 'FAZ', 'COC', 'COO', 'CI', 'OV']

// Regex de uma linha de produto: número no início, depois um bloco de
// texto livre (nome + local, ainda misturados), depois 5 campos finais
// no padrão número/número/palavra/número/número (quantidade, estoque
// mínimo, unidade, valor médio, valor total). O "(.+?)" não-guloso deixa
// o motor de regex empurrar pra frente até esses 5 campos finais baterem,
// o que naturalmente separa nome+local (que pode conter números com
// ponto, tipo "19.04.19") dos campos numéricos de verdade.
const LINHA_PRODUTO_REGEX =
  /^(\d+)\s+(.+?)\s+([-\d.,]+)\s+([-\d.,]+)\s+([A-Za-zÀ-ÿ]+)\s+([-\d.,]+)\s+([-\d.,]+)\s*$/

function parseNumeroBR(str: string): number {
  const limpo = str.trim().replace(/\./g, '').replace(',', '.')
  const val = parseFloat(limpo)
  return isNaN(val) ? 0 : val
}

interface LinhaParseada {
  numero: string
  nome: string
  local: string
  quantidade: number
  estoqueMinimo: number
  unidade: string
  valorMedio: number
  valorTotal: number
}

export interface ProdutoConsolidado {
  nome: string
  quantidadeTotal: number
  estoqueMinimoTotal: number
  unidade: string
  valorUnitarioMedio: number
  locais: string[]
}

export interface ResultadoParseInventario {
  produtos: ProdutoConsolidado[]
  linhasNaoReconhecidas: string[]
}

function separarNomeELocal(nomeELocal: string): { nome: string; local: string } {
  const ordenados = [...LOCAIS_CONHECIDOS].sort((a, b) => b.length - a.length)
  for (const local of ordenados) {
    if (nomeELocal.toUpperCase().endsWith(local)) {
      const nome = nomeELocal.slice(0, nomeELocal.length - local.length).trim()
      if (nome.length > 0) {
        return { nome, local }
      }
    }
  }
  return { nome: nomeELocal.trim(), local: '' }
}

export function parseInventarioIdeagri(textoExtraido: string): ResultadoParseInventario {
  const linhas = textoExtraido.split('\n').map((l) => l.trim()).filter(Boolean)
  const linhasParseadas: LinhaParseada[] = []
  const linhasNaoReconhecidas: string[] = []

  for (const linha of linhas) {
    if (!/^\d+\s/.test(linha)) continue

    const match = linha.match(LINHA_PRODUTO_REGEX)
    if (!match) {
      linhasNaoReconhecidas.push(linha)
      continue
    }

    const [, numero, nomeELocalBruto, quantidadeStr, estoqueMinimoStr, unidade, valorMedioStr, valorTotalStr] = match
    const { nome, local } = separarNomeELocal(nomeELocalBruto)

    if (!local) {
      linhasNaoReconhecidas.push(linha)
      continue
    }

    linhasParseadas.push({
      numero,
      nome,
      local,
      quantidade: parseNumeroBR(quantidadeStr),
      estoqueMinimo: parseNumeroBR(estoqueMinimoStr),
      unidade,
      valorMedio: parseNumeroBR(valorMedioStr),
      valorTotal: parseNumeroBR(valorTotalStr),
    })
  }

  const grupos = new Map<string, LinhaParseada[]>()
  for (const linha of linhasParseadas) {
    const chave = linha.nome.toUpperCase()
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(linha)
  }

  const produtos: ProdutoConsolidado[] = Array.from(grupos.values()).map((linhas) => {
    const quantidadeTotal = linhas.reduce((acc, l) => acc + l.quantidade, 0)
    const estoqueMinimoTotal = linhas.reduce((acc, l) => acc + l.estoqueMinimo, 0)
    const valorTotalSoma = linhas.reduce((acc, l) => acc + l.valorTotal, 0)
    const valorUnitarioMedio = quantidadeTotal !== 0 ? valorTotalSoma / quantidadeTotal : 0

    return {
      nome: linhas[0].nome,
      quantidadeTotal,
      estoqueMinimoTotal,
      unidade: linhas[0].unidade,
      valorUnitarioMedio,
      locais: Array.from(new Set(linhas.map((l) => l.local))),
    }
  })

  return { produtos, linhasNaoReconhecidas }
}
