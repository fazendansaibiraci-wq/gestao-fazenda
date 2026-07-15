'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { redirect, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function MaquinasPage() {
  const router = useRouter()
  const { status } = useSession()
  const [maquinas, setMaquinas] = useState([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'Trator',
    marca: '',
    modelo: '',
    ano: new Date().getFullYear(),
    placa: '',
    valor: '',
    valorResidual: '',
    vidaUtilHoras: '',
    status: 'ATIVA',
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const res = await fetch('/api/maquinas')
      const data = await res.json()
      setMaquinas(data.data || [])
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
      const url = editingId ? `/api/maquinas/${editingId}` : '/api/maquinas'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Erro')
      setFormData({
        nome: '',
        tipo: 'Trator',
        marca: '',
        modelo: '',
        ano: new Date().getFullYear(),
        placa: '',
        valor: '',
        valorResidual: '',
        vidaUtilHoras: '',
        status: 'ATIVA',
      })
      setEditingId(null)
      load()
    } catch (err) {
      alert('Erro ao salvar')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Deletar máquina?')) {
      try {
        const res = await fetch(`/api/maquinas/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erro ao deletar')
        }
        load()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao deletar')
      }
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="spinner"></div></div>

  return (
    <div className="space-y-6">
     <h1 className="text-3xl font-bold text-primary">Máquinas</h1>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <h2 className="font-semibold text-lg">{editingId ? 'Editar' : 'Nova'} Máquina</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Nome/Identificação"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            required
            className="border rounded-lg px-3 py-2"
          />
          <select
            value={formData.tipo}
            onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
            className="border rounded-lg px-3 py-2"
          >
            <option value="Trator">Trator</option>
            <option value="Máquina">Máquina</option>
          </select>
          <input
            type="text"
            placeholder="Marca"
            value={formData.marca}
            onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
            className="border rounded-lg px-3 py-2"
          />
          <input
            type="text"
            placeholder="Modelo"
            value={formData.modelo}
            onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
            className="border rounded-lg px-3 py-2"
          />
          <input
            type="number"
            placeholder="Ano"
            value={formData.ano}
            onChange={(e) => setFormData({ ...formData, ano: parseInt(e.target.value) })}
            className="border rounded-lg px-3 py-2"
          />
          <input
            type="text"
            placeholder="Placa"
            value={formData.placa}
            onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
            className="border rounded-lg px-3 py-2"
          />
          <input
            type="number"
            placeholder="Valor (R$)"
            value={formData.valor}
            onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
            className="border rounded-lg px-3 py-2"
          />
          <input
            type="number"
            placeholder="Valor Residual (R$)"
            value={formData.valorResidual}
            onChange={(e) => setFormData({ ...formData, valorResidual: e.target.value })}
            className="border rounded-lg px-3 py-2"
          />
          <input
            type="number"
            placeholder="Vida Útil (horas)"
            value={formData.vidaUtilHoras}
            onChange={(e) => setFormData({ ...formData, vidaUtilHoras: e.target.value })}
            className="border rounded-lg px-3 py-2"
          />
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="border rounded-lg px-3 py-2"
          >
            <option value="ATIVA">Ativa</option>
            <option value="MANUTENCAO">Manutenção</option>
            <option value="INATIVA">Inativa</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">
            {editingId ? 'Salvar' : 'Adicionar'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setFormData({
                  nome: '',
                  tipo: 'Trator',
                  marca: '',
                  modelo: '',
                  ano: new Date().getFullYear(),
                  placa: '',
                  valor: '',
                  valorResidual: '',
                  vidaUtilHoras: '',
                  status: 'ATIVA',
                })
              }}
              className="btn btn-outline"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {maquinas.map((m: any) => (
          <div key={m.id} className="card">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-primary">{m.nome}</h3>
                <p className="text-sm text-gray-600">{m.tipo}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                m.status === 'ATIVA' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {m.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {m.marca} {m.modelo} {m.ano && `(${m.ano})`}
            </p>
            {m.valor && (
              <p className="text-sm font-medium text-green-700 mb-3">
                R$ {Number(m.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingId(m.id)
                  setFormData({
                    ...m,
                    valor: m.valor || '',
                    valorResidual: m.valorResidual || '',
                    vidaUtilHoras: m.vidaUtilHoras || '',
                  })
                }}
                className="flex-1 btn btn-outline text-sm"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(m.id)}
                className="p-2 hover:bg-red-50 rounded-lg text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
