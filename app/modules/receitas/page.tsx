'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type TipoReceita =
  | 'PULVERIZACAO'
  | 'HERBICIDA'
  | 'CORRETIVOS'
  | 'ADUBACAO'
  | 'INSETICIDA'

interface Ingrediente {
  produto: string
  dose: string
  unidade: string
}

interface Receita {
  id: string
  nome: string
  tipo: TipoReceita
  descricao: string
  volumeCalda?: string
  areAplicacao?: string
  ingredientes: Ingrediente[]
  observacoes?: string
  createdAt: string
  updatedAt: string
}

interface FormData {
  nome: string
  tipo: TipoReceita
  descricao: string
  volumeCalda: string
  areaAplicacao: string
  ingredientes: Ingrediente[]
  observacoes: string
}

const TIPO_LABELS: Record<TipoReceita, string> = {
  PULVERIZACAO: 'Pulverização',
  HERBICIDA: 'Herbicida',
  CORRETIVOS: 'Corretivos',
  ADUBACAO: 'Adubação',
  INSETICIDA: 'Inseticida',
}

const TIPO_COLORS: Record<TipoReceita, string> = {
  PULVERIZACAO: 'bg-blue-100 text-blue-800',
  HERBICIDA: 'bg-yellow-100 text-yellow-800',
  CORRETIVOS: 'bg-gray-100 text-gray-800',
  ADUBACAO: 'bg-green-100 text-green-800',
  INSETICIDA: 'bg-red-100 text-red-800',
}

const EMPTY_FORM: FormData = {
  nome: '',
  tipo: 'PULVERIZACAO',
  descricao: '',
  volumeCalda: '',
  areaAplicacao: '',
  ingredientes: [{ produto: '', dose: '', unidade: 'L/ha' }],
  observacoes: '',
}

