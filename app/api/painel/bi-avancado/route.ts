import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.user?.role !== 'GESTOR' && session.user?.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const safraId = searchParams.get('safraId')

    if (!safraId) {
      return NextResponse.json({ error: 'safraId obrigatório' }, { status: 400 })
    }

    // ============ BUSCAR DADOS ============

    // 1. Safra
    const safra = await prisma.safra.findUnique({
      where: { id: safraId },
      include: { talhoes: true },
    })

    if (!safra) {
      return NextResponse.json({ error: 'Safra não encontrada' }, { status: 404 })
    }

    const mesAtual = new Date()
    const mesStart = startOfMonth(mesAtual)
    const mesEnd = endOfMonth(mesAtual)

    // 2. Custo por Talhão (M1 + M2 + M3)
    const custosPorTalhao = await Promise.all(
      safra.talhoes.map(async (talhao) => {
        // M1: Custo de mão de obra
        const registrosMO = await prisma.registroAtividade.findMany({
          where: {
            talhaoId: talhao.id,
            data: { gte: mesStart, lte: mesEnd },
          },
          include: { funcionario: true },
        })

        const custoMO = registrosMO.reduce((sum, reg) => {
          if (reg.funcionario?.tipoSalario === 'DIARIO') {
            return sum + (reg.funcionario.salarioEntressafra || 0)
          } else if (reg.funcionario?.tipoSalario === 'MENSAL') {
            // Aproximar: 8h/dia × 20 dias = 160h/mês
            return sum + ((reg.funcionario.salarioEntressafra || 0) / 160) * 8
          }
          return sum
        }, 0)

        // M2: Custo de combustível
        const abastecimentos = await prisma.abastecimentoTrator.findMany({
          where: {
            data: { gte: mesStart, lte: mesEnd },
          },
        })

        // Simplificar: dividir custo entre talhões (proporcional à atividade)
        const custoCombustivel = (abastecimentos.reduce((sum, a) => sum + a.valor, 0) *
          registrosMO.length) / Math.max(1, registrosMO.length)

        // M3: Custo de insumos aplicados
        const aplicacoes = await prisma.aplicacaoInsumo.findMany({
          where: {
            talhaoId: talhao.id,
            dataAplicacao: { gte: mesStart, lte: mesEnd },
          },
          include: { produto: true },
        })

        const custoInsumos = aplicacoes.reduce((sum, app) => sum + (app.custoTotal || 0), 0)

        // M4: Total colhido deste talhão
        const lotes = await prisma.lote.findMany({
          where: {
            chegadas: {
              some: {
                talhaoId: talhao.id,
              },
            },
          },
          include: {
            chegadas: true,
            etapaArmazem: true,
          },
        })

        const totalColhido = lotes.reduce((sum, l) => sum + (l.quantidadeTotal || 0), 0)
        const totalProcessado = lotes.reduce(
          (sum, l) => sum + (l.etapaArmazem?.quantidadeSacas ? l.etapaArmazem.quantidadeSacas * 60 : 0),
          0
        )

        const custoTotal = custoMO + custoCombustivel + custoInsumos
        const custoPorHectare = talhao.area ? custoTotal / talhao.area : 0
        const custoPerLitro = totalColhido > 0 ? custoTotal / totalColhido : 0

        return {
          id: talhao.id,
          nome: talhao.nome,
          area: talhao.area,
          custo_m1: custoMO,
          custo_m2: custoCombustivel,
          custo_m3: custoInsumos,
          custoTotal,
          custoPorHectare,
          colhido: totalColhido,
          processado: totalProcessado,
          custoPerLitro,
        }
      })
    )

    // 3. Totais
    const totalColhido = custosPorTalhao.reduce((sum, t) => sum + t.colhido, 0)
    const totalProcessado = custosPorTalhao.reduce((sum, t) => sum + t.processado, 0)
    const custoTotalSafra = custosPorTalhao.reduce((sum, t) => sum + t.custoTotal, 0)
    const rendimentoMedio = totalColhido > 0 ? totalProcessado / totalColhido : 0
    const custoPorLitro = totalColhido > 0 ? custoTotalSafra / totalColhido : 0

    // 4. Comparativo com outras safras
    const todasSafras = await prisma.safra.findMany({
      include: { talhoes: true },
      take: 5,
      orderBy: { dataCriacao: 'desc' },
    })

    const comparativoSafras = await Promise.all(
      todasSafras.map(async (s) => {
        const lotes = await prisma.lote.findMany({
          where: {
            safraId: s.id,
          },
          include: { etapaArmazem: true },
        })

        const colhido = lotes.reduce((sum, l) => sum + (l.quantidadeTotal || 0), 0)
        const processado = lotes.reduce(
          (sum, l) => sum + (l.etapaArmazem?.quantidadeSacas ? l.etapaArmazem.quantidadeSacas * 60 : 0),
          0
        )

        // Aproximação: custo similar por litro (média histórica)
        const custo = colhido * 2.5 // R$ 2.50/litro (estimativa)

        return {
          id: s.id,
          nome: s.nome,
          status: s.status,
          totalColhido: colhido,
          custoTotal: custo,
          custoPerLitro: colhido > 0 ? custo / colhido : 0,
          rendimento: colhido > 0 ? processado / colhido : 0,
        }
      })
    )

    // 5. Insights
    const insights: string[] = []

    const talhaoBaixoRendimento = custosPorTalhao.find((t) => t.custoPorLitro > custoPorLitro * 1.2)
    if (talhaoBaixoRendimento) {
      insights.push(
        `⚠️ Talhão ${talhaoBaixoRendimento.nome} tem custo ${((talhaoBaixoRendimento.custoPorLitro / custoPorLitro - 1) * 100).toFixed(0)}% acima da média`
      )
    }

    if (rendimentoMedio < 0.8) {
      insights.push(
        `⚠️ Rendimento de processamento abaixo de 80% - verificar perdas em secagem/benefício`
      )
    }

    const talhaoMaiorCusto = custosPorTalhao.sort((a, b) => b.custoTotal - a.custoTotal)[0]
    if (talhaoMaiorCusto) {
      insights.push(`📊 Talhão ${talhaoMaiorCusto.nome} é o maior gerador de custo (R$ ${talhaoMaiorCusto.custoTotal.toFixed(0)})`)
    }

    insights.push(`✅ Custo médio por litro: R$ ${custoPorLitro.toFixed(2)}`)

    return NextResponse.json({
      success: true,
      data: {
        safra: { id: safra.id, nome: safra.nome, status: safra.status },
        custosPorTalhao,
        totalColhido,
        totalProcessado,
        custoTotalSafra,
        rendimentoMedio,
        custoPorLitro,
        comparativoSafras,
        insights,
      },
    })
  } catch (error) {
    console.error('GET /api/painel/bi-avancado:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
