import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function podeAcessarTurmas(role?: string) {
    return role === 'GESTOR' || role === 'GERENTE'
  }

export async function GET(request: NextRequest) {
    try {
          const session = await getServerSession(authOptions)
          if (!session) {
                  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
                }

          if (!podeAcessarTurmas(session.user?.role as string)) {
                  return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
                }

          const { searchParams } = new URL(request.url)
          const apenasAtivos = searchParams.get('ativo') === 'true'

          const turmas = await prisma.turma.findMany({
                  where: apenasAtivos ? { ativo: true } : undefined,
                  orderBy: { nome: 'asc' },
                })

          return NextResponse.json(turmas)
        } catch (error) {
          console.error('Erro ao buscar turmas:', error)
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
          const { nome } = body

          if (!nome || nome.trim() === '') {
                  return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
                }

          const turma = await prisma.turma.create({
                  data: {
                            nome: nome.trim(),
                          },
                })

          return NextResponse.json(turma, { status: 201 })
        } catch (error: any) {
          if (error?.code === 'P2002') {
                  return NextResponse.json({ error: 'Já existe uma turma com este nome' }, { status: 409 })
                }
          console.error('Erro ao criar turma:', error)
          return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
        }
  }
