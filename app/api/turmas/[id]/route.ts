import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    try {
          const session = await getServerSession(authOptions)
          if (!session || session.user?.role !== 'GESTOR') {
                  return NextResponse.json({ error: 'Acesso restrito ao gestor' }, { status: 403 })
                }

          const body = await request.json()
          const { nome, ativo } = body

          if (nome !== undefined && nome.trim() === '') {
                  return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
                }

          const turma = await prisma.turma.update({
                  where: { id: params.id },
                  data: {
                            nome: nome !== undefined ? nome.trim() : undefined,
                            ativo: ativo !== undefined ? Boolean(ativo) : undefined,
                          },
                })

          return NextResponse.json(turma)
        } catch (error: any) {
          if (error?.code === 'P2025') {
                  return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 })
                }
          if (error?.code === 'P2002') {
                  return NextResponse.json({ error: 'Já existe uma turma com este nome' }, { status: 409 })
                }
          console.error('Erro ao atualizar turma:', error)
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

          await prisma.turma.delete({ where: { id: params.id } })
          return NextResponse.json({ message: 'Turma excluída com sucesso' })
        } catch (error: any) {
          if (error?.code === 'P2025') {
                  return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 })
                }
          if (error?.code === 'P2003') {
                  return NextResponse.json({ error: 'Não é possível excluir: existem diárias vinculadas a esta turma' }, { status: 409 })
                }
          console.error('Erro ao excluir turma:', error)
          return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
        }
  }
