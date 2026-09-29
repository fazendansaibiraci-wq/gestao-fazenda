import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularCombustivelPorMaquina } from '@/lib/calculoCombustivelPorMaquina'
import { buscarPeriodosComId, obterPeriodoNaData, buscarTodosSalariosPeriodo } from '@/lib/salarioPeriodo'

// Relatório por Atividade (aba da tela Aplicação de Insumos).
//   GET ?tipoAtividade=PLATONA MAG&safraId=...
//
// Junta, para UMA atividade (Tipo de Atividade) numa safra:
//   - Registro de Atividades: funcionários, talhões, horas homem e horas máquina
//     (máquina principal + máquinas extras), com custo HH e HM calculados
//     igual ao relatório /api/relatorios/custo-hh-hm;
//   - Diárias de turma com o mesmo tipo de atividade;
//   - Produtos por Atividade (tabela produtos_atividade);
//   - Encerramentos por talhão (encerramentos_atividade_talhao).
// Área = área cadastrada do talhão, contada uma vez por talhão.
//
// Sigilo de salário: igual ao custo-hh-hm, NENHUM Valor HH por pessoa nem
// custo HH por funcionário é devolvido — só horas por funcionário e custos
// somados por talhão / total.
//
// Datas saem como 'YYYY-MM-DD' (componentes UTC — os registros são gravados
// à meia-noite UTC do dia; produtos e encerramentos ao meio-dia de Brasília).

const iso = (d: Date) => d.toISOString().slice(0, 10)
const maxData = (a: string | null, b: string) => (!a || b > a ? b : a)
const minData = (a: string | null, b: string) => (!a || b < a ? b : a)
const SEM_TALHAO = '__sem_talhao__'

interface AcTalhao {
  talhaoId: string
  nome: string
  area: number | null
  inicio: string | null
  ultimoLancamento: string | null
  horasHH: number
  horasHM: number
  custoHH: number
  custoHM: number
  custoTurmas: number
  custoProdutos: number
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tipoAtividade = (searchParams.get('tipoAtividade') || '').trim()
    const safraId = searchParams.get('safraId') || ''
    if (!tipoAtividade || !safraId) {
      return NextResponse.json({ error: 'Informe a atividade e a safra' }, { status: 400 })
    }

    const safra = await prisma.safra.findUnique({ where: { id: safraId }, select: { id: true, nome: true } })
    if (!safra) return NextResponse.json({ error: 'Safra não encontrada' }, { status: 404 })

    const filtroAtividade = { equals: tipoAtividade, mode: 'insensitive' as const }

    const [registros, diarias, produtosLanc, encerramentos] = await Promise.all([
      prisma.registroAtividade.findMany({
        where: { safraId, tipoAtividade: filtroAtividade, isFalta: false, isAjusteHorimetro: false },
        select: {
          talhaoId: true,
          funcionarioId: true,
          maquinaId: true,
          data: true,
          horasCalculadas: true,
          horasMaquina: true,
          talhao: { select: { nome: true, area: true } },
          funcionario: { select: { name: true, participaFolhaPagamento: true } },
          maquina: { select: { valor: true, valorResidual: true, vidaUtilHoras: true } },
          maquinasAdicionais: {
            select: {
              maquinaId: true,
              horasMaquina: true,
              horimetroInicial: true,
              horimetroFinal: true,
              maquina: { select: { valor: true, valorResidual: true, vidaUtilHoras: true } },
            },
          },
        },
      }),
      prisma.diariaTurma.findMany({
        where: { safraId, tipoAtividade: filtroAtividade },
        select: {
          data: true,
          talhaoId: true,
          turmaId: true,
          quantidadePessoas: true,
          valorTotal: true,
          talhao: { select: { nome: true, area: true } },
          turma: { select: { nome: true } },
        },
      }),
      prisma.produtoAtividade.findMany({
        where: { safraId, tipoAtividade: filtroAtividade },
        select: {
          data: true,
          talhaoId: true,
          produtoId: true,
          quantidade: true,
          unidadeSnapshot: true,
          valorTotal: true,
          talhao: { select: { nome: true, area: true } },
          produto: { select: { nomeComercial: true } },
        },
      }),
      prisma.encerramentoAtividadeTalhao.findMany({
        where: { safraId, tipoAtividade: filtroAtividade },
        select: { id: true, talhaoId: true, dataFim: true, tipoAtividade: true },
      }),
    ])

