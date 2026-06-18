import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Acesso restrito ao gestor' }, { status: 403 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { nome, descricao, ativo } = body

    if (!nome || nome.trim() === '') {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const tipo = await prisma.tipoAtividadeCadastro.update({
      where: { id },
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        ativo: ativo !== undefined ? Boolean(ativo) : undefined,
      },
    })

    return NextResponse.json(tipo)
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Tipo não encontrado' }, { status: 404 })
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um tipo com este nome' }, { status: 409 })
    }
    console.error('Erro ao atualizar tipo de atividade:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Acesso restrito ao gestor' }, { status: 403 })
    }

    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    await prisma.tipoAtividadeCadastro.delete({ where: { id } })
    return NextResponse.json({ message: 'Tipo excluído com sucesso' })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Tipo não encontrado' }, { status: 404 })
    }
    console.error('Erro ao excluir tipo de atividade:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}