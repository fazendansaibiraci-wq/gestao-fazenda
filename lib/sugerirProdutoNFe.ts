// Sugere o produto do estoque para um item de NF-e quando o nome na nota
// vem diferente do cadastro (ex.: "LI 700 BB 20L" → "LI 700";
// "OLEO DIESEL B S10 COMUM" → "DIESEL S10").

// Maiúsculas, sem acento, só letras/números separados por espaço.
export function normalizarNome(nome: string): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

interface ProdutoBase {
  id: string
  nomeComercial: string
}

// Um produto do cadastro é candidato quando TODAS as palavras do nome dele
// aparecem no nome da nota. Entre os candidatos, vence o de nome mais
// comprido (mais específico). Empate = não sugere (melhor perguntar).
export function sugerirProduto<T extends ProdutoBase>(nomeNF: string, produtos: T[]): T | null {
  const palavrasNF = new Set(normalizarNome(nomeNF).split(' ').filter(Boolean))
  if (palavrasNF.size === 0) return null

  let melhor: T | null = null
  let melhorTamanho = 0
  let empate = false

  for (const p of produtos) {
    const nome = normalizarNome(p.nomeComercial)
    const palavras = nome.split(' ').filter(Boolean)
    if (palavras.length === 0) continue
    // Nome de uma palavra só e curta (ex.: "UREIA" vs. "21.00.21 UREIA") é
    // fraco demais sozinho: exige pelo menos 3 letras.
    if (palavras.length === 1 && palavras[0].length < 3) continue
    if (!palavras.every((w) => palavrasNF.has(w))) continue

    const tamanho = nome.length
    if (tamanho > melhorTamanho) {
      melhor = p
      melhorTamanho = tamanho
      empate = false
    } else if (tamanho === melhorTamanho) {
      empate = true
    }
  }

  if (melhor && !empate) return melhor

  // Diesel: se a nota fala em diesel e só existe um produto de diesel, é ele.
  if (palavrasNF.has('DIESEL')) {
    const diesels = produtos.filter((p) => normalizarNome(p.nomeComercial).split(' ').includes('DIESEL'))
    if (diesels.length === 1) return diesels[0]
  }
  return null
}
