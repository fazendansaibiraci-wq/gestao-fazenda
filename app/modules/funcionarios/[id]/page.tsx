'use client'

import { useEffect, useState } from 'react'
import { FuncionarioForm } from '@/components/forms/FuncionarioForm'
import { useParams } from 'next/navigation'

export default function EditarFuncionarioPage() {
  const params = useParams()
  const id = params.id as string
  const [funcionario, setFuncionario] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadFuncionario()
  }, [id])

  const loadFuncionario = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/funcionarios/${id}`)
      if (!response.ok) throw new Error('Funcionário não encontrado')
      const data = await response.json()
      setFuncionario(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Editar Funcionário</h1>
        <p className="text-gray-600 mt-1">Atualizar dados do funcionário</p>
      </div>

      {funcionario && <FuncionarioForm id={id} initialData={funcionario} />}
    </div>
  )
}
