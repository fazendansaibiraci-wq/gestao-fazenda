import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safraDaData } from '@/lib/safraPorData'

// Data "AAAA-MM-DD" vira meio-dia de Brasília, pra não aparecer como o dia
// anterior em nenhum fuso.
const meioDiaBrasilia = (data: string) => new Date(`${String(data).slice(0, 10)}T12:00:00-03:00`)

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const produtoId = searchParams.get('produtoId')
    const talhaoId = searchParams.get('talhaoId')
    const localId = searchParams.get('localId')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    // Abastecimentos de diesel também geram saída; por padrão ficam de fora.
    const incluirAbastecimentos = searchParams.get('incluirAbastecimentos') === 'true'
    // Só saídas que ainda têm quantidade para devolver (usado no card de Devolução).
    const comSaldoParaDevolver = searchParams.get('comSaldoParaDevolver') === 'true'

    const where: any = {}
    if (produtoId) where.produtoId = produtoId
    if (talhaoId) where.talhaoId = talhaoId
    if (localId) where.localId = localId
    if (!incluirAbastecimentos) where.abastecimento = { is: null }
    if (dataInicio || dataFim) {
      where.data = {}
      if (dataInicio) where.data.gte = new Date(`${dataInicio}T00:00:00-03:00`)
      if (dataFim) where.data.lte = new Date(`${dataFim}T23:59:59.999-03:00`)
    }

    const saidas = await prisma.saidaProduto.findMany({
      where,
      include: {
        produto: { select: { nomeComercial: true, unidadeMedida: true } },
        talhao: { select: { nome: true } },
        safra: { select: { nome: true } },
        local: { select: { nome: true } },
        registradoPor: { select: { name: true } },
        abastecimento: { select: { id: true } },
        devolucoes: {
          include: {
            local: { select: { nome: true } },
            registradoPor: { select: { name: true } },
          },
          orderBy: [{ data: 'asc' }, { dataCriacao: 'asc' }],
        },
      },
      orderBy: [{ data: 'desc' }, { dataCriacao: 'desc' }],
    })

    let lista = saidas.map((s) => {
      const devolvido = s.devolucoes.reduce((acc, d) => acc + d.quantidade, 0)
      return { ...s, devolvido, usado: s.quantidade - devolvido }
    })
    if (comSaldoParaDevolver) lista = lista.filter((s) => !s.abastecimento && s.usado > 0.0001)

    return NextResponse.json({ success: true, data: lista })
  } catch (error) {
    console.error('GET /api/saidas-produto:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Registra uma saída com um ou vários produtos. Os campos comuns (data,
// local, talhão, safra, tipo, atividade, observação) valem para todos os
// itens, e cada item vira uma saída própria (uma linha no histórico).
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Aceita o formato antigo (um produto) e o novo (lista de itens).
    const itensBrutos: { produtoId: string; quantidade: number }[] = Array.isArray(body.itens)
      ? body.itens
      : body.produtoId
        ? [{ produtoId: body.produtoId, quantidade: body.quantidade }]
        : []
    const itens = itensBrutos
      .map((i) => ({ produtoId: String(i.produtoId || ''), quantidade: Number(i.quantidade) }))
      .filter((i) => i.produtoId)

    if (!body.data || !body.localId || itens.length === 0) {
      return NextResponse.json({ error: 'Data, local e pelo menos um produto são obrigatórios' }, { status: 400 })
    }
    if (itens.some((i) => !(i.quantidade > 0))) {
      return NextResponse.json({ error: 'Quantidade de cada produto deve ser maior que zero' }, { status: 400 })
    }

    const local = await prisma.local.findUnique({ where: { id: body.localId } })
    if (!local) return NextResponse.json({ error: 'Local não encontrado' }, { status: 404 })

    const produtoIds = Array.from(new Set(itens.map((i) => i.produtoId)))
    const produtos = await prisma.produto.findMany({ where: { id: { in: produtoIds } } })
    if (produtos.length !== produtoIds.length) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }
    const produtoPorId = new Map(produtos.map((p) => [p.id, p]))

    // Saldo validado por local, somando itens repetidos do mesmo produto.
    const estoques = await prisma.estoqueLocal.findMany({
      where: { localId: body.localId, produtoId: { in: produtoIds } },
    })
    const saldoPorProduto = new Map(estoques.map((e) => [e.produtoId, e.quantidade]))
    const pedidoPorProduto = new Map<string, number>()
    for (const i of itens) pedidoPorProduto.set(i.produtoId, (pedidoPorProduto.get(i.produtoId) || 0) + i.quantidade)
    for (const [produtoId, pedido] of Array.from(pedidoPorProduto)) {
      const saldo = saldoPorProduto.get(produtoId) ?? 0
      if (pedido > saldo + 0.0001) {
        const p = produtoPorId.get(produtoId)!
        return NextResponse.json(
          {
            error: `Estoque insuficiente de ${p.nomeComercial} em ${local.nome}: ${saldo.toLocaleString('pt-BR')} ${p.unidadeMedida} disponíveis, ${pedido.toLocaleString('pt-BR')} ${p.unidadeMedida} pedidos.`,
          },
          { status: 400 }
        )
      }
    }

    const data = meioDiaBrasilia(body.data)

    // Safra: a escolhida, ou a que cobre a data da saída.
    let safraId: string | null = body.safraId || null
    if (!safraId) {
      const safras = await prisma.safra.findMany({ select: { id: true, dataInicio: true, dataFim: true } })
      safraId = safraDaData(safras, data)?.id ?? null
    }

    const criadas = await prisma.$transaction(async (tx) => {
      const resultado = []
      for (const item of itens) {
        const saida = await tx.saidaProduto.create({
          data: {
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            data,
            talhaoId: body.talhaoId || null,
            safraId,
            tipo: body.tipo?.trim() || null,
            tipoAtividade: body.tipoAtividade?.trim() || null,
            observacao: body.observacao?.trim() || null,
            registradoPorId: session.user.id as string,
            localId: body.localId,
          },
        })
        await tx.produto.update({
          where: { id: item.produtoId },
          data: { quantidadeEstoque: { decrement: item.quantidade } },
        })
        await tx.estoqueLocal.update({
          where: { produtoId_localId: { produtoId: item.produtoId, localId: body.localId } },
          data: { quantidade: { decrement: item.quantidade } },
        })
        resultado.push(saida)
      }
      return resultado
    })

    // Conferência: saldo antes/depois no local, por produto.
    const conferencia = produtoIds.map((produtoId) => {
      const p = produtoPorId.get(produtoId)!
      const antes = saldoPorProduto.get(produtoId) ?? 0
      const quantidade = pedidoPorProduto.get(produtoId) || 0
      return { produto: p.nomeComercial, unidade: p.unidadeMedida, antes, quantidade, depois: antes - quantidade }
    })

    return NextResponse.json({ success: true, data: criadas, conferencia: { local: local.nome, itens: conferencia } })
  } catch (error) {
    console.error('POST /api/saidas-produto:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
