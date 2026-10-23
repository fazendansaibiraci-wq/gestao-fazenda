'use client'

import { Fragment, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Filter, Undo2 } from 'lucide-react'
import { FormDevolucao, ConferenciaDevolucao, descricaoSaida } from '@/components/RegistrarDevolucaoProduto'

const ITENS_POR_PAGINA = 15

function fmt(n: number) {
  return (n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

const dataBR = (d: string | Date) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export default function HistoricoSaidasPage() {
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role
  const isGestor = role === 'GESTOR' || role === 'GERENTE'

  const [saidas, setSaidas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(0)
  const [produtos, setProdutos] = useState<any[]>([])
  const [locais, setLocais] = useState<any[]>([])
  const [talhoes, setTalhoes] = useState<any[]>([])
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroProduto, setFiltroProduto] = useState('')
  const [filtroTalhao, setFiltroTalhao] = useState('')
  const [filtroLocal, setFiltroLocal] = useState('')
  const [incluirAbastecimentos, setIncluirAbastecimentos] = useState(false)
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)
  const [devolvendo, setDevolvendo] = useState<any | null>(null)
  const [conferencia, setConferencia] = useState<any | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (role && !['GERENTE', 'GESTOR'].includes(role)) redirect('/dashboard')
    if (status === 'authenticated') {
      fetch('/api/produtos')
        .then((r) => r.json())
        .then((d) => setProdutos((d.data || []).filter((p: any) => p.status).sort((a: any, b: any) => a.nomeComercial.localeCompare(b.nomeComercial))))
        .catch(() => {})
      fetch('/api/locais').then((r) => r.json()).then((d) => setLocais((d.data || []).filter((l: any) => l.status))).catch(() => {})
      fetch('/api/talhoes').then((r) => r.json()).then((d) => setTalhoes(d.data || [])).catch(() => {})
    }
  }, [status, role])

  useEffect(() => {
    if (status === 'authenticated') load()
  }, [status, filtroDataInicio, filtroDataFim, filtroProduto, filtroTalhao, filtroLocal, incluirAbastecimentos])

  const load = async (manterPagina = false) => {
    try {
      const params = new URLSearchParams()
      if (filtroDataInicio) params.append('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.append('dataFim', filtroDataFim)
      if (filtroProduto) params.append('produtoId', filtroProduto)
      if (filtroTalhao) params.append('talhaoId', filtroTalhao)
      if (filtroLocal) params.append('localId', filtroLocal)
      if (incluirAbastecimentos) params.append('incluirAbastecimentos', 'true')
      const res = await fetch(`/api/saidas-produto?${params.toString()}`)
      const data = await res.json()
      setSaidas(data.data || [])
      if (!manterPagina) setPagina(0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const excluir = async (url: string, id: string, texto: string) => {
    if (!confirm(texto)) return
    setOcupadoId(id)
    try {
      const res = await fetch(url, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Erro ao excluir')
        return
      }
      await load(true)
    } catch (err) {
      alert('Erro ao excluir')
    } finally {
      setOcupadoId(null)
    }
  }

  const excluirSaida = (s: any) =>
    excluir(
      `/api/saidas-produto/${s.id}`,
      s.id,
      `Excluir a saída de ${fmt(s.quantidade)} ${s.produto?.unidadeMedida} de ${s.produto?.nomeComercial} (${dataBR(s.data)})?\n\nA quantidade volta para ${s.local?.nome || 'o estoque'}.${s.lancadoIdeagriEm ? '\n\n⚠ Essa movimentação JÁ FOI LANÇADA NO IDEAGRI. Depois de excluir aqui, desfaça também no Ideagri.' : ''}`
    )

  const limparFiltros = () => {
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroProduto('')
    setFiltroTalhao('')
    setFiltroLocal('')
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  if (role && !['GERENTE', 'GESTOR'].includes(role)) return null

  const totalPaginas = Math.max(1, Math.ceil(saidas.length / ITENS_POR_PAGINA))
  const saidasPagina = saidas.slice(pagina * ITENS_POR_PAGINA, (pagina + 1) * ITENS_POR_PAGINA)
  const temFiltro = filtroDataInicio || filtroDataFim || filtroProduto || filtroTalhao || filtroLocal

  // Com um produto filtrado dá pra somar (mesma unidade).
  const produtoFiltrado = produtos.find((p) => p.id === filtroProduto)
  const totalSaiu = saidas.reduce((s, x) => s + (x.quantidade || 0), 0)
  const totalDevolvido = saidas.reduce((s, x) => s + (x.devolvido || 0), 0)
  const colunas = isGestor ? 12 : 11

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">Histórico de Saídas</h1>
          <p className="text-gray-600 mt-1">
            Saídas de estoque. As sobras que voltaram ficam em{' '}
            <Link href="/modules/estoque/devolucoes" className="text-primary hover:underline">Histórico de Devoluções</Link>.
          </p>
        </div>
        <Link href="/modules/estoque" className="text-sm font-medium text-primary hover:underline">
          Registrar nova saída no Estoque →
        </Link>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtros
          </h3>
          {temFiltro && (
            <button onClick={limparFiltros} className="text-sm text-gray-500 hover:text-gray-800">
              Limpar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Data início</label>
            <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Data fim</label>
            <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} min={filtroDataInicio || undefined} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Produto</label>
            <select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Todos os produtos</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>{p.nomeComercial}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Talhão</label>
            <select value={filtroTalhao} onChange={(e) => setFiltroTalhao(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Todos os talhões</option>
              {talhoes.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Local de saída</label>
            <select value={filtroLocal} onChange={(e) => setFiltroLocal(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Todos os locais</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 mt-3">
          <input type="checkbox" checked={incluirAbastecimentos} onChange={(e) => setIncluirAbastecimentos(e.target.checked)} />
          Mostrar também as saídas de diesel dos abastecimentos
        </label>
      </div>

      <div className="card overflow-x-auto">
        {saidas.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            {temFiltro ? 'Nenhuma saída com esses filtros.' : 'Nenhuma saída registrada ainda.'}
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Produto</th>
                  <th className="px-3 py-2 text-right">Saiu</th>
                  <th className="px-3 py-2 text-right">Devolvido</th>
                  <th className="px-3 py-2 text-right">Usado</th>
                  <th className="px-3 py-2 text-left">Local</th>
                  <th className="px-3 py-2 text-left">Talhão</th>
                  <th className="px-3 py-2 text-left">Atividade</th>
                  <th className="px-3 py-2 text-left">Safra</th>
                  <th className="px-3 py-2 text-left">Observação / Registrado por</th>
                  {isGestor && <th className="px-3 py-2 text-left">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {saidasPagina.map((s) => {
                  const u = s.produto?.unidadeMedida || ''
                  const ehAbastecimento = !!s.abastecimento
                  return (
                    <Fragment key={s.id}>
                      <tr className="border-b hover:bg-gray-50 align-top">
                        <td className="px-3 py-2 whitespace-nowrap">{dataBR(s.data)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{ehAbastecimento ? 'Abastecimento' : s.tipo || '—'}</td>
                        <td className="px-3 py-2 font-medium">{s.produto?.nomeComercial}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(s.quantidade)} {u}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-green-700">{s.devolvido > 0 ? `${fmt(s.devolvido)} ${u}` : '—'}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{fmt(s.usado)} {u}</td>
                        <td className="px-3 py-2">{s.local?.nome || '—'}</td>
                        <td className="px-3 py-2">{s.talhao?.nome || '—'}</td>
                        <td className="px-3 py-2">{s.tipoAtividade || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{s.safra?.nome || '—'}</td>
                        <td className="px-3 py-2">
                          {s.observacao && <p>{s.observacao}</p>}
                          <p className="text-xs text-gray-500">{s.registradoPor?.name || '—'}</p>
                        </td>
                        {isGestor && (
                          <td className="px-3 py-2">
                            {!ehAbastecimento && (
                              <div className="flex items-center gap-1">
                                {s.usado > 0.0001 && (
                                  <button
                                    onClick={() => {
                                      setConferencia(null)
                                      setDevolvendo(s)
                                    }}
                                    className="p-1.5 hover:bg-green-50 rounded text-green-700 transition-colors"
                                    title="Devolver sobra ao estoque"
                                  >
                                    <Undo2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => excluirSaida(s)}
                                  disabled={ocupadoId === s.id || s.devolucoes.length > 0}
                                  className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                  title={s.devolucoes.length > 0 ? 'Tem devolução: exclua a devolução primeiro, no Histórico de Devoluções' : 'Excluir (a quantidade volta ao estoque)'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                  <td className="px-3 py-2" colSpan={3}>
                    Total: {saidas.length} {saidas.length === 1 ? 'saída' : 'saídas'}
                  </td>
                  {produtoFiltrado ? (
                    <>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(totalSaiu)} {produtoFiltrado.unidadeMedida}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-green-700">{fmt(totalDevolvido)} {produtoFiltrado.unidadeMedida}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(totalSaiu - totalDevolvido)} {produtoFiltrado.unidadeMedida}</td>
                    </>
                  ) : (
                    <td className="px-3 py-2 text-right text-gray-400 font-normal" colSpan={3} title="Unidades diferentes não se somam">
                      filtre um produto para somar
                    </td>
                  )}
                  <td className="px-3 py-2" colSpan={colunas - 6}></td>
                </tr>
              </tfoot>
            </table>

            {saidas.length > ITENS_POR_PAGINA && (
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-sm text-gray-600">
                <span>
                  Mostrando {pagina * ITENS_POR_PAGINA + 1}–{Math.min((pagina + 1) * ITENS_POR_PAGINA, saidas.length)} de {saidas.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.max(0, p - 1))}
                    disabled={pagina === 0}
                    className="px-3 py-1.5 border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <span>Página {pagina + 1} de {totalPaginas}</span>
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                    disabled={pagina >= totalPaginas - 1}
                    className="px-3 py-1.5 border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {(devolvendo || conferencia) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Devolver ao estoque</h2>
                {devolvendo && (
                  <p className="text-sm text-gray-500">
                    {devolvendo.produto?.nomeComercial} · {descricaoSaida(devolvendo)}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setDevolvendo(null)
                  setConferencia(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              {conferencia ? (
                <div className="space-y-3">
                  <ConferenciaDevolucao conferencia={conferencia} onFechar={() => setConferencia(null)} />
                  <button onClick={() => setConferencia(null)} className="btn btn-primary">
                    Fechar
                  </button>
                </div>
              ) : (
                devolvendo && (
                  <FormDevolucao
                    saida={devolvendo}
                    locais={locais}
                    onCancelar={() => setDevolvendo(null)}
                    onRegistrada={(conf) => {
                      setDevolvendo(null)
                      setConferencia(conf)
                      load(true)
                    }}
                  />
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
