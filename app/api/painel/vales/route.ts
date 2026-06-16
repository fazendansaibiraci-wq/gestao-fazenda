import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GERENTE ou GESTOR
    if (session.user?.role !== 'GERENTE' && session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7)

    const [ano, mesNum] = mes.split('-').map(Number)
    const mesStart = startOfMonth(new Date(ano, mesNum - 1))
    const mesEnd = endOfMonth(new Date(ano, mesNum - 1))

    const vales = await prisma.vale.findMany({
      where: {
        mesPagamento: mes,
      },
      include: {
        usuario: { select: { id: true, name: true } },
        lancadoPor: { select: { id: true, name: true } },
      },
      orderBy: { dataLancamento: 'desc' },
    })

    const formattedVales = vales.map((v) => ({
      id: v.id,
      funcionario: v.usuario.name,
      valor: v.valor,
      motivo: v.motivo,
      dataLancamento: v.dataLancamento,
      status: v.status,
      lancadoPor: v.lancadoPor.name,
    }))

    return NextResponse.json({ success: true, data: formattedVales })
  } catch (error) {
    console.error('GET /api/painel/vales:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GERENTE ou GESTOR
    if (session.user?.role !== 'GERENTE' && session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { usuarioId, valor, motivo, dataLancamento } = body

    if (!usuarioId || !valor || valor <= 0) {
      return NextResponse.json(
        { error: 'Campo obrigatório: usuarioId, valor (positivo)' },
        { status: 400 }
      )
    }

    // Validar se usuário existe
    const usuario = await prisma.user.findUnique({ where: { id: usuarioId } })
    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Determinar mês do vale
    const data = new Date(dataLancamento)
    const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`

    // Criar vale
    const vale = await prisma.vale.create({
      data: {
        usuarioId,
        valor: parseFloat(valor),
        motivo: motivo || undefined,
        dataLancamento: data,
        mesPagamento: mes,
        lancadoPorId: session.user?.id as string,
        status: 'PENDENTE',
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: vale,
        message: `Vale de R$ ${valor} lançado para ${usuario.name}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/painel/vales:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
