'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Filter, ArrowRight } from 'lucide-react'

const ITENS_POR_PAGINA = 15

function fmt(n: number) {
  return (n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

export default function HistoricoTransferenciasPage() {
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role
  const isGestor = role === 'GESTOR' || role === 'GERENTE'

  const [transferencias, setTransferencias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(0)
  const [produtos, setProdutos] = useState<any[]>([])
  const [locais, setLocais] = useState<any[]>([])
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroProduto, setFiltroProduto] = useState('')
  const [filtroLocal, setFiltroLocal] = useState('')
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (role && !['GERENTE', 'GESTOR'].includes(role)) redirect('/dashboard')
    if (status === 'authenticated') {
      fetch('/api/produtos')
        .then((r) => r.json())
        .then((d) => setProdutos((d.data || []).filter((p: any) => p.status).sort((a: any, b: any) => a.nomeComercial.localeCompare(b.nomeComercial))))
        .catch(() => {})
      fetch('/api/locais')
        .then((r) => r.json())
        .then((d) => setLocais((d.data || []).filter((l: any) => l.status)))
        .catch(() => {})
    }
  }, [status, role])

  useEffect(() => {
    if (status === 'authenticated') load()
  }, [status, filtroDataInicio, filtroDataFim, filtroProduto, filtroLocal])

  const load = async () => {
    try {
      const params = new URLSearchParams()
      if (filtroDataInicio) params.append('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.append('dataFim', filtroDataFim)
      if (filtroProduto) params.append('produtoId', filtroProduto)
      if (filtroLocal) params.append('localId', filtroLocal)
      const res = await fetch(`/api/transferencias-estoque?${params.toString()}`)
      const data = await res.json()
      setTransferencias(data.data || [])
      setPagina(0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExcluir = async (t: any) => {
    const texto = `Excluir a transferência de ${fmt(t.quantidade)} ${t.produto?.unidadeMedida} de ${t.produto?.nomeComercial} (${t.localOrigem?.nome} → ${t.localDestino?.nome})?\n\nA quantidade volta para ${t.localOrigem?.nome} e sai de ${t.localDestino?.nome}.${t.lancadoIdeagriEm ? '\n\n⚠ Essa movimentação JÁ FOI LANÇADA NO IDEAGRI. Depois de excluir aqui, desfaça também no Ideagri.' : ''}`
    if (!confirm(texto)) return
    setExcluindoId(t.id)
    try {
      const res = await fetch(`/api/transferencias-estoque/${t.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Erro ao excluir')
        return
      }
      await load()
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
    setFiltroLocal('')
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  if (role && !['GERENTE', 'GESTOR'].includes(role)) return null

  const totalPaginas = Math.max(1, Math.ceil(transferencias.length / ITENS_POR_PAGINA))
  const transferenciasPagina = transferencias.slice(pagina * ITENS_POR_PAGINA, (pagina + 1) * ITENS_POR_PAGINA)
  const temFiltro = filtroDataInicio || filtroDataFim || filtroProduto || filtroLocal

  // Com um produto filtrado dá pra somar a quantidade (mesma unidade).
  const produtoFiltrado = produtos.find((p) => p.id === filtroProduto)
  const totalQuantidade = transferencias.reduce((s, t) => s + (t.quantidade || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">Histórico de Transferências</h1>
          <p className="text-gray-600 mt-1">Todas as transferências de estoque entre locais</p>
        </div>
        <Link href="/modules/estoque" className="text-sm font-medium text-primary hover:underline">
          Registrar nova transferência no Estoque →
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
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Data fim</label>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              min={filtroDataInicio || undefined}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Produto</label>
            <select
              value={filtroProduto}
              onChange={(e) => setFiltroProduto(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos os produtos</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>{p.nomeComercial}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Local (saída ou entrada)</label>
            <select
              value={filtroLocal}
              onChange={(e) => setFiltroLocal(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos os locais</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {transferencias.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            {temFiltro ? 'Nenhuma transferência com esses filtros.' : 'Nenhuma transferência registrada ainda.'}
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Data</th>
                  <th className="px-4 py-2 text-left">Produto</th>
                  <th className="px-4 py-2 text-left">De → Para</th>
                  <th className="px-4 py-2 text-right">Quantidade</th>
                  <th className="px-4 py-2 text-left">Observação</th>
                  <th className="px-4 py-2 text-left">Registrado por</th>
                  {isGestor && <th className="px-4 py-2 text-left">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {transferenciasPagina.map((t) => {
                  const saiuDoFiltro = filtroLocal && t.localOrigemId === filtroLocal
                  const entrouNoFiltro = filtroLocal && t.localDestinoId === filtroLocal
                  return (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {new Date(t.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      </td>
                      <td className="px-4 py-2 font-medium">{t.produto?.nomeComercial}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={saiuDoFiltro ? 'font-semibold text-red-600' : ''}>{t.localOrigem?.nome || '—'}</span>
                        <ArrowRight className="w-3.5 h-3.5 inline mx-1.5 text-gray-400" />
                        <span className={entrouNoFiltro ? 'font-semibold text-green-700' : ''}>{t.localDestino?.nome || '—'}</span>
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {fmt(t.quantidade)} {t.produto?.unidadeMedida}
                      </td>
                      <td className="px-4 py-2">{t.observacao || '—'}</td>
                      <td className="px-4 py-2">{t.registradoPor?.name || '—'}</td>
                      {isGestor && (
                        <td className="px-4 py-2">
                          <button
                            onClick={() => handleExcluir(t)}
                            disabled={excluindoId === t.id}
                            className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                            title="Excluir (desfaz a transferência)"
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
                  <td className="px-4 py-2" colSpan={3}>
                    Total: {transferencias.length} {transferencias.length === 1 ? 'transferência' : 'transferências'}
                  </td>
                  <td
                    className="px-4 py-2 text-right whitespace-nowrap"
                    title={produtoFiltrado ? '' : 'Filtre um produto para somar as quantidades (unidades diferentes não se somam)'}
                  >
                    {produtoFiltrado ? `${fmt(totalQuantidade)} ${produtoFiltrado.unidadeMedida}` : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-2" colSpan={isGestor ? 3 : 2}></td>
                </tr>
              </tfoot>
            </table>

            {transferencias.length > ITENS_POR_PAGINA && (
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-sm text-gray-600">
                <span>
                  Mostrando {pagina * ITENS_POR_PAGINA + 1}–{Math.min((pagina + 1) * ITENS_POR_PAGINA, transferencias.length)} de {transferencias.length}
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
