'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Users, Plus, Edit2, Trash2, Check, X, Eye, EyeOff } from 'lucide-react'

interface User {
  id: string
  email: string
  name: string
  role: 'FUNCIONARIO' | 'GERENTE' | 'AGRONOMO' | 'GESTOR'
  active: boolean
  createdAt: string
}

const roleLabels = {
  FUNCIONARIO: 'Funcionário',
  GERENTE: 'Gerente',
  AGRONOMO: 'Agrônomo',
  GESTOR: 'Gestor',
}

const roleOptions = [
  { value: 'FUNCIONARIO', label: 'Funcionário' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'AGRONOMO', label: 'Agrônomo' },
  { value: 'GESTOR', label: 'Gestor' },
]

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'FUNCIONARIO' as const,
  })

  // Verificar permissões
  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }

    if (status === 'authenticated') {
      const userRole = (session?.user as any)?.role
      if (userRole !== 'GESTOR' && userRole !== 'GERENTE') {
        redirect('/dashboard')
      }
    }
  }, [status, session])

  // Carregar usuários
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.data || [])
      }
    } catch (err) {
      setError('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      if (!formData.name || !formData.email || !formData.role) {
        setError('Preencha todos os campos obrigatórios')
        return
      }

      if (!editingId && !formData.password) {
        setError('Senha é obrigatória para novo usuário')
        return
      }

      const method = editingId ? 'PUT' : 'POST'
      const payload = editingId
        ? { id: editingId, ...formData }
        : formData

      const res = await fetch('/api/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setSuccess(editingId ? 'Usuário atualizado com sucesso' : 'Usuário criado com sucesso')
        setFormData({ name: '', email: '', password: '', role: 'FUNCIONARIO' })
        setEditingId(null)
        setShowForm(false)
        loadUsers()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar usuário')
      }
    } catch (err) {
      setError('Erro ao salvar usuário')
    }
  }

  const handleEdit = (user: User) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    })
    setEditingId(user.id)
    setShowForm(true)
  }

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Desativar este usuário?')) return

    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setSuccess('Usuário desativado com sucesso')
        loadUsers()
      } else {
        setError('Erro ao desativar usuário')
      }
    } catch (err) {
      setError('Erro ao desativar usuário')
    }
  }

  const handleReactivate = async (userId: string) => {
    if (!confirm('Reativar este usuário?')) return

    try {
      const res = await fetch(`/api/users?id=${userId}&action=reactivate`, { method: 'PATCH' })
      if (res.ok) {
        setSuccess('Usuário reativado com sucesso')
        loadUsers()
      } else {
        setError('Erro ao reativar usuário')
      }
    } catch (err) {
      setError('Erro ao reativar usuário')
    }
  }

  const handleDeletePermanently = async (userId: string) => {
    if (!confirm('Tem certeza? Esta ação é irreversível e o usuário será removido permanentemente.')) return

    try {
      const res = await fetch(`/api/users?id=${userId}&action=delete`, { method: 'DELETE' })
      if (res.ok) {
        setSuccess('Usuário deletado permanentemente')
        loadUsers()
      } else {
        setError('Erro ao deletar usuário')
      }
    } catch (err) {
      setError('Erro ao deletar usuário')
    }
  }

  const handleCancel = () => {
    setFormData({ name: '', email: '', password: '', role: 'FUNCIONARIO' })
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  const isGestor = (session?.user as any)?.role === 'GESTOR'

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Users className="w-8 h-8" />
          Gerenciamento de Usuários
        </h1>
        <p className="text-gray-600 mt-1">Cadastre, edite e gerencie usuários do sistema</p>
      </div>

      {/* Mensagens */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Botão Novo Usuário */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
        >
          <Plus className="w-5 h-5" />
          Novo Usuário
        </button>
      )}

      {/* Formulário */}
      {showForm && (
        <div className={`card ${editingId ? 'border-l-4 border-l-blue-500' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            {editingId && <Edit2 className="w-5 h-5 text-blue-600" />}
            <h2 className="text-xl font-bold">
              {editingId ? `Editar Usuário: ${formData.name}` : 'Novo Usuário'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Nome completo"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="seu@email.com"
                required
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {editingId ? 'Nova Senha (opcional)' : 'Senha'} *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border rounded px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder={editingId ? 'Deixe em branco para manter a senha atual' : '••••••••'}
                  required={!editingId}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-600 hover:text-gray-900 transition-colors"
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {editingId && (
                <p className="text-xs text-gray-500 mt-1">Deixe em branco para manter a senha atual</p>
              )}
            </div>

            {/* Perfil */}
            <div>
              <label className="block text-sm font-medium mb-1">Perfil *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition font-medium"
              >
                {editingId ? 'Atualizar Usuário' : 'Cadastrar Usuário'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Usuários */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Usuários ({users.length})</h2>

        {users.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum usuário cadastrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Nome</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Perfil</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">{user.name}</td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.active ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <Check className="w-4 h-4" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <X className="w-4 h-4" /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 hover:bg-blue-50 rounded transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </button>
                        {isGestor && user.active && (
                          <button
                            onClick={() => handleDeactivate(user.id)}
                            className="p-2 hover:bg-orange-50 rounded transition"
                            title="Desativar"
                          >
                            <Trash2 className="w-4 h-4 text-orange-600" />
                          </button>
                        )}
                        {isGestor && !user.active && (
                          <button
                            onClick={() => handleReactivate(user.id)}
                            className="p-2 hover:bg-green-50 rounded transition"
                            title="Reativar"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        {isGestor && (
                          <button
                            onClick={() => handleDeletePermanently(user.id)}
                            className="p-2 hover:bg-red-50 rounded transition"
                            title="Excluir permanentemente"
                          >
                            <Trash2 className="w-4 h-4 text-red-700" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-blue-50 border-l-4 border-blue-500">
        <h3 className="font-semibold text-blue-900 mb-2">📝 Permissões</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>GESTOR:</strong> Pode criar, editar, desativar, reativar e deletar usuários</li>
          <li>• <strong>GERENTE:</strong> Pode criar e editar usuários (sem desativar/reativar/deletar)</li>
          <li>• <strong>AGRONOMO:</strong> Acesso apenas para consulta</li>
          <li>• <strong>FUNCIONARIO:</strong> Acesso restrito ao seu perfil</li>
        </ul>
      </div>
    </div>
  )
}
