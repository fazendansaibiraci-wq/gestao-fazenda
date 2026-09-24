'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

// Gráficos novos do Dashboard (24/09/2026), nas cores do tema NSA Café:
// nível de diesel, custo por hectare, área por atividade, calendário de
// presença e evolução dos últimos 6 meses. Ficam acima dos 4 gráficos
// antigos, com um filtro de mês próprio.

const G = '#3C4B52'
const C = '#A8683C'
const S = '#6E8B6A'
const A = '#D8C9B1'
const INK = '#2C373C'
const MU = '#76828A'
const AL = '#B4541A'

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const opcoesMeses = () => {
  const hoje = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    return { valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, rotulo: `${NOMES_MES[d.getMonth()]} ${d.getFullYear()}` }
  })
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtN = (n: number, casas = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

interface Extras {
  diesel: { estoqueLitros: number; estoqueMinimo: number; mediaDiaUtil: number; diasUteisRestantes: number | null }
  areaPorAtividade: { atividade: string; area: number }[]
  presenca: { funcionario: string; dias: string[] }[]
  diasNoMes: number
  evolucao: { mes: string; horasHomem: number; horasMaquina: number; diesel: number }[]
}

function Legenda({ itens }: { itens: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#4E5A60]">
      {itens.map(([t, c]) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
          {t}
        </span>
      ))}
    </div>
  )
}

