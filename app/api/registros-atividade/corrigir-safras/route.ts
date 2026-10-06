import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safraDaData } from '@/lib/safraPorData'

export const dynamic = 'force-dynamic'

// Corrige a safra dos lançamentos (atividades E faltas) de um período,
// usando as datas de início/fim cadastradas em Safras. Com confirmar:false
// só conta quantos mudariam (prévia); com confirmar:true grava.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    if (!body.dataInicio || !body.dataFim) {
      return NextResponse.json({ error: 'Informe data início e fim' }, { status: 400 })
    }
    const inicio = new Date(`${body.dataInicio}T00:00:00.000Z`)
    const fim = new Date(`${body.dataFim}T23:59:59.999Z`)

    const safras = await prisma.safra.findMany({ select: { id: true, nome: true, dataInicio: true, dataFim: true } })
    const registros = await prisma.registroAtividade.findMany({
      where: { data: { gte: inicio, lte: fim } },
      select: { id: true, data: true, safraId: true },
    })

    const mudancas: { id: string; safraId: string }[] = []
    for (const r of registros) {
      const certa = safraDaData(safras, r.data)
      if (certa && certa.id !== r.safraId) mudancas.push({ id: r.id, safraId: certa.id })
    }

    // Resumo por safra de destino, pra mostrar na confirmação
    const porSafra: Record<string, number> = {}
    for (const m of mudancas) {
      const nome = safras.find((s) => s.id === m.safraId)?.nome || m.safraId
      porSafra[nome] = (porSafra[nome] || 0) + 1
    }

    if (!body.confirmar) {
      return NextResponse.json({ success: true, total: mudancas.length, porSafra })
    }

    // Agrupa por safra de destino pra gravar em poucas consultas
    const idsPorSafra = new Map<string, string[]>()
    for (const m of mudancas) {
      if (!idsPorSafra.has(m.safraId)) idsPorSafra.set(m.safraId, [])
      idsPorSafra.get(m.safraId)!.push(m.id)
    }
    for (const [safraId, ids] of idsPorSafra) {
      await prisma.registroAtividade.updateMany({ where: { id: { in: ids } }, data: { safraId } })
    }
    return NextResponse.json({ success: true, total: mudancas.length, porSafra })
  } catch (error) {
    console.error('POST /api/registros-atividade/corrigir-safras:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
