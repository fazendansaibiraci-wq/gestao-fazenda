import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { lotePrincipal, loteSecundario, tulhaId, responsavelId } = body

    if (!lotePrincipal || !loteSecundario || tulhaId === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: lotePrincipal, loteSecundario, tulhaId' },
        { status: 400 }
      )
    }

    // Buscar os lotes usando identificador
    const lote1 = await prisma.lote.findUnique({ where: { id: lotePrincipal } })
    let lote2 = await prisma.lote.findUnique({ where: { id: loteSecundario } })

    if (!lote2) {
      // Tentar buscar por identificador
      lote2 = await prisma.lote.findFirst({
        where: { identificador: loteSecundario },
      })
    }

    if (!lote1 || !lote2) {
      return NextResponse.json({ error: 'Um ou ambos os lotes não encontrados' }, { status: 404 })
    }

    if (lote1.statusAtual !== 'TULHA' || lote2.statusAtual !== 'TULHA') {
      return NextResponse.json(
        { error: 'Ambos os lotes devem estar em TULHA para fusão' },
        { status: 400 }
      )
    }

    // Registrar fusão
    const fusao = await prisma.fusaoTulha.create({
      data: {
        lotePrincipalId: lote1.id,
        loteSecundarioId: lote2.id,
        tulhaId,
        quantidadeTotal: lote1.quantidadeTotal + lote2.quantidadeTotal,
        dataFusao: new Date(),
        realizadoPor: responsavelId,
      },
    })

    // Atualizar lote principal (rastrear origem)
    const lotePrincipalAtualizado = await prisma.lote.update({
      where: { id: lote1.id },
      data: {
        lotesOrigem: {
          push: lote2.id,
        },
        quantidadeTotal: lote1.quantidadeTotal + lote2.quantidadeTotal,
        ultimaAtualizacao: new Date(),
      },
      include: { chegadas: true },
    })

    // Marcar lote secundário como "fundido" (mantém histórico mas não está ativo)
    await prisma.lote.update({
      where: { id: lote2.id },
      data: {
        tipoOperacao: 'FUSAO',
        lotesDestino: {
          push: lote1.id,
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          fusao,
          lotePrincipal: lotePrincipalAtualizado,
          message: `Lotes ${lote1.identificador} e ${lote2.identificador} fundidos na Tulha ${tulhaId}`,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/etapas/tulha/fusao:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const tulhaId = searchParams.get('tulhaId')

    let where: any = {}
    if (tulhaId) where.tulhaId = parseInt(tulhaId)

    const fusoes = await prisma.fusaoTulha.findMany({
      where,
      include: {
        lotePrincipal: true,
        loteSecundario: true,
        responsavel: true,
      },
      orderBy: { dataFusao: 'desc' },
    })

    return NextResponse.json({ success: true, data: fusoes })
  } catch (error) {
    console.error('GET /api/etapas/tulha/fusao:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
