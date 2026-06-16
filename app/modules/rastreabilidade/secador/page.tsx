'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { ArrowRight, Zap, Clock } from 'lucide-react'

export default function SecadorPage() {
  const { data: session, status } = useSession()
  const [secadores, setSecadores] = useState<any[]>([])
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('TERREIRO')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const res = await fetch(`/api/lotes?status=${filtro}`)
      if (res.ok) {
        const data = await res.json()
        setLotes(data.data || [])
      }
      // Initialize 3 dryers
      setSecadores([
        { id: 1, nome: 'Secador 1', capacidade: 38000, usado: 0 },
        { id: 2, nome: 'Secador 2', capacidade: 38000, usado: 0 },
        { id: 3, nome: 'Secador 3', capacidade: 38000, usado: 0 },
      ])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
  }, [filtro])

  const handleRegistrarSecador = async (
    loteId: string,
    secadorId: number,
    umidadeEntrada: number
  ) => {
    const horaEntrada = prompt('Hora de entrada (HH:MM):', '08:00')
    if (!horaEntrada) return

    try {
      const res = await fetch('/api/etapas/secador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId,
          secadorId,
          umidadeEntrada,
          horaEntrada,
          responsavelId: session?.user?.id,
        }),
      })

      if (res.ok) {
        alert('Lote movido para Secador com sucesso')
        load()
      } else {
        alert('Erro ao registrar etapa')
      }
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  const lotesDisponiveis = lotes.filter((l: any) =>
    filtro === 'TERREIRO'
      ? l.statusAtual === 'TERREIRO'
      : l.statusAtual === 'SECADOR'
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Zap className="w-8 h-8" />
          Etapa 3: Secador Estático
        </h2>
        <p className="text-gray-600 mt-1">Gerencie a secagem estática dos lotes (38.000 L por secador)</p>
      </div>

      {/* Status dos Secadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {secadores.map((sec) => (
          <div key={sec.id} className="card">
            <h4 className="font-semibold text-lg mb-2">{sec.nome}</h4>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-600">Capacidade</p>
                <p className="font-bold text-lg">{sec.capacidade.toLocaleString('pt-BR')} L</p>
              </div>
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 transition-all"
                  style={{ width: `${(sec.usado / sec.capacidade) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600">
                {sec.usado.toLocaleString('pt-BR')} L / {sec.capacidade.toLocaleString('pt-BR')} L
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card">
        <h3 className="font-semibold mb-3">Filtros</h3>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        >
          <option value="TERREIRO">Lotes em Terreiro (prontos para Secador)</option>
          <option value="SECADOR">Lotes em Secador</option>
        </select>
      </div>

      {/* Lotes */}
      <div className="card">
        <h3 className="font-semibold mb-4">
          {filtro === 'TERREIRO' ? 'Lotes Prontos para Secador' : 'Lotes em Secador'}
        </h3>

        {lotesDisponiveis.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum lote disponível</p>
        ) : (
          <div className="space-y-3">
            {lotesDisponiveis.map((lote: any) => {
              const podeAlocar = secadores.some((s) => s.usado + lote.quantidadeTotal <= s.capacidade)

              return (
                <div key={lote.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-primary">{lote.identificador}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {lote.quantidadeTotal.toFixed(0)} L ({(lote.quantidadeTotal / 60).toFixed(1)} sacas)
                      </p>
                    </div>

                    {filtro === 'TERREIRO' && (
                      <div className="flex gap-2">
                        {podeAlocar ? (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                const sec = parseInt(e.target.value)
                                handleRegistrarSecador(
                                  lote.id,
                                  sec,
                                  lote.etapaTerreiro?.umidadeEntrada || 50
                                )
                              }
                            }}
                            className="border rounded px-3 py-2 text-sm"
                          >
                            <option value="">Alocar em Secador...</option>
                            {secadores
                              .filter((s) => s.usado + lote.quantidadeTotal <= s.capacidade)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.nome} ({(s.capacidade - s.usado).toLocaleString('pt-BR')} L livres)
                                </option>
                              ))}
                          </select>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
                            Sem capacidade
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-light border-l-4 border-primary">
        <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          ℹ️ Secagem Estática
        </h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>Capacidade:</strong> 38.000 L por secador</li>
          <li>• <strong>Umidade:</strong> De ~35% até 11-12%</li>
          <li>• <strong>Duração:</strong> 24-48 horas (depende da umidade inicial)</li>
          <li>• <strong>Sistema:</strong> 3 secadores estáticos disponíveis</li>
          <li>• <strong>Próxima etapa:</strong> Tulha de descanso</li>
        </ul>
      </div>
    </div>
  )
}
