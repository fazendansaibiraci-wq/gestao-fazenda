import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularCargaHorariaDia } from '@/lib/calculoCargaHoraria'
import { mensagemPeriodoNaoCadastrado } from '@/lib/regimeSalarial'
import { buscarPeriodosComId, obterPeriodoNaData, buscarSalarioPeriodoFuncionario, mensagemSalarioNaoCadastrado, shimsParaCargaHoraria } from '@/lib/salarioPeriodo'
import { validarMaquinasAdicionais, atualizarUltimoHorimetroMaquinasAdicionais, MaquinaAdicionalInput } from '@/lib/registroAtividadeMaquinas'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const data = searchParams.get('data')
    const mes = searchParams.get('mes')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    const status = searchParams.get('status')
    const funcionarioNome = searchParams.get('funcionario')

    const where: any = {}

    if (session.user?.role === 'FUNCIONARIO') {
      where.funcionarioId = session.user?.id
    }

    if (dataInicio || dataFim) {
      where.data = {}
      if (dataInicio) where.data.gte = new Date(dataInicio + 'T00:00:00')
      if (dataFim) {
        const fim = new Date(dataFim + 'T00:00:00')
        fim.setDate(fim.getDate() + 1)
        where.data.lt = fim
      }
    } else if (data) {
      const dateStart = new Date(data)
      const dateEnd = new Date(data)
      dateEnd.setDate(dateEnd.getDate() + 1)
      where.data = { gte: dateStart, lt: dateEnd }
    } else if (mes) {
      const [ano, mesNum] = mes.split('-').map(Number)
      const inicioMes = new Date(ano, mesNum - 1, 1)
      const fimMes = new Date(ano, mesNum, 1)
      where.data = { gte: inicioMes, lt: fimMes }
    }

    if (status) {
      where.status = status
    }

    if (funcionarioNome) {
      where.funcionario = {
        name: { contains: funcionarioNome, mode: 'insensitive' },
      }
    }

    const registros = await prisma.registroAtividade.findMany({
      where,
      include: {
        talhao: { select: { nome: true } },
        safra: { select: { nome: true } },
        funcionario: { select: { name: true } },
        maquina: { select: { nome: true } },
        maquinasAdicionais: { include: { maquina: { select: { nome: true } } }, orderBy: { ordem: 'asc' } },
      },
      orderBy: { data: 'desc' },
    })

    return NextResponse.json({ success: true, data: registros })
  } catch (error) {
    console.error('GET /api/registros-atividade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    const NEEDS_BOMBAS = ['drench', 'pulverização', 'pulverizacao', 'herbicida']
    if (NEEDS_BOMBAS.includes((body.tipoAtividade || '').toLowerCase()) && (!body.totalBombas || Number(body.totalBombas) <= 0)) {
      return NextResponse.json(
        { error: 'Informe a quantidade de bombas usadas nessa aplicação' },
        { status: 400 }
      )
    }

    if (
      !body.data ||
      !body.horaEntrada ||
      !body.safraId ||
      (!body.isFalta && !body.isAjusteHorimetro && (!body.talhaoId || !body.horaSaida))
    ) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    // Registro de ajuste de horímetro ("Horas Não Identificadas"): campos
    // obrigatórios são outros (máquina + horímetros + observação), não os do
    // formulário normal. Ver PASSO 3/4 da spec da feature.
    if (body.isAjusteHorimetro) {
      if (!body.maquinaId || body.horimetroInicial == null || body.horimetroFinal == null || !body.observacao) {
        return NextResponse.json(
          { error: 'Para ajuste de horímetro: máquina, horímetro inicial, horímetro final e observação são obrigatórios' },
          { status: 400 }
        )
      }
    }

    if (body.maquinaId) {
      if (!body.horimetroInicial || !body.horimetroFinal) {
        return NextResponse.json(
          { error: 'Horímetro inicial e final obrigatórios ao usar máquina' },
          { status: 400 }
        )
      }
      if (body.horimetroFinal <= body.horimetroInicial) {
        return NextResponse.json(
          { error: 'Horímetro final deve ser maior que inicial' },
          { status: 400 }
        )
      }
      if (body.horimetroFinal - body.horimetroInicial > 24) {
        return NextResponse.json(
          { error: 'Diferença de horímetro inválida: máximo de 24h por registro' },
          { status: 400 }
        )
      }
      // Trava física: horímetro nunca pode retroceder em relação ao
      // horímetro final do último Registro de Atividade dessa máquina.
      // Abastecimento NÃO entra nessa conta — é uma leitura separada.
      // Exceção: ajuste de horímetro ("Horas Não Identificadas") existe
      // justamente pra preencher buracos ANTIGOS, com atividades mais novas
      // já lançadas por cima — bypassa só essa trava de retrocesso, as
      // outras (final>inicial, diff<24h) continuam valendo normalmente.
      if (!body.isAjusteHorimetro) {
        const ultimaAtividadeMaquina = await prisma.registroAtividade.findFirst({
          where: { maquinaId: body.maquinaId, horimetroFinal: { not: null } },
          orderBy: [{ data: 'desc' }, { dataCriacao: 'desc' }],
          select: { horimetroFinal: true },
        })
        const ultimoHorimetroAtividade = ultimaAtividadeMaquina?.horimetroFinal || 0
        if (body.horimetroInicial < ultimoHorimetroAtividade) {
          return NextResponse.json(
            {
              error: `Horímetro inicial (${body.horimetroInicial}h) não pode ser menor que o horímetro final do último Registro de Atividade dessa máquina (${ultimoHorimetroAtividade}h). Verifique o valor digitado.`,
            },
            { status: 400 }
          )
        }
      }
    }

    // Máquinas ADICIONAIS (troca de máquina no mesmo dia — ver
    // lib/registroAtividadeMaquinas.ts): mesma validação da máquina
    // principal, uma por uma.
    const maquinasAdicionais: MaquinaAdicionalInput[] = Array.isArray(body.maquinasAdicionais)
      ? body.maquinasAdicionais.map((m: any) => ({
          maquinaId: m.maquinaId,
          horimetroInicial: parseFloat(m.horimetroInicial),
          horimetroFinal: parseFloat(m.horimetroFinal),
          implementoUtilizado: m.implementoUtilizado || null,
        }))
      : []
    if (maquinasAdicionais.length > 0) {
      const erroMaquinasAdicionais = await validarMaquinasAdicionais(maquinasAdicionais, !!body.isAjusteHorimetro)
      if (erroMaquinasAdicionais) {
        return NextResponse.json({ error: erroMaquinasAdicionais }, { status: 400 })
      }
    }

    const funcionarioId = body.funcionarioId || session.user?.id as string
    const funcionario = await prisma.user.findUnique({
      where: { id: funcionarioId },
      select: { name: true },
    })

    // Regime salarial: determinado automaticamente pela data deste
    // registro, comparada contra os períodos cadastrados em
    // Configurações → Safra/Entressafra (ver lib/regimeSalarial.ts e o
    // model PeriodoRegimeSalarial no schema). Bloqueia o lançamento se o
    // dia não cair em nenhum período cadastrado.
    const dataDoRegistro = new Date(body.data)
    const periodosComId = await buscarPeriodosComId()
    const periodoDoDia = obterPeriodoNaData(dataDoRegistro, periodosComId)
    if (!periodoDoDia) {
      return NextResponse.json({ error: mensagemPeriodoNaoCadastrado(dataDoRegistro) }, { status: 400 })
    }
    const estaNaSafra = periodoDoDia.tipo === 'SAFRA'

    // Salário/hora extra/jornada: cadastrados por funcionário e por
    // período em Funcionários → Salário Safra/Entressafra (ver
    // lib/salarioPeriodo.ts). Bloqueia o lançamento se faltar esse
    // cadastro pro período em questão.
    const dadosSalario = await buscarSalarioPeriodoFuncionario(funcionarioId, periodoDoDia.id)
    if (!dadosSalario) {
      return NextResponse.json(
        { error: mensagemSalarioNaoCadastrado(funcionario?.name || 'Funcionário', dataDoRegistro) },
        { status: 400 }
      )
    }
    const { funcionarioShim, configShim } = shimsParaCargaHoraria(dadosSalario)

    // Calcular horas brutas
    let horasBrutas = null
    if (body.horaEntrada && body.horaSaida) {
      const [hE, mE] = body.horaEntrada.split(':').map(Number)
      const [hS, mS] = body.horaSaida.split(':').map(Number)
      const entrada = hE * 60 + mE
      let saida = hS * 60 + mS
      if (saida <= entrada) {
        saida += 1440 // turno atravessou a meia-noite
      }
      horasBrutas = (saida - entrada) / 60
    }

    // Desconto de almoço
    let horasCalculadas = horasBrutas
    let horaAlmocoComoExtra = false

    if (horasBrutas !== null && !body.isFalta && !body.isAjusteHorimetro) {
      if (!estaNaSafra) {
        horasCalculadas = Math.max(0, horasBrutas - 1)
      } else {
        if (body.passouDiretoAlmoco) {
          horasCalculadas = horasBrutas
          horaAlmocoComoExtra = true
        } else {
          horasCalculadas = Math.max(0, horasBrutas - 1)
        }
      }
    }

    // Carga horária por dia da semana
    const dataRegistro = new Date(body.data)
    const diaSemana = dataRegistro.getUTCDay() // 0=Dom, 6=Sab
    const cargaHorariaDia = calcularCargaHorariaDia(dataRegistro, funcionarioShim, configShim, false, estaNaSafra)

    // Compensação de falta via Banco de Horas: se o motivo da falta for
    // "banco_horas" e o funcionário tiver saldo suficiente, o dia deixa de
    // contar como falta e passa a ser um dia cheio trabalhado, debitando as
    // horas do Banco de Horas do funcionário.
    const isCompensacaoBancoHoras = !!body.isFalta && body.motivoFalta === 'banco_horas'
    let bancoHorasFuncionario = null as { saldoHoras: number } | null

    if (isCompensacaoBancoHoras) {
      bancoHorasFuncionario = await prisma.bancoHoras.findUnique({ where: { funcionarioId } })
      const saldoDisponivel = bancoHorasFuncionario?.saldoHoras || 0
      if (saldoDisponivel < cargaHorariaDia) {
        return NextResponse.json(
          {
            error: `Saldo insuficiente no Banco de Horas para compensar esta falta. Saldo atual: ${saldoDisponivel}h. Necessário: ${cargaHorariaDia}h.`,
          },
          { status: 400 }
        )
      }
      horasCalculadas = cargaHorariaDia
    }

    // Horas extras e devidas
    let horasExtras = 0
    let horasDevidas = 0
    let ehHoraExtra = false

    if (horasCalculadas !== null && !body.isFalta && !body.isAjusteHorimetro) {
      if (horasCalculadas > cargaHorariaDia) {
        horasExtras = horasCalculadas - cargaHorariaDia
        ehHoraExtra = true
      } else if (horasCalculadas < cargaHorariaDia) {
        horasDevidas = cargaHorariaDia - horasCalculadas
      }
    }

    const valorHoraExtra = dadosSalario.valorHoraExtra || 0

    const registro = await prisma.registroAtividade.create({
      data: {
        funcionarioId,
        data: new Date(new Date(body.data).toISOString().split('T')[0] + 'T12:00:00.000Z'),
        horaEntrada: body.horaEntrada,
        horaSaida: body.horaSaida || null,
        horasCalculadas,
        horasprevistasdia: cargaHorariaDia,
        talhaoId: isCompensacaoBancoHoras ? null : body.talhaoId,
        safraId: body.safraId,
        tipoAtividade: isCompensacaoBancoHoras ? 'BANCO_HORAS' : body.tipoAtividade,
        status: body.status || 'CONCLUIDO',
        observacao: body.observacao || null,
        fotoEvidencia: body.fotoEvidencia || null,
        totalBombas: body.totalBombas || null,
        tipoAdubo: body.tipoAdubo || null,
        quantidadeAdubo: body.quantidadeAdubo || null,
        tipoCorretivo: body.tipoCorretivo || null,
        quantidadeCorretivo: body.quantidadeCorretivo || null,
        // Só Gestor pode informar a área feita no dia (checado no
        // servidor também, não só escondido na tela) — outro perfil que
        // mandar esse campo no body é ignorado.
        areaHectares: session.user?.role === 'GESTOR' && body.areaHectares ? parseFloat(body.areaHectares) : null,
        maquinaId: body.maquinaId || null,
        horimetroInicial: body.horimetroInicial || null,
        horimetroFinal: body.horimetroFinal || null,
        horasMaquina: body.horasMaquina || null,
        implementoUtilizado: body.implementoUtilizado || null,
        isFalta: isCompensacaoBancoHoras ? false : (body.isFalta || false),
        isAjusteHorimetro: body.isAjusteHorimetro || false,
        motivoFalta: body.motivoFalta || null,
        periodoFalta: body.periodoFalta || null,
        passouDiretoAlmoco: body.passouDiretoAlmoco || false,
        ehHoraExtra,
        statusAprovacao: ehHoraExtra ? 'pendente' : 'aprovado',
        ...(maquinasAdicionais.length > 0
          ? {
              maquinasAdicionais: {
                create: maquinasAdicionais.map((m, i) => ({
                  maquinaId: m.maquinaId,
                  horimetroInicial: m.horimetroInicial,
                  horimetroFinal: m.horimetroFinal,
                  horasMaquina: parseFloat((m.horimetroFinal - m.horimetroInicial).toFixed(2)),
                  implementoUtilizado: m.implementoUtilizado || null,
                  ordem: i + 1,
                })),
              },
            }
          : {}),
      },
      include: {
        talhao: { select: { nome: true } },
        safra: { select: { nome: true } },
        maquinasAdicionais: { include: { maquina: { select: { nome: true } } } },
      },
    })

    if (maquinasAdicionais.length > 0) {
      await atualizarUltimoHorimetroMaquinasAdicionais(maquinasAdicionais)
    }

    if (body.maquinaId && body.horimetroFinal) {
      const maquinaAtual = await prisma.maquina.findUnique({ where: { id: body.maquinaId } })
      if (maquinaAtual && body.horimetroFinal > (maquinaAtual.ultimoHorimetro || 0)) {
        await prisma.maquina.update({
          where: { id: body.maquinaId },
          data: { ultimoHorimetro: body.horimetroFinal },
        })
      }
    }

    if (isCompensacaoBancoHoras && bancoHorasFuncionario) {
      await prisma.bancoHoras.update({
        where: { funcionarioId },
        data: {
          saldoHoras: { decrement: cargaHorariaDia },
          horasAbatidas: { increment: cargaHorariaDia },
        },
      })
    }

    // Se esta é uma atividade real (não falta), remove qualquer falta automática
    // ("nao_registrado") que já existia pro mesmo funcionário no mesmo dia, pra
    // evitar registro duplicado (atividade real + falta automática obsoleta).
    // Usa intervalo do dia (não igualdade exata) porque a rota de alerta de
    // ausência grava a data com formatação ligeiramente diferente.
    if (!registro.isFalta) {
      const inicioDia = new Date(registro.data)
      inicioDia.setUTCHours(0, 0, 0, 0)
      const fimDia = new Date(inicioDia)
      fimDia.setUTCDate(fimDia.getUTCDate() + 1)
      await prisma.registroAtividade.deleteMany({
        where: {
          id: { not: registro.id },
          funcionarioId: registro.funcionarioId,
          data: { gte: inicioDia, lt: fimDia },
          isFalta: true,
          motivoFalta: 'nao_registrado',
        },
      })
    }

    return NextResponse.json(
      {
        success: true,
        data: registro,
        message: 'Atividade registrada com sucesso',
        horasExtras: horasExtras > 0 ? horasExtras : null,
        horasDevidas: horasDevidas > 0 ? horasDevidas : null,
        valorHoraExtra: horasExtras > 0 ? valorHoraExtra * horasExtras : null,
        estaNaSafra,
        cargaHorariaDia,
        horaAlmocoComoExtra,
        diaSemana: ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][diaSemana],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/registros-atividade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
