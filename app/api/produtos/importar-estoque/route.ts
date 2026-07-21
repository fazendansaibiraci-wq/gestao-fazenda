import { CanvasFactory } from 'pdf-parse/worker'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseInventarioIdeagri } from '@/lib/parseInventarioIdeagri'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { PDFParse } = require('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer), CanvasFactory })
    let textoExtraido: string
    try {
      const resultado = await parser.getText()
      textoExtraido = resultado.text
    } finally {
      await parser.destroy()
    }

    const { produtos, linhasNaoReconhecidas } = parseInventarioIdeagri(textoExtraido)

    if (produtos.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum produto foi identificado nesse PDF. Confira se é o arquivo de Inventário certo.' },
        { status: 400 }
      )
    }

    const nomesExistentes = await prisma.produto.findMany({
      select: { id: true, nomeComercial: true },
    })
    const mapaExistentes = new Map<string, { id: string; nomeComercial: string }>()
    for (const p of nomesExistentes) {
      mapaExistentes.set(p.nomeComercial.trim().toUpperCase(), p)
    }

    const preview = produtos.map((p) => {
      const existente = mapaExistentes.get(p.nome.trim().toUpperCase())
      return {
        nome: p.nome,
        quantidadeTotal: p.quantidadeTotal,
        estoqueMinimoTotal: p.estoqueMinimoTotal,
        unidade: p.unidade,
        valorUnitarioMedio: p.valorUnitarioMedio,
        locais: p.locais,
        existe: !!existente,
        produtoId: existente?.id || null,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        produtos: preview,
        linhasNaoReconhecidas,
        totalNovos: preview.filter((p) => !p.existe).length,
        totalAtualizacoes: preview.filter((p) => p.existe).length,
      },
    })
  } catch (error) {
    console.error('POST /api/produtos/importar-estoque:', error)
    return NextResponse.json({ error: 'Erro ao processar o PDF' }, { status: 500 })
  }
}
