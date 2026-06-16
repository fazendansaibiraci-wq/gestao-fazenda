import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { loteId, tulhaId, responsavelId } = body

    if (!loteId || tulhaId === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: loteId, tulhaId' },
        { status: 400 }
      )
    }

    // Validar que o lote está em SECADOR
    const lote = await prisma.lote.findUnique({ where: { id: loteId } })
    if (!lote || lote.statusAtual !== 'SECADOR') {
      return NextResponse.json(
        { error: 'Lote deve estar em SECADOR para ir para TULHA' },
        { status: 400 }
      )
    }

    // Validar capacidade da tulha (76.000 L máximo)
    const tulhaLoading = await prisma.etapaTulha.aggregate({
      where: {
        tulhaId,
        dataSaida: null, // Apenas lotes ainda na tulha
      },
      _sum: { quantidadeLitros: true },
    })

    const usedCapacity = tulhaLoading._sum.quantidadeLitros || 0
    if (usedCapacity + lote.quantidadeTotal > 76000) {
      return NextResponse.json(
        { error: `Tulha ${tulhaId} não tem capacidade` },
        { status: 400 }
      )
    }

    // Criar registro de EtapaTulha
    const etapaTulha = await prisma.etapaTulha.create({
      data: {
        loteId,
        tulhaId,
        quantidadeLitros: lote.quantidadeTotal,
        dataEntrada: new Date(),
        responsavelId,
      },
    })

    // Atualizar status do lote
    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: {
        statusAtual: 'TULHA',
        ultimaAtualizacao: new Date(),
      },
      include: { chegadas: true },
    })

    return NextResponse.json(
      {
        success: true,
        data: { lote: loteAtualizado, etapa: etapaTulha },
        message: `Lote ${lote.identificador} movido para Tulha ${tulhaId}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/etapas/tulha:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const loteId = searchParams.get('loteId')
    const tulhaId = searchParams.get('tulhaId')

    let where: any = {}
    if (loteId) where.loteId = loteId
    if (tulhaId) where.tulhaId = parseInt(tulhaId)

    const etapas = await prisma.etapaTulha.findMany({
      where,
      include: { lote: true, responsavel: true },
      orderBy: { dataEntrada: 'desc' },
    })

    return NextResponse.json({ success: true, data: etapas })
  } catch (error) {
    console.error('GET /api/etapas/tulha:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
