'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { redirect } from 'next/navigation'
import { Plus, X } from 'lucide-react'

export default function NovoLotePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [safras, setSafras] = useState([])
  const [talhoes, setTalhoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    safraId: '',
  })

  const [chegadas, setChegadas] = useState<any[]>([])
  const [novaChegada, setNovaChegada] = useState({
    talhaoId: '',
    tipoColheita: 'MAQUINA',
    quantidade: '',
    unidadeOriginal: 'carretas',
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const [safrasRes, talhoesRes] = await Promise.all([
        fetch('/api/safras'),
        fetch('/api/talhoes'),
      ])
      if (safrasRes.ok) setSafras((await safrasRes.json()).data)
      if (talhoesRes.ok) setTalhoes((await talhoesRes.json()).data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const converterParaLitros = (quantidade: number, tipo: string, unidade: string) => {
    switch (tipo) {
      case 'MAQUINA':
        return quantidade * 4000 // carretas × 4.000 L
      case 'MANUAL':
        return quantidade * 60 // alqueires × 60 L
      case 'VARRICAO':
        return quantidade * 3 * 4000 // caminhões × 3 × 4.000 L
      default:
        return quantidade
    }
  }

  const handleAddChegada = () => {
    if (!novaChegada.talhaoId || !novaChegada.quantidade) {
      alert('Preencha todos os campos')
      return
    }

    const quantidadeLitros = converterParaLitros(
      parseFloat(novaChegada.quantidade),
      novaChegada.tipoColheita,
      novaChegada.unidadeOriginal
    )

    const talhaoNome = talhoes.find((t) => t.id === novaChegada.talhaoId)?.nome

    setChegadas([
      ...chegadas,
      {
        ...novaChegada,
        quantidade: parseFloat(novaChegada.quantidade),
        quantidadeLitros,
        talhaoNome,
      },
    ])

    setNovaChegada({
      talhaoId: '',
      tipoColheita: 'MAQUINA',
      quantidade: '',
      unidadeOriginal: 'carretas',
    })
  }

  const totalLitros = chegadas.reduce((acc, c) => acc + c.quantidadeLitros, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.safraId || chegadas.length === 0) {
      alert('Selecione uma safra e adicione pelo menos uma chegada')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          safraId: formData.safraId,
          chegadas: chegadas,
        }),
      })

      if (!res.ok) throw new Error('Erro ao criar lote')

      const data = await res.json()
      router.push(`/modules/rastreabilidade/${data.data.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar lote')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-primary">Novo Lote</h1>
        <p className="text-gray-600 mt-1">Registrar chegadas de café no terreiro</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Etapa 1: Seleção de Safra */}
        <div className="card">
          <h3 className="text-lg font-semibold text-primary mb-4">1. Safra</h3>
          <div className="form-group">
            <label htmlFor="safra">Safra *</label>
            <select
              id="safra"
              value={formData.safraId}
              onChange={(e) => setFormData({ ...formData, safraId: e.target.value })}
              required
              className="border rounded px-3 py-2 w-full"
            >
              <option value="">Selecionar safra</option>
              {safras.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Etapa 2: Adicionar Chegadas */}
        <div className="card">
          <h3 className="text-lg font-semibold text-primary mb-4">2. Chegadas de Café</h3>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="talhao">Talhão *</label>
                <select
                  id="talhao"
                  value={novaChegada.talhaoId}
                  onChange={(e) => setNovaChegada({ ...novaChegada, talhaoId: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="">Selecionar talhão</option>
                  {talhoes.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({t.area} ha)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="tipo">Tipo de Colheita *</label>
                <select
                  id="tipo"
                  value={novaChegada.tipoColheita}
                  onChange={(e) => setNovaChegada({ ...novaChegada, tipoColheita: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="MAQUINA">Máquina</option>
                  <option value="MANUAL">Manual</option>
                  <option value="VARRICAO">Varrição</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="quantidade">Quantidade *</label>
                <input
                  id="quantidade"
                  type="number"
                  value={novaChegada.quantidade}
                  onChange={(e) => setNovaChegada({ ...novaChegada, quantidade: e.target.value })}
                  step="0.01"
                  placeholder="0"
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div className="form-group">
                <label htmlFor="unidade">Unidade *</label>
                <select
                  id="unidade"
                  value={novaChegada.unidadeOriginal}
                  onChange={(e) =>
                    setNovaChegada({ ...novaChegada, unidadeOriginal: e.target.value })
                  }
                  className="border rounded px-3 py-2 w-full"
                >
                  {novaChegada.tipoColheita === 'MAQUINA' && (
                    <option value="carretas">Carretas (4.000 L cada)</option>
                  )}
                  {novaChegada.tipoColheita === 'MANUAL' && (
                    <option value="alqueires">Alqueires (60 L cada)</option>
                  )}
                  {novaChegada.tipoColheita === 'VARRICAO' && (
                    <option value="caminhoes">Caminhões (12.000 L cada)</option>
                  )}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddChegada}
              className="w-full btn btn-secondary flex items-center justify-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Adicionar Chegada
            </button>
          </div>

          {/* Histórico de Chegadas */}
          {chegadas.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Chegadas Adicionadas</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Talhão</th>
                      <th className="px-4 py-2 text-left">Tipo</th>
                      <th className="px-4 py-2 text-left">Quantidade</th>
                      <th className="px-4 py-2 text-left">Total (L)</th>
                      <th className="px-4 py-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chegadas.map((c, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{c.talhaoNome}</td>
                        <td className="px-4 py-2">
                          {c.tipoColheita === 'MAQUINA'
                            ? 'Máquina'
                            : c.tipoColheita === 'MANUAL'
                            ? 'Manual'
                            : 'Varrição'}
                        </td>
                        <td className="px-4 py-2">
                          {c.quantidade} {c.unidadeOriginal}
                        </td>
                        <td className="px-4 py-2 font-bold text-primary">
                          {c.quantidadeLitros.toFixed(0)} L
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setChegadas(chegadas.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5 font-bold">
                      <td colSpan={3} className="px-4 py-2">
                        TOTAL
                      </td>
                      <td className="px-4 py-2 text-primary">
                        {totalLitros.toFixed(0)} L ({(totalLitros / 60).toFixed(1)} sacas)
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Resumo e Envio */}
        {chegadas.length > 0 && (
          <div className="card bg-light border-l-4 border-primary">
            <h3 className="font-semibold text-primary mb-2">Resumo do Lote</h3>
            <div className="space-y-1 text-sm">
              <p>
                <strong>Total de chegadas:</strong> {chegadas.length}
              </p>
              <p>
                <strong>Volume total:</strong> {totalLitros.toFixed(0)} litros ({(totalLitros / 60).toFixed(1)} sacas)
              </p>
              <p className="mt-3 text-xs text-gray-600">
                ℹ️ Um ID único será gerado automaticamente (ex: L2526-001)
              </p>
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-4">
          <button type="submit" disabled={submitting || chegadas.length === 0} className="btn btn-primary flex-1">
            {submitting ? 'Criando lote...' : 'Criar Lote'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={submitting}
            className="btn btn-outline flex-1"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
