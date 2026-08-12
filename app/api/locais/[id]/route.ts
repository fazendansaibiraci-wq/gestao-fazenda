import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data: { nome?: string; status?: boolean } = {}

    if (body.nome !== undefined) {
      if (!body.nome.trim()) {
        return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
      }
      data.nome = body.nome.trim()
    }
    if (body.status !== undefined) {
      data.status = Boolean(body.status)
    }

    const local = await prisma.local.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ success: true, data: local })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Local não encontrado' }, { status: 404 })
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um local com este nome' }, { status: 409 })
    }
    console.error('PATCH /api/locais/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
