'use client'

import { useEffect, useState } from 'react'
import { RegistroAtividadeForm } from '@/components/forms/RegistroAtividadeForm'
import { useParams } from 'next/navigation'

export default function EditarAtividadePage() {
  const params = useParams()
  const id = params.id as string
  const [atividade, setAtividade] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/registros-atividade/${id}`)
        if (!response.ok) throw new Error('Atividade não encontrada')
        const data = await response.json()
        setAtividade(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-600">{error}</p></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Editar Atividade</h1>
        <p className="text-gray-600 mt-1">Atualize os dados da atividade</p>
      </div>
      {atividade && <RegistroAtividadeForm id={id} initialData={atividade} />}
    </div>
  )
}
