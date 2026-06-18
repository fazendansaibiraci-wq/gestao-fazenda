'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Plus, Pencil, Trash2, X } from 'lucide-react'

interface Produto {
  id: string
  nomeComercial: string
  unidadeMedida: string
}

interface ProdutoAplicacao {
  produto: Produto
  dosagem: number
  unidade: string
}

interface ReceitaAplicacao {
  id: string
  nome: string
  tipo: string
  observacoes?: string
  ativo: boolean
  produtosAplicacao: ProdutoAplicacao[]
}

export default function ReceitasPage() {
  const { data: session, status } = useSession()
  const [receitas, setReceitas] = useState<ReceitaAplicacao[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'PULVERIZACAO',
    observacoes: '',
    ativo: true,
    produtos: [] as Array<{ produtoId: string; dosagem: string; unidade: string }>,
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && !['GESTOR', 'GERENTE'].includes(session.user.role)) {
      redirect('/dashboard')
    }
    if (status === 'authenticated') loadData()
  }, [status, session])

  const loadData = async () => {
    try {
      setLoading(true)
      const [receitasRes, produtosRes] = await Promise.all([
        fetch('/api/receitas'),
        fetch('/api/produtos'),
      ])

      if (receitasRes.ok) {
        const data = await receitasRes.json()
        setReceitas(data.data || [])
      }

      if (produtosRes.ok) {
        const data = await produtosRes.json()
        setProdutos(data.data?.filter((p: any) => p.status) || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  const handleAddProduto = () => {
    setFormData((prev) => ({
      ...prev,
      produtos: [...prev.produtos, { produtoId: '', dosagem: '', unidade: '' }],
    }))
  }

  const handleRemoveProduto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      produtos: prev.produtos.filter((_, i) => i !== index),
    }))
  }

  const handleProdutoChange = (index: number, field: string, value: string) => {
    setFormData((prev) => {
      const newProdutos = [...prev.produtos]
      newProdutos[index] = { ...newProdutos[index], [field]: value }
      return { ...prev, produtos: newProdutos }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nome || formData.produtos.length === 0) {
      alert('Preencha nome e produtos')
      return
    }

    try {
      const url = editingId ? '/' api/receitas' : '/api/receitas'
      const method = editingId ? 'PUT' : 'POST'
      const data = editingId
        ? { ...formData, id: editingId }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Erro ao salvar')

      await loadData()
      setFormData({
        nome: '',
        tipo: 'PULVERIZACAO',
        observacoes: '',
        ativo: true,
        produtos: [],
      })
      setEditingId(null)
      setShowForm(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro')
    }
  }

  const handleEdit = (receita: ReceitaAplicacao) => {
    setFormData({
      nome: receita.nome,
      tipo: receita.tipo,
      observacoes: receita.observacoes || '',
      ativo: receita.ativo,
      produtos: receita.produtosAplicacao.map((p) => ({
        produtoId: p.produto.id,
        dosagem: p.dosagem.toString(),
        unidade: p.unidade,
      })),
    })
    setEditingId(receita.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deletar receita?')) return

    try {
      const response = await fetch(\/api/receitas?id=\\, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erro ao deletar')
      setReceitas((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  if (session?.user?.role && !['GESTOR', 'GERENTE'].includes(session.user.role)) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Receitas de Aplicação</h1>
          <p className="text-gray-600 mt-1">Cadastro de receitas para atividades</p>
        </div>
        <button
          onClick={() => {
            setFormData({
              nome: '',
              tipo: 'PULVERIZACAO',
              observacoes: '',
              ativo: true,
              produtos: [],
            })
            setEditingId(null)
            setShowForm(!showForm)
          }}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5" />
          {showForm ? 'Cancelar' : 'Nova Receita'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">{editingId ? 'Editar' : 'Nova'} Receita</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome da Receita</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="ex: Herbicida Pré-emergente"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tipo de Atividade</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="PULVERIZACAO">Pulverização</option>
                <option value="HERBICIDA">Herbicida</option>
                <option value="ADUBACAO">Adubação</option>
                <option value="CORRETIVO_SOLO">Corretivo de Solo</option>
                <option value="INSETICIDA_SOLO">Inseticida Solo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Produtos</label>
                <button
                  type="button"
                  onClick={handleAddProduto}
                  className="text-primary text-sm hover:underline"
                >
                  + Adicionar Produto
                </button>
              </div>

              <div className="space-y-2">
                {formData.produtos.map((prod, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <select
                      value={prod.produtoId}
                      onChange={(e) => {
                        const p = produtos.find((x) => x.id === e.target.value)
                        handleProdutoChange(idx, 'produtoId', e.target.value)
                        if (p) handleProdutoChange(idx, 'unidade', p.unidadeMedida)
                      }}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="">Selecione</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>{p.nomeComercial}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={prod.dosagem}
                      onChange={(e) => handleProdutoChange(idx, 'dosagem', e.target.value)}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <div className="w-20 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                      {prod.unidade || 'un.'}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveProduto(idx)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="rounded"
              />
              <label className="ml-2 text-sm">Ativo</label>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Atualizar' : 'Criar'} Receita
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                }}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {receitas.map((receita) => (
          <div
            key={receita.id}
            className={\card \\}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-lg">{receita.nome}</h3>
                <p className="text-sm text-gray-600">
                  {receita.tipo.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(receita)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(receita.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {receita.observacoes && (
              <p className="text-sm text-gray-600 mb-2">{receita.observacoes}</p>
            )}

            <div className="bg-gray-50 rounded p-2 mb-2">
              <p className="text-xs font-semibold mb-1">Produtos:</p>
              {receita.produtosAplicacao.map((p, idx) => (
                <div key={idx} className="text-xs text-gray-700">
                  • {p.produto.nomeComercial}: {p.dosagem} {p.unidade}
                </div>
              ))}
            </div>

            <span
              className={\	ext-xs px-2 py-1 rounded-full \\}
            >
              {receita.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        ))}
      </div>

      {receitas.length === 0 && !showForm && (
        <div className="card text-center py-8">
          <p className="text-gray-600">Nenhuma receita cadastrada</p>
        </div>
      )}
    </div>
  )
}
