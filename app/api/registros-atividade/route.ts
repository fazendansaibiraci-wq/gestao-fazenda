import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularCargaHorariaDia } from '@/lib/calculoCargaHoraria'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const data = searchParams.get('data')
    const mes = searchParams.get('mes')
    const status = searchParams.get('status')
    const funcionarioNome = searchParams.get('funcionario')

    const where: any = {}

    if (session.user?.role === 'FUNCIONARIO') {
      where.funcionarioId = session.user?.id
    }

    if (data) {
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

    if (!body.data || !body.horaEntrada || !body.talhaoId || !body.safraId) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
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
    }

    const funcionarioId = body.funcionarioId || session.user?.id as string
    const [funcionario, config] = await Promise.all([
      prisma.user.findUnique({
        where: { id: funcionarioId },
        select: {
          cargaHorariaSafra: true,
          cargaHorariaSegSex: true,
          cargaHorariaSabado: true,
          cargaHorariaDomingo: true,
          domingosPorMes: true,
          valorHoraExtraEntressafra: true,
          valorHoraExtraSafra: true,
          salarioEntressafra: true,
          salarioSafra: true,
          tipoSalario: true,
        },
      }),
      prisma.configuracaoGlobal.findFirst(),
    ])

    // Detectar safra
    let estaNaSafra = false
    if (config?.inicioSafra && config?.fimSafra) {
      const dataRegistro = new Date(body.data)
      estaNaSafra = dataRegistro >= new Date(config.inicioSafra) && dataRegistro <= new Date(config.fimSafra)
    }

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

    if (horasBrutas !== null && !body.isFalta) {
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
    const cargaHorariaDia = calcularCargaHorariaDia(dataRegistro, funcionario, config)

    // Horas extras e devidas
    let horasExtras = 0
    let horasDevidas = 0
    let ehHoraExtra = false

    if (horasCalculadas !== null && !body.isFalta) {
      if (horasCalculadas > cargaHorariaDia) {
        horasExtras = horasCalculadas - cargaHorariaDia
        ehHoraExtra = true
      } else if (horasCalculadas < cargaHorariaDia) {
        horasDevidas = cargaHorariaDia - horasCalculadas
      }
    }

    const valorHoraExtra = estaNaSafra
      ? (funcionario?.valorHoraExtraSafra || 0)
      : (funcionario?.valorHoraExtraEntressafra || 0)

    const registro = await prisma.registroAtividade.create({
      data: {
        funcionarioId,
        data: new Date(new Date(body.data).toISOString().split('T')[0] + 'T12:00:00.000Z'),
        horaEntrada: body.horaEntrada,
        horaSaida: body.horaSaida || null,
        horasCalculadas,
        horasprevistasdia: cargaHorariaDia,
        talhaoId: body.talhaoId,
        safraId: body.safraId,
        tipoAtividade: body.tipoAtividade,
        status: body.status || 'CONCLUIDO',
        observacao: body.observacao || null,
        fotoEvidencia: body.fotoEvidencia || null,
        totalBombas: body.totalBombas || null,
        tipoAdubo: body.tipoAdubo || null,
        quantidadeAdubo: body.quantidadeAdubo || null,
        tipoCorretivo: body.tipoCorretivo || null,
        quantidadeCorretivo: body.quantidadeCorretivo || null,
        maquinaId: body.maquinaId || null,
        horimetroInicial: body.horimetroInicial || null,
        horimetroFinal: body.horimetroFinal || null,
        horasMaquina: body.horasMaquina || null,
        implementoUtilizado: body.implementoUtilizado || null,
        isFalta: body.isFalta || false,
        motivoFalta: body.motivoFalta || null,
        periodoFalta: body.periodoFalta || null,
        passouDiretoAlmoco: body.passouDiretoAlmoco || false,
        ehHoraExtra,
        statusAprovacao: ehHoraExtra ? 'pendente' : 'aprovado',
      },
      include: {
        talhao: { select: { nome: true } },
        safra: { select: { nome: true } },
      },
    })

    if (body.maquinaId && body.horimetroFinal) {
      const maquinaAtual = await prisma.maquina.findUnique({ where: { id: body.maquinaId } })
      if (maquinaAtual && body.horimetroFinal > (maquinaAtual.ultimoHorimetro || 0)) {
        await prisma.maquina.update({
          where: { id: body.maquinaId },
          data: { ultimoHorimetro: body.horimetroFinal },
        })
      }
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
