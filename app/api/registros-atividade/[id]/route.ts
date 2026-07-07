import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const registro = await prisma.registroAtividade.findUnique({
      where: { id: params.id },
      include: {
        talhao: true,
        safra: true,
        funcionario: { select: { name: true, email: true } },
        maquina: true,
      },
    })

    if (!registro) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    if (session.user?.role === 'FUNCIONARIO' && registro.funcionarioId !== session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ success: true, data: registro })
  } catch (error) {
    console.error('GET /api/registros-atividade/[id]:', error instanceof Error ? error.message : error)
    console.error(error instanceof Error ? error.stack : 'Sem stack disponível')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const registro = await prisma.registroAtividade.findUnique({
      where: { id: params.id },
    })

    if (!registro) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    if (session.user?.role === 'FUNCIONARIO' && registro.funcionarioId !== session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const funcionarioId = registro.funcionarioId
    const [funcionario, config] = await Promise.all([
      prisma.user.findUnique({
        where: { id: funcionarioId },
        select: {
          cargaHorariaSafra: true,
          cargaHorariaSegSex: true,
          cargaHorariaSabado: true,
          cargaHorariaDomingo: true,
          valorHoraExtraEntressafra: true,
          valorHoraExtraSafra: true,
        },
      }),
      prisma.configuracaoGlobal.findFirst(),
    ])

    const dataRegistro = new Date(body.data || registro.data)
    let estaNaSafra = false
    if (config?.inicioSafra && config?.fimSafra) {
      estaNaSafra = dataRegistro >= new Date(config.inicioSafra) && dataRegistro <= new Date(config.fimSafra)
    }

    const diaSemana = dataRegistro.getUTCDay()
    let cargaHorariaDia: number
    if (estaNaSafra) {
      cargaHorariaDia = funcionario?.cargaHorariaSafra || 8
    } else {
      if (diaSemana === 0) {
        cargaHorariaDia = funcionario?.cargaHorariaDomingo ?? (config?.cargaHorariaEntressafra || 8)
      } else if (diaSemana === 6) {
        cargaHorariaDia = funcionario?.cargaHorariaSabado ?? (config?.cargaHorariaEntressafra || 8)
      } else {
        cargaHorariaDia = funcionario?.cargaHorariaSegSex ?? (config?.cargaHorariaEntressafra || 8)
      }
    }

    let horasCalculadas = registro.horasCalculadas
    let ehHoraExtra = registro.ehHoraExtra

    if (body.horaEntrada && body.horaSaida) {
      const [hE, mE] = body.horaEntrada.split(':').map(Number)
      const [hS, mS] = body.horaSaida.split(':').map(Number)
      const entrada = hE * 60 + mE
      let saida = hS * 60 + mS
      if (saida <= entrada) {
        saida += 1440 // turno atravessou a meia-noite
      }
      const horasBrutas = (saida - entrada) / 60
      if (!body.isFalta) {
        if (!estaNaSafra) {
          horasCalculadas = Math.max(0, horasBrutas - 1)
        } else {
          horasCalculadas = body.passouDiretoAlmoco ? horasBrutas : Math.max(0, horasBrutas - 1)
        }
      }
      ehHoraExtra = horasCalculadas !== null && horasCalculadas > cargaHorariaDia
    }

    const updated = await prisma.registroAtividade.update({
      where: { id: params.id },
      data: {
        data: body.data ? new Date(body.data) : undefined,
        horaEntrada: body.horaEntrada || undefined,
        horaSaida: body.horaSaida ?? null,
        horasCalculadas,
        horasprevistasdia: cargaHorariaDia,
        talhaoId: body.talhaoId || undefined,
        safraId: body.safraId || undefined,
        tipoAtividade: body.tipoAtividade || undefined,
        status: body.status || undefined,
        observacao: body.observacao ?? null,
        fotoEvidencia: body.fotoEvidencia ?? null,
        totalBombas: body.totalBombas ?? null,
        tipoAdubo: body.tipoAdubo ?? null,
        quantidadeAdubo: body.quantidadeAdubo ?? null,
        tipoCorretivo: body.tipoCorretivo ?? null,
        quantidadeCorretivo: body.quantidadeCorretivo ?? null,
        maquinaId: body.maquinaId || null,
        horimetroInicial: body.horimetroInicial ?? null,
        horimetroFinal: body.horimetroFinal ?? null,
        horasMaquina: body.horasMaquina ?? null,
        implementoUtilizado: body.implementoUtilizado ?? null,
        isFalta: body.isFalta !== undefined ? body.isFalta : undefined,
        motivoFalta: body.motivoFalta ?? null,
        periodoFalta: body.periodoFalta ?? null,
        passouDiretoAlmoco: body.passouDiretoAlmoco !== undefined ? body.passouDiretoAlmoco : undefined,
        ehHoraExtra,
        statusAprovacao: ehHoraExtra ? 'pendente' : 'aprovado',
      },
      include: {
        talhao: { select: { nome: true } },
        safra: { select: { nome: true } },
      },
    })

    if (body.maquinaId && body.horimetroFinal) {
      await prisma.maquina.update({
        where: { id: body.maquinaId },
        data: { ultimoHorimetro: body.horimetroFinal },
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PUT /api/registros-atividade/[id]:', error instanceof Error ? error.message : error)
    console.error(error instanceof Error ? error.stack : 'Sem stack disponível')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const registro = await prisma.registroAtividade.findUnique({
      where: { id: params.id },
    })

    if (!registro) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    if (session.user?.role === 'FUNCIONARIO' && registro.funcionarioId !== session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.registroAtividade.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: 'Deletado com sucesso' })
  } catch (error) {
    console.error('DELETE /api/registros-atividade/[id]:', error instanceof Error ? error.message : error)
    console.error(error instanceof Error ? error.stack : 'Sem stack disponível')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
