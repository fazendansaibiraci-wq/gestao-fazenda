import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: lista os funcionários (mesmo universo de /api/funcionarios) e, pra
// cada um, o SalarioPeriodo já cadastrado (se houver) pro período
// informado — pra montar a tabela editável da aba Safra/Entressafra em
// Funcionários. Um funcionário sem SalarioPeriodo pro período aparece com
// `salario: null`, que a tela usa pra mostrar o aviso de "sem cadastro".
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const periodoId = searchParams.get('periodoId')
    if (!periodoId) {
      return NextResponse.json({ error: 'Informe periodoId' }, { status: 400 })
    }

    const periodo = await prisma.periodoRegimeSalarial.findUnique({ where: { id: periodoId } })
    if (!periodo) {
      return NextResponse.json({ error: 'Período não encontrado' }, { status: 404 })
    }

    const funcionarios = await prisma.user.findMany({
      where: {
        role: { in: ['FUNCIONARIO', 'GERENTE', 'AGRONOMO'] },
        active: true,
      },
      select: {
        id: true,
        name: true,
        tipoSalario: true,
        salariosPeriodo: {
          where: { periodoRegimeSalarialId: periodoId },
          select: { id: true, salarioMensal: true, salarioDiaria: true, valorHoraExtra: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const data = funcionarios.map((f) => ({
      id: f.id,
      name: f.name,
      tipoSalario: f.tipoSalario,
      salario: f.salariosPeriodo[0] || null,
    }))

    return NextResponse.json({ success: true, data, periodo })
  } catch (error) {
    console.error('GET /api/salarios-periodo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: cria ou atualiza (upsert) o SalarioPeriodo de UM funcionário num
// período específico — a tela salva linha por linha.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || ((session.user as any)?.role !== 'GESTOR' && (session.user as any)?.role !== 'GERENTE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { funcionarioId, periodoRegimeSalarialId, salarioMensal, salarioDiaria, valorHoraExtra } = body

    if (!funcionarioId || !periodoRegimeSalarialId) {
      return NextResponse.json({ error: 'Informe funcionarioId e periodoRegimeSalarialId' }, { status: 400 })
    }

    const funcionario = await prisma.user.findUnique({ where: { id: funcionarioId } })
    if (!funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }
    const periodo = await prisma.periodoRegimeSalarial.findUnique({ where: { id: periodoRegimeSalarialId } })
    if (!periodo) {
      return NextResponse.json({ error: 'Período não encontrado' }, { status: 404 })
    }

    const salario = await prisma.salarioPeriodo.upsert({
      where: {
        funcionarioId_periodoRegimeSalarialId: { funcionarioId, periodoRegimeSalarialId },
      },
      create: {
        funcionarioId,
        periodoRegimeSalarialId,
        salarioMensal: funcionario.tipoSalario === 'MENSAL' && salarioMensal !== undefined && salarioMensal !== '' ? parseFloat(salarioMensal) : null,
        salarioDiaria: funcionario.tipoSalario === 'DIARIO' && salarioDiaria !== undefined && salarioDiaria !== '' ? parseFloat(salarioDiaria) : null,
        valorHoraExtra: valorHoraExtra !== undefined && valorHoraExtra !== '' ? parseFloat(valorHoraExtra) : null,
      },
      update: {
        salarioMensal: funcionario.tipoSalario === 'MENSAL' && salarioMensal !== undefined && salarioMensal !== '' ? parseFloat(salarioMensal) : null,
        salarioDiaria: funcionario.tipoSalario === 'DIARIO' && salarioDiaria !== undefined && salarioDiaria !== '' ? parseFloat(salarioDiaria) : null,
        valorHoraExtra: valorHoraExtra !== undefined && valorHoraExtra !== '' ? parseFloat(valorHoraExtra) : null,
      },
    })

    return NextResponse.json({ success: true, data: salario })
  } catch (error) {
    console.error('POST /api/salarios-periodo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
