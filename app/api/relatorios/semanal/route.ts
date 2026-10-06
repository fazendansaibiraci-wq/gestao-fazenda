import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularTotaisHoras } from '@/lib/calculoTotaisFuncionario'
import { calcularCombustivelPorMaquina } from '@/lib/calculoCombustivelPorMaquina'
import { safraDaData } from '@/lib/safraPorData'

export const dynamic = 'force-dynamic'

// Relatório Semanal (Relatórios → Relatório Semanal). Semana de segunda a
// domingo, ou o mês inteiro com ?periodo=mes (aí "semana" abaixo = mês). Status das operações (atividade × talhão) pela ÁREA lançada:
// - concluída: área somada na safra ≥ área do talhão (e teve lançamento na semana),
//   OU marcada à mão (botão Concluir → EncerramentoAtividadeTalhao) com data
//   de término até o fim da semana — serve para quando não há área para medir
// - começou: primeiro lançamento dessa atividade nesse talhão (na safra) foi nesta semana
// - em andamento: já vinha de antes e teve lançamento nesta semana
// - parada: começou, não concluiu e não teve lançamento na semana (último há até 30 dias)

const DIA = 24 * 60 * 60 * 1000
const chave = (d: Date) => d.toISOString().slice(0, 10)
const TEXTO_FALTA_AUTO = 'Falta gerada automaticamente por ausência de registro'

function horasMaquinaDoRegistro(r: any): { maquinaId: string; horas: number }[] {
  const usos: { maquinaId: string; horas: number }[] = []
  if (r.maquinaId) usos.push({ maquinaId: r.maquinaId, horas: r.horasMaquina || 0 })
  for (const m of r.maquinasAdicionais || []) {
    const h = m.horasMaquina != null
      ? m.horasMaquina
      : m.horimetroFinal != null && m.horimetroInicial != null ? m.horimetroFinal - m.horimetroInicial : 0
    usos.push({ maquinaId: m.maquinaId, horas: h })
  }
  return usos
}

