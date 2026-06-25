'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { BarChart3, Leaf, DollarSign, ClipboardList, TrendingUp, Filter } from 'lucide-react'

export default function RelatoriosPage() {
  const { data: session } = useSession()
  const [aba, setAba] = useState('consumo')
  const [registros, setRegistros] = useState<any[]>([])
  const [talhoes, setTalhoes] = useState<any[]>([])
  const [safras, setSafras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [filtros, setFiltros] = useState({
    safraId: '',
    talhaoId: '',
    dataInicio: '',
    dataFim: '',
    tipoAtividade: '',
  })

  useEffect(() => {
    loadDados()
  }, [])

  const loadDados = async () => {
    try {
      setLoading(true)
      const [regRes, talRes, safRes] = await Promise.all([
        fetch('/api/registros-atividade'),
        fetch('/api/talhoes'),
        fetch('/api/safras'),
      ])
      if (regRes.ok) setRegistros((await regRes.json()).data || [])
      if (talRes.ok) setTalhoes((await talRes.json()).data || [])
      if (safRes.ok) setSafras((await safRes.json()).data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const registrosFiltrados = registros.filter(r => {
    if (filtros.safraId && r.safraId !== filtros.safraId) return false
    if (filtros.talhaoId && r.talhaoId !== filtros.talhaoId) return false
    if (filtros.tipoAtividade && r.tipoAtividade !== filtros.tipoAtividade) return false
    if (filtros.dataInicio && new Date(r.data) < new Date(filtros.dataInicio)) return false
    if (filtros.dataFim && new Date(r.data) > new Date(filtros.dataFim)) return false
    return true
  })

  const tiposAtividade = [
    { value: 'PULVERIZACAO', label: 'Pulverização' },
    { value: 'HERBICIDA', label: 'Herbicida' },
    { value: 'ADUBACAO', label: 'Adubação' },
    { value: 'COLHEITA', label: 'Colheita' },
    { value: 'CAPINA_MECANICA', label: 'Capina Mecânica' },
    { value: 'DESBROTA', label: 'Desbrota' },
    { value: 'CAPINA_MANUAL', label: 'Capina Manual' },
    { value: 'CHEGAMENTO_TERRA', label: 'Chegamento de Terra' },
    { value: 'CORRECAO_SOLO', label: 'Correção de Solo' },
    { value: 'IRRIGACAO', label: 'Irrigação' },
    { value: 'INSETICIDA_SOLO', label: 'Inseticida de Solo' },
    { value: 'GERAIS', label: 'Gerais' },
  ]

  const agruparPor = (campo: string) => {
    const grupos: Record<string, any[]> = {}
    registrosFiltrados.forEach(r => {
      const chave = r[campo] || 'Não informado'
      if (!grupos[chave]) grupos[chave] = []
      grupos[chave].push(r)
    })
    return grupos
  }

  const calcularHoras = (regs: any[]) =>
    regs.reduce((acc, r) => acc + (r.horasCalculadas || 0), 0).toFixed(1)

  const calcularBombas = (regs: any[]) =>
    regs.reduce((acc, r) => acc + (r.totalBombas || 0), 0)

  const calcularHorasMaquina = (regs: any[]) =>
    regs.reduce((acc, r) => acc + (r.horasMaquina || 0), 0).toFixed(1)

  const getTalhaoNome = (id: string) => talhoes.find(t => t.id === id)?.nome || id
  const getSafraNome = (id: string) => safras.find(s => s.id === id)?.nome || id
  const getTipoLabel = (tipo: string) => tiposAtividade.find(t => t.value === tipo)?.label || tipo

  const abas = [
    { id: 'consumo', label: 'Consumo de Produtos', icon: Leaf },
    { id: 'historico', label: 'Histórico de Aplicações', icon: ClipboardList },
    { id: 'agronomico', label: 'Relatório Agronômico', icon: BarChart3 },
    { id: 'operacional', label: 'Indicadores Operacionais', icon: TrendingUp },
    { id: 'custos', label: 'Custos', icon: DollarSign },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Relatórios</h1>
        <p className="text-gray-600 mt-1">Análises e indicadores da fazenda</p>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-primary">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="form-group">
            <label>Safra</label>
            <select value={filtros.safraId} onChange={e => setFiltros(p => ({ ...p, safraId: e.target.value }))}>
              <option value="">Todas</option>
              {safras.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Talhão</label>
            <select value={filtros.talhaoId} onChange={e => setFiltros(p => ({ ...p, talhaoId: e.target.value }))}>
              <option value="">Todos</option>
              {talhoes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Tipo de Atividade</label>
            <select value={filtros.tipoAtividade} onChange={e => setFiltros(p => ({ ...p, tipoAtividade: e.target.value }))}>
              <option value="">Todos</option>
              {tiposAtividade.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Data Início</label>
            <input type="date" value={filtros.dataInicio} onChange={e => setFiltros(p => ({ ...p, dataInicio: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Data Fim</label>
            <input type="date" value={filtros.dataFim} onChange={e => setFiltros(p => ({ ...p, dataFim: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <p className="text-sm text-gray-500">{registrosFiltrados.length} registros encontrados</p>
          <button onClick={() => setFiltros({ safraId: '', talhaoId: '', dataInicio: '', dataFim: '', tipoAtividade: '' })} className="btn btn-outline btn-sm">
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 flex-wrap">
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              aba === a.id ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <a.icon className="w-4 h-4" />
            {a.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12 text-gray-500">Carregando dados...</div>
      ) : registrosFiltrados.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">Nenhum registro encontrado com os filtros selecionados.</div>
      ) : (
        <>
          {/* Consumo de Produtos */}
          {aba === 'consumo' && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">Consumo por Talhão</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Talhão</th>
                      <th className="text-left py-2 px-3 text-gray-600">Atividades</th>
                      <th className="text-left py-2 px-3 text-gray-600">Total Bombas</th>
                      <th className="text-left py-2 px-3 text-gray-600">Qtd Adubo (kg)</th>
                      <th className="text-left py-2 px-3 text-gray-600">Qtd Corretivo (ton)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agruparPor('talhaoId')).map(([talhaoId, regs]) => (
                      <tr key={talhaoId} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{getTalhaoNome(talhaoId)}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularBombas(regs)}</td>
                        <td className="py-2 px-3">{regs.reduce((a, r) => a + (r.quantidadeAdubo || 0), 0).toFixed(2)}</td>
                        <td className="py-2 px-3">{regs.reduce((a, r) => a + (r.quantidadeCorretivo || 0), 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">Consumo por Atividade</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Tipo de Atividade</th>
                      <th className="text-left py-2 px-3 text-gray-600">Registros</th>
                      <th className="text-left py-2 px-3 text-gray-600">Total Bombas</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agruparPor('tipoAtividade')).map(([tipo, regs]) => (
                      <tr key={tipo} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{getTipoLabel(tipo)}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularBombas(regs)}</td>
                        <td className="py-2 px-3">{calcularHoras(regs)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Histórico de Aplicações */}
          {aba === 'historico' && (
            <div className="card">
              <h3 className="text-lg font-semibold text-primary mb-4">Histórico de Aplicações</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Data</th>
                      <th className="text-left py-2 px-3 text-gray-600">Talhão</th>
                      <th className="text-left py-2 px-3 text-gray-600">Safra</th>
                      <th className="text-left py-2 px-3 text-gray-600">Atividade</th>
                      <th className="text-left py-2 px-3 text-gray-600">Responsável</th>
                      <th className="text-left py-2 px-3 text-gray-600">Bombas</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                      <th className="text-left py-2 px-3 text-gray-600">Implemento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrosFiltrados.map(r => (
                      <tr key={r.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3">{new Date(r.data).toLocaleDateString('pt-BR')}</td>
                        <td className="py-2 px-3">{r.talhao?.nome || '-'}</td>
                        <td className="py-2 px-3">{r.safra?.nome || '-'}</td>
                        <td className="py-2 px-3">{getTipoLabel(r.tipoAtividade)}</td>
                        <td className="py-2 px-3">{r.funcionario?.name || '-'}</td>
                        <td className="py-2 px-3">{r.totalBombas || '-'}</td>
                        <td className="py-2 px-3">{r.horasCalculadas ? `${r.horasCalculadas.toFixed(1)}h` : '-'}</td>
                        <td className="py-2 px-3">{r.implementoUtilizado || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Relatório Agronômico por Talhão */}
          {aba === 'agronomico' && (
            <div className="space-y-4">
              {Object.entries(agruparPor('talhaoId')).map(([talhaoId, regs]) => (
                <div key={talhaoId} className="card">
                  <h3 className="text-lg font-semibold text-primary mb-4">
                    Talhão: {getTalhaoNome(talhaoId)}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{regs.length}</p>
                      <p className="text-sm text-gray-600">Aplicações</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{calcularBombas(regs)}</p>
                      <p className="text-sm text-gray-600">Total Bombas</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{calcularHoras(regs)}h</p>
                      <p className="text-sm text-gray-600">Horas Homem</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{calcularHorasMaquina(regs)}h</p>
                      <p className="text-sm text-gray-600">Horas Máquina</p>
                    </div>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-gray-600">Data</th>
                        <th className="text-left py-2 px-3 text-gray-600">Atividade</th>
                        <th className="text-left py-2 px-3 text-gray-600">Bombas</th>
                        <th className="text-left py-2 px-3 text-gray-600">Adubo</th>
                        <th className="text-left py-2 px-3 text-gray-600">Operador</th>
                        <th className="text-left py-2 px-3 text-gray-600">Máquina</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regs.sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime()).map((r: any) => (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3">{new Date(r.data).toLocaleDateString('pt-BR')}</td>
                          <td className="py-2 px-3">{getTipoLabel(r.tipoAtividade)}</td>
                          <td className="py-2 px-3">{r.totalBombas || '-'}</td>
                          <td className="py-2 px-3">{r.quantidadeAdubo ? `${r.quantidadeAdubo}kg` : '-'}</td>
                          <td className="py-2 px-3">{r.funcionario?.name || '-'}</td>
                          <td className="py-2 px-3">{r.maquina?.nome || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Indicadores Operacionais */}
          {aba === 'operacional' && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">Desempenho por Operador</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Operador</th>
                      <th className="text-left py-2 px-3 text-gray-600">Atividades</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                      <th className="text-left py-2 px-3 text-gray-600">Média h/atividade</th>
                      <th className="text-left py-2 px-3 text-gray-600">Faltas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      registrosFiltrados.reduce((acc: any, r) => {
                        const nome = r.funcionario?.name || 'Desconhecido'
                        if (!acc[nome]) acc[nome] = []
                        acc[nome].push(r)
                        return acc
                      }, {})
                    ).map(([nome, regs]: any) => (
                      <tr key={nome} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{nome}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularHoras(regs)}h</td>
                        <td className="py-2 px-3">
                          {regs.length > 0 ? (parseFloat(calcularHoras(regs)) / regs.length).toFixed(1) : 0}h
                        </td>
                        <td className="py-2 px-3">{regs.filter((r: any) => r.isFalta).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">Desempenho por Equipamento</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Máquina</th>
                      <th className="text-left py-2 px-3 text-gray-600">Usos</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                      <th className="text-left py-2 px-3 text-gray-600">Implemento mais usado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      registrosFiltrados
                        .filter((r: any) => r.maquinaId)
                        .reduce((acc: any, r: any) => {
                          const nome = r.maquina?.nome || r.maquinaId
                          if (!acc[nome]) acc[nome] = []
                          acc[nome].push(r)
                          return acc
                        }, {})
                    ).map(([nome, regs]: any) => {
                      const implementos = regs.map((r: any) => r.implementoUtilizado).filter(Boolean)
                      const maisUsado = implementos.length > 0
                        ? implementos.sort((a: string, b: string) =>
                            implementos.filter((v: string) => v === b).length - implementos.filter((v: string) => v === a).length
                          )[0]
                        : '-'
                      return (
                        <tr key={nome} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium">{nome}</td>
                          <td className="py-2 px-3">{regs.length}</td>
                          <td className="py-2 px-3">{calcularHorasMaquina(regs)}h</td>
                          <td className="py-2 px-3">{maisUsado}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Custos */}
          {aba === 'custos' && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-2">Custos por Talhão</h3>
                <p className="text-sm text-gray-500 mb-4">
                  * Para custos detalhados por produto, cadastre os preços nos Produtos e vincule Receitas de Aplicação às atividades.
                </p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Talhão</th>
                      <th className="text-left py-2 px-3 text-gray-600">Atividades</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Máquina</th>
                      <th className="text-left py-2 px-3 text-gray-600">Total Bombas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agruparPor('talhaoId')).map(([talhaoId, regs]) => (
                      <tr key={talhaoId} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{getTalhaoNome(talhaoId)}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularHoras(regs)}h</td>
                        <td className="py-2 px-3">{calcularHorasMaquina(regs)}h</td>
                        <td className="py-2 px-3">{calcularBombas(regs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">Resumo por Safra</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Safra</th>
                      <th className="text-left py-2 px-3 text-gray-600">Total Atividades</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Máquina</th>
                      <th className="text-left py-2 px-3 text-gray-600">Total Bombas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agruparPor('safraId')).map(([safraId, regs]) => (
                      <tr key={safraId} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{getSafraNome(safraId)}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularHoras(regs)}h</td>
                        <td className="py-2 px-3">{calcularHorasMaquina(regs)}h</td>
                        <td className="py-2 px-3">{calcularBombas(regs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
