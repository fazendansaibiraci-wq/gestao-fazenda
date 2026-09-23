import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const podeGerenciar = (role?: string) => ['GESTOR', 'GERENTE'].includes(role as string)

// Datas chegam como 'YYYY-MM-DD' e são gravadas à meia-noite UTC (mesmo
// padrão dos feriados), pra chave do dia via toISOString bater certo.
const paraData = (valor: string) => new Date(`${valor}T00:00:00.000Z`)

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !podeGerenciar(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ferias = await prisma.feriasFuncionario.findMany({
      include: { funcionario: { select: { id: true, name: true } } },
      orderBy: { dataInicio: 'desc' },
    })
    return NextResponse.json({ success: true, data: ferias })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !podeGerenciar(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    if (!body.funcionarioId || !body.dataInicio || !body.dataFim) {
      return NextResponse.json({ error: 'Funcionário, data de início e data de fim são obrigatórios' }, { status: 400 })
    }
    const dataInicio = paraData(body.dataInicio)
    const dataFim = paraData(body.dataFim)
    if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
      return NextResponse.json({ error: 'Datas inválidas' }, { status: 400 })
    }
    if (dataFim < dataInicio) {
      return NextResponse.json({ error: 'A data final não pode ser anterior à data inicial' }, { status: 400 })
    }
    const conflito = await prisma.feriasFuncionario.findFirst({
      where: {
        funcionarioId: body.funcionarioId,
        dataInicio: { lte: dataFim },
        dataFim: { gte: dataInicio },
      },
    })
    if (conflito) {
      const fmt = (d: Date) => d.toISOString().split('T')[0].split('-').reverse().join('/')
      return NextResponse.json(
        { error: `Esse funcionário já tem férias cadastradas de ${fmt(conflito.dataInicio)} a ${fmt(conflito.dataFim)}, que se sobrepõem a esse intervalo.` },
        { status: 409 }
      )
    }
    const ferias = await prisma.feriasFuncionario.create({
      data: {
        funcionarioId: body.funcionarioId,
        dataInicio,
        dataFim,
        observacao: body.observacao || null,
      },
      include: { funcionario: { select: { id: true, name: true } } },
    })
    return NextResponse.json({ success: true, data: ferias }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
