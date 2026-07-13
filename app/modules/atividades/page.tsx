'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus, Trash2, FileText, X, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { redirect } from 'next/navigation'

interface Atividade {
  id: string
  data: string
  horaEntrada: string
  horaSaida?: string
  tipoAtividade: string
  status: string
  isFalta: boolean
  motivoFalta?: string
  periodoFalta?: string
  atestadoUrl?: string
  talhao: { nome: string }
  safra: { nome: string }
  funcionario?: { name: string }
}

interface AlertaAusencia {
  funcionarioId: string
  nome: string
  diasFaltantes: string[]
}

export default function AtividadesPage() {
  const { data: session, status } = useSession()
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroData, setFiltroData] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroFuncionario, setFiltroFuncionario] = useState('')
  const [atestadoModal, setAtestadoModal] = useState<{ url: string; nome: string } | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [alertasAusencia, setAlertasAusencia] = useState<AlertaAusencia[]>([])
  const [alertaAusenciaExpandido, setAlertaAusenciaExpandido] = useState(false)

  const userRole = (session?.user as any)?.role || ''
  const isGestor = ['GESTOR', 'GERENTE'].includes(userRole)
  const userId = (session?.user as any)?.id

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') {
      load()
      loadAlertasAusencia()
    }
  }, [status])

  const load = async () => {
    try {
      let url = '/api/registros-atividade'
      const params = new URLSearchParams()
      if (filtroData) params.append('data', filtroData)
      if (filtroMes) params.append('mes', filtroMes)
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
  }, [filtroData, filtroMes])

  const loadAlertasAusencia = async () => {
    try {
      const res = await fetch('/api/alertas-ausencia')
      if (res.ok) {
        const data = await res.json()
        setAlertasAusencia(data.data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar alertas de ausência:', err)
    }
  }

  const formatarDataCurta = (data: string) => {
    const [, mes, dia] = data.split('-')
    return `${dia}/${mes}`
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) return
    try {
      const res = await fetch(`/api/registros-atividade/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao excluir')
      }
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const handleUploadAtestado = async (registroId: string, file: File) => {
    if (file.type !== 'application/pdf') { setUploadError('Apenas PDFs são aceitos'); return }
    if (file.size > 5 * 1024 * 1024) { setUploadError('Arquivo muito grande. Máximo: 5MB'); return }
    setUploadError('')
    setUploadingId(registroId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('registroId', registroId)
      const res = await fetch('/api/registros-atividade/atestado', { method: 'POST', body: fd })
      if (!res.ok) {
        const d = await res.json()
        setUploadError(d.error || 'Erro ao enviar')
        return
      }
      await load()
    } catch {
      setUploadError('Erro ao enviar atestado')
    } finally {
      setUploadingId(null)
    }
  }

  const handleRemoverAtestado = async (registroId: string) => {
    if (!confirm('Remover atestado deste registro?')) return
    try {
      const res = await fetch(`/api/registros-atividade/atestado?registroId=${registroId}`, { method: 'DELETE' })
      if (res.ok) await load()
    } catch {
      alert('Erro ao remover atestado')
    }
  }

  const periodoLabel = (periodo?: string) => {
    if (!periodo) return ''
    const map: Record<string, string> = { DIA_INTEIRO: 'Dia inteiro', MANHA: 'Manhã', TARDE: 'Tarde' }
    return map[periodo] || periodo
  }

  // Lista filtrada por nome do funcionário (busca client-side, "contém", case-insensitive).
  const atividadesFiltradas = useMemo(() => {
    if (!filtroFuncionario) return atividades
    const termo = filtroFuncionario.toLowerCase()
    return atividades.filter((a) => a.funcionario?.name?.toLowerCase().includes(termo))
  }, [atividades, filtroFuncionario])

  const meuAlertaAusencia = useMemo(
    () => alertasAusencia.find((a) => a.funcionarioId === userId) || null,
    [alertasAusencia, userId]
  )

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
  }return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Registro de Atividades</h1>
          <p className="text-gray-600 mt-1">
            {isGestor ? 'Gerencie as atividades dos funcionários' : 'Acompanhe suas atividades diárias'}
          </p>
        </div>
        <Link href="/modules/atividades/nova">
          <button className="btn btn-primary">
            <Plus className="w-5 h-5" />
            Nova Atividade
          </button>
        </Link>
      </div>

      {isGestor ? (
        alertasAusencia.length > 0 && (
          <div className="card bg-amber-50 border border-amber-300">
            <button
              onClick={() => setAlertaAusenciaExpandido(!alertaAusenciaExpandido)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="font-semibold text-amber-800">
                  {alertasAusencia.length} funcionário(s) com dias sem registro este mês
                </p>
              </div>
              {alertaAusenciaExpandido ? (
                <ChevronUp className="w-5 h-5 text-amber-600 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-amber-600 flex-shrink-0" />
              )}
            </button>
            {alertaAusenciaExpandido && (
              <div className="mt-3 pt-3 border-t border-amber-200 space-y-2">
                {alertasAusencia.map((alerta) => (
                  <div key={alerta.funcionarioId} className="text-sm">
                    <span className="font-medium text-amber-900">{alerta.nome}:</span>{' '}
                    <span className="text-amber-700">{alerta.diasFaltantes.map(formatarDataCurta).join(', ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      ) : (
        meuAlertaAusencia && (
          <div className="card bg-amber-50 border border-amber-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Você esqueceu de registrar atividade em: {meuAlertaAusencia.diasFaltantes.map(formatarDataCurta).join(', ')}
              </p>
            </div>
          </div>
        )
      )}

      <div className="card space-y-3">
        <h3 className="font-semibold text-primary">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="date"
            value={filtroData}
            onChange={(e) => { setFiltroData(e.target.value); if (e.target.value) setFiltroMes('') }}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="month"
            value={filtroMes}
            onChange={(e) => { setFiltroMes(e.target.value); if (e.target.value) setFiltroData('') }}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
              type="text"
              value={filtroFuncionario}
              onChange={(e) => setFiltroFuncionario(e.target.value)}
              placeholder="Buscar funcionário..."
              className="border rounded-lg px-3 py-2 text-sm"
            />
        </div>
        {uploadError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{uploadError}</p>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold">Data</th>
              <th className="px-4 py-3 text-left font-semibold">Horário</th>
              {isGestor && <th className="px-4 py-3 text-left font-semibold">Funcionário</th>}
              <th className="px-4 py-3 text-left font-semibold">Talhão / Falta</th>
              <th className="px-4 py-3 text-left font-semibold">Atividade</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {atividadesFiltradas.length === 0 ? (
              <tr>
                <td colSpan={isGestor ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                  Nenhuma atividade registrada
                </td>
              </tr>
            ) : (
              atividadesFiltradas.map((a) => (
                <tr key={a.id} className={`border-b hover:bg-gray-50 ${a.isFalta ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">{a.isFalta ? '—' : `${a.horaEntrada}${a.horaSaida ? ` - ${a.horaSaida}` : ''}`}</td>
                  {isGestor && <td className="px-4 py-3 text-gray-600">{a.funcionario?.name || '-'}</td>}
                  <td className="px-4 py-3 font-medium">
                    {a.isFalta ? (
                      <div>
                        <span className="text-red-600">
                          Falta — {periodoLabel(a.periodoFalta)}
                          {a.motivoFalta && <span className="text-xs text-gray-500 ml-1">({a.motivoFalta.replace(/_/g, ' ')})</span>}
                        </span>
                        {a.motivoFalta === 'atestado_medico' && (
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            {a.atestadoUrl ? (
                              <>
                                <button
                                  onClick={() => setAtestadoModal({ url: a.atestadoUrl!, nome: `Atestado — ${new Date(a.data).toLocaleDateString('pt-BR')}` })}
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  <FileText className="w-3 h-3" /> Ver atestado
                                </button>
                                {isGestor && (
                                  <button onClick={() => handleRemoverAtestado(a.id)} className="text-xs text-red-400 hover:text-red-600">
                                    remover
                                  </button>
                                )}
                              </>
                            ) : (
                              <label className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 cursor-pointer font-medium">
                                {uploadingId === a.id ? (
                                  <span className="text-gray-400">Enviando...</span>
                                ) : (
                                  <>
                                    <FileText className="w-3 h-3" /> Anexar atestado
                                    <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadAtestado(a.id, f) }} />
                                  </>
                                )}
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      a.talhao?.nome
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.isFalta ? '—' : a.tipoAtividade}</td>
                  <td className="px-4 py-3">
                    {a.isFalta ? (
                      <span className="text-xs px-2 py-1 rounded-full font-semibold bg-red-100 text-red-800">Falta</span>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${a.status === 'CONCLUIDO' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {a.status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/modules/atividades/${a.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Editar</Link>
                      {isGestor && (
                        <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <p className="text-gray-600 text-sm">Total de Registros</p>
        <p className="text-3xl font-bold text-primary mt-2">{atividadesFiltradas.length}</p>
      </div>

      {atestadoModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex flex-col">
          <div className="flex items-center justify-between bg-white px-4 py-3 border-b shadow">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-500" />
              <span className="font-semibold text-gray-800 text-sm">{atestadoModal.nome}</span>
            </div>
            <div className="flex items-center gap-3">
              <a href={atestadoModal.url} download="atestado.pdf" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Baixar PDF</a>
              <button onClick={() => setAtestadoModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-gray-200">
            <iframe src={atestadoModal.url} className="w-full h-full border-0" title="Atestado Médico" />
          </div>
        </div>
      )}
    </div>
  )
}
