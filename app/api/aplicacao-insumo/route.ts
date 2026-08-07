import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const safraId = searchParams.get('safraId')
    const talhaoId = searchParams.get('talhaoId')
    const atividade = searchParams.get('atividade')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    const where: any = {}
    if (safraId) where.safraId = safraId
    if (talhaoId) where.talhaoId = talhaoId
    if (atividade) where.atividade = atividade
    if (dataInicio || dataFim) {
      where.data = {}
      if (dataInicio) where.data.gte = new Date(dataInicio + 'T00:00:00')
      if (dataFim) where.data.lte = new Date(dataFim + 'T23:59:59.999')
    }

    const itens = await prisma.aplicacaoInsumoItem.findMany({
      where,
      include: {
        talhao: { select: { id: true, nome: true, area: true } },
        produto: { select: { id: true, nomeComercial: true, unidadeMedida: true } },
        safra: { select: { id: true, nome: true } },
        registradoPor: { select: { id: true, name: true } },
      },
      orderBy: { data: 'desc' },
    })

    return NextResponse.json({ success: true, data: itens })
  } catch (error) {
    console.error('GET /api/aplicacao-insumo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const itens = Array.isArray(body) ? body : body.itens

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: 'Envie ao menos um item' }, { status: 400 })
    }

    for (const item of itens) {
      if (!item.talhaoId || !item.produtoId || !item.safraId || !item.atividade || !item.data || item.totalQtd === undefined || item.totalQtd === null) {
        return NextResponse.json(
          { error: 'Cada item precisa de talhaoId, produtoId, safraId, atividade, data e totalQtd' },
          { status: 400 }
        )
      }
    }

    const produtoIds = Array.from(new Set(itens.map((i: any) => i.produtoId)))
    const talhaoIds = Array.from(new Set(itens.map((i: any) => i.talhaoId)))
    const safraIds = Array.from(new Set(itens.map((i: any) => i.safraId)))

    const [produtos, talhoes, safras] = await Promise.all([
      prisma.produto.findMany({ where: { id: { in: produtoIds as string[] } } }),
      prisma.talhao.findMany({ where: { id: { in: talhaoIds as string[] } } }),
      prisma.safra.findMany({ where: { id: { in: safraIds as string[] } } }),
    ])

    const produtoMap = new Map(produtos.map(p => [p.id, p] as const))
    const talhaoMap = new Map(talhoes.map(t => [t.id, t] as const))
    const safraMap = new Map(safras.map(s => [s.id, s] as const))

    for (const item of itens) {
      if (!produtoMap.has(item.produtoId)) {
        return NextResponse.json({ error: `Produto não encontrado: ${item.produtoId}` }, { status: 400 })
      }
      if (!talhaoMap.has(item.talhaoId)) {
        return NextResponse.json({ error: `Talhão não encontrado: ${item.talhaoId}` }, { status: 400 })
      }
      if (!safraMap.has(item.safraId)) {
        return NextResponse.json({ error: `Safra não encontrada: ${item.safraId}` }, { status: 400 })
      }
    }

    const created = await prisma.$transaction(
      itens.map((item: any) => {
        const produto = produtoMap.get(item.produtoId)!
        const talhao = talhaoMap.get(item.talhaoId)!

        const qtd = item.qtd !== undefined && item.qtd !== null && item.qtd !== '' ? parseFloat(item.qtd) : null
        const numBombas = item.numBombas !== undefined && item.numBombas !== null && item.numBombas !== '' ? parseFloat(item.numBombas) : null

        // Modo "por bomba" (qtd e numBombas informados): recalcula totalQtd no servidor
        // em vez de confiar no valor vindo do client. Modo "direto" (sem qtd/numBombas):
        // não há fórmula para recalcular, usa o total informado.
        const totalQtd = qtd !== null && numBombas !== null ? qtd * numBombas : parseFloat(item.totalQtd)

        if (isNaN(totalQtd) || totalQtd <= 0) {
          throw new Error(`totalQtd inválido para talhão ${item.talhaoId} / produto ${item.produtoId}`)
        }

        return prisma.aplicacaoInsumoItem.create({
          data: {
            talhaoId: item.talhaoId,
            areaHaSnapshot: talhao.area ?? null,
            atividade: item.atividade,
            produtoId: item.produtoId,
            unidadeSnapshot: produto.unidadeMedida,
            valorUnitarioSnapshot: produto.valorUnitario,
            qtd,
            numBombas,
            totalQtd,
            valorTotal: totalQtd * produto.valorUnitario,
            data: new Date(item.data),
            numAplicacao: item.numAplicacao ? parseInt(item.numAplicacao) : 1,
            safraId: item.safraId,
            observacao: item.observacao || null,
            registradoPorId: session.user?.id as string,
          },
        })
      })
    )

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('POST /api/aplicacao-insumo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