    // ─── Valor HH (mesma regra do custo-hh-hm) ─────────────────────────────
    const periodosComId = await buscarPeriodosComId()
    const todosSalarios = await buscarTodosSalariosPeriodo()
    const funcionariosSemSalario = new Set<string>()
    const calcularValorHH = (funcionarioId: string, data: Date): number | null => {
      const periodo = obterPeriodoNaData(data, periodosComId)
      if (!periodo) {
        funcionariosSemSalario.add(funcionarioId)
        return null
      }
      const dados = todosSalarios.get(`${funcionarioId}:${periodo.id}`)
      if (!dados) {
        funcionariosSemSalario.add(funcionarioId)
        return null
      }
      const salarioBase = dados.tipoSalario === 'DIARIO' ? (dados.salarioDiaria || 0) : (dados.salarioMensal || 0)
      const cargaReferencia = periodo.tipo === 'SAFRA'
        ? (dados.cargaHorariaSegSex || 8)
        : (dados.cargaHorariaSegQui || 8)
      return dados.tipoSalario === 'DIARIO' ? salarioBase / cargaReferencia : salarioBase / 220
    }

    // ─── Valor HM (mesma regra do custo-hh-hm) ─────────────────────────────
    const dadosMaquinaPorId = new Map<string, { valor: number | null; valorResidual: number | null; vidaUtilHoras: number | null }>()
    for (const r of registros) {
      if (r.maquinaId && r.maquina && !dadosMaquinaPorId.has(r.maquinaId)) dadosMaquinaPorId.set(r.maquinaId, r.maquina)
      for (const m of r.maquinasAdicionais) {
        if (m.maquinaId && m.maquina && !dadosMaquinaPorId.has(m.maquinaId)) dadosMaquinaPorId.set(m.maquinaId, m.maquina)
      }
    }
    const maquinaIds = Array.from(dadosMaquinaPorId.keys())
    const abastecimentos = maquinaIds.length > 0
      ? await prisma.abastecimentoTrator.findMany({
          where: { maquinaId: { in: maquinaIds } },
          select: { maquinaId: true, data: true, horasTrabalhadad: true, litrosAbastecidos: true, custoAbastecimento: true, valorPorLitro: true },
        })
      : []
    const combustivelPorMaquina = new Map(calcularCombustivelPorMaquina(abastecimentos).map((r) => [r.maquinaId, r]))
    const valorHMPorMaquina = new Map<string, number>()
    for (const maquinaId of maquinaIds) {
      const maquina = dadosMaquinaPorId.get(maquinaId)
      const comb = combustivelPorMaquina.get(maquinaId)
      const depreciacaoPorHora =
        maquina?.valor != null && maquina?.valorResidual != null && maquina?.vidaUtilHoras
          ? (maquina.valor - maquina.valorResidual) / maquina.vidaUtilHoras
          : 0
      const totalLitros = comb?.totalLitros || 0
      const consumoMedioLH = comb?.consumoMedioLH || 0
      const valorMedioPorLitro = totalLitros > 0 ? comb!.custoTotal / totalLitros : 0
      valorHMPorMaquina.set(maquinaId, depreciacaoPorHora + consumoMedioLH * valorMedioPorLitro)
    }

    // ─── Acumulação ────────────────────────────────────────────────────────
    const talhoes = new Map<string, AcTalhao>()
    const pegarTalhao = (id: string | null, nome?: string | null, area?: number | null) => {
      const chave = id || SEM_TALHAO
      if (!talhoes.has(chave)) {
        talhoes.set(chave, {
          talhaoId: chave,
          nome: id ? (nome || id) : 'Sem talhão',
          area: id ? (area ?? null) : null,
          inicio: null, ultimoLancamento: null,
          horasHH: 0, horasHM: 0, custoHH: 0, custoHM: 0, custoTurmas: 0, custoProdutos: 0,
        })
      }
      return talhoes.get(chave)!
    }
    const marcarData = (t: AcTalhao, d: string) => { t.inicio = minData(t.inicio, d); t.ultimoLancamento = maxData(t.ultimoLancamento, d) }

