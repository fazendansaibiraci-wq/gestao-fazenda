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

    const transferencias = await prisma.transferenciaEstoque.findMany({
      where,
      include: {
        produto: { select: { nomeComercial: true, unidadeMedida: true } },
        localOrigem: { select: { nome: true } },
        localDestino: { select: { nome: true } },
        registradoPor: { select: { name: true } },
      },
      orderBy: { data: 'desc' },
    })

    return NextResponse.json({ success: true, data: transferencias })
  } catch (error) {
    console.error('GET /api/transferencias-estoque:', error)
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

    if (!body.produtoId || !body.localOrigemId || !body.localDestinoId || body.quantidade == null || !body.data) {
      return NextResponse.json(
        { error: 'Produto, local de origem, local de destino, quantidade e data são obrigatórios' },
        { status: 400 }
      )
    }

    if (body.localOrigemId === body.localDestinoId) {
      return NextResponse.json({ error: 'Local de origem e destino devem ser diferentes' }, { status: 400 })
    }

    if (body.quantidade <= 0) {
      return NextResponse.json({ error: 'Quantidade deve ser maior que zero' }, { status: 400 })
    }

    const produto = await prisma.produto.findUnique({ where: { id: body.produtoId } })
    if (!produto) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    const [localOrigem, localDestino] = await Promise.all([
      prisma.local.findUnique({ where: { id: body.localOrigemId } }),
      prisma.local.findUnique({ where: { id: body.localDestinoId } }),
    ])
    if (!localOrigem) return NextResponse.json({ error: 'Local de origem não encontrado' }, { status: 404 })
    if (!localDestino) return NextResponse.json({ error: 'Local de destino não encontrado' }, { status: 404 })

    const estoqueOrigemAtual = await prisma.estoqueLocal.findUnique({
      where: { produtoId_localId: { produtoId: body.produtoId, localId: body.localOrigemId } },
    })
    const saldoOrigem = estoqueOrigemAtual?.quantidade ?? 0

    if (body.quantidade > saldoOrigem) {
      return NextResponse.json(
        { error: `Saldo insuficiente em ${localOrigem.nome}: disponível ${saldoOrigem.toLocaleString('pt-BR')} ${produto.unidadeMedida}` },
        { status: 400 }
      )
    }

    // Transferência não altera o total do produto (soma de todos os
    // locais) — só move quantidade de EstoqueLocal(origem) pra
    // EstoqueLocal(destino), então Produto.quantidadeEstoque não
    // precisa ser recalculado aqui.
    const transferencia = await prisma.$transaction(async (tx) => {
      const registro = await tx.transferenciaEstoque.create({
        data: {
          produtoId: body.produtoId,
          localOrigemId: body.localOrigemId,
          localDestinoId: body.localDestinoId,
          quantidade: body.quantidade,
          data: new Date(body.data),
          observacao: body.observacao?.trim() || null,
          registradoPorId: session.user.id as string,
        },
      })

      await tx.estoqueLocal.update({
        where: { produtoId_localId: { produtoId: body.produtoId, localId: body.localOrigemId } },
        data: { quantidade: { decrement: body.quantidade } },
      })

      await tx.estoqueLocal.upsert({
        where: { produtoId_localId: { produtoId: body.produtoId, localId: body.localDestinoId } },
        create: { produtoId: body.produtoId, localId: body.localDestinoId, quantidade: body.quantidade },
        update: { quantidade: { increment: body.quantidade } },
      })

      return registro
    })

    return NextResponse.json({ success: true, data: transferencia })
  } catch (error) {
    console.error('POST /api/transferencias-estoque:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
