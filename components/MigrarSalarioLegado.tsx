'use client'

import { useState } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface Preview {
  totalPeriodos: number
  totalFuncionarios: number
  totalASeremCriados: number
  totalPulados: number
  preview: any[]
  pulados: any[]
}

export function MigrarSalarioLegado({ onConcluido }: { onConcluido?: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [aplicando, setAplicando] = useState(false)
  const [resultado, setResultado] = useState<{ totalCriados: number; totalPulados: number } | null>(null)
  const [erro, setErro] = useState('')

  const handleAbrir = async () => {
    setAberto(true)
    setResultado(null)
    setErro('')
    setCarregando(true)
    try {
      const res = await fetch('/api/salarios-periodo/migrar-legado')
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao calcular migração')
        return
      }
      setPreview(data)
    } catch {
      setErro('Erro ao calcular migração')
    } finally {
      setCarregando(false)
    }
  }

  const handleAplicar = async () => {
    setAplicando(true)
    setErro('')
    try {
      const res = await fetch('/api/salarios-periodo/migrar-legado', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao aplicar migração')
        return
      }
      setResultado(data)
      setPreview(null)
      onConcluido?.()
    } catch {
      setErro('Erro ao aplicar migração')
    } finally {
      setAplicando(false)
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={handleAbrir}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
      >
        <RefreshCw className="w-4 h-4" />
        Migrar dados antigos pros períodos
      </button>
    )
  }

  return (
    <div className="card p-4 mb-4 border-2 border-primary/20">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-primary">Migrar dados antigos pros períodos cadastrados</h3>
        <button onClick={() => setAberto(false)} className="text-sm text-gray-500 hover:text-gray-700">
          Fechar
        </button>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        Copia os valores que já estavam salvos no Cadastro de Funcionário (salário, hora extra, jornada) pra dentro
        de cada período já cadastrado (Safra e Entressafra), como ponto de partida. Nunca sobrescreve um período que
        você já preencheu manualmente aqui.
      </p>

      {erro && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-3">{erro}</div>}

      {carregando && <p className="text-sm text-gray-500">Calculando...</p>}

      {resultado && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          Migração concluída: {resultado.totalCriados} registros criados
          {resultado.totalPulados > 0 && `, ${resultado.totalPulados} pulados (já tinham cadastro manual)`}.
        </div>
      )}

      {preview && !resultado && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              Serão criados <strong>{preview.totalASeremCriados}</strong> registros ({preview.totalFuncionarios}{' '}
              funcionários × {preview.totalPeriodos} períodos cadastrados). {preview.totalPulados} combinações já têm
              cadastro manual e serão puladas.
            </span>
          </div>

          {preview.preview.length > 0 && (
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Tipo</th>
                    <th className="px-2 py-1 text-left">Salário</th>
                    <th className="px-2 py-1 text-left">Hora Extra</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{p.tipoSalario || '—'}</td>
                      <td className="px-2 py-1">{p.salarioMensal ?? p.salarioDiaria ?? '—'}</td>
                      <td className="px-2 py-1">{p.valorHoraExtra ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.totalASeremCriados > preview.preview.length && (
                <p className="text-xs text-gray-500 p-2">
                  ... e mais {preview.totalASeremCriados - preview.preview.length} registros (mostrando só os
                  primeiros {preview.preview.length})
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleAplicar}
            disabled={aplicando || preview.totalASeremCriados === 0}
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
          >
            {aplicando ? 'Aplicando...' : `Confirmar e criar ${preview.totalASeremCriados} registros`}
          </button>
        </div>
      )}
    </div>
  )
}
