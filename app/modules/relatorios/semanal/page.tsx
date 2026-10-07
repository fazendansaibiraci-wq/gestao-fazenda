'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, FileDown, MessageSquare, ArrowLeft } from 'lucide-react'

// Relatório Semanal (24/09/2026 → modelo aprovado em 06/10/2026): semana de
// segunda a domingo, com resumo, andamento das operações pela área,
// aplicações de insumos, equipe, máquinas, observações e talhões parados.
// "Gerar PDF" usa a impressão do navegador (Salvar como PDF), em A4 em pé.

const G = '#3C4B52'
const C = '#A8683C'
const S = '#6E8B6A'
const AL = '#B4541A'
const INK = '#2C373C'
const MU = '#76828A'

const STATUS: Record<string, { rotulo: string; bg: string; fg: string; barra: string }> = {
  novo: { rotulo: 'Começou', bg: '#E6EEE3', fg: '#3F6B3A', barra: G },
  andamento: { rotulo: 'Em andamento', bg: '#E3ECF4', fg: '#3E6A8A', barra: G },
  concluida: { rotulo: 'Concluída', bg: '#E6EEE3', fg: '#2E6B2A', barra: S },
  parada: { rotulo: 'Parada', bg: '#F5E6DA', fg: '#A2542A', barra: C },
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const segundaDaSemana = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = x.getDay() // 0 dom
  x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1))
  return x
}
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const br = (s: string) => s.split('-').reverse().join('/')
const brCurto = (s: string) => s.split('-').reverse().slice(0, 2).join('/')
const n1 = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const fmtH = (h: number) => {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return mm ? `${hh}h ${String(mm).padStart(2, '0')}` : `${hh}h`
}

