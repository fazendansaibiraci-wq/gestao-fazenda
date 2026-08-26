import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || ((session.user as any)?.role !== 'GESTOR' && (session.user as any)?.role !== 'GERENTE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const periodo = await prisma.periodoRegimeSalarial.findUnique({ where: { id: params.id } })
    if (!periodo) {
      return NextResponse.json({ error: 'Período não encontrado' }, { status: 404 })
    }

    await prisma.periodoRegimeSalarial.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/periodos-regime-salarial/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
