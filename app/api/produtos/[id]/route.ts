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

    const produto = await prisma.produto.findUnique({ where: { id: params.id } })
    if (!produto) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const body = await request.json()
    const updated = await prisma.produto.update({
      where: { id: params.id },
      data: {
        nomeComercial: body.nomeComercial || undefined,
        categoria: body.categoria || undefined,
        unidadeMedida: body.unidadeMedida || undefined,
        valorUnitario: body.valorUnitario ? parseFloat(body.valorUnitario) : undefined,
        fornecedor: body.fornecedor,
        status: body.status !== undefined ? body.status : undefined,
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

    const produto = await prisma.produto.findUnique({ where: { id: params.id } })
    if (!produto) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    await prisma.produto.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
