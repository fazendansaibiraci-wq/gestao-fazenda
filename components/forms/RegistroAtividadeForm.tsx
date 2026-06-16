'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TipoAtividade } from '@prisma/client'

interface RegistroAtividadeFormProps {
  id?: string
  initialData?: any
}

export function RegistroAtividadeForm({ id, initialData }: RegistroAtividadeFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [safras, setSafras] = useState([])
  const [talhoes, setTalhoes] = useState([])
  const [maquinas, setMaquinas] = useState([])
  const [produtos, setProdutos] = useState([])

  const [form, setForm] = useState({
    data: initialData?.data?.split('T')[0] || new Date().toISOString().split('T')[0],
    horaEntrada: initialData?.horaEntrada || '',
    horaSaida: initialData?.horaSaida || '',
    talhaoId: initialData?.talhaoId || '',
    safraId: initialData?.safraId || '',
    tipoAtividade: initialData?.tipoAtividade || TipoAtividade.GERAIS,
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
    observacao: initialData?.observacao || '',
    fotoEvidencia: initialData?.fotoEvidencia || '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [safrasRes, talhaoesRes, maquinasRes, produtosRes] = await Promise.all([
        fetch('/api/safras'),
        fetch('/api/talhoes'),
        fetch('/api/maquinas'),
        fetch('/api/produtos'),
      ])

      if (safrasRes.ok) setSafras((await safrasRes.json()).data)
      if (talhaoesRes.ok) setTalhoes((await talhaoesRes.json()).data)
      if (maquinasRes.ok) setMaquinas((await maquinasRes.json()).data)
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
      const diferenca = final - inicial

      if (final <= inicial) {
        setError('Horímetro final deve ser maior que inicial')
        return false
      }

      if (diferenca > 24) {
        setError(`Alerta: Diferença de ${diferenca.toFixed(1)}h é maior que 24h`)
        // Não bloqueia, apenas aviso
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
      if (!form.data || !form.horaEntrada || !form.talhaoId || !form.safraId) {
        setError('Preencha todos os campos obrigatórios')
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

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          data: new Date(form.data),
          totalBombas: form.totalBombas ? parseInt(form.totalBombas) : null,
          quantidadeAdubo: form.quantidadeAdubo ? parseFloat(form.quantidadeAdubo) : null,
          quantidadeCorretivo: form.quantidadeCorretivo ? parseFloat(form.quantidadeCorretivo) : null,
          horimetroInicial,
          horimetroFinal,
          horasMaquina,
        }),
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

  const tiposAtividade = [
    { value: TipoAtividade.PULVERIZACAO, label: 'Pulverização' },
    { value: TipoAtividade.HERBICIDA, label: 'Herbicida' },
    { value: TipoAtividade.ADUBACAO, label: 'Adubação' },
    { value: TipoAtividade.COLHEITA, label: 'Colheita' },
    { value: TipoAtividade.CAPINA_MECANICA, label: 'Capina Mecânica' },
    { value: TipoAtividade.DESBROTA, label: 'Desbrota' },
    { value: TipoAtividade.CAPINA_MANUAL, label: 'Capina Manual' },
    { value: TipoAtividade.CHEGAMENTO_TERRA, label: 'Chegamento de Terra' },
    { value: TipoAtividade.CORRECAO_SOLO, label: 'Correção de Solo' },
    { value: TipoAtividade.IRRIGACAO, label: 'Irrigação' },
    { value: TipoAtividade.INSETICIDA_SOLO, label: 'Inseticida de Solo' },
    { value: TipoAtividade.GERAIS, label: 'Gerais' },
  ]

  const needsProduto = [TipoAtividade.PULVERIZACAO, TipoAtividade.HERBICIDA, TipoAtividade.INSETICIDA_SOLO]
  const needsAdubo = form.tipoAtividade === TipoAtividade.ADUBACAO
  const needsCorretivo = form.tipoAtividade === TipoAtividade.CORRECAO_SOLO

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Informações Básicas */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Informações Básicas</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="data">Data *</label>
              <input
                type="date"
                id="data"
                name="data"
                value={form.data}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="talhaoId">Talhão *</label>
              <select
                id="talhaoId"
                name="talhaoId"
                value={form.talhaoId}
                onChange={handleChange}
                required
                disabled={loading}
              >
                <option value="">Selecionar talhão</option>
                {talhoes.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({t.area} ha)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="safraId">Safra *</label>
              <select
                id="safraId"
                name="safraId"
                value={form.safraId}
                onChange={handleChange}
                required
                disabled={loading}
              >
                <option value="">Selecionar safra</option>
                {safras.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="tipoAtividade">Tipo de Atividade *</label>
              <select
                id="tipoAtividade"
                name="tipoAtividade"
                value={form.tipoAtividade}
                onChange={handleChange}
                disabled={loading}
              >
                {tiposAtividade.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label htmlFor="horaEntrada">Hora Entrada *</label>
              <input
                type="time"
                id="horaEntrada"
                name="horaEntrada"
                value={form.horaEntrada}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="horaSaida">Hora Saída</label>
              <input
                type="time"
                id="horaSaida"
                name="horaSaida"
                value={form.horaSaida}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="CONCLUIDO">Concluído</option>
                <option value="PENDENTE">Pendente</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Campos Condicionais por Tipo de Atividade */}
      {needsProduto.includes(form.tipoAtividade as any) && (
        <div className="card">
          <h3 className="text-lg font-semibold text-primary mb-4">Aplicação de Produto</h3>
          <div className="form-group">
            <label htmlFor="totalBombas">Total de Bombas *</label>
            <input
              type="number"
              id="totalBombas"
              name="totalBombas"
              value={form.totalBombas}
              onChange={handleChange}
              disabled={loading}
              placeholder="0"
            />
          </div>
        </div>
      )}

      {needsAdubo && (
        <div className="card">
          <h3 className="text-lg font-semibold text-primary mb-4">Adubação</h3>
          <div className="space-y-4">
            <div className="form-group">
              <label htmlFor="tipoAdubo">Tipo de Adubo</label>
              <input
                type="text"
                id="tipoAdubo"
                name="tipoAdubo"
                value={form.tipoAdubo}
                onChange={handleChange}
                disabled={loading}
                placeholder="Ex: NPK 10-10-10"
              />
            </div>
            <div className="form-group">
              <label htmlFor="quantidadeAdubo">Quantidade (ton/kg)</label>
              <input
                type="number"
                id="quantidadeAdubo"
                name="quantidadeAdubo"
                value={form.quantidadeAdubo}
                onChange={handleChange}
                disabled={loading}
                step="0.01"
                placeholder="0,00"
              />
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
              <input
                type="text"
                id="tipoCorretivo"
                name="tipoCorretivo"
                value={form.tipoCorretivo}
                onChange={handleChange}
                disabled={loading}
                placeholder="Ex: Calcário"
              />
            </div>
            <div className="form-group">
              <label htmlFor="quantidadeCorretivo">Quantidade (ton)</label>
              <input
                type="number"
                id="quantidadeCorretivo"
                name="quantidadeCorretivo"
                value={form.quantidadeCorretivo}
                onChange={handleChange}
                disabled={loading}
                step="0.01"
                placeholder="0,00"
              />
            </div>
          </div>
        </div>
      )}

      {/* Máquina */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Máquina (Opcional)</h3>
        <div className="space-y-4">
          <div className="form-group">
            <label htmlFor="maquinaId">Máquina Utilizada</label>
            <select
              id="maquinaId"
              name="maquinaId"
              value={form.maquinaId}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">Sem máquina</option>
              {maquinas.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.nome} ({m.tipo})
                </option>
              ))}
            </select>
          </div>

          {form.maquinaId && (
            <div className="space-y-4">
              <div className="alert alert-info">
                <p>Se selecionou máquina, horímetro inicial e final são obrigatórios</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="horimetroInicial">Horímetro Inicial (h)</label>
                  <input
                    type="number"
                    id="horimetroInicial"
                    name="horimetroInicial"
                    value={form.horimetroInicial}
                    onChange={handleChange}
                    disabled={loading}
                    step="0.1"
                    placeholder="0,0"
                    required={!!form.maquinaId}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="horimetroFinal">Horímetro Final (h)</label>
                  <input
                    type="number"
                    id="horimetroFinal"
                    name="horimetroFinal"
                    value={form.horimetroFinal}
                    onChange={handleChange}
                    disabled={loading}
                    step="0.1"
                    placeholder="0,0"
                    required={!!form.maquinaId}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="implementoUtilizado">Implemento Utilizado</label>
                <input
                  type="text"
                  id="implementoUtilizado"
                  name="implementoUtilizado"
                  value={form.implementoUtilizado}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Ex: Arado"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Falta */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Falta</h3>
        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input
            type="checkbox"
            name="isFalta"
            checked={form.isFalta}
            onChange={handleChange}
            disabled={loading}
          />
          <span className="text-sm font-medium">Registrar como falta</span>
        </label>

        {form.isFalta && (
          <div className="space-y-4">
            <div className="form-group">
              <label htmlFor="motivoFalta">Motivo da Falta</label>
              <select
                id="motivoFalta"
                name="motivoFalta"
                value={form.motivoFalta}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Selecionar motivo</option>
                <option value="atestado_medico">Atestado Médico</option>
                <option value="pessoal">Pessoal</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Observações */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Observações</h3>
        <div className="form-group">
          <label htmlFor="observacao">Observações Adicionais</label>
          <textarea
            id="observacao"
            name="observacao"
            value={form.observacao}
            onChange={handleChange}
            disabled={loading}
            placeholder="Descreva detalhes da atividade realizada..."
            rows={4}
          />
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary flex-1"
        >
          {loading ? 'Salvando...' : id ? 'Atualizar' : 'Registrar Atividade'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading}
          className="btn btn-outline flex-1"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
