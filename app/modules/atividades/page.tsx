'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus, Trash2, FileText, X, AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { redirect, useRouter, useSearchParams } from 'next/navigation'
import { calcularHorasBrutas } from '@/lib/calculoHorasBrutas'

const DIAS_SEMANA_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

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
  talhaoId: string
  talhao: { nome: string }
  safra: { nome: string }
  funcionario?: { name: string }
  horasCalculadas?: number | null
  horasprevistasdia?: number | null
  passouDiretoAlmoco?: boolean
  observacao?: string | null
  maquinaId?: string | null
  maquina?: { nome: string } | null
  horasMaquina?: number | null
  horimetroInicial?: number | null
  horimetroFinal?: number | null
  implementoUtilizado?: string | null
  totalBombas?: number | null
  tipoAdubo?: string | null
  quantidadeAdubo?: number | null
  tipoCorretivo?: string | null
  quantidadeCorretivo?: number | null
}

interface AlertaAusencia {
  funcionarioId: string
  nome: string
  diasFaltantes: string[]
}

export default function AtividadesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [loading, setLoading] = useState(true)
  const [atualizandoFiltro, setAtualizandoFiltro] = useState(false)
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => searchParams.get('dataInicio') || '')
  const [filtroDataFim, setFiltroDataFim] = useState(() => searchParams.get('dataFim') || '')
  const [filtroFuncionario, setFiltroFuncionario] = useState(() => searchParams.get('funcionario') || '')
  const [atestadoModal, setAtestadoModal] = useState<{ url: string; nome: string } | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [alertasAusencia, setAlertasAusencia] = useState<AlertaAusencia[]>([])
  const [alertaAusenciaExpandido, setAlertaAusenciaExpandido] = useState(false)
  const [filtroTalhao, setFiltroTalhao] = useState(() => searchParams.get('talhao') || '')
  const [filtroTipoAtividade, setFiltroTipoAtividade] = useState(() => searchParams.get('tipoAtividade') || '')
  const [filtroMaquina, setFiltroMaquina] = useState(() => searchParams.get('maquina') || '')
  const [talhoes, setTalhoes] = useState<{ id: string; nome: string }[]>([])
  const [tiposAtividade, setTiposAtividade] = useState<{ id: number; nome: string }[]>([])
  const [maquinas, setMaquinas] = useState<{ id: string; nome: string }[]>([])

  // "Recalcular carga contratual": corrige horasprevistasdia/horasExtras/
  // horasDevidas de registros já lançados quando o cadastro do funcionário
  // (carga horária) mudou depois da atividade ter sido criada — esses
  // campos são gravados como retrato do momento do lançamento, não
  // recalculados automaticamente. Sempre mostra uma prévia (dry-run) antes
  // de aplicar de verdade, já que mexe em horas extras que afetam o valor
  // pago no Resumo Mensal.
  const [recalculando, setRecalculando] = useState(false)
  const [previaRecalculo, setPreviaRecalculo] = useState<{
    totalAnalisados: number
    totalAlterados: number
    mudancas: { id: string; data: string; funcionarioNome: string; cargaAntes: number; cargaDepois: number; extrasAntes: number; extrasDepois: number; devidasAntes: number; devidasDepois: number }[]
    mudancasOmitidas: number
  } | null>(null)
  const [aplicandoRecalculo, setAplicandoRecalculo] = useState(false)
  const [recalculoConcluido, setRecalculoConcluido] = useState(false)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // "Limpar faltas de fim de semana": remove faltas automáticas
  // (motivoFalta='nao_registrado') geradas em sábado/domingo ANTES da
  // correção de 25/08/2026 que fez a carga horária de Entressafra variar
  // por dia da semana — dias que hoje têm carga esperada 0 (não deveriam
  // ter gerado falta nenhuma). Mesmo padrão de prévia (dry-run) antes de
  // aplicar de verdade.
  const [limpandoFaltas, setLimpandoFaltas] = useState(false)
  const [previaLimpezaFaltas, setPreviaLimpezaFaltas] = useState<{
    totalAnalisados: number
    totalAlterados: number
    mudancas: { id: string; data: string; funcionarioNome: string; diaSemana: string }[]
    mudancasOmitidas: number
  } | null>(null)
  const [aplicandoLimpezaFaltas, setAplicandoLimpezaFaltas] = useState(false)
  const [limpezaFaltasConcluida, setLimpezaFaltasConcluida] = useState(false)

  const userRole = (session?.user as any)?.role || ''
  const isGestor = ['GESTOR', 'GERENTE'].includes(userRole)
  const userId = (session?.user as any)?.id

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && (session?.user as any)?.ocultarRegistroAtividades) {
      redirect('/dashboard')
    }
    if (status === 'authenticated') {
      load()
      loadAlertasAusencia()
      if (isGestor) {
        loadTalhoes()
        loadTiposAtividade()
        loadMaquinas()
      }
    }
  }, [status])

  const load = async () => {
    try {
      let url = '/api/registros-atividade'
      const params = new URLSearchParams()
      if (filtroDataInicio) params.append('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.append('dataFim', filtroDataFim)
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
    // (mantém setLoading(false) aqui — cobre o carregamento inicial da página;
    // atualizações por filtro de data usam atualizandoFiltro separadamente, sem re-triggar este bloco)
  }

  useEffect(() => {
    setAtualizandoFiltro(true)
    load().finally(() => setAtualizandoFiltro(false))
  }, [filtroDataInicio, filtroDataFim])

  useEffect(() => {
    const params = new URLSearchParams()
    if (filtroDataInicio) params.set('dataInicio', filtroDataInicio)
    if (filtroDataFim) params.set('dataFim', filtroDataFim)
    if (filtroFuncionario) params.set('funcionario', filtroFuncionario)
    if (filtroTalhao) params.set('talhao', filtroTalhao)
    if (filtroTipoAtividade) params.set('tipoAtividade', filtroTipoAtividade)
    if (filtroMaquina) params.set('maquina', filtroMaquina)
    const query = params.toString()
    router.replace(query ? `/modules/atividades?${query}` : '/modules/atividades', { scroll: false })
  }, [filtroDataInicio, filtroDataFim, filtroFuncionario, filtroTalhao, filtroTipoAtividade, filtroMaquina])

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

  const loadTalhoes = async () => {
    try {
      const res = await fetch('/api/talhoes')
      if (res.ok) {
        const data = await res.json()
        setTalhoes(Array.isArray(data) ? data : data.data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar talhões:', err)
    }
  }

  const loadTiposAtividade = async () => {
    try {
      const res = await fetch('/api/tipos-atividade?ativo=true')
      if (res.ok) {
        const data = await res.json()
        setTiposAtividade(Array.isArray(data) ? data : data.data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar tipos de atividade:', err)
    }
  }

  const loadMaquinas = async () => {
    try {
      const res = await fetch('/api/maquinas')
      if (res.ok) {
        const data = await res.json()
        setMaquinas(Array.isArray(data) ? data : data.data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar máquinas:', err)
    }
  }

  const handlePreviaRecalculo = async () => {
    if (!filtroDataInicio || !filtroDataFim) return
    setRecalculando(true)
    setRecalculoConcluido(false)
    try {
      const res = await fetch('/api/registros-atividade/recalcular-carga-horaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataInicio: filtroDataInicio, dataFim: filtroDataFim, confirmar: false }),
      })
      const data = await res.json()
      if (res.ok) {
        setPreviaRecalculo(data)
      } else {
        alert(data.error || 'Erro ao calcular prévia')
      }
    } catch (err) {
      console.error('Erro ao calcular prévia de recálculo:', err)
      alert('Erro ao calcular prévia')
    } finally {
      setRecalculando(false)
    }
  }

  const handleConfirmarRecalculo = async () => {
    if (!filtroDataInicio || !filtroDataFim) return
    setAplicandoRecalculo(true)
    try {
      const res = await fetch('/api/registros-atividade/recalcular-carga-horaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataInicio: filtroDataInicio, dataFim: filtroDataFim, confirmar: true }),
      })
      const data = await res.json()
      if (res.ok) {
        setRecalculoConcluido(true)
        setPreviaRecalculo(null)
        load() // recarrega a lista pra refletir os novos valores na tela
      } else {
        alert(data.error || 'Erro ao aplicar recálculo')
      }
    } catch (err) {
      console.error('Erro ao aplicar recálculo:', err)
      alert('Erro ao aplicar recálculo')
    } finally {
      setAplicandoRecalculo(false)
    }
  }

  const formatarDataCurta = (data: string) => {
    const [, mes, dia] = data.split('-')
    return `${dia}/${mes}`
  }

  const handlePreviaLimpezaFaltas = async () => {
    if (!filtroDataInicio || !filtroDataFim) return
    setLimpandoFaltas(true)
    setLimpezaFaltasConcluida(false)
    try {
      const res = await fetch('/api/registros-atividade/limpar-faltas-fim-de-semana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataInicio: filtroDataInicio, dataFim: filtroDataFim, confirmar: false }),
      })
      const data = await res.json()
      if (res.ok) {
        setPreviaLimpezaFaltas(data)
      } else {
        alert(data.error || 'Erro ao calcular prévia')
      }
    } catch (err) {
      console.error('Erro ao calcular prévia de limpeza de faltas:', err)
      alert('Erro ao calcular prévia')
    } finally {
      setLimpandoFaltas(false)
    }
  }

  const handleConfirmarLimpezaFaltas = async () => {
    if (!filtroDataInicio || !filtroDataFim) return
    setAplicandoLimpezaFaltas(true)
    try {
      const res = await fetch('/api/registros-atividade/limpar-faltas-fim-de-semana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataInicio: filtroDataInicio, dataFim: filtroDataFim, confirmar: true }),
      })
      const data = await res.json()
      if (res.ok) {
        setLimpezaFaltasConcluida(true)
        setPreviaLimpezaFaltas(null)
        load() // recarrega a lista pra refletir a remoção
      } else {
        alert(data.error || 'Erro ao aplicar limpeza')
      }
    } catch (err) {
      console.error('Erro ao aplicar limpeza de faltas:', err)
      alert('Erro ao aplicar limpeza')
    } finally {
      setAplicandoLimpezaFaltas(false)
    }
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

  const toggleExpandir = (id: string) => {
    setExpandidos((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) {
        novo.delete(id)
      } else {
        novo.add(id)
      }
      return novo
    })
  }

  const formatarHoras = (h: number) => {
    const horas = Math.floor(h)
    const minutos = Math.round((h - horas) * 60)
    return `${horas}h ${minutos.toString().padStart(2, '0')}min`
  }

  // Lista filtrada por nome do funcionário (busca client-side, "contém", case-insensitive),
  // por talhão e por tipo de atividade (comparação exata). Os três filtros se combinam (E lógico).
  const atividadesFiltradas = useMemo(() => {
    let resultado = atividades

    if (filtroFuncionario) {
      const termo = filtroFuncionario.toLowerCase()
      resultado = resultado.filter((a) => a.funcionario?.name?.toLowerCase().includes(termo))
    }

    if (filtroTalhao) {
      resultado = resultado.filter((a) => a.talhaoId === filtroTalhao)
    }

    if (filtroTipoAtividade) {
      resultado = resultado.filter((a) => a.tipoAtividade === filtroTipoAtividade)
    }

    if (filtroMaquina) {
      resultado = resultado.filter((a) => a.maquinaId === filtroMaquina)
    }

    return resultado
  }, [atividades, filtroFuncionario, filtroTalhao, filtroTipoAtividade, filtroMaquina])

  // Soma o Tempo Bruto (diferença crua horaSaida - horaEntrada, sem
  // desconto de almoço) de tudo que está sendo exibido com os filtros
  // atuais — mesma calcularHorasBrutas já usada na linha de detalhes
  // expandidos de cada registro. Faltas e registros sem horaSaida
  // (atividade em andamento) não têm horário e não entram na soma.
  const totalHorasFiltradas = useMemo(
    () =>
      atividadesFiltradas.reduce(
        (acc, a) => acc + (!a.isFalta && a.horaSaida ? calcularHorasBrutas(a.horaEntrada, a.horaSaida) : 0),
        0
      ),
    [atividadesFiltradas]
  )

  const totalHorasHomem = useMemo(
    () => atividadesFiltradas.reduce((acc, a) => acc + (a.horasCalculadas || 0), 0),
    [atividadesFiltradas]
  )
  const totalHorasMaquina = useMemo(
    () => atividadesFiltradas.reduce((acc, a) => acc + (a.horasMaquina || 0), 0),
    [atividadesFiltradas]
  )

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
                  {alertasAusencia.length} funcionário(s) com falta(s) gerada(s) automaticamente este mês
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
                Falta(s) gerada(s) automaticamente em: {meuAlertaAusencia.diasFaltantes.map(formatarDataCurta).join(', ')}. Se algum desses dias estiver incorreto, entre em contato com o gestor.
              </p>
            </div>
          </div>
        )
      )}

      <div className="card space-y-3">
        <h3 className="font-semibold text-primary">Filtros</h3>
        <div className={`grid grid-cols-1 gap-4 ${isGestor ? 'md:grid-cols-3 lg:grid-cols-6' : 'md:grid-cols-2'}`}>
          <input
            type="date"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
            placeholder="Data início"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
            placeholder="Data fim"
            min={filtroDataInicio || undefined}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          {isGestor && (
            <>
              <input
                type="text"
                value={filtroFuncionario}
                onChange={(e) => setFiltroFuncionario(e.target.value)}
                placeholder="Buscar funcionário..."
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={filtroTalhao}
                onChange={(e) => setFiltroTalhao(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todos os Talhões</option>
                {talhoes.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
              <select
                value={filtroTipoAtividade}
                onChange={(e) => setFiltroTipoAtividade(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todas as Atividades</option>
                {tiposAtividade.map((t) => (
                  <option key={t.id} value={t.nome}>{t.nome}</option>
                ))}
              </select>
              <select
                value={filtroMaquina}
                onChange={(e) => setFiltroMaquina(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todas as Máquinas</option>
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </>
          )}
        </div>
        {uploadError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{uploadError}</p>
        )}
        {isGestor && (
          <div className="pt-1 border-t space-y-2">
            <button
              onClick={handlePreviaRecalculo}
              disabled={!filtroDataInicio || !filtroDataFim || recalculando}
              title={!filtroDataInicio || !filtroDataFim ? 'Selecione data início e fim primeiro' : 'Recalcula a carga contratual esperada (e horas extras/devidas) dos dias já lançados nesse período, usando o cadastro atual do(s) funcionário(s)'}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${recalculando ? 'animate-spin' : ''}`} />
              Recalcular carga contratual (dias já lançados no período filtrado)
            </button>
            {recalculoConcluido && (
              <p className="mt-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 inline-block">
                Recálculo aplicado com sucesso.
              </p>
            )}
          </div>
        )}
      </div>

      <div className={atualizandoFiltro ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
      <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Lançamentos</p>
          <p className="text-xs text-green-100">{atividadesFiltradas.length} registro{atividadesFiltradas.length === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-green-800 bg-green-50 border-b border-green-100">
              <th className="px-4 py-3 font-semibold w-10"></th>
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Horário</th>
              {isGestor && <th className="px-4 py-3 font-semibold">Funcionário</th>}
              <th className="px-4 py-3 font-semibold">Talhão / Falta</th>
              <th className="px-4 py-3 font-semibold">Atividade</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {atividadesFiltradas.length === 0 ? (
              <tr>
                <td colSpan={isGestor ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                  Nenhuma atividade registrada
                </td>
              </tr>
            ) : (
              atividadesFiltradas.map((a, i) => (
                <Fragment key={a.id}>
                <tr className={'border-b border-gray-100 last:border-0 transition-colors ' + (a.isFalta ? 'bg-red-50 hover:bg-red-100' : (i % 2 === 1 ? 'bg-gray-50 ' : '') + 'hover:bg-green-50')}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleExpandir(a.id)}
                      className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700 transition-colors"
                      title={expandidos.has(a.id) ? 'Recolher detalhes' : 'Ver detalhes'}
                    >
                      {expandidos.has(a.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(a.data).toLocaleDateString('pt-BR')}{' '}
                    <span className="text-gray-400 text-xs">
                      {DIAS_SEMANA_ABREV[new Date(a.data).getUTCDay()]}
                    </span>
                  </td>
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
                  <td className="px-4 py-3">
                    {a.isFalta ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className="inline-block text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">{a.tipoAtividade}</span>
                    )}
                  </td>
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
                {expandidos.has(a.id) && (
                  <tr className={'border-b border-gray-100 ' + (a.isFalta ? 'bg-red-50' : 'bg-green-50/40')}>
                    <td colSpan={isGestor ? 8 : 7} className="px-4 py-4">
                      {a.isFalta ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-600">
                          <div>
                            <span className="block text-gray-400">Motivo da Falta</span>
                            <span className="font-medium text-gray-700">
                              {a.motivoFalta ? a.motivoFalta.replace(/_/g, ' ') : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-gray-400">Período da Falta</span>
                            <span className="font-medium text-gray-700">{periodoLabel(a.periodoFalta) || '—'}</span>
                          </div>
                          {a.observacao && (
                            <div className="col-span-2 md:col-span-3">
                              <span className="block text-gray-400">Observação</span>
                              <span className="font-medium text-gray-700">{a.observacao}</span>
                            </div>
                          )}
                        </div>
                      ) : (() => {
                        const horasBrutas = a.horaSaida ? calcularHorasBrutas(a.horaEntrada, a.horaSaida) : null
                        const horasCalc = a.horasCalculadas ?? 0
                        const cargaDia = a.horasprevistasdia ?? 0
                        const horasExtras = horasCalc > cargaDia ? horasCalc - cargaDia : 0
                        const horasDevidas = horasCalc < cargaDia ? cargaDia - horasCalc : 0

                        return (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
                              <div>
                                <span className="block text-gray-400">Entrada</span>
                                <span className="font-medium text-gray-700">{a.horaEntrada}</span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Saída</span>
                                <span className="font-medium text-gray-700">{a.horaSaida || '—'}</span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Tempo Bruto</span>
                                <span className="font-medium text-gray-700">{horasBrutas != null ? formatarHoras(horasBrutas) : '—'}</span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Almoço</span>
                                <span className={`font-medium ${a.passouDiretoAlmoco ? 'text-green-600' : 'text-gray-700'}`}>
                                  {a.horaSaida ? (a.passouDiretoAlmoco ? 'Passou direto (+1h extra)' : '- 1h') : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Carga Contratual do Dia</span>
                                <span className="font-medium text-gray-700">{formatarHoras(cargaDia)}</span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Horas Calculadas</span>
                                <span className="font-medium text-gray-700">{formatarHoras(horasCalc)}</span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Horas Extras</span>
                                <span className={`font-medium ${horasExtras > 0 ? 'text-green-600' : 'text-gray-700'}`}>
                                  {horasExtras > 0 ? formatarHoras(horasExtras) : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Horas Devidas</span>
                                <span className={`font-medium ${horasDevidas > 0 ? 'text-orange-600' : 'text-gray-700'}`}>
                                  {horasDevidas > 0 ? formatarHoras(horasDevidas) : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Talhão</span>
                                <span className="font-medium text-gray-700">{a.talhao?.nome || '-'}</span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Safra</span>
                                <span className="font-medium text-gray-700">{a.safra?.nome || '-'}</span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Tipo de Atividade</span>
                                <span className="font-medium text-gray-700">{a.tipoAtividade}</span>
                              </div>
                              {a.maquinaId && (
                                <div>
                                  <span className="block text-gray-400">Máquina</span>
                                  <span className="font-medium text-gray-700">{a.maquina?.nome || '-'}</span>
                                </div>
                              )}
                              {a.maquinaId && (
                                <div>
                                  <span className="block text-gray-400">Horas Máquina</span>
                                  <span className="font-medium text-gray-700">{a.horasMaquina ? `${a.horasMaquina.toFixed(1)}h` : '-'}</span>
                                </div>
                              )}
                              {a.maquinaId && a.horimetroInicial != null && (
                                <div>
                                  <span className="block text-gray-400">Horímetro Inicial</span>
                                  <span className="font-medium text-gray-700">{a.horimetroInicial.toFixed(1)}h</span>
                                </div>
                              )}
                              {a.maquinaId && a.horimetroFinal != null && (
                                <div>
                                  <span className="block text-gray-400">Horímetro Final</span>
                                  <span className="font-medium text-gray-700">{a.horimetroFinal.toFixed(1)}h</span>
                                </div>
                              )}
                              {a.implementoUtilizado && (
                                <div>
                                  <span className="block text-gray-400">Implemento</span>
                                  <span className="font-medium text-gray-700">{a.implementoUtilizado}</span>
                                </div>
                              )}
                              {a.totalBombas != null && (
                                <div>
                                  <span className="block text-gray-400">Total de Bombas</span>
                                  <span className="font-medium text-gray-700">{a.totalBombas}</span>
                                </div>
                              )}
                              {a.tipoAdubo && (
                                <div>
                                  <span className="block text-gray-400">Adubo</span>
                                  <span className="font-medium text-gray-700">
                                    {a.tipoAdubo}{a.quantidadeAdubo != null ? ` — ${a.quantidadeAdubo}` : ''}
                                  </span>
                                </div>
                              )}
                              {a.tipoCorretivo && (
                                <div>
                                  <span className="block text-gray-400">Corretivo</span>
                                  <span className="font-medium text-gray-700">
                                    {a.tipoCorretivo}{a.quantidadeCorretivo != null ? ` — ${a.quantidadeCorretivo}` : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                            {a.observacao && (
                              <div className="text-xs text-gray-600">
                                <span className="block text-gray-400">Observação</span>
                                <span className="font-medium text-gray-700">{a.observacao}</span>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-green-200 font-semibold bg-green-50">
              <td colSpan={3} className="px-4 py-3 text-green-900">
                Total: {formatarHoras(totalHorasFiltradas)}
              </td>
              <td colSpan={isGestor ? 5 : 4}></td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-gray-600 text-sm">Total de Registros</p>
          <p className="text-3xl font-bold text-primary mt-2">{atividadesFiltradas.length}</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Total de Horas Homem</p>
          <p className="text-3xl font-bold text-primary mt-2">{formatarHoras(totalHorasHomem)}</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm">Total de Horas Máquina</p>
          <p className="text-3xl font-bold text-primary mt-2">{formatarHoras(totalHorasMaquina)}</p>
        </div>
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

      {previaRecalculo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-primary flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Prévia do recálculo de carga contratual
              </h3>
              <button onClick={() => setPreviaRecalculo(null)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600 mb-3">
                Analisados <strong>{previaRecalculo.totalAnalisados}</strong> registro(s) no período
                {' '}{filtroDataInicio.split('-').reverse().join('/')} a {filtroDataFim.split('-').reverse().join('/')}.
                {' '}<strong>{previaRecalculo.totalAlterados}</strong> serão alterados.
              </p>
              {previaRecalculo.totalAlterados === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-3">
                  Nenhuma diferença encontrada — a carga contratual já está de acordo com o cadastro atual nesse período.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 bg-gray-50 border-b">
                          <th className="py-2 px-2 font-medium">Data</th>
                          <th className="py-2 px-2 font-medium">Funcionário</th>
                          <th className="py-2 px-2 font-medium text-right">Carga</th>
                          <th className="py-2 px-2 font-medium text-right">Extras</th>
                          <th className="py-2 px-2 font-medium text-right">Devidas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previaRecalculo.mudancas.map((m) => (
                          <tr key={m.id} className="border-b last:border-0">
                            <td className="py-1.5 px-2">{m.data.split('-').reverse().join('/')}</td>
                            <td className="py-1.5 px-2">{m.funcionarioNome}</td>
                            <td className="py-1.5 px-2 text-right">{m.cargaAntes}h → <strong>{m.cargaDepois}h</strong></td>
                            <td className="py-1.5 px-2 text-right">{m.extrasAntes}h → <strong>{m.extrasDepois}h</strong></td>
                            <td className="py-1.5 px-2 text-right">{m.devidasAntes}h → <strong>{m.devidasDepois}h</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previaRecalculo.mudancasOmitidas > 0 && (
                    <p className="text-xs text-gray-400 mt-2">+ {previaRecalculo.mudancasOmitidas} outra(s) alteração(ões) não mostrada(s) aqui.</p>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t">
              <button
                onClick={() => setPreviaRecalculo(null)}
                disabled={aplicandoRecalculo}
                className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              {previaRecalculo.totalAlterados > 0 && (
                <button
                  onClick={handleConfirmarRecalculo}
                  disabled={aplicandoRecalculo}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {aplicandoRecalculo ? 'Aplicando...' : `Confirmar recálculo (${previaRecalculo.totalAlterados})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {previaLimpezaFaltas && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-primary flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Prévia da limpeza de faltas de fim de semana
              </h3>
              <button onClick={() => setPreviaLimpezaFaltas(null)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600 mb-3">
                Analisadas <strong>{previaLimpezaFaltas.totalAnalisados}</strong> falta(s) automática(s) no período
                {' '}{filtroDataInicio.split('-').reverse().join('/')} a {filtroDataFim.split('-').reverse().join('/')}.
                {' '}<strong>{previaLimpezaFaltas.totalAlterados}</strong> serão excluídas (caem em sábado/domingo com carga esperada 0 hoje).
              </p>
              {previaLimpezaFaltas.totalAlterados === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-3">
                  Nenhuma falta indevida encontrada nesse período.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 bg-gray-50 border-b">
                          <th className="py-2 px-2 font-medium">Data</th>
                          <th className="py-2 px-2 font-medium">Dia</th>
                          <th className="py-2 px-2 font-medium">Funcionário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previaLimpezaFaltas.mudancas.map((m) => (
                          <tr key={m.id} className="border-b last:border-0">
                            <td className="py-1.5 px-2">{m.data.split('-').reverse().join('/')}</td>
                            <td className="py-1.5 px-2 capitalize">{m.diaSemana}</td>
                            <td className="py-1.5 px-2">{m.funcionarioNome}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previaLimpezaFaltas.mudancasOmitidas > 0 && (
                    <p className="text-xs text-gray-400 mt-2">+ {previaLimpezaFaltas.mudancasOmitidas} outra(s) não mostrada(s) aqui.</p>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t">
              <button
                onClick={() => setPreviaLimpezaFaltas(null)}
                disabled={aplicandoLimpezaFaltas}
                className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              {previaLimpezaFaltas.totalAlterados > 0 && (
                <button
                  onClick={handleConfirmarLimpezaFaltas}
                  disabled={aplicandoLimpezaFaltas}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {aplicandoLimpezaFaltas ? 'Excluindo...' : `Confirmar exclusão (${previaLimpezaFaltas.totalAlterados})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
