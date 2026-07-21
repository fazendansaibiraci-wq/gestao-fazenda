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
    const talhaoId = searchParams.get('talhaoId')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    const where: any = {}
    if (produtoId) where.produtoId = produtoId
    if (talhaoId) where.talhaoId = talhaoId
    if (dataInicio || dataFim) {
      where.data = {}
      if (dataInicio) where.data.gte = new Date(dataInicio)
      if (dataFim) where.data.lte = new Date(dataFim)
    }

    const saidas = await prisma.saidaProduto.findMany({
      where,
      include: {
        produto: { select: { nomeComercial: true, unidadeMedida: true } },
        talhao: { select: { nome: true } },
        safra: { select: { nome: true } },
        registradoPor: { select: { name: true } },
      },
      orderBy: { data: 'desc' },
    })

    return NextResponse.json({ success: true, data: saidas })
  } catch (error) {
    console.error('GET /api/saidas-produto:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.produtoId || !body.quantidade || !body.data) {
      return NextResponse.json({ error: 'Produto, quantidade e data são obrigatórios' }, { status: 400 })
    }

    if (body.quantidade <= 0) {
      return NextResponse.json({ error: 'Quantidade deve ser maior que zero' }, { status: 400 })
    }

    const produto = await prisma.produto.findUnique({ where: { id: body.produtoId } })
    if (!produto) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    if (produto.quantidadeEstoque < body.quantidade) {
      return NextResponse.json(
        {
          error: `Estoque insuficiente: ${produto.quantidadeEstoque} ${produto.unidadeMedida} disponíveis, ${body.quantidade} ${produto.unidadeMedida} solicitados.`,
        },
        { status: 400 }
      )
    }

    const [saida] = await prisma.$transaction([
      prisma.saidaProduto.create({
        data: {
          produtoId: body.produtoId,
          quantidade: body.quantidade,
          data: new Date(body.data),
          talhaoId: body.talhaoId || null,
          safraId: body.safraId || null,
          observacao: body.observacao || null,
          registradoPorId: session.user.id as string,
        },
      }),
      prisma.produto.update({
        where: { id: body.produtoId },
        data: { quantidadeEstoque: { decrement: body.quantidade } },
      }),
    ])

    return NextResponse.json({ success: true, data: saida })
  } catch (error) {
    console.error('POST /api/saidas-produto:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
