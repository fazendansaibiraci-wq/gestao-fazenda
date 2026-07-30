'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Fuel, BarChart3, Droplet, Trash2 } from 'lucide-react'
import { AjustarHorimetro } from '@/components/AjustarHorimetro'

export default function CombustivelPage() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState('abastecimento')
  const [maquinas, setMaquinas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && !['GERENTE', 'GESTOR'].includes(session.user.role)) {
      redirect('/dashboard')
    }
    if (status === 'authenticated') load()
  }, [status, session])

  const load = async () => {
    try {
      const res = await fetch('/api/maquinas')
      const data = await res.json()
      setMaquinas(data.data?.filter((m: any) => m.status === 'ATIVA') || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  if (session?.user?.role && !['GERENTE', 'GESTOR'].includes(session.user.role)) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Gestão de Combustível</h1>
        <p className="text-gray-600 mt-1">Controle de abastecimentos e consumo de diesel</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('abastecimento')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'abastecimento'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Fuel className="inline w-4 h-4 mr-2" />
          Abastecimento
        </button>
        {(session?.user?.role === 'GESTOR' || session?.user?.role === 'GERENTE') && (
          <button
            onClick={() => setActiveTab('entrada')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'entrada'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Droplet className="inline w-4 h-4 mr-2" />
            Entrada Diesel
          </button>
        )}
        <button
          onClick={() => setActiveTab('estoque')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'estoque'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="inline w-4 h-4 mr-2" />
          Painel Estoque
        </button>
      </div>

      {/* Content */}
      <div className="card">
        {activeTab === 'abastecimento' && <AbaAbastecimento maquinas={maquinas} />}
        {activeTab === 'entrada' && <AbaEntrada />}
        {activeTab === 'estoque' && <AbaPainelEstoque />}
      </div>
    </div>
  )
}

// Aba 1: Abastecimento de Trator
function AbaAbastecimento({ maquinas }: { maquinas: any[] }) {
  const { data: session } = useSession()
  const isGestor = session?.user?.role === 'GESTOR' || session?.user?.role === 'GERENTE'
  const [abastecimentos, setAbastecimentos] = useState([])
  const [form, setForm] = useState({
    maquinaId: '',
    data: new Date().toISOString().split('T')[0],
    horimetroAtual: '',
    litrosAbastecidos: '',
    valorPorLitro: '',
    observacao: '',
    talhaoId: '',
    safraId: '',
    tipoAtividade: '',
  })
  const [loading, setLoading] = useState(false)
  const [paginaAbastecimentos, setPaginaAbastecimentos] = useState(0)
  const ITENS_POR_PAGINA = 10

  useEffect(() => {
    load()
    carregarUltimoValorDiesel()
  }, [])

  const load = async () => {
    try {
      const res = await fetch('/api/abastecimentos')
      const data = await res.json()
      setAbastecimentos(data.data || [])
      setPaginaAbastecimentos(0)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteAbastecimento = async (id: string) => {
    if (!confirm('Excluir esse abastecimento? O diesel debitado volta pro estoque.')) return
    try {
      const res = await fetch(`/api/abastecimentos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro')
      load()
    } catch (err) {
      alert('Erro ao excluir')
    }
  }

  const carregarUltimoValorDiesel = async () => {
    try {
      const res = await fetch('/api/entradas-diesel')
      const data = await res.json()
      const entradas = data.data || []
      if (entradas.length > 0) {
        const ultima = entradas[0] // já vem ordenado por data desc
        setForm(prev => ({ ...prev, valorPorLitro: ultima.valorPorLitro.toString() }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/abastecimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          horimetroAtual: parseFloat(form.horimetroAtual),
          litrosAbastecidos: parseFloat(form.litrosAbastecidos),
          valorPorLitro: parseFloat(form.valorPorLitro),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao salvar')
      }
      setForm({
        maquinaId: '',
        data: new Date().toISOString().split('T')[0],
        horimetroAtual: '',
        litrosAbastecidos: '',
        valorPorLitro: '',
        observacao: '',
        talhaoId: '',
        safraId: '',
        tipoAtividade: '',
      })
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  const totalPaginasAbastecimentos = Math.max(1, Math.ceil(abastecimentos.length / ITENS_POR_PAGINA))
  const abastecimentosPagina = abastecimentos.slice(
    paginaAbastecimentos * ITENS_POR_PAGINA,
    paginaAbastecimentos * ITENS_POR_PAGINA + ITENS_POR_PAGINA
  )

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-4">
        <h3 className="font-semibold text-primary">Novo Abastecimento</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Máquina</label>
            <select
              value={form.maquinaId}
              onChange={(e) => setForm({ ...form, maquinaId: e.target.value })}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">Selecionar trator</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Data/Hora</label>
            <input
              type="datetime-local"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Horímetro Atual (h)</label>
            <input
              type="number"
              value={form.horimetroAtual}
              onChange={(e) => setForm({ ...form, horimetroAtual: e.target.value })}
              required
              step="0.1"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="0,0"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Litros Abastecidos</label>
            <input
              type="number"
              value={form.litrosAbastecidos}
              onChange={(e) => setForm({ ...form, litrosAbastecidos: e.target.value })}
              required
              step="0.01"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Valor R$/Litro
              <span className="text-xs text-gray-400 ml-2">(preenchido da última NF)</span>
            </label>
            <input
              type="number"
              value={form.valorPorLitro}
              onChange={(e) => setForm({ ...form, valorPorLitro: e.target.value })}
              required
              step="0.01"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Observação</label>
            <input
              type="text"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Salvando...' : 'Registrar Abastecimento'}
        </button>
      </form>

      {/* Histórico */}
      <div>
        <h3 className="font-semibold mb-3">Histórico de Abastecimentos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Data</th>
                <th className="px-4 py-2 text-left">Máquina</th>
                <th className="px-4 py-2 text-left">Horímetro</th>
                <th className="px-4 py-2 text-left">Litros</th>
                <th className="px-4 py-2 text-left">Consumo L/h</th>
                <th className="px-4 py-2 text-left">Custo</th>
                {isGestor && <th className="px-4 py-2 text-left">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {abastecimentosPagina.map((a: any) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2 font-medium">{a.maquina?.nome}</td>
                  <td className="px-4 py-2">{a.horimetroAtual.toFixed(1)}h</td>
                  <td className="px-4 py-2">{a.litrosAbastecidos.toFixed(2)}L</td>
                  <td className="px-4 py-2">{a.consumoLporH?.toFixed(2) || '-'}</td>
                  <td className="px-4 py-2">R$ {a.custoAbastecimento?.toFixed(2)}</td>
                  {isGestor && (
                    <td className="px-4 py-2">
                      <button onClick={() => handleDeleteAbastecimento(a.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {abastecimentos.length > ITENS_POR_PAGINA && (
          <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
            <span>
              Mostrando {abastecimentosPagina.length === 0 ? 0 : paginaAbastecimentos * ITENS_POR_PAGINA + 1}
              –{Math.min((paginaAbastecimentos + 1) * ITENS_POR_PAGINA, abastecimentos.length)} de {abastecimentos.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaginaAbastecimentos((p) => Math.max(0, p - 1))}
                disabled={paginaAbastecimentos === 0}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <span>Página {paginaAbastecimentos + 1} de {totalPaginasAbastecimentos}</span>
              <button
                type="button"
                onClick={() => setPaginaAbastecimentos((p) => Math.min(totalPaginasAbastecimentos - 1, p + 1))}
                disabled={paginaAbastecimentos >= totalPaginasAbastecimentos - 1}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      <AjustarHorimetro maquinas={maquinas} />
    </div>
  )
}

// Aba 2: Entrada de Diesel
function AbaEntrada() {
  const { data: session } = useSession()
  const isGestor = session?.user?.role === 'GESTOR' || session?.user?.role === 'GERENTE'
  const [entradas, setEntradas] = useState([])
  const [paginaEntradas, setPaginaEntradas] = useState(0)
  const ITENS_POR_PAGINA_ENTRADAS = 10

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const res = await fetch('/api/entradas-diesel')
      const data = await res.json()
      setEntradas(data.data || [])
      setPaginaEntradas(0)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta entrada?')) return
    try {
      const res = await fetch(`/api/entradas-diesel/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao excluir')
      }
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const totalPaginasEntradas = Math.max(1, Math.ceil(entradas.length / ITENS_POR_PAGINA_ENTRADAS))
  const entradasPagina = entradas.slice(
    paginaEntradas * ITENS_POR_PAGINA_ENTRADAS,
    paginaEntradas * ITENS_POR_PAGINA_ENTRADAS + ITENS_POR_PAGINA_ENTRADAS
  )

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm text-amber-800">
        Novas entradas de diesel agora são feitas via <strong>Estoque → Entrada de Produtos (NF-e)</strong>,
        anexando a XML da nota fiscal. Essa tela abaixo mostra só o histórico de entradas antigas, como referência.
      </div>

      {/* Histórico */}
      <div>
        <h3 className="font-semibold mb-3">Histórico de Entradas</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Data</th>
                <th className="px-4 py-2 text-left">Litros</th>
                <th className="px-4 py-2 text-left">R$/Litro</th>
                <th className="px-4 py-2 text-left">Custo Total</th>
                <th className="px-4 py-2 text-left">NF</th>
                {isGestor && <th className="px-4 py-2 text-left">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {entradasPagina.map((e: any) => (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{new Date(e.data).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2">{e.litrosRecebidos.toFixed(2)}L</td>
                  <td className="px-4 py-2">R$ {e.valorPorLitro.toFixed(2)}</td>
                  <td className="px-4 py-2">R$ {e.custoTotal?.toFixed(2) || (e.litrosRecebidos * e.valorPorLitro).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {e.nf || '-'}
                    {e.origem === 'nfe' && <span className="ml-1 text-xs text-blue-600">(NF-e)</span>}
                  </td>
                  {isGestor && (
                    <td className="px-4 py-2">
                      {e.origem !== 'nfe' && (
                        <button onClick={() => handleDelete(e.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {entradas.length > ITENS_POR_PAGINA_ENTRADAS && (
          <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
            <span>
              Mostrando {entradasPagina.length === 0 ? 0 : paginaEntradas * ITENS_POR_PAGINA_ENTRADAS + 1}
              –{Math.min((paginaEntradas + 1) * ITENS_POR_PAGINA_ENTRADAS, entradas.length)} de {entradas.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaginaEntradas((p) => Math.max(0, p - 1))}
                disabled={paginaEntradas === 0}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <span>Página {paginaEntradas + 1} de {totalPaginasEntradas}</span>
              <button
                type="button"
                onClick={() => setPaginaEntradas((p) => Math.min(totalPaginasEntradas - 1, p + 1))}
                disabled={paginaEntradas >= totalPaginasEntradas - 1}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Aba 3: Painel de Estoque
function AbaPainelEstoque() {
  const [estoque, setEstoque] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const res = await fetch('/api/painel-estoque')
      const data = await res.json()
      setEstoque(data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="flex justify-center py-8"><div className="spinner"></div></div>

  return (
    <div className="space-y-6">
      {/* Indicadores Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
          <p className="text-sm text-blue-700 font-medium">Estoque Teórico</p>
          <p className="text-3xl font-bold text-blue-900 mt-2">{estoque?.estoqueTeorico?.toFixed(0) || 0}L</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
          <p className="text-sm text-green-700 font-medium">Estoque Físico</p>
          <p className="text-3xl font-bold text-green-900 mt-2">{estoque?.estoqueFisico?.toFixed(0) || 0}L</p>
        </div>
        <div className={`bg-gradient-to-br p-4 rounded-lg ${
          estoque?.percentualDif > 2 ? 'from-red-50 to-red-100' : 'from-gray-50 to-gray-100'
        }`}>
          <p className="text-sm font-medium">Diferença</p>
          <p className={`text-3xl font-bold mt-2 ${
            estoque?.percentualDif > 2 ? 'text-red-900' : 'text-gray-900'
          }`}>
            {estoque?.percentualDif?.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
          <p className="text-sm text-purple-700 font-medium">Custo Médio/Litro</p>
          <p className="text-3xl font-bold text-purple-900 mt-2">R$ {estoque?.custoMedioLitro?.toFixed(2) || '0,00'}</p>
        </div>
      </div>

      {/* Alertas */}
      {estoque?.percentualDif && estoque.percentualDif > 2 && (
        <div className="alert alert-error">
          <p className="font-semibold">⚠️ Alerta de Desvio</p>
          <p className="text-sm mt-1">Diferença de {estoque.percentualDif.toFixed(1)}% detectada. Possível desvio ou vazamento.</p>
        </div>
      )}

      {/* Detalhes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h4 className="font-semibold text-primary mb-3">Consumo do Período</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Custo Total Consumido:</span>
              <span className="font-bold">R$ {estoque?.custoTotalConsumo?.toFixed(2) || '0,00'}</span>
            </div>
            <div className="flex justify-between">
              <span>Custo por Hora (Máquina):</span>
              <span className="font-bold">R$ {estoque?.custoMedioHora?.toFixed(2) || '0,00'}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 className="font-semibold text-primary mb-3">Análise de Estoque</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Diferença (L):</span>
              <span className="font-bold">{estoque?.diferenca?.toFixed(2)}L</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                estoque?.percentualDif > 2
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {estoque?.percentualDif && estoque.percentualDif <= 2 ? 'OK' : 'ALERTA'}
              </span>
            </div>
          </div>
      </div>
    </div>
    </div>
  )
}

