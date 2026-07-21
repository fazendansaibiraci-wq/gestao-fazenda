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
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const saida = await prisma.saidaProduto.findUnique({ where: { id: params.id } })
    if (!saida) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    // Excluir a saída credita a quantidade de volta pro estoque (desfazer).
    await prisma.$transaction([
      prisma.produto.update({
        where: { id: saida.produtoId },
        data: { quantidadeEstoque: { increment: saida.quantidade } },
      }),
      prisma.saidaProduto.delete({ where: { id: params.id } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/saidas-produto/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
