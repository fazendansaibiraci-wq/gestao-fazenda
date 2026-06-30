'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

interface RegistroAtividadeFormProps {
  id?: string
  initialData?: any
}

export function RegistroAtividadeForm({ id, initialData }: RegistroAtividadeFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [safras, setSafras] = useState([])
  const [talhoes, setTalhoes] = useState([])
  const [maquinas, setMaquinas] = useState([])
  const [implementos, setImplementos] = useState([])
  const [receitas, setReceitas] = useState([])
  const [funcionarios, setFuncionarios] = useState([])
  const [estaNaSafra, setEstaNaSafra] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [produtos, setProdutos] = useState([])
  const [tiposAtividade, setTiposAtividade] = useState<{id: number, nome: string}[]>([])
  const userRole = (session?.user as any)?.role || ''
  const isGestor = ['GESTOR', 'GERENTE'].includes(userRole)

  const [form, setForm] = useState({
    data: initialData?.data?.split('T')[0] || new Date().toISOString().split('T')[0],
    horaEntrada: initialData?.horaEntrada || '',
    horaSaida: initialData?.horaSaida || '',
    talhaoId: initialData?.talhaoId || '',
    safraId: initialData?.safraId || '',
    tipoAtividade: initialData?.tipoAtividade || 'GERAIS',
    receitaAplicacaoId: initialData?.receitaAplicacaoId || '',
    status: initialData?.status || 'CONCLUIDO',
    totalBombas: initialData?.totalBombas || '',
    tipoAdubo: initialData?.tipoAdubo || '',
    quantidadeAdubo: initialData?.quantidadeAdubo || '',
    tipoCorretivo: initialData?.tipoCorretivo || '',
    quantidadeCorretivo: initialData?.quantidadeCorretivo || '',
    maquinaId: initialData?.maquinaId || '',
    horimetroInicial: initialData?.horimetroInicial || '',
    horimetroFinal: initialData?.horimetroFinal || '',
    implementoUtilizado: initialData?.implementoUtilizado || '',
    isFalta: initialData?.isFalta || false,
    motivoFalta: initialData?.motivoFalta || '',
    periodoFalta: initialData?.periodoFalta || 'DIA_INTEIRO',
    passouDiretoAlmoco: initialData?.passouDiretoAlmoco || false,
    observacao: initialData?.observacao || '',
    fotoEvidencia: initialData?.fotoEvidencia || '',
    funcionarioId: initialData?.funcionarioId || '',
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (config?.inicioSafra && config?.fimSafra && form.data) {
      const dataRegistro = new Date(form.data)
      const inicio = new Date(config.inicioSafra)
      const fim = new Date(config.fimSafra)
      setEstaNaSafra(dataRegistro >= inicio && dataRegistro <= fim)
    } else {
      setEstaNaSafra(false)
    }
  }, [form.data, config])

  const loadData = async () => {
    try {
     const [safrasRes, talhaoesRes, maquinasRes, receitasRes, implementosRes, funcionariosRes, configRes, tiposRes, produtosRes] = await Promise.all([
        fetch('/api/safras'),
        fetch('/api/talhoes'),
        fetch('/api/maquinas'),
        fetch('/api/receitas'),
        fetch('/api/implementos'),
        fetch('/api/funcionarios'),
        fetch('/api/configuracoes'),
        fetch('/api/tipos-atividade?ativo=true'),
        fetch('/api/produtos'),
      ])
      if (safrasRes.ok) setSafras((await safrasRes.json()).data)
      if (talhaoesRes.ok) setTalhoes((await talhaoesRes.json()).data)
      if (maquinasRes.ok) setMaquinas((await maquinasRes.json()).data)
      if (receitasRes.ok) setReceitas((await receitasRes.json()).data)
      if (implementosRes.ok) setImplementos((await implementosRes.json()).data)
      if (funcionariosRes.ok) setFuncionarios((await funcionariosRes.json()).data)
      if (configRes.ok) setConfig((await configRes.json()).data)
      if (tiposRes.ok) setTiposAtividade(await tiposRes.json())
      if (produtosRes.ok) setProdutos((await produtosRes.json()).data)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const validateHorimetro = () => {
    if (form.maquinaId && form.horimetroInicial && form.horimetroFinal) {
      const inicial = parseFloat(form.horimetroInicial)
      const final = parseFloat(form.horimetroFinal)
      if (final <= inicial) {
        setError('Horímetro final deve ser maior que inicial')
        return false
      }
    }
    return true
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (!validateHorimetro()) return
    setLoading(true)
    try {
      if (!form.isFalta) {
        if (!form.data || !form.horaEntrada || !form.talhaoId || !form.safraId) {
          setError('Preencha todos os campos obrigatórios')
          setLoading(false)
          return
        }
      }
      if (isGestor && !form.funcionarioId) {
        setError('Selecione o funcionário para esta atividade')
        setLoading(false)
        return
      }
      const horimetroInicial = form.horimetroInicial ? parseFloat(form.horimetroInicial) : null
      const horimetroFinal = form.horimetroFinal ? parseFloat(form.horimetroFinal) : null
      const horasMaquina = horimetroInicial && horimetroFinal
        ? parseFloat((horimetroFinal - horimetroInicial).toFixed(2))
        : null
      const method = id ? 'PUT' : 'POST'
      const url = id ? `/api/registros-atividade/${id}` : '/api/registros-atividade'
      const payload = form.isFalta ? {
        data: new Date(form.data + 'T12:00:00'),
        funcionarioId: form.funcionarioId,
        isFalta: true,
        motivoFalta: form.motivoFalta,
        periodoFalta: form.periodoFalta,
        observacao: form.observacao,
        talhaoId: form.talhaoId || (talhoes[0] as any)?.id,
        safraId: form.safraId || (safras[0] as any)?.id,
        tipoAtividade: 'GERAIS',
        status: 'CONCLUIDO',
        horaEntrada: '00:00',
      } : {
        ...form,
        data: new Date(form.data + 'T12:00:00'),
        totalBombas: form.totalBombas ? parseInt(form.totalBombas) : null,
        quantidadeAdubo: form.quantidadeAdubo ? parseFloat(form.quantidadeAdubo) : null,
        quantidadeCorretivo: form.quantidadeCorretivo ? parseFloat(form.quantidadeCorretivo) : null,
        horimetroInicial,
        horimetroFinal,
        horasMaquina,
        passouDiretoAlmoco: estaNaSafra ? form.passouDiretoAlmoco : false,
      }
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao salvar registro')
      }
      router.push('/modules/atividades')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  const needsProduto = ['Pulverização', 'Herbicida', 'Inseticida de Solo']
  const needsAdubo = form.tipoAtividade === 'Adubação'
  const needsCorretivo = form.tipoAtividade === 'Correção de Solo'

  const receitaSelecionada = (receitas as any[]).find((r: any) => r.id === form.receitaAplicacaoId)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {isGestor && (
        <div className="card border-l-4 border-primary">
          <h3 className="text-lg font-semibold text-primary mb-4">Funcionário *</h3>
          <div className="form-group">
            <label htmlFor="funcionarioId">Selecione o funcionário desta atividade</label>
            <select
              id="funcionarioId"
              name="funcionarioId"
              value={form.funcionarioId}
              onChange={handleChange}
              required
              disabled={loading}
            >
              <option value="">Selecionar funcionário</option>
              {funcionarios.map((f: any) => (
                <option key={f.id} value={f.id}>{f.name} — {f.role}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Data *</h3>
        <div className="form-group">
          <input type="date" id="data" name="data" value={form.data} onChange={handleChange} required disabled={loading} />
        </div>
      </div>

      <div className="card border-l-4 border-orange-400">
        <h3 className="text-lg font-semibold text-primary mb-4">Registrar Falta?</h3>
        <label className="flex items-start gap-3 cursor-pointer mb-4">
          <input type="checkbox" name="isFalta" checked={form.isFalta} onChange={handleChange} disabled={loading} className="mt-0.5 flex-shrink-0" />
          <span className="text-sm font-medium">Marcar como falta</span>
        </label>
        {form.isFalta && (
          <div className="space-y-4">
            <div className="form-group">
              <label htmlFor="periodoFalta">Período da Falta</label>
              <select id="periodoFalta" name="periodoFalta" value={form.periodoFalta} onChange={handleChange} disabled={loading}>
                <option value="DIA_INTEIRO">Dia Inteiro</option>
                <option value="MANHA">Manhã</option>
                <option value="TARDE">Tarde</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="motivoFalta">Motivo da Falta</label>
              <select id="motivoFalta" name="motivoFalta" value={form.motivoFalta} onChange={handleChange} disabled={loading}>
                <option value="">Selecionar motivo</option>
                <option value="atestado_medico">Atestado Médico</option>
                <option value="pessoal">Pessoal</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="observacao">Observação</label>
              <textarea id="observacao" name="observacao" value={form.observacao} onChange={handleChange} disabled={loading} placeholder="Detalhes adicionais sobre a falta..." rows={3} />
            </div>
            <div className="flex gap-4 pt-2">
              <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                {loading ? 'Salvando...' : 'Registrar Falta'}
              </button>
              <button type="button" onClick={() => router.back()} disabled={loading} className="btn btn-outline flex-1">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {!form.isFalta && (
        <>
          <div className="card">
            <h3 className="text-lg font-semibold text-primary mb-4">Informações Básicas</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="talhaoId">Talhão *</label>
                  <select id="talhaoId" name="talhaoId" value={form.talhaoId} onChange={handleChange} required disabled={loading}>
                    <option value="">Selecionar talhão</option>
                    {talhoes.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.nome} ({t.area} ha)</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="safraId">Safra *</label>
                  <select id="safraId" name="safraId" value={form.safraId} onChange={handleChange} required disabled={loading}>
                    <option value="">Selecionar safra</option>
                    {safras.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="tipoAtividade">Tipo de Atividade *</label>
                <select id="tipoAtividade" name="tipoAtividade" value={form.tipoAtividade} onChange={handleChange} disabled={loading}>
                  <option value="">Selecionar tipo</option>
                  {tiposAtividade.map((t) => (
                    <option key={t.id} value={t.nome}>{t.nome}</option>
                  ))}
                </select>
              </div>

            {receitas.length > 0 && !needsAdubo && !needsCorretivo && (
                <div className="form-group">
                  <label htmlFor="receitaAplicacaoId">Receita de Aplicação</label>
                  <select id="receitaAplicacaoId" name="receitaAplicacaoId" value={form.receitaAplicacaoId} onChange={handleChange} disabled={loading}>
                    <option value="">Selecionar receita (opcional)</option>
                    {receitas.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.nome} - {r.tipo.replace(/_/g, ' ')}</option>
                    ))}
                  </select>

                  {receitaSelecionada?.produtosAplicacao?.length > 0 && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-semibold text-green-800 mb-2">Produtos desta receita:</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-green-200">
                            <th className="text-left py-1 text-green-700">Produto</th>
                            <th className="text-left py-1 text-green-700">Dosagem</th>
                            <th className="text-left py-1 text-green-700">Unidade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receitaSelecionada.produtosAplicacao.map((p: any) => (
                            <tr key={p.id} className="border-b border-green-100">
                              <td className="py-1 font-medium text-gray-800">{p.produto?.nomeComercial}</td>
                              <td className="py-1 text-gray-700">{p.dosagem}</td>
                              <td className="py-1 text-gray-700">{p.unidade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-group">
                  <label htmlFor="horaEntrada">Hora Entrada *</label>
                  <input type="time" id="horaEntrada" name="horaEntrada" value={form.horaEntrada} onChange={handleChange} required disabled={loading} />
                </div>
                <div className="form-group">
                  <label htmlFor="horaSaida">Hora Saída</label>
                  <input type="time" id="horaSaida" name="horaSaida" value={form.horaSaida} onChange={handleChange} disabled={loading} />
                </div>
                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select id="status" name="status" value={form.status} onChange={handleChange} disabled={loading}>
                    <option value="EM_ANDAMENTO">Em Andamento</option>
                    <option value="CONCLUIDO">Concluído</option>
                  </select>
                </div>
              </div>

              {estaNaSafra && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                 <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" name="passouDiretoAlmoco" checked={form.passouDiretoAlmoco} onChange={handleChange} disabled={loading} className="mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium text-amber-800">
                      Passou direto no almoço (1h conta como hora extra)
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {needsProduto.includes(form.tipoAtividade as any) && (
            <div className="card">
              <h3 className="text-lg font-semibold text-primary mb-4">Aplicação de Produto</h3>
              <div className="form-group">
                <label htmlFor="totalBombas">Total de Bombas</label>
                <input type="number" id="totalBombas" name="totalBombas" value={form.totalBombas} onChange={handleChange} disabled={loading} placeholder="0" />
              </div>
            </div>
          )}

         {needsAdubo && (
            <div className="card">
              <h3 className="text-lg font-semibold text-primary mb-4">Adubação</h3>
              <div className="space-y-4">
                <div className="form-group">
                  <label htmlFor="tipoAdubo">Tipo de Adubo</label>
                  <select id="tipoAdubo" name="tipoAdubo" value={form.tipoAdubo} onChange={handleChange} disabled={loading}>
                    <option value="">Selecionar adubo</option>
                    {(produtos as any[])
                      .filter((p: any) => p.categoria === 'Fertilizante' || p.categoria === 'Adubo')
                      .map((p: any) => (
                        <option key={p.id} value={p.nomeComercial}>{p.nomeComercial} ({p.unidadeMedida})</option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="quantidadeAdubo">
                    Quantidade {form.tipoAdubo ? `(${(produtos as any[]).find((p: any) => p.nomeComercial === form.tipoAdubo)?.unidadeMedida || ''})` : ''}
                  </label>
                  <input type="number" id="quantidadeAdubo" name="quantidadeAdubo" value={form.quantidadeAdubo} onChange={handleChange} disabled={loading} step="0.001" placeholder="0" />
                </div>
              </div>
            </div>
          )}

          {needsCorretivo && (
            <div className="card">
              <h3 className="text-lg font-semibold text-primary mb-4">Correção de Solo</h3>
              <div className="space-y-4">
                <div className="form-group">
                  <label htmlFor="tipoCorretivo">Tipo de Corretivo</label>
                  <select id="tipoCorretivo" name="tipoCorretivo" value={form.tipoCorretivo} onChange={handleChange} disabled={loading}>
                    <option value="">Selecionar corretivo</option>
                    {(produtos as any[])
                      .filter((p: any) => p.categoria === 'Corretivo')
                      .map((p: any) => (
                        <option key={p.id} value={p.nomeComercial}>{p.nomeComercial} ({p.unidadeMedida})</option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="quantidadeCorretivo">
                    Quantidade {form.tipoCorretivo ? `(${(produtos as any[]).find((p: any) => p.nomeComercial === form.tipoCorretivo)?.unidadeMedida || ''})` : ''}
                  </label>
                  <input type="number" id="quantidadeCorretivo" name="quantidadeCorretivo" value={form.quantidadeCorretivo} onChange={handleChange} disabled={loading} step="0.001" placeholder="0" />
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-lg font-semibold text-primary mb-4">Máquina e Implemento (Opcional)</h3>
            <div className="space-y-4">
              <div className="form-group">
                <label htmlFor="maquinaId">Máquina Utilizada</label>
                <select id="maquinaId" name="maquinaId" value={form.maquinaId} onChange={handleChange} disabled={loading}>
                  <option value="">Sem máquina</option>
                  {maquinas.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.nome} ({m.tipo})</option>
                  ))}
                </select>
              </div>
              {form.maquinaId && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label htmlFor="horimetroInicial">Horímetro Inicial (h)</label>
                    <input type="number" id="horimetroInicial" name="horimetroInicial" value={form.horimetroInicial} onChange={handleChange} disabled={loading} step="0.1" placeholder="0,0" required={!!form.maquinaId} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="horimetroFinal">Horímetro Final (h)</label>
                    <input type="number" id="horimetroFinal" name="horimetroFinal" value={form.horimetroFinal} onChange={handleChange} disabled={loading} step="0.1" placeholder="0,0" required={!!form.maquinaId} />
                  </div>
                </div>
              )}
              <div className="form-group">
                <label htmlFor="implementoUtilizado">Implemento Utilizado</label>
                <select id="implementoUtilizado" name="implementoUtilizado" value={form.implementoUtilizado} onChange={handleChange} disabled={loading}>
                  <option value="">Sem implemento</option>
                  {implementos.map((imp: any) => (
                    <option key={imp.id} value={imp.nome}>{imp.nome}{imp.tipo ? ` (${imp.tipo})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-primary mb-4">Observações</h3>
            <div className="form-group">
              <label htmlFor="observacao">Observações Adicionais</label>
              <textarea id="observacao" name="observacao" value={form.observacao} onChange={handleChange} disabled={loading} placeholder="Descreva detalhes da atividade realizada..." rows={4} />
            </div>
          </div>

          <div className="flex gap-4">
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Salvando...' : id ? 'Atualizar' : 'Registrar Atividade'}
            </button>
            <button type="button" onClick={() => router.back()} disabled={loading} className="btn btn-outline flex-1">
              Cancelar
            </button>
          </div>
        </>
      )}
    </form>
  )
}
