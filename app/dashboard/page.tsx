'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Leaf, Tractor, Calendar, BarChart3, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface DashboardStats {
  totalTalhoes: number
  totalSafras: number
  totalMaquinas: number
  atividadesPendentes: number
}

interface AlertaAusencia {
  funcionarioId: string
  nome: string
  diasFaltantes: string[]
}

interface CustoHHHMPorTalhao {
  talhaoId: string
  nomeTalhao: string
  custoHHPorHa: number | null
  custoHMPorHa: number | null
  horasHH: number
  horasHM: number
}

interface ConsumoPorMaquina {
  maquina: string
  consumoMedioLH: number
}

interface HorasPorFuncionario {
  funcionario: string
  totalHoras: number
}

interface LitrosDieselPorDia {
  dia: string
  litros: number
}

interface DadosGraficos {
  consumoPorMaquina: ConsumoPorMaquina[]
  horasPorFuncionario: HorasPorFuncionario[]
  litrosDieselPorDia: LitrosDieselPorDia[]
}

// Cor para cada fatia do gráfico de pizza de consumo de combustível por
// máquina — gerada dinamicamente com espaçamento de matiz HSL uniforme,
// garantindo cores sempre distintas independente de quantas máquinas
// existirem (evita repetição que uma paleta fixa teria ao ciclar).
const corConsumoMaquina = (index: number, total: number) =>
  `hsl(${Math.round((360 / total) * index)}, 65%, 50%)`

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const [stats, setStats] = useState<DashboardStats>({
    totalTalhoes: 0,
    totalSafras: 0,
    totalMaquinas: 0,
    atividadesPendentes: 0,
  })
  const [loading, setLoading] = useState(true)
  const [alertasAusencia, setAlertasAusencia] = useState<AlertaAusencia[]>([])
  const [alertaAusenciaExpandido, setAlertaAusenciaExpandido] = useState(false)
  const [dadosGraficos, setDadosGraficos] = useState<DadosGraficos>({
    consumoPorMaquina: [],
    horasPorFuncionario: [],
    litrosDieselPorDia: [],
  })
  const [custoHHHMPorTalhao, setCustoHHHMPorTalhao] = useState<CustoHHHMPorTalhao[]>([])

  // Filtro de mês exclusivo do gráfico de Consumo de Combustível por
  // Máquina — os outros dois gráficos de /api/dashboard-graficos (horas
  // por funcionário, litros de diesel por dia) continuam sempre "mês
  // atual", sem serem afetados por esse filtro.
  const [mesFiltroConsumo, setMesFiltroConsumo] = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
  })
  const primeiraRenderizacaoFiltroConsumo = useRef(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }

    if (status === 'authenticated') {
      const userRole = (session?.user as any)?.role
      if (userRole === 'FUNCIONARIO') {
        redirect('/modules/atividades')
      }
      loadStats()
      loadAlertasAusencia()
      loadDadosGraficos()
      loadCustoHHHM()
    }
  }, [status, session])

  // A carga inicial (loadDadosGraficos, sem params) já alimenta os 3
  // gráficos com o mês atual. Esse efeito só entra em ação depois que o
  // usuário mexe no filtro — daí busca de novo só o consumo por máquina,
  // pro mês escolhido, sem tocar nos outros dois gráficos já carregados.
  useEffect(() => {
    if (primeiraRenderizacaoFiltroConsumo.current) {
      primeiraRenderizacaoFiltroConsumo.current = false
      return
    }
    loadConsumoPorMaquinaFiltrado()
  }, [mesFiltroConsumo])

  const loadStats = async () => {
    try {
      setLoading(true)
      const [talhoes, safras, maquinas, atividades] = await Promise.all([
        fetch('/api/talhoes').then(r => r.json()),
        fetch('/api/safras').then(r => r.json()),
        fetch('/api/maquinas').then(r => r.json()),
        fetch('/api/registros-atividade?status=PENDENTE').then(r => r.json()),
      ])

      setStats({
        totalTalhoes: talhoes.data?.length || 0,
        totalSafras: safras.data?.length || 0,
        totalMaquinas: maquinas.data?.length || 0,
        atividadesPendentes: atividades.data?.length || 0,
      })
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAlertasAusencia = async () => {
    try {
      const res = await fetch('/api/alertas-ausencia')
      if (res.ok) {
        const data = await res.json()
        setAlertasAusencia(data.data || [])
      }
    } catch (error) {
      console.error('Erro ao carregar alertas de ausência:', error)
    }
  }

  const loadDadosGraficos = async () => {
    try {
      const res = await fetch('/api/dashboard-graficos')
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          setDadosGraficos(data.data)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados dos gráficos:', error)
    }
  }

  // Busca só o consumo por máquina pro mês selecionado no filtro, sem
  // mexer em horasPorFuncionario/litrosDieselPorDia (merge parcial do
  // state).
  const loadConsumoPorMaquinaFiltrado = async () => {
    try {
      const [anoStr, mesStr] = mesFiltroConsumo.split('-')
      const res = await fetch(`/api/dashboard-graficos?ano=${anoStr}&mes=${parseInt(mesStr, 10)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          setDadosGraficos(prev => ({ ...prev, consumoPorMaquina: data.data.consumoPorMaquina }))
        }
      }
    } catch (error) {
      console.error('Erro ao carregar consumo de combustível filtrado:', error)
    }
  }

  // Últimos 12 meses (incluindo o atual), mais recente primeiro — opções
  // do <select> do filtro de mês do gráfico de consumo de combustível.
  const opcoesMesFiltroConsumo = (() => {
    const nomesMes = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ]
    const hoje = new Date()
    const opcoes: { valor: string; rotulo: string }[] = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      opcoes.push({ valor, rotulo: `${nomesMes[d.getMonth()]} ${d.getFullYear()}` })
    }
    return opcoes
  })()

  const formatarDataYYYYMMDD = (data: Date) => {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const dia = String(data.getDate()).padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }

  const loadCustoHHHM = async () => {
    try {
      const hoje = new Date()
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      const dataInicio = formatarDataYYYYMMDD(inicioMes)
      const dataFim = formatarDataYYYYMMDD(hoje)
      const res = await fetch(`/api/relatorios/custo-hh-hm?dataInicio=${dataInicio}&dataFim=${dataFim}`)
      if (res.ok) {
        const data = await res.json()
        setCustoHHHMPorTalhao(data.data || [])
      }
    } catch (error) {
      console.error('Erro ao carregar custo HH/HM por talhão:', error)
    }
  }

  const formatarDataCurta = (data: string) => {
    const [, mes, dia] = data.split('-')
    return `${dia}/${mes}`
  }

  // Encurta nomes longos no eixo do gráfico de Horas por Funcionário (ex:
  // "LUIS CARLOS DE OLIVEIRA" -> "LUIS ... OLIVEIRA"), mantendo o nome
  // completo disponível no tooltip.
  const truncarNomeFuncionario = (nome: string, maxLen: number = 18) => {
    if (nome.length <= maxLen) return nome
    const partes = nome.trim().split(/\s+/)
    if (partes.length <= 2) {
      return `${nome.slice(0, maxLen - 1)}…`
    }
    const curto = `${partes[0]} ... ${partes[partes.length - 1]}`
    return curto.length <= maxLen + 6 ? curto : `${nome.slice(0, maxLen - 1)}…`
  }

  const semDadosCustoHHHM =
    custoHHHMPorTalhao.length === 0 ||
    custoHHHMPorTalhao.every((t) => !t.horasHH && !t.horasHM)

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">
          Bem-vindo, {session.user?.name}!
        </h1>
        <p className="text-gray-600 mt-1">
          Sistema de Gestão Agrícola - Gestão Fazenda
        </p>
      </div>

      {alertasAusencia.length > 0 && (
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
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/modules/talhoes">
          <div className="card cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Talhões</p>
                <p className="text-3xl font-bold text-primary mt-2">
                  {loading ? '-' : stats.totalTalhoes}
                </p>
              </div>
              <div className="p-3 bg-light rounded-lg">
                <Leaf className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </Link>

        <Link href="/modules/safras">
          <div className="card cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Safras</p>
                <p className="text-3xl font-bold text-primary mt-2">
                  {loading ? '-' : stats.totalSafras}
                </p>
              </div>
              <div className="p-3 bg-light rounded-lg">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </Link>

        <Link href="/modules/maquinas">
          <div className="card cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Máquinas</p>
                <p className="text-3xl font-bold text-primary mt-2">
                  {loading ? '-' : stats.totalMaquinas}
                </p>
              </div>
              <div className="p-3 bg-light rounded-lg">
                <Tractor className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </Link>

        <Link href="/modules/atividades">
          <div className="card cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">
                  Atividades Pendentes
                </p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {loading ? '-' : stats.atividadesPendentes}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-primary mb-4">Comparativo Hora Homem e Hora Máquina por Talhão este mês</h3>
          {semDadosCustoHHHM ? (
            <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
              Sem dados este mês
            </div>
          ) : (() => {
            const dadosHHHM = custoHHHMPorTalhao.map((t) => ({
              nomeTalhao: t.nomeTalhao,
              horasHH: t.horasHH ?? 0,
              horasHM: t.horasHM ?? 0,
            }))

            return (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dadosHHHM}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="nomeTalhao" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}h`} />
                  <Legend />
                  <Bar dataKey="horasHH" name="Hora Homem" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="horasHM" name="Hora Máquina" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          })()}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h3 className="font-semibold text-primary">Consumo de Combustível por Máquina (L/h)</h3>
            <select
              value={mesFiltroConsumo}
              onChange={(e) => setMesFiltroConsumo(e.target.value)}
              className="border rounded-lg px-2 py-1 text-sm"
            >
              {opcoesMesFiltroConsumo.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
              ))}
            </select>
          </div>
          {dadosGraficos.consumoPorMaquina.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
              Sem dados este mês
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={dadosGraficos.consumoPorMaquina}
                  dataKey="consumoMedioLH"
                  nameKey="maquina"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                >
                  {dadosGraficos.consumoPorMaquina.map((_, index) => (
                    <Cell
                      key={`cell-consumo-maquina-${index}`}
                      fill={corConsumoMaquina(index, dadosGraficos.consumoPorMaquina.length)}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toFixed(1)} L/h`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-primary mb-4">Horas Trabalhadas por Funcionário este mês</h3>
          {dadosGraficos.horasPorFuncionario.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
              Sem dados este mês
            </div>
          ) : (() => {
            const dadosHorasFuncionario = dadosGraficos.horasPorFuncionario.map(f => ({
              ...f,
              funcionarioCurto: truncarNomeFuncionario(f.funcionario),
            }))
            const alturaGraficoFuncionarios = Math.max(250, dadosHorasFuncionario.length * 40 + 40)

            return (
              <ResponsiveContainer width="100%" height={alturaGraficoFuncionarios}>
                <BarChart
                  data={dadosHorasFuncionario}
                  layout="vertical"
                  margin={{ left: 100, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="funcionarioCurto" type="category" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      payload && payload[0] ? (payload[0].payload as any).funcionario : ''
                    }
                  />
                  <Bar dataKey="totalHoras" fill="#52b788" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          })()}
        </div>

        <div className="card">
          <h3 className="font-semibold text-primary mb-4">Litros de Diesel Abastecidos por Dia este mês</h3>
          {dadosGraficos.litrosDieselPorDia.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
              Sem dados este mês
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dadosGraficos.litrosDieselPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}L`, 'Litros']} />
                <Line type="monotone" dataKey="litros" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/modules/talhoes/novo" className="block">
            <button className="w-full btn btn-secondary">
              <Leaf className="w-5 h-5" />
              Novo Talhão
            </button>
          </Link>

          <Link href="/modules/safras/novo" className="block">
            <button className="w-full btn btn-secondary">
              <Calendar className="w-5 h-5" />
              Nova Safra
            </button>
          </Link>

          <Link href="/modules/relatorios" className="block">
            <button className="w-full btn btn-secondary">
              <BarChart3 className="w-5 h-5" />
              Relatórios
            </button>
          </Link>
        </div>
      </div>

      <div className="card bg-light border-l-4 border-primary">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-primary">Dica:</p>
            <p className="text-sm text-gray-700 mt-1">
              Todos os dados são salvos na nuvem e sincronizados em tempo real.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
