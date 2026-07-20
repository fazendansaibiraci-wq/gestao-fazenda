'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { calcularHorasBrutas } from '@/lib/calculoHorasBrutas'
import { calcularCargaHorariaDia } from '@/lib/calculoCargaHoraria'

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
  const [funcionarios, setFuncionarios] = useState([])
  const [estaNaSafra, setEstaNaSafra] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [produtos, setProdutos] = useState([])
  const [tiposAtividade, setTiposAtividade] = useState<{id: number, nome: string}[]>([])
  const userRole = (session?.user as any)?.role || ''
  const podeEditarHorimetroInicial = userRole === 'GESTOR'
  const isGestor = ['GESTOR', 'GERENTE'].includes(userRole)
  const [atestadoFile, setAtestadoFile] = useState<File | null>(null)
  const [atestadoUploading, setAtestadoUploading] = useState(false)
  const [atestadoError, setAtestadoError] = useState('')

  const erroRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (error && erroRef.current) {
      erroRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [error])

  const [form, setForm] = useState({
    data: initialData?.data?.split('T')[0] || new Date().toISOString().split('T')[0],
    horaEntrada: initialData?.horaEntrada || '',
    horaSaida: initialData?.horaSaida || '',
    talhaoId: initialData?.talhaoId || '',
    safraId: initialData?.safraId || '',
    tipoAtividade: initialData?.tipoAtividade || '',
    status: 'CONCLUIDO',
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

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (config?.inicioSafra && config?.fimSafra && form.data) {
      const d = new Date(form.data)
      setEstaNaSafra(d >= new Date(config.inicioSafra) && d <= new Date(config.fimSafra))
    } else {
      setEstaNaSafra(false)
    }
  }, [form.data, config])

  const loadData = async () => {
    try {
      const [r1,r2,r3,r4,r5,r6,r7,r8] = await Promise.all([
        fetch('/api/safras'), fetch('/api/talhoes'), fetch('/api/maquinas'),
        fetch('/api/implementos'), fetch('/api/funcionarios'),
        fetch('/api/configuracoes'), fetch('/api/tipos-atividade?ativo=true'), fetch('/api/produtos'),
      ])
      if (r1.ok) setSafras((await r1.json()).data)
      if (r2.ok) setTalhoes((await r2.json()).data)
      if (r3.ok) setMaquinas((await r3.json()).data)
      if (r4.ok) setImplementos((await r4.json()).data)
      if (r5.ok) setFuncionarios((await r5.json()).data)
      if (r6.ok) setConfig((await r6.json()).data)
      if (r7.ok) setTiposAtividade(await r7.json())
      if (r8.ok) setProdutos((await r8.json()).data)
    } catch (err) { console.error(err) }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }))
  }

  const handleMaquinaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const maquinaId = e.target.value
    const maquinaSelecionada: any = maquinas.find((m: any) => m.id === maquinaId)
    setForm(prev => ({
      ...prev,
      maquinaId,
      // Sugere o horímetro final do último Registro de Atividade dessa
      // máquina — vínculo dia a dia, sem considerar abastecimento (que é
      // uma leitura separada e não deve influenciar essa cadeia).
      horimetroInicial: maquinaId && maquinaSelecionada
        ? String(maquinaSelecionada.ultimoHorimetroAtividade ?? 0)
        : '',
    }))
  }

  const validateHorimetro = () => {
    if (form.maquinaId && form.horimetroInicial && form.horimetroFinal) {
      if (parseFloat(form.horimetroFinal) <= parseFloat(form.horimetroInicial)) {
        setError('Horímetro final deve ser maior que inicial')
        return false
      }
      // A checagem de "maior horímetro conhecido" só roda na CRIAÇÃO
      // (sem id). Em modo de edição, o valor vindo de /api/maquinas pode
      // refletir o próprio registro sendo editado (se for o mais recente
      // da máquina), o que bloquearia edições legítimas sem o usuário
      // ter mudado nada. O servidor (PUT) já faz essa validação
      // corretamente excluindo o próprio registro — é ele quem decide de
      // verdade nesse caso.
      if (!id) {
        const maquinaSelecionada: any = maquinas.find((m: any) => m.id === form.maquinaId)
        const ultimoHorimetroAtividade = maquinaSelecionada?.ultimoHorimetroAtividade ?? 0
        if (parseFloat(form.horimetroInicial) < ultimoHorimetroAtividade) {
          setError(`Horímetro inicial (${form.horimetroInicial}h) não pode ser menor que o horímetro final do último Registro de Atividade dessa máquina (${ultimoHorimetroAtividade}h). Verifique o valor digitado.`)
          return false
        }
      }
    }
    return true
  }

  const uploadAtestado = async (registroId: string) => {
    if (!atestadoFile) return
    setAtestadoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', atestadoFile)
      fd.append('registroId', registroId)
      const res = await fetch('/api/registros-atividade/atestado', { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json(); setAtestadoError(d.error || 'Erro ao enviar') }
    } catch { setAtestadoError('Erro ao enviar atestado.') }
    finally { setAtestadoUploading(false) }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (!validateHorimetro()) return
    setLoading(true)
    try {
      if (!form.isFalta && (!form.data || !form.horaEntrada || !form.talhaoId || !form.safraId)) {
        setError('Preencha todos os campos obrigatórios'); setLoading(false); return
      }
      if (isGestor && !form.funcionarioId) {
        setError('Selecione o funcionário'); setLoading(false); return
      }
      const horimetroInicial = form.horimetroInicial ? parseFloat(form.horimetroInicial) : null
      const horimetroFinal = form.horimetroFinal ? parseFloat(form.horimetroFinal) : null
      const horasMaquina = horimetroInicial && horimetroFinal ? parseFloat((horimetroFinal - horimetroInicial).toFixed(2)) : null
      const method = id ? 'PUT' : 'POST'
      const url = id ? `/api/registros-atividade/${id}` : '/api/registros-atividade'
      const payload = form.isFalta ? {
        data: new Date(form.data + 'T12:00:00'),
        funcionarioId: form.funcionarioId,
        isFalta: true, motivoFalta: form.motivoFalta, periodoFalta: form.periodoFalta,
        observacao: form.observacao,
        talhaoId: form.talhaoId || (talhoes[0] as any)?.id,
        safraId: form.safraId || (safras[0] as any)?.id,
        tipoAtividade: 'GERAIS', status: 'CONCLUIDO', horaEntrada: '00:00',
      } : {
        ...form, data: new Date(form.data + 'T12:00:00'),
        totalBombas: form.totalBombas ? parseInt(form.totalBombas) : null,
        quantidadeAdubo: form.quantidadeAdubo ? parseFloat(form.quantidadeAdubo) : null,
        quantidadeCorretivo: form.quantidadeCorretivo ? parseFloat(form.quantidadeCorretivo) : null,
        horimetroInicial, horimetroFinal, horasMaquina,
        passouDiretoAlmoco: estaNaSafra ? form.passouDiretoAlmoco : false,
      }
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const responseData = await response.json()
      if (!response.ok) throw new Error(responseData.error || 'Erro ao salvar')
      if (atestadoFile && form.isFalta && form.motivoFalta === 'atestado_medico' && !id) {
        const registroId = responseData.data?.id
        if (registroId) await uploadAtestado(registroId)
      }
      router.push('/modules/atividades')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  const needsAdubo = form.tipoAtividade === 'Adubação'
  const needsCorretivo = form.tipoAtividade === 'Correção de Solo'
  const needsBombas = ['drench', 'pulverização', 'pulverizacao', 'herbicida'].includes(form.tipoAtividade.toLowerCase())
  const totalHorasMaquina = form.horimetroInicial && form.horimetroFinal && parseFloat(form.horimetroFinal) > parseFloat(form.horimetroInicial)
    ? (parseFloat(form.horimetroFinal) - parseFloat(form.horimetroInicial)).toFixed(1)
   : null

  // Prévia de horas extras/devidas com base neste registro isolado (mesma regra
  // usada na criação do registro, em app/api/registros-atividade/route.ts). O
  // cálculo final do Resumo Mensal pode ajustar o resultado caso existam
  // múltiplos registros no mesmo dia para o mesmo funcionário (turnos separados).
  const previewHoras = useMemo(() => {
    if (!form.horaEntrada || !form.horaSaida) return null

    const funcionarioReferencia: any = isGestor
      ? (funcionarios as any[]).find((f: any) => f.id === form.funcionarioId)
      : (funcionarios as any[]).find((f: any) => f.id === (session?.user as any)?.id)

    if (!funcionarioReferencia) return null

    const horasBrutas = calcularHorasBrutas(form.horaEntrada, form.horaSaida)
    const horasCalculadas = estaNaSafra && form.passouDiretoAlmoco
      ? horasBrutas
      : Math.max(0, horasBrutas - 1)

    const cargaDia = calcularCargaHorariaDia(new Date(form.data + 'T12:00:00'), funcionarioReferencia, config)

    const horasExtras = horasCalculadas > cargaDia ? horasCalculadas - cargaDia : 0
    const horasDevidas = horasCalculadas < cargaDia ? cargaDia - horasCalculadas : 0

    return { horasCalculadas, cargaDia, horasExtras, horasDevidas }
  }, [form.data, form.horaEntrada, form.horaSaida, form.passouDiretoAlmoco, form.funcionarioId, funcionarios, config, estaNaSafra, session])
  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {error && <div ref={erroRef} className="p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-600 text-sm">{error}</p></div>}

      {isGestor && (
        <div className="card border-l-4 border-primary">
          <h3 className="text-lg font-semibold text-primary mb-4">Funcionário *</h3>
          <div className="form-group">
            <label htmlFor="funcionarioId">Selecione o funcionário desta atividade</label>
            <select id="funcionarioId" name="funcionarioId" value={form.funcionarioId} onChange={handleChange} required disabled={loading}>
              <option value="">Selecionar funcionário</option>
              {funcionarios.map((f: any) => <option key={f.id} value={f.id}>{f.name} — {f.role}</option>)}
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
        <div style={{display:'flex', flexDirection:'row', alignItems:'center', gap:'12px', marginBottom:'16px', width:'100%'}}>
          <input type="checkbox" id="isFalta" name="isFalta" checked={form.isFalta} onChange={handleChange} disabled={loading} style={{width:'16px', height:'16px', flexShrink:0, margin:0}} />
          <label htmlFor="isFalta" style={{fontSize:'14px', fontWeight:500, cursor:'pointer', margin:0}}>Marcar como falta</label>
        </div>
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
              <textarea id="observacao" name="observacao" value={form.observacao} onChange={handleChange} disabled={loading} placeholder="Detalhes adicionais..." rows={3} />
            </div>
            {form.motivoFalta === 'atestado_medico' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <p className="text-sm font-semibold text-amber-800">Atestado Médico (PDF)</p>
                {atestadoFile ? (
                  <div className="flex items-center gap-2 p-2 bg-white border border-amber-300 rounded-lg">
                    <span className="text-xs text-gray-700 flex-1 truncate">{atestadoFile.name}</span>
                    <span className="text-xs text-gray-400">({(atestadoFile.size/1024).toFixed(0)} KB)</span>
                    <button type="button" onClick={() => setAtestadoFile(null)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-amber-300 rounded-lg cursor-pointer bg-white hover:bg-amber-50">
                    <span className="text-xs text-amber-600 font-medium">Clique para selecionar PDF</span>
                    <span className="text-xs text-amber-400">Máximo 5MB</span>
                    <input type="file" accept="application/pdf" className="hidden" disabled={loading}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        if (f.type !== 'application/pdf') { setAtestadoError('Apenas PDFs são aceitos'); return }
                        if (f.size > 5*1024*1024) { setAtestadoError('Máximo 5MB'); return }
                        setAtestadoError(''); setAtestadoFile(f)
                      }}
                    />
                  </label>
                )}
                {atestadoError && <p className="text-xs text-red-600">{atestadoError}</p>}
                {atestadoUploading && <p className="text-xs text-amber-600">Enviando atestado...</p>}
                <p className="text-xs text-amber-600">O atestado será anexado após salvar.</p>
              </div>
            )}
            <div className="flex gap-4 pt-2">
              <button type="submit" disabled={loading} className="btn btn-primary flex-1">{loading ? 'Salvando...' : 'Registrar Falta'}</button>
              <button type="button" onClick={() => router.back()} disabled={loading} className="btn btn-outline flex-1">Cancelar</button>
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
                    {talhoes.map((t: any) => <option key={t.id} value={t.id}>{t.nome} ({t.area} ha)</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="safraId">Safra *</label>
                  <select id="safraId" name="safraId" value={form.safraId} onChange={handleChange} required disabled={loading}>
                    <option value="">Selecionar safra</option>
                    {safras.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="tipoAtividade">Tipo de Atividade *</label>
                <select id="tipoAtividade" name="tipoAtividade" value={form.tipoAtividade} onChange={handleChange} required disabled={loading}>
                  <option value="">Selecionar tipo</option>
                  {tiposAtividade.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="horaEntrada">Hora Entrada *</label>
                  <input type="time" id="horaEntrada" name="horaEntrada" value={form.horaEntrada} onChange={handleChange} required disabled={loading} />
                </div>
                <div className="form-group">
                  <label htmlFor="horaSaida">Hora Saída</label>
                  <input type="time" id="horaSaida" name="horaSaida" value={form.horaSaida} onChange={handleChange} disabled={loading} />
                </div>
              </div>
              {estaNaSafra && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div style={{display:'flex', flexDirection:'row', alignItems:'center', gap:'12px', width:'100%'}}>
                    <input type="checkbox" id="passouDiretoAlmoco" name="passouDiretoAlmoco" checked={form.passouDiretoAlmoco} onChange={handleChange} disabled={loading} style={{width:'16px', height:'16px', flexShrink:0, margin:0}} />
                    <label htmlFor="passouDiretoAlmoco" style={{fontSize:'14px', fontWeight:500, color:'#92400e', cursor:'pointer', margin:0}}>Passou direto no almoço (1h conta como hora extra)</label>
                  </div>
                </div>
              )}
              {previewHoras && (
                <div className={`p-3 rounded-lg border ${
                  previewHoras.horasExtras > 0
                    ? 'bg-green-50 border-green-200'
                    : previewHoras.horasDevidas > 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <p className={`text-sm ${
                    previewHoras.horasExtras > 0
                      ? 'text-green-800'
                      : previewHoras.horasDevidas > 0
                      ? 'text-amber-800'
                      : 'text-gray-700'
                  }`}>
                    <strong>Horas trabalhadas:</strong> {previewHoras.horasCalculadas.toFixed(1)}h
                    {previewHoras.horasExtras > 0 && ` — +${previewHoras.horasExtras.toFixed(1)}h de hora extra`}
                    {previewHoras.horasDevidas > 0 && ` — faltam ${previewHoras.horasDevidas.toFixed(1)}h para completar a carga do dia`}
                    {previewHoras.horasExtras === 0 && previewHoras.horasDevidas === 0 && ' — carga do dia completa'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Prévia — pode mudar se houver outro registro no mesmo dia
                  </p>
                </div>
              )}
            </div>
          </div>

          {needsAdubo && (
            <div className="card">
              <h3 className="text-lg font-semibold text-primary mb-4">Adubação</h3>
              <div className="space-y-4">
                <div className="form-group">
                  <label>Tipo de Adubo</label>
                  <select name="tipoAdubo" value={form.tipoAdubo} onChange={handleChange} disabled={loading}>
                    <option value="">Selecionar adubo</option>
                    {(produtos as any[]).filter((p:any) => p.categoria==='Fertilizante'||p.categoria==='Adubo').map((p:any) => <option key={p.id} value={p.nomeComercial}>{p.nomeComercial} ({p.unidadeMedida})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantidade</label>
                  <input type="number" name="quantidadeAdubo" value={form.quantidadeAdubo} onChange={handleChange} disabled={loading} step="0.001" placeholder="0" />
                </div>
              </div>
            </div>
          )}

          {needsCorretivo && (
            <div className="card">
              <h3 className="text-lg font-semibold text-primary mb-4">Correção de Solo</h3>
              <div className="space-y-4">
                <div className="form-group">
                  <label>Tipo de Corretivo</label>
                  <select name="tipoCorretivo" value={form.tipoCorretivo} onChange={handleChange} disabled={loading}>
                    <option value="">Selecionar corretivo</option>
                    {(produtos as any[]).filter((p:any) => p.categoria==='Corretivo').map((p:any) => <option key={p.id} value={p.nomeComercial}>{p.nomeComercial} ({p.unidadeMedida})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantidade</label>
                  <input type="number" name="quantidadeCorretivo" value={form.quantidadeCorretivo} onChange={handleChange} disabled={loading} step="0.001" placeholder="0" />
                </div>
              </div>
            </div>
          )}

          {needsBombas && (
            <div className="card">
              <h3 className="text-lg font-semibold text-primary mb-4">Aplicação</h3>
              <div className="form-group">
                <label>Quantidade de Bombas</label>
                <input type="number" name="totalBombas" value={form.totalBombas} onChange={handleChange} disabled={loading} min="0" step="1" placeholder="0" />
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-lg font-semibold text-primary mb-4">Máquina e Implemento (Opcional)</h3>
            <div className="space-y-4">
              <div className="form-group">
                <label>Máquina Utilizada</label>
                <select name="maquinaId" value={form.maquinaId} onChange={handleMaquinaChange} disabled={loading}>
                  <option value="">Sem máquina</option>
                  {maquinas.map((m:any) => <option key={m.id} value={m.id}>{m.nome} ({m.tipo})</option>)}
                </select>
              </div>
              {form.maquinaId && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label>Horímetro Inicial (h)</label>
                      <input type="number" name="horimetroInicial" value={form.horimetroInicial} onChange={handleChange} disabled={loading || !podeEditarHorimetroInicial} step="0.1" placeholder="0,0" required />
                      <p className="text-xs text-gray-500 mt-1">
                        {podeEditarHorimetroInicial
                          ? 'Preenchido automaticamente com o último horímetro registrado da máquina. Ajuste se necessário.'
                          : 'Preenchido automaticamente com o último horímetro registrado da máquina. Apenas o gestor pode alterar este valor.'}
                      </p>
                    </div>
                    <div className="form-group">
                      <label>Horímetro Final (h)</label>
                      <input type="number" name="horimetroFinal" value={form.horimetroFinal} onChange={handleChange} disabled={loading} step="0.1" placeholder="0,0" required />
                    </div>
                  </div>
                  {totalHorasMaquina && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        <strong>Total de horas da máquina:</strong> {totalHorasMaquina}h
                      </p>
                    </div>
                  )}
                </>
              )}
              <div className="form-group">
                <label>Implemento Utilizado</label>
                <select name="implementoUtilizado" value={form.implementoUtilizado} onChange={handleChange} disabled={loading}>
                  <option value="">Sem implemento</option>
                  {implementos.map((imp:any) => <option key={imp.id} value={imp.nome}>{imp.nome}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-primary mb-4">Observações</h3>
            <div className="form-group">
              <label>Observações Adicionais</label>
              <textarea name="observacao" value={form.observacao} onChange={handleChange} disabled={loading} placeholder="Descreva detalhes da atividade..." rows={4} />
            </div>
          </div>

          <div className="flex gap-4">
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">{loading ? 'Salvando...' : id ? 'Atualizar' : 'Registrar Atividade'}</button>
            <button type="button" onClick={() => router.back()} disabled={loading} className="btn btn-outline flex-1">Cancelar</button>
          </div>
        </>
      )}
    </form>
  )
}
