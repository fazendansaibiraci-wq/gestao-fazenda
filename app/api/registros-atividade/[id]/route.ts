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

    // Verificar permissão
    if (session.user?.role === 'FUNCIONARIO' && registro.funcionarioId !== session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ success: true, data: registro })
  } catch (error) {
    console.error('GET /api/registros-atividade/[id]:', error)
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

    // Verificar permissão (funcionário só edita seus próprios)
    if (session.user?.role === 'FUNCIONARIO' && registro.funcionarioId !== session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Calcular horas se tempos foram fornecidos
    let horasCalculadas = registro.horasCalculadas
    if (body.horaEntrada && body.horaSaida) {
      const [hE, mE] = body.horaEntrada.split(':').map(Number)
      const [hS, mS] = body.horaSaida.split(':').map(Number)
      const entrada = hE * 60 + mE
      const saida = hS * 60 + mS
      if (saida > entrada) {
        horasCalculadas = (saida - entrada) / 60
      }
    }

    const updated = await prisma.registroAtividade.update({
      where: { id: params.id },
      data: {
        data: body.data ? new Date(body.data) : undefined,
        horaEntrada: body.horaEntrada || undefined,
        horaSaida: body.horaSaida,
        horasCalculadas,
        talhaoId: body.talhaoId || undefined,
        safraId: body.safraId || undefined,
        tipoAtividade: body.tipoAtividade || undefined,
        status: body.status || undefined,
        observacao: body.observacao,
        fotoEvidencia: body.fotoEvidencia,
        totalBombas: body.totalBombas || null,
        tipoAdubo: body.tipoAdubo,
        quantidadeAdubo: body.quantidadeAdubo || null,
        tipoCorretivo: body.tipoCorretivo,
        quantidadeCorretivo: body.quantidadeCorretivo || null,
        maquinaId: body.maquinaId,
        horimetroInicial: body.horimetroInicial || null,
        horimetroFinal: body.horimetroFinal || null,
        horasMaquina: body.horasMaquina || null,
        implementoUtilizado: body.implementoUtilizado,
        isFalta: body.isFalta !== undefined ? body.isFalta : undefined,
        motivoFalta: body.motivoFalta,
      },
      include: {
        talhao: { select: { nome: true } },
        safra: { select: { nome: true } },
      },
    })

    // Atualizar horímetro da máquina
    if (body.maquinaId && body.horimetroFinal) {
      await prisma.maquina.update({
        where: { id: body.maquinaId },
        data: { ultimoHorimetro: body.horimetroFinal },
      }).catch(() => {}) // Ignorar erro se máquina não existir
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PUT /api/registros-atividade/[id]:', error)
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

    // Verificar permissão (funcionário só deleta seus próprios)
    if (session.user?.role === 'FUNCIONARIO' && registro.funcionarioId !== session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.registroAtividade.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: 'Deletado com sucesso' })
  } catch (error) {
    console.error('DELETE /api/registros-atividade/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
