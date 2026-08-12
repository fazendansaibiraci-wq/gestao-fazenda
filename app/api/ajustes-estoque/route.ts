import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const produtoId = searchParams.get('produtoId')

    const where: any = {}
    if (produtoId) where.produtoId = produtoId

    const ajustes = await prisma.ajusteEstoque.findMany({
      where,
      include: {
        produto: { select: { nomeComercial: true, unidadeMedida: true } },
        local: { select: { nome: true } },
        registradoPor: { select: { name: true } },
      },
      orderBy: { data: 'desc' },
    })

    return NextResponse.json({ success: true, data: ajustes })
  } catch (error) {
    console.error('GET /api/ajustes-estoque:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user?.role !== 'GESTOR' && session.user?.role !== 'GERENTE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.produtoId || body.quantidadeNova == null || !body.data || !body.observacao?.trim() || !body.localId) {
      return NextResponse.json(
        { error: 'Produto, local, quantidade contada, data e motivo são obrigatórios' },
        { status: 400 }
      )
    }

    if (body.quantidadeNova < 0) {
      return NextResponse.json({ error: 'Quantidade não pode ser negativa' }, { status: 400 })
    }

    const produto = await prisma.produto.findUnique({ where: { id: body.produtoId } })
    if (!produto) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    const local = await prisma.local.findUnique({ where: { id: body.localId } })
    if (!local) {
      return NextResponse.json({ error: 'Local não encontrado' }, { status: 404 })
    }

    // Agora o ajuste é sobre o saldo DO LOCAL, não mais do produto
    // como um todo — "anterior"/"nova"/"diferença" se referem ao que
    // já estava (ou não) em EstoqueLocal pra esse par produto+local.
    const estoqueLocalAtual = await prisma.estoqueLocal.findUnique({
      where: { produtoId_localId: { produtoId: body.produtoId, localId: body.localId } },
    })
    const quantidadeAnterior = estoqueLocalAtual?.quantidade ?? 0
    const diferenca = body.quantidadeNova - quantidadeAnterior

    const ajuste = await prisma.$transaction(async (tx) => {
      const registro = await tx.ajusteEstoque.create({
        data: {
          produtoId: body.produtoId,
          localId: body.localId,
          quantidadeAnterior,
          quantidadeNova: body.quantidadeNova,
          diferenca,
          data: new Date(body.data),
          observacao: body.observacao.trim(),
          registradoPorId: session.user.id as string,
        },
      })

      await tx.estoqueLocal.upsert({
        where: { produtoId_localId: { produtoId: body.produtoId, localId: body.localId } },
        create: { produtoId: body.produtoId, localId: body.localId, quantidade: body.quantidadeNova },
        update: { quantidade: body.quantidadeNova },
      })

      // Recalcula Produto.quantidadeEstoque como a soma de TODOS os
      // locais desse produto — evita que o total fique dessincronizado
      // da soma dos locais quando só um deles é ajustado.
      const todosLocais = await tx.estoqueLocal.findMany({ where: { produtoId: body.produtoId } })
      const novoTotal = todosLocais.reduce((acc, e) => acc + e.quantidade, 0)
      await tx.produto.update({
        where: { id: body.produtoId },
        data: { quantidadeEstoque: novoTotal },
      })

      return registro
    })

    return NextResponse.json({ success: true, data: ajuste })
  } catch (error) {
    console.error('POST /api/ajustes-estoque:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
