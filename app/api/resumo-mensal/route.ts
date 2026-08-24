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

    // Detectar safra: fonte da verdade é a Safra ATIVA (model Safra), não
    // mais ConfiguracaoGlobal.inicioSafra/fimSafra (campo duplicado, mantido
    // no schema mas não é mais lido aqui).
    //
    // IMPORTANTE: calculado DIA A DIA (estaNaSafraNaData), não mais uma
    // única vez pro período inteiro. Antes disso (até 24/08/2026) o sistema
    // olhava só o meio do mês/período — então um mês que cruzasse a
    // fronteira Safra/Entressafra (ex: agosto/2026, safra terminando em
    // 19/08) acabava pagando o mês INTEIRO num regime só. Agora cada dia
    // usa a tarifa correta, e o salário mensal cheio é rateado
    // proporcionalmente aos dias corridos de cada regime dentro do período
    // (ver salarioBaseProporcional, mais abaixo).
    const safraAtiva = await prisma.safra.findFirst({
      where: { status: 'ATIVA' },
      orderBy: { dataInicio: 'desc' },
    })
    const safraInicio = safraAtiva?.dataInicio ? new Date(safraAtiva.dataInicio) : null
    const safraFim = safraAtiva?.dataFim ? new Date(safraAtiva.dataFim) : null
    function estaNaSafraNaData(data: Date): boolean {
      if (!safraInicio) return false
      return data >= safraInicio && (!safraFim || data <= safraFim)
    }

    // Dias corridos do período e quantos caem dentro da Safra — usado só
    // pra ratear o salário MENSAL do modo "mês inteiro" (ver
    // salarioBaseProporcional). Em períodos 100% Safra ou 100%
    // Entressafra dá o mesmo resultado de sempre (sem regressão).
    let diasNoPeriodo = 0
    let diasSafraNoPeriodo = 0
    {
      const cursor = new Date(inicioMes)
      while (cursor <= fimMes) {
        diasNoPeriodo++
        if (estaNaSafraNaData(cursor)) diasSafraNoPeriodo++
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    const diasEntressafraNoPeriodo = diasNoPeriodo - diasSafraNoPeriodo
    const regimeSalario: 'safra' | 'entressafra' | 'misto' =
      diasSafraNoPeriodo === diasNoPeriodo ? 'safra' : diasSafraNoPeriodo === 0 ? 'entressafra' : 'misto'

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

      const salarioSafraFunc = func.salarioSafra || 0
      const salarioEntressafraFunc = func.salarioEntressafra || 0
      const valorHoraExtraSafraFunc = func.valorHoraExtraSafra || 0
      const valorHoraExtraEntressafraFunc = func.valorHoraExtraEntressafra || 0

      // Tarifas por DIA (não mais uma bandeira única pro período inteiro) —
      // cada função abaixo olha a data recebida e devolve a tarifa correta
      // (Safra ou Entressafra) daquele dia específico.
      const salarioBaseNaData = (data: Date) => estaNaSafraNaData(data) ? salarioSafraFunc : salarioEntressafraFunc
      const valorHoraExtraNaData = (data: Date) => estaNaSafraNaData(data) ? valorHoraExtraSafraFunc : valorHoraExtraEntressafraFunc
      const valorDiaNaData = (data: Date) => func.tipoSalario === 'DIARIO'
        ? salarioBaseNaData(data)
        : salarioBaseNaData(data) / 30
      const valorHoraNormalNaData = (data: Date) => func.tipoSalario === 'DIARIO'
        ? salarioBaseNaData(data) / (config?.cargaHorariaEntressafra || 8)
        : salarioBaseNaData(data) / 220

      // Salário "do período" ratado pelos dias corridos de cada regime —
      // usado como referência de exibição e como o salário MENSAL cheio no
      // modo padrão (mês inteiro). Ex: agosto/2026 com 19 dias em Safra e
      // 12 em Entressafra dá 19/31 do Salário Safra + 12/31 do Entressafra.
      const salarioBaseProporcional = diasNoPeriodo > 0
        ? (diasSafraNoPeriodo / diasNoPeriodo) * salarioSafraFunc + (diasEntressafraNoPeriodo / diasNoPeriodo) * salarioEntressafraFunc
        : 0
      const valorHoraExtraMedia = diasNoPeriodo > 0
        ? (diasSafraNoPeriodo / diasNoPeriodo) * valorHoraExtraSafraFunc + (diasEntressafraNoPeriodo / diasNoPeriodo) * valorHoraExtraEntressafraFunc
        : 0

      let totalFaltas = 0
      let descontoFaltas = 0
      const faltasDatas = new Set<string>()
      let acumuladoProporcional = 0

      const { totalHorasExtras, totalHorasDevidas, totalHorasTrabalhadas, diasTrabalhados, agregadosPorData } =
        calcularTotaisHoras(registrosFuncionario, config?.cargaHorariaEntressafra || 8)

      // Valor de horas extras e desconto de horas devidas: soma dia a dia,
      // cada um na tarifa do seu próprio dia (em vez de multiplicar o total
      // do período por uma tarifa única).
      let valorHorasExtras = 0
      let descontoHorasDevidas = 0
      for (const [chaveData, agregado] of agregadosPorData) {
        const [yD, mD, dD] = chaveData.split('-').map(Number)
        const dataDoDia = new Date(yD, mD - 1, dD)
        valorHorasExtras += agregado.horasExtrasDia * valorHoraExtraNaData(dataDoDia)
        descontoHorasDevidas += agregado.horasDevidasDia * valorHoraNormalNaData(dataDoDia)
      }

      // Pagamento proporcional por dia (específico do Resumo Mensal): usa os
      // mesmos agregados por dia calculados acima, cada um na tarifa do seu
      // próprio dia.
      if (func.pagamentoProporcionalDiario) {
        for (const [chaveData, { somaHorasDia, cargaDia }] of agregadosPorData) {
          const [yD, mD, dD] = chaveData.split('-').map(Number)
          const dataDoDia = new Date(yD, mD - 1, dD)
          const valorDiaDoDia = valorDiaNaData(dataDoDia)
          const valorHoraExtraDoDia = valorHoraExtraNaData(dataDoDia)
          const valorHoraDoDia = valorDiaDoDia / cargaDia
          const pagamentoDoDia = somaHorasDia < cargaDia
            ? somaHorasDia * valorHoraDoDia
            : valorDiaDoDia + (somaHorasDia - cargaDia) * valorHoraExtraDoDia
          acumuladoProporcional += pagamentoDoDia
        }
      }

      const registrosDiarios = registrosFuncionario.map((reg) => {
        if (reg.isFalta) {
          totalFaltas++
          if (func.tipoSalario !== 'DIARIO') {
            descontoFaltas += valorDiaNaData(reg.data)
          }
          faltasDatas.add(reg.data.toISOString().split('T')[0])
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

      // Domingos sem NENHUM registro (nem atividade nem falta) — quando
      // o funcionário não tem expectativa garantida de trabalhar todo
      // domingo (domingosPorMes < 4), isso é esperado (combinado
      // informalmente), não um buraco de dado. Gera uma linha "Folga"
      // só pra exibição, sem criar nada no banco.
      const domingosPorMes = func.domingosPorMes ?? 2
      const diasComRegistro = new Set(registrosFuncionario.map((r) => r.data.toISOString().split('T')[0]))
      const folgasSemRegistro: typeof registrosDiarios = []
      if (domingosPorMes < 4) {
        const cursor = new Date(inicioMes)
        while (cursor <= fimMes) {
          if (cursor.getDay() === 0) {
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

      // Cálculo acumulado (valorHorasExtras, descontoHorasDevidas e
      // descontoFaltas já vêm somados dia a dia, cada um na tarifa correta)
      const totalDescontos = descontoHorasDevidas + descontoFaltas

      // Total acumulado:
      // - MENSAL, mês inteiro (modo padrão): salário cheio do mês (rateado
      //   Safra/Entressafra pelos dias corridos quando o período cruza a
      //   fronteira — ver salarioBaseProporcional) + horas extras -
      //   descontos (Faltas formais e Horas Devidas). NÃO reduz
      //   proporcionalmente por dias sem registro (ex: domingos de folga) —
      //   só desconta o que está formalmente registrado como Falta ou Hora
      //   Devida.
      // - MENSAL, período customizado: não faz sentido mostrar o salário
      //   MENSAL cheio pra uma janela de poucos dias — aqui sim proporciona
      //   dia a dia (cada dia na sua tarifa), descontando domingos de folga
      //   esperados e faltas. É uma ESTIMATIVA aproximada, não uma folha de
      //   pagamento oficial.
      // - DIARIO: soma cada dia efetivamente trabalhado na tarifa do seu
      //   próprio dia — diarista só recebe pelos dias que trabalhou.
      let acumuladoDiasTrabalhados: number
      if (func.tipoSalario === 'DIARIO') {
        acumuladoDiasTrabalhados = 0
        for (const chaveData of agregadosPorData.keys()) {
          const [yD, mD, dD] = chaveData.split('-').map(Number)
          acumuladoDiasTrabalhados += valorDiaNaData(new Date(yD, mD - 1, dD))
        }
      } else if (periodoCustomizado) {
        // domingos de folga esperados (sem registro) já são excluídos do
        // somatório abaixo via folgaDatas — mesma exclusão de sempre.
        const folgaDatas = new Set(folgasSemRegistro.map((f) => f.data.toISOString().split('T')[0]))
        let soma = 0
        const cursorDias = new Date(inicioMes)
        while (cursorDias <= fimMes) {
          const chave = cursorDias.toISOString().split('T')[0]
          if (!faltasDatas.has(chave) && !folgaDatas.has(chave)) {
            soma += valorDiaNaData(cursorDias)
          }
          cursorDias.setDate(cursorDias.getDate() + 1)
        }
        acumuladoDiasTrabalhados = soma
      } else {
        acumuladoDiasTrabalhados = salarioBaseProporcional
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
        regimeSalario,
        diasSafraNoPeriodo,
        diasEntressafraNoPeriodo,
        salarioBase: Math.round(salarioBaseProporcional * 100) / 100,
        valorHoraExtra: Math.round(valorHoraExtraMedia * 100) / 100,
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
        diasSafraNoPeriodo,
        diasEntressafraNoPeriodo,
        resumo,
      },
    })
  } catch (error) {
    console.error('GET /api/resumo-mensal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
