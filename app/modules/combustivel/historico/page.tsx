'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function HistoricoAbastecimentosPage() {
  const { data: session, status } = useSession()
  const isGestor = session?.user?.role === 'GESTOR' || session?.user?.role === 'GERENTE'
  const [abastecimentos, setAbastecimentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [paginaAbastecimentos, setPaginaAbastecimentos] = useState(0)
  const ITENS_POR_PAGINA = 10

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && !['GERENTE', 'GESTOR'].includes(session.user.role)) {
      redirect('/dashboard')
    }
    if (status === 'authenticated') load()
  }, [status, session])

  const load = async () => {
    try {
      const res = await fetch('/api/abastecimentos')
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
