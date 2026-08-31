'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { calcularHorasBrutas } from '@/lib/calculoHorasBrutas'
import { calcularCargaHorariaDia } from '@/lib/calculoCargaHoraria'
import { TIPO_ATIVIDADE_AJUSTE_HORIMETRO, NAO_IDENTIFICADO_EMAIL } from '@/lib/ajusteHorimetro'
import { obterRegimeNaData, type PeriodoRegimeSalarialSimples } from '@/lib/regimeSalarialClient'

interface RegistroAtividadeFormProps {
  id?: string
  initialData?: any
}

export function RegistroAtividadeForm({ id, initialData }: RegistroAtividadeFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Modo especial ativado só via query param (?ajuste=1), vindo do botão
  // "Lançar ajuste" da tela de reconciliação de Combustível — de propósito
  // sem checkbox visível no form normal, pra ninguém ativar sem querer.
  // Só se aplica na criação (nunca em edição de um registro já existente).
  const isAjusteMode = !id && searchParams.get('ajuste') === '1'
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [safras, setSafras] = useState([])
  const [talhoes, setTalhoes] = useState([])
  const [maquinas, setMaquinas] = useState([])
  const [implementos, setImplementos] = useState([])
  const [funcionarios, setFuncionarios] = useState([])
  const [periodosRegime, setPeriodosRegime] = useState<PeriodoRegimeSalarialSimples[]>([])
  const [config, setConfig] = useState<any>(null)
  const [produtos, setProdutos] = useState([])
  const [tiposAtividade, setTiposAtividade] = useState<{id: number, nome: string}[]>([])
  const userRole = (session?.user as any)?.role || ''
  const podeEditarHorimetroInicial = userRole === 'GESTOR' || userRole === 'GERENTE'
  const isGestor = ['GESTOR', 'GERENTE'].includes(userRole)
  const isGestorEstrito = userRole === 'GESTOR'
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
    data: (isAjusteMode && searchParams.get('data')) || initialData?.data?.split('T')[0] || new Date().toISOString().split('T')[0],
    horaEntrada: isAjusteMode ? '00:00' : (initialData?.horaEntrada || ''),
    horaSaida: initialData?.horaSaida || '',
    talhaoId: initialData?.talhaoId || '',
    areaHectares: initialData?.areaHectares != null ? String(initialData.areaHectares) : '',
    safraId: initialData?.safraId || '',
    tipoAtividade: isAjusteMode ? TIPO_ATIVIDADE_AJUSTE_HORIMETRO : (initialData?.tipoAtividade || ''),
    status: 'CONCLUIDO',
    totalBombas: initialData?.totalBombas || '',
    tipoAdubo: initialData?.tipoAdubo || '',
    quantidadeAdubo: initialData?.quantidadeAdubo || '',
    tipoCorretivo: initialData?.tipoCorretivo || '',
    quantidadeCorretivo: initialData?.quantidadeCorretivo || '',
    maquinaId: (isAjusteMode && searchParams.get('maquinaId')) || initialData?.maquinaId || '',
    horimetroInicial: (isAjusteMode && searchParams.get('horimetroInicial')) || initialData?.horimetroInicial || '',
    horimetroFinal: (isAjusteMode && searchParams.get('horimetroFinal')) || initialData?.horimetroFinal || '',
    implementoUtilizado: initialData?.implementoUtilizado || '',
    isFalta: initialData?.isFalta || false,
    isAjusteHorimetro: isAjusteMode || initialData?.isAjusteHorimetro || false,
    motivoFalta: initialData?.motivoFalta || '',
    periodoFalta: initialData?.periodoFalta || 'DIA_INTEIRO',
    passouDiretoAlmoco: initialData?.passouDiretoAlmoco || false,
    observacao: initialData?.observacao || '',
    fotoEvidencia: initialData?.fotoEvidencia || '',
    funcionarioId: initialData?.funcionarioId || '',
  })

  // Máquinas ADICIONAIS usadas na mesma atividade/dia — pra quando o
  // funcionário troca de máquina durante o dia (ex: trator A de manhã,
  // trator B à tarde). Cada linha independente da máquina principal
  // acima. Etapa 1: só cadastro, sem entrar nos cálculos de combustível/
  // custo por hora-máquina ainda.
  const [maquinasAdicionais, setMaquinasAdicionais] = useState<{
    maquinaId: string
    horimetroInicial: string
    horimetroFinal: string
    implementoUtilizado: string
  }[]>(
    (initialData?.maquinasAdicionais || []).map((m: any) => ({
      maquinaId: m.maquinaId || '',
      horimetroInicial: m.horimetroInicial != null ? String(m.horimetroInicial) : '',
      horimetroFinal: m.horimetroFinal != null ? String(m.horimetroFinal) : '',
      implementoUtilizado: m.implementoUtilizado || '',
    }))
  )

  const handleAdicionarMaquina = () => {
    setMaquinasAdicionais(prev => [...prev, { maquinaId: '', horimetroInicial: '', horimetroFinal: '', implementoUtilizado: '' }])
  }

  const handleRemoverMaquina = (index: number) => {
    setMaquinasAdicionais(prev => prev.filter((_, i) => i !== index))
  }

  const handleMaquinaAdicionalChange = (index: number, campo: 'maquinaId' | 'horimetroInicial' | 'horimetroFinal' | 'implementoUtilizado', valor: string) => {
    setMaquinasAdicionais(prev => prev.map((m, i) => {
      if (i !== index) return m
      if (campo === 'maquinaId') {
        const maquinaSelecionada: any = maquinas.find((mq: any) => mq.id === valor)
        return {
          ...m,
          maquinaId: valor,
          // Mesma sugestão automática da máquina principal: último
          // horímetro conhecido dessa máquina.
          horimetroInicial: valor && maquinaSelecionada ? String(maquinaSelecionada.ultimoHorimetroAtividade ?? 0) : '',
        }
      }
      return { ...m, [campo]: valor }
    }))
  }

  const validarMaquinasAdicionaisNoCliente = () => {
    for (const m of maquinasAdicionais) {
      if (!m.maquinaId || !m.horimetroInicial || !m.horimetroFinal) {
        setError('Preencha máquina, horímetro inicial e final em todas as máquinas adicionais (ou remova a linha que não for usar).')
        return false
      }
      if (parseFloat(m.horimetroFinal) <= parseFloat(m.horimetroInicial)) {
        setError('Horímetro final deve ser maior que inicial em todas as máquinas adicionais.')
        return false
      }
    }
    return true
  }

  // Funcionário padrão do ajuste: usuário placeholder "Não Identificado" —
  // só preenche se ainda estiver vazio (não sobrescreve escolha do gestor) e
  // só depois que /api/funcionarios carregar. Continua editável normalmente.
  useEffect(() => {
    if (isAjusteMode && !form.funcionarioId && funcionarios.length > 0) {
      const naoIdentificado: any = (funcionarios as any[]).find((f: any) => f.email === NAO_IDENTIFICADO_EMAIL)
      if (naoIdentificado) {
        setForm(prev => (prev.funcionarioId ? prev : { ...prev, funcionarioId: naoIdentificado.id }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarios, isAjusteMode])

  // Safra padrão do ajuste: safra ATIVA — mesmo espírito do fallback já usado
  // pro isFalta (form.safraId || safras[0]?.id) no payload, só que aqui
  // preenchendo com a safra ativa de verdade em vez do primeiro item da lista.
  useEffect(() => {
    if (isAjusteMode && !form.safraId && safras.length > 0) {
      const safraAtiva: any = (safras as any[]).find((s: any) => s.status === 'ATIVA')
      if (safraAtiva) {
        setForm(prev => (prev.safraId ? prev : { ...prev, safraId: safraAtiva.id }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safras, isAjusteMode])

  useEffect(() => { loadData() }, [])

  // Regime salarial (Safra/Entressafra) do dia selecionado no formulário.
  // Fonte da verdade: PeriodoRegimeSalarial (Configurações → Safra/
  // Entressafra) — a MESMA usada no backend (app/api/registros-atividade)
  // pra decidir jornada, salário e desconto de almoço. Não confundir com
  // `safras` acima, que é o cadastro de Safra AGRÍCOLA (ex: "Safra 25/26",
  // pro dropdown de talhão/colheita) — outro conceito, com seu próprio
  // período, sem relação com o regime salarial do dia.
  const regimeDoDia = useMemo(() => {
    if (!form.data || periodosRegime.length === 0) return null
    return obterRegimeNaData(new Date(form.data + 'T12:00:00'), periodosRegime)
  }, [form.data, periodosRegime])

  const loadData = async () => {
    try {
      const [r1,r2,r3,r4,r5,r6,r7,r8,r9] = await Promise.all([
        fetch('/api/safras'), fetch('/api/talhoes'), fetch('/api/maquinas'),
        fetch('/api/implementos'), fetch('/api/funcionarios'),
        fetch('/api/configuracoes'), fetch('/api/tipos-atividade?ativo=true'), fetch('/api/produtos'),
        fetch('/api/periodos-regime-salarial'),
      ])
      if (r1.ok) setSafras((await r1.json()).data)
      if (r2.ok) setTalhoes((await r2.json()).data)
      if (r3.ok) setMaquinas((await r3.json()).data)
      if (r4.ok) setImplementos((await r4.json()).data)
      if (r5.ok) setFuncionarios((await r5.json()).data)
      if (r6.ok) setConfig((await r6.json()).data)
      if (r7.ok) setTiposAtividade(await r7.json())
      if (r8.ok) setProdutos((await r8.json()).data)
      if (r9.ok) setPeriodosRegime((await r9.json()).data)
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
      const horasCalculadasHorimetro = parseFloat(form.horimetroFinal) - parseFloat(form.horimetroInicial)
      if (horasCalculadasHorimetro > 24) {
        setError(`A diferença entre os horímetros é de ${horasCalculadasHorimetro.toFixed(1)}h, o que não é possível num único dia. Confira se os valores de horímetro inicial e final foram digitados corretamente (ex: vírgula decimal no lugar errado).`)
        return false
      }
      // A checagem de "maior horímetro conhecido" só roda na CRIAÇÃO
      // (sem id). Em modo de edição, o valor vindo de /api/maquinas pode
      // refletir o próprio registro sendo editado (se for o mais recente
      // da máquina), o que bloquearia edições legítimas sem o usuário
      // ter mudado nada. O servidor (PUT) já faz essa validação
      // corretamente excluindo o próprio registro — é ele quem decide de
      // verdade nesse caso.
      //
      // Também não roda pro ajuste de Horas Não Identificadas: por
      // definição esse lançamento fecha um buraco NO PASSADO, depois que
      // atividades reais mais recentes (com horímetro mais alto) já podem
      // existir — a trava de "nunca retrocede" não se aplica aqui. A API
      // (POST) faz o mesmo bypass, só pra isAjusteHorimetro.
      if (!id && !form.isAjusteHorimetro) {
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
    if (!validarMaquinasAdicionaisNoCliente()) return
    setLoading(true)
    try {
      if (!form.isFalta && !form.isAjusteHorimetro && (!form.data || !form.horaEntrada || !form.horaSaida || !form.talhaoId || !form.safraId)) {
        setError('Preencha todos os campos obrigatórios'); setLoading(false); return
      }
      if (form.isAjusteHorimetro) {
        if (!form.maquinaId || !form.horimetroInicial || !form.horimetroFinal) {
          setError('Selecione a máquina e informe horímetro inicial e final'); setLoading(false); return
        }
        if (!form.observacao.trim()) {
          setError('Informe o motivo do ajuste (observação obrigatória)'); setLoading(false); return
        }
      }
      if (needsBombas && (!form.totalBombas || parseFloat(form.totalBombas) <= 0)) {
        setError('Informe a quantidade de bombas usadas nessa aplicação'); setLoading(false); return
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
        // Falta não tem talhão real — não preencher com um talhão
        // qualquer só pra satisfazer campo obrigatório (mesmo problema
        // corrigido hoje mais cedo pro sistema automático de faltas).
        talhaoId: null,
        safraId: form.safraId || (safras[0] as any)?.id,
        tipoAtividade: 'GERAIS', status: 'CONCLUIDO', horaEntrada: '00:00',
      } : form.isAjusteHorimetro ? {
        data: new Date(form.data + 'T12:00:00'),
        funcionarioId: form.funcionarioId,
        isAjusteHorimetro: true,
        tipoAtividade: TIPO_ATIVIDADE_AJUSTE_HORIMETRO,
        status: 'CONCLUIDO',
        horaEntrada: '00:00',
        // Ajuste não tem talhão real — mesmo motivo da falta acima.
        talhaoId: null,
        safraId: form.safraId || (safras[0] as any)?.id,
        maquinaId: form.maquinaId,
        horimetroInicial, horimetroFinal, horasMaquina,
        observacao: form.observacao,
      } : {
        ...form, data: new Date(form.data + 'T12:00:00'),
        totalBombas: form.totalBombas ? parseInt(form.totalBombas) : null,
        quantidadeAdubo: form.quantidadeAdubo ? parseFloat(form.quantidadeAdubo) : null,
        quantidadeCorretivo: form.quantidadeCorretivo ? parseFloat(form.quantidadeCorretivo) : null,
        areaHectares: form.areaHectares ? parseFloat(form.areaHectares) : null,
        horimetroInicial, horimetroFinal, horasMaquina,
        passouDiretoAlmoco: regimeDoDia ? form.passouDiretoAlmoco : false,
        maquinasAdicionais: maquinasAdicionais.filter(m => m.maquinaId).map(m => ({
          maquinaId: m.maquinaId,
          horimetroInicial: parseFloat(m.horimetroInicial),
          horimetroFinal: parseFloat(m.horimetroFinal),
          implementoUtilizado: m.implementoUtilizado || null,
        })),
      }
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const responseData = await response.json()
      if (!response.ok) throw new Error(responseData.error || 'Erro ao salvar')
      if (atestadoFile && form.isFalta && form.motivoFalta === 'atestado_medico' && !id) {
        const registroId = responseData.data?.id
        if (registroId) await uploadAtestado(registroId)
      }
      router.back()
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
    const horasCalculadas = form.passouDiretoAlmoco
      ? horasBrutas
      : Math.max(0, horasBrutas - 1)

    const cargaDia = calcularCargaHorariaDia(new Date(form.data + 'T12:00:00'), funcionarioReferencia, config)

    const horasExtras = horasCalculadas > cargaDia ? horasCalculadas - cargaDia : 0
    const horasDevidas = horasCalculadas < cargaDia ? cargaDia - horasCalculadas : 0

    return { horasCalculadas, cargaDia, horasExtras, horasDevidas }
  }, [form.data, form.horaEntrada, form.horaSaida, form.passouDiretoAlmoco, form.funcionarioId, funcionarios, config, session])
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

      {form.isAjusteHorimetro && (
        <div className="card border-l-4 border-blue-400">
          <h3 className="text-lg font-semibold text-primary mb-1">Ajuste de Registro de Atividade — Horas Não Identificadas</h3>
          <p className="text-xs text-gray-500 mb-4">
            Lançamento gerado pela tela de reconciliação de Combustível (Relatórios &gt; Combustível), pra fechar um
            buraco entre o horímetro dos abastecimentos e as horas de máquina já registradas em atividades. Não
            confundir com "Ajuste de Horímetro" (Cadastros), que corrige o horímetro atual da máquina diretamente.
          </p>
          <div className="space-y-4">
            <div className="form-group">
              <label htmlFor="maquinaId">Máquina *</label>
              <select id="maquinaId" name="maquinaId" value={form.maquinaId} onChange={handleMaquinaChange} required disabled={loading}>
                <option value="">Selecionar máquina</option>
                {maquinas.map((m:any) => <option key={m.id} value={m.id}>{m.nome} ({m.tipo})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="horimetroInicial">Horímetro Inicial (h) *</label>
                <input type="number" id="horimetroInicial" name="horimetroInicial" value={form.horimetroInicial} onChange={handleChange} step="0.1" placeholder="0,0" required disabled={loading} />
              </div>
              <div className="form-group">
                <label htmlFor="horimetroFinal">Horímetro Final (h) *</label>
                <input type="number" id="horimetroFinal" name="horimetroFinal" value={form.horimetroFinal} onChange={handleChange} step="0.1" placeholder="0,0" required disabled={loading} />
              </div>
            </div>
            {totalHorasMaquina && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800"><strong>Total de horas do ajuste:</strong> {totalHorasMaquina}h</p>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="observacao">Motivo do ajuste *</label>
              <textarea id="observacao" name="observacao" value={form.observacao} onChange={handleChange} required disabled={loading} rows={3}
                placeholder="Ex: horas de trator não lançadas por ninguém entre 09/07 e 21/07" />
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">{loading ? 'Salvando...' : id ? 'Atualizar Ajuste' : 'Registrar Ajuste'}</button>
            <button type="button" onClick={() => router.back()} disabled={loading} className="btn btn-outline flex-1">Cancelar</button>
          </div>
        </div>
      )}

      {!form.isAjusteHorimetro && (
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
                <option value="banco_horas">Compensação (Banco de Horas)</option>
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
      )}

      {!form.isFalta && !form.isAjusteHorimetro && (
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
              {isGestorEstrito && (
                <div className="form-group">
                  <label htmlFor="areaHectares">Área feita no dia (ha)</label>
                  <input
                    type="number"
                    id="areaHectares"
                    name="areaHectares"
                    value={form.areaHectares}
                    onChange={handleChange}
                    disabled={loading}
                    step="0.01"
                    min="0"
                    placeholder="Opcional"
                  />
                  <p className="text-xs text-gray-500 mt-1">Visível só pra Gestor. Deixe em branco se não for informar.</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="horaEntrada">Hora Entrada *</label>
                  <input type="time" id="horaEntrada" name="horaEntrada" value={form.horaEntrada} onChange={handleChange} required disabled={loading} />
                </div>
                <div className="form-group">
                  <label htmlFor="horaSaida">Hora Saída *</label>
                  <input type="time" id="horaSaida" name="horaSaida" value={form.horaSaida} onChange={handleChange} required disabled={loading} />
                </div>
              </div>
              {regimeDoDia && (
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

              {maquinasAdicionais.map((m, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-lg space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Máquina adicional {index + 1}</label>
                    <button
                      type="button"
                      onClick={() => handleRemoverMaquina(index)}
                      disabled={loading}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Remover
                    </button>
                  </div>
                  <div className="form-group">
                    <select
                      value={m.maquinaId}
                      onChange={(e) => handleMaquinaAdicionalChange(index, 'maquinaId', e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Selecione a máquina</option>
                      {maquinas.map((mq: any) => <option key={mq.id} value={mq.id}>{mq.nome} ({mq.tipo})</option>)}
                    </select>
                  </div>
                  {m.maquinaId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label>Horímetro Inicial (h)</label>
                        <input
                          type="number"
                          value={m.horimetroInicial}
                          onChange={(e) => handleMaquinaAdicionalChange(index, 'horimetroInicial', e.target.value)}
                          disabled={loading}
                          step="0.1"
                          placeholder="0,0"
                        />
                      </div>
                      <div className="form-group">
                        <label>Horímetro Final (h)</label>
                        <input
                          type="number"
                          value={m.horimetroFinal}
                          onChange={(e) => handleMaquinaAdicionalChange(index, 'horimetroFinal', e.target.value)}
                          disabled={loading}
                          step="0.1"
                          placeholder="0,0"
                        />
                      </div>
                      <div className="form-group md:col-span-2">
                        <label>Implemento Utilizado</label>
                        <select
                          value={m.implementoUtilizado}
                          onChange={(e) => handleMaquinaAdicionalChange(index, 'implementoUtilizado', e.target.value)}
                          disabled={loading}
                        >
                          <option value="">Sem implemento</option>
                          {implementos.map((imp: any) => <option key={imp.id} value={imp.nome}>{imp.nome}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={handleAdicionarMaquina}
                disabled={loading}
                className="text-sm text-primary hover:underline"
              >
                + Adicionar outra máquina (trocou de máquina no mesmo dia)
              </button>

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
