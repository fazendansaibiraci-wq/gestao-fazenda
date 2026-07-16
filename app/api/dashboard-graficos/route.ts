import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularTotaisHoras } from '@/lib/calculoTotaisFuncionario'
import { calcularCombustivelPorMaquina } from '@/lib/calculoCombustivelPorMaquina'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59)

    // ─── Consumo de Combustível por Máquina (L/h) ─────────────────────────
    const abastecimentosMes = await prisma.abastecimentoTrator.findMany({
      where: {
        data: { gte: inicioMes, lte: fimMes },
      },
      include: {
        maquina: true,
      },
    })

    const consumoPorMaquina = calcularCombustivelPorMaquina(abastecimentosMes)
      .map((m) => ({ maquina: m.nomeMaquina, consumoMedioLH: m.consumoMedioLH }))
      .sort((a, b) => b.consumoMedioLH - a.consumoMedioLH)

    // ─── Horas Trabalhadas por Funcionário ─────────────────────────────────
    const funcionariosAtivos = await prisma.user.findMany({
      where: {
        active: true,
        role: { in: ['FUNCIONARIO', 'GERENTE', 'AGRONOMO'] },
      },
      select: { id: true, name: true },
    })

    const registrosParaHoras = await prisma.registroAtividade.findMany({
      where: {
        data: { gte: inicioMes, lte: fimMes },
      },
      select: {
        id: true,
        funcionarioId: true,
        data: true,
        horaEntrada: true,
        horaSaida: true,
        horasCalculadas: true,
        horasprevistasdia: true,
        isFalta: true,
      },
    })

    const horasPorFuncionario = funcionariosAtivos
      .map((func) => {
        const registrosFuncionario = registrosParaHoras.filter((r) => r.funcionarioId === func.id)
        const { totalHorasTrabalhadas } = calcularTotaisHoras(registrosFuncionario)
        return { funcionario: func.name, totalHoras: totalHorasTrabalhadas }
      })
      .filter((f) => f.totalHoras > 0)
      .sort((a, b) => b.totalHoras - a.totalHoras)
      .slice(0, 10)

    // ─── Litros de Diesel por Dia ──────────────────────────────────────
    const litrosPorDiaMap = new Map<string, number>()
    abastecimentosMes.forEach((a) => {
      const chaveData = new Date(a.data).toISOString().split('T')[0]
      const litros = a.litrosAbastecidos || 0
      litrosPorDiaMap.set(chaveData, (litrosPorDiaMap.get(chaveData) || 0) + litros)
    })

    const litrosDieselPorDia = Array.from(litrosPorDiaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chaveData, litros]) => {
        const [, mes, dia] = chaveData.split('-')
        return { dia: `${dia}/${mes}`, litros }
      })

    return NextResponse.json({
      success: true,
      data: {
        consumoPorMaquina,
        horasPorFuncionario,
        litrosDieselPorDia,
      },
    })
  } catch (error) {
    console.error('GET /api/dashboard-graficos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
