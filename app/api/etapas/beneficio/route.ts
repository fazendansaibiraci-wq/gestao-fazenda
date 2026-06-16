import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { loteId, horaInicio, umidadeEntrada, responsavelId } = body

    if (!loteId || !horaInicio || umidadeEntrada === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: loteId, horaInicio, umidadeEntrada' },
        { status: 400 }
      )
    }

    // Validar que o lote está em TULHA
    const lote = await prisma.lote.findUnique({ where: { id: loteId } })
    if (!lote || lote.statusAtual !== 'TULHA') {
      return NextResponse.json(
        { error: 'Lote deve estar em TULHA para ir para BENEFICIO' },
        { status: 400 }
      )
    }

    // Criar registro de EtapaBeneficio
    const etapaBeneficio = await prisma.etapaBeneficio.create({
      data: {
        loteId,
        horaInicio,
        umidadeEntrada: parseFloat(umidadeEntrada),
        responsavelId,
      },
    })

    // Atualizar status do lote
    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: {
        statusAtual: 'BENEFICIO',
        ultimaAtualizacao: new Date(),
      },
      include: { chegadas: true },
    })

    return NextResponse.json(
      {
        success: true,
        data: { lote: loteAtualizado, etapa: etapaBeneficio },
        message: `Lote ${lote.identificador} movido para Benefício`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/etapas/beneficio:', error)
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

    const etapas = await prisma.etapaBeneficio.findMany({
      where,
      include: { lote: true, responsavel: true },
      orderBy: { horaInicio: 'desc' },
    })

    return NextResponse.json({ success: true, data: etapas })
  } catch (error) {
    console.error('GET /api/etapas/beneficio:', error)
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
    const { horaFim, umidadeSaida } = body

    // Buscar etapa para calcular tempo
    const etapaAntiga = await prisma.etapaBeneficio.findUnique({ where: { id } })
    if (!etapaAntiga) return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 })

    let tempoProcessamento = undefined
    if (horaFim && etapaAntiga.horaInicio) {
      const [hInicio, mInicio] = etapaAntiga.horaInicio.split(':').map(Number)
      const [hFim, mFim] = horaFim.split(':').map(Number)
      const minutos = hFim * 60 + mFim - (hInicio * 60 + mInicio)
      tempoProcessamento = minutos / 60 // em horas
    }

    const etapa = await prisma.etapaBeneficio.update({
      where: { id },
      data: {
        horaFim: horaFim || undefined,
        umidadeSaida: umidadeSaida ? parseFloat(umidadeSaida) : undefined,
        tempoProcessamento: tempoProcessamento || undefined,
      },
    })

    // Se foi finalizado, mover lote para CLASSIFICACAO
    if (horaFim) {
      await prisma.lote.update({
        where: { id: etapa.loteId },
        data: {
          statusAtual: 'CLASSIFICACAO',
          ultimaAtualizacao: new Date(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: etapa,
      message: 'Etapa Benefício finalizada, lote movido para Classificação',
    })
  } catch (error) {
    console.error('PUT /api/etapas/beneficio:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
