'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus, Pencil, Eye } from 'lucide-react'
import { redirect } from 'next/navigation'

interface Atividade {
  id: string
  data: string
  horaEntrada: string
  horaSaida?: string
  tipoAtividade: string
  status: string
  talhao: { nome: string }
  safra: { nome: string }
  funcionario?: { name: string }
}

export default function AtividadesPage() {
  const { data: session, status } = useSession()
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroData, setFiltroData] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      let url = '/api/registros-atividade'
      const params = new URLSearchParams()
      if (filtroData) params.append('data', filtroData)
      if (filtroStatus) params.append('status', filtroStatus)
      if (params.toString()) url += '?' + params.toString()

      const response = await fetch(url)
      if (!response.ok) throw new Error('Erro')
      const data = await response.json()
      setAtividades(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
  }, [filtroData, filtroStatus])

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Registro de Atividades</h1>
          <p className="text-gray-600 mt-1">Acompanhe suas atividades diárias</p>
        </div>
        <Link href="/modules/atividades/nova">
          <button className="btn btn-primary">
            <Plus className="w-5 h-5" />
            Nova Atividade
          </button>
        </Link>
      </div>

      {/* Filtros */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-primary">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="date"
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Filtrar por data"
          />
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos os Status</option>
            <option value="CONCLUIDO">Concluído</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="PENDENTE">Pendente</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold">Data</th>
              <th className="px-4 py-3 text-left font-semibold">Horário</th>
              <th className="px-4 py-3 text-left font-semibold">Talhão</th>
              <th className="px-4 py-3 text-left font-semibold">Atividade</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {atividades.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Nenhuma atividade registrada
                </td>
              </tr>
            ) : (
              atividades.map((a) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {new Date(a.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    {a.horaEntrada} {a.horaSaida ? `- ${a.horaSaida}` : ''}
                  </td>
                  <td className="px-4 py-3 font-medium">{a.talhao?.nome}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {a.tipoAtividade.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      a.status === 'CONCLUIDO'
                        ? 'bg-green-100 text-green-800'
                        : a.status === 'PENDENTE'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {a.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/modules/atividades/${a.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-gray-600 text-sm">Total de Registros</p>
          <p className="text-3xl font-bold text-primary mt-2">{atividades.length}</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Concluídos</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {atividades.filter((a) => a.status === 'CONCLUIDO').length}
          </p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Pendentes</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">
            {atividades.filter((a) => a.status === 'PENDENTE').length}
          </p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Em Andamento</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {atividades.filter((a) => a.status === 'EM_ANDAMENTO').length}
          </p>
        </div>
      </div>
    </div>
  )
}
