'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

interface TalhaoFormProps {
  id?: string
  initialData?: any
}

export function TalhaoForm({ id, initialData }: TalhaoFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nome: initialData?.nome || '',
    area: initialData?.area || '',
    variedade: initialData?.variedade || '',
    status: initialData?.status || 'ATIVO',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!form.nome || !form.area) {
        setError('Nome e área são obrigatórios')
        setLoading(false)
        return
      }

      const method = id ? 'PUT' : 'POST'
      const url = id ? `/api/talhoes/${id}` : '/api/talhoes'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          area: parseFloat(form.area),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao salvar talhão')
      }

      router.push('/modules/talhoes')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Informações do Talhão</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="nome">Nome do Talhão *</label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={form.nome}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Talhão A"
              />
            </div>
            <div className="form-group">
              <label htmlFor="area">Área (hectares) *</label>
              <input
                type="number"
                id="area"
                name="area"
                value={form.area}
                onChange={handleChange}
                required
                disabled={loading}
                step="0.01"
                placeholder="50,50"
              />
            </div>
          </div>

        
            <div className="form-group">
              <label htmlFor="variedade">>Variedade</label>
              <input
                type="text"
                id="variedade"
                name="variedade"
                value={form.variedade}
                onChange={handleChange}
                disabled={loading}
                placeholder="Café Arábica"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="status">Status *</label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
              <option value="PREPARACAO">Preparação</option>
              <option value="COLHEITA">Colheita</option>
            </select>
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary flex-1"
        >
          {loading ? 'Salvando...' : id ? 'Atualizar' : 'Criar Talhão'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading}
          className="btn btn-outline flex-1"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
