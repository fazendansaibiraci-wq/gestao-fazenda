import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Uma nota = as entradas com a mesma chave de acesso (ou, sem chave, mesmo
// fornecedor + número + série).
const chaveDaNota = (e: { chaveAcesso: string | null; fornecedor: string | null; numeroNota: string | null; serieNota: string | null }) =>
  e.chaveAcesso || `${e.fornecedor || ''}|${e.numeroNota || ''}|${e.serieNota || ''}`

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    const produtoId = searchParams.get('produtoId')
    const busca = (searchParams.get('busca') || '').trim()

    // Só entradas que vieram de nota (têm número ou chave).
    const where: any = { OR: [{ chaveAcesso: { not: null } }, { numeroNota: { not: null } }] }
    if (dataInicio || dataFim) {
      where.data = {}
      if (dataInicio) where.data.gte = new Date(`${dataInicio}T00:00:00-03:00`)
      if (dataFim) where.data.lte = new Date(`${dataFim}T23:59:59.999-03:00`)
    }

    const entradas = await prisma.entradaProduto.findMany({
      where,
      include: {
        produto: { select: { id: true, nomeComercial: true, unidadeMedida: true } },
        local: { select: { nome: true } },
        registradoPor: { select: { name: true } },
      },
      orderBy: [{ data: 'desc' }, { dataCriacao: 'asc' }],
    })

    const notas = new Map<string, any>()
    for (const e of entradas) {
      const chave = chaveDaNota(e)
      if (!notas.has(chave)) {
        notas.set(chave, {
          chave,
          chaveAcesso: e.chaveAcesso,
          fornecedor: e.fornecedor,
          numeroNota: e.numeroNota,
          serieNota: e.serieNota,
          data: e.data,
          lancadaEm: e.dataCriacao,
          registradoPor: e.registradoPor?.name || null,
          local: e.local?.nome || null,
          valorTotal: 0,
          podeExcluir: true,
          itens: [] as any[],
        })
      }
      const nota = notas.get(chave)
      nota.valorTotal += e.quantidade * e.valorUnitario
      // Entradas antigas (sem local) foram depois recalculadas pela
      // importação do Ideagri: desfazer agora deixaria o saldo errado.
      if (!e.localId) nota.podeExcluir = false
      nota.itens.push({
        id: e.id,
        produtoId: e.produtoId,
        produto: e.produto?.nomeComercial,
        unidade: e.produto?.unidadeMedida,
        quantidade: e.quantidade,
        valorUnitario: e.valorUnitario,
        nomeNF: e.nomeNF,
        quantidadeNF: e.quantidadeNF,
        unidadeNF: e.unidadeNF,
        fatorConversao: e.fatorConversao,
      })
    }

    let lista = Array.from(notas.values())
    if (produtoId) lista = lista.filter((n) => n.itens.some((i: any) => i.produtoId === produtoId))
    if (busca) {
      const b = busca.toUpperCase()
      lista = lista.filter(
        (n) => (n.fornecedor || '').toUpperCase().includes(b) || (n.numeroNota || '').includes(busca)
      )
    }

    return NextResponse.json({ success: true, data: lista })
  } catch (error) {
    console.error('GET /api/entradas-nfe:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Excluir a entrada de uma nota = desfazer: tira do estoque do local o que
// cada item somou e apaga os registros. Os vínculos lembrados ficam.
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const chave = new URL(request.url).searchParams.get('chave')
    if (!chave) return NextResponse.json({ error: 'Nota não informada' }, { status: 400 })

    const candidatas = await prisma.entradaProduto.findMany({
      where: { OR: [{ chaveAcesso: chave }, { chaveAcesso: null }] },
      include: { produto: { select: { nomeComercial: true, unidadeMedida: true } }, local: { select: { nome: true } } },
    })
    const entradas = candidatas.filter((e) => chaveDaNota(e) === chave)
    if (entradas.length === 0) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })

    if (entradas.some((e) => !e.localId)) {
      return NextResponse.json(
        { error: 'Essa entrada é antiga (de antes do controle por local) e os saldos já foram refeitos pela importação do Ideagri. Não dá pra desfazer por aqui.' },
        { status: 400 }
      )
    }

    // Confere o saldo de cada produto no local antes de tirar.
    const porProdutoLocal = new Map<string, { produtoId: string; localId: string; total: number; nome: string; unidade: string; local: string }>()
    for (const e of entradas) {
      const k = `${e.produtoId}|${e.localId}`
      const atual = porProdutoLocal.get(k)
      if (atual) atual.total += e.quantidade
      else porProdutoLocal.set(k, { produtoId: e.produtoId, localId: e.localId!, total: e.quantidade, nome: e.produto.nomeComercial, unidade: e.produto.unidadeMedida, local: e.local?.nome || '' })
    }
    for (const g of Array.from(porProdutoLocal.values())) {
      const estoque = await prisma.estoqueLocal.findUnique({ where: { produtoId_localId: { produtoId: g.produtoId, localId: g.localId } } })
      const saldo = estoque?.quantidade ?? 0
      if (saldo + 0.0001 < g.total) {
        return NextResponse.json(
          { error: `Não dá pra excluir: ${g.local} tem só ${saldo.toLocaleString('pt-BR')} ${g.unidade} de ${g.nome} agora (a nota deu entrada em ${g.total.toLocaleString('pt-BR')}). Parte já foi usada.` },
          { status: 400 }
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const g of Array.from(porProdutoLocal.values())) {
        await tx.produto.update({ where: { id: g.produtoId }, data: { quantidadeEstoque: { decrement: g.total } } })
        await tx.estoqueLocal.update({
          where: { produtoId_localId: { produtoId: g.produtoId, localId: g.localId } },
          data: { quantidade: { decrement: g.total } },
        })
      }
      await tx.entradaProduto.deleteMany({ where: { id: { in: entradas.map((e) => e.id) } } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/entradas-nfe:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