    const funcionarios = new Map<string, { funcionarioId: string; nome: string; horasHH: number; horasHM: number; dias: Set<string>; talhoes: Set<string> }>()

    for (const r of registros) {
      const d = iso(r.data)
      const t = pegarTalhao(r.talhaoId, r.talhao?.nome, r.talhao?.area)
      marcarData(t, d)

      const horasHH = r.horasCalculadas || 0
      t.horasHH += horasHH
      if (r.funcionarioId && r.funcionario?.participaFolhaPagamento !== false) {
        const valorHH = calcularValorHH(r.funcionarioId, r.data)
        if (valorHH !== null) t.custoHH += horasHH * valorHH
      }

      let horasHMRegistro = 0
      if (r.maquinaId) {
        const h = r.horasMaquina || 0
        horasHMRegistro += h
        t.custoHM += h * (valorHMPorMaquina.get(r.maquinaId) || 0)
      }
      for (const m of r.maquinasAdicionais) {
        if (!m.maquinaId) continue
        const h = m.horasMaquina != null
          ? m.horasMaquina
          : (m.horimetroFinal != null && m.horimetroInicial != null ? m.horimetroFinal - m.horimetroInicial : 0)
        horasHMRegistro += h
        t.custoHM += h * (valorHMPorMaquina.get(m.maquinaId) || 0)
      }
      t.horasHM += horasHMRegistro

      if (r.funcionarioId) {
        if (!funcionarios.has(r.funcionarioId)) {
          funcionarios.set(r.funcionarioId, {
            funcionarioId: r.funcionarioId,
            nome: r.funcionario?.name || r.funcionarioId,
            horasHH: 0, horasHM: 0, dias: new Set(), talhoes: new Set(),
          })
        }
        const f = funcionarios.get(r.funcionarioId)!
        f.horasHH += horasHH
        f.horasHM += horasHMRegistro
        f.dias.add(d)
        f.talhoes.add(t.nome)
      }
    }

    const turmas = new Map<string, { turmaId: string; nome: string; pessoasDia: number; dias: Set<string>; valorTotal: number }>()
    for (const dt of diarias) {
      const d = iso(dt.data)
      const t = pegarTalhao(dt.talhaoId, dt.talhao?.nome, dt.talhao?.area)
      marcarData(t, d)
      t.custoTurmas += dt.valorTotal || 0
      if (!turmas.has(dt.turmaId)) {
        turmas.set(dt.turmaId, { turmaId: dt.turmaId, nome: dt.turma?.nome || dt.turmaId, pessoasDia: 0, dias: new Set(), valorTotal: 0 })
      }
      const tu = turmas.get(dt.turmaId)!
      tu.pessoasDia += dt.quantidadePessoas || 0
      tu.dias.add(d)
      tu.valorTotal += dt.valorTotal || 0
    }

    const produtos = new Map<string, { produtoId: string; nome: string; unidade: string; quantidade: number; custo: number }>()
    for (const p of produtosLanc) {
      const d = iso(p.data)
      const t = pegarTalhao(p.talhaoId, p.talhao?.nome, p.talhao?.area)
      marcarData(t, d)
      t.custoProdutos += p.valorTotal || 0
      if (!produtos.has(p.produtoId)) {
        produtos.set(p.produtoId, { produtoId: p.produtoId, nome: p.produto?.nomeComercial || p.produtoId, unidade: p.unidadeSnapshot, quantidade: 0, custo: 0 })
      }
      const pr = produtos.get(p.produtoId)!
      pr.quantidade += p.quantidade || 0
      pr.custo += p.valorTotal || 0
    }

