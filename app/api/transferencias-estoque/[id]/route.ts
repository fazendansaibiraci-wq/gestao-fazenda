import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Excluir uma transferência = desfazer: a quantidade volta pro local de
// origem, sai do local de destino, e o registro some do histórico.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Apenas GESTOR ou GERENTE podem excluir transferências' }, { status: 403 })
    }

    const transferencia = await prisma.transferenciaEstoque.findUnique({
      where: { id: params.id },
      include: {
        produto: { select: { unidadeMedida: true } },
        localDestino: { select: { nome: true } },
      },
    })
    if (!transferencia) {
      return NextResponse.json({ error: 'Transferência não encontrada' }, { status: 404 })
    }

    const chaveDestino = { produtoId: transferencia.produtoId, localId: transferencia.localDestinoId }
    const estoqueDestino = await prisma.estoqueLocal.findUnique({ where: { produtoId_localId: chaveDestino } })
    const saldoDestino = estoqueDestino?.quantidade ?? 0
    // Se o produto já foi usado no destino, desfazer deixaria saldo negativo.
    if (saldoDestino + 0.0001 < transferencia.quantidade) {
      return NextResponse.json(
        {
          error: `Não dá pra excluir: ${transferencia.localDestino.nome} tem só ${saldoDestino.toLocaleString('pt-BR')} ${transferencia.produto.unidadeMedida} desse produto agora (a transferência foi de ${transferencia.quantidade.toLocaleString('pt-BR')}).`,
        },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.estoqueLocal.upsert({
        where: { produtoId_localId: { produtoId: transferencia.produtoId, localId: transferencia.localOrigemId } },
        create: { produtoId: transferencia.produtoId, localId: transferencia.localOrigemId, quantidade: transferencia.quantidade },
        update: { quantidade: { increment: transferencia.quantidade } },
      })
      await tx.estoqueLocal.update({
        where: { produtoId_localId: chaveDestino },
        data: { quantidade: { decrement: transferencia.quantidade } },
      })
      await tx.transferenciaEstoque.delete({ where: { id: transferencia.id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/transferencias-estoque/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
