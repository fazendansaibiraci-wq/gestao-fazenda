'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { redirect } from 'next/navigation'

interface DiariaTurma {
    id: string
    data: string
    turma: { nome: string }
    quantidadePessoas: number
    tipoAtividade: string
    valorDiaria: number
    valorTotal: number
    observacao?: string
    talhao: { nome: string }
    safra: { nome: string }
    criadoPor?: { name: string }
}

export default function TurmasPage() {
    const { data: session, status } = useSession()
    const [diarias, setDiarias] = useState<DiariaTurma[]>([])
    const [talhoes, setTalhoes] = useState([])
    const [loading, setLoading] = useState(true)
    const [filtroData, setFiltroData] = useState('')
    const [filtroTalhao, setFiltroTalhao] = useState('')

  const userRole = (session?.user as any)?.role || ''
    const podeAcessar = ['GESTOR', 'GERENTE'].includes(userRole)

  useEffect(() => {
        if (status === 'unauthenticated') redirect('/login')
        if (status === 'authenticated' && !podeAcessar) redirect('/dashboard')
        if (status === 'authenticated') {
                loadTalhoes()
                load()
        }
  }, [status])

  const loadTalhoes = async () => {
        try {
                const res = await fetch('/api/talhoes')
                if (res.ok) setTalhoes((await res.json()).data)
        } catch (err) { console.error(err) }
  }

  const load = async () => {
        try {
                let url = '/api/diarias-turma'
                const params = new URLSearchParams()
                if (filtroData) params.append('data', filtroData)
                if (filtroTalhao) params.append('talhaoId', filtroTalhao)
                if (params.toString()) url += '?' + params.toString()
                const response = await fetch(url)
                if (!response.ok) throw new Error('Erro')
                const data = await response.json()
                setDiarias(data.data || [])
        } catch (err) {
                console.error(err)
        } finally {
                setLoading(false)
        }
  }

  useEffect(() => {
        if (status === 'authenticated') {
                setLoading(true)
                load()
        }
  }, [filtroData, filtroTalhao])

  const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta diaria de turma?')) return
        try {
                const res = await fetch(`/api/diarias-turma/${id}`, { method: 'DELETE' })
                if (!res.ok) {
                          const data = await res.json()
                          throw new Error(data.error || 'Erro ao excluir')
                }
                load()
        } catch (err) {
                alert(err instanceof Error ? err.message : 'Erro ao excluir')
        }
  }

  const custoTotal = diarias.reduce((acc, d) => acc + (d.valorTotal || 0), 0)

  if (status === 'loading' || loading) {
        return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
          }
          
            return (
                  <div className="space-y-6">
                        <div className="flex items-center justify-between">
                                <div>
                                          <h1 className="text-3xl font-bold text-primary">Turmas</h1>
                                          <p className="text-gray-600 mt-1">Diarias de turmas de diaristas</p>
                                </div>
                                <Link href="/modules/turmas/nova">
                                          <button className="btn btn-primary">
                                                      <Plus className="w-5 h-5" />
                                                      Nova Diaria
                                          </button>
                                </Link>
                        </div>
                  
                        <div className="card space-y-3">
                                <h3 className="font-semibold text-primary">Filtros</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                          <input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                                          <select value={filtroTalhao} onChange={(e) => setFiltroTalhao(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                                                      <option value="">Todos os Talhoes</option>
                                            {talhoes.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                                          </select>
                                </div>
                        </div>
                  
                        <div className="card overflow-x-auto">
                                <table className="w-full text-sm">
                                          <thead>
                                                      <tr className="border-b bg-gray-50">
                                                                    <th className="px-4 py-3 text-left font-semibold">Data</th>
                                                                    <th className="px-4 py-3 text-left font-semibold">Turma</th>
                                                                    <th className="px-4 py-3 text-left font-semibold">Talhao</th>
                                                                    <th className="px-4 py-3 text-left font-semibold">Safra</th>
                                                                    <th className="px-4 py-3 text-left font-semibold">Atividade</th>
                                                                    <th className="px-4 py-3 text-right font-semibold">Pessoas</th>
                                                                    <th className="px-4 py-3 text-right font-semibold">Valor Diaria</th>
                                                                    <th className="px-4 py-3 text-right font-semibold">Valor Total</th>
                                                                    <th className="px-4 py-3 text-right font-semibold">Acoes</th>
                                                      </tr>
                                          </thead>
                                          <tbody>
                                            {diarias.length === 0 ? (
                                  <tr>
                                                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                                                    Nenhuma diaria de turma registrada
                                                  </td>
                                  </tr>
                                ) : (
                                  diarias.map((d) => (
                                                    <tr key={d.id} className="border-b hover:bg-gray-50">
                                                                      <td className="px-4 py-3">{new Date(d.data).toLocaleDateString('pt-BR')}</td>
                                                                      <td className="px-4 py-3 font-medium">{d.turma?.nome}</td>
                                                                      <td className="px-4 py-3">{d.talhao?.nome}</td>
                                                                      <td className="px-4 py-3">{d.safra?.nome}</td>
                                                                      <td className="px-4 py-3 text-gray-600">{d.tipoAtividade?.replace(/_/g, ' ')}</td>
                                                                      <td className="px-4 py-3 text-right">{d.quantidadePessoas}</td>
                                                                      <td className="px-4 py-3 text-right">R$ {Number(d.valorDiaria).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                                      <td className="px-4 py-3 text-right font-semibold">R$ {Number(d.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                                      <td className="px-4 py-3 text-right">
                                                                                          <div className="flex items-center justify-end gap-2">
                                                                                                                <Link href={`/modules/turmas/${d.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Editar</Link>
                                                                                                                <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors" title="Excluir">
                                                                                                                                        <Trash2 className="w-4 h-4" />
                                                                                                                  </button>
                                                                                            </div>
                                                                      </td>
                                                    </tr>
                                                  ))
                                )}
                                          </tbody>
                                </table>
                        </div>
                  
                        <div className="card">
                                <p className="text-gray-600 text-sm">Custo Total do Periodo Filtrado</p>
                                <p className="text-3xl font-bold text-primary mt-2">R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                  </div>
                )
}
