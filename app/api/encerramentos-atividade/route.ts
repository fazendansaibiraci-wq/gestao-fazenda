import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Encerramento de uma atividade (Tipo de Atividade) por talhão, dentro de uma safra.
// Sem encerramento o talhão fica "Em andamento" no Relatório por Atividade.
//   GET    ?tipoAtividade=&safraId=      lista os encerramentos
//   POST   { tipoAtividade, talhaoId, safraId, dataFim: 'YYYY-MM-DD' }  encerra (ou corrige a data)
//   DELETE ?id=                          reabre o talhão

const podeEditar = (role?: string) => role === 'GESTOR' || role === 'GERENTE'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const tipoAtividade = searchParams.get('tipoAtividade')
    const safraId = searchParams.get('safraId')

    const where: any = {}
    if (tipoAtividade) where.tipoAtividade = tipoAtividade
    if (safraId) where.safraId = safraId

    const encerramentos = await prisma.encerramentoAtividadeTalhao.findMany({
      where,
      include: {
        talhao: { select: { id: true, nome: true, area: true } },
        safra: { select: { id: true, nome: true } },
        encerradoPor: { select: { id: true, name: true } },
      },
      orderBy: { dataFim: 'asc' },
    })

    return NextResponse.json({ success: true, data: encerramentos })
  } catch (error) {
    console.error('GET /api/encerramentos-atividade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !podeEditar(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const tipoAtividade = typeof body.tipoAtividade === 'string' ? body.tipoAtividade.trim() : ''
    const { talhaoId, safraId, dataFim } = body

    if (!tipoAtividade || !talhaoId || !safraId || !dataFim) {
      return NextResponse.json({ error: 'Informe atividade, talhão, safra e data de término' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataFim))) {
      return NextResponse.json({ error: 'Data de término inválida' }, { status: 400 })
    }

    const [talhao, safra] = await Promise.all([
      prisma.talhao.findUnique({ where: { id: talhaoId } }),
      prisma.safra.findUnique({ where: { id: safraId } }),
    ])
    if (!talhao) return NextResponse.json({ error: 'Talhão não encontrado' }, { status: 400 })
    if (!safra) return NextResponse.json({ error: 'Safra não encontrada' }, { status: 400 })

    // Meio-dia de Brasília: evita a data "voltar um dia" ao converter fuso.
    const data = new Date(`${dataFim}T12:00:00-03:00`)

    const encerramento = await prisma.encerramentoAtividadeTalhao.upsert({
      where: { tipoAtividade_talhaoId_safraId: { tipoAtividade, talhaoId, safraId } },
      create: { tipoAtividade, talhaoId, safraId, dataFim: data, encerradoPorId: session.user?.id as string },
      update: { dataFim: data, encerradoPorId: session.user?.id as string },
    })

    return NextResponse.json({ success: true, data: encerramento }, { status: 201 })
  } catch (error) {
    console.error('POST /api/encerramentos-atividade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !podeEditar(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Informe o id' }, { status: 400 })

    const existe = await prisma.encerramentoAtividadeTalhao.findUnique({ where: { id } })
    if (!existe) return NextResponse.json({ error: 'Encerramento não encontrado' }, { status: 404 })

    await prisma.encerramentoAtividadeTalhao.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Talhão reaberto' })
  } catch (error) {
    console.error('DELETE /api/encerramentos-atividade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
