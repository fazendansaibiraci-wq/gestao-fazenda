'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface Implemento {
  id: string
  nome: string
  tipo: string | null
  descricao: string | null
  status: boolean
}

export default function ImplementosPage() {
  const { data: session } = useSession()
  const [implementos, setImplementos] = useState<Implemento[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Implemento | null>(null)
  const [form, setForm] = useState({ nome: '', descricao: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isGestor = ['GESTOR', 'GERENTE'].includes((session?.user as any)?.role)

  useEffect(() => {
    loadImplementos()
  }, [])

  const loadImplementos = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/implementos')
      if (res.ok) {
        const data = await res.json()
        setImplementos(data.data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const method = editando ? 'PUT' : 'POST'
      const body = editando ? { ...form, id: editando.id } : form

      const res = await fetch('/api/implementos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }

      setForm({ nome: '', descricao: '' })
      setShowForm(false)
      setEditando(null)
      loadImplementos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleEditar = (implemento: Implemento) => {
    setEditando(implemento)
    setForm({
      nome: implemento.nome,
      descricao: implemento.descricao || '',
    })
    setShowForm(true)
  }

  const handleDeletar = async (id: string) => {
    if (!confirm('Deseja desativar este implemento?')) return
    await fetch(`/api/implementos?id=${id}`, { method: 'DELETE' })
    loadImplementos()
  }

  const handleNovoForm = () => {
    setEditando(null)
    setForm({ nome: '', descricao: '' })
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Implementos</h1>
          <p className="text-gray-600 mt-1">Gerencie os implementos disponíveis na fazenda</p>
        </div>
        {isGestor && (
          <button onClick={handleNovoForm} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Novo Implemento
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h3 className="text-lg font-semibold text-primary mb-4">
            {editando ? 'Editar Implemento' : 'Novo Implemento'}
          </h3>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label>Nome *</label>
              <input
                type="text"
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                required
                disabled={saving}
                placeholder="Ex: Arado, Grade, Pulverizador"
              />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                disabled={saving}
                placeholder="Descrição opcional..."
                rows={2}
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Salvando...' : editando ? 'Atualizar' : 'Criar Implemento'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditando(null) }}
                className="btn btn-outline"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="text-center text-gray-500 py-8">Carregando...</p>
        ) : implementos.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Nenhum implemento cadastrado ainda.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-gray-600">Nome</th>
                <th className="text-left py-3 px-4 text-gray-600">Descrição</th>
                {isGestor && <th className="text-right py-3 px-4 text-gray-600">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {implementos.map((imp) => (
                <tr key={imp.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{imp.nome}</td>
                  <td className="py-3 px-4 text-gray-600">{imp.descricao || '-'}</td>
                  {isGestor && (
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleEditar(imp)}
                          className="btn btn-outline btn-sm"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletar(imp.id)}
                          className="btn btn-outline btn-sm text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
