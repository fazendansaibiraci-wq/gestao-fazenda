import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseNFeXML } from '@/lib/parseNFeXML'
import { normalizarNome, sugerirProduto } from '@/lib/sugerirProdutoNFe'

// Lê o XML da NF-e e devolve a prévia: cada item já ligado ao produto do
// estoque quando dá (vínculo lembrado de uma nota anterior do mesmo
// fornecedor, ou nome igual ao do cadastro). Não grava nada.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user?.role !== 'GESTOR' && session.user?.role !== 'GERENTE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const xmlTexto = buffer.toString('utf-8')

    let resultado
    try {
      resultado = parseNFeXML(xmlTexto)
    } catch (err) {
      return NextResponse.json(
        { error: 'Não foi possível ler esse arquivo como NF-e. Confira se é a XML certa (não o PDF/DANFE).' },
        { status: 400 }
      )
    }

    if (resultado.itens.length === 0) {
      return NextResponse.json({ error: 'Nenhum produto encontrado nessa nota.' }, { status: 400 })
    }

    // Nota já lançada? (mesma chave de acesso)
    let jaLancada: { data: Date; registradoPor: string | null } | null = null
    if (resultado.chaveAcesso) {
      const anterior = await prisma.entradaProduto.findFirst({
        where: { chaveAcesso: resultado.chaveAcesso },
        include: { registradoPor: { select: { name: true } } },
        orderBy: { dataCriacao: 'asc' },
      })
      if (anterior) jaLancada = { data: anterior.dataCriacao, registradoPor: anterior.registradoPor?.name || null }
    }

    const produtos = await prisma.produto.findMany({ select: { id: true, nomeComercial: true, unidadeMedida: true } })
    const porNome = new Map(produtos.map((p) => [normalizarNome(p.nomeComercial), p]))
    const porId = new Map(produtos.map((p) => [p.id, p]))

    const vinculos = resultado.cnpjFornecedor
      ? await prisma.vinculoProdutoNFe.findMany({ where: { cnpjFornecedor: resultado.cnpjFornecedor } })
      : []
    const vinculoPorCodigo = new Map(vinculos.map((v) => [v.codigoProduto, v]))

    // Mesmo nome de nota já ligado antes, por qualquer fornecedor.
    const vinculosPorNome = await prisma.vinculoProdutoNFe.findMany({
      where: { nomeNF: { in: resultado.itens.map((i) => i.nome) } },
      orderBy: { updatedAt: 'desc' },
    })
    const vinculoPorNome = new Map<string, (typeof vinculosPorNome)[number]>()
    for (const v of vinculosPorNome) {
      const k = normalizarNome(v.nomeNF)
      if (!vinculoPorNome.has(k)) vinculoPorNome.set(k, v)
    }

    const itensPreview = resultado.itens.map((item) => {
      const vinculo = item.codigo ? vinculoPorCodigo.get(item.codigo) : undefined
      if (vinculo && porId.has(vinculo.produtoId)) {
        const p = porId.get(vinculo.produtoId)!
        return { ...item, produtoId: p.id, fatorConversao: vinculo.fatorConversao, origem: 'lembrado' as const }
      }
      const outroFornecedor = vinculoPorNome.get(normalizarNome(item.nome))
      if (outroFornecedor && porId.has(outroFornecedor.produtoId)) {
        return { ...item, produtoId: outroFornecedor.produtoId, fatorConversao: outroFornecedor.fatorConversao, origem: 'lembrado' as const }
      }
      const mesmoNome = porNome.get(normalizarNome(item.nome))
      if (mesmoNome) return { ...item, produtoId: mesmoNome.id, fatorConversao: 1, origem: 'nome' as const }
      const sugerido = sugerirProduto(item.nome, produtos)
      if (sugerido) return { ...item, produtoId: sugerido.id, fatorConversao: 1, origem: 'sugestao' as const }
      return { ...item, produtoId: null, fatorConversao: 1, origem: null }
    })

    return NextResponse.json({
      success: true,
      data: {
        fornecedor: resultado.fornecedor,
        cnpjFornecedor: resultado.cnpjFornecedor,
        numeroNota: resultado.numeroNota,
        serieNota: resultado.serieNota,
        dataEmissao: resultado.dataEmissao,
        chaveAcesso: resultado.chaveAcesso,
        jaLancada,
        itens: itensPreview,
      },
    })
  } catch (error) {
    console.error('POST /api/produtos/importar-nfe:', error)
    return NextResponse.json({ error: 'Erro ao processar a NF-e' }, { status: 500 })
  }
}
