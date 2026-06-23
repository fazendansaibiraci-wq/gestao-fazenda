'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { redirect } from 'next/navigation'

interface Talhao {
  id: string
  nome: string
  area: number
  variedade?: string
  status: string
}

export default function TalhoesPage() {
  const { data: session, status } = useSession()
  const [talhoes, setTalhoes] = useState<Talhao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const userRole = (session?.user as any)?.role || ''
  const isGestor = ['GESTOR', 'GERENTE'].includes(userRole)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') loadTalhoes()
  }, [status])

  const loadTalhoes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/talhoes')
      if (!response.ok) throw new Error('Erro ao carregar')
      const data = await response.json()
      setTalhoes(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deletar talhão?')) return
    try {
      const response = await fetch(`/api/talhoes/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erro')
      setTalhoes((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro')
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Talhões</h1>
          <p className="text-gray-600 mt-1">Gerenciar talhões da propriedade</p>
        </div>
        {isGestor && (
          <Link href="/modules/talhoes/novo">
            <button className="btn btn-primary">
              <Plus className="w-5 h-5" />
              Novo Talhão
            </button>
          </Link>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {talhoes.map((t) => (
          <div key={t.id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-primary text-lg">{t.nome}</h3>
                {t.variedade && <p className="text-sm text-gray-600">{t.variedade}</p>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                t.status === 'ATIVO' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {t.status}
              </span>
            </div>
            <div className="space-y-1 text-sm mb-4">
              <p className="text-gray-600"><strong>{t.area}</strong> hectares</p>
            </div>
            <div className="flex gap-2">
              {isGestor ? (
                <>
                  <Link href={`/modules/talhoes/${t.id}`} className="flex-1">
                    <button className="w-full btn btn-outline text-sm">Editar</button>
                  </Link>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-500 py-1">Somente visualização</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {talhoes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600">Nenhum talhão cadastrado</p>
        </div>
      )}
    </div>
  )
}
