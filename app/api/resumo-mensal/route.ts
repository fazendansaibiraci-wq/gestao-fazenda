import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1))
    const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))

    const inicioMes = new Date(ano, mes - 1, 1)
    const fimMes = new Date(ano, mes, 0, 23, 59, 59)

    // Buscar configuração global
    const config = await prisma.configuracaoGlobal.findFirst()

    // Buscar todos os funcionários ativos
    const funcionarios = await prisma.user.findMany({
      where: {
        active: true,
        role: { in: ['FUNCIONARIO', 'GERENTE', 'AGRONOMO'] },
      },
      select: {
        id: true,
        name: true,
        role: true,
        tipoSalario: true,
        salarioEntressafra: true,
        salarioSafra: true,
        valorHoraExtraEntressafra: true,
        valorHoraExtraSafra: true,
        cargaHorariaSafra: true,
      },
    })

    // Buscar registros do mês
    const registros = await prisma.registroAtividade.findMany({
      where: {
        data: { gte: inicioMes, lte: fimMes },
      },
      select: {
        funcionarioId: true,
        data: true,
        horasCalculadas: true,
        horasprevistasdia: true,
        isFalta: true,
        ehHoraExtra: true,
      },
    })

    // Calcular resumo por funcionário
    const resumo = funcionarios.map((func) => {
      const registrosFuncionario = registros.filter(r => r.funcionarioId === func.id)

      let totalHorasTrabalhadas = 0
      let totalHorasExtras = 0
      let totalHorasDevidas = 0
      let totalFaltas = 0
      let diasTrabalhados = 0

      registrosFuncionario.forEach((reg) => {
        if (reg.isFalta) {
          totalFaltas++
          return
        }

        diasTrabalhados++
        const horas = reg.horasCalculadas || 0
        const cargaDia = reg.horasprevistasdia || config?.cargaHorariaEntressafra || 8

        totalHorasTrabalhadas += horas

        if (horas > cargaDia) {
          totalHorasExtras += horas - cargaDia
        } else if (horas < cargaDia) {
          totalHorasDevidas += cargaDia - horas
        }
      })

      // Detectar se o mês está na safra
      let estaНаSafra = false
      if (config?.inicioSafra && config?.fimSafra) {
        const meioDoMes = new Date(ano, mes - 1, 15)
        estaНаSafra = meioDoMes >= new Date(config.inicioSafra) && meioDoMes <= new Date(config.fimSafra)
      }

      const salarioBase = estaНаSafra
        ? (func.salarioSafra || 0)
        : (func.salarioEntressafra || 0)

      const valorHoraExtra = estaНаSafra
        ? (func.valorHoraExtraSafra || 0)
        : (func.valorHoraExtraEntressafra || 0)

      // Calcular valor hora para desconto (salário / dias úteis do mês / carga horária)
      const diasUteisDoMes = 26
      const cargaHorariaDia = estaНаSafra
        ? (func.cargaHorariaSafra || 8)
        : (config?.cargaHorariaEntressafra || 8)
      const valorHoraNormal = salarioBase / (diasUteisDoMes * cargaHorariaDia)

      const valorHorasExtras = totalHorasExtras * valorHoraExtra
      const descontoHorasDevidas = totalHorasDevidas * valorHoraNormal
      const descontoFaltas = totalFaltas * (salarioBase / diasUteisDoMes)

      const totalAPagar = salarioBase + valorHorasExtras - descontoHorasDevidas - descontoFaltas

      return {
        funcionario: {
          id: func.id,
          name: func.name,
          role: func.role,
        },
        estaНаSafra,
        salarioBase,
        diasTrabalhados,
        totalFaltas,
        totalHorasTrabalhadas: Math.round(totalHorasTrabalhadas * 100) / 100,
        totalHorasExtras: Math.round(totalHorasExtras * 100) / 100,
        totalHorasDevidas: Math.round(totalHorasDevidas * 100) / 100,
        valorHorasExtras: Math.round(valorHorasExtras * 100) / 100,
        descontoHorasDevidas: Math.round(descontoHorasDevidas * 100) / 100,
        descontoFaltas: Math.round(descontoFaltas * 100) / 100,
        totalAPagar: Math.round(totalAPagar * 100) / 100,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        mes,
        ano,
        resumo,
      },
    })
  } catch (error) {
    console.error('GET /api/resumo-mensal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
