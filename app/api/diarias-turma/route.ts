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
          if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      if (!podeAcessarTurmas(session.user?.role as string)) {
              return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }

      const { searchParams } = new URL(request.url)
          const dataInicio = searchParams.get('dataInicio')
          const dataFim = searchParams.get('dataFim')
          const talhaoId = searchParams.get('talhaoId')

      const where: any = {}

            if (dataInicio) {
                    where.data = { ...where.data, gte: new Date(dataInicio + 'T00:00:00.000Z') }
            }
            if (dataFim) {
                    where.data = { ...where.data, lte: new Date(dataFim + 'T23:59:59.999Z') }
            }

      if (talhaoId) {
              where.talhaoId = talhaoId
      }

      const diarias = await prisma.diariaTurma.findMany({
              where,
              include: {
                        turma: { select: { nome: true } },
                        talhao: { select: { nome: true } },
                        safra: { select: { nome: true } },
                        criadoPor: { select: { name: true } },
              },
              orderBy: { data: 'desc' },
      })

      return NextResponse.json({ success: true, data: diarias })
    } catch (error) {
          console.error('GET /api/diarias-turma:', error)
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
          const session = await getServerSession(authOptions)
          if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      if (!podeAcessarTurmas(session.user?.role as string)) {
              return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }

      const body = await request.json()

      if (!body.data || !body.turmaId || !body.quantidadePessoas || !body.talhaoId || !body.safraId || !body.valorDiaria) {
              return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
      }

      const quantidadePessoas = parseInt(body.quantidadePessoas)
          const valorDiaria = parseFloat(body.valorDiaria)
          const valorTotal = parseFloat((valorDiaria * quantidadePessoas).toFixed(2))

      const diaria = await prisma.diariaTurma.create({
              data: {
                        data: new Date(new Date(body.data).toISOString().split('T')[0] + 'T12:00:00.000Z'),
                        turmaId: body.turmaId,
                        quantidadePessoas,
                        talhaoId: body.talhaoId,
                        safraId: body.safraId,
                        tipoAtividade: body.tipoAtividade,
                        valorDiaria,
                        valorTotal,
                        observacao: body.observacao || null,
                        criadoPorId: session.user?.id as string,
              },
              include: {
                        turma: { select: { nome: true } },
                        talhao: { select: { nome: true } },
                        safra: { select: { nome: true } },
              },
      })

      return NextResponse.json(
        { success: true, data: diaria, message: 'Diária de turma registrada com sucesso' },
        { status: 201 }
            )
    } catch (error) {
          console.error('POST /api/diarias-turma:', error)
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
