'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { UserPlus, Pencil, Trash2, Eye } from 'lucide-react'
import { redirect } from 'next/navigation'

interface Funcionario {
  id: string
  name: string
  email: string
  role: string
  phone?: string
  active: boolean
  tipoSalario?: string
}

export default function FuncionariosPage() {
  const { data: session, status } = useSession()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('ATIVO')

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }

    if (status === 'authenticated') {
      loadFuncionarios()
    }
  }, [status])

  const loadFuncionarios = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/funcionarios')
      if (!response.ok) throw new Error('Erro ao carregar funcionários')
      const data = await response.json()
      setFuncionarios(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este funcionário?')) return

    try {
      const response = await fetch(`/api/funcionarios/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Erro ao deletar')
      setFuncionarios((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao deletar')
    }
  }

  const filteredFuncionarios = funcionarios.filter((f) => {
    if (filter === 'ATIVO') return f.active
    if (filter === 'INATIVO') return !f.active
    return true
  })

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Funcionários</h1>
          <p className="text-gray-600 mt-1">Gerenciar funcionários e escalas</p>
        </div>
        <Link href="/modules/funcionarios/novo">
          <button className="btn btn-primary">
            <UserPlus className="w-5 h-5" />
            Novo Funcionário
          </button>
        </Link>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex gap-2">
          {['TODOS', 'ATIVO', 'INATIVO'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === status
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'TODOS' ? 'Todos' : status === 'ATIVO' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Nome</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Perfil</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Tipo Salário</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredFuncionarios.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Nenhum funcionário encontrado
                </td>
              </tr>
            ) : (
              filteredFuncionarios.map((func) => (
                <tr key={func.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{func.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{func.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      {func.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {func.tipoSalario || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                      func.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {func.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/modules/funcionarios/${func.id}`}>
                        <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors" title="Editar">
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(func.id)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Deletar"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-gray-600 text-sm">Total de Funcionários</p>
          <p className="text-3xl font-bold text-primary mt-2">{funcionarios.length}</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Funcionários Ativos</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {funcionarios.filter((f) => f.active).length}
          </p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Funcionários Inativos</p>
          <p className="text-3xl font-bold text-red-600 mt-2">
            {funcionarios.filter((f) => !f.active).length}
          </p>
        </div>
      </div>
    </div>
  )
}
