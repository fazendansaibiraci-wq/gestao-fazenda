import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcularCargaHorariaDia } from '@/lib/calculoCargaHoraria'
import { buscarPeriodosRegimeSalarial, obterRegimeNaData } from '@/lib/regimeSalarial'

// Limpeza pontual: o cron de falta automática (alertas-ausencia) gerou
// faltas em sábados/domingos ANTES da correção de 25/08/2026 que fez a
// carga horária de Entressafra variar por dia da semana (commit 23f0346).
// Essas faltas ficaram "presas" no banco — a correção do cálculo não
// apaga registros que já foram criados.
//
// Esta rota encontra e remove só as faltas automáticas (motivoFalta =
// 'nao_registrado') que caem num sábado ou domingo cuja carga horária
// esperada, pelo cadastro ATUAL (regime manual em Configurações Gerais +
// jornada do funcionário), é 0 — ou seja, dias que não deveriam ter gerado
// falta nenhuma. NUNCA mexe em falta lançada manualmente (com outro
// motivo) nem em falta automática de dia de semana (essas continuam
// válidas).
//
// Sempre roda em modo "dryRun" (só relatório, sem apagar nada) a menos que
// o body explicitamente mande `confirmar: true`.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { funcionarioId, dataInicio, dataFim, confirmar } = body

    if (!dataInicio || !dataFim) {
      return NextResponse.json({ error: 'Informe dataInicio e dataFim' }, { status: 400 })
    }

    const inicio = new Date(dataInicio + 'T00:00:00')
    const fim = new Date(dataFim + 'T23:59:59')

    const [candidatos, config] = await Promise.all([
      prisma.registroAtividade.findMany({
        where: {
          ...(funcionarioId ? { funcionarioId } : {}),
          data: { gte: inicio, lte: fim },
          isFalta: true,
          motivoFalta: 'nao_registrado',
        },
        include: {
          funcionario: {
            select: {
              id: true,
              name: true,
              cargaHorariaSegSex: true,
              cargaHorariaSabado: true,
              cargaHorariaDomingo: true,
              domingosPorMes: true,
            },
          },
        },
        orderBy: { data: 'asc' },
      }),
      prisma.configuracaoGlobal.findFirst(),
    ])

    // Regime salarial: determinado automaticamente pela data de CADA
    // registro, comparada contra os períodos cadastrados em
    // Configurações → Safra/Entressafra. Registro cujo dia não cai em
    // nenhum período cadastrado é pulado (não dá pra saber se a carga
    // esperada é 0 sem saber o regime) e reportado em `diasSemPeriodo`.
    const periodos = await buscarPeriodosRegimeSalarial()
    const diasSemPeriodo = new Set<string>()

    const paraExcluir: { id: string; data: string; funcionarioNome: string; diaSemana: string }[] = []
    const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

    for (const reg of candidatos) {
      const dataRegistro = new Date(reg.data)
      const diaSemana = dataRegistro.getUTCDay()
      if (diaSemana !== 0 && diaSemana !== 6) continue // só sábado/domingo

      const regimeDoDia = obterRegimeNaData(dataRegistro, periodos)
      if (!regimeDoDia) {
        diasSemPeriodo.add(reg.data.toISOString().split('T')[0])
        continue
      }
      const estaNaSafra = regimeDoDia === 'SAFRA'

      const cargaEsperada = calcularCargaHorariaDia(dataRegistro, reg.funcionario, config, false, estaNaSafra)
      if (cargaEsperada > 0) continue // esse dia realmente tem expectativa de trabalho — não mexe

      paraExcluir.push({
        id: reg.id,
        data: reg.data.toISOString().split('T')[0],
        funcionarioNome: reg.funcionario.name,
        diaSemana: DIAS[diaSemana],
      })
    }

    if (confirmar && paraExcluir.length > 0) {
      await prisma.registroAtividade.deleteMany({
        where: { id: { in: paraExcluir.map((m) => m.id) } },
      })
    }

    return NextResponse.json({
      success: true,
      confirmado: !!confirmar,
      totalAnalisados: candidatos.length,
      totalAlterados: paraExcluir.length,
      mudancas: paraExcluir.slice(0, 50),
      mudancasOmitidas: Math.max(0, paraExcluir.length - 50),
      diasSemPeriodo: Array.from(diasSemPeriodo).sort(),
    })
  } catch (error: any) {
    console.error('Erro ao limpar faltas de fim de semana:', error)
    return NextResponse.json({ error: 'Erro ao limpar faltas de fim de semana' }, { status: 500 })
  }
}
