'use client'

import { useEffect, useMemo, useState } from 'react'
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
const br = (s: string) => s.split('-').reverse().join('/')
const brCurto = (s: string) => s.split('-').reverse().slice(0, 2).join('/')
const n1 = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const fmtH = (h: number) => {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return mm ? `${hh}h ${String(mm).padStart(2, '0')}` : `${hh}h`
}

export default function RelatorioSemanalPage() {
  const [segunda, setSegunda] = useState(() => segundaDaSemana(new Date()))
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    setCarregando(true)
    setErro('')
    fetch(`/api/relatorios/semanal?inicio=${ymd(segunda)}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Erro ao carregar')
        setDados(d.data)
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [segunda])

  const mudarSemana = (dias: number) => setSegunda((s) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + dias))

  const contagem = useMemo(() => {
    const c: Record<string, number> = { novo: 0, andamento: 0, concluida: 0, parada: 0 }
    for (const o of dados?.operacoes || []) c[o.status]++
    return c
  }, [dados])

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
          <h1 className="text-3xl font-bold text-primary mt-1">Relatório Semanal</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => mudarSemana(-7)} className="p-2 border border-[#DDD5C8] rounded-lg bg-white hover:bg-[#EFE9DF]" title="Semana anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-2 border border-[#DDD5C8] rounded-lg bg-white text-sm font-semibold text-primary">
            {brCurto(ymd(segunda))} – {br(ymd(new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + 6)))}
          </span>
          <button onClick={() => mudarSemana(7)} className="p-2 border border-[#DDD5C8] rounded-lg bg-white hover:bg-[#EFE9DF]" title="Próxima semana">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => window.print()} disabled={!dados} className="btn btn-primary text-sm disabled:opacity-50">
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
                <p className="text-lg font-bold" style={{ color: INK }}>Relatório Semanal</p>
                <p className="text-xs" style={{ color: MU }}>
                  Semana de {br(dados.semana.inicio)} a {br(dados.semana.fim)}{dados.safra ? ` · ${dados.safra}` : ''}
                </p>
              </div>
            </div>
            <p className="text-xs text-right" style={{ color: MU }}>
              Gerado em {new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>

          {/* Resumo */}
          <section className="rs-bloco space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: G }}>Resumo da semana</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {kpis.map((k) => {
                const a = dados.resumo.atual[k.k] || 0
                const b = dados.resumo.anterior[k.k] || 0
                const v = variacao(a, b, k.k)
                const subiu = a > b
                const bom = v === '=' ? null : k.maisEhBom ? subiu : !subiu
                return (
                  <div key={k.k} className="bg-white border border-[#E4DDD2] rounded-xl px-3 py-2.5">
                    <p className="text-xs font-semibold" style={{ color: MU }}>{k.t}</p>
                    <p className="text-xl font-bold whitespace-nowrap" style={{ color: INK }}>{k.fmt(a)}</p>
                    <p className="text-xs font-bold" style={{ color: bom == null ? MU : bom ? S : AL }}>
                      {v} <span className="font-normal" style={{ color: MU }}>vs semana anterior</span>
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Operações */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: G }}>Andamento das operações</h2>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              {(['novo', 'andamento', 'concluida', 'parada'] as const).map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-full" style={{ background: STATUS[s].bg, color: STATUS[s].fg }}>
                  {contagem[s]} {STATUS[s].rotulo.toLowerCase()}
                </span>
              ))}
            </div>
            {dados.operacoes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma operação com talhão nesta semana.</p>
            ) : (
              <div className="bg-white border border-[#E4DDD2] rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs bg-[#EFE9DF]" style={{ color: '#4E5A60' }}>
                      <th className="px-3 py-2">Atividade</th>
                      <th className="px-3 py-2">Talhão</th>
                      <th className="px-3 py-2 min-w-[200px]">Progresso (área)</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Quem trabalhou</th>
                      <th className="px-3 py-2 text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.operacoes.map((o: any, i: number) => {
                      const st = STATUS[o.status]
                      const pct = o.areaTalhao > 0 ? Math.min(1, o.areaFeita / o.areaTalhao) : null
                      return (
                        <tr key={i} className="rs-bloco border-b border-[#EEE8DE]">
                          <td className="px-3 py-2 font-semibold" style={{ color: INK }}>{o.atividade}</td>
                          <td className="px-3 py-2" style={{ color: '#4E5A60' }}>{o.talhao}</td>
                          <td className="px-3 py-2">
                            {pct == null ? (
                              <span className="text-xs" style={{ color: MU }}>
                                {o.areaFeita > 0 ? `${n1(o.areaFeita)} ha (talhão sem área cadastrada)` : 'sem área lançada'}
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-[#EEE8DE] overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: st.barra }} />
                                </div>
                                <span className="text-xs font-bold whitespace-nowrap" style={{ color: INK }}>
                                  {n1(o.areaFeita)} / {n1(o.areaTalhao)} ha · {Math.round(pct * 100)}%
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: st.bg, color: st.fg }}>
                              {st.rotulo}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: '#4E5A60' }}>{o.quem || '—'}</td>
                          <td className="px-3 py-2 text-right font-bold" style={{ color: INK }}>{o.horasSemana ? `${n1(o.horasSemana)}h` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Página 2 no PDF */}
          <div className="rs-quebra grid grid-cols-1 lg:grid-cols-2 gap-5">
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
                          {a.bombasSemana ? ` · ${n1(a.bombasSemana)} bombas na semana` : ''}
                          {a.comecouNaSemana ? ' · começou nesta semana' : ''}
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
                  <p className="text-sm text-gray-500">Nenhuma máquina usada na semana.</p>
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
                  <p className="text-xs mt-2" style={{ color: C }}>⚠ Horímetro com horas não identificadas na semana</p>
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
                <p className="text-xs font-bold uppercase" style={{ color: MU }}>Observações da semana</p>
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
