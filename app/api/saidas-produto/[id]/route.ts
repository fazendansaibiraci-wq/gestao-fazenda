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

    const saida = await prisma.saidaProduto.findUnique({
      where: { id: params.id },
      include: { abastecimento: { select: { id: true } }, _count: { select: { devolucoes: true } } },
    })
    if (!saida) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    // Saída de abastecimento é excluída pelo Histórico de Abastecimentos,
    // senão o abastecimento ficaria sem a saída de diesel.
    if (saida.abastecimento) {
      return NextResponse.json(
        { error: 'Essa saída é de um abastecimento de diesel. Exclua pelo Histórico de Abastecimentos.' },
        { status: 400 }
      )
    }
    if (saida._count.devolucoes > 0) {
      return NextResponse.json(
        { error: 'Essa saída tem devolução registrada. Exclua a devolução primeiro.' },
        { status: 400 }
      )
    }

    // Excluir a saída credita a quantidade de volta pro estoque (desfazer).
    // Saídas antigas (antes do controle por local) têm localId nulo — nesse
    // caso só revertemos o total do produto, sem mexer em EstoqueLocal,
    // porque não temos como saber de qual local a saída teria debitado.
    const operacoes: any[] = [
      prisma.produto.update({
        where: { id: saida.produtoId },
        data: { quantidadeEstoque: { increment: saida.quantidade } },
      }),
    ]
    if (saida.localId) {
      operacoes.push(
        prisma.estoqueLocal.upsert({
          where: { produtoId_localId: { produtoId: saida.produtoId, localId: saida.localId } },
          create: { produtoId: saida.produtoId, localId: saida.localId, quantidade: saida.quantidade },
          update: { quantidade: { increment: saida.quantidade } },
        })
      )
    }
    operacoes.push(prisma.saidaProduto.delete({ where: { id: params.id } }))

    await prisma.$transaction(operacoes)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/saidas-produto/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
