import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Feriados nacionais do Brasil 2024-2026
const FERIADOS_NACIONAIS = [
  { data: '2024-01-01', nome: 'Confraternização Universal' },
  { data: '2024-02-13', nome: 'Carnaval' },
  { data: '2024-03-29', nome: 'Sexta-feira Santa' },
  { data: '2024-04-21', nome: 'Tiradentes' },
  { data: '2024-05-01', nome: 'Dia do Trabalho' },
  { data: '2024-09-07', nome: 'Independência do Brasil' },
  { data: '2024-10-12', nome: 'Nossa Senhora Aparecida' },
  { data: '2024-11-02', nome: 'Finados' },
  { data: '2024-11-15', nome: 'Proclamação da República' },
  { data: '2024-11-20', nome: 'Consciência Negra' },
  { data: '2024-12-25', nome: 'Natal' },
  { data: '2025-01-01', nome: 'Confraternização Universal' },
  { data: '2025-03-05', nome: 'Carnaval' },
  { data: '2025-04-18', nome: 'Sexta-feira Santa' },
  { data: '2025-04-21', nome: 'Tiradentes' },
  { data: '2025-05-01', nome: 'Dia do Trabalho' },
  { data: '2025-09-07', nome: 'Independência do Brasil' },
  { data: '2025-10-12', nome: 'Nossa Senhora Aparecida' },
  { data: '2025-11-02', nome: 'Finados' },
  { data: '2025-11-15', nome: 'Proclamação da República' },
  { data: '2025-11-20', nome: 'Consciência Negra' },
  { data: '2025-12-25', nome: 'Natal' },
  { data: '2026-01-01', nome: 'Confraternização Universal' },
  { data: '2026-02-17', nome: 'Carnaval' },
  { data: '2026-04-10', nome: 'Sexta-feira Santa' },
  { data: '2026-04-21', nome: 'Tiradentes' },
  { data: '2026-05-01', nome: 'Dia do Trabalho' },
  { data: '2026-09-07', nome: 'Independência do Brasil' },
  { data: '2026-10-12', nome: 'Nossa Senhora Aparecida' },
  { data: '2026-11-02', nome: 'Finados' },
  { data: '2026-11-15', nome: 'Proclamação da República' },
  { data: '2026-11-20', nome: 'Consciência Negra' },
  { data: '2026-12-25', nome: 'Natal' },
]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const feriados = await prisma.feriado.findMany({
      orderBy: { data: 'asc' },
    })

    return NextResponse.json({ success: true, data: feriados })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    if (!body.data || !body.nome) {
      return NextResponse.json({ error: 'Data e nome são obrigatórios' }, { status: 400 })
    }

    // Verificar se já existe
    const existing = await prisma.feriado.findUnique({
      where: { data: new Date(body.data) },
    })

    if (existing) {
      return NextResponse.json({ error: 'Feriado já existe nesta data' }, { status: 409 })
    }

    const feriado = await prisma.feriado.create({
      data: {
        data: new Date(body.data),
        nome: body.nome,
        descricao: body.descricao,
        tipo: body.tipo || 'municipal',
      },
    })

    return NextResponse.json({ success: true, data: feriado }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Seedar feriados nacionais
export async function HEAD(request: NextRequest) {
  try {
    const count = await prisma.feriado.count()
    if (count === 0) {
      await Promise.all(
        FERIADOS_NACIONAIS.map((f) =>
          prisma.feriado.create({
            data: {
              data: new Date(f.data),
              nome: f.nome,
              tipo: 'nacional',
            },
          }).catch(() => {}) // Ignorar duplicatas
        )
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
