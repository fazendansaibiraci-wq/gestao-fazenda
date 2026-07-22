import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fornecedor, numeroNota, serieNota, dataEmissao, chaveAcesso, itens } = body

    if (!Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: 'Nenhum item para importar' }, { status: 400 })
    }

    let criados = 0
    let atualizados = 0

    await prisma.$transaction(async (tx) => {
      for (const item of itens) {
        if (item.incluir === false) continue

        let produtoId = item.produtoId as string | null

        if (item.existe && produtoId) {
          await tx.produto.update({
            where: { id: produtoId },
            data: {
              quantidadeEstoque: { increment: item.quantidade },
              valorUnitario: item.valorUnitario,
              unidadeMedida: item.unidade,
            },
          })
          atualizados++
        } else {
          const novoProduto = await tx.produto.create({
            data: {
              nomeComercial: String(item.nome).trim(),
              categoria: item.categoria || 'outro',
              unidadeMedida: item.unidade,
              valorUnitario: item.valorUnitario,
              quantidadeEstoque: item.quantidade,
              status: true,
            },
          })
          produtoId = novoProduto.id
          criados++
        }

        await tx.entradaProduto.create({
          data: {
            produtoId: produtoId as string,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            data: new Date(dataEmissao),
            numeroNota,
            serieNota,
            fornecedor,
            chaveAcesso,
            registradoPorId: session.user.id as string,
          },
        })
      }
    })

    return NextResponse.json({ success: true, data: { criados, atualizados } })
  } catch (error) {
    console.error('POST /api/produtos/importar-nfe/confirmar:', error)
    return NextResponse.json({ error: 'Erro ao gravar os produtos' }, { status: 500 })
  }
}
