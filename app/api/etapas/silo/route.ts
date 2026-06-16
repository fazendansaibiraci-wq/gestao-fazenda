import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { loteId, siloId, responsavelId } = body

    if (!loteId || siloId === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: loteId, siloId' },
        { status: 400 }
      )
    }

    // Validar que o lote está em SILO
    const lote = await prisma.lote.findUnique({ where: { id: loteId } })
    if (!lote || lote.statusAtual !== 'SILO') {
      return NextResponse.json(
        { error: 'Lote deve estar em SILO' },
        { status: 400 }
      )
    }

    // Criar registro de EtapaSilo
    const etapaSilo = await prisma.etapaSilo.create({
      data: {
        loteId,
        siloId,
        dataEntrada: new Date(),
        responsavelId,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: { lote, etapa: etapaSilo },
        message: `Lote ${lote.identificador} alocado ao Silo ${siloId}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/etapas/silo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const loteId = searchParams.get('loteId')
    const siloId = searchParams.get('siloId')

    let where: any = {}
    if (loteId) where.loteId = loteId
    if (siloId) where.siloId = parseInt(siloId)

    const etapas = await prisma.etapaSilo.findMany({
      where,
      include: { lote: true, responsavel: true },
      orderBy: { dataEntrada: 'desc' },
    })

    return NextResponse.json({ success: true, data: etapas })
  } catch (error) {
    console.error('GET /api/etapas/silo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
