import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Devolução ao estoque de parte de uma saída (sobrou produto).
// A quantidade volta para o local escolhido (padrão: o local de onde saiu).
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const quantidade = Number(body.quantidade)
    if (!body.saidaId || !body.data || !(quantidade > 0)) {
      return NextResponse.json({ error: 'Saída, quantidade e data são obrigatórias' }, { status: 400 })
    }

    const saida = await prisma.saidaProduto.findUnique({
      where: { id: body.saidaId },
      include: {
        produto: true,
        talhao: { select: { nome: true } },
        abastecimento: { select: { id: true } },
        devolucoes: { select: { quantidade: true } },
      },
    })
    if (!saida) return NextResponse.json({ error: 'Saída não encontrada' }, { status: 404 })
    if (saida.abastecimento) {
      return NextResponse.json({ error: 'Saída de abastecimento de diesel não tem devolução' }, { status: 400 })
    }

    const jaDevolvido = saida.devolucoes.reduce((acc, d) => acc + d.quantidade, 0)
    const podeDevolver = saida.quantidade - jaDevolvido
    if (quantidade > podeDevolver + 0.0001) {
      return NextResponse.json(
        {
          error: `Dá pra devolver no máximo ${podeDevolver.toLocaleString('pt-BR')} ${saida.produto.unidadeMedida} dessa saída (saíram ${saida.quantidade.toLocaleString('pt-BR')}, já voltaram ${jaDevolvido.toLocaleString('pt-BR')}).`,
        },
        { status: 400 }
      )
    }

    const localId: string | null = body.localId || saida.localId
    if (!localId) return NextResponse.json({ error: 'Escolha o local para onde o produto volta' }, { status: 400 })
    const local = await prisma.local.findUnique({ where: { id: localId } })
    if (!local) return NextResponse.json({ error: 'Local não encontrado' }, { status: 404 })

    const estoqueAntes = await prisma.estoqueLocal.findUnique({
      where: { produtoId_localId: { produtoId: saida.produtoId, localId } },
    })
    const saldoAntes = estoqueAntes?.quantidade ?? 0

    const devolucao = await prisma.$transaction(async (tx) => {
      const registro = await tx.devolucaoProduto.create({
        data: {
          saidaId: saida.id,
          produtoId: saida.produtoId,
          localId,
          quantidade,
          data: new Date(`${String(body.data).slice(0, 10)}T12:00:00-03:00`),
          observacao: body.observacao?.trim() || null,
          registradoPorId: session.user.id as string,
        },
      })
      await tx.produto.update({
        where: { id: saida.produtoId },
        data: { quantidadeEstoque: { increment: quantidade } },
      })
      await tx.estoqueLocal.upsert({
        where: { produtoId_localId: { produtoId: saida.produtoId, localId } },
        create: { produtoId: saida.produtoId, localId, quantidade },
        update: { quantidade: { increment: quantidade } },
      })
      return registro
    })

    return NextResponse.json({
      success: true,
      data: devolucao,
      conferencia: {
        produto: saida.produto.nomeComercial,
        unidade: saida.produto.unidadeMedida,
        local: local.nome,
        talhao: saida.talhao?.nome || null,
        quantidade,
        saldoAntes,
        saldoDepois: saldoAntes + quantidade,
        saiu: saida.quantidade,
        devolvidoTotal: jaDevolvido + quantidade,
        usado: saida.quantidade - jaDevolvido - quantidade,
      },
    })
  } catch (error) {
    console.error('POST /api/devolucoes-produto:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
