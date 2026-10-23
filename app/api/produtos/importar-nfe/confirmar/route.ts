import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { comRetry } from '@/lib/comRetry'

// Grava a entrada da NF-e: soma cada item no estoque do produto (no local
// escolhido), já convertido pra unidade do estoque (quantidade da nota ×
// fator), registra a entrada e lembra o vínculo produto-da-nota → produto
// pra próxima nota do mesmo fornecedor.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user?.role !== 'GESTOR' && session.user?.role !== 'GERENTE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fornecedor, cnpjFornecedor, numeroNota, serieNota, dataEmissao, chaveAcesso, itens, localId } = body

    const incluidos = Array.isArray(itens) ? itens.filter((i: any) => i.incluir !== false) : []
    if (incluidos.length === 0) {
      return NextResponse.json({ error: 'Nenhum item para dar entrada' }, { status: 400 })
    }
    if (!localId) {
      return NextResponse.json({ error: 'Local é obrigatório' }, { status: 400 })
    }

    const local = await prisma.local.findUnique({ where: { id: localId } })
    if (!local) {
      return NextResponse.json({ error: 'Local não encontrado' }, { status: 404 })
    }

    if (chaveAcesso) {
      const jaExiste = await prisma.entradaProduto.findFirst({ where: { chaveAcesso } })
      if (jaExiste) {
        return NextResponse.json(
          { error: `Essa nota já teve entrada em ${jaExiste.dataCriacao.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Pra lançar de novo, exclua a entrada anterior em Entradas de NF-e.` },
          { status: 400 }
        )
      }
    }

    for (const item of incluidos) {
      const fator = Number(item.fatorConversao)
      if (!(fator > 0)) {
        return NextResponse.json({ error: `Conversão inválida em "${item.nome}"` }, { status: 400 })
      }
      if (!item.produtoId && !String(item.unidadeEstoque || item.unidade || '').trim()) {
        return NextResponse.json({ error: `Informe a unidade do produto novo "${item.nome}"` }, { status: 400 })
      }
    }

    let criados = 0
    let atualizados = 0
    const conferencia: { produto: string; unidade: string; antes: number; entrou: number; depois: number; novo: boolean }[] = []

    await comRetry(() =>
      prisma.$transaction(async (tx) => {
        criados = 0
        atualizados = 0
        conferencia.length = 0
        for (const item of incluidos) {
          const fator = Number(item.fatorConversao)
          const quantidadeNF = Number(item.quantidade)
          const quantidadeEstoque = quantidadeNF * fator
          // Valor por unidade do estoque (ex.: bombona de R$ 400 com 20 l = R$ 20/l).
          const valorUnitarioEstoque = Number(item.valorUnitario) / fator

          let produtoId = item.produtoId as string | null
          let nomeProduto: string
          let unidadeProduto: string
          let novo = false

          if (produtoId) {
            // Unidade do produto não muda: a conversão já ajustou a quantidade.
            const p = await tx.produto.update({
              where: { id: produtoId },
              data: {
                quantidadeEstoque: { increment: quantidadeEstoque },
                valorUnitario: valorUnitarioEstoque,
              },
            })
            nomeProduto = p.nomeComercial
            unidadeProduto = p.unidadeMedida
            atualizados++
          } else {
            const p = await tx.produto.create({
              data: {
                nomeComercial: String(item.nomeEstoque || item.nome).trim(),
                categoria: item.categoria || 'outro',
                unidadeMedida: String(item.unidadeEstoque || item.unidade).trim().toLowerCase(),
                valorUnitario: valorUnitarioEstoque,
                quantidadeEstoque: quantidadeEstoque,
                status: true,
              },
            })
            produtoId = p.id
            nomeProduto = p.nomeComercial
            unidadeProduto = p.unidadeMedida
            novo = true
            criados++
          }

          const antes = await tx.estoqueLocal.findUnique({
            where: { produtoId_localId: { produtoId, localId } },
          })
          await tx.estoqueLocal.upsert({
            where: { produtoId_localId: { produtoId, localId } },
            create: { produtoId, localId, quantidade: quantidadeEstoque },
            update: { quantidade: { increment: quantidadeEstoque } },
          })

          await tx.entradaProduto.create({
            data: {
              produtoId,
              quantidade: quantidadeEstoque,
              valorUnitario: valorUnitarioEstoque,
              data: new Date(dataEmissao),
              numeroNota,
              serieNota,
              fornecedor,
              chaveAcesso,
              localId,
              nomeNF: item.nome,
              quantidadeNF,
              unidadeNF: item.unidade,
              fatorConversao: fator,
              registradoPorId: session.user.id as string,
            },
          })

          // Lembra o vínculo (fornecedor + código do produto) pra próxima nota.
          if (cnpjFornecedor && item.codigo) {
            await tx.vinculoProdutoNFe.upsert({
              where: { cnpjFornecedor_codigoProduto: { cnpjFornecedor, codigoProduto: String(item.codigo) } },
              create: { cnpjFornecedor, codigoProduto: String(item.codigo), nomeNF: item.nome, produtoId, fatorConversao: fator },
              update: { nomeNF: item.nome, produtoId, fatorConversao: fator },
            })
          }

          const saldoAntes = antes?.quantidade ?? 0
          conferencia.push({
            produto: nomeProduto,
            unidade: unidadeProduto,
            antes: saldoAntes,
            entrou: quantidadeEstoque,
            depois: saldoAntes + quantidadeEstoque,
            novo,
          })
        }
      })
    )

    return NextResponse.json({ success: true, data: { criados, atualizados, local: local.nome, conferencia } })
  } catch (error) {
    console.error('POST /api/produtos/importar-nfe/confirmar:', error)
    return NextResponse.json({ error: 'Erro ao gravar os produtos' }, { status: 500 })
  }
}