async function totaisDaSemana(inicio: Date, fim: Date) {
  const regs = await prisma.registroAtividade.findMany({
    where: { data: { gte: inicio, lte: fim }, isAjusteHorimetro: false },
    select: {
      id: true, funcionarioId: true, data: true, horaEntrada: true, horaSaida: true,
      horasCalculadas: true, horasprevistasdia: true, isFalta: true, passouDiretoAlmoco: true,
      areaHectares: true, maquinaId: true, horasMaquina: true,
      maquinasAdicionais: { select: { maquinaId: true, horasMaquina: true, horimetroInicial: true, horimetroFinal: true } },
    },
  })
  const abast = await prisma.abastecimentoTrator.findMany({
    where: { data: { gte: inicio, lte: fim } },
    select: { litrosAbastecidos: true },
  })
  const porFunc = new Map<string, any[]>()
  for (const r of regs) {
    if (!porFunc.has(r.funcionarioId)) porFunc.set(r.funcionarioId, [])
    porFunc.get(r.funcionarioId)!.push(r)
  }
  let extras = 0
  for (const lista of porFunc.values()) extras += calcularTotaisHoras(lista as any).totalHorasExtras
  return {
    horasHomem: regs.filter((r) => !r.isFalta).reduce((a, r) => a + (r.horasCalculadas || 0), 0),
    horasMaquina: regs.filter((r) => !r.isFalta).reduce((a, r) => a + horasMaquinaDoRegistro(r).reduce((s, u) => s + u.horas, 0), 0),
    area: regs.filter((r) => !r.isFalta).reduce((a, r) => a + (r.areaHectares || 0), 0),
    diesel: abast.reduce((a, x) => a + (x.litrosAbastecidos || 0), 0),
    horasExtras: extras,
    faltas: regs.filter((r) => r.isFalta).length,
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const inicioStr = searchParams.get('inicio')
    if (!inicioStr || !/^\d{4}-\d{2}-\d{2}$/.test(inicioStr)) {
      return NextResponse.json({ error: 'Informe o início do período' }, { status: 400 })
    }
    // periodo=mes: mês inteiro (comparado com o mês anterior); senão, semana seg–dom
    const mensal = searchParams.get('periodo') === 'mes'
    let inicio: Date, fim: Date, inicioAnt: Date, fimAnt: Date
    if (mensal) {
      const [ano, mes] = inicioStr.split('-').map(Number)
      inicio = new Date(Date.UTC(ano, mes - 1, 1))
      fim = new Date(Date.UTC(ano, mes, 1) - 1)
      inicioAnt = new Date(Date.UTC(ano, mes - 2, 1))
      fimAnt = new Date(inicio.getTime() - 1)
    } else {
      inicio = new Date(`${inicioStr}T00:00:00.000Z`)
      fim = new Date(inicio.getTime() + 7 * DIA - 1)
      inicioAnt = new Date(inicio.getTime() - 7 * DIA)
      fimAnt = new Date(inicio.getTime() - 1)
    }

    // ─── Safra da semana ──────────────────────────────────────────────────
    const safras: { id: string; nome: string; dataInicio: Date; dataFim: Date | null }[] = await prisma.safra.findMany({
      select: { id: true, nome: true, dataInicio: true, dataFim: true },
    })
    const safra: { id: string; nome: string } | null = safraDaData(safras, fim) || safraDaData(safras, inicio)

    // ─── Resumo (semana x anterior) ───────────────────────────────────────
    const [atual, anterior] = await Promise.all([totaisDaSemana(inicio, fim), totaisDaSemana(inicioAnt, fimAnt)])

    // ─── Operações (atividade × talhão) na safra até o fim da semana ──────
    const talhoes: { id: string; nome: string; area: number | null; status: string }[] = await prisma.talhao.findMany({
      select: { id: true, nome: true, area: true, status: true },
    })
    const nomeTalhao = new Map<string, string>(talhoes.map((t) => [t.id, t.nome]))
    const areaTalhao = new Map<string, number>(talhoes.map((t) => [t.id, t.area || 0]))
    const regsSafra = safra
      ? await prisma.registroAtividade.findMany({
          where: { safraId: safra.id, data: { lte: fim }, isFalta: false, isAjusteHorimetro: false, talhaoId: { not: null } },
          select: {
            data: true, tipoAtividade: true, talhaoId: true, areaHectares: true, horasCalculadas: true,
            funcionario: { select: { name: true } },
          },
        })
      : []
    const ops = new Map<string, any>()
    for (const r of regsSafra) {
      const k = `${r.tipoAtividade}|${r.talhaoId}`
      if (!ops.has(k)) ops.set(k, { atividade: r.tipoAtividade, talhaoId: r.talhaoId, area: 0, primeiro: r.data, ultimo: r.data, horasSemana: 0, quem: new Set<string>(), naSemana: false })
      const o = ops.get(k)
      o.area += r.areaHectares || 0
      if (r.data < o.primeiro) o.primeiro = r.data
      if (r.data > o.ultimo) o.ultimo = r.data
      if (r.data >= inicio && r.data <= fim) {
        o.naSemana = true
        o.horasSemana += r.horasCalculadas || 0
        const primeiroNome = (r.funcionario?.name || '').split(' ')[0]
        if (primeiroNome) o.quem.add(primeiroNome.charAt(0) + primeiroNome.slice(1).toLowerCase())
      }
    }
    // Conclusões marcadas à mão (atividade × talhão × safra)
    const encerramentos = safra
      ? await prisma.encerramentoAtividadeTalhao.findMany({
          where: { safraId: safra.id },
          select: { id: true, tipoAtividade: true, talhaoId: true, dataFim: true },
        })
      : []
    const encPorOp = new Map<string, { id: string; dataFim: Date }>(
      encerramentos.map((e) => [`${e.tipoAtividade}|${e.talhaoId}`, { id: e.id, dataFim: e.dataFim }])
    )
    const operacoes: any[] = []
    for (const [k, o] of ops.entries()) {
      const total = areaTalhao.get(o.talhaoId) || 0
      const enc = encPorOp.get(k)
      const concluidaArea = total > 0 && o.area >= total * 0.98
      const concluidaManual = !!enc && enc.dataFim <= fim
      const concluida = concluidaArea || concluidaManual
      let status: string | null = null
      if (o.naSemana) {
        if (concluida) status = 'concluida'
        else if (o.primeiro >= inicio) status = 'novo'
        else status = 'andamento'
      } else if (concluidaManual && enc!.dataFim >= inicio) {
        // marcada como concluída nesta semana, mesmo sem lançamento nela
        status = 'concluida'
      } else if (!concluida && o.ultimo >= new Date(inicio.getTime() - 30 * DIA)) {
        status = 'parada'
      }
      if (!status) continue
      operacoes.push({
        atividade: o.atividade,
        talhaoId: o.talhaoId,
        talhao: nomeTalhao.get(o.talhaoId) || '-',
        areaFeita: Math.round(o.area * 100) / 100,
        areaTalhao: total,
        status,
        concluidaPor: concluidaArea ? 'area' : concluidaManual ? 'manual' : null,
        encerramento: enc ? { id: enc.id, dataFim: chave(enc.dataFim) } : null,
        ultimoLancamento: chave(o.ultimo > fim ? fim : o.ultimo),
        quem: Array.from(o.quem).join(' · '),
        horasSemana: Math.round(o.horasSemana * 10) / 10,
      })
    }
    const ordemStatus: Record<string, number> = { novo: 0, andamento: 1, concluida: 2, parada: 3 }
    operacoes.sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status] || a.atividade.localeCompare(b.atividade) || a.talhao.localeCompare(b.talhao))

    // ─── Aplicações de insumos ────────────────────────────────────────────
    const ROT: Record<string, string> = { HERBICIDA: 'Herbicida', PULVERIZACAO: 'Pulverização', DRENCH: 'Drench', ADUBACAO: 'Adubação', CORRECAO_SOLO: 'Correção de Solo' }
    const itens = safra
      ? await prisma.aplicacaoInsumoItem.findMany({
          where: { safraId: safra.id, data: { lte: fim } },
          select: { atividade: true, numAplicacao: true, talhaoId: true, numBombas: true, data: true },
        })
      : []
    const grupos = new Map<string, any>()
    for (const it of itens) {
      const k = `${it.atividade}|${String(it.numAplicacao || '1').trim()}`
      if (!grupos.has(k)) grupos.set(k, { atividade: it.atividade, num: String(it.numAplicacao || '1').trim(), talhoes: new Map<string, number>(), ultimo: it.data, primeiro: it.data, bombasSemana: 0 })
      const g = grupos.get(k)
      // bombas por talhão/dia: pega o maior nº de bombas do talhão no dia (cada produto repete o mesmo nº)
      const kt = `${it.talhaoId}|${chave(it.data)}`
      g.talhoes.set(it.talhaoId, 1)
      if (it.data > g.ultimo) g.ultimo = it.data
      if (it.data < g.primeiro) g.primeiro = it.data
      if (it.data >= inicio && it.data <= fim) {
        g.bombasPorTalhaoDia = g.bombasPorTalhaoDia || new Map<string, number>()
        g.bombasPorTalhaoDia.set(kt, Math.max(g.bombasPorTalhaoDia.get(kt) || 0, it.numBombas || 0))
      }
    }
    const aplicacoes: any[] = []
    for (const g of grupos.values()) {
      if (g.ultimo < new Date(inicio.getTime() - 30 * DIA)) continue
      // "Faltam": talhões da aplicação anterior da mesma atividade que ainda não entraram nesta
      const anterior = grupos.get(`${g.atividade}|${Number(g.num) - 1}`)
      const feitos = Array.from(g.talhoes.keys()).map((id) => nomeTalhao.get(id as string) || '-').sort()
      const faltam = anterior
        ? Array.from(anterior.talhoes.keys()).filter((id) => !g.talhoes.has(id)).map((id) => nomeTalhao.get(id as string) || '-').sort()
        : []
      const bombasSemana = g.bombasPorTalhaoDia ? Array.from(g.bombasPorTalhaoDia.values()).reduce((a: number, b: any) => a + b, 0) : 0
      aplicacoes.push({
        titulo: `${g.num}ª ${ROT[g.atividade] || g.atividade}`,
        feitos,
        faltam,
        bombasSemana,
        comecouNaSemana: g.primeiro >= inicio && g.primeiro <= fim,
      })
    }

    // ─── Equipe ───────────────────────────────────────────────────────────
    const funcionarios = await prisma.user.findMany({
      where: { active: true, participaFolhaPagamento: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    const regsSemana = await prisma.registroAtividade.findMany({
      where: { data: { gte: inicio, lte: fim }, isAjusteHorimetro: false },
      select: {
        id: true, funcionarioId: true, data: true, horaEntrada: true, horaSaida: true, horasCalculadas: true,
        horasprevistasdia: true, isFalta: true, passouDiretoAlmoco: true, observacao: true,
        maquinaId: true, horasMaquina: true, horimetroInicial: true, horimetroFinal: true,
        maquinasAdicionais: { select: { maquinaId: true, horasMaquina: true, horimetroInicial: true, horimetroFinal: true } },
        funcionario: { select: { name: true } },
      },
    })
    const equipe = funcionarios
      .map((f) => {
        const regs = regsSemana.filter((r) => r.funcionarioId === f.id)
        const t = calcularTotaisHoras(regs as any)
        return {
          nome: f.name,
          horas: Math.round(t.totalHorasTrabalhadas * 10) / 10,
          extras: Math.round(t.totalHorasExtras * 10) / 10,
          faltas: regs.filter((r) => r.isFalta).length,
        }
      })
      .filter((e) => e.horas > 0 || e.faltas > 0)

    // ─── Máquinas ─────────────────────────────────────────────────────────
    const abastSemana = await prisma.abastecimentoTrator.findMany({
      where: { data: { gte: inicio, lte: fim } },
      include: { maquina: true },
    })
    const combustivel = calcularCombustivelPorMaquina(abastSemana as any, regsSemana.filter((r) => !r.isFalta) as any)
    const maquinasNomes = await prisma.maquina.findMany({ select: { id: true, nome: true } })
    const horasPorMaquina = new Map<string, number>()
    for (const r of regsSemana) {
      if (r.isFalta) continue
      for (const u of horasMaquinaDoRegistro(r)) horasPorMaquina.set(u.maquinaId, (horasPorMaquina.get(u.maquinaId) || 0) + u.horas)
    }
    const maquinas = Array.from(horasPorMaquina.entries())
      .map(([id, horas]) => {
        const c = combustivel.find((m) => m.maquinaId === id)
        return {
          nome: maquinasNomes.find((m) => m.id === id)?.nome || id,
          horas: Math.round(horas * 10) / 10,
          consumoLH: c && c.consumoMedioLH > 0 ? Math.round(c.consumoMedioLH * 10) / 10 : null,
          alerta: !!c?.divergente,
        }
      })
      .filter((m) => m.horas > 0)
      .sort((a, b) => b.horas - a.horas)

    // ─── Observações e talhões parados ────────────────────────────────────
    const observacoes = regsSemana
      .filter((r) => r.observacao && r.observacao !== TEXTO_FALTA_AUTO)
      .sort((a, b) => (a.data < b.data ? 1 : -1))
      .map((r) => ({ data: chave(r.data), funcionario: (r.funcionario?.name || '').split(' ')[0], texto: r.observacao }))
    const ultimos = await prisma.registroAtividade.groupBy({
      by: ['talhaoId'],
      where: { isFalta: false, isAjusteHorimetro: false, talhaoId: { not: null }, data: { lte: fim } },
      _max: { data: true },
    })
    const talhoesParados = ultimos
      .filter((u) => u.talhaoId && u._max.data && talhoes.find((t) => t.id === u.talhaoId)?.status === 'ATIVO')
      .map((u) => ({ talhao: nomeTalhao.get(u.talhaoId as string) || '-', dias: Math.floor((fim.getTime() - (u._max.data as Date).getTime()) / DIA) }))
      .filter((u) => u.dias > 15)
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 10)

    const arred = (x: number) => Math.round(x * 10) / 10
    return NextResponse.json({
      success: true,
      data: {
        semana: { inicio: chave(inicio), fim: chave(fim) },
        periodo: mensal ? 'mes' : 'semana',
        safra: safra?.nome || null,
        safraId: safra?.id || null,
        resumo: {
          atual: Object.fromEntries(Object.entries(atual).map(([k, v]) => [k, arred(v as number)])),
          anterior: Object.fromEntries(Object.entries(anterior).map(([k, v]) => [k, arred(v as number)])),
        },
        operacoes,
        aplicacoes,
        equipe,
        maquinas,
        observacoes,
        talhoesParados,
      },
    })
  } catch (error) {
    console.error('GET /api/relatorios/semanal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
