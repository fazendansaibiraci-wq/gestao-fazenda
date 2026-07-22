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

    const abastecimento = await prisma.abastecimentoTrator.findUnique({
      where: { id: params.id },
      include: { saidaProduto: true },
    })

    if (!abastecimento) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // Se tinha uma Saída de Produto vinculada (diesel debitado), credita
      // de volta pro estoque e remove a saída — pra não deixar entrada
      // "solta" no histórico nem estoque incorreto.
      if (abastecimento.saidaProduto) {
        await tx.produto.update({
          where: { id: abastecimento.saidaProduto.produtoId },
          data: { quantidadeEstoque: { increment: abastecimento.saidaProduto.quantidade } },
        })
        await tx.abastecimentoTrator.delete({ where: { id: params.id } })
        await tx.saidaProduto.delete({ where: { id: abastecimento.saidaProduto.id } })
      } else {
        await tx.abastecimentoTrator.delete({ where: { id: params.id } })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/abastecimentos/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