export default function RelatorioSemanalPage() {
  // Semana (seg–dom) ou mês inteiro. "segunda" = 1º dia do período
  // (a segunda-feira, ou o dia 1 no modo mês).
  const [modo, setModo] = useState<'semana' | 'mes'>('semana')
  const [segunda, setSegunda] = useState(() => segundaDaSemana(new Date()))
  const mensal = modo === 'mes'
  const P = mensal
    ? { o: 'o mês', neste: 'neste mês', no: 'no mês', anterior: 'mês anterior', anteriores: 'meses anteriores', titulo: 'Relatório Mensal' }
    : { o: 'a semana', neste: 'nesta semana', no: 'na semana', anterior: 'semana anterior', anteriores: 'semanas anteriores', titulo: 'Relatório Semanal' }
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  // Recarrega a semana depois de concluir/reabrir uma operação à mão
  const [versao, setVersao] = useState(0)
  // Operação com o campo de data aberto para concluir (atividade|talhaoId)
  const [concluindo, setConcluindo] = useState<string | null>(null)
  const [dataConcluir, setDataConcluir] = useState('')
  const [salvandoConclusao, setSalvandoConclusao] = useState(false)
  // Filtros do Andamento das operações (continuam ao trocar de semana)
  const [filtroAtividade, setFiltroAtividade] = useState('')
  const [filtroTalhao, setFiltroTalhao] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  // Paradas ficam recolhidas no rodapé da tabela (no PDF saem sempre)
  const [mostrarParadas, setMostrarParadas] = useState(false)
  const semanaCarregada = useRef('')

  useEffect(() => {
    // Cancela a busca anterior ao trocar de semana — sem isso, clicando
    // rápido nas setas, a resposta de uma semana antiga podia chegar depois
    // e o relatório (e o PDF) ficava com datas diferentes do seletor.
    const controle = new AbortController()
    setCarregando(true)
    setErro('')
    // Trocou de semana: limpa a tela. Só recarregando (após Concluir/Reabrir):
    // mantém o relatório visível enquanto busca.
    const chavePeriodo = `${modo}|${ymd(segunda)}`
    if (semanaCarregada.current !== chavePeriodo) {
      setDados(null)
      setConcluindo(null)
    }
    semanaCarregada.current = chavePeriodo
    fetch(`/api/relatorios/semanal?inicio=${ymd(segunda)}${mensal ? '&periodo=mes' : ''}`, { signal: controle.signal })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Erro ao carregar')
        setDados(d.data)
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e.message)
      })
      .finally(() => {
        if (!controle.signal.aborted) setCarregando(false)
      })
    return () => controle.abort()
  }, [segunda, modo, versao])

  const concluirOperacao = async (o: any) => {
    if (!dataConcluir) return
    setSalvandoConclusao(true)
    try {
      const r = await fetch('/api/encerramentos-atividade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoAtividade: o.atividade, talhaoId: o.talhaoId, safraId: dados?.safraId, dataFim: dataConcluir }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erro ao concluir')
      setConcluindo(null)
      setVersao((v) => v + 1)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSalvandoConclusao(false)
    }
  }

  const reabrirOperacao = async (o: any) => {
    if (!o.encerramento) return
    if (!confirm(`Reabrir ${o.atividade} no talhão ${o.talhao}? Ela deixa de aparecer como concluída.`)) return
    try {
      const r = await fetch(`/api/encerramentos-atividade?id=${o.encerramento.id}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erro ao reabrir')
      setVersao((v) => v + 1)
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Concluir / Reabrir à mão (só na tela, não sai no PDF)
  const acaoConclusao = (o: any) => {
    const k = `${o.atividade}|${o.talhaoId}`
    if (o.concluidaPor === 'area') {
      return <span className="text-[11px]" style={{ color: MU }}>pela área</span>
    }
    if (o.concluidaPor === 'manual') {
      return (
        <span className="text-[11px] whitespace-nowrap" style={{ color: MU }}>
          à mão em {brCurto(o.encerramento.dataFim)} ·{' '}
          <button onClick={() => reabrirOperacao(o)} className="underline font-semibold" style={{ color: C }}>Reabrir</button>
        </span>
      )
    }
    if (o.encerramento) {
      // concluída numa data depois desta semana
      return <span className="text-[11px] whitespace-nowrap" style={{ color: MU }}>concluída em {brCurto(o.encerramento.dataFim)}</span>
    }
    if (concluindo === k) {
      return (
        <span className="flex items-center gap-1 whitespace-nowrap">
          <input
            type="date"
            value={dataConcluir}
            onChange={(e) => setDataConcluir(e.target.value)}
            className="!w-auto border border-[#DDD5C8] rounded px-1 py-0.5 text-xs"
          />
          <button
            onClick={() => concluirOperacao(o)}
            disabled={salvandoConclusao || !dataConcluir}
            className="text-xs font-bold px-2 py-0.5 rounded text-white disabled:opacity-50"
            style={{ background: S }}
          >
            {salvandoConclusao ? '...' : 'OK'}
          </button>
          <button onClick={() => setConcluindo(null)} className="text-xs underline" style={{ color: MU }}>Cancelar</button>
        </span>
      )
    }
    return (
      <button
        onClick={() => {
          setConcluindo(k)
          setDataConcluir(o.ultimoLancamento)
        }}
        className="text-xs font-semibold px-2 py-0.5 rounded border border-[#DDD5C8] bg-white hover:bg-[#EFE9DF] whitespace-nowrap"
        style={{ color: G }}
        title="Marcar esta atividade como concluída neste talhão"
      >
        Concluir
      </button>
    )
  }

  // Setas: ±1 semana ou ±1 mês
  const mudarPeriodo = (passo: number) =>
    setSegunda((s) => (mensal ? new Date(s.getFullYear(), s.getMonth() + passo, 1) : new Date(s.getFullYear(), s.getMonth(), s.getDate() + passo * 7)))
  const trocarModo = (novo: 'semana' | 'mes') => {
    if (novo === modo) return
    if (novo === 'mes') {
      setSegunda(new Date(segunda.getFullYear(), segunda.getMonth(), 1))
    } else {
      // volta para a semana de hoje se for o mês atual; senão, a 1ª semana do mês
      const hoje = new Date()
      const mesmoMes = hoje.getFullYear() === segunda.getFullYear() && hoje.getMonth() === segunda.getMonth()
      setSegunda(segundaDaSemana(mesmoMes ? hoje : segunda))
    }
    setModo(novo)
  }
  const rotuloPeriodo = mensal
    ? `${MESES[segunda.getMonth()]}/${segunda.getFullYear()}`
    : `${brCurto(ymd(segunda))} – ${br(ymd(new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + 6)))}`

  // Operações com área (barra de progresso) x sem área (oficina, gerais,
  // talhão sem área cadastrada ou nenhuma área lançada) — ficam separadas.
  const temArea = (o: any) => o.areaTalhao > 0 && o.areaFeita > 0
  const todasOperacoes: any[] = dados?.operacoes || []
  const opcoesAtividade = useMemo(() => {
    const set = new Set<string>(todasOperacoes.map((o) => o.atividade))
    if (filtroAtividade) set.add(filtroAtividade)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [dados, filtroAtividade])
  const opcoesTalhao = useMemo(() => {
    const set = new Set<string>(
      todasOperacoes.filter((o) => !filtroAtividade || o.atividade === filtroAtividade).map((o) => o.talhao)
    )
    if (filtroTalhao) set.add(filtroTalhao)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [dados, filtroAtividade, filtroTalhao])
  // Atividade + talhão (os números das etiquetas de status seguem estes dois)
  const operacoesFiltradas = useMemo(
    () => todasOperacoes.filter((o) => (!filtroAtividade || o.atividade === filtroAtividade) && (!filtroTalhao || o.talhao === filtroTalhao)),
    [dados, filtroAtividade, filtroTalhao]
  )
  const passaStatus = (o: any) => !filtroStatus || o.status === filtroStatus
  const operacoesComArea = useMemo(() => operacoesFiltradas.filter((o) => temArea(o) && passaStatus(o)), [operacoesFiltradas, filtroStatus])
  const operacoesSemArea = useMemo(() => operacoesFiltradas.filter((o) => !temArea(o) && passaStatus(o)), [operacoesFiltradas, filtroStatus])
  const temFiltro = !!(filtroAtividade || filtroTalhao || filtroStatus)

  const contagem = useMemo(() => {
    const c: Record<string, number> = { novo: 0, andamento: 0, concluida: 0, parada: 0 }
    for (const o of operacoesFiltradas) if (temArea(o)) c[o.status]++
    return c
  }, [operacoesFiltradas])

  // Seções por status (Em andamento, Começou, Concluída, Parada). Dentro de
  // cada seção, maior progresso primeiro. Paradas ficam recolhidas na tela
  // (botão Mostrar) e saem sempre no PDF.
  const paradasVisiveis = mostrarParadas
  const ORDEM_SECOES = ['andamento', 'novo', 'concluida', 'parada'] as const
  const secoes = useMemo(() => {
    const pctDe = (o: any) => o.areaFeita / o.areaTalhao
    return ORDEM_SECOES.map((st) => ({
      st,
      ops: operacoesComArea.filter((o) => o.status === st).sort((a, b) => pctDe(b) - pctDe(a)),
    }))
  }, [operacoesComArea])

  const kpis = dados
    ? [
        { t: 'Horas homem', k: 'horasHomem', fmt: (v: number) => `${n1(v)}h`, maisEhBom: true },
        { t: 'Horas máquina', k: 'horasMaquina', fmt: (v: number) => `${n1(v)}h`, maisEhBom: true },
        { t: 'Área trabalhada', k: 'area', fmt: (v: number) => `${n1(v)} ha`, maisEhBom: true },
        { t: 'Diesel', k: 'diesel', fmt: (v: number) => `${n1(v)} L`, maisEhBom: false },
        { t: 'Horas extras', k: 'horasExtras', fmt: (v: number) => fmtH(v), maisEhBom: false },
        { t: 'Faltas', k: 'faltas', fmt: (v: number) => String(v), maisEhBom: false },
      ]
    : []

  const variacao = (atual: number, anterior: number, k: string) => {
    if (k === 'faltas' || k === 'horasExtras') {
      const d = atual - anterior
      return d === 0 ? '=' : `${d > 0 ? '+' : '−'}${k === 'faltas' ? Math.abs(d) : fmtH(Math.abs(d))}`
    }
    if (!anterior) return atual ? 'novo' : '='
    const p = Math.round(((atual - anterior) / anterior) * 100)
    return p === 0 ? '=' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%`
  }

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body { background: #FFFFFF !important; }
          body * { visibility: hidden !important; }
          #rs-print, #rs-print * { visibility: visible !important; }
          #rs-print { position: absolute; left: 0; top: 0; width: 100%; }
          .rs-sem-impressao { display: none !important; }
          .rs-quebra { break-before: page; }
          .rs-bloco { break-inside: avoid; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Barra da tela (não sai no PDF) */}
      <div className="rs-sem-impressao flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Link href="/modules/relatorios" className="text-sm text-gray-500 hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Relatórios
          </Link>
          <h1 className="text-3xl font-bold text-primary mt-1">{P.titulo}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#EFE9DF] rounded-lg p-[3px] text-sm font-semibold">
            {(['semana', 'mes'] as const).map((m) => (
              <button
                key={m}
                onClick={() => trocarModo(m)}
                className="px-3.5 py-1.5 rounded-md"
                style={modo === m ? { background: '#fff', color: G, boxShadow: '0 1px 2px rgba(44,55,60,0.12)' } : { background: 'transparent', color: MU }}
              >
                {m === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
          <div className="flex items-center bg-white border border-[#DDD5C8] rounded-lg">
            <button onClick={() => mudarPeriodo(-1)} className="p-2.5 hover:bg-[#EFE9DF] rounded-l-lg" title={mensal ? 'Mês anterior' : 'Semana anterior'} aria-label={mensal ? 'Mês anterior' : 'Semana anterior'}>
              <ChevronLeft className="w-4 h-4" style={{ color: G }} />
            </button>
            <span className="px-1.5 text-sm font-semibold whitespace-nowrap" style={{ color: G }}>
              {rotuloPeriodo}
            </span>
            <button onClick={() => mudarPeriodo(1)} className="p-2.5 hover:bg-[#EFE9DF] rounded-r-lg" title={mensal ? 'Próximo mês' : 'Próxima semana'} aria-label={mensal ? 'Próximo mês' : 'Próxima semana'}>
              <ChevronRight className="w-4 h-4" style={{ color: G }} />
            </button>
          </div>
          <button
            onClick={() => window.print()}
            disabled={!dados || carregando}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ background: C }}
          >
            <FileDown className="w-4 h-4" /> Gerar PDF
          </button>
        </div>
      </div>

      {erro && <p className="rs-sem-impressao text-sm text-red-600">{erro}</p>}
      {carregando && !dados && <p className="text-sm text-gray-500">Carregando...</p>}

      {dados && (
        <div id="rs-print" className={`space-y-5 ${carregando ? 'opacity-60' : ''}`}>
          {/* Cabeçalho do PDF (aparece na tela também, discreto) */}
          <div className="flex items-center justify-between border-b-2 pb-3" style={{ borderColor: G }}>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-nsa.svg" alt="NSA Café" className="h-12 w-auto" />
              <div>
                <p className="text-lg font-bold" style={{ color: INK }}>{dados.periodo === 'mes' ? 'Relatório Mensal' : 'Relatório Semanal'}</p>
                <p className="text-xs" style={{ color: MU }}>
                  {dados.periodo === 'mes' ? `${MESES[Number(dados.semana.inicio.slice(5, 7)) - 1]}/${dados.semana.inicio.slice(0, 4)} · ` : 'Semana de '}
                  {br(dados.semana.inicio)} a {br(dados.semana.fim)}{dados.safra ? ` · ${dados.safra}` : ''}
                </p>
              </div>
            </div>
            <p className="text-xs text-right" style={{ color: MU }}>
              Gerado em {new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>

          {/* Resumo */}
          <section className="rs-bloco space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: G }}>Resumo d{P.o}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 print:grid-cols-6 bg-white border border-[#E4DDD2] rounded-xl overflow-hidden">
              {kpis.map((k, i) => {
                const a = dados.resumo.atual[k.k] || 0
                const b = dados.resumo.anterior[k.k] || 0
                const v = variacao(a, b, k.k)
                const subiu = a > b
                const bom = v === '=' ? null : k.maisEhBom ? subiu : !subiu
                const cor = bom == null ? MU : bom ? S : AL
                const seta = v === '=' || v === 'novo' ? '' : subiu ? '▲ ' : '▼ '
                return (
                  <div key={k.k} className={`px-4 py-3 border-[#EEE8DE] ${i > 0 ? 'lg:border-l print:border-l' : ''} border-b lg:border-b-0 print:border-b-0`}>
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: MU }}>{k.t}</p>
                    <p className="text-2xl font-bold whitespace-nowrap" style={{ color: INK }}>{k.fmt(a)}</p>
                    <p className="text-xs" style={{ color: MU }}>
                      <span className="font-bold" style={{ color: cor }}>{seta}{v.replace(/^[+−]/, '')}</span> vs {P.anterior}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Operações (modelo F: seções por status) */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold" style={{ color: G }}>Andamento das operações</h2>
              {/* Filtros (só na tela; no PDF sai uma linha dizendo o filtro usado) */}
              <div className="print:hidden flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 bg-white border border-[#DDD5C8] rounded-lg px-2.5 h-10 text-xs font-semibold" style={{ color: MU }}>
                  Atividade
                  <select
                    value={filtroAtividade}
                    onChange={(e) => { setFiltroAtividade(e.target.value); setFiltroTalhao('') }}
                    className="!w-auto border-0 bg-transparent text-sm py-1"
                    style={{ color: INK }}
                  >
                    <option value="">Todas</option>
                    {opcoesAtividade.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 bg-white border border-[#DDD5C8] rounded-lg px-2.5 h-10 text-xs font-semibold" style={{ color: MU }}>
                  Talhão
                  <select
                    value={filtroTalhao}
                    onChange={(e) => setFiltroTalhao(e.target.value)}
                    className="!w-auto border-0 bg-transparent text-sm py-1"
                    style={{ color: INK }}
                  >
                    <option value="">Todos</option>
                    {opcoesTalhao.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                {temFiltro && (
                  <button
                    onClick={() => { setFiltroAtividade(''); setFiltroTalhao(''); setFiltroStatus('') }}
                    className="text-xs font-semibold underline px-2"
                    style={{ color: C }}
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
            {temFiltro && (
              <p className="hidden print:block text-xs" style={{ color: MU }}>
                Filtro: {[filtroAtividade && `atividade ${filtroAtividade}`, filtroTalhao && `talhão ${filtroTalhao}`].filter(Boolean).join(' · ')}
              </p>
            )}

            {operacoesComArea.length === 0 ? (
              <p className="text-sm text-gray-500">
                {temFiltro ? 'Nenhuma operação com área para este filtro.' : `Nenhuma operação com área lançada ${P.neste}.`}
              </p>
            ) : (
              secoes.map(({ st, ops }) => {
                const info = STATUS[st]
                const ehParada = st === 'parada'
                const recolhida = ehParada && !paradasVisiveis
                const fundo = st === 'andamento' ? '#EEF4F9' : ehParada ? '#FBF4EE' : '#F0F5EE'
                const dica =
                  st === 'andamento' ? `vinham de ${P.anteriores} e tiveram lançamento`
                  : st === 'novo' ? `primeiro lançamento foi ${P.neste}`
                  : st === 'concluida' ? 'pela área ou marcada à mão'
                  : `sem lançamento ${P.neste}`
                const titulo = st === 'novo' ? `Começou ${P.neste}` : info.rotulo
                return (
                  <div key={st} className="bg-white border border-[#E4DDD2] rounded-2xl overflow-hidden">
                    <div className="rs-bloco flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-[#EEE8DE]" style={{ background: fundo }}>
                      <span className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: info.fg }} />
                        <span className="text-[15px] font-extrabold" style={{ color: info.fg }}>{titulo}</span>
                        <span className="text-xs font-bold bg-white rounded-full px-2.5 py-0.5" style={{ color: info.fg }}>{ops.length}</span>
                      </span>
                      <span className="flex items-center gap-3 text-xs" style={{ color: MU }}>
                        {dica}
                        {ehParada && ops.length > 0 && (
                          <button onClick={() => setMostrarParadas((m) => !m)} className="print:hidden font-bold" style={{ color: C }}>
                            {mostrarParadas ? 'Ocultar ▴' : 'Mostrar ▾'}
                          </button>
                        )}
                      </span>
                    </div>
                    {ops.length === 0 ? (
                      <p className="px-4 py-3 text-[13px]" style={{ color: MU }}>
                        Nenhuma operação {st === 'concluida' ? 'concluída' : st === 'parada' ? 'parada' : 'nesta situação'} {P.neste}.
                      </p>
                    ) : (
                      <div className={`overflow-x-auto ${recolhida ? 'hidden print:block' : ''}`}>
                        <div className="min-w-[860px]">
                          {ops.map((o: any) => {
                            const pct = Math.min(1, o.areaFeita / o.areaTalhao)
                            return (
                              <div
                                key={`${o.atividade}|${o.talhaoId}`}
                                className="rs-bloco grid items-center gap-3.5 px-4 py-2.5 border-t border-[#F2EDE5] first:border-t-0 grid-cols-[170px_150px_minmax(0,1fr)_190px_56px_minmax(120px,auto)] print:grid-cols-[150px_130px_minmax(0,1fr)_170px_50px]"
                              >
                                <span className="text-sm font-bold" style={{ color: G }}>{o.talhao}</span>
                                <span className="text-xs font-bold tracking-wide" style={{ color: INK }}>{o.atividade}</span>
                                <div className="flex items-center gap-2.5">
                                  <div className="flex-1 h-2 rounded-full bg-[#EEE8DE] overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: info.barra }} />
                                  </div>
                                  <span className="text-sm font-extrabold w-10 text-right" style={{ color: INK }}>{Math.round(pct * 100)}%</span>
                                  <span className="text-[11px] w-20 whitespace-nowrap" style={{ color: MU }}>{n1(o.areaFeita)} / {n1(o.areaTalhao)} ha</span>
                                </div>
                                <span className="text-xs" style={{ color: '#4E5A60' }}>{o.quem || '—'}</span>
                                <span className="text-[13px] font-bold text-right" style={{ color: INK }}>{o.horasSemana ? `${n1(o.horasSemana)}h` : '—'}</span>
                                <span className="print:hidden text-right">{acaoConclusao(o)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* Atividades sem área: separadas, sem barra de progresso */}
            {operacoesSemArea.length > 0 && (
              <div className="rs-bloco space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: G }}>
                  Outras atividades (sem área para medir) · {operacoesSemArea.length}
                </h3>
                <p className="text-xs" style={{ color: MU }}>
                  Atividades em que não foi lançada área ou cujo talhão não tem área cadastrada (ex: oficina, manutenção, gerais). Não entram no progresso — para dar como concluída, use o botão Concluir.
                </p>
                <div className="bg-white border border-[#E4DDD2] rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs bg-[#F4F1EC]" style={{ color: '#4E5A60' }}>
                        <th className="px-3 py-2">Atividade</th>
                        <th className="px-3 py-2">Talhão / local</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Quem trabalhou</th>
                        <th className="px-3 py-2 text-right">Horas</th>
                        <th className="px-3 py-2 print:hidden">Conclusão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operacoesSemArea.map((o: any, i: number) => {
                        const st = STATUS[o.status]
                        return (
                          <tr key={i} className="rs-bloco border-b border-[#EEE8DE]">
                            <td className="px-3 py-2 font-semibold" style={{ color: INK }}>{o.atividade}</td>
                            <td className="px-3 py-2" style={{ color: '#4E5A60' }}>{o.talhao}</td>
                            <td className="px-3 py-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: st.bg, color: st.fg }}>
                                {st.rotulo}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs" style={{ color: '#4E5A60' }}>{o.quem || '—'}</td>
                            <td className="px-3 py-2 text-right font-bold" style={{ color: INK }}>{o.horasSemana ? `${n1(o.horasSemana)}h` : '—'}</td>
                            <td className="px-3 py-2 print:hidden">{acaoConclusao(o)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Legenda dos status (tela e PDF) */}
          <div className="rs-bloco bg-white border border-[#E4DDD2] rounded-xl p-3 text-xs space-y-1.5" style={{ color: '#4E5A60' }}>
            <p className="font-bold uppercase" style={{ color: MU }}>Como o status é calculado</p>
            {[
              ['novo', `o primeiro lançamento dessa atividade nesse talhão, na safra, foi ${P.neste}.`],
              ['andamento', `já vinha de ${P.anteriores} e teve lançamento ${P.neste}.`],
              ['concluida', 'a área somada na safra chegou à área cadastrada do talhão, ou foi marcada como concluída à mão (botão Concluir), para quando não há área para medir.'],
              ['parada', `começou, não terminou e ficou sem lançamento ${P.neste} (só entra se o último lançamento foi há até 30 dias antes do início d${P.o}).`],
            ].map(([k, texto]) => (
              <p key={k} className="flex items-start gap-2">
                <span className="font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: STATUS[k].bg, color: STATUS[k].fg }}>
                  {STATUS[k].rotulo}
                </span>
                <span className="pt-0.5">{texto}</span>
              </p>
            ))}
            <p className="pt-0.5">O progresso usa a &quot;Área feita no dia&quot; dos lançamentos somada na safra, dividida pela área do talhão.</p>
          </div>

          {/* Página 2 no PDF */}
          <div className="rs-quebra grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 gap-5">
            <section className="rs-bloco space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: G }}>Aplicações de insumos</h2>
              {dados.aplicacoes.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma aplicação recente.</p>
              ) : (
                dados.aplicacoes.map((a: any) => {
                  const total = a.feitos.length + a.faltam.length
                  return (
                    <div key={a.titulo} className="bg-white border border-[#E4DDD2] rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-baseline gap-2">
                        <p className="font-bold" style={{ color: INK }}>{a.titulo}</p>
                        <p className="text-xs" style={{ color: MU }}>
                          {a.faltam.length > 0 ? `${a.feitos.length} de ${total} talhões` : `${a.feitos.length} talhões`}
                          {a.bombasSemana ? ` · ${n1(a.bombasSemana)} bombas ${P.no}` : ''}
                          {a.comecouNaSemana ? ` · começou ${P.neste}` : ''}
                        </p>
                      </div>
                      {a.faltam.length > 0 && (
                        <div className="h-2 rounded-full bg-[#EEE8DE] overflow-hidden">
                          <div className="h-full" style={{ width: `${(a.feitos.length / total) * 100}%`, background: S }} />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {a.feitos.map((t: string) => (
                          <span key={t} className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: '#E6EEE3', color: '#3F6B3A' }}>{t}</span>
                        ))}
                      </div>
                      {a.faltam.length > 0 && (
                        <>
                          <p className="text-xs font-semibold" style={{ color: MU }}>Faltam (em relação à aplicação anterior)</p>
                          <div className="flex flex-wrap gap-1.5">
                            {a.faltam.map((t: string) => (
                              <span key={t} className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: '#F5E6DA', color: '#A2542A' }}>{t}</span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })
              )}
            </section>

            <section className="rs-bloco space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: G }}>Máquinas</h2>
              <div className="bg-white border border-[#E4DDD2] rounded-xl p-3">
                {dados.maquinas.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma máquina usada {P.no}.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase" style={{ color: MU }}>
                        <th className="text-left py-1 bg-transparent">Máquina</th>
                        <th className="text-right py-1 bg-transparent">Horas</th>
                        <th className="text-right py-1 bg-transparent">Consumo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.maquinas.map((m: any) => (
                        <tr key={m.nome} className="border-b border-[#EEE8DE]">
                          <td className="py-1.5 font-semibold" style={{ color: INK }}>{m.nome}{m.alerta ? ' ⚠' : ''}</td>
                          <td className="py-1.5 text-right font-bold" style={{ color: INK }}>{n1(m.horas)}h</td>
                          <td className="py-1.5 text-right" style={{ color: m.alerta ? C : '#4E5A60' }}>{m.consumoLH ? `${n1(m.consumoLH)} L/h` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {dados.maquinas.some((m: any) => m.alerta) && (
                  <p className="text-xs mt-2" style={{ color: C }}>⚠ Horímetro com horas não identificadas {P.no}</p>
                )}
              </div>
            </section>
          </div>

          <section className="rs-bloco space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: G }}>Equipe</h2>
            <div className="bg-white border border-[#E4DDD2] rounded-xl p-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase" style={{ color: MU }}>
                    <th className="text-left py-1 bg-transparent">Funcionário</th>
                    <th className="text-right py-1 bg-transparent">Horas</th>
                    <th className="text-right py-1 bg-transparent">Extras</th>
                    <th className="text-right py-1 bg-transparent">Faltas</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.equipe.map((e: any) => (
                    <tr key={e.nome} className="border-b border-[#EEE8DE]">
                      <td className="py-1.5 font-semibold" style={{ color: INK }}>{e.nome}</td>
                      <td className="py-1.5 text-right font-bold" style={{ color: INK }}>{fmtH(e.horas)}</td>
                      <td className="py-1.5 text-right font-bold" style={{ color: e.extras ? S : MU }}>{e.extras ? `+${fmtH(e.extras)}` : '—'}</td>
                      <td className="py-1.5 text-right font-bold" style={{ color: e.faltas ? AL : MU }}>{e.faltas || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rs-bloco space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: G }}>Observações e alertas</h2>
            <div className="bg-white border border-[#E4DDD2] rounded-xl p-3 space-y-3">
              <div>
                <p className="text-xs font-bold uppercase" style={{ color: MU }}>Observações d{P.o}</p>
                {dados.observacoes.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-1">Nenhuma observação.</p>
                ) : (
                  dados.observacoes.map((o: any, i: number) => (
                    <div key={i} className="flex gap-3 py-1.5 border-b border-[#EEE8DE] text-sm">
                      <span className="w-12 flex-shrink-0" style={{ color: MU }}>{brCurto(o.data)}</span>
                      <span className="w-24 flex-shrink-0 font-bold" style={{ color: INK }}>{o.funcionario}</span>
                      <span className="flex items-start gap-1" style={{ color: '#4E5A60' }}>
                        <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {o.texto}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase" style={{ color: MU }}>Talhões sem atividade há mais de 15 dias</p>
                {dados.talhoesParados.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-1">Nenhum.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {dados.talhoesParados.map((t: any) => (
                      <span key={t.talhao} className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: '#F5E6DA', color: '#A2542A' }}>
                        {t.talhao} · {t.dias} dias
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <p className="text-[10px] text-center" style={{ color: MU }}>NSA Café · Gestão Fazenda</p>
        </div>
      )}
    </div>
  )
}
