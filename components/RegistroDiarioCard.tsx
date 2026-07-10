'use client'

import { Coffee } from 'lucide-react'

export interface RegistroDiario {
  data: string
  horaEntrada: string | null
  horaSaida: string | null
  horasBrutas: number
  descontoAlmoco: number
  horasTrabalhadas: number
  cargaContratual: number
  horasExtras: number
  horasDevidas: number
  isFalta: boolean
  motivoFalta: string | null
  passouDiretoAlmoco: boolean
}

interface RegistroDiarioCardProps {
  dia: RegistroDiario
  pagamentoProporcionalDiario?: boolean
}

const fmtH = (h: number) => {
  const horas = Math.floor(h)
  const minutos = Math.round((h - horas) * 60)
  return `${horas}h ${minutos.toString().padStart(2, '0')}min`
}

export default function RegistroDiarioCard({ dia, pagamentoProporcionalDiario }: RegistroDiarioCardProps) {
  return (
    <div
      className={`rounded-lg p-3 text-sm ${
        dia.isFalta
          ? 'bg-red-50 border border-red-100'
          : dia.horasExtras > 0
          ? 'bg-green-50 border border-green-100'
          : dia.horasDevidas > 0 && !pagamentoProporcionalDiario
          ? 'bg-orange-50 border border-orange-100'
          : 'bg-gray-50 border border-gray-100'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">
          {new Date(dia.data).toLocaleDateString('pt-BR', {
            weekday: 'short', day: '2-digit', month: '2-digit'
          })}
        </span>
        {dia.isFalta ? (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            Falta {dia.motivoFalta ? `— ${dia.motivoFalta}` : ''}
          </span>
        ) : dia.horasExtras > 0 ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            +{fmtH(dia.horasExtras)} extras
          </span>
        ) : dia.horasDevidas > 0 && !pagamentoProporcionalDiario ? (
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            -{fmtH(dia.horasDevidas)} devidas
          </span>
        ) : dia.horasDevidas > 0 && pagamentoProporcionalDiario ? (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {fmtH(dia.horasTrabalhadas)} trabalhadas
          </span>
        ) : (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            Normal
          </span>
        )}
      </div>

      {!dia.isFalta && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-gray-600">
          <div>
            <span className="block text-gray-400">Entrada</span>
            <span className="font-medium">{dia.horaEntrada || '—'}</span>
          </div>
          <div>
            <span className="block text-gray-400">Saída</span>
            <span className="font-medium">{dia.horaSaida || '—'}</span>
          </div>
          <div>
            <span className="block text-gray-400">Tempo bruto</span>
            <span className="font-medium">{fmtH(dia.horasBrutas)}</span>
          </div>
          <div>
            <span className="block text-gray-400 flex items-center gap-1">
              <Coffee className="w-3 h-3" /> Almoço
            </span>
            <span className={`font-medium ${dia.passouDiretoAlmoco ? 'text-green-600' : 'text-gray-600'}`}>
              {dia.passouDiretoAlmoco ? '+ 1h extra' : '- 1h'}
            </span>
          </div>
          <div>
            <span className="block text-gray-400">Carga contratual</span>
            <span className="font-medium">{fmtH(dia.cargaContratual)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
