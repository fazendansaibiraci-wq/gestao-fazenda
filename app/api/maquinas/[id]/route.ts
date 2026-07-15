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

    const maquina = await prisma.maquina.findUnique({ where: { id: params.id } })
    if (!maquina) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

    return NextResponse.json({ success: true, data: maquina })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'AGRONOMO', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const maquina = await prisma.maquina.findUnique({ where: { id: params.id } })
    if (!maquina) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

    const body = await request.json()
    const updated = await prisma.maquina.update({
      where: { id: params.id },
      data: {
        nome: body.nome || undefined,
        tipo: body.tipo || undefined,
        marca: body.marca,
        modelo: body.modelo,
        ano: body.ano,
        placa: body.placa,
        valor: body.valor ? parseFloat(body.valor) : null,
        valorResidual: body.valorResidual ? parseFloat(body.valorResidual) : null,
        vidaUtilHoras: body.vidaUtilHoras ? parseFloat(body.vidaUtilHoras) : null,
        status: body.status,
        ultimoHorimetro: body.ultimoHorimetro !== undefined ? parseFloat(body.ultimoHorimetro) : undefined,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const maquina = await prisma.maquina.findUnique({ where: { id: params.id } })
    if (!maquina) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

    await prisma.registroAtividade.updateMany({
      where: { maquinaId: params.id },
      data: { maquinaId: null },
    })

    await prisma.abastecimentoTrator.deleteMany({
      where: { maquinaId: params.id },
    })

    await prisma.maquina.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/maquinas/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
