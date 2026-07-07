import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function mapearTipoAtividade(nome: string): string {
    const mapa: Record<string, string> = {
          'pulverização': 'PULVERIZACAO',
          'herbicida': 'HERBICIDA',
          'adubação': 'ADUBACAO',
          'colheita': 'COLHEITA',
          'capina mecânica': 'CAPINA_MECANICA',
          'desbrota': 'DESBROTA',
          'capina manual': 'CAPINA_MANUAL',
          'chegamento de terra': 'CHEGAMENTO_TERRA',
          'correção de solo': 'CORRECAO_SOLO',
          'irrigação': 'IRRIGACAO',
          'inseticida de solo': 'INSETICIDA_SOLO',
    }
    return mapa[nome?.toLowerCase()] || 'GERAIS'
}

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
          const data = searchParams.get('data')
          const talhaoId = searchParams.get('talhaoId')

      const where: any = {}

            if (data) {
                    const dateStart = new Date(data)
                    const dateEnd = new Date(data)
                    dateEnd.setDate(dateEnd.getDate() + 1)
                    where.data = { gte: dateStart, lt: dateEnd }
            }

      if (talhaoId) {
              where.talhaoId = talhaoId
      }

      const diarias = await prisma.diariaTurma.findMany({
              where,
              include: {
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

      if (!body.data || !body.responsavelTurma || !body.quantidadePessoas || !body.talhaoId || !body.safraId || !body.valorDiaria) {
              return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
      }

      const quantidadePessoas = parseInt(body.quantidadePessoas)
          const valorDiaria = parseFloat(body.valorDiaria)
          const valorTotal = parseFloat((valorDiaria * quantidadePessoas).toFixed(2))

      const diaria = await prisma.diariaTurma.create({
              data: {
                        data: new Date(new Date(body.data).toISOString().split('T')[0] + 'T12:00:00.000Z'),
                        responsavelTurma: body.responsavelTurma,
                        quantidadePessoas,
                        talhaoId: body.talhaoId,
                        safraId: body.safraId,
                        tipoAtividade: mapearTipoAtividade(body.tipoAtividade) as any,
                        valorDiaria,
                        valorTotal,
                        observacao: body.observacao || null,
                        criadoPorId: session.user?.id as string,
              },
              include: {
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
