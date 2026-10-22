'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Filter } from 'lucide-react'

const ITENS_POR_PAGINA = 15

function fmt(n: number) {
  return (n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

const dataBR = (d: string | Date) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export default function HistoricoDevolucoesPage() {
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role
  const isGestor = role === 'GESTOR' || role === 'GERENTE'

  const [devolucoes, setDevolucoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(0)
  const [produtos, setProdutos] = useState<any[]>([])
  const [talhoes, setTalhoes] = useState<any[]>([])
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroProduto, setFiltroProduto] = useState('')
  const [filtroTalhao, setFiltroTalhao] = useState('')
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (role && !['GERENTE', 'GESTOR'].includes(role)) redirect('/dashboard')
    if (status === 'authenticated') {
      fetch('/api/produtos')
        .then((r) => r.json())
        .then((d) => setProdutos((d.data || []).filter((p: any) => p.status).sort((a: any, b: any) => a.nomeComercial.localeCompare(b.nomeComercial))))
        .catch(() => {})
      fetch('/api/talhoes').then((r) => r.json()).then((d) => setTalhoes(d.data || [])).catch(() => {})
    }
  }, [status, role])

  useEffect(() => {
    if (status === 'authenticated') load()
  }, [status, filtroDataInicio, filtroDataFim, filtroProduto, filtroTalhao])

  const load = async (manterPagina = false) => {
    try {
      const params = new URLSearchParams()
      if (filtroDataInicio) params.append('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.append('dataFim', filtroDataFim)
      if (filtroProduto) params.append('produtoId', filtroProduto)
      if (filtroTalhao) params.append('talhaoId', filtroTalhao)
      const res = await fetch(`/api/devolucoes-produto?${params.toString()}`)
      const data = await res.json()
      setDevolucoes(data.data || [])
      if (!manterPagina) setPagina(0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const excluir = async (d: any) => {
    const u = d.produto?.unidadeMedida || ''
    if (!confirm(`Excluir a devolução de ${fmt(d.quantidade)} ${u} de ${d.produto?.nomeComercial} (${dataBR(d.data)})?\n\nA quantidade sai de novo de ${d.local?.nome}.`)) return
    setExcluindoId(d.id)
    try {
      const res = await fetch(`/api/devolucoes-produto/${d.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Erro ao excluir')
        return
      }
      await load(true)
    } catch (err) {
      alert('Erro ao excluir')
    } finally {
      setExcluindoId(null)
    }
  }

  const limparFiltros = () => {
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroProduto('')
    setFiltroTalhao('')
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  if (role && !['GERENTE', 'GESTOR'].includes(role)) return null

  const totalPaginas = Math.max(1, Math.ceil(devolucoes.length / ITENS_POR_PAGINA))
  const devolucoesPagina = devolucoes.slice(pagina * ITENS_POR_PAGINA, (pagina + 1) * ITENS_POR_PAGINA)
  const temFiltro = filtroDataInicio || filtroDataFim || filtroProduto || filtroTalhao
  const produtoFiltrado = produtos.find((p) => p.id === filtroProduto)
  const totalQuantidade = devolucoes.reduce((s, d) => s + (d.quantidade || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">Histórico de Devoluções</h1>
          <p className="text-gray-600 mt-1">Sobras de saídas que voltaram para o estoque</p>
        </div>
        <Link href="/modules/estoque" className="text-sm font-medium text-primary hover:underline">
          Registrar nova devolução no Estoque →
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <label className="text-sm font-medium block mb-1">Talhão (da saída)</label>
            <select value={filtroTalhao} onChange={(e) => setFiltroTalhao(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Todos os talhões</option>
              {talhoes.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {devolucoes.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            {temFiltro ? 'Nenhuma devolução com esses filtros.' : 'Nenhuma devolução registrada ainda.'}
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Produto</th>
                  <th className="px-3 py-2 text-right">Devolvido</th>
                  <th className="px-3 py-2 text-left">Voltou para</th>
                  <th className="px-3 py-2 text-left">Saída de origem</th>
                  <th className="px-3 py-2 text-left">Talhão</th>
                  <th className="px-3 py-2 text-left">Atividade</th>
                  <th className="px-3 py-2 text-left">Observação / Registrado por</th>
                  {isGestor && <th className="px-3 py-2 text-left">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {devolucoesPagina.map((d) => {
                  const u = d.produto?.unidadeMedida || ''
                  return (
                    <tr key={d.id} className="border-b hover:bg-gray-50 align-top">
                      <td className="px-3 py-2 whitespace-nowrap">{dataBR(d.data)}</td>
                      <td className="px-3 py-2 font-medium">{d.produto?.nomeComercial}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-green-700 font-semibold">+{fmt(d.quantidade)} {u}</td>
                      <td className="px-3 py-2">{d.local?.nome || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {d.saida ? `${dataBR(d.saida.data)} · saiu ${fmt(d.saida.quantidade)} ${u}` : '—'}
                      </td>
                      <td className="px-3 py-2">{d.saida?.talhao?.nome || '—'}</td>
                      <td className="px-3 py-2">{d.saida?.tipoAtividade || '—'}</td>
                      <td className="px-3 py-2">
                        {d.observacao && <p>{d.observacao}</p>}
                        <p className="text-xs text-gray-500">{d.registradoPor?.name || '—'}</p>
                      </td>
                      {isGestor && (
                        <td className="px-3 py-2">
                          <button
                            onClick={() => excluir(d)}
                            disabled={excluindoId === d.id}
                            className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                            title="Excluir devolução (a quantidade sai de novo do estoque)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                  <td className="px-3 py-2" colSpan={2}>
                    Total: {devolucoes.length} {devolucoes.length === 1 ? 'devolução' : 'devoluções'}
                  </td>
                  <td
                    className="px-3 py-2 text-right whitespace-nowrap text-green-700"
                    title={produtoFiltrado ? '' : 'Filtre um produto para somar as quantidades (unidades diferentes não se somam)'}
                  >
                    {produtoFiltrado ? `${fmt(totalQuantidade)} ${produtoFiltrado.unidadeMedida}` : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-3 py-2" colSpan={isGestor ? 6 : 5}></td>
                </tr>
              </tfoot>
            </table>

            {devolucoes.length > ITENS_POR_PAGINA && (
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-sm text-gray-600">
                <span>
                  Mostrando {pagina * ITENS_POR_PAGINA + 1}–{Math.min((pagina + 1) * ITENS_POR_PAGINA, devolucoes.length)} de {devolucoes.length}
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
    </div>
  )
}
