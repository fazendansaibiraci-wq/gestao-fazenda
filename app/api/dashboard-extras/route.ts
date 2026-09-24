import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Dados dos gráficos novos do Dashboard (24/09/2026): nível de diesel,
// área trabalhada por atividade, calendário de presença do mês e evolução
// dos últimos 6 meses. O custo por hectare vem do /api/relatorios/custo-hh-hm.

const chave = (d: Date) => d.toISOString().split('T')[0]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const hoje = new Date()
    const ano = parseInt(searchParams.get('ano') || String(hoje.getFullYear()), 10)
    const mes = parseInt(searchParams.get('mes') || String(hoje.getMonth() + 1), 10) - 1
    const inicioMes = new Date(ano, mes, 1)
    const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59)
    const diasNoMes = new Date(ano, mes + 1, 0).getDate()

    // ─── Diesel: estoque atual (todos os locais) e média de consumo ──────
    const produtoDiesel = await prisma.produto.findFirst({
      where: { nomeComercial: { contains: 'DIESEL', mode: 'insensitive' } },
      select: { id: true, estoqueMinimo: true },
    })
    let estoqueLitros = 0
    if (produtoDiesel) {
      const locais = await prisma.estoqueLocal.findMany({
        where: { produtoId: produtoDiesel.id },
        select: { quantidade: true },
      })
      estoqueLitros = locais.reduce((acc, l) => acc + (l.quantidade || 0), 0)
    }
    // Média por dia útil (seg a sex) nos últimos 30 dias.
    const ha30 = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000)
    const abast30 = await prisma.abastecimentoTrator.findMany({
      where: { data: { gte: ha30, lte: hoje } },
      select: { litrosAbastecidos: true },
    })
    let diasUteis30 = 0
    for (let d = new Date(ha30); d <= hoje; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) diasUteis30++
    }
    const litros30 = abast30.reduce((acc, a) => acc + (a.litrosAbastecidos || 0), 0)
    const mediaDiaUtil = diasUteis30 > 0 ? litros30 / diasUteis30 : 0
    const diasUteisRestantes = mediaDiaUtil > 0 ? estoqueLitros / mediaDiaUtil : null

    // ─── Registros do mês (área por atividade + presença) ─────────────────
    const registrosMes = await prisma.registroAtividade.findMany({
      where: { data: { gte: inicioMes, lte: fimMes } },
      select: { funcionarioId: true, data: true, isFalta: true, tipoAtividade: true, areaHectares: true },
    })

    const areaMap = new Map<string, number>()
    for (const r of registrosMes) {
      if (r.isFalta || !r.areaHectares) continue
      const tipo = r.tipoAtividade || 'Outros'
      areaMap.set(tipo, (areaMap.get(tipo) || 0) + r.areaHectares)
    }
    const areaPorAtividade = Array.from(areaMap.entries())
      .map(([atividade, area]) => ({ atividade, area: Math.round(area * 100) / 100 }))
      .sort((a, b) => b.area - a.area)

    // ─── Calendário de presença ───────────────────────────────────────────
    const funcionarios = await prisma.user.findMany({
      where: { active: true, role: { in: ['FUNCIONARIO', 'AGRONOMO'] }, participaFolhaPagamento: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    const feriados = await prisma.feriado.findMany({
      where: { data: { gte: new Date(inicioMes.getTime() - 86400000), lte: new Date(fimMes.getTime() + 86400000) } },
      select: { data: true },
    })
    const datasFeriado = new Set(feriados.map((f) => chave(f.data)))
    const ferias = await prisma.feriasFuncionario.findMany({
      where: { dataInicio: { lte: fimMes }, dataFim: { gte: new Date(inicioMes.getTime() - 86400000) } },
      select: { funcionarioId: true, dataInicio: true, dataFim: true },
    })
    const diasFerias = new Set<string>()
    for (const f of ferias) {
      const c = new Date(f.dataInicio)
      while (c <= f.dataFim) {
        diasFerias.add(`${f.funcionarioId}:${chave(c)}`)
        c.setUTCDate(c.getUTCDate() + 1)
      }
    }
    const trabalhou = new Set<string>()
    const faltou = new Set<string>()
    for (const r of registrosMes) {
      const k = `${r.funcionarioId}:${chave(r.data)}`
      if (r.isFalta) faltou.add(k)
      else trabalhou.add(k)
    }
    const chaveHoje = chave(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())))
    // Status por dia: T trabalhou, F falta, E férias, H feriado, W folga
    // (fim de semana sem lançamento), '' futuro ou dia útil sem lançamento.
    const presenca = funcionarios.map((f) => {
      const dias: string[] = []
      for (let d = 1; d <= diasNoMes; d++) {
        const k = chave(new Date(Date.UTC(ano, mes, d)))
        const kk = `${f.id}:${k}`
        const dow = new Date(Date.UTC(ano, mes, d)).getUTCDay()
        let s = ''
        if (trabalhou.has(kk)) s = 'T'
        else if (diasFerias.has(kk)) s = 'E'
        else if (datasFeriado.has(k)) s = 'H'
        else if (faltou.has(kk)) s = 'F'
        else if (k > chaveHoje) s = ''
        else if (dow === 0 || dow === 6) s = 'W'
        dias.push(s)
      }
      return { funcionario: f.name, dias }
    })

    // ─── Evolução dos últimos 6 meses (até o mês escolhido) ───────────────
    const nomesMes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const inicio6 = new Date(ano, mes - 5, 1)
    const regs6 = await prisma.registroAtividade.findMany({
      where: { data: { gte: inicio6, lte: fimMes }, isFalta: false },
      select: {
        data: true,
        horasCalculadas: true,
        horasMaquina: true,
        maquinasAdicionais: { select: { horasMaquina: true, horimetroInicial: true, horimetroFinal: true } },
      },
    })
    const abast6 = await prisma.abastecimentoTrator.findMany({
      where: { data: { gte: inicio6, lte: fimMes } },
      select: { data: true, litrosAbastecidos: true },
    })
    const evolucao = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ano, mes - 5 + i, 1)
      return { chave: `${d.getFullYear()}-${d.getMonth()}`, mes: nomesMes[d.getMonth()], horasHomem: 0, horasMaquina: 0, diesel: 0 }
    })
    const idx = (data: Date) => evolucao.findIndex((e) => e.chave === `${data.getFullYear()}-${data.getMonth()}`)
    for (const r of regs6) {
      const i = idx(r.data)
      if (i < 0) continue
      evolucao[i].horasHomem += r.horasCalculadas || 0
      evolucao[i].horasMaquina += r.horasMaquina || 0
      for (const m of r.maquinasAdicionais) {
        evolucao[i].horasMaquina += m.horasMaquina != null
          ? m.horasMaquina
          : (m.horimetroFinal != null && m.horimetroInicial != null ? m.horimetroFinal - m.horimetroInicial : 0)
      }
    }
    for (const a of abast6) {
      const i = idx(a.data)
      if (i >= 0) evolucao[i].diesel += a.litrosAbastecidos || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        diesel: {
          estoqueLitros: Math.round(estoqueLitros),
          estoqueMinimo: produtoDiesel?.estoqueMinimo || 0,
          mediaDiaUtil: Math.round(mediaDiaUtil),
          diasUteisRestantes: diasUteisRestantes != null ? Math.floor(diasUteisRestantes) : null,
        },
        areaPorAtividade,
        presenca,
        diasNoMes,
        evolucao: evolucao.map(({ chave: _c, ...e }) => ({
          ...e,
          horasHomem: Math.round(e.horasHomem),
          horasMaquina: Math.round(e.horasMaquina),
          diesel: Math.round(e.diesel),
        })),
      },
    })
  } catch (error) {
    console.error('GET /api/dashboard-extras:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
