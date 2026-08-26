import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: lista os funcionários (mesmo universo de /api/funcionarios) e, pra
// cada um, o SalarioPeriodo já cadastrado (se houver) pro período
// informado — pra montar a tabela editável da aba Safra/Entressafra em
// Funcionários. Um funcionário sem SalarioPeriodo pro período aparece com
// `salario: null`, que a tela usa pra mostrar o aviso de "sem cadastro".
// `tipoSalarioCadastro` é só uma referência (o Tipo de Salário que o
// funcionário tinha no Cadastro antes dessa mudança) — usado pra
// pré-selecionar o dropdown na primeira vez que o período é aberto pra
// esse funcionário; o valor que realmente vale é o salvo em
// SalarioPeriodo.tipoSalario.
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
          select: {
            id: true,
            tipoSalario: true,
            salarioMensal: true,
            salarioDiaria: true,
            valorHoraExtra: true,
            cargaHorariaSegSex: true,
            cargaHorariaSegQui: true,
            cargaHorariaSexta: true,
            cargaHorariaSabado: true,
            cargaHorariaDomingo: true,
            domingosTrabalhadosPorMes: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const data = funcionarios.map((f) => ({
      id: f.id,
      name: f.name,
      tipoSalarioCadastro: f.tipoSalario,
      salario: f.salariosPeriodo[0] || null,
    }))

    return NextResponse.json({ success: true, data, periodo })
  } catch (error) {
    console.error('GET /api/salarios-periodo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: cria ou atualiza (upsert) o SalarioPeriodo de UM funcionário num
// período específico — a tela salva linha por linha. `tipoSalario` agora
// é definido por período (não mais herdado do Cadastro de Funcionário).
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || ((session.user as any)?.role !== 'GESTOR' && (session.user as any)?.role !== 'GERENTE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      funcionarioId,
      periodoRegimeSalarialId,
      tipoSalario,
      salarioMensal,
      salarioDiaria,
      valorHoraExtra,
      cargaHorariaSegSex,
      cargaHorariaSegQui,
      cargaHorariaSexta,
      cargaHorariaSabado,
      cargaHorariaDomingo,
      domingosTrabalhadosPorMes,
    } = body

    if (!funcionarioId || !periodoRegimeSalarialId) {
      return NextResponse.json({ error: 'Informe funcionarioId e periodoRegimeSalarialId' }, { status: 400 })
    }
    if (tipoSalario !== 'MENSAL' && tipoSalario !== 'DIARIO' && tipoSalario !== null && tipoSalario !== undefined && tipoSalario !== '') {
      return NextResponse.json({ error: 'tipoSalario deve ser MENSAL ou DIARIO' }, { status: 400 })
    }

    const funcionario = await prisma.user.findUnique({ where: { id: funcionarioId } })
    if (!funcionario) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }
    const periodo = await prisma.periodoRegimeSalarial.findUnique({ where: { id: periodoRegimeSalarialId } })
    if (!periodo) {
      return NextResponse.json({ error: 'Período não encontrado' }, { status: 404 })
    }

    const tipoSalarioFinal = tipoSalario === 'MENSAL' || tipoSalario === 'DIARIO' ? tipoSalario : null
    const numOuNull = (v: any) => (v !== undefined && v !== null && v !== '' ? parseFloat(v) : null)
    const intOuNull = (v: any) => (v !== undefined && v !== null && v !== '' ? parseInt(v, 10) : null)

    const dados = {
      tipoSalario: tipoSalarioFinal,
      salarioMensal: tipoSalarioFinal === 'MENSAL' ? numOuNull(salarioMensal) : null,
      salarioDiaria: tipoSalarioFinal === 'DIARIO' ? numOuNull(salarioDiaria) : null,
      valorHoraExtra: numOuNull(valorHoraExtra),
      cargaHorariaSegSex: periodo.tipo === 'SAFRA' ? numOuNull(cargaHorariaSegSex) : null,
      cargaHorariaSegQui: periodo.tipo === 'ENTRESSAFRA' ? numOuNull(cargaHorariaSegQui) : null,
      cargaHorariaSexta: periodo.tipo === 'ENTRESSAFRA' ? numOuNull(cargaHorariaSexta) : null,
      cargaHorariaSabado: numOuNull(cargaHorariaSabado),
      cargaHorariaDomingo: numOuNull(cargaHorariaDomingo),
      domingosTrabalhadosPorMes: periodo.tipo === 'SAFRA' ? intOuNull(domingosTrabalhadosPorMes) : null,
    }

    const salario = await prisma.salarioPeriodo.upsert({
      where: {
        funcionarioId_periodoRegimeSalarialId: { funcionarioId, periodoRegimeSalarialId },
      },
      create: { funcionarioId, periodoRegimeSalarialId, ...dados },
      update: dados,
    })

    return NextResponse.json({ success: true, data: salario })
  } catch (error) {
    console.error('POST /api/salarios-periodo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
