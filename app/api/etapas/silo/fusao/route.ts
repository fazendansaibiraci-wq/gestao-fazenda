import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { lotePrincipal, loteSecundario, siloId, responsavelId } = body

    if (!lotePrincipal || !loteSecundario || siloId === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: lotePrincipal, loteSecundario, siloId' },
        { status: 400 }
      )
    }

    // Buscar os lotes
    const lote1 = await prisma.lote.findUnique({ where: { id: lotePrincipal } })
    let lote2 = await prisma.lote.findUnique({ where: { id: loteSecundario } })

    if (!lote2) {
      lote2 = await prisma.lote.findFirst({
        where: { identificador: loteSecundario },
      })
    }

    if (!lote1 || !lote2) {
      return NextResponse.json({ error: 'Um ou ambos os lotes não encontrados' }, { status: 404 })
    }

    // Registrar fusão
    const fusao = await prisma.fusaoSilo.create({
      data: {
        lotePrincipalId: lote1.id,
        loteSecundarioId: lote2.id,
        siloId,
        quantidadeTotal: lote1.quantidadeTotal + lote2.quantidadeTotal,
        dataFusao: new Date(),
        realizadoPor: responsavelId,
      },
    })

    // Atualizar lote principal
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

    // Marcar lote secundário como "fundido"
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
          message: `Lotes ${lote1.identificador} e ${lote2.identificador} fundidos no Silo ${siloId}`,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/etapas/silo/fusao:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const siloId = searchParams.get('siloId')

    let where: any = {}
    if (siloId) where.siloId = parseInt(siloId)

    const fusoes = await prisma.fusaoSilo.findMany({
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
    console.error('GET /api/etapas/silo/fusao:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
