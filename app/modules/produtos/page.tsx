'use client'

import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Trash2, Search } from 'lucide-react'
import { ImportarEstoqueIdeagri } from '@/components/ImportarEstoqueIdeagri'

export default function ProdutosPage() {
  const { data: session, status } = useSession()
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [formData, setFormData] = useState({
    nomeComercial: '',
    categoria: 'fertilizante',
    unidadeMedida: 'kg',
    valorUnitario: '',
    fornecedor: '',
    status: true,
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
      const res = await fetch('/api/produtos')
      const data = await res.json()
      setProdutos(data.data || [])
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
      const url = editingId ? `/api/produtos/${editingId}` : '/api/produtos'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          valorUnitario: parseFloat(formData.valorUnitario),
        }),
      })
      if (!res.ok) throw new Error('Erro')
      setFormData({ nomeComercial: '', categoria: 'fertilizante', unidadeMedida: 'kg', valorUnitario: '', fornecedor: '', status: true })
      setEditingId(null)
      load()
    } catch (err) {
      alert('Erro ao salvar')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Deletar produto?')) {
      try {
        await fetch(`/api/produtos/${id}`, { method: 'DELETE' })
        load()
      } catch (err) {
        alert('Erro')
      }
    }
  }

  const produtosFiltrados = produtos.filter((p: any) =>
    p.nomeComercial.toLowerCase().includes(busca.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busca.toLowerCase())
  )

  if (loading) return <div className="flex justify-center py-12"><div className="spinner"></div></div>

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Produtos e Insumos</h1>

      {isGestor && (
        <ImportarEstoqueIdeagri onImportado={load} />
      )}

      {/* Formulário — apenas Gestor/Gerente */}
      {isGestor && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-semibold text-lg">{editingId ? 'Editar' : 'Novo'} Produto</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Nome Comercial"
              value={formData.nomeComercial}
              onChange={(e) => setFormData({ ...formData, nomeComercial: e.target.value })}
              required
              className="border rounded-lg px-3 py-2"
            />
            <select
              value={formData.categoria}
              onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="fertilizante">Fertilizante</option>
              <option value="fungicida">Fungicida</option>
              <option value="herbicida">Herbicida</option>
              <option value="inseticida">Inseticida</option>
              <option value="adjuvante">Adjuvante</option>
              <option value="corretivo">Corretivo</option>
              <option value="outro">Outro / A Classificar</option>
            </select>
            <select
              value={formData.unidadeMedida}
              onChange={(e) => setFormData({ ...formData, unidadeMedida: e.target.value })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="L">L</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="sacas">sacas</option>
              <option value="bags">bags</option>
              <option value="ton">ton</option>
              <option value="un">un</option>
              <option value="SC">SC (saca)</option>
            </select>
            <input
              type="number"
              placeholder="Valor Unitário"
              value={formData.valorUnitario}
              onChange={(e) => setFormData({ ...formData, valorUnitario: e.target.value })}
              step="0.01"
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="text"
              placeholder="Fornecedor"
              value={formData.fornecedor}
              onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
              className="border rounded-lg px-3 py-2"
            />
            <label className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
              />
              <span className="text-sm">Ativo</span>
            </label>
            <button type="submit" className="btn btn-primary col-span-1">
              {editingId ? 'Atualizar' : 'Adicionar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setFormData({ nomeComercial: '', categoria: 'fertilizante', unidadeMedida: 'kg', valorUnitario: '', fornecedor: '', status: true })
                }}
                className="btn btn-outline"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {/* Barra de pesquisa — para todos */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar produto por nome ou categoria..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full border rounded-lg pl-10 pr-4 py-2"
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">{produtosFiltrados.length} produto(s) encontrado(s)</p>
      </div>

      {/* Tabela */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-left">Unidade</th>
              <th className="px-4 py-3 text-left">Valor</th>
              <th className="px-4 py-3 text-left">Estoque</th>
              <th className="px-4 py-3 text-left">Fornecedor</th>
              <th className="px-4 py-3 text-left">Status</th>
              {isGestor && <th className="px-4 py-3 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {produtosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={isGestor ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                  Nenhum produto encontrado
                </td>
              </tr>
            ) : (
              produtosFiltrados.map((p: any) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.nomeComercial}</td>
                  <td className="px-4 py-3 text-gray-600">{p.categoria}</td>
                  <td className="px-4 py-3 text-gray-600">{p.unidadeMedida}</td>
                  <td className="px-4 py-3 text-gray-600">R$ {p.valorUnitario?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.quantidadeEstoque?.toLocaleString('pt-BR') || 0} {p.unidadeMedida}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.fornecedor || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      p.status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {p.status ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  {isGestor && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setEditingId(p.id); setFormData(p) }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
