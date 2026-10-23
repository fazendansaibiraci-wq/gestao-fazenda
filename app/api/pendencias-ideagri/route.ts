import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { contarPendenciasIdeagri, listarFilaIdeagri } from '@/lib/pendenciasIdeagri'

const GESTAO = ['GERENTE', 'GESTOR']

// GET ?contar=1        -> { total } (pro aviso no menu)
// GET ?status=lancados -> lançados nos últimos 60 dias
// GET                  -> pendentes
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !GESTAO.includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    if (searchParams.get('contar')) {
      const total = await contarPendenciasIdeagri(prisma)
      return NextResponse.json({ success: true, total })
    }
    const status = searchParams.get('status') === 'lancados' ? 'lancados' : 'pendentes'
    const itens = await listarFilaIdeagri(prisma, status)
    return NextResponse.json({ success: true, data: itens })
  } catch (error) {
    console.error('GET /api/pendencias-ideagri:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST { acao: 'marcar' | 'desmarcar', itens: [{ tipo, ids }] }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !GESTAO.includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const itens: { tipo: string; ids: string[] }[] = Array.isArray(body.itens) ? body.itens : []
    if (itens.length === 0) return NextResponse.json({ error: 'Nada selecionado' }, { status: 400 })

    const marcar = body.acao !== 'desmarcar'
    const data = marcar
      ? { lancadoIdeagriEm: new Date(), lancadoIdeagriPor: (session.user as any)?.name || null }
      : { lancadoIdeagriEm: null, lancadoIdeagriPor: null }

    const porTipo: Record<string, string[]> = {}
    for (const i of itens) {
      if (!Array.isArray(i.ids)) continue
      porTipo[i.tipo] = (porTipo[i.tipo] || []).concat(i.ids.map(String))
    }

    await prisma.$transaction(async (tx) => {
      if (porTipo.transferencia?.length) await tx.transferenciaEstoque.updateMany({ where: { id: { in: porTipo.transferencia } }, data })
      if (porTipo.saida?.length) await tx.saidaProduto.updateMany({ where: { id: { in: porTipo.saida } }, data })
      if (porTipo.devolucao?.length) await tx.devolucaoProduto.updateMany({ where: { id: { in: porTipo.devolucao } }, data })
      if (porTipo.entrada?.length) await tx.entradaProduto.updateMany({ where: { id: { in: porTipo.entrada } }, data })
      if (porTipo.ajuste?.length) await tx.ajusteEstoque.updateMany({ where: { id: { in: porTipo.ajuste } }, data })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/pendencias-ideagri:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
