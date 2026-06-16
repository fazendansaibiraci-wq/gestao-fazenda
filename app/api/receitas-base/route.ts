import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const receitas = await prisma.receitaBase.findMany({
      include: {
        safra: true,
        produtosReceita: { include: { produto: true } },
        ajustes: { include: { produto: true } },
        criadoPor: { select: { name: true } },
      },
      orderBy: { dataCriacao: 'desc' },
    })

    return NextResponse.json({ success: true, data: receitas })
  } catch (error) {
    console.error('GET /api/receitas-base:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'AGRONOMO') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.nome || !body.atividade || !body.safraId || !body.perfilTalhao) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const receita = await prisma.receitaBase.create({
      data: {
        nome: body.nome,
        atividade: body.atividade,
        sequencia: body.sequencia || 'PRIMEIRA',
        perfilTalhao: body.perfilTalhao,
        safraId: body.safraId,
        unidadeBase: body.unidadeBase || 'bomba 1.000L',
        criadoPorId: session.user?.id as string,
      },
      include: {
        safra: true,
        criadoPor: { select: { name: true } },
      },
    })

    return NextResponse.json(
      { success: true, data: receita, message: 'Receita criada com sucesso' },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/receitas-base:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