    // ─── Situação por talhão e da atividade ────────────────────────────────
    const encerramentoPorTalhao = new Map(encerramentos.map((e) => [e.talhaoId, e]))
    const listaTalhoes = Array.from(talhoes.values())
      .map((t) => {
        const enc = t.talhaoId !== SEM_TALHAO ? encerramentoPorTalhao.get(t.talhaoId) : undefined
        const custoTotal = t.custoHH + t.custoHM + t.custoTurmas + t.custoProdutos
        return {
          ...t,
          encerramento: enc ? { id: enc.id, dataFim: iso(enc.dataFim) } : null,
          custoTotal,
          custoPorHa: t.area && t.area > 0 ? custoTotal / t.area : null,
        }
      })
      .sort((a, b) => (a.talhaoId === SEM_TALHAO ? 1 : b.talhaoId === SEM_TALHAO ? -1 : a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })))

    const talhoesReais = listaTalhoes.filter((t) => t.talhaoId !== SEM_TALHAO)
    const temLancamento = listaTalhoes.length > 0
    const todosEncerrados = talhoesReais.length > 0 && talhoesReais.every((t) => t.encerramento)
    const situacao = !temLancamento ? 'SEM_LANCAMENTO' : todosEncerrados ? 'CONCLUIDA' : 'EM_ANDAMENTO'

    let inicio: string | null = null
    for (const t of listaTalhoes) if (t.inicio) inicio = minData(inicio, t.inicio)
    let fim: string | null = null
    if (situacao === 'CONCLUIDA') for (const t of talhoesReais) fim = maxData(fim, t.encerramento!.dataFim)

    const soma = (f: (t: (typeof listaTalhoes)[number]) => number) => listaTalhoes.reduce((s, t) => s + f(t), 0)
    const areaTotal = talhoesReais.reduce((s, t) => s + (t.area || 0), 0)
    const custoHH = soma((t) => t.custoHH)
    const custoHM = soma((t) => t.custoHM)
    const custoTurmas = soma((t) => t.custoTurmas)
    const custoProdutos = soma((t) => t.custoProdutos)
    const custoTotal = custoHH + custoHM + custoTurmas + custoProdutos
    const porHa = (v: number) => (areaTotal > 0 ? v / areaTotal : null)

    return NextResponse.json({
      success: true,
      data: {
        atividade: tipoAtividade,
        safra,
        resumo: {
          situacao,
          inicio,
          fim,
          areaTotal,
          nTalhoes: talhoesReais.length,
          nTalhoesEncerrados: talhoesReais.filter((t) => t.encerramento).length,
          nFuncionarios: funcionarios.size,
          horasHH: soma((t) => t.horasHH),
          horasHM: soma((t) => t.horasHM),
          custoHH,
          custoHM,
          custoTurmas,
          custoProdutos,
          custoTotal,
          porHa: {
            hh: porHa(custoHH),
            hm: porHa(custoHM),
            turmas: porHa(custoTurmas),
            produtos: porHa(custoProdutos),
            total: porHa(custoTotal),
          },
        },
        avisos: {
          funcionariosSemSalario: funcionariosSemSalario.size,
          lancamentosSemTalhao: talhoes.has(SEM_TALHAO),
          talhoesSemArea: talhoesReais.filter((t) => !t.area || t.area <= 0).map((t) => t.nome),
        },
        talhoes: listaTalhoes,
        funcionarios: Array.from(funcionarios.values())
          .map((f) => ({ funcionarioId: f.funcionarioId, nome: f.nome, horasHH: f.horasHH, horasHM: f.horasHM, dias: f.dias.size, talhoes: Array.from(f.talhoes).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })) }))
          .sort((a, b) => b.horasHH - a.horasHH),
        turmas: Array.from(turmas.values())
          .map((t) => ({ turmaId: t.turmaId, nome: t.nome, pessoasDia: t.pessoasDia, dias: t.dias.size, valorTotal: t.valorTotal }))
          .sort((a, b) => b.valorTotal - a.valorTotal),
        produtos: Array.from(produtos.values())
          .map((p) => ({ ...p, quantidadePorHa: areaTotal > 0 ? p.quantidade / areaTotal : null, custoPorHa: areaTotal > 0 ? p.custo / areaTotal : null }))
          .sort((a, b) => b.custo - a.custo),
      },
    })
  } catch (error) {
    console.error('GET /api/relatorios/por-atividade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
