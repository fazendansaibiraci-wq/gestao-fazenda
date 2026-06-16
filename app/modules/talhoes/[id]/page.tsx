'use client'

import { useEffect, useState } from 'react'
import { TalhaoForm } from '@/components/forms/TalhaoForm'
import { useParams } from 'next/navigation'

export default function EditarTalhaoPage() {
  const params = useParams()
  const id = params.id as string
  const [talhao, setTalhao] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadTalhao = async () => {
      try {
        const response = await fetch(`/api/talhoes/${id}`)
        if (!response.ok) throw new Error('Talhão não encontrado')
        const data = await response.json()
        setTalhao(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro')
      } finally {
        setLoading(false)
      }
    }
    loadTalhao()
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-600">{error}</p></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Editar Talhão</h1>
        <p className="text-gray-600 mt-1">Atualizar dados do talhão</p>
      </div>
      {talhao && <TalhaoForm id={id} initialData={talhao} />}
    </div>
  )
}
