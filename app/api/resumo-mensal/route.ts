import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularTotaisHoras } from '@/lib/calculoTotaisFuncionario'

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
    // Período customizado (opcional): quando os dois vêm preenchidos, usa
    // esse intervalo exato em vez do mês/ano inteiro. O valor em R$ nesse
    // modo é uma ESTIMATIVA aproximada — ver comentário mais abaixo, onde
    // "acumuladoDiasTrabalhados" é calculado de forma diferente pra
    // salário MENSAL nesse caso.
    const dataInicioParam = searchParams.get('dataInicio')
    const dataFimParam = searchParams.get('dataFim')
    const periodoCustomizado = !!(dataInicioParam && dataFimParam)

    const inicioMes = periodoCustomizado
      ? new Date(dataInicioParam + 'T00:00:00')
      : new Date(ano, mes - 1, 1)
    const fimMes = periodoCustomizado
      ? new Date(dataFimParam + 'T23:59:59')
      : new Date(ano, mes, 0, 23, 59, 59)

    const config = await prisma.configuracaoGlobal.findFirst()

    // Regime salarial: botão manual em Configurações Gerais (ver enum
    // RegimeSalarial no schema.prisma) — substituiu, a partir de
    // 25/08/2026, o cálculo automático que comparava a data de cada
    // registro contra a Safra ATIVA (model Safra, que é a entidade
    // agronômica de ciclo de plantio/colheita, e não muda mais o regime
    // salarial). A troca de regime agora é sempre manual, feita aqui.
    const estaNaSafra = config?.regimeSalarial === 'SAFRA'
    const regimeSalario: 'safra' | 'entressafra' = estaNaSafra ? 'safra' : 'entressafra'

    const whereUser: any = {
      active: true,
      role: { in: ['FUNCIONARIO', 'AGRONOMO'] },
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
        cargaHorariaSegSex: true,
        cargaHorariaSabado: true,
        cargaHorariaDomingo: true,
        pagamentoProporcionalDiario: true,
        domingosPorMes: true,
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

      // Valor hora normal: DIARIO divide pela carga horária "padrão" do
      // regime — Safra usa a jornada individual (Segunda-Sexta) do
      // funcionário, Entressafra usa o valor global de Segunda a Quinta.
      // NÃO usa uma data específica aqui (ex: o primeiro dia do período)
      // porque esse dia pode cair num sábado/domingo, que agora tem carga
      // horária 0 na Entressafra — dividir por 0 quebrava a tela.
      const valorHoraNormal = func.tipoSalario === 'DIARIO'
        ? salarioBase / (estaNaSafra
            ? (func.cargaHorariaSegSex || config?.cargaHorariaEntressafra || 8)
            : (config?.cargaHorariaEntressafraSegQui || config?.cargaHorariaEntressafra || 8))
        : salarioBase / 220

      let totalFaltas = 0
      let acumuladoProporcional = 0

      const { totalHorasExtras, totalHorasDevidas, totalHorasTrabalhadas, diasTrabalhados, agregadosPorData } =
        calcularTotaisHoras(registrosFuncionario, config?.cargaHorariaEntressafra || 8)

      // Pagamento proporcional por dia (específico do Resumo Mensal): usa os
      // mesmos agregados por dia calculados acima.
      if (func.pagamentoProporcionalDiario) {
        for (const { somaHorasDia, cargaDia } of agregadosPorData.values()) {
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
            isFolga: false,
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
          isFolga: false,
          motivoFalta: null,
          passouDiretoAlmoco: reg.passouDiretoAlmoco,
        }
      })

      // Dias sem NENHUM registro (nem atividade nem falta) que são
      // esperados como folga — gera uma linha "Folga" só pra exibição,
      // sem criar nada no banco (e sem contar como falta).
      // - Entressafra: sábado e domingo NUNCA são esperados como dia de
      //   trabalho (regra fixa, igual pra todo mundo — ver
      //   calcularCargaHorariaDia). Qualquer sábado ou domingo sem
      //   registro é folga.
      // - Safra: só domingo pode ser folga, e só quando o funcionário não
      //   tem expectativa garantida de trabalhar TODO domingo
      //   (domingosPorMes < 4) — a alternância é combinada informalmente
      //   entre eles.
      const domingosPorMes = func.domingosPorMes ?? 2
      const diasComRegistro = new Set(registrosFuncionario.map((r) => r.data.toISOString().split('T')[0]))
      const folgasSemRegistro: typeof registrosDiarios = []
      {
        const cursor = new Date(inicioMes)
        while (cursor <= fimMes) {
          const diaSemana = cursor.getDay()
          const ehSabado = diaSemana === 6
          const ehDomingo = diaSemana === 0
          const deveSerFolga = estaNaSafra
            ? (ehDomingo && domingosPorMes < 4)
            : (ehSabado || ehDomingo)
          if (deveSerFolga) {
            const chave = cursor.toISOString().split('T')[0]
            if (!diasComRegistro.has(chave)) {
              const [anoFolga, mesFolga, diaFolga] = chave.split('-').map(Number)
              folgasSemRegistro.push({
                // Meio-dia UTC evita que a conversão pro fuso do navegador
                // (ex.: Brasil, UTC-3) empurre a data pro dia anterior na exibição.
                data: new Date(Date.UTC(anoFolga, mesFolga - 1, diaFolga, 12, 0, 0)),
                horaEntrada: null,
                horaSaida: null,
                horasBrutas: 0,
                descontoAlmoco: 0,
                horasTrabalhadas: 0,
                cargaContratual: 0,
                horasExtras: 0,
                horasDevidas: 0,
                isFalta: false,
                isFolga: true,
                motivoFalta: null,
                passouDiretoAlmoco: false,
              })
            }
          }
          cursor.setDate(cursor.getDate() + 1)
        }
      }
      const registrosDiariosCompletos = [...registrosDiarios, ...folgasSemRegistro].sort(
        (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
      )

      // Cálculo acumulado
      const valorHorasExtras = totalHorasExtras * valorHoraExtra
      const descontoHorasDevidas = totalHorasDevidas * valorHoraNormal
      const descontoFaltas = func.tipoSalario === 'DIARIO' ? 0 : totalFaltas * valorDia
      const totalDescontos = descontoHorasDevidas + descontoFaltas

      // Total acumulado:
      // - MENSAL, mês inteiro (modo padrão): salário cheio do mês (no
      //   regime manual ativo em Configurações Gerais) + horas extras -
      //   descontos (Faltas formais e Horas Devidas). NÃO reduz
      //   proporcionalmente por dias sem registro (ex: domingos de folga) —
      //   só desconta o que está formalmente registrado como Falta ou Hora
      //   Devida.
      // - MENSAL, período customizado: não faz sentido mostrar o salário
      //   MENSAL cheio pra uma janela de poucos dias — aqui sim proporciona
      //   por dia (valorDia × dias do período, descontando domingos de
      //   folga esperados e faltas). É uma ESTIMATIVA aproximada, não uma
      //   folha de pagamento oficial.
      // - DIARIO: mantém o cálculo por dias trabalhados, já que salarioBase
      //   representa o valor por dia, não um total mensal — diarista só
      //   recebe pelos dias que trabalhou.
      let acumuladoDiasTrabalhados: number
      if (func.tipoSalario === 'DIARIO') {
        acumuladoDiasTrabalhados = diasTrabalhados * valorDia
      } else if (periodoCustomizado) {
        const diasNoPeriodo = Math.round((fimMes.getTime() - inicioMes.getTime()) / 86400000) + 1
        const diasDeFolgaNoPeriodo = folgasSemRegistro.length
        const diasPagaveis = Math.max(0, diasNoPeriodo - totalFaltas - diasDeFolgaNoPeriodo)
        acumuladoDiasTrabalhados = diasPagaveis * valorDia
      } else {
        acumuladoDiasTrabalhados = salarioBase
      }
      // No período customizado, a falta já foi excluída dos "dias
      // pagáveis" acima — não desconta de novo aqui (senão descontaria a
      // falta duas vezes). No modo mês inteiro, o desconto de falta
      // continua sendo aplicado separadamente, como sempre foi.
      const totalDescontosAcumulado = periodoCustomizado && func.tipoSalario !== 'DIARIO'
        ? descontoHorasDevidas
        : totalDescontos
      const totalAcumulado = acumuladoDiasTrabalhados + valorHorasExtras - totalDescontosAcumulado

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
        registrosDiarios: registrosDiariosCompletos,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        mes,
        ano,
        periodoCustomizado,
        dataInicio: periodoCustomizado ? inicioMes.toISOString() : null,
        dataFim: periodoCustomizado ? fimMes.toISOString() : null,
        regimeSalario,
        resumo,
      },
    })
  } catch (error) {
    console.error('GET /api/resumo-mensal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
