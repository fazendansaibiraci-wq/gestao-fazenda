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
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.produtoId || body.quantidadeNova == null || !body.data || !body.observacao?.trim()) {
      return NextResponse.json(
        { error: 'Produto, quantidade contada, data e motivo são obrigatórios' },
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

    const quantidadeAnterior = produto.quantidadeEstoque
    const diferenca = body.quantidadeNova - quantidadeAnterior

    const [ajuste] = await prisma.$transaction([
      prisma.ajusteEstoque.create({
        data: {
          produtoId: body.produtoId,
          quantidadeAnterior,
          quantidadeNova: body.quantidadeNova,
          diferenca,
          data: new Date(body.data),
          observacao: body.observacao.trim(),
          registradoPorId: session.user.id as string,
        },
      }),
      prisma.produto.update({
        where: { id: body.produtoId },
        data: { quantidadeEstoque: body.quantidadeNova },
      }),
    ])

    return NextResponse.json({ success: true, data: ajuste })
  } catch (error) {
    console.error('POST /api/ajustes-estoque:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
