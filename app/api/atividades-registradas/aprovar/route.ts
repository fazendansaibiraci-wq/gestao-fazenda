import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Aprova (ou desfaz a aprovação de) registros de atividade para o
// Relatório por Atividade.  POST { ids: string[], aprovar: boolean }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((i: unknown) => typeof i === 'string') : []
    if (ids.length === 0) return NextResponse.json({ error: 'Nenhum registro selecionado' }, { status: 400 })
    if (ids.length > 2000) return NextResponse.json({ error: 'Registros demais de uma vez' }, { status: 400 })
    const aprovar = body?.aprovar !== false

    const resultado = await prisma.registroAtividade.updateMany({
      where: { id: { in: ids } },
      data: aprovar
        ? { aprovadoAtividadeEm: new Date(), aprovadoAtividadePorId: session.user?.id as string }
        : { aprovadoAtividadeEm: null, aprovadoAtividadePorId: null },
    })

    return NextResponse.json({ success: true, atualizados: resultado.count })
  } catch (error) {
    console.error('POST /api/atividades-registradas/aprovar:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
