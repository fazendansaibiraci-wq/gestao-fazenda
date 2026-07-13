'use client'

import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Trash2 } from 'lucide-react'

export default function SafrasPage() {
  const { data: session, status } = useSession()
  const [safras, setSafras] = useState([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    nome: '',
    dataInicio: new Date().toISOString().split('T')[0],
    dataFim: '',
    status: 'ATIVA',
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  const userRole = (session?.user as any)?.role || ''
  const isGestor = ['GESTOR', 'GERENTE'].includes(userRole)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const res = await fetch('/api/safras')
      const data = await res.json()
      setSafras(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? `/api/safras/${editingId}` : '/api/safras'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dataInicio: formData.dataInicio,
          dataFim: formData.dataFim || null,
        }),
      })
      if (!res.ok) throw new Error('Erro')
      setFormData({ nome: '', dataInicio: new Date().toISOString().split('T')[0], dataFim: '', status: 'ATIVA' })
      setEditingId(null)
      load()
    } catch (err) {
      alert('Erro ao salvar')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Deletar safra?')) {
      try {
        await fetch(`/api/safras/${id}`, { method: 'DELETE' })
        load()
      } catch (err) {
        alert('Erro')
      }
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="spinner"></div></div>

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Safras</h1>

      {/* Formulário — apenas Gestor/Gerente */}
      {isGestor && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-semibold text-lg">{editingId ? 'Editar' : 'Nova'} Safra</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Nome (ex: Safra 25/26)"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              required
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="date"
              value={formData.dataInicio}
              onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
              required
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="date"
              value={formData.dataFim}
              onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
              className="border rounded-lg px-3 py-2"
            />
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="ATIVA">Ativa</option>
              <option value="ENCERRADA">Encerrada</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary col-span-1">
              {editingId ? 'Atualizar' : 'Adicionar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setFormData({ nome: '', dataInicio: new Date().toISOString().split('T')[0], dataFim: '', status: 'ATIVA' })
                }}
                className="btn btn-outline"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {safras.map((s: any) => (
          <div key={s.id} className="card">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-primary">{s.nome}</h3>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                s.status === 'ATIVA' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {s.status}
              </span>
            </div>
            <div className="text-sm text-gray-600 mb-4 space-y-1">
              <p>Início: {new Date(s.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
              {s.dataFim && <p>Fim: {new Date(s.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>}
            </div>
            {isGestor ? (
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingId(s.id); setFormData(s) }}
                  className="flex-1 btn btn-outline text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Somente visualização</p>
            )}
          </div>
        ))}
      </div>

      {safras.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600">Nenhuma safra cadastrada</p>
        </div>
      )}
    </div>
  )
}
