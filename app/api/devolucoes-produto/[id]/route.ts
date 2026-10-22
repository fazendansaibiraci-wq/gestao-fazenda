import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Excluir uma devolução = desfazer: a quantidade sai de novo do local
// para onde tinha voltado.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const devolucao = await prisma.devolucaoProduto.findUnique({
      where: { id: params.id },
      include: { produto: { select: { unidadeMedida: true } }, local: { select: { nome: true } } },
    })
    if (!devolucao) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const chave = { produtoId: devolucao.produtoId, localId: devolucao.localId }
    const estoque = await prisma.estoqueLocal.findUnique({ where: { produtoId_localId: chave } })
    const saldo = estoque?.quantidade ?? 0
    if (saldo + 0.0001 < devolucao.quantidade) {
      return NextResponse.json(
        {
          error: `Não dá pra excluir: ${devolucao.local.nome} tem só ${saldo.toLocaleString('pt-BR')} ${devolucao.produto.unidadeMedida} desse produto agora (a devolução foi de ${devolucao.quantidade.toLocaleString('pt-BR')}).`,
        },
        { status: 400 }
      )
    }

    await prisma.$transaction([
      prisma.produto.update({
        where: { id: devolucao.produtoId },
        data: { quantidadeEstoque: { decrement: devolucao.quantidade } },
      }),
      prisma.estoqueLocal.update({
        where: { produtoId_localId: chave },
        data: { quantidade: { decrement: devolucao.quantidade } },
      }),
      prisma.devolucaoProduto.delete({ where: { id: devolucao.id } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/devolucoes-produto/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
