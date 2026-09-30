// Leitura da receita de aplicação que o agrônomo manda no WhatsApp
// (ex: "1ª PULVERIZAÇÃO / Talhões: Cedro, 2SL, ... / • Li 700: 500 mL").
// Só interpreta o texto e sugere correspondências com o cadastro — quem
// confere e confirma é o usuário, na tela de Aplicação de Insumos.

export type AtividadeReceita = 'HERBICIDA' | 'PULVERIZACAO' | 'DRENCH' | 'ADUBACAO' | 'CORRECAO_SOLO'

export interface ProdutoCadastro { id: string; nomeComercial: string; unidadeMedida: string }
export interface TalhaoCadastro { id: string; nome: string }

export interface ProdutoLido {
  textoOriginal: string
  nomeLido: string
  quantidadeLida: number
  unidadeLida: string
  produtoId: string // '' quando não achou no cadastro
}

export interface TalhaoLido {
  nomeLido: string
  talhaoId: string // '' quando não achou no cadastro
}

export interface ReceitaLida {
  atividade: AtividadeReceita | null
  numAplicacao: string | null
  produtos: ProdutoLido[]
  talhoes: TalhaoLido[]
  observacoes: string[]
}

const PALAVRAS_VAZIAS = new Set(['DO', 'DA', 'DE', 'DOS', 'DAS', 'E'])

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9/+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(texto: string): string[] {
  return normalizar(texto).split(' ').filter((t) => t && !PALAVRAS_VAZIAS.has(t))
}

// "MUNDO NOVO MATO" -> também tenta "MN MATO" (iniciais das palavras
// anteriores à última), que é como alguns talhões estão cadastrados.
function variantes(texto: string): string[] {
  const t = tokens(texto)
  const v = new Set<string>([t.join(' ')])
  for (let corte = 2; corte < t.length; corte++) {
    const iniciais = t.slice(0, corte).map((x) => x[0]).join('')
    v.add([iniciais, ...t.slice(corte)].join(' '))
  }
  return Array.from(v)
}

function melhorCorrespondencia<T>(nome: string, lista: T[], nomeDe: (x: T) => string): T | null {
  const vs = variantes(nome)
  // 0) igual sem espaços/símbolos ("CaMg + B" = "CAMG+B", "Re Leaf" = "RELEAF")
  const compacto = (x: string) => normalizar(x).replace(/[^A-Z0-9]/g, '')
  const cn = compacto(nome)
  for (const item of lista) {
    if (cn && compacto(nomeDe(item)) === cn) return item
  }
  // 1) igual (considerando variantes)
  for (const item of lista) {
    const vi = variantes(nomeDe(item))
    if (vs.some((a) => vi.includes(a))) return item
  }
  // 2) um contém o outro
  const alvo = tokens(nome).join(' ')
  for (const item of lista) {
    const n = tokens(nomeDe(item)).join(' ')
    if (n && alvo && (n.startsWith(alvo) || alvo.startsWith(n) || n.includes(` ${alvo}`) || alvo.includes(` ${n}`))) return item
  }
  // 3) mais palavras em comum (pelo menos uma palavra significativa)
  let melhor: T | null = null
  let melhorNota = 0
  const ta = new Set(tokens(nome).filter((x) => x.length >= 3 || /\d/.test(x)))
  for (const item of lista) {
    const tb = new Set(tokens(nomeDe(item)))
    let comum = 0
    ta.forEach((x) => { if (tb.has(x)) comum++ })
    const nota = comum / Math.max(ta.size, tb.size, 1)
    if (comum > 0 && nota > melhorNota) { melhor = item; melhorNota = nota }
  }
  return melhorNota >= 0.5 ? melhor : null
}

