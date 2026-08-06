'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Trash2, Filter } from 'lucide-react'

export default function HistoricoAbastecimentosPage() {
  const { data: session, status } = useSession()
  const isGestor = session?.user?.role === 'GESTOR' || session?.user?.role === 'GERENTE'
  const [abastecimentos, setAbastecimentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [paginaAbastecimentos, setPaginaAbastecimentos] = useState(0)
  const ITENS_POR_PAGINA = 10
  const [maquinas, setMaquinas] = useState<any[]>([])
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroMaquina, setFiltroMaquina] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && !['GERENTE', 'GESTOR'].includes(session.user.role)) {
      redirect('/dashboard')
    }
    if (status === 'authenticated') {
      load()
      carregarMaquinas()
    }
  }, [status, session])

  useEffect(() => {
    if (status === 'authenticated') load()
  }, [filtroDataInicio, filtroDataFim, filtroMaquina])

  const carregarMaquinas = async () => {
    try {
      const res = await fetch('/api/maquinas')
      const data = await res.json()
      setMaquinas(data.data?.filter((m: any) => m.status === 'ATIVA') || [])
    } catch (err) {
      console.error(err)
    }
  }

  const load = async () => {
    try {
      const params = new URLSearchParams()
      if (filtroDataInicio) params.append('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.append('dataFim', filtroDataFim)
      if (filtroMaquina) params.append('maquinaId', filtroMaquina)
      const url = params.toString() ? `/api/abastecimentos?${params.toString()}` : '/api/abastecimentos'
      const res = await fetch(url)
      const data = await res.json()
      setAbastecimentos(data.data || [])
      setPaginaAbastecimentos(0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAbastecimento = async (id: string) => {
    if (!confirm('Excluir esse abastecimento? O diesel debitado volta pro estoque.')) return
    try {
      const res = await fetch(`/api/abastecimentos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro')
      load()
    } catch (err) {
      alert('Erro ao excluir')
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  if (session?.user?.role && !['GERENTE', 'GESTOR'].includes(session.user.role)) {
    return null
  }

  const totalPaginasAbastecimentos = Math.max(1, Math.ceil(abastecimentos.length / ITENS_POR_PAGINA))
  const abastecimentosPagina = abastecimentos.slice(
    paginaAbastecimentos * ITENS_POR_PAGINA,
    paginaAbastecimentos * ITENS_POR_PAGINA + ITENS_POR_PAGINA
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Histórico de Abastecimentos</h1>
        <p className="text-gray-600 mt-1">Consulte todos os abastecimentos já registrados</p>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filtros
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <label className="text-sm font-medium block mb-1">Máquina</label>
            <select
              value={filtroMaquina}
              onChange={(e) => setFiltroMaquina(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todas as máquinas</option>
              {maquinas.map((m: any) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left">Data</th>
              <th className="px-4 py-2 text-left">Máquina</th>
              <th className="px-4 py-2 text-left">Horímetro</th>
              <th className="px-4 py-2 text-left">Litros</th>
              <th className="px-4 py-2 text-left">Consumo L/h</th>
              <th className="px-4 py-2 text-left">Custo</th>
              {isGestor && <th className="px-4 py-2 text-left">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {abastecimentosPagina.map((a: any) => (
              <tr key={a.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-2 font-medium">{a.maquina?.nome}</td>
                <td className="px-4 py-2">{a.horimetroAtual.toFixed(1)}h</td>
                <td className="px-4 py-2">{a.litrosAbastecidos.toFixed(2)}L</td>
                <td className="px-4 py-2">{a.consumoLporH?.toFixed(2) || '-'}</td>
                <td className="px-4 py-2">R$ {a.custoAbastecimento?.toFixed(2)}</td>
                {isGestor && (
                  <td className="px-4 py-2">
                    <button onClick={() => handleDeleteAbastecimento(a.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {abastecimentos.length > ITENS_POR_PAGINA && (
          <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
            <span>
              Mostrando {abastecimentosPagina.length === 0 ? 0 : paginaAbastecimentos * ITENS_POR_PAGINA + 1}
              –{Math.min((paginaAbastecimentos + 1) * ITENS_POR_PAGINA, abastecimentos.length)} de {abastecimentos.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaginaAbastecimentos((p) => Math.max(0, p - 1))}
                disabled={paginaAbastecimentos === 0}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <span>Página {paginaAbastecimentos + 1} de {totalPaginasAbastecimentos}</span>
              <button
                type="button"
                onClick={() => setPaginaAbastecimentos((p) => Math.min(totalPaginasAbastecimentos - 1, p + 1))}
                disabled={paginaAbastecimentos >= totalPaginasAbastecimentos - 1}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
