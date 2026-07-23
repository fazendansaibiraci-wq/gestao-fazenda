import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const produtoDiesel = await prisma.produto.findFirst({
      where: { nomeComercial: { contains: 'DIESEL', mode: 'insensitive' } },
    })

    const entradasAntigas = await prisma.entradaDiesel.findMany()
    const totalEntradasAntigas = entradasAntigas.reduce((acc, e) => acc + e.litrosRecebidos, 0)
    const custoEntradasAntigas = entradasAntigas.reduce((acc, e) => acc + (e.custoTotal || 0), 0)

    const entradasNovas = produtoDiesel
      ? await prisma.entradaProduto.findMany({ where: { produtoId: produtoDiesel.id } })
      : []
    const totalEntradasNovas = entradasNovas.reduce((acc, e) => acc + e.quantidade, 0)
    const custoEntradasNovas = entradasNovas.reduce((acc, e) => acc + e.quantidade * e.valorUnitario, 0)

    const totalEntradas = totalEntradasAntigas + totalEntradasNovas
    const custoTotalEntradas = custoEntradasAntigas + custoEntradasNovas
    const custoMedioLitro = totalEntradas > 0 ? custoTotalEntradas / totalEntradas : 0

    const abastecimentos = await prisma.abastecimentoTrator.findMany()
    const totalAbastecimentos = abastecimentos.reduce((acc, a) => acc + a.litrosAbastecidos, 0)
    const custoTotalConsumo = abastecimentos.reduce((acc, a) => acc + (a.custoAbastecimento || 0), 0)
    const totalHoras = abastecimentos.reduce((acc, a) => acc + (a.horasTrabalhadad || 0), 0)
    const custoMedioHora = totalHoras > 0 ? custoTotalConsumo / totalHoras : 0

    const estoqueTeorico = produtoDiesel
      ? produtoDiesel.quantidadeEstoque
      : totalEntradas - totalAbastecimentos

    const ultimaConferencia = await prisma.conferenciaEstoque.findFirst({
      orderBy: { data: 'desc' },
    })

    const estoqueFisico = ultimaConferencia?.estoqueFisico || estoqueTeorico
    const diferenca = estoqueFisico - estoqueTeorico
    const percentualDif = estoqueTeorico > 0 ? (Math.abs(diferenca) / estoqueTeorico) * 100 : 0
    const alerta = percentualDif > 2

    return NextResponse.json({
      success: true,
      data: {
        estoqueTeorico,
        estoqueFisico,
        diferenca,
        percentualDif,
        alerta,
        custoMedioLitro,
        custoMedioHora,
        custoTotalConsumo,
        custoTotalEntradas,
        totalEntradas,
        totalAbastecimentos,
        totalHoras,
      },
    })
  } catch (error) {
    console.error('GET /api/painel-estoque:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
