'use client'

import { Fragment, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Filter, ChevronDown, ChevronUp } from 'lucide-react'

const ITENS_POR_PAGINA = 15

const fmt = (n: number) => (n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const moeda = (n: number) => `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dataBR = (d: string | Date) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export default function EntradasNFePage() {
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role

  const [notas, setNotas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(0)
  const [produtos, setProdutos] = useState<any[]>([])
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroProduto, setFiltroProduto] = useState('')
  const [busca, setBusca] = useState('')
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [excluindo, setExcluindo] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (role && !['GERENTE', 'GESTOR'].includes(role)) redirect('/dashboard')
    if (status === 'authenticated') {
      fetch('/api/produtos')
        .then((r) => r.json())
        .then((d) => setProdutos((d.data || []).filter((p: any) => p.status).sort((a: any, b: any) => a.nomeComercial.localeCompare(b.nomeComercial))))
        .catch(() => {})
    }
  }, [status, role])

  useEffect(() => {
    if (status !== 'authenticated') return
    // Espera a pessoa parar de digitar antes de buscar.
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [status, filtroDataInicio, filtroDataFim, filtroProduto, busca])

  const load = async (manterPagina = false) => {
    try {
      const params = new URLSearchParams()
      if (filtroDataInicio) params.append('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.append('dataFim', filtroDataFim)
      if (filtroProduto) params.append('produtoId', filtroProduto)
      if (busca.trim()) params.append('busca', busca.trim())
      const res = await fetch(`/api/entradas-nfe?${params.toString()}`)
      const data = await res.json()
      setNotas(data.data || [])
      if (!manterPagina) setPagina(0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const alternar = (chave: string) =>
    setAbertas((prev) => {
      const n = new Set(prev)
      if (n.has(chave)) n.delete(chave)
      else n.add(chave)
      return n
    })

  const excluir = async (nota: any) => {
    if (
      !confirm(
        `Excluir a entrada da nota ${nota.numeroNota || ''} de ${nota.fornecedor || ''}?\n\nOs ${nota.itens.length} produto(s) saem de novo do estoque de ${nota.local || 'o local'}.${nota.lancadoIdeagri ? '\n\n⚠ Essa movimentação JÁ FOI LANÇADA NO IDEAGRI. Depois de excluir aqui, desfaça também no Ideagri.' : ''}`
      )
    )
      return
    setExcluindo(nota.chave)
    try {
      const res = await fetch(`/api/entradas-nfe?chave=${encodeURIComponent(nota.chave)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Erro ao excluir')
        return
      }
      await load(true)
    } catch (err) {
      alert('Erro ao excluir')
    } finally {
      setExcluindo(null)
    }
  }

  const limparFiltros = () => {
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroProduto('')
    setBusca('')
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }
  if (role && !['GERENTE', 'GESTOR'].includes(role)) return null

  const totalPaginas = Math.max(1, Math.ceil(notas.length / ITENS_POR_PAGINA))
  const notasPagina = notas.slice(pagina * ITENS_POR_PAGINA, (pagina + 1) * ITENS_POR_PAGINA)
  const temFiltro = filtroDataInicio || filtroDataFim || filtroProduto || busca
  const valorTotal = notas.reduce((s, n) => s + (n.valorTotal || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">Entradas de NF-e</h1>
          <p className="text-gray-600 mt-1">Notas que deram entrada no estoque pelo XML</p>
        </div>
        <Link href="/modules/estoque" className="text-sm font-medium text-primary hover:underline">
          Dar entrada em nova nota no Estoque →
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
            <label className="text-sm font-medium block mb-1">Emissão de</label>
            <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">até</label>
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
            <label className="text-sm font-medium block mb-1">Fornecedor ou nº da nota</label>
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: Agro, 12345" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {notas.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            {temFiltro ? 'Nenhuma nota com esses filtros.' : 'Nenhuma entrada de NF-e ainda.'}
          </p>
        ) : (
          <>
            <table className="w-full text-sm !mt-0">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Emissão</th>
                  <th className="px-3 py-2 text-left">Fornecedor</th>
                  <th className="px-3 py-2 text-left">Nota</th>
                  <th className="px-3 py-2 text-right">Produtos</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-left">Local</th>
                  <th className="px-3 py-2 text-left">Lançada por</th>
                  <th className="px-3 py-2 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {notasPagina.map((n) => {
                  const aberta = abertas.has(n.chave)
                  return (
                    <Fragment key={n.chave}>
                      <tr className="align-top">
                        <td className="px-3 py-2 whitespace-nowrap">{dataBR(n.data)}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => alternar(n.chave)} className="flex items-center gap-1.5 text-left font-medium hover:text-primary">
                            {n.fornecedor || '—'}
                            {aberta ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                          </button>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{n.numeroNota || '—'}{n.serieNota ? ` / ${n.serieNota}` : ''}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{n.itens.length}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{moeda(n.valorTotal)}</td>
                        <td className="px-3 py-2">{n.local || '—'}</td>
                        <td className="px-3 py-2">
                          <p>{n.registradoPor || '—'}</p>
                          <p className="text-xs text-gray-500">{dataBR(n.lancadaEm)}</p>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => excluir(n)}
                            disabled={excluindo === n.chave || !n.podeExcluir}
                            className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            title={n.podeExcluir ? 'Excluir entrada (os produtos saem de novo do estoque)' : 'Entrada antiga: não dá pra desfazer por aqui'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {aberta && (
                        <tr className="hover:!bg-transparent">
                          <td colSpan={8} className="px-3 pb-3 pt-0 bg-[#FAF7F2]">
                            <table className="w-full text-xs !mt-2">
                              <thead>
                                <tr>
                                  <th className="px-2 py-1.5 text-left">Na nota</th>
                                  <th className="px-2 py-1.5 text-right">Qtd. na nota</th>
                                  <th className="px-2 py-1.5 text-left">Produto no estoque</th>
                                  <th className="px-2 py-1.5 text-right">Entrou</th>
                                  <th className="px-2 py-1.5 text-right">Valor unit.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {n.itens.map((i: any) => (
                                  <tr key={i.id}>
                                    <td className="px-2 py-1.5">{i.nomeNF || '—'}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                      {i.quantidadeNF != null ? `${fmt(i.quantidadeNF)} ${i.unidadeNF || ''}` : '—'}
                                    </td>
                                    <td className="px-2 py-1.5 font-medium">{i.produto}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-green-700">
                                      +{fmt(i.quantidade)} {i.unidade?.toLowerCase()}
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{moeda(i.valorUnitario)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold bg-gray-50">
                  <td className="px-3 py-2" colSpan={3}>
                    Total: {notas.length} {notas.length === 1 ? 'nota' : 'notas'}
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{moeda(valorTotal)}</td>
                  <td className="px-3 py-2" colSpan={3}></td>
                </tr>
              </tfoot>
            </table>

            {notas.length > ITENS_POR_PAGINA && (
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-sm text-gray-600">
                <span>
                  Mostrando {pagina * ITENS_POR_PAGINA + 1}–{Math.min((pagina + 1) * ITENS_POR_PAGINA, notas.length)} de {notas.length}
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
