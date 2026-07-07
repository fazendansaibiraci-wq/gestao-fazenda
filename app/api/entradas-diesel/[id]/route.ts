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
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entrada = await prisma.entradaDiesel.findUnique({
      where: { id: params.id },
    })

    if (!entrada) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    await prisma.entradaDiesel.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: 'Deletado com sucesso' })
  } catch (error) {
    console.error('DELETE /api/entradas-diesel/[id]:', error instanceof Error ? error.message : error)
    console.error(error instanceof Error ? error.stack : 'Sem stack disponível')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