export default function ReceitasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterTipo, setFilterTipo] = useState<TipoReceita | 'TODOS'>('TODOS')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchReceitas()
    }
  }, [status])

  async function fetchReceitas() {
    try {
      const res = await fetch('/api/receitas')
      if (!res.ok) throw new Error('Erro ao buscar receitas')
      const data = await res.json()
      setReceitas(data)
    } catch (err) {
      setError('Erro ao carregar receitas')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditingId(null)
    setFormData(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  function openEdit(receita: Receita) {
    setEditingId(receita.id)
    setFormData({
      nome: receita.nome,
      tipo: receita.tipo,
      descricao: receita.descricao || '',
      volumeCalda: receita.volumeCalda || '',
      areaAplicacao: receita.areAplicacao || '',
      ingredientes:
        receita.ingredientes.length > 0
          ? receita.ingredientes
          : [{ produto: '', dose: '', unidade: 'L/ha' }],
      observacoes: receita.observacoes || '',
    })
    setError('')
    setShowModal(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir esta receita?')) return
    try {
      const res = await fetch(`/api/receitas/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setReceitas((prev) => prev.filter((r) => r.id !== id))
    } catch {
      alert('Erro ao excluir receita')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const url = editingId ? `/api/receitas/${editingId}` : '/api/receitas'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId
        ? { ...formData, id: editingId }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }

      await fetchReceitas()
      setShowModal(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar receita')
    } finally {
      setSaving(false)
    }
  }

  function addIngrediente() {
    setFormData((prev) => ({
      ...prev,
      ingredientes: [...prev.ingredientes, { produto: '', dose: '', unidade: 'L/ha' }],
    }))
  }

  function removeIngrediente(index: number) {
    setFormData((prev) => ({
      ...prev,
      ingredientes: prev.ingredientes.filter((_, i) => i !== index),
    }))
  }

  function updateIngrediente(index: number, field: keyof Ingrediente, value: string) {
    setFormData((prev) => {
      const updated = [...prev.ingredientes]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, ingredientes: updated }
    })
  }

  const filtered = receitas.filter((r) => {
    const matchTipo = filterTipo === 'TODOS' || r.tipo === filterTipo
    const matchSearch =
      r.nome.toLowerCase().includes(search.toLowerCase()) ||
      r.descricao?.toLowerCase().includes(search.toLowerCase())
    return matchTipo && matchSearch
  })

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receitas Agronômicas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie receitas de pulverização, herbicidas, corretivos, adubação e inseticidas
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <span className="text-lg">+</span> Nova Receita
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar receita..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value as TipoReceita | 'TODOS')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="TODOS">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {Object.entries(TIPO_LABELS).map(([tipo, label]) => (
          <div key={tipo} className="bg-white rounded-lg border p-3 text-center">
            <div className="text-xl font-bold text-gray-800">
              {receitas.filter((r) => r.tipo === tipo).length}
            </div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🧪</div>
          <p>Nenhuma receita encontrada</p>
          <button onClick={openNew} className="mt-3 text-green-600 underline text-sm">
            Criar primeira receita
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((receita) => (
            <div
              key={receita.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{receita.nome}</h3>
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${
                      TIPO_COLORS[receita.tipo]
                    }`}
                  >
                    {TIPO_LABELS[receita.tipo]}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(receita)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(receita.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              {receita.descricao && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{receita.descricao}</p>
              )}

              {receita.ingredientes.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Ingredientes ({receita.ingredientes.length})
                  </p>
                  <ul className="space-y-1">
                    {receita.ingredientes.slice(0, 3).map((ing, i) => (
                      <li key={i} className="text-xs text-gray-700 flex justify-between">
                        <span>{ing.produto}</span>
                        <span className="text-gray-500">
                          {ing.dose} {ing.unidade}
                        </span>
                      </li>
                    ))}
                    {receita.ingredientes.length > 3 && (
                      <li className="text-xs text-gray-400">
                        +{receita.ingredientes.length - 3} mais...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {(receita.volumeCalda || receita.areAplicacao) && (
                <div className="border-t pt-3 mt-3 flex gap-4 text-xs text-gray-500">
                  {receita.volumeCalda && <span>Vol: {receita.volumeCalda} L/ha</span>}
                  {receita.areAplicacao && <span>Área: {receita.areAplicacao} ha</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Editar Receita' : 'Nova Receita'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Receita *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: Receita Pulverização Café - Broca"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select
                    required
                    value={formData.tipo}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, tipo: e.target.value as TipoReceita }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {Object.entries(TIPO_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Volume de Calda (L/ha)
                  </label>
                  <input
                    type="text"
                    value={formData.volumeCalda}
                    onChange={(e) => setFormData((p) => ({ ...p, volumeCalda: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: 200"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea
                    rows={2}
                    value={formData.descricao}
                    onChange={(e) => setFormData((p) => ({ ...p, descricao: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Descreva o objetivo desta receita..."
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Ingredientes / Produtos
                  </label>
                  <button
                    type="button"
                    onClick={addIngrediente}
                    className="text-green-600 hover:text-green-800 text-sm font-medium"
                  >
                    + Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.ingredientes.map((ing, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Produto"
                        value={ing.produto}
                        onChange={(e) => updateIngrediente(i, 'produto', e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <input
                        type="text"
                        placeholder="Dose"
                        value={ing.dose}
                        onChange={(e) => updateIngrediente(i, 'dose', e.target.value)}
                        className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <select
                        value={ing.unidade}
                        onChange={(e) => updateIngrediente(i, 'unidade', e.target.value)}
                        className="w-24 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option>L/ha</option>
                        <option>mL/ha</option>
                        <option>kg/ha</option>
                        <option>g/ha</option>
                        <option>L/100L</option>
                        <option>mL/100L</option>
                        <option>t/ha</option>
                      </select>
                      {formData.ingredientes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeIngrediente(i)}
                          className="text-red-400 hover:text-red-600 text-lg leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  rows={3}
                  value={formData.observacoes}
                  onChange={(e) => setFormData((p) => ({ ...p, observacoes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Período de carência, cuidados, restrições..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Receita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
