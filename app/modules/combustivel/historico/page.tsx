'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Trash2, Filter, Pencil } from 'lucide-react'

type FormEdicao = {
  data: string
  horimetroAnterior: string
  horimetroAtual: string
  litrosAbastecidos: string
}

type CascataInfo = {
  proximoId: string
  proximoData: string
  horimetroAnteriorAntigo: number | null
  horimetroAnteriorNovo: number
}

export default function HistoricoAbastecimentosPage() {
  const { data: session, status } = useSession()
  const isGestor = session?.user?.role === 'GESTOR' || session?.user?.role === 'GERENTE'
  const [abastecimentos, setAbastecimentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [paginaAbastecimentos, setPaginaAbastecimentos] = useState(0)
  const ITENS_POR_PAGINA = 10
  const [maquinas, setMaquinas] = useState<any[]>([])
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroMaquina, setFiltroMaquina] = useState('')

  const [editando, setEditando] = useState<any | null>(null)
  const [form, setForm] = useState<FormEdicao>({ data: '', horimetroAnterior: '', horimetroAtual: '', litrosAbastecidos: '' })
  const [erroEdicao, setErroEdicao] = useState('')
  const [cascata, setCascata] = useState<CascataInfo | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && !['GERENTE', 'GESTOR'].includes(session.user.role)) {
      redirect('/dashboard')
    }
    if (status === 'authenticated') {
      load()
      carregarMaquinas()
    }
  }, [status, session])

  useEffect(() => {
    if (status === 'authenticated') load()
  }, [filtroDataInicio, filtroDataFim, filtroMaquina])

  const carregarMaquinas = async () => {
    try {
      const res = await fetch('/api/maquinas')
      const data = await res.json()
      setMaquinas(data.data?.filter((m: any) => m.status === 'ATIVA') || [])
    } catch (err) {
      console.error(err)
    }
  }

  const load = async () => {
    try {
      const params = new URLSearchParams()
      if (filtroDataInicio) params.append('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.append('dataFim', filtroDataFim)
      if (filtroMaquina) params.append('maquinaId', filtroMaquina)
      const url = params.toString() ? `/api/abastecimentos?${params.toString()}` : '/api/abastecimentos'
      const res = await fetch(url)
      const data = await res.json()
      setAbastecimentos(data.data || [])
      setPaginaAbastecimentos(0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
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

  const dataParaInput = (d: string | Date) => {
    // Formata em horário local (não UTC) no formato aceito por
    // datetime-local, preservando a hora original do registro —
    // evita truncar pra 00:00:00 em dias com múltiplos lançamentos
    // da mesma máquina.
    const dt = new Date(d)
    const pad = (n: number) => String(n).padStart(2, '0')
    const ano = dt.getFullYear()
    const mes = pad(dt.getMonth() + 1)
    const dia = pad(dt.getDate())
    const hora = pad(dt.getHours())
    const minuto = pad(dt.getMinutes())
    return `${ano}-${mes}-${dia}T${hora}:${minuto}`
  }

  const handleAbrirEdicao = (a: any) => {
    setEditando(a)
    setForm({
      data: dataParaInput(a.data),
      horimetroAnterior: String(a.horimetroanterior ?? ''),
      horimetroAtual: String(a.horimetroAtual ?? ''),
      litrosAbastecidos: String(a.litrosAbastecidos ?? ''),
    })
    setErroEdicao('')
    setCascata(null)
  }

  const fecharModalEdicao = () => {
    setEditando(null)
    setForm({ data: '', horimetroAnterior: '', horimetroAtual: '', litrosAbastecidos: '' })
    setErroEdicao('')
    setCascata(null)
    setSalvando(false)
  }

  const validarFormEdicao = (): string | null => {
    const anterior = Number(form.horimetroAnterior)
    const atual = Number(form.horimetroAtual)
    const litros = Number(form.litrosAbastecidos)
    if (!form.data) return 'Informe a data'
    if (Number.isNaN(anterior) || Number.isNaN(atual)) return 'Horímetros inválidos'
    if (atual <= anterior) return 'Horímetro atual deve ser maior que o horímetro anterior'
    if (Number.isNaN(litros) || litros <= 0) return 'Litros deve ser maior que zero'
    return null
  }

  const enviarEdicao = async (confirmarCascata: boolean) => {
    if (!editando) return
    const erro = validarFormEdicao()
    if (erro) {
      setErroEdicao(erro)
      return
    }
    setSalvando(true)
    setErroEdicao('')
    try {
      const res = await fetch(`/api/abastecimentos/${editando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: form.data,
          horimetroAnterior: Number(form.horimetroAnterior),
          horimetroAtual: Number(form.horimetroAtual),
          litrosAbastecidos: Number(form.litrosAbastecidos),
          confirmarCascata,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setErroEdicao(json.error || 'Erro ao salvar')
        setSalvando(false)
        return
      }

      if (json.needsConfirmation) {
        setCascata(json.cascade)
        setSalvando(false)
        return
      }

      // Sucesso — atualiza os registros afetados na tela sem recarregar tudo
      setAbastecimentos((prev: any[]) =>
        prev.map((item) => {
          if (item.id === json.data.editado.id) return json.data.editado
          if (json.data.proximo && item.id === json.data.proximo.id) return json.data.proximo
          return item
        })
      )
      fecharModalEdicao()
    } catch (err) {
      setErroEdicao('Erro ao salvar')
      setSalvando(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  if (session?.user?.role && !['GERENTE', 'GESTOR'].includes(session.user.role)) {
    return null
  }

  const totalPaginasAbastecimentos = Math.max(1, Math.ceil(abastecimentos.length / ITENS_POR_PAGINA))
  const abastecimentosPagina = abastecimentos.slice(
    paginaAbastecimentos * ITENS_POR_PAGINA,
    paginaAbastecimentos * ITENS_POR_PAGINA + ITENS_POR_PAGINA
  )

  // Totais sobre TODOS os registros filtrados (nao so a pagina visivel
  // na tela). Consumo medio e ponderado (litros totais / horas totais),
  // nao a soma dos consumos individuais - soma de L/h nao teria sentido
  // como metrica. Horimetro nao entra no total: e uma leitura acumulada
  // (tipo odometro), somar os valores de cada linha nao faz sentido.
  const totalLitrosAbastecidos = abastecimentos.reduce((s: number, a: any) => s + (a.litrosAbastecidos || 0), 0)
  const totalHorasTrabalhadas = abastecimentos.reduce((s: number, a: any) => s + (a.horasTrabalhadad || 0), 0)
  const totalCustoAbastecimento = abastecimentos.reduce((s: number, a: any) => s + (a.custoAbastecimento || 0), 0)
  const consumoMedioPonderado = totalHorasTrabalhadas > 0 ? totalLitrosAbastecidos / totalHorasTrabalhadas : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Histórico de Abastecimentos</h1>
        <p className="text-gray-600 mt-1">Consulte todos os abastecimentos já registrados</p>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filtros
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Data início</label>
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Data fim</label>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              min={filtroDataInicio || undefined}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Máquina</label>
            <select
              value={filtroMaquina}
              onChange={(e) => setFiltroMaquina(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todas as máquinas</option>
              {maquinas.map((m: any) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
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
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleAbrirEdicao(a)} className="p-1.5 hover:bg-blue-50 rounded text-blue-500 hover:text-blue-700 transition-colors" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteAbastecimento(a.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2"></td>
              <td className="px-4 py-2 text-gray-400" title="Horimetro e uma leitura acumulada, nao faz sentido somar os valores">-</td>
              <td className="px-4 py-2">{totalLitrosAbastecidos.toFixed(2)}L</td>
              <td className="px-4 py-2">{consumoMedioPonderado !== null ? consumoMedioPonderado.toFixed(2) : '-'}</td>
              <td className="px-4 py-2">R$ {totalCustoAbastecimento.toFixed(2)}</td>
              {isGestor && <td className="px-4 py-2"></td>}
            </tr>
          </tfoot>
        </table>
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

      {editando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Editar Abastecimento</h2>
              <button onClick={fecharModalEdicao} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {erroEdicao && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{erroEdicao}</div>
              )}

              {!cascata && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora</label>
                    <input
                      type="datetime-local"
                      value={form.data}
                      onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horímetro Anterior</label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.horimetroAnterior}
                      onChange={(e) => setForm((prev) => ({ ...prev, horimetroAnterior: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horímetro Atual</label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.horimetroAtual}
                      onChange={(e) => setForm((prev) => ({ ...prev, horimetroAtual: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Litros</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.litrosAbastecidos}
                      onChange={(e) => setForm((prev) => ({ ...prev, litrosAbastecidos: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500">Consumo L/h e Custo são recalculados automaticamente ao salvar.</p>
                </>
              )}

              {cascata && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm space-y-2">
                  <p>
                    Isso também vai atualizar o horímetro anterior do lançamento de{' '}
                    <strong>{new Date(cascata.proximoData).toLocaleDateString('pt-BR')}</strong> de{' '}
                    <strong>{cascata.horimetroAnteriorAntigo?.toFixed(1) ?? '-'}h</strong> para{' '}
                    <strong>{cascata.horimetroAnteriorNovo.toFixed(1)}h</strong>. Confirma?
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={fecharModalEdicao}
                disabled={salvando}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              {!cascata ? (
                <button
                  onClick={() => enviarEdicao(false)}
                  disabled={salvando}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              ) : (
                <button
                  onClick={() => enviarEdicao(true)}
                  disabled={salvando}
                  className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {salvando ? 'Confirmando...' : 'Confirmar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
