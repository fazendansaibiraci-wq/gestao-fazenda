import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Validar permissão (apenas GERENTE ou GESTOR)
    if (session.user?.role !== 'GERENTE' && session.user?.role !== 'GESTOR') {
      return NextResponse.json(
        { error: 'Apenas Gerentes e Gestores podem classificar' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      loteId,
      peneira17Plus,
      peneira16,
      peneira15,
      moca10,
      peneira13,
      catacao,
      fundo,
      pontuacaoBebida,
      umidadeFinal,
      responsavelId,
    } = body

    if (!loteId) {
      return NextResponse.json({ error: 'Campos obrigatórios: loteId' }, { status: 400 })
    }

    // Validar que a soma das peneiras é 100%
    const soma =
      (peneira17Plus || 0) +
      (peneira16 || 0) +
      (peneira15 || 0) +
      (moca10 || 0) +
      (peneira13 || 0) +
      (catacao || 0) +
      (fundo || 0)

    if (Math.abs(soma - 100) > 0.01) {
      return NextResponse.json(
        { error: `Soma das peneiras deve ser 100%, obtive ${soma.toFixed(2)}%` },
        { status: 400 }
      )
    }

    // Validar que o lote está em CLASSIFICACAO
    const lote = await prisma.lote.findUnique({ where: { id: loteId } })
    if (!lote || lote.statusAtual !== 'CLASSIFICACAO') {
      return NextResponse.json(
        { error: 'Lote deve estar em CLASSIFICACAO' },
        { status: 400 }
      )
    }

    // Criar registro de EtapaClassificacao
    const etapaClassificacao = await prisma.etapaClassificacao.create({
      data: {
        loteId,
        peneira17Plus: parseFloat(peneira17Plus) || 0,
        peneira16: parseFloat(peneira16) || 0,
        peneira15: parseFloat(peneira15) || 0,
        moca10: parseFloat(moca10) || 0,
        peneira13: parseFloat(peneira13) || 0,
        catacao: parseFloat(catacao) || 0,
        fundo: parseFloat(fundo) || 0,
        pontuacaoBebida: parseFloat(pontuacaoBebida) || 0,
        umidadeFinal: parseFloat(umidadeFinal) || 11,
        dataClassificacao: new Date(),
        responsavelId,
      },
    })

    // Atualizar status do lote para SILO
    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: {
        statusAtual: 'SILO',
        ultimaAtualizacao: new Date(),
      },
      include: { chegadas: true },
    })

    return NextResponse.json(
      {
        success: true,
        data: { lote: loteAtualizado, etapa: etapaClassificacao },
        message: `Lote ${lote.identificador} classificado e movido para Silo`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/etapas/classificacao:', error)
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

    const etapas = await prisma.etapaClassificacao.findMany({
      where,
      include: { lote: true, responsavel: true },
      orderBy: { dataClassificacao: 'desc' },
    })

    return NextResponse.json({ success: true, data: etapas })
  } catch (error) {
    console.error('GET /api/etapas/classificacao:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
