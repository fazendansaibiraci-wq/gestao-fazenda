import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseNFeXML } from '@/lib/parseNFeXML'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
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

    const nomesExistentes = await prisma.produto.findMany({ select: { id: true, nomeComercial: true } })
    const mapaExistentes = new Map<string, { id: string; nomeComercial: string }>()
    for (const p of nomesExistentes) {
      mapaExistentes.set(p.nomeComercial.trim().toUpperCase(), p)
    }

    const itensPreview = resultado.itens.map((item) => {
      const existente = mapaExistentes.get(item.nome.trim().toUpperCase())
      return {
        ...item,
        existe: !!existente,
        produtoId: existente?.id || null,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        fornecedor: resultado.fornecedor,
        numeroNota: resultado.numeroNota,
        serieNota: resultado.serieNota,
        dataEmissao: resultado.dataEmissao,
        chaveAcesso: resultado.chaveAcesso,
        itens: itensPreview,
      },
    })
  } catch (error) {
    console.error('POST /api/produtos/importar-nfe:', error)
    return NextResponse.json({ error: 'Erro ao processar a NF-e' }, { status: 500 })
  }
}
