import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const maquinaId = searchParams.get('maquinaId')

    const where: any = {}
    if (maquinaId) where.maquinaId = maquinaId

    const ajustes = await prisma.ajusteHorimetro.findMany({
      where,
      include: {
        maquina: { select: { nome: true } },
        registradoPor: { select: { name: true } },
      },
      orderBy: { data: 'desc' },
    })

    return NextResponse.json({ success: true, data: ajustes })
  } catch (error) {
    console.error('GET /api/ajustes-horimetro:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.maquinaId || body.horimetroNovo == null || !body.data || !body.observacao?.trim()) {
      return NextResponse.json(
        { error: 'Máquina, horímetro correto, data e motivo são obrigatórios' },
        { status: 400 }
      )
    }

    if (body.horimetroNovo < 0) {
      return NextResponse.json({ error: 'Horímetro não pode ser negativo' }, { status: 400 })
    }

    const maquina = await prisma.maquina.findUnique({ where: { id: body.maquinaId } })
    if (!maquina) {
      return NextResponse.json({ error: 'Máquina não encontrada' }, { status: 404 })
    }

    const horimetroAnterior = maquina.ultimoHorimetro || 0

    const [ajuste] = await prisma.$transaction([
      prisma.ajusteHorimetro.create({
        data: {
          maquinaId: body.maquinaId,
          horimetroAnterior,
          horimetroNovo: body.horimetroNovo,
          data: new Date(body.data),
          observacao: body.observacao.trim(),
          registradoPorId: session.user.id as string,
        },
      }),
      prisma.maquina.update({
        where: { id: body.maquinaId },
        data: { ultimoHorimetro: body.horimetroNovo },
      }),
    ])

    return NextResponse.json({ success: true, data: ajuste })
  } catch (error) {
    console.error('POST /api/ajustes-horimetro:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
