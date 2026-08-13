import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Produtos que existem no sistema mas não aparecem mais no relatório
// do Ideagri (confirmado com o usuário: não existem mais em lugar
// nenhum) — zerados explicitamente depois da importação, pra não
// ficar estoque fantasma sobrando de um produto descontinuado.
const PRODUTOS_DESCONTINUADOS = [
  'AÇUCAR',
  'ARGENFRUT',
  'BR BORO 10',
  'CLORIMURON',
  'FLUTRIAFOL',
  'GESSO + CALCARIO',
  'GESSO MAG',
  'RIMON',
]

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
      locaisComQuantidade?: { local: string; localId: string | null; quantidade: number }[]
    }[]

    if (!Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: 'Nenhum item para importar' }, { status: 400 })
    }

    // Lista completa dos locais cadastrados — usada pra zerar, em cada
    // produto importado, qualquer local que não apareça mais no CSV
    // (senão um local que tinha estoque antes e sumiu do relatório
    // ficaria com saldo desatualizado pra sempre).
    const locaisCadastrados = await prisma.local.findMany({ select: { id: true } })

    let criados = 0
    let atualizados = 0

    for (const item of itens) {
      await prisma.$transaction(async (tx) => {
        let produtoId: string

        if (item.existe && item.produtoId) {
          await tx.produto.update({
            where: { id: item.produtoId },
            data: {
              quantidadeEstoque: item.quantidadeTotal,
              estoqueMinimo: item.estoqueMinimoTotal,
              valorUnitario: item.valorUnitarioMedio,
              unidadeMedida: item.unidade,
            },
          })
          produtoId = item.produtoId
          atualizados++
        } else {
          const criado = await tx.produto.create({
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
          produtoId = criado.id
          criados++
        }

        const quantidadePorLocal = new Map<string, number>()
        for (const lq of item.locaisComQuantidade || []) {
          if (!lq.localId) continue
          quantidadePorLocal.set(lq.localId, (quantidadePorLocal.get(lq.localId) || 0) + lq.quantidade)
        }

        // SET/substituição completa em TODOS os locais cadastrados, não
        // só nos que aparecem no CSV — é um snapshot do Ideagri, então
        // um local que tinha saldo antes e não aparece mais precisa
        // zerar, não ficar com o valor antigo.
        for (const local of locaisCadastrados) {
          const quantidade = quantidadePorLocal.get(local.id) ?? 0
          await tx.estoqueLocal.upsert({
            where: { produtoId_localId: { produtoId, localId: local.id } },
            create: { produtoId, localId: local.id, quantidade },
            update: { quantidade },
          })
        }
      })
    }

    // Zera os produtos descontinuados: total do produto e qualquer
    // EstoqueLocal já existente pra ele. Não cria linhas de
    // EstoqueLocal novas só pra isso.
    const produtosDescontinuadosZerados: string[] = []
    for (const nome of PRODUTOS_DESCONTINUADOS) {
      const produtoDescontinuado = await prisma.produto.findFirst({ where: { nomeComercial: nome } })
      if (!produtoDescontinuado) continue

      await prisma.$transaction(async (tx) => {
        await tx.produto.update({
          where: { id: produtoDescontinuado.id },
          data: { quantidadeEstoque: 0 },
        })
        await tx.estoqueLocal.updateMany({
          where: { produtoId: produtoDescontinuado.id },
          data: { quantidade: 0 },
        })
      })
      produtosDescontinuadosZerados.push(nome)
    }

    return NextResponse.json({
      success: true,
      data: {
        criados,
        atualizados,
        produtosComLocalAtualizado: itens.length,
        produtosDescontinuadosZerados,
      },
    })
  } catch (error) {
    console.error('POST /api/produtos/importar-estoque/confirmar:', error)
    return NextResponse.json({ error: 'Erro ao gravar os produtos' }, { status: 500 })
  }
}
