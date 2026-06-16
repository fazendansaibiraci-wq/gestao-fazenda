import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfToday, startOfWeek, startOfMonth, startOfDay, endOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GESTOR ou GERENTE podem acessar
    if (session.user?.role !== 'GESTOR' && session.user?.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const hoje = startOfToday()
    const inicioSemana = startOfWeek(new Date())
    const inicioMes = startOfMonth(new Date())

    // 1. Atividades do dia
    const atividadesHoje = await prisma.registroAtividade.count({
      where: {
        data: {
          gte: startOfDay(hoje),
          lte: endOfDay(hoje),
        },
      },
    })

    // 2. Horas trabalhadas esta semana
    const registrosSemanais = await prisma.registroAtividade.findMany({
      where: {
        data: {
          gte: inicioSemana,
        },
      },
      select: { horaInicio: true, horaFim: true },
    })

    const horasTotais = registrosSemanais.reduce((sum, reg) => {
      if (!reg.horaInicio || !reg.horaFim) return sum
      const [hI, mI] = reg.horaInicio.split(':').map(Number)
      const [hF, mF] = reg.horaFim.split(':').map(Number)
      const minutos = hF * 60 + mF - (hI * 60 + mI)
      return sum + minutos / 60
    }, 0)

    // 3. Horas extras pendentes
    const horasExtrasPendentes = await prisma.aProvaçãoHoraExtra.aggregate({
      where: { status: 'pendente' },
      _sum: { horasExtras: true },
    })

    // 4. Diesel atual
    const ultimoAbastecimento = await prisma.abastecimentoTrator.findFirst({
      orderBy: { data: 'desc' },
      take: 1,
    })

    let dieselAtual = 0
    if (ultimoAbastecimento) {
      // Calcular estoque teórico (simplificado)
      const consumoApos = await prisma.abastecimentoTrator.aggregate({
        where: {
          data: {
            gt: ultimoAbastecimento.data,
          },
        },
        _sum: { consumo: true },
      })

      dieselAtual = ultimoAbastecimento.quantidade - (consumoApos._sum.consumo || 0)
    }

    // 5. Banco de horas
    const bancoHoras = await prisma.bancoHoras.findMany({})
    const bancoHorasPositivo = bancoHoras
      .filter((b) => b.saldoHoras > 0)
      .reduce((sum, b) => sum + b.saldoHoras, 0)

    const bancoHorasNegativo = bancoHoras
      .filter((b) => b.saldoHoras < 0)
      .reduce((sum, b) => sum + Math.abs(b.saldoHoras), 0)

    // 6. Horas de máquina
    const horasMaquinaEstesMes = await prisma.registroAtividade.aggregate({
      where: {
        data: { gte: inicioMes },
        horimetroFinal: { not: null },
        horimetroInicial: { not: null },
      },
      _sum: { horasOperacao: true },
    })

    // 7. Lotes aguardando classificação
    const lotesAguardandoClassificacao = await prisma.lote.count({
      where: { statusAtual: 'CLASSIFICACAO' },
    })

    // 8. Aplicações de insumos este mês
    const aplicacoesRecentesMes = await prisma.aplicacaoInsumo.count({
      where: {
        dataAplicacao: { gte: inicioMes },
      },
    })

    // 9. Últimas atividades
    const ultimasAtividades = await prisma.registroAtividade.findMany({
      take: 5,
      orderBy: { data: 'desc' },
      include: { funcionario: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        atividadesHoje,
        horasTotais: horasTotais.toFixed(2),
        horasExtrasPendentes: horasExtrasPendentes._sum.horasExtras || 0,
        dieselAtual,
        bancoHorasPositivo,
        bancoHorasNegativo,
        bancoHorasLiquido: bancoHorasPositivo - bancoHorasNegativo,
        horasMaquinaEstesMes: horasMaquinaEstesMes._sum.horasOperacao || 0,
        ultimoAbastecimento,
        lotesAguardandoClassificacao,
        aplicacoesRecentesMes,
        ultimasAtividades: ultimasAtividades.map((a) => ({
          id: a.id,
          tipo: a.tipo,
          funcionario: a.funcionario?.name,
          data: a.data,
        })),
      },
    })
  } catch (error) {
    console.error('GET /api/painel/dashboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
