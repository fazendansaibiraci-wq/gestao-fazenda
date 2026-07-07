import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function podeAcessarTurmas(role?: string) {
    return role === 'GESTOR' || role === 'GERENTE'
}

export async function GET(
    request: NextRequest,
  { params }: { params: { id: string } }
  ) {
    try {
          const session = await getServerSession(authOptions)
          if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      if (!podeAcessarTurmas(session.user?.role as string)) {
              return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }

      const diaria = await prisma.diariaTurma.findUnique({
              where: { id: params.id },
              include: {
                        talhao: true,
                        safra: true,
                        criadoPor: { select: { name: true } },
              },
      })

      if (!diaria) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

      return NextResponse.json({ success: true, data: diaria })
    } catch (error) {
          console.error('GET /api/diarias-turma/[id]:', error)
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function PUT(
    request: NextRequest,
  { params }: { params: { id: string } }
  ) {
    try {
          const session = await getServerSession(authOptions)
          if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      if (!podeAcessarTurmas(session.user?.role as string)) {
              return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }

      const diaria = await prisma.diariaTurma.findUnique({ where: { id: params.id } })
          if (!diaria) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

      const body = await request.json()

      const quantidadePessoas = body.quantidadePessoas !== undefined ? parseInt(body.quantidadePessoas) : diaria.quantidadePessoas
          const valorDiaria = body.valorDiaria !== undefined ? parseFloat(body.valorDiaria) : diaria.valorDiaria
          const valorTotal = parseFloat((valorDiaria * quantidadePessoas).toFixed(2))

      const updated = await prisma.diariaTurma.update({
              where: { id: params.id },
              data: {
                        data: body.data ? new Date(new Date(body.data).toISOString().split('T')[0] + 'T12:00:00.000Z') : undefined,
                        responsavelTurma: body.responsavelTurma || undefined,
                        quantidadePessoas,
                        talhaoId: body.talhaoId || undefined,
                        safraId: body.safraId || undefined,
                        tipoAtividade: body.tipoAtividade || undefined,
                        valorDiaria,
                        valorTotal,
                        observacao: body.observacao ?? null,
              },
              include: {
                        talhao: { select: { nome: true } },
                        safra: { select: { nome: true } },
              },
      })

      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
          console.error('PUT /api/diarias-turma/[id]:', error)
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
  { params }: { params: { id: string } }
  ) {
    try {
          const session = await getServerSession(authOptions)
          if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      if (!podeAcessarTurmas(session.user?.role as string)) {
              return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }

      const diaria = await prisma.diariaTurma.findUnique({ where: { id: params.id } })
          if (!diaria) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

      await prisma.diariaTurma.delete({ where: { id: params.id } })

      return NextResponse.json({ success: true, message: 'Deletado com sucesso' })
    } catch (error) {
          console.error('DELETE /api/diarias-turma/[id]:', error)
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
