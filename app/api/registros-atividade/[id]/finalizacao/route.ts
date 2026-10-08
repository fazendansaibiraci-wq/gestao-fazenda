import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Confirma ou recusa o "Finalizei esta atividade neste talhão" que o
// funcionário marcou no lançamento (Relatório Semanal).
//   POST { acao: 'confirmar' | 'recusar' }
// Confirmar: grava o EncerramentoAtividadeTalhao (data = dia do lançamento)
// e marca como CONFIRMADA este e os outros pendentes da mesma atividade ×
// talhão × safra. Recusar: marca só este como RECUSADA.

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { acao } = await request.json()
    if (acao !== 'confirmar' && acao !== 'recusar') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const registro = await prisma.registroAtividade.findUnique({
      where: { id: params.id },
      select: { id: true, data: true, tipoAtividade: true, talhaoId: true, safraId: true, finalizacaoStatus: true },
    })
    if (!registro) return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
    if (!registro.finalizacaoStatus) {
      return NextResponse.json({ error: 'Este lançamento não foi marcado como finalizado' }, { status: 400 })
    }

    if (acao === 'recusar') {
      await prisma.registroAtividade.update({ where: { id: registro.id }, data: { finalizacaoStatus: 'RECUSADA' } })
      return NextResponse.json({ success: true })
    }

    if (!registro.talhaoId) {
      return NextResponse.json({ error: 'Lançamento sem talhão' }, { status: 400 })
    }
    const { tipoAtividade, talhaoId, safraId } = registro

    await prisma.$transaction([
      prisma.encerramentoAtividadeTalhao.upsert({
        where: { tipoAtividade_talhaoId_safraId: { tipoAtividade, talhaoId, safraId } },
        create: { tipoAtividade, talhaoId, safraId, dataFim: registro.data, encerradoPorId: session.user?.id as string },
        update: { dataFim: registro.data, encerradoPorId: session.user?.id as string },
      }),
      prisma.registroAtividade.updateMany({
        where: { tipoAtividade, talhaoId, safraId, finalizacaoStatus: 'PENDENTE' },
        data: { finalizacaoStatus: 'CONFIRMADA' },
      }),
      prisma.registroAtividade.update({ where: { id: registro.id }, data: { finalizacaoStatus: 'CONFIRMADA' } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/registros-atividade/[id]/finalizacao:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
