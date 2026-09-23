'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

// Períodos de Safra/Entressafra (regime salarial) — fonte da verdade do
// cálculo dia a dia de salário/hora extra/carga horária (ver
// lib/regimeSalarial.ts). Antes ficava em Configurações; desde 23/09/2026
// fica na aba "Safra / Entressafra" da tela Cadastros → Safras.
// Independente das safras agronômicas (Safra 25/26 etc.).

interface PeriodoRegimeSalarial {
  id: string
  tipo: 'SAFRA' | 'ENTRESSAFRA'
  dataInicio: string
  dataFim: string
}

export function PeriodosRegimeSalarial() {
  const [periodos, setPeriodos] = useState<PeriodoRegimeSalarial[]>([])
  const [loadingPeriodos, setLoadingPeriodos] = useState(true)
  const [tipoAbrindoData, setTipoAbrindoData] = useState<'SAFRA' | 'ENTRESSAFRA' | null>(null)
  const [novoInicio, setNovoInicio] = useState('')
  const [novoFim, setNovoFim] = useState('')
  const [periodoError, setPeriodoError] = useState('')
  const [periodoSalvando, setPeriodoSalvando] = useState(false)

  useEffect(() => {
    loadPeriodos()
  }, [])

  const loadPeriodos = async () => {
    try {
      setLoadingPeriodos(true)
      const res = await fetch('/api/periodos-regime-salarial')
      if (res.ok) {
        const data = await res.json()
        setPeriodos(data.data || [])
      }
    } catch {
      console.error('Erro ao carregar períodos de Safra/Entressafra')
    } finally {
      setLoadingPeriodos(false)
    }
  }

  const handleAbrirDataPeriodo = (tipo: 'SAFRA' | 'ENTRESSAFRA') => {
    setTipoAbrindoData(tipo)
    setNovoInicio('')
    setNovoFim('')
    setPeriodoError('')
  }

  const handleSalvarPeriodo = async () => {
    if (!tipoAbrindoData || !novoInicio || !novoFim) return
    setPeriodoError('')
    setPeriodoSalvando(true)
    try {
      const res = await fetch('/api/periodos-regime-salarial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoAbrindoData, dataInicio: novoInicio, dataFim: novoFim }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPeriodoError(data.error || 'Erro ao cadastrar período')
        return
      }
      setTipoAbrindoData(null)
      setNovoInicio('')
      setNovoFim('')
      loadPeriodos()
    } catch {
      setPeriodoError('Erro ao cadastrar período')
    } finally {
      setPeriodoSalvando(false)
    }
  }

  const handleExcluirPeriodo = async (id: string) => {
    if (!confirm('Excluir esse período? Registros de atividade já lançados não são afetados, mas novos lançamentos nesses dias vão ficar bloqueados até cadastrar outro período.')) return
    try {
      const res = await fetch(`/api/periodos-regime-salarial/${id}`, { method: 'DELETE' })
      if (res.ok) loadPeriodos()
    } catch {
      console.error('Erro ao excluir período')
    }
  }

  return (
    <div className="card">
      <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg mb-4">
        <label className="block text-sm font-bold mb-2 text-amber-900">
          Períodos de Safra e Entressafra: Salário, Hora Extra e Carga Horária
        </label>
        <p className="text-xs text-amber-800 mb-3">
          Cada dia de cada Registro de Atividade usa automaticamente o regime do período em que aquele dia cai.
          Clique em "Safra" ou "Entressafra" pra cadastrar um novo período (início e fim). Dias fora de qualquer
          período cadastrado ficam bloqueados pra novos lançamentos até você cadastrar o período correspondente.
        </p>
        <div className="flex gap-3 mb-3">
          <button
            type="button"
            onClick={() => handleAbrirDataPeriodo('SAFRA')}
            className={`flex-1 px-4 py-2 rounded-lg border-2 font-medium transition ${
              tipoAbrindoData === 'SAFRA'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
            }`}
          >
            Safra
          </button>
          <button
            type="button"
            onClick={() => handleAbrirDataPeriodo('ENTRESSAFRA')}
            className={`flex-1 px-4 py-2 rounded-lg border-2 font-medium transition ${
              tipoAbrindoData === 'ENTRESSAFRA'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            Entressafra
          </button>
        </div>

        {tipoAbrindoData && (
          <div className="p-3 bg-white border rounded-lg mb-3">
            <p className="text-sm font-medium mb-2">
              Novo período de {tipoAbrindoData === 'SAFRA' ? 'Safra' : 'Entressafra'}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Início</label>
                <input
                  type="date"
                  value={novoInicio}
                  onChange={(e) => setNovoInicio(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Fim</label>
                <input
                  type="date"
                  value={novoFim}
                  onChange={(e) => setNovoFim(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            {periodoError && (
              <p className="text-xs text-red-600 mb-2">{periodoError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSalvarPeriodo}
                disabled={!novoInicio || !novoFim || periodoSalvando}
                className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
              >
                {periodoSalvando ? 'Salvando...' : 'Cadastrar período'}
              </button>
              <button
                type="button"
                onClick={() => setTipoAbrindoData(null)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loadingPeriodos ? (
          <p className="text-xs text-amber-800">Carregando períodos cadastrados...</p>
        ) : periodos.length === 0 ? (
          <p className="text-xs text-amber-800">Nenhum período cadastrado ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {periodos.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.tipo === 'SAFRA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {p.tipo === 'SAFRA' ? 'Safra' : 'Entressafra'}
                  </span>
                  <span className="text-gray-700">
                    {new Date(p.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a{' '}
                    {new Date(p.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleExcluirPeriodo(p.id)}
                  className="text-red-500 hover:text-red-700"
                  title="Excluir período"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        Estes períodos definem só o regime de cálculo de salário, hora extra e carga horária. As safras
        agronômicas (ciclo de talhões/insumos, ex: Safra 25/26) ficam na aba "Safras", independentes daqui.
      </div>
    </div>
  )
}
