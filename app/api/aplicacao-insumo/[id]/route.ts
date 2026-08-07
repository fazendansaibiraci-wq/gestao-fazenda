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

    const item = await prisma.aplicacaoInsumoItem.findUnique({ where: { id: params.id } })
    if (!item) {
      return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
    }

    await prisma.aplicacaoInsumoItem.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true, message: 'Lançamento excluído com sucesso' })
  } catch (error) {
    console.error('DELETE /api/aplicacao-insumo/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
