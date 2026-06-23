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

    const talhao = await prisma.talhao.findUnique({
      where: { id: params.id },
    })

    if (!talhao) {
      return NextResponse.json({ error: 'Talhão não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: talhao })
  } catch (error) {
    console.error('GET /api/talhoes/[id]:', error)
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

    const talhao = await prisma.talhao.findUnique({ where: { id: params.id } })
    if (!talhao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const body = await request.json()
    const updated = await prisma.talhao.update({
      where: { id: params.id },
      data: {
        nome: body.nome || undefined,
        area: body.area ? parseFloat(body.area) : undefined,
        variedade: body.variedade,
        status: body.status,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PUT /api/talhoes/[id]:', error)
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

    const talhao = await prisma.talhao.findUnique({ where: { id: params.id } })
    if (!talhao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    await prisma.talhao.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true, message: 'Deletado com sucesso' })
  } catch (error) {
    console.error('DELETE /api/talhoes/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
