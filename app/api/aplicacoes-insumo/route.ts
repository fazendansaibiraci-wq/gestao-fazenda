import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const aplicacoes = await prisma.aplicacaoInsumo.findMany({
      include: {
        receita: true,
        talhao: true,
        safra: true,
        realizadoPor: { select: { name: true } },
      },
      orderBy: { data: 'desc' },
    })

    return NextResponse.json({ success: true, data: aplicacoes })
  } catch (error) {
    console.error('GET /api/aplicacoes-insumo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.receitaId || !body.talhaoId || !body.safraId || !body.data || body.quantidade === undefined) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    // Obter receita e talhão para cálculos
    const receita = await prisma.receitaBase.findUnique({
      where: { id: body.receitaId },
      include: { produtosReceita: { include: { produto: true } } },
    })

    const talhao = await prisma.talhao.findUnique({
      where: { id: body.talhaoId },
    })

    if (!receita || !talhao) {
      return NextResponse.json({ error: 'Receita ou talhão não encontrado' }, { status: 404 })
    }

    // Calcular custos
    let quantidadeTotalPorProduto = 0
    let custoPorProduto = 0
    let custoTotal = 0

    receita.produtosReceita?.forEach((pr: any) => {
      const qtd = pr.doseUnidade * body.quantidade
      const custo = qtd * pr.produto.valorUnitario
      custoTotal += custo
    })

    const custoPorHectare = talhao.area > 0 ? custoTotal / talhao.area : 0
    const produtividadeHaHora = body.horasMaquina ? talhao.area / body.horasMaquina : null

    const aplicacao = await prisma.aplicacaoInsumo.create({
      data: {
        receitaId: body.receitaId,
        talhaoId: body.talhaoId,
        safraId: body.safraId,
        data: new Date(body.data),
        quantidade: body.quantidade,
        quantidadeTotalPorProduto,
        custoPorProduto,
        custoTotal,
        custoPorHectare,
        produtividadeHaHora,
        observacao: body.observacao,
        realizadoPorId: session.user?.id as string,
      },
      include: {
        receita: true,
        talhao: true,
        safra: true,
      },
    })

    // Registrar no histórico
    await prisma.historicoAplicacao.create({
      data: {
        talhaoId: body.talhaoId,
        safraId: body.safraId,
        sequencia: 1, // TODO: incrementar baseado em aplicações anteriores
        tipoAtividade: receita.atividade,
        data: new Date(body.data),
        receita: receita.nome,
        perfilTalhaoNaData: receita.perfilTalhao,
        custoTotal,
        custoPorHectare,
      },
    })

    return NextResponse.json(
      { success: true, data: aplicacao, message: 'Aplicação registrada' },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/aplicacoes-insumo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
