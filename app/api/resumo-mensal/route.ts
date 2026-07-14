import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularHorasBrutas } from '@/lib/calculoHorasBrutas'

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
      orderBy: [{ data: 'asc' }, { horaEntrada: 'asc' }],
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

      // Agrupar registros não-falta por data (chave de dia, já que a hora é
      // sempre fixada ao meio-dia) para evitar desconto/extra duplicado quando
      // o funcionário tem mais de um registro (ex: dois turnos) no mesmo dia.
      const gruposPorData = new Map<string, typeof registrosFuncionario>()
      for (const reg of registrosFuncionario) {
        if (reg.isFalta) continue
        const chaveData = reg.data.toISOString().split('T')[0]
        if (!gruposPorData.has(chaveData)) gruposPorData.set(chaveData, [])
        gruposPorData.get(chaveData)!.push(reg)
      }

      const agregadosPorData = new Map<string, {
        somaHorasDia: number
        cargaDia: number
        horasExtrasDia: number
        horasDevidasDia: number
        ultimoRegistroId: string
      }>()

      for (const [chaveData, regsDoDia] of gruposPorData) {
        // Com um único registro no dia, horasCalculadas já reflete corretamente
        // o desconto de almoço (ou a regra de passouDiretoAlmoco) daquele turno.
        let somaHorasDia: number
        if (regsDoDia.length === 1) {
          somaHorasDia = regsDoDia[0].horasCalculadas || 0
        } else {
          // Com múltiplos registros (turnos no mesmo dia), somamos as horas
          // BRUTAS de cada turno, sem o desconto de almoço já aplicado
          // individualmente em cada registro.
          const somaBruta = regsDoDia.reduce((acc, r) => {
            if (!r.horaSaida) return acc + (r.horasCalculadas || 0)
            return acc + calcularHorasBrutas(r.horaEntrada, r.horaSaida)
          }, 0)

          // Intervalo total entre turnos consecutivos (ordenados por
          // horaEntrada). Turnos colados ou sobrepostos (sem intervalo real)
          // contam 0 para aquele par.
          const regsOrdenadosPorEntrada = [...regsDoDia].sort((a, b) => a.horaEntrada.localeCompare(b.horaEntrada))
          let intervaloTotalDia = 0
          for (let i = 1; i < regsOrdenadosPorEntrada.length; i++) {
            const anterior = regsOrdenadosPorEntrada[i - 1]
            const atual = regsOrdenadosPorEntrada[i]
            if (!anterior.horaSaida) continue
            const [hSaidaAnt, mSaidaAnt] = anterior.horaSaida.split(':').map(Number)
            const [hEntradaAtual, mEntradaAtual] = atual.horaEntrada.split(':').map(Number)
            const minutosSaidaAnt = hSaidaAnt * 60 + mSaidaAnt
            const minutosEntradaAtual = hEntradaAtual * 60 + mEntradaAtual
            intervaloTotalDia += Math.max(0, minutosEntradaAtual - minutosSaidaAnt) / 60
          }

          // Um intervalo real (>= 1h) somado entre os turnos já cobre o
          // almoço, então não desconta nada a mais. Turnos colados (sem
          // intervalo, ou com menos de 1h somado) descontam 1h cheia, uma
          // única vez no dia.
          const descontoAlmocoDia = intervaloTotalDia >= 1 ? 0 : 1
          somaHorasDia = Math.max(0, somaBruta - descontoAlmocoDia)
        }
        const cargaDia = regsDoDia[0].horasprevistasdia ?? (config?.cargaHorariaEntressafra || 8)
        const horasExtrasDia = somaHorasDia > cargaDia ? somaHorasDia - cargaDia : 0
        const horasDevidasDia = somaHorasDia < cargaDia ? cargaDia - somaHorasDia : 0

        // O último registro do dia (por horaEntrada, com id como desempate) é
        // quem exibe o resultado líquido combinado (horasExtras/horasDevidas).
        const regsOrdenados = [...regsDoDia].sort((a, b) => {
          const cmpHora = a.horaEntrada.localeCompare(b.horaEntrada)
          return cmpHora !== 0 ? cmpHora : a.id.localeCompare(b.id)
        })
        const ultimoRegistroId = regsOrdenados[regsOrdenados.length - 1].id

        agregadosPorData.set(chaveData, { somaHorasDia, cargaDia, horasExtrasDia, horasDevidasDia, ultimoRegistroId })

        diasTrabalhados++
        totalHorasTrabalhadas += somaHorasDia
        totalHorasExtras += horasExtrasDia
        totalHorasDevidas += horasDevidasDia

        if (func.pagamentoProporcionalDiario) {
          const valorHoraDoDia = valorDia / cargaDia
          const pagamentoDoDia = somaHorasDia < cargaDia
            ? somaHorasDia * valorHoraDoDia
            : valorDia + (somaHorasDia - cargaDia) * valorHoraExtra
          acumuladoProporcional += pagamentoDoDia
        }
      }

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
            cargaContratual: reg.horasprevistasdia ?? (config?.cargaHorariaEntressafra || 8),
            horasExtras: 0,
            horasDevidas: 0,
            isFalta: true,
            motivoFalta: reg.motivoFalta,
            passouDiretoAlmoco: false,
          }
        }

        const chaveData = reg.data.toISOString().split('T')[0]
        const agregado = agregadosPorData.get(chaveData)!
        const horas = reg.horasCalculadas || 0

        let horasBrutas = horas
        let descontoAlmoco = 0

        if (!reg.passouDiretoAlmoco) {
          horasBrutas = horas + 1
          descontoAlmoco = 1
        }

        // Só o último registro do dia carrega horasExtras/horasDevidas do
        // grupo, pra não exibir "devidas"/"extras" duplicado em cada turno.
        const ehUltimoRegistroDoDia = reg.id === agregado.ultimoRegistroId
        const horasExtras = ehUltimoRegistroDoDia ? agregado.horasExtrasDia : 0
        const horasDevidas = ehUltimoRegistroDoDia ? agregado.horasDevidasDia : 0

        return {
          data: reg.data,
          horaEntrada: reg.horaEntrada,
          horaSaida: reg.horaSaida,
          horasBrutas: Math.round(horasBrutas * 100) / 100,
          descontoAlmoco,
          horasTrabalhadas: Math.round(horas * 100) / 100,
          cargaContratual: agregado.cargaDia,
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
      const descontoFaltas = func.tipoSalario === 'DIARIO' ? 0 : totalFaltas * valorDia
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
        funcionario: { id: func.id, name: func.name, role: func.role, pagamentoProporcionalDiario: func.pagamentoProporcionalDiario },
        estaNaSafra,
        salarioBase,
        valorDia: Math.round(valorDia * 100) / 100,
        valorHoraNormal: Math.round(valorHoraNormal * 100) / 100,
        valorHoraExtra,
        diasTrabalhados,
        totalFaltas,
        totalHorasTrabalhadas: Math.round(totalHorasTrabalhadas * 100) / 100,
        totalHorasExtras: Math.round(totalHorasExtras * 100) / 100,
        totalHorasDevidas: func.pagamentoProporcionalDiario ? 0 : Math.round(totalHorasDevidas * 100) / 100,
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
