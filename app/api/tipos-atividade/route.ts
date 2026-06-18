import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const apenasAtivos = searchParams.get('ativo') === 'true'

    const tipos = await prisma.tipoAtividade.findMany({
      where: apenasAtivos ? { ativo: true } : undefined,
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json(tipos)
  } catch (error) {
    console.error('Erro ao buscar tipos de atividade:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Acesso restrito ao gestor' }, { status: 403 })
    }

    const body = await request.json()
    const { nome, descricao } = body

    if (!nome || nome.trim() === '') {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const tipo = await prisma.tipoAtividade.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
      },
    })

    return NextResponse.json(tipo, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um tipo com este nome' }, { status: 409 })
    }
    console.error('Erro ao criar tipo de atividade:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}