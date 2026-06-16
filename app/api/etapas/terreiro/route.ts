import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    const { loteId, umidadeEntrada, dataEntrada, responsavelId } = body

    if (!loteId || umidadeEntrada === undefined || !dataEntrada) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: loteId, umidadeEntrada, dataEntrada' },
        { status: 400 }
      )
    }

    // Validar que o lote está em COLHEITA
    const lote = await prisma.lote.findUnique({ where: { id: loteId } })
    if (!lote || lote.statusAtual !== 'COLHEITA') {
      return NextResponse.json(
        { error: 'Lote deve estar em COLHEITA para ir para TERREIRO' },
        { status: 400 }
      )
    }

    // Criar registro de EtapaTerreiro
    const etapaTerreiro = await prisma.etapaTerreiro.create({
      data: {
        loteId,
        umidadeEntrada: parseFloat(umidadeEntrada),
        dataEntrada: new Date(dataEntrada),
        responsavelId,
      },
    })

    // Atualizar status do lote
    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: {
        statusAtual: 'TERREIRO',
        ultimaAtualizacao: new Date(),
      },
      include: { chegadas: true },
    })

    return NextResponse.json(
      {
        success: true,
        data: { lote: loteAtualizado, etapa: etapaTerreiro },
        message: `Lote ${lote.identificador} movido para Terreiro`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/etapas/terreiro:', error)
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

    const etapas = await prisma.etapaTerreiro.findMany({
      where,
      include: { lote: true, responsavel: true },
      orderBy: { dataEntrada: 'desc' },
    })

    return NextResponse.json({ success: true, data: etapas })
  } catch (error) {
    console.error('GET /api/etapas/terreiro:', error)
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
    const { umidadeSaida, dataSaida } = body

    const etapa = await prisma.etapaTerreiro.update({
      where: { id },
      data: {
        umidadeSaida: umidadeSaida ? parseFloat(umidadeSaida) : undefined,
        dataSaida: dataSaida ? new Date(dataSaida) : undefined,
      },
    })

    return NextResponse.json({
      success: true,
      data: etapa,
      message: 'Etapa Terreiro atualizada',
    })
  } catch (error) {
    console.error('PUT /api/etapas/terreiro:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
