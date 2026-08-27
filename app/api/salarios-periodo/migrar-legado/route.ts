import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Migra os campos antigos fixos (User.salarioSafra/salarioEntressafra/
// valorHoraExtraSafra/valorHoraExtraEntressafra/tipoSalario/
// cargaHorariaSegSex/Sabado/Domingo/domingosPorMes +
// ConfiguracaoGlobal.cargaHorariaEntressafraSegQui/Sexta/Sabado/Domingo)
// pra dentro de SalarioPeriodo, um registro por (funcionário, período)
// já cadastrado — cada período recebe o valor do REGIME correspondente
// (períodos SAFRA recebem os campos *Safra do funcionário; períodos
// ENTRESSAFRA recebem os campos *Entressafra + a jornada global antiga).
//
// Só cria registros que ainda NÃO existem — nunca sobrescreve um
// SalarioPeriodo que já foi preenchido manualmente (mesmo que os valores
// sejam diferentes do campo antigo). Idempotente: pode rodar de novo sem
// duplicar ou reverter edições manuais já feitas.
//
// GET = dry-run (mostra o que seria criado, sem gravar nada).
// POST = aplica de verdade.

async function calcularMigracao() {
  const periodos = await prisma.periodoRegimeSalarial.findMany()
  const funcionarios = await prisma.user.findMany({
    where: { role: { in: ['FUNCIONARIO', 'GERENTE', 'AGRONOMO'] }, active: true, participaFolhaPagamento: true },
  })
  const config = await prisma.configuracaoGlobal.findFirst()
  const jaExistentes = await prisma.salarioPeriodo.findMany({
    select: { funcionarioId: true, periodoRegimeSalarialId: true },
  })
  const jaExistentesSet = new Set(jaExistentes.map((s) => `${s.funcionarioId}:${s.periodoRegimeSalarialId}`))

  const criar: any[] = []
  const pulados: { funcionario: string; periodo: string; motivo: string }[] = []

  for (const periodo of periodos) {
    for (const func of funcionarios) {
      const chave = `${func.id}:${periodo.id}`
      if (jaExistentesSet.has(chave)) {
        pulados.push({
          funcionario: func.name,
          periodo: `${periodo.tipo} ${periodo.dataInicio.toISOString().split('T')[0]} a ${periodo.dataFim.toISOString().split('T')[0]}`,
          motivo: 'já tem SalarioPeriodo cadastrado (não sobrescreve)',
        })
        continue
      }

      const tipoSalario = func.tipoSalario
      const valorAntigo = periodo.tipo === 'SAFRA' ? func.salarioSafra : func.salarioEntressafra
      const valorHoraExtraAntigo = periodo.tipo === 'SAFRA' ? func.valorHoraExtraSafra : func.valorHoraExtraEntressafra

      const dados: any = {
        funcionarioId: func.id,
        periodoRegimeSalarialId: periodo.id,
        tipoSalario,
        salarioMensal: tipoSalario === 'MENSAL' ? valorAntigo : null,
        salarioDiaria: tipoSalario === 'DIARIO' ? valorAntigo : null,
        valorHoraExtra: valorHoraExtraAntigo,
      }

      if (periodo.tipo === 'SAFRA') {
        dados.cargaHorariaSegSex = func.cargaHorariaSegSex
        dados.cargaHorariaSabado = func.cargaHorariaSabado
        dados.cargaHorariaDomingo = func.cargaHorariaDomingo
        dados.domingosTrabalhadosPorMes = func.domingosPorMes
      } else {
        dados.cargaHorariaSegQui = config?.cargaHorariaEntressafraSegQui ?? null
        dados.cargaHorariaSexta = config?.cargaHorariaEntressafraSexta ?? null
        dados.cargaHorariaSabado = config?.cargaHorariaEntressafraSabado ?? null
        dados.cargaHorariaDomingo = config?.cargaHorariaEntressafraDomingo ?? null
      }

      criar.push(dados)
    }
  }

  return { criar, pulados, totalPeriodos: periodos.length, totalFuncionarios: funcionarios.length }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || ((session.user as any)?.role !== 'GESTOR' && (session.user as any)?.role !== 'GERENTE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { criar, pulados, totalPeriodos, totalFuncionarios } = await calcularMigracao()

    return NextResponse.json({
      success: true,
      dryRun: true,
      totalPeriodos,
      totalFuncionarios,
      totalASeremCriados: criar.length,
      totalPulados: pulados.length,
      preview: criar.slice(0, 30),
      pulados: pulados.slice(0, 30),
    })
  } catch (error) {
    console.error('GET /api/salarios-periodo/migrar-legado:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || ((session.user as any)?.role !== 'GESTOR' && (session.user as any)?.role !== 'GERENTE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { criar, pulados } = await calcularMigracao()

    if (criar.length > 0) {
      await prisma.salarioPeriodo.createMany({ data: criar })
    }

    return NextResponse.json({
      success: true,
      totalCriados: criar.length,
      totalPulados: pulados.length,
    })
  } catch (error) {
    console.error('POST /api/salarios-periodo/migrar-legado:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
