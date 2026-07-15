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

    // ─── Atividades por Talhão ────────────────────────────────────────────
    const registrosAtividadeMes = await prisma.registroAtividade.findMany({
      where: {
        data: { gte: inicioMes, lte: fimMes },
        isFalta: false,
      },
      include: {
        talhao: true,
      },
    })

    const contagemPorTalhao: Record<string, number> = {}
    registrosAtividadeMes.forEach((r) => {
      const nomeTalhao = r.talhao?.nome || 'Sem talhão'
      contagemPorTalhao[nomeTalhao] = (contagemPorTalhao[nomeTalhao] || 0) + 1
    })

    const atividadesPorTalhao = Object.entries(contagemPorTalhao)
      .map(([talhao, quantidade]) => ({ talhao, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)

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

    // ─── Custo de Diesel por Dia ────────────────────────────────────────
    const custoPorDiaMap = new Map<string, number>()
    abastecimentosMes.forEach((a) => {
      const chaveData = new Date(a.data).toISOString().split('T')[0]
      const custo = a.custoAbastecimento ?? (a.litrosAbastecidos || 0) * (a.valorPorLitro || 0)
      custoPorDiaMap.set(chaveData, (custoPorDiaMap.get(chaveData) || 0) + custo)
    })

    const custoDieselPorDia = Array.from(custoPorDiaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chaveData, custo]) => {
        const [, mes, dia] = chaveData.split('-')
        return { dia: `${dia}/${mes}`, custo }
      })

    return NextResponse.json({
      success: true,
      data: {
        atividadesPorTalhao,
        consumoPorMaquina,
        horasPorFuncionario,
        custoDieselPorDia,
      },
    })
  } catch (error) {
    console.error('GET /api/dashboard-graficos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
