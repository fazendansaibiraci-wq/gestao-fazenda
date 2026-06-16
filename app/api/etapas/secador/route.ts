import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { loteId, secadorId, umidadeEntrada, horaEntrada, responsavelId } = body

    if (!loteId || secadorId === undefined || umidadeEntrada === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: loteId, secadorId, umidadeEntrada' },
        { status: 400 }
      )
    }

    // Validar que o lote está em TERREIRO
    const lote = await prisma.lote.findUnique({ where: { id: loteId } })
    if (!lote || lote.statusAtual !== 'TERREIRO') {
      return NextResponse.json(
        { error: 'Lote deve estar em TERREIRO para ir para SECADOR' },
        { status: 400 }
      )
    }

    // Validar capacidade do secador (38.000 L máximo)
    const secadorLoading = await prisma.etapaSecador.aggregate({
      where: {
        secadorId,
        horaSaida: null, // Apenas lotes ainda no secador
      },
      _sum: { quantidadeLitros: true },
    })

    const usedCapacity = secadorLoading._sum.quantidadeLitros || 0
    if (usedCapacity + lote.quantidadeTotal > 38000) {
      return NextResponse.json(
        { error: `Secador ${secadorId} não tem capacidade. Usado: ${usedCapacity}L, Novo: ${lote.quantidadeTotal}L` },
        { status: 400 }
      )
    }

    // Criar registro de EtapaSecador
    const etapaSecador = await prisma.etapaSecador.create({
      data: {
        loteId,
        secadorId,
        quantidadeLitros: lote.quantidadeTotal,
        umidadeEntrada: parseFloat(umidadeEntrada),
        horaEntrada: horaEntrada || new Date().toISOString().substring(11, 16),
        responsavelId,
      },
    })

    // Atualizar status do lote
    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: {
        statusAtual: 'SECADOR',
        ultimaAtualizacao: new Date(),
      },
      include: { chegadas: true },
    })

    return NextResponse.json(
      {
        success: true,
        data: { lote: loteAtualizado, etapa: etapaSecador },
        message: `Lote ${lote.identificador} movido para Secador ${secadorId}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/etapas/secador:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const loteId = searchParams.get('loteId')
    const secadorId = searchParams.get('secadorId')

    let where: any = {}
    if (loteId) where.loteId = loteId
    if (secadorId) where.secadorId = parseInt(secadorId)

    const etapas = await prisma.etapaSecador.findMany({
      where,
      include: { lote: true, responsavel: true },
      orderBy: { horaEntrada: 'desc' },
    })

    return NextResponse.json({ success: true, data: etapas })
  } catch (error) {
    console.error('GET /api/etapas/secador:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const body = await request.json()
    const { umidadeSaida, horaSaida } = body

    // Calcular tempo de secagem (horas)
    const etapaAntiga = await prisma.etapaSecador.findUnique({ where: { id } })
    if (!etapaAntiga) return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 })

    let tempoSecagem = undefined
    if (horaSaida && etapaAntiga.horaEntrada) {
      const [hEntrada, mEntrada] = etapaAntiga.horaEntrada.split(':').map(Number)
      const [hSaida, mSaida] = horaSaida.split(':').map(Number)
      const minutos = hSaida * 60 + mSaida - (hEntrada * 60 + mEntrada)
      tempoSecagem = minutos / 60 // em horas
    }

    const etapa = await prisma.etapaSecador.update({
      where: { id },
      data: {
        umidadeSaida: umidadeSaida ? parseFloat(umidadeSaida) : undefined,
        horaSaida: horaSaida || undefined,
        tempoSecagem: tempoSecagem || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      data: etapa,
      message: 'Etapa Secador atualizada',
    })
  } catch (error) {
    console.error('PUT /api/etapas/secador:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
