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
    const itens = body.itens as {
      nome: string
      quantidadeTotal: number
      estoqueMinimoTotal: number
      unidade: string
      valorUnitarioMedio: number
      existe: boolean
      produtoId: string | null
      categoria?: string
    }[]

    if (!Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: 'Nenhum item para importar' }, { status: 400 })
    }

    let criados = 0
    let atualizados = 0

    for (const item of itens) {
      if (item.existe && item.produtoId) {
        await prisma.produto.update({
          where: { id: item.produtoId },
          data: {
            quantidadeEstoque: item.quantidadeTotal,
            estoqueMinimo: item.estoqueMinimoTotal,
            valorUnitario: item.valorUnitarioMedio,
            unidadeMedida: item.unidade,
          },
        })
        atualizados++
      } else {
        await prisma.produto.create({
          data: {
            nomeComercial: item.nome.trim(),
            categoria: item.categoria || 'outro',
            unidadeMedida: item.unidade,
            valorUnitario: item.valorUnitarioMedio,
            quantidadeEstoque: item.quantidadeTotal,
            estoqueMinimo: item.estoqueMinimoTotal,
            status: true,
          },
        })
        criados++
      }
    }

    return NextResponse.json({ success: true, data: { criados, atualizados } })
  } catch (error) {
    console.error('POST /api/produtos/importar-estoque/confirmar:', error)
    return NextResponse.json({ error: 'Erro ao gravar os produtos' }, { status: 500 })
  }
}
