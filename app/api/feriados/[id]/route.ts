import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const feriado = await prisma.feriado.findUnique({ where: { id: params.id } })
    if (!feriado) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    // Apenas permitir deletar feriados municipais
    if (feriado.tipo === 'nacional' && session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Não pode deletar feriado nacional' }, { status: 403 })
    }

    await prisma.feriado.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
