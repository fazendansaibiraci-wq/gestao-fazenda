'use client'

import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Trash2 } from 'lucide-react'

export default function FeriadosPage() {
  const { status } = useSession()
  const [feriados, setFeriados] = useState([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    nome: '',
    descricao: '',
    tipo: 'municipal',
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const res = await fetch('/api/feriados')
      const data = await res.json()
      setFeriados(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/feriados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          data: new Date(formData.data),
        }),
      })
      if (!res.ok) throw new Error('Erro')
      setFormData({
        data: new Date().toISOString().split('T')[0],
        nome: '',
        descricao: '',
        tipo: 'municipal',
      })
      load()
    } catch (err) {
      alert('Erro ao salvar')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Deletar feriado?')) {
      try {
        await fetch(`/api/feriados/${id}`, { method: 'DELETE' })
        load()
      } catch (err) {
        alert('Erro')
      }
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="spinner"></div></div>

  const nacionais = feriados.filter((f: any) => f.tipo === 'nacional')
  const municipais = feriados.filter((f: any) => f.tipo === 'municipal')

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Feriados</h1>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <h2 className="font-semibold text-lg">Adicionar Feriado Municipal</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="date"
            value={formData.data}
            onChange={(e) => setFormData({ ...formData, data: e.target.value })}
            required
            className="border rounded-lg px-3 py-2"
          />
          <input
            type="text"
            placeholder="Nome do Feriado"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            required
            className="border rounded-lg px-3 py-2"
          />
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            className="border rounded-lg px-3 py-2"
          />
          <button type="submit" className="btn btn-primary">
            Adicionar
          </button>
        </div>
      </form>

      {/* Feriados Nacionais */}
      {nacionais.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-lg mb-4 text-primary">Feriados Nacionais</h3>
          <div className="space-y-2">
            {nacionais.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{f.nome}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(f.data).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feriados Municipais */}
      {municipais.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-lg mb-4 text-primary">Feriados Municipais</h3>
          <div className="space-y-2">
            {municipais.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{f.nome}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(f.data).toLocaleDateString('pt-BR')}
                    {f.descricao && ` - ${f.descricao}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(f.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