export function acharProduto(nome: string, produtos: ProdutoCadastro[]): string {
  // "Epingle 100 / Piriproxifen" -> tenta o nome inteiro e cada parte
  const partes = [nome, ...nome.split('/').map((p) => p.trim()).filter(Boolean)]
  for (const p of partes) {
    const achado = melhorCorrespondencia(p, produtos, (x) => x.nomeComercial)
    if (achado) return achado.id
  }
  return ''
}

export function acharTalhao(nome: string, talhoes: TalhaoCadastro[]): string {
  return melhorCorrespondencia(nome, talhoes, (x) => x.nome)?.id || ''
}

// Converte a quantidade lida para a unidade do produto no cadastro.
export function converterUnidade(qtd: number, unidadeLida: string, unidadeProduto: string): number {
  const de = unidadeLida.toLowerCase()
  const para = (unidadeProduto || '').toLowerCase()
  if (de === 'ml' && para === 'l') return qtd / 1000
  if (de === 'l' && para === 'ml') return qtd * 1000
  if (de === 'g' && para === 'kg') return qtd / 1000
  if (de === 'kg' && para === 'g') return qtd * 1000
  return qtd
}

const ATIVIDADES: [RegExp, AtividadeReceita][] = [
  [/PULVERIZA/, 'PULVERIZACAO'],
  [/HERBICIDA/, 'HERBICIDA'],
  [/DRENCH/, 'DRENCH'],
  [/ADUBA/, 'ADUBACAO'],
  [/CORRE[CÇ]AO/, 'CORRECAO_SOLO'],
]

export function lerReceita(texto: string, produtos: ProdutoCadastro[], talhoes: TalhaoCadastro[]): ReceitaLida {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let atividade: AtividadeReceita | null = null
  let numAplicacao: string | null = null
  const produtosLidos: ProdutoLido[] = []
  const talhoesLidos: TalhaoLido[] = []
  const observacoes: string[] = []

  for (const linha of linhas) {
    const norm = normalizar(linha)

    // Título: "1ª PULVERIZAÇÃO"
    if (!atividade) {
      const at = ATIVIDADES.find(([re]) => re.test(norm))
      if (at && !linha.includes(':')) {
        atividade = at[1]
        const num = linha.match(/(\d+)\s*[ªºa°o]?/i)
        if (num) numAplicacao = num[1]
        continue
      }
    }

    // Talhões: "Talhões: Cedro, 2SL, Mundo novo do Mato, ..."
    const mTalhoes = linha.match(/^talh[õoõ]es?\s*:\s*(.+)$/i) || linha.match(/^talh\S*\s*:\s*(.+)$/i)
    if (mTalhoes) {
      mTalhoes[1]
        .split(/,|;|\s+e\s+/i)
        .map((t) => t.replace(/\.$/, '').trim())
        .filter(Boolean)
        .forEach((nome) => talhoesLidos.push({ nomeLido: nome, talhaoId: acharTalhao(nome, talhoes) }))
      continue
    }

    // Observações e regulagem ficam só como aviso (antes do produto, pois
    // "Regulagem: 7 L ..." tem o mesmo formato de uma linha de produto)
    if (/^(OBS|REGULAGEM)/.test(norm)) {
      observacoes.push(linha)
      continue
    }

    // Produto: "• Li 700: 500 mL"
    const mProd = linha.match(/^[\s•·\-*]*([^:]+?)\s*:\s*([\d]+(?:[.,]\d+)?)\s*(ml|l|kg|g)\b/i)
    if (mProd) {
      const nome = mProd[1].trim()
      const qtd = parseFloat(mProd[2].replace(',', '.'))
      const unidade = mProd[3]
      produtosLidos.push({
        textoOriginal: linha.replace(/^[\s•·\-*]+/, ''),
        nomeLido: nome,
        quantidadeLida: qtd,
        unidadeLida: unidade,
        produtoId: acharProduto(nome, produtos),
      })
      continue
    }
  }

  return { atividade, numAplicacao, produtos: produtosLidos, talhoes: talhoesLidos, observacoes }
}
