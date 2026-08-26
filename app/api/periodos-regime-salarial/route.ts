import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// CRUD dos períodos de Safra/Entressafra usados pro cálculo de
// salário/hora extra/carga horária (ver comentário no model
// PeriodoRegimeSalarial, schema.prisma). Cadastrado em Configurações
// Gerais: clicar em "Safra" ou "Entressafra" abre um seletor de início e
// fim, que chama o POST abaixo.

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const periodos = await prisma.periodoRegimeSalarial.findMany({
      orderBy: { dataInicio: 'desc' },
    })

    return NextResponse.json({ success: true, data: periodos })
  } catch (error) {
    console.error('GET /api/periodos-regime-salarial:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || ((session.user as any)?.role !== 'GESTOR' && (session.user as any)?.role !== 'GERENTE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tipo, dataInicio, dataFim } = body

    if (tipo !== 'SAFRA' && tipo !== 'ENTRESSAFRA') {
      return NextResponse.json({ error: 'Informe tipo: SAFRA ou ENTRESSAFRA' }, { status: 400 })
    }
    if (!dataInicio || !dataFim) {
      return NextResponse.json({ error: 'Informe dataInicio e dataFim' }, { status: 400 })
    }

    const inicio = new Date(dataInicio + 'T00:00:00')
    const fim = new Date(dataFim + 'T00:00:00')

    if (fim < inicio) {
      return NextResponse.json({ error: 'A data final não pode ser anterior à data inicial' }, { status: 400 })
    }

    // Períodos não podem se sobrepor entre si — nem do mesmo tipo, nem
    // entre Safra e Entressafra — já que cada dia precisa ter exatamente
    // um regime. Sobreposição: existente.dataInicio <= fim novo E
    // existente.dataFim >= início novo.
    const periodosExistentes = await prisma.periodoRegimeSalarial.findMany()
    const conflito = periodosExistentes.find((p) => {
      const pInicio = new Date(p.dataInicio)
      const pFim = new Date(p.dataFim)
      pInicio.setHours(0, 0, 0, 0)
      pFim.setHours(0, 0, 0, 0)
      return pInicio <= fim && pFim >= inicio
    })

    if (conflito) {
      const formatar = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      return NextResponse.json(
        {
          error: `Esse intervalo se sobrepõe a um período já cadastrado: ${conflito.tipo} de ${formatar(
            new Date(conflito.dataInicio)
          )} a ${formatar(new Date(conflito.dataFim))}. Ajuste as datas ou remova o período existente primeiro.`,
        },
        { status: 400 }
      )
    }

    const periodo = await prisma.periodoRegimeSalarial.create({
      data: { tipo, dataInicio: inicio, dataFim: fim },
    })

    return NextResponse.json({ success: true, data: periodo })
  } catch (error) {
    console.error('POST /api/periodos-regime-salarial:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
