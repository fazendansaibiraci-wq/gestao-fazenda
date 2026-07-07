'use client'

import { useEffect, useState } from 'react'
import { DiariaTurmaForm } from '@/components/forms/DiariaTurmaForm'
import { useParams } from 'next/navigation'

export default function EditarDiariaTurmaPage() {
    const params = useParams()
    const id = params.id as string
    const [diaria, setDiaria] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

  useEffect(() => {
        const load = async () => {
                try {
                          const response = await fetch(`/api/diarias-turma/${id}`)
                          if (!response.ok) throw new Error('Diaria nao encontrada')
                          const data = await response.json()
                          setDiaria(data.data)
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
                      <h1 className="text-3xl font-bold text-primary">Editar Diaria de Turma</h1>
                      <p className="text-gray-600 mt-1">Atualize os dados da turma</p>
              </div>
          {diaria && <DiariaTurmaForm id={id} initialData={diaria} />}
        </div>
      )
}
</div>
