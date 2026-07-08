import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRole = (session.user as any)?.role
    const userId = (session.user as any)?.id
    const isFuncionario = userRole === 'FUNCIONARIO'

    const { searchParams } = new URL(request.url)
    const mes = parseInt(searchParams.get('mes') || String(new Date().getMonth() + 1))
    const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()))
    const funcionarioIdParam = searchParams.get('funcionarioId')

    const inicioMes = new Date(ano, mes - 1, 1)
    const fimMes = new Date(ano, mes, 0, 23, 59, 59)

    const config = await prisma.configuracaoGlobal.findFirst()

    const whereUser: any = {
      active: true,
      role: { in: ['FUNCIONARIO', 'GERENTE', 'AGRONOMO'] },
    }

    if (isFuncionario) {
      whereUser.id = userId
    } else if (funcionarioIdParam) {
      whereUser.id = funcionarioIdParam
    }

    const funcionarios = await prisma.user.findMany({
      where: whereUser,
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
        pagamentoProporcionalDiario: true,
      },
    })

    const registros = await prisma.registroAtividade.findMany({
      where: {
        data: { gte: inicioMes, lte: fimMes },
        ...(isFuncionario ? { funcionarioId: userId } : {}),
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
        motivoFalta: true,
        ehHoraExtra: true,
        passouDiretoAlmoco: true,
      },
      orderBy: { data: 'asc' },
    })

    const resumo = funcionarios.map((func) => {
      const registrosFuncionario = registros.filter(r => r.funcionarioId === func.id)

      // Detectar se está na safra
      let estaNaSafra = false
      if (config?.inicioSafra && config?.fimSafra) {
        const meioDoMes = new Date(ano, mes - 1, 15)
        estaNaSafra = meioDoMes >= new Date(config.inicioSafra) && meioDoMes <= new Date(config.fimSafra)
      }

      const salarioBase = estaNaSafra
        ? (func.salarioSafra || 0)
        : (func.salarioEntressafra || 0)

      const valorHoraExtra = estaNaSafra
        ? (func.valorHoraExtraSafra || 0)
        : (func.valorHoraExtraEntressafra || 0)

      // Valor dia: DIARIO usa o valor cadastrado diretamente; MENSAL divide por 30
      const valorDia = func.tipoSalario === 'DIARIO'
        ? salarioBase
        : salarioBase / 30

      // Valor hora normal: DIARIO divide pela carga horária do dia; MENSAL divide por 220
      const valorHoraNormal = func.tipoSalario === 'DIARIO'
        ? salarioBase / (config?.cargaHorariaEntressafra || 8)
        : salarioBase / 220

      let totalHorasTrabalhadas = 0
      let totalHorasExtras = 0
      let totalHorasDevidas = 0
      let totalFaltas = 0
      let diasTrabalhados = 0
      let acumuladoProporcional = 0

      const registrosDiarios = registrosFuncionario.map((reg) => {
        if (reg.isFalta) {
          totalFaltas++
          return {
            data: reg.data,
            horaEntrada: null,
            horaSaida: null,
            horasBrutas: 0,
            descontoAlmoco: 0,
            horasTrabalhadas: 0,
            cargaContratual: reg.horasprevistasdia || config?.cargaHorariaEntressafra || 8,
            horasExtras: 0,
            horasDevidas: 0,
            isFalta: true,
            motivoFalta: reg.motivoFalta,
            passouDiretoAlmoco: false,
          }
        }

        diasTrabalhados++
        const horas = reg.horasCalculadas || 0
        const cargaDia = reg.horasprevistasdia || config?.cargaHorariaEntressafra || 8

        let horasBrutas = horas
        let descontoAlmoco = 0

        if (!reg.passouDiretoAlmoco) {
          horasBrutas = horas + 1
          descontoAlmoco = 1
        }

        const horasExtras = horas > cargaDia ? horas - cargaDia : 0
        const horasDevidas = horas < cargaDia ? cargaDia - horas : 0

        totalHorasTrabalhadas += horas
        totalHorasExtras += horasExtras
        totalHorasDevidas += horasDevidas

        if (func.pagamentoProporcionalDiario) {
          const valorHoraDoDia = valorDia / cargaDia
          const pagamentoDoDia = horas < cargaDia
            ? horas * valorHoraDoDia
            : valorDia + (horas - cargaDia) * valorHoraExtra
          acumuladoProporcional += pagamentoDoDia
        }

        return {
          data: reg.data,
          horaEntrada: reg.horaEntrada,
          horaSaida: reg.horaSaida,
          horasBrutas: Math.round(horasBrutas * 100) / 100,
          descontoAlmoco,
          horasTrabalhadas: Math.round(horas * 100) / 100,
          cargaContratual: cargaDia,
          horasExtras: Math.round(horasExtras * 100) / 100,
          horasDevidas: Math.round(horasDevidas * 100) / 100,
          isFalta: false,
          motivoFalta: null,
          passouDiretoAlmoco: reg.passouDiretoAlmoco,
        }
      })

      // Cálculo acumulado
      const valorHorasExtras = totalHorasExtras * valorHoraExtra
      const descontoHorasDevidas = totalHorasDevidas * valorHoraNormal
      const descontoFaltas = totalFaltas * valorDia
      const totalDescontos = descontoHorasDevidas + descontoFaltas

      // Total acumulado = (salário ÷ 30 × dias trabalhados) + horas extras - descontos
      const acumuladoDiasTrabalhados = diasTrabalhados * valorDia
      const totalAcumulado = acumuladoDiasTrabalhados + valorHorasExtras - totalDescontos

      // Para funcionários com pagamento proporcional por hora, o total acumulado é
      // recalculado dia a dia (acumuladoProporcional), descontando as faltas normalmente.
      const totalAcumuladoFinal = func.pagamentoProporcionalDiario
        ? acumuladoProporcional - descontoFaltas
        : totalAcumulado

      return {
        funcionario: { id: func.id, name: func.name, role: func.role },
        estaNaSafra,
        salarioBase,
        valorDia: Math.round(valorDia * 100) / 100,
        valorHoraNormal: Math.round(valorHoraNormal * 100) / 100,
        valorHoraExtra,
        diasTrabalhados,
        totalFaltas,
        totalHorasTrabalhadas: Math.round(totalHorasTrabalhadas * 100) / 100,
        totalHorasExtras: Math.round(totalHorasExtras * 100) / 100,
        totalHorasDevidas: Math.round(totalHorasDevidas * 100) / 100,
        valorHorasExtras: Math.round(valorHorasExtras * 100) / 100,
        descontoHorasDevidas: Math.round(descontoHorasDevidas * 100) / 100,
        descontoFaltas: Math.round(descontoFaltas * 100) / 100,
        totalAcumulado: Math.round(totalAcumuladoFinal * 100) / 100,
        registrosDiarios,
      }
    })

    return NextResponse.json({ success: true, data: { mes, ano, resumo } })
  } catch (error) {
    console.error('GET /api/resumo-mensal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
