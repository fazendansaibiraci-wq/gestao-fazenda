import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularCombustivelPorMaquina } from '@/lib/calculoCombustivelPorMaquina'

// Esta API expõe SOMENTE totais agregados por talhão (custoHHPorHa / custoHMPorHa).
// O cálculo intermediário usa o salário individual de cada funcionário (Valor HH),
// que é informação sensível — por isso é feito inteiramente aqui no servidor, e
// nenhum salário, Valor HH por pessoa ou Valor HM por máquina isolado é retornado.

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    const dataFilter: any = {}
    if (dataInicio) dataFilter.gte = new Date(dataInicio)
    if (dataFim) dataFilter.lte = new Date(dataFim)

    const config = await prisma.configuracaoGlobal.findFirst()

    // Registros do período (não-falta), com os dados necessários do
    // funcionário e da máquina envolvidos, e o talhão (nome + área).
    const registros = await prisma.registroAtividade.findMany({
      where: {
        isFalta: false,
        ...(Object.keys(dataFilter).length > 0 ? { data: dataFilter } : {}),
      },
      select: {
        talhaoId: true,
        funcionarioId: true,
        maquinaId: true,
        horasCalculadas: true,
        horasMaquina: true,
        talhao: { select: { nome: true, area: true } },
        funcionario: { select: { tipoSalario: true, salarioSafra: true, salarioEntressafra: true } },
        maquina: { select: { valor: true, valorResidual: true, vidaUtilHoras: true } },
      },
    })

    if (registros.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Data de referência pra determinar se está na safra: o meio do período
    // filtrado (mesma ideia do resumo-mensal, que usa o meio do mês), ou hoje
    // quando não há período definido.
    let dataReferenciaSafra = new Date()
    if (dataInicio && dataFim) {
      const inicio = new Date(dataInicio)
      const fim = new Date(dataFim)
      dataReferenciaSafra = new Date((inicio.getTime() + fim.getTime()) / 2)
    }

    let estaNaSafra = false
    if (config?.inicioSafra && config?.fimSafra) {
      estaNaSafra = dataReferenciaSafra >= new Date(config.inicioSafra) && dataReferenciaSafra <= new Date(config.fimSafra)
    }

    // Valor HH por funcionário — mesma fórmula usada em app/api/resumo-mensal/route.ts.
    const calcularValorHH = (func: { tipoSalario: string | null; salarioSafra: number | null; salarioEntressafra: number | null }) => {
      const salarioBase = estaNaSafra ? (func.salarioSafra || 0) : (func.salarioEntressafra || 0)
      return func.tipoSalario === 'DIARIO'
        ? salarioBase / (config?.cargaHorariaEntressafra || 8)
        : salarioBase / 220
    }

    // Consumo médio (L/h) e valor médio por litro históricos de cada máquina
    // envolvida, a partir de TODOS os abastecimentos já registrados dela (não
    // só do período filtrado), reaproveitando a função já usada no relatório
    // de Combustível.
    const maquinaIds = Array.from(
      new Set(registros.map((r) => r.maquinaId).filter((id): id is string => !!id))
    )

    const abastecimentos = maquinaIds.length > 0
      ? await prisma.abastecimentoTrator.findMany({
          where: { maquinaId: { in: maquinaIds } },
          select: {
            maquinaId: true,
            data: true,
            horasTrabalhadad: true,
            litrosAbastecidos: true,
            custoAbastecimento: true,
            valorPorLitro: true,
          },
        })
      : []

    const resumoCombustivelPorMaquina = calcularCombustivelPorMaquina(abastecimentos)
    const combustivelPorMaquina = new Map(resumoCombustivelPorMaquina.map((r) => [r.maquinaId, r]))

    // Valor HM por máquina: depreciação/hora (sem custo de manutenção, por
    // enquanto) + combustível/hora (consumo médio histórico × valor médio
    // por litro histórico).
    const valorHMPorMaquina = new Map<string, number>()
    for (const maquinaId of maquinaIds) {
      const registroComMaquina = registros.find((r) => r.maquinaId === maquinaId)
      const maquina = registroComMaquina?.maquina
      const resumoCombustivel = combustivelPorMaquina.get(maquinaId)

      const depreciacaoPorHora =
        maquina?.valor != null && maquina?.valorResidual != null && maquina?.vidaUtilHoras
          ? (maquina.valor - maquina.valorResidual) / maquina.vidaUtilHoras
          : 0

      const totalLitros = resumoCombustivel?.totalLitros || 0
      const consumoMedioLH = resumoCombustivel?.consumoMedioLH || 0
      const valorMedioPorLitro = totalLitros > 0 ? (resumoCombustivel!.custoTotal / totalLitros) : 0
      const combustivelPorHora = consumoMedioLH * valorMedioPorLitro

      valorHMPorMaquina.set(maquinaId, depreciacaoPorHora + combustivelPorHora)
    }

    // Agrupa por talhão, somando Custo HH e Custo HM.
    const acumuladorPorTalhao = new Map<string, { nomeTalhao: string; area: number | null; custoHH: number; custoHM: number }>()

    for (const r of registros) {
      if (!acumuladorPorTalhao.has(r.talhaoId)) {
        acumuladorPorTalhao.set(r.talhaoId, {
          nomeTalhao: r.talhao?.nome || r.talhaoId,
          area: r.talhao?.area ?? null,
          custoHH: 0,
          custoHM: 0,
        })
      }
      const acumulado = acumuladorPorTalhao.get(r.talhaoId)!

      if (r.funcionario) {
        const valorHH = calcularValorHH(r.funcionario)
        acumulado.custoHH += (r.horasCalculadas || 0) * valorHH
      }

      if (r.maquinaId) {
        const valorHM = valorHMPorMaquina.get(r.maquinaId) || 0
        acumulado.custoHM += (r.horasMaquina || 0) * valorHM
      }
    }

    const resultado = Array.from(acumuladorPorTalhao.entries()).map(([talhaoId, dados]) => ({
      talhaoId,
      nomeTalhao: dados.nomeTalhao,
      custoHHPorHa: dados.area && dados.area > 0 ? dados.custoHH / dados.area : null,
      custoHMPorHa: dados.area && dados.area > 0 ? dados.custoHM / dados.area : null,
    }))

    return NextResponse.json({ success: true, data: resultado })
  } catch (error) {
    console.error('GET /api/relatorios/custo-hh-hm:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
