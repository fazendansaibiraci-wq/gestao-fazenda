'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface DiariaTurmaFormProps {
    id?: string
    initialData?: any
}

export function DiariaTurmaForm({ id, initialData }: DiariaTurmaFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [safras, setSafras] = useState([])
    const [talhoes, setTalhoes] = useState([])
    const [turmas, setTurmas] = useState<{id: string, nome: string}[]>([])
    const [tiposAtividade, setTiposAtividade] = useState<{id: number, nome: string}[]>([])

  const [form, setForm] = useState({
        data: initialData?.data?.split('T')[0] || new Date().toISOString().split('T')[0],
        turmaId: initialData?.turmaId || '',
        quantidadePessoas: initialData?.quantidadePessoas?.toString() || '',
        talhaoId: initialData?.talhaoId || '',
        safraId: initialData?.safraId || '',
        tipoAtividade: initialData?.tipoAtividade || '',
        valorDiaria: initialData?.valorDiaria?.toString() || '',
        observacao: initialData?.observacao || '',
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
        try {
                const [r1, r2, r3, r4] = await Promise.all([
                          fetch('/api/safras'),
                          fetch('/api/talhoes'),
                          fetch('/api/tipos-atividade?ativo=true'),
                          fetch('/api/turmas?ativo=true'),
                        ])
                if (r1.ok) setSafras((await r1.json()).data)
                if (r2.ok) setTalhoes((await r2.json()).data)
                if (r3.ok) setTiposAtividade(await r3.json())
                if (r4.ok) setTurmas(await r4.json())
        } catch (err) { console.error(err) }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
  }

  const valorTotal = (parseFloat(form.valorDiaria) || 0) * (parseInt(form.quantidadePessoas) || 0)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')

        if (!form.data || !form.turmaId || !form.quantidadePessoas || !form.talhaoId || !form.safraId || !form.valorDiaria) {
                setError('Preencha todos os campos obrigatórios')
                return
        }

        setLoading(true)
        try {
                const method = id ? 'PUT' : 'POST'
                const url = id ? `/api/diarias-turma/${id}` : '/api/diarias-turma'
                const payload = {
                          ...form,
                          data: new Date(form.data + 'T12:00:00'),
                          quantidadePessoas: parseInt(form.quantidadePessoas),
                          valorDiaria: parseFloat(form.valorDiaria),
                }
                const response = await fetch(url, {
                          method,
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(payload),
                })
                const responseData = await response.json()
                if (!response.ok) throw new Error(responseData.error || 'Erro ao salvar')
                router.push('/modules/turmas')
                router.refresh()
        } catch (err) {
                setError(err instanceof Error ? err.message : 'Erro ao salvar')
        } finally {
                setLoading(false)
        }
  }

  return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-600 text-sm">{error}</p></div>}
        
              <div className="card">
                      <h3 className="text-lg font-semibold text-primary mb-4">Dados da Turma</h3>
                      <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="form-group">
                                                          <label htmlFor="data">Data *</label>
                                                          <input type="date" id="data" name="data" value={form.data} onChange={handleChange} required disabled={loading} />
                                            </div>
                                            <div className="form-group">
                                                          <label htmlFor="turmaId">Turma *</label>
                                                          <select id="turmaId" name="turmaId" value={form.turmaId} onChange={handleChange} required disabled={loading}>
                                                                          <option value="">Selecionar turma</option>
                                                            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                                                          </select>
                                            </div>
                                </div>
                      
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
                      </div>
              </div>
        
              <div className="card">
                      <h3 className="text-lg font-semibold text-primary mb-4">Valores</h3>
                      <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="form-group">
                                                          <label htmlFor="quantidadePessoas">Quantidade de Pessoas *</label>
                                                          <input type="number" id="quantidadePessoas" name="quantidadePessoas" value={form.quantidadePessoas} onChange={handleChange} required disabled={loading} min="1" step="1" placeholder="0" />
                                            </div>
                                            <div className="form-group">
                                                          <label htmlFor="valorDiaria">Valor da Diária (por pessoa) *</label>
                                                          <input type="number" id="valorDiaria" name="valorDiaria" value={form.valorDiaria} onChange={handleChange} required disabled={loading} min="0" step="0.01" placeholder="0,00" />
                                            </div>
                                </div>
                      
                        {valorTotal > 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-800">
                                                    <strong>Valor Total:</strong> R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                      </div>
                                )}
                      </div>
              </div>
        
              <div className="card">
                      <h3 className="text-lg font-semibold text-primary mb-4">Observações</h3>
                      <div className="form-group">
                                <label htmlFor="observacao">Observações Adicionais</label>
                                <textarea id="observacao" name="observacao" value={form.observacao} onChange={handleChange} disabled={loading} placeholder="Detalhes sobre a turma ou o serviço realizado..." rows={4} />
                      </div>
              </div>
        
              <div className="flex gap-4">
                      <button type="submit" disabled={loading} className="btn btn-primary flex-1">{loading ? 'Salvando...' : id ? 'Atualizar' : 'Registrar Diária'}</button>
                      <button type="button" onClick={() => router.back()} disabled={loading} className="btn btn-outline flex-1">Cancelar</button>
              </div>
        </form>
      )
}
