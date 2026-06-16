import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { loteId, pesoKg, nfTransporte, armazemDestino, numerosPesagem, responsavelId } = body

    if (!loteId || pesoKg === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: loteId, pesoKg' },
        { status: 400 }
      )
    }

    // Validar que o lote está em SILO
    const lote = await prisma.lote.findUnique({ where: { id: loteId } })
    if (!lote || lote.statusAtual !== 'SILO') {
      return NextResponse.json(
        { error: 'Lote deve estar em SILO para sair para Armazém' },
        { status: 400 }
      )
    }

    // Calcular quantidade de sacas (60 kg cada)
    const quantidadeSacas = pesoKg / 60

    // Criar registro de EtapaArmazem
    const etapaArmazem = await prisma.etapaArmazem.create({
      data: {
        loteId,
        pesoKg: parseFloat(pesoKg),
        quantidadeSacas,
        dataSaida: new Date(),
        nfTransporte: nfTransporte || undefined,
        armazemDestino: armazemDestino || undefined,
        numerosPesagem: numerosPesagem || undefined,
        responsavelId,
      },
    })

    // Atualizar status do lote para ARMAZEM
    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: {
        statusAtual: 'ARMAZEM',
        ultimaAtualizacao: new Date(),
      },
      include: { chegadas: true },
    })

    return NextResponse.json(
      {
        success: true,
        data: { lote: loteAtualizado, etapa: etapaArmazem },
        message: `Lote ${lote.identificador} saído para Armazém (${quantidadeSacas.toFixed(1)} sacas)`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/etapas/armazem:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const loteId = searchParams.get('loteId')

    let where: any = {}
    if (loteId) where.loteId = loteId

    const etapas = await prisma.etapaArmazem.findMany({
      where,
      include: { lote: true, responsavel: true },
      orderBy: { dataSaida: 'desc' },
    })

    return NextResponse.json({ success: true, data: etapas })
  } catch (error) {
    console.error('GET /api/etapas/armazem:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
