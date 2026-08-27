import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularTotaisHoras } from '@/lib/calculoTotaisFuncionario'
import {
  buscarPeriodosComId,
  obterPeriodoNaData,
  buscarTodosSalariosPeriodo,
  PeriodoComId,
  DadosSalarioPeriodo,
} from '@/lib/salarioPeriodo'

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

    // Regime salarial + salário/hora extra/jornada: determinados DIA A
    // DIA e por funcionário, a partir dos períodos cadastrados em
    // Configurações → Safra/Entressafra e do SalarioPeriodo cadastrado
    // em Funcionários → Salário Safra/Entressafra (ver
    // lib/salarioPeriodo.ts). Um mês que cruza a fronteira Safra/
    // Entressafra (ex: agosto/2026, safra terminando em 19/08) usa a
    // tarifa correta em cada dia, e o salário mensal cheio é rateado
    // proporcionalmente aos dias corridos de cada regime dentro do
    // período (ver salarioBaseProporcional, mais abaixo). Dias que não
    // caem em NENHUM período cadastrado entram em `diasSemPeriodo`;
    // funcionário sem SalarioPeriodo cadastrado pro período do dia entra
    // em `funcionariosSemSalario` — os dois são avisos pontuais, sem
    // travar o resto do resumo.
    const periodosComId = await buscarPeriodosComId()
    function periodoNaData(data: Date): PeriodoComId | null {
      return obterPeriodoNaData(data, periodosComId)
    }
    const todosSalarios = await buscarTodosSalariosPeriodo()
    const funcionariosSemSalario = new Set<string>()

    // Dias corridos do período, quantos em cada regime, e quantos sem
    // período nenhum cadastrado — usado pro rateio proporcional do
    // salário MENSAL cheio (modo padrão) e pro aviso de pendência no
    // topo da resposta. Em períodos 100% Safra ou 100% Entressafra dá o
    // mesmo resultado de sempre (sem regressão).
    let diasNoPeriodo = 0
    let diasSafraNoPeriodo = 0
    let diasEntressafraNoPeriodo = 0
    const diasSemPeriodo: string[] = []
    {
      const cursor = new Date(inicioMes)
      while (cursor <= fimMes) {
        diasNoPeriodo++
        const periodo = periodoNaData(cursor)
        if (periodo?.tipo === 'SAFRA') diasSafraNoPeriodo++
        else if (periodo?.tipo === 'ENTRESSAFRA') diasEntressafraNoPeriodo++
        else diasSemPeriodo.push(cursor.toISOString().split('T')[0])
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    const regimeSalario: 'safra' | 'entressafra' | 'misto' =
      diasSafraNoPeriodo === diasNoPeriodo
        ? 'safra'
        : diasEntressafraNoPeriodo === diasNoPeriodo
        ? 'entressafra'
        : 'misto'

    const whereUser: any = {
      active: true,
      role: { in: ['FUNCIONARIO', 'AGRONOMO'] },
      participaFolhaPagamento: true,
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

      // Dados de salário/hora extra/jornada do funcionário NUM DIA
      // específico: acha o período do dia, depois o SalarioPeriodo desse
      // funcionário nesse período. null quando falta um dos dois — nesse
      // caso o funcionário sem cadastro entra em `funcionariosSemSalario`
      // (dia sem período nenhum já entra em `diasSemPeriodo`, calculado
      // acima, e não precisa reportar de novo aqui).
      const dadosSalarioNaData = (data: Date): DadosSalarioPeriodo | null => {
        const periodo = periodoNaData(data)
        if (!periodo) return null
        const dados = todosSalarios.get(`${func.id}:${periodo.id}`)
        if (!dados) {
          funcionariosSemSalario.add(`${func.name} (${periodo.tipo})`)
          return null
        }
        return dados
      }

      const salarioBaseNaData = (data: Date): number | null => {
        const dados = dadosSalarioNaData(data)
        if (!dados) return null
        return dados.tipoSalario === 'DIARIO' ? dados.salarioDiaria : dados.salarioMensal
      }
      const valorHoraExtraNaData = (data: Date): number | null => {
        return dadosSalarioNaData(data)?.valorHoraExtra ?? null
      }
      const valorDiaNaData = (data: Date): number | null => {
        const dados = dadosSalarioNaData(data)
        if (!dados) return null
        const base = dados.tipoSalario === 'DIARIO' ? dados.salarioDiaria : dados.salarioMensal
        if (base === null || base === undefined) return null
        return dados.tipoSalario === 'DIARIO' ? base : base / 30
      }

      // Um SalarioPeriodo "representativo" de cada regime dentro do
      // intervalo visualizado — o primeiro dia daquele tipo que tiver
      // cadastro. Usado só pras decisões de estrutura geral do cálculo
      // (rateio do salário mensal cheio, valor hora de referência) — na
      // prática só existe UM período de cada tipo cobrindo o mês, então
      // isso é exato; se um dia dois períodos do mesmo tipo se
      // sobrepusessem ao intervalo visualizado (não deveria acontecer,
      // já que períodos não se sobrepõem), usa o primeiro encontrado.
      const representativoPorTipo = (tipo: 'SAFRA' | 'ENTRESSAFRA'): DadosSalarioPeriodo | null => {
        const cursor = new Date(inicioMes)
        while (cursor <= fimMes) {
          const periodo = periodoNaData(cursor)
          if (periodo?.tipo === tipo) {
            const dados = todosSalarios.get(`${func.id}:${periodo.id}`)
            if (dados) return dados
          }
          cursor.setDate(cursor.getDate() + 1)
        }
        return null
      }
      const repSafra = representativoPorTipo('SAFRA')
      const repEntressafra = representativoPorTipo('ENTRESSAFRA')
      // Tipo de salário "do funcionário" pra decisões de estrutura geral
      // (branch MENSAL vs DIARIO no acumulado) — prioriza o período que
      // cobre HOJE; se não achar, usa qualquer um dos representativos
      // acima. Não cobre o caso raríssimo de alguém mudar de Mensal pra
      // Diário entre Safra e Entressafra (não previsto até agora).
      const periodoHoje = periodoNaData(new Date())
      const dadosHoje = periodoHoje ? todosSalarios.get(`${func.id}:${periodoHoje.id}`) : null
      const tipoSalarioFunc = dadosHoje?.tipoSalario ?? repSafra?.tipoSalario ?? repEntressafra?.tipoSalario ?? null

      const salarioMensalSafra = repSafra?.tipoSalario === 'MENSAL' ? (repSafra.salarioMensal || 0) : 0
      const salarioMensalEntressafra = repEntressafra?.tipoSalario === 'MENSAL' ? (repEntressafra.salarioMensal || 0) : 0
      const valorHoraExtraSafra = repSafra?.valorHoraExtra || 0
      const valorHoraExtraEntressafra = repEntressafra?.valorHoraExtra || 0

      // Salário "do período" rateado pelos dias corridos de cada regime —
      // usado como referência de exibição e como o salário MENSAL cheio no
      // modo padrão (mês inteiro). Ex: agosto/2026 com 19 dias em Safra e
      // 12 em Entressafra dá 19/31 do Salário Safra + 12/31 do
      // Entressafra. Dias sem período cadastrado não entram na conta (nem
      // no numerador nem no denominador ponderado), então o rateio segue
      // proporcional só entre os dias que TÊM regime conhecido.
      const salarioBaseProporcional = diasNoPeriodo > 0
        ? (diasSafraNoPeriodo / diasNoPeriodo) * salarioMensalSafra + (diasEntressafraNoPeriodo / diasNoPeriodo) * salarioMensalEntressafra
        : 0
      const valorHoraExtraMedia = diasNoPeriodo > 0
        ? (diasSafraNoPeriodo / diasNoPeriodo) * valorHoraExtraSafra + (diasEntressafraNoPeriodo / diasNoPeriodo) * valorHoraExtraEntressafra
        : 0
      // Valor hora normal "de referência", pra exibição: usa a carga
      // horária de referência de cada regime (Segunda a Sexta na Safra,
      // Segunda a Quinta na Entressafra) em vez de um dia real do
      // período — evita dividir por carga horária 0 de fim de semana
      // (mesmo motivo do fix 9a7cc03). Pondera pelos mesmos dias
      // corridos usados no rateio acima.
      const cargaReferenciaSafra = repSafra?.cargaHorariaSegSex || 8
      const cargaReferenciaEntressafra = repEntressafra?.cargaHorariaSegQui || 8
      const valorHoraNormalSafra = tipoSalarioFunc === 'DIARIO' ? (repSafra?.salarioDiaria || 0) / cargaReferenciaSafra : salarioMensalSafra / 220
      const valorHoraNormalEntressafra = tipoSalarioFunc === 'DIARIO' ? (repEntressafra?.salarioDiaria || 0) / cargaReferenciaEntressafra : salarioMensalEntressafra / 220
      const valorHoraNormalMedia = diasNoPeriodo > 0
        ? (diasSafraNoPeriodo / diasNoPeriodo) * valorHoraNormalSafra + (diasEntressafraNoPeriodo / diasNoPeriodo) * valorHoraNormalEntressafra
        : 0

      let totalFaltas = 0
      let descontoFaltas = 0
      const faltasDatas = new Set<string>()
      let acumuladoProporcional = 0

      const { totalHorasExtras, totalHorasDevidas, totalHorasTrabalhadas, diasTrabalhados, agregadosPorData } =
        calcularTotaisHoras(registrosFuncionario, 8)

      // Valor de horas extras e desconto de horas devidas: soma dia a dia,
      // cada um na tarifa do seu próprio dia (em vez de multiplicar o
      // total do período por uma tarifa única). Dia sem período/salário
      // cadastrado não contribui pro valor em R$ (não dá pra saber a
      // tarifa) — as horas em si continuam contadas normalmente em
      // totalHorasExtras/totalHorasDevidas, só o valor monetário fica de
      // fora até o cadastro ser completado.
      let valorHorasExtras = 0
      let descontoHorasDevidas = 0
      for (const [chaveData, agregado] of agregadosPorData) {
        const [yD, mD, dD] = chaveData.split('-').map(Number)
        const dataDoDia = new Date(yD, mD - 1, dD)

        const tarifaExtra = valorHoraExtraNaData(dataDoDia)
        if (tarifaExtra !== null) valorHorasExtras += agregado.horasExtrasDia * tarifaExtra

        // Valor hora normal do dia: DIARIO usa valorDia/cargaDia do
        // próprio dia; MENSAL usa salarioBase/220 — mesma regra usada no
        // resto do app, só que agora resolvida por dia.
        const dadosDoDia = dadosSalarioNaData(dataDoDia)
        if (dadosDoDia?.tipoSalario === 'DIARIO') {
          const valorDiaDoDia = valorDiaNaData(dataDoDia)
          if (valorDiaDoDia !== null && agregado.cargaDia > 0) {
            descontoHorasDevidas += agregado.horasDevidasDia * (valorDiaDoDia / agregado.cargaDia)
          }
        } else if (dadosDoDia?.tipoSalario === 'MENSAL') {
          const salarioBaseDoDia = salarioBaseNaData(dataDoDia)
          if (salarioBaseDoDia !== null) {
            descontoHorasDevidas += agregado.horasDevidasDia * (salarioBaseDoDia / 220)
          }
        }
      }

      // Pagamento proporcional por dia (específico do Resumo Mensal): usa
      // os mesmos agregados por dia calculados acima, cada um na tarifa
      // do seu próprio dia. Dia sem período/salário cadastrado não soma
      // nada aqui (fica de fora do acumulado até o cadastro ser
      // completado).
      if (func.pagamentoProporcionalDiario) {
        for (const [chaveData, { somaHorasDia, cargaDia }] of agregadosPorData) {
          const [yD, mD, dD] = chaveData.split('-').map(Number)
          const dataDoDia = new Date(yD, mD - 1, dD)
          const valorDiaDoDia = valorDiaNaData(dataDoDia)
          const valorHoraExtraDoDia = valorHoraExtraNaData(dataDoDia)
          if (valorDiaDoDia === null || valorHoraExtraDoDia === null || cargaDia <= 0) continue
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
          if (tipoSalarioFunc === 'MENSAL') {
            const valorDiaDoDia = valorDiaNaData(reg.data)
            if (valorDiaDoDia !== null) descontoFaltas += valorDiaDoDia
          }
          faltasDatas.add(reg.data.toISOString().split('T')[0])
          return {
            data: reg.data,
            horaEntrada: null,
            horaSaida: null,
            horasBrutas: 0,
            descontoAlmoco: 0,
            horasTrabalhadas: 0,
            cargaContratual: reg.horasprevistasdia ?? 8,
            horasExtras: 0,
            horasDevidas: 0,
            isFalta: true,
            isFolga: false,
            isSemPeriodo: false,
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
          isSemPeriodo: !dadosSalarioNaData(reg.data),
          motivoFalta: null,
          passouDiretoAlmoco: reg.passouDiretoAlmoco,
        }
      })

      // Dias sem NENHUM registro (nem atividade nem falta):
      // - Se o dia cai dentro de um período cadastrado E o funcionário
      //   tem SalarioPeriodo pra esse período: gera uma linha "Folga" só
      //   pra exibição (sem criar nada no banco, sem contar como falta)
      //   quando é esperado que não se trabalhe:
      //   - Entressafra: sábado e domingo NUNCA são esperados como dia de
      //     trabalho (regra fixa, igual pra todo mundo).
      //   - Safra: só domingo pode ser folga, e só quando o funcionário
      //     não tem expectativa garantida de trabalhar TODO domingo
      //     (domingosTrabalhadosPorMes < 4) — a alternância é combinada
      //     informalmente entre eles.
      // - Se o dia NÃO cai em nenhum período cadastrado, OU cai mas o
      //   funcionário não tem SalarioPeriodo pra esse período: gera uma
      //   linha de aviso "Sem período/salário cadastrado" em vez de
      //   Folga — não dá pra saber se seria dia de trabalho ou folga sem
      //   saber o regime e a jornada.
      const diasComRegistro = new Set(registrosFuncionario.map((r) => r.data.toISOString().split('T')[0]))
      const folgasSemRegistro: typeof registrosDiarios = []
      {
        const cursor = new Date(inicioMes)
        while (cursor <= fimMes) {
          const chave = cursor.toISOString().split('T')[0]
          if (!diasComRegistro.has(chave)) {
            const dadosDoDia = dadosSalarioNaData(cursor)
            const [anoFolga, mesFolga, diaFolga] = chave.split('-').map(Number)
            const dataMeioDia = new Date(Date.UTC(anoFolga, mesFolga - 1, diaFolga, 12, 0, 0))

            if (!dadosDoDia) {
              folgasSemRegistro.push({
                data: dataMeioDia,
                horaEntrada: null,
                horaSaida: null,
                horasBrutas: 0,
                descontoAlmoco: 0,
                horasTrabalhadas: 0,
                cargaContratual: 0,
                horasExtras: 0,
                horasDevidas: 0,
                isFalta: false,
                isFolga: false,
                isSemPeriodo: true,
                motivoFalta: null,
                passouDiretoAlmoco: false,
              })
            } else {
              const periodo = periodoNaData(cursor)!
              const domingosPorMes = dadosDoDia.domingosTrabalhadosPorMes ?? 2
              const diaSemana = cursor.getDay()
              const ehSabado = diaSemana === 6
              const ehDomingo = diaSemana === 0
              const deveSerFolga = periodo.tipo === 'SAFRA'
                ? (ehDomingo && domingosPorMes < 4)
                : (ehSabado || ehDomingo)
              if (deveSerFolga) {
                folgasSemRegistro.push({
                  // Meio-dia UTC evita que a conversão pro fuso do
                  // navegador (ex.: Brasil, UTC-3) empurre a data pro dia
                  // anterior na exibição.
                  data: dataMeioDia,
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
                  isSemPeriodo: false,
                  motivoFalta: null,
                  passouDiretoAlmoco: false,
                })
              }
            }
          }
          cursor.setDate(cursor.getDate() + 1)
        }
      }
      const registrosDiariosCompletos = [...registrosDiarios, ...folgasSemRegistro].sort(
        (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
      )

      // Cálculo acumulado (valorHorasExtras, descontoHorasDevidas e
      // descontoFaltas já vêm somados dia a dia, cada um na tarifa
      // correta, e já excluem dias sem período/salário cadastrado)
      const totalDescontos = descontoHorasDevidas + descontoFaltas

      // Total acumulado:
      // - MENSAL, mês inteiro (modo padrão): salário cheio do mês
      //   (rateado Safra/Entressafra pelos dias corridos quando o
      //   período cruza a fronteira — ver salarioBaseProporcional) +
      //   horas extras - descontos (Faltas formais e Horas Devidas). NÃO
      //   reduz proporcionalmente por dias sem registro (ex: domingos de
      //   folga) — só desconta o que está formalmente registrado como
      //   Falta ou Hora Devida.
      // - MENSAL, período customizado: não faz sentido mostrar o salário
      //   MENSAL cheio pra uma janela de poucos dias — aqui sim
      //   proporciona dia a dia (cada dia na sua tarifa), descontando
      //   domingos de folga esperados e faltas. Dias sem período/salário
      //   cadastrado não entram na soma (nem como pagáveis nem como
      //   descontados) até o cadastro ser completado. É uma ESTIMATIVA
      //   aproximada, não uma folha de pagamento oficial.
      // - DIARIO: soma cada dia efetivamente trabalhado na tarifa do seu
      //   próprio dia (fica de fora se o dia não tiver período/salário
      //   cadastrado) — diarista só recebe pelos dias que trabalhou.
      let acumuladoDiasTrabalhados: number
      if (tipoSalarioFunc === 'DIARIO') {
        acumuladoDiasTrabalhados = 0
        for (const chaveData of agregadosPorData.keys()) {
          const [yD, mD, dD] = chaveData.split('-').map(Number)
          const valorDiaDoDia = valorDiaNaData(new Date(yD, mD - 1, dD))
          if (valorDiaDoDia !== null) acumuladoDiasTrabalhados += valorDiaDoDia
        }
      } else if (periodoCustomizado) {
        // domingos/sábados de folga esperados (sem registro) e dias sem
        // período/salário já são excluídos do somatório abaixo.
        const folgaDatas = new Set(folgasSemRegistro.map((f) => f.data.toISOString().split('T')[0]))
        let soma = 0
        const cursorDias = new Date(inicioMes)
        while (cursorDias <= fimMes) {
          const chave = cursorDias.toISOString().split('T')[0]
          if (!faltasDatas.has(chave) && !folgaDatas.has(chave)) {
            const valorDiaDoDia = valorDiaNaData(cursorDias)
            if (valorDiaDoDia !== null) soma += valorDiaDoDia
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
      const totalDescontosAcumulado = periodoCustomizado && tipoSalarioFunc !== 'DIARIO'
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
        valorDia: Math.round((diasNoPeriodo > 0
          ? (tipoSalarioFunc === 'DIARIO' ? salarioBaseProporcional : salarioBaseProporcional / 30)
          : 0) * 100) / 100,
        valorHoraNormal: Math.round(valorHoraNormalMedia * 100) / 100,
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
        diasSemPeriodo,
        funcionariosSemSalario: Array.from(funcionariosSemSalario).sort(),
        resumo,
      },
    })
  } catch (error) {
    console.error('GET /api/resumo-mensal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