function Cartao({ titulo, sub, children, className = '' }: { titulo: string; sub: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card flex flex-col gap-3 min-w-0 ${className}`}>
      <div>
        <h3 className="font-semibold text-primary">{titulo}</h3>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
      {children}
    </div>
  )
}

const Vazio = ({ texto }: { texto: string }) => <p className="text-sm text-gray-500 py-6 text-center">{texto}</p>

export function DashboardNovos() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const podeVer = role === 'GESTOR' || role === 'GERENTE'

  const opcoes = opcoesMeses()
  const [mesSel, setMesSel] = useState(opcoes[0].valor)
  const [dados, setDados] = useState<Extras | null>(null)
  const [custoHa, setCustoHa] = useState<{ nome: string; valor: number }[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!podeVer) return
    const [anoStr, mesStr] = mesSel.split('-')
    const ano = parseInt(anoStr, 10)
    const mes = parseInt(mesStr, 10) - 1
    const hoje = new Date()
    const ehMesAtual = ano === hoje.getFullYear() && mes === hoje.getMonth()
    const inicio = new Date(ano, mes, 1)
    const fim = ehMesAtual ? hoje : new Date(ano, mes + 1, 0)
    setCarregando(true)
    Promise.all([
      fetch(`/api/dashboard-extras?ano=${ano}&mes=${mes + 1}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/relatorios/custo-hh-hm?dataInicio=${ymd(inicio)}&dataFim=${ymd(fim)}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([extras, custo]) => {
        setDados(extras?.data || null)
        const lista = ((custo?.data || []) as any[])
          .map((t) => ({
            nome: t.nomeTalhao as string,
            valor: (t.custoHHPorHa || 0) + (t.custoHMPorHa || 0) + (t.custoTurmasPorHa || 0),
          }))
          .filter((t) => t.valor > 0)
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 8)
        setCustoHa(lista)
      })
      .catch((e) => console.error('Erro ao carregar gráficos novos do Dashboard:', e))
      .finally(() => setCarregando(false))
  }, [mesSel, podeVer])

  if (!podeVer) return null

  // ─── Diesel ───────────────────────────────────────────────────────────
  const diesel = dados?.diesel
  const dias = diesel?.diasUteisRestantes
  const corDias = dias == null ? MU : dias < 5 ? AL : dias < 10 ? C : S
  const pctDias = dias == null ? 0 : Math.min(1, dias / 30)

  // ─── Custo por hectare ────────────────────────────────────────────────
  const maxCusto = Math.max(1, ...custoHa.map((c) => c.valor))

  // ─── Área por atividade (rosca) ───────────────────────────────────────
  const coresArea = [G, C, S, A, '#9AA6AB', '#7A9DB0', '#C9B79C']
  const areas = dados?.areaPorAtividade || []
  const areaTop = areas.slice(0, 5)
  const areaOutros = areas.slice(5).reduce((acc, a) => acc + a.area, 0)
  const fatias = areaOutros > 0 ? [...areaTop, { atividade: 'Outras', area: areaOutros }] : areaTop
  const areaTotal = fatias.reduce((acc, a) => acc + a.area, 0)
  const R = 58
  const CIRC = 2 * Math.PI * R
  let deslocamento = 0

  // ─── Presença ─────────────────────────────────────────────────────────
  const corStatus: Record<string, string> = { T: S, F: AL, E: '#7A9DB0', H: '#C9B79C', W: '#EEE8DE', '': '#FFFFFF' }
  const cw = 15
  const lw = 150
  const nDias = dados?.diasNoMes || 30
  const encurtar = (n: string) => {
    const p = n.trim().split(/\s+/)
    return p.length <= 2 ? n : `${p[0]} ${p[p.length - 1]}`
  }

  // ─── Evolução ─────────────────────────────────────────────────────────
  const evo = dados?.evolucao || []
  const EW = 540
  const EH = 220
  const pl = 44
  const pb = 26
  const pt = 12
  const maxHoras = Math.max(10, ...evo.map((e) => Math.max(e.horasHomem, e.horasMaquina)))
  const maxDiesel = Math.max(10, ...evo.map((e) => e.diesel))
  const passo = evo.length > 1 ? (EW - pl - 40) / (evo.length - 1) : 0
  const yH = (v: number) => EH - pb - (v / maxHoras) * (EH - pb - pt)
  const xE = (i: number) => pl + 20 + i * passo

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-primary">Visão do mês</h2>
        <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className="border rounded-lg px-2 py-1 text-sm">
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>{o.rotulo}</option>
          ))}
        </select>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 ${carregando ? 'opacity-60' : ''}`}>
        {/* Diesel */}
        <Cartao titulo="Diesel em Estoque" sub="Estoque atual e quanto ainda dura">
          {!diesel ? (
            <Vazio texto="Sem dados de diesel" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold" style={{ color: INK }}>{fmtN(diesel.estoqueLitros)} L</span>
                <span className="text-xs text-gray-500">no estoque</span>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Dias úteis que ainda dura</span>
                  <span className="font-bold" style={{ color: corDias }}>{dias == null ? '—' : `~${dias} dias`}</span>
                </div>
                <div className="h-3 rounded-full bg-[#EEE8DE] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pctDias * 100}%`, background: corDias }} />
                </div>
              </div>
              <p className="text-sm text-[#4E5A60]">
                Média de <strong>{fmtN(diesel.mediaDiaUtil)} L</strong> por dia útil (últimos 30 dias)
              </p>
              {diesel.estoqueMinimo > 0 && diesel.estoqueLitros <= diesel.estoqueMinimo && (
                <p className="text-sm font-semibold" style={{ color: AL }}>
                  Abaixo do estoque mínimo ({fmtN(diesel.estoqueMinimo)} L)
                </p>
              )}
            </div>
          )}
        </Cartao>

        {/* Custo por hectare */}
        <Cartao titulo="Custo por Hectare" sub="Mão de obra + máquina + turmas, por talhão">
          {custoHa.length === 0 ? (
            <Vazio texto="Sem custos no mês (confira a área dos talhões)" />
          ) : (
            <div className="space-y-1.5">
              {custoHa.map((c) => (
                <div key={c.nome} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-right text-[#4E5A60] truncate" title={c.nome}>{c.nome}</span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="h-4 rounded" style={{ width: `${(c.valor / maxCusto) * 75}%`, background: G }} />
                    <span className="font-bold whitespace-nowrap" style={{ color: INK }}>R$ {fmtN(c.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Cartao>

        {/* Área por atividade */}
        <Cartao titulo="Área Trabalhada por Atividade" sub="Hectares lançados no mês">
          {areaTotal === 0 ? (
            <Vazio texto="Nenhuma área lançada no mês" />
          ) : (
            <div className="flex items-center gap-4">
              <svg width="140" height="140" viewBox="0 0 140 140" className="flex-shrink-0" aria-label="Área por atividade">
                {fatias.map((f, i) => {
                  const L = (f.area / areaTotal) * CIRC
                  const el = (
                    <circle
                      key={f.atividade}
                      cx="70"
                      cy="70"
                      r={R}
                      fill="none"
                      stroke={coresArea[i % coresArea.length]}
                      strokeWidth="22"
                      strokeDasharray={`${L} ${CIRC - L}`}
                      strokeDashoffset={-deslocamento}
                      transform="rotate(-90 70 70)"
                    />
                  )
                  deslocamento += L
                  return el
                })}
                <text x="70" y="68" fontSize="20" fontWeight="800" textAnchor="middle" fill={INK}>{fmtN(areaTotal)}</text>
                <text x="70" y="86" fontSize="11" textAnchor="middle" fill={MU}>hectares</text>
              </svg>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                {fatias.map((f, i) => (
                  <div key={f.atividade} className="flex justify-between gap-2 text-xs text-[#4E5A60]">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: coresArea[i % coresArea.length] }} />
                      <span className="truncate">{f.atividade}</span>
                    </span>
                    <strong style={{ color: INK }}>{fmtN(f.area, 1)} ha</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Cartao>

        {/* Calendário de presença */}
        <Cartao titulo="Calendário de Presença" sub="Cada linha é um funcionário" className="lg:col-span-2">
          {!dados || dados.presenca.length === 0 ? (
            <Vazio texto="Sem funcionários" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <svg
                  width={lw + nDias * cw}
                  height={16 + dados.presenca.length * 18}
                  viewBox={`0 0 ${lw + nDias * cw} ${16 + dados.presenca.length * 18}`}
                  aria-label="Calendário de presença"
                >
                  {Array.from({ length: nDias }, (_, d) =>
                    d % 2 === 0 ? (
                      <text key={d} x={lw + d * cw + 6} y="10" fontSize="9" textAnchor="middle" fill={MU}>{d + 1}</text>
                    ) : null
                  )}
                  {dados.presenca.map((p, i) => (
                    <g key={p.funcionario}>
                      <text x={lw - 8} y={16 + i * 18 + 11} fontSize="10" textAnchor="end" fill="#4E5A60">{encurtar(p.funcionario)}</text>
                      {p.dias.map((s, d) => (
                        <rect
                          key={d}
                          x={lw + d * cw}
                          y={16 + i * 18}
                          width={cw - 3}
                          height="14"
                          rx="3"
                          fill={corStatus[s] ?? '#FFFFFF'}
                          stroke={s === '' ? '#E4DDD2' : 'none'}
                        />
                      ))}
                    </g>
                  ))}
                </svg>
              </div>
              <Legenda itens={[['Trabalhou', S], ['Falta', AL], ['Férias', '#7A9DB0'], ['Feriado', '#C9B79C'], ['Folga', '#EEE8DE']]} />
            </>
          )}
        </Cartao>

        {/* Evolução */}
        <Cartao titulo="Evolução Mês a Mês" sub="Últimos 6 meses">
          {evo.length === 0 ? (
            <Vazio texto="Sem dados" />
          ) : (
            <>
              <svg width="100%" viewBox={`0 0 ${EW} ${EH}`} aria-label="Evolução mensal">
                {[0, 0.33, 0.66, 1].map((f) => {
                  const v = Math.round(maxHoras * f)
                  return (
                    <g key={f}>
                      <line x1={pl} y1={yH(v)} x2={EW - 10} y2={yH(v)} stroke="#EEE8DE" />
                      <text x={pl - 6} y={yH(v) + 4} fontSize="10" textAnchor="end" fill={MU}>{fmtN(v)}</text>
                    </g>
                  )
                })}
                {evo.map((e, i) => {
                  const h = (e.diesel / maxDiesel) * (EH - pb - pt) * 0.85
                  return (
                    <g key={e.mes + i}>
                      <rect x={xE(i) - 14} y={EH - pb - h} width="28" height={h} rx="3" fill="#EFE9DF">
                        <title>{`${e.mes}: ${fmtN(e.diesel)} L de diesel`}</title>
                      </rect>
                      <text x={xE(i)} y={EH - 8} fontSize="11" textAnchor="middle" fill={MU}>{e.mes}</text>
                    </g>
                  )
                })}
                {([['horasHomem', G], ['horasMaquina', C]] as const).map(([campo, cor]) => (
                  <g key={campo}>
                    <polyline
                      points={evo.map((e, i) => `${xE(i)},${yH(e[campo])}`).join(' ')}
                      fill="none"
                      stroke={cor}
                      strokeWidth="2.5"
                    />
                    {evo.map((e, i) => (
                      <circle key={i} cx={xE(i)} cy={yH(e[campo])} r="3.5" fill={cor}>
                        <title>{`${e.mes}: ${fmtN(e[campo])} h`}</title>
                      </circle>
                    ))}
                  </g>
                ))}
              </svg>
              <Legenda itens={[['Horas Homem', G], ['Hora Máquina', C], ['Diesel (barras)', '#D9CDB8']]} />
            </>
          )}
        </Cartao>
      </div>
    </section>
  )
}
