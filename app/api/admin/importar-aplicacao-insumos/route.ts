import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { timingSafeEqual } from 'node:crypto'
import { LINHAS_PLANILHA, AREA_POR_TALHAO, PRODUTO_LOOKUP, LinhaPlanilha } from './dados-planilha'

// Importação de histórico é uma operação grande (~1084 linhas + criação de
// alguns talhões/produtos novos). Aumenta o tempo máximo da function no Vercel
// (precisa de plano que suporte >10s; ajuste conforme o plano da Vercel).
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────
// Mesma lógica de normalização/sinônimos já validada em
// scripts/import-aplicacao-insumos.ts e no dry-run — duplicada aqui porque
// esta rota roda em runtime da Vercel, não como script standalone.
// ─────────────────────────────────────────────────────────────────────────

function normalizar(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

function normalizarSafra(s: unknown): string {
  return normalizar(s).replace(/^SAFRA\s+/, '')
}

const SINONIMOS_TALHAO: Record<string, string> = {
  'ABACATE': 'ABACATEIRO',
}
function normalizarTalhao(s: unknown): string {
  const chave = normalizar(s)
  return SINONIMOS_TALHAO[chave] || chave
}

const SINONIMOS_PRODUTO: Record<string, string> = {
  'DACAFE CERRADO': 'STOLLER DACAFE CERRADO',
  'EPINGLE': 'EPINGLE 100',
  'HS FOLIAR': 'FERTILIZANTE MISTO HS FOLIAR',
  'OBERON': 'OBERONN',
  'PLEDGE': 'PLEDGE (FLUMIZIN)',
  'ROUNDUP WG': 'ROUND UP WG',
  'TRANSPECT': 'TRASPECT (CLETODIM)',
  'VILORA 240': 'VILORA 240 (ESTEIO)',
}
function normalizarProduto(s: unknown): string {
  const chave = normalizar(s)
  return SINONIMOS_PRODUTO[chave] || chave
}

function atividadeLabel(atividade: string): string {
  const labels: Record<string, string> = {
    HERBICIDA: 'Herbicida',
    PULVERIZACAO: 'Pulverização',
    DRENCH: 'Drench',
    ADUBACAO: 'Adubação',
    CORRECAO_SOLO: 'Correção de Solo',
  }
  return labels[atividade] || atividade
}

function senhaValida(recebida: unknown, esperada: string): boolean {
  if (typeof recebida !== 'string') return false
  const a = Buffer.from(recebida)
  const b = Buffer.from(esperada)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = process.env.IMPORT_APLICACAO_INSUMOS_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'IMPORT_APLICACAO_INSUMOS_SECRET não configurado no ambiente' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    if (!senhaValida(body?.senha, secret)) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
    }

    // Trava de segurança: já rodou antes?
    // observacao não serve mais de marcador (agora guarda o texto original de
    // NUM. APLICAÇÃO quando a planilha tinha texto em vez de número, ex:
    // "DESSECAÇÃO"). Em vez disso, conta quantos AplicacaoInsumoItem já existem
    // para a safra "25/26" — um número alto (>100) só acontece se a importação
    // em massa já rodou; uso normal do dia a dia pela tela não chega nem perto.
    const LIMITE_JA_IMPORTADO = 100
    const todasSafras = await prisma.safra.findMany()
    const safraAlvo = todasSafras.find(s => normalizarSafra(s.nome) === '25/26')
    if (safraAlvo) {
      const jaImportado = await prisma.aplicacaoInsumoItem.count({
        where: { safraId: safraAlvo.id },
      })
      if (jaImportado > LIMITE_JA_IMPORTADO) {
        return NextResponse.json(
          { error: `Já existem ${jaImportado} lançamentos de Aplicação de Insumos para a safra "${safraAlvo.nome}" (limite de segurança: ${LIMITE_JA_IMPORTADO}). Isso indica que a importação em massa provavelmente já rodou. Nada foi gravado agora.` },
          { status: 409 }
        )
      }
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const safrasExistentes = await tx.safra.findMany()
      const safraPorNome = new Map(safrasExistentes.map(s => [normalizarSafra(s.nome), s]))

      const talhoesExistentes = await tx.talhao.findMany()
      const talhaoPorNome = new Map(talhoesExistentes.map(t => [normalizarTalhao(t.nome), t]))

      const produtosExistentes = await tx.produto.findMany()
      const produtoPorNome = new Map(produtosExistentes.map(p => [normalizarProduto(p.nomeComercial), p]))

      const talhoesCriados: string[] = []
      const produtosCriados: string[] = []
      const puladas: { linha: number; motivo: string }[] = []
      const itensParaCriar: any[] = []

      for (const l of LINHAS_PLANILHA as LinhaPlanilha[]) {
        if (!l.atividade) {
          puladas.push({ linha: l.linha, motivo: 'Atividade não reconhecida' })
          continue
        }

        const safraKey = normalizarSafra(l.safraRaw)
        const safra = safraKey ? safraPorNome.get(safraKey) : undefined
        if (!safra) {
          puladas.push({ linha: l.linha, motivo: `Safra sem correspondência: "${l.safraRaw}"` })
          continue
        }

        const talhaoKey = normalizarTalhao(l.talhao)
        let talhao = talhaoPorNome.get(talhaoKey)
        if (!talhao) {
          const area = l.area ?? AREA_POR_TALHAO[talhaoKey] ?? null
          talhao = await tx.talhao.create({ data: { nome: l.talhao, area, status: 'ATIVO' } })
          talhaoPorNome.set(talhaoKey, talhao)
          talhoesCriados.push(`${l.talhao} (área: ${area ?? 'desconhecida'})`)
        }

        const produtoKey = normalizarProduto(l.produto)
        let produto = produtoPorNome.get(produtoKey)
        if (!produto) {
          const lookup = PRODUTO_LOOKUP[produtoKey]
          const unidadeMedida = l.unidade || lookup?.unidade || 'un'
          const valorUnitario = l.valorUnitario ?? lookup?.valorUnitario ?? 0
          const categoria = atividadeLabel(l.atividade)
          produto = await tx.produto.create({ data: { nomeComercial: l.produto, categoria, unidadeMedida, valorUnitario } })
          produtoPorNome.set(produtoKey, produto)
          produtosCriados.push(`${l.produto} (${unidadeMedida}, R$ ${valorUnitario})`)
        }

        if (l.totalQtd === null) {
          puladas.push({ linha: l.linha, motivo: 'TOTAL (KG/LT) vazio' })
          continue
        }
        if (!l.data) {
          puladas.push({ linha: l.linha, motivo: 'DATA FINAL vazia ou inválida' })
          continue
        }

        const valorUnitarioSnapshot = l.valorUnitario && l.valorUnitario > 0 ? l.valorUnitario : produto.valorUnitario
        const valorTotal = l.totalQtd * valorUnitarioSnapshot

        // Algumas linhas trazem texto em NUM. APLICAÇÃO em vez de número
        // (ex: "DESSECAÇÃO", "POS COLHEITA", "ETHREL") — numAplicacao já caiu
        // pro default 1, mas preserva o texto original em observacao.
        const observacao = l.numAplicacaoTextoOriginal
          ? `NUM. APLICAÇÃO original (planilha): ${l.numAplicacaoTextoOriginal}`
          : null

        itensParaCriar.push({
          talhaoId: talhao.id,
          areaHaSnapshot: talhao.area ?? null,
          atividade: l.atividade,
          produtoId: produto.id,
          unidadeSnapshot: produto.unidadeMedida,
          valorUnitarioSnapshot,
          qtd: l.qtd,
          numBombas: l.numBombas,
          totalQtd: l.totalQtd,
          valorTotal,
          data: new Date(l.data),
          numAplicacao: l.numAplicacao,
          safraId: safra.id,
          observacao,
          registradoPorId: session.user?.id as string,
        })
      }

      await tx.aplicacaoInsumoItem.createMany({ data: itensParaCriar })

      return {
        importadas: itensParaCriar.length,
        talhoesCriados,
        produtosCriados,
        puladas,
      }
    }, { timeout: 55000 })

    return NextResponse.json({ success: true, ...resultado })
  } catch (error) {
    console.error('POST /api/admin/importar-aplicacao-insumos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
