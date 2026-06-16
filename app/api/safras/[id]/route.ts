import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'AGRONOMO', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const safra = await prisma.safra.findUnique({ where: { id: params.id } })
    if (!safra) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

    const body = await request.json()
    const updated = await prisma.safra.update({
      where: { id: params.id },
      data: {
        nome: body.nome || undefined,
        dataInicio: body.dataInicio ? new Date(body.dataInicio) : undefined,
        dataFim: body.dataFim ? new Date(body.dataFim) : null,
        status: body.status,
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

    const safra = await prisma.safra.findUnique({ where: { id: params.id } })
    if (!safra) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

    await prisma.safra.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
