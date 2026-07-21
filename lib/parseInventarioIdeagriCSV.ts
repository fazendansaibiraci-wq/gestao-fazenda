// Parser do CSV de "Inventário" exportado do Ideagri. Formato:
// Categoria;Número;Nome;Quantidade;Estoque mínimo;Unidade;Valor médio
// unitário;Valor total;LOCALARMAZENAMENTO; (separado por ; , última
// coluna vazia). O mesmo produto aparece em várias linhas (uma por
// local) — consolidado aqui num total por nome de produto.

function parseNumeroBR(str: string): number {
  const limpo = (str || '').trim().replace(/\./g, '').replace(',', '.')
  const val = parseFloat(limpo)
  return isNaN(val) ? 0 : val
}

// Mapeia a categoria do Ideagri (texto livre, às vezes com
// subcategoria tipo "Produtos agronômicos - Adubos") pra uma das
// categorias que o sistema usa. Ordem importa: checa os termos mais
// específicos primeiro.
function mapearCategoria(categoriaIdeagri: string): string {
  const c = (categoriaIdeagri || '').toLowerCase()
  if (c.includes('adubo')) return 'fertilizante'
  if (c.includes('herbicida')) return 'herbicida'
  if (c.includes('fungicida')) return 'fungicida'
  if (c.includes('inseticida') || c.includes('acaricida')) return 'inseticida'
  if (c.includes('adjuvante')) return 'adjuvante'
  return 'outro'
}

interface LinhaCSV {
  categoria: string
  nome: string
  local: string
  quantidade: number
  estoqueMinimo: number
  unidade: string
  valorTotal: number
}

export interface ProdutoConsolidadoCSV {
  nome: string
  categoriaSugerida: string
  quantidadeTotal: number
  estoqueMinimoTotal: number
  unidade: string
  valorUnitarioMedio: number
  locais: string[]
}

export interface ResultadoParseCSV {
  produtos: ProdutoConsolidadoCSV[]
  linhasComProblema: string[]
}

export function parseInventarioIdeagriCSV(csvTexto: string): ResultadoParseCSV {
  const linhas = csvTexto
    .split(/\r\n|\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const linhasParseadas: LinhaCSV[] = []
  const linhasComProblema: string[] = []

  linhas.forEach((linha, index) => {
    // Pula a linha de cabeçalho (primeira linha, ou qualquer linha cuja
    // primeira célula seja literalmente "Categoria").
    if (index === 0 || linha.startsWith('Categoria;')) return

    const campos = linha.split(';')
    if (campos.length < 9) {
      linhasComProblema.push(linha)
      return
    }

    const [categoria, , nome, quantidadeStr, estoqueMinimoStr, unidade, , valorTotalStr, local] = campos

    if (!nome?.trim() || !local?.trim()) {
      linhasComProblema.push(linha)
      return
    }

    linhasParseadas.push({
      categoria: categoria?.trim() || '',
      nome: nome.trim(),
      local: local.trim(),
      quantidade: parseNumeroBR(quantidadeStr),
      estoqueMinimo: parseNumeroBR(estoqueMinimoStr),
      unidade: unidade?.trim() || '',
      valorTotal: parseNumeroBR(valorTotalStr),
    })
  })

  const grupos = new Map<string, LinhaCSV[]>()
  for (const linha of linhasParseadas) {
    const chave = linha.nome.toUpperCase()
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(linha)
  }

  const produtos: ProdutoConsolidadoCSV[] = Array.from(grupos.values()).map((linhasDoProduto) => {
    const quantidadeTotal = linhasDoProduto.reduce((acc, l) => acc + l.quantidade, 0)
    const estoqueMinimoTotal = linhasDoProduto.reduce((acc, l) => acc + l.estoqueMinimo, 0)
    const valorTotalSoma = linhasDoProduto.reduce((acc, l) => acc + l.valorTotal, 0)
    const valorUnitarioMedio = quantidadeTotal !== 0 ? valorTotalSoma / quantidadeTotal : 0

    return {
      nome: linhasDoProduto[0].nome,
      categoriaSugerida: mapearCategoria(linhasDoProduto[0].categoria),
      quantidadeTotal,
      estoqueMinimoTotal,
      unidade: linhasDoProduto[0].unidade,
      valorUnitarioMedio,
      locais: Array.from(new Set(linhasDoProduto.map((l) => l.local))),
    }
  })

  return { produtos, linhasComProblema }
}
