'use client'

import { Coffee, Pencil, Trash2 } from 'lucide-react'

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
  isFolga?: boolean
  isFeriado?: boolean
  isFerias?: boolean
  isSemPeriodo?: boolean
  motivoFalta: string | null
  passouDiretoAlmoco: boolean
  // Horas do lançamento dentro do almoço (11h–12h); sem o campo = regra antiga (1h).
  almocoNoHorario?: number
  // Id do registro de atividade (dias de folga/férias sem registro não têm)
  registroId?: string | null
}

interface RegistroDiarioCardProps {
  dia: RegistroDiario
  pagamentoProporcionalDiario?: boolean
  // Quando informado e o dia tem registro, o cartão vira um botão que abre a edição.
  onEditar?: (registroId: string) => void
  // Quando informado e o dia tem registro, mostra a lixeira pra excluir o lançamento.
  onExcluir?: (dia: RegistroDiario) => void
  excluindo?: boolean
}

// "1h", "30min", "1h 15min"
const fmtCurto = (h: number) => {
  const total = Math.round(h * 60)
  const horas = Math.floor(total / 60)
  const minutos = total % 60
  if (horas && minutos) return `${horas}h ${minutos}min`
  return horas ? `${horas}h` : `${minutos}min`
}

const textoAlmoco = (dia: RegistroDiario) => {
  const noHorario = dia.almocoNoHorario ?? 1
  if (dia.passouDiretoAlmoco) return noHorario > 0 ? `+ ${fmtCurto(noHorario)} extra` : 'fora do almoço'
  return dia.descontoAlmoco > 0 ? `- ${fmtCurto(dia.descontoAlmoco)}` : 'sem desconto'
}

const fmtH = (h: number) => {
  const horas = Math.floor(h)
  const minutos = Math.round((h - horas) * 60)
  return `${horas}h ${minutos.toString().padStart(2, '0')}min`
}

export default function RegistroDiarioCard({ dia, pagamentoProporcionalDiario, onEditar, onExcluir, excluindo }: RegistroDiarioCardProps) {
  const editavel = !!(onEditar && dia.registroId)
  const excluivel = !!(onExcluir && dia.registroId)
  return (
    <div
      {...(editavel
        ? {
            role: 'button',
            tabIndex: 0,
            title: 'Clique para editar este registro',
            onClick: () => onEditar!(dia.registroId!),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onEditar!(dia.registroId!)
              }
            },
          }
        : {})}
      className={`group rounded-lg p-3 text-sm ${editavel ? 'cursor-pointer hover:ring-2 hover:ring-[#C98B52]/40 focus:outline-none focus:ring-2 focus:ring-[#C98B52]/60 transition-shadow' : ''} ${
        dia.isSemPeriodo
          ? 'bg-amber-50 border border-amber-200'
          : dia.isFalta
          ? 'bg-red-50 border border-red-100'
          : dia.isFolga
          ? 'bg-blue-50 border border-blue-100'
          : dia.horasExtras > 0
          ? 'bg-green-50 border border-green-100'
          : dia.horasDevidas > 0 && !pagamentoProporcionalDiario
          ? 'bg-orange-50 border border-orange-100'
          : 'bg-gray-50 border border-gray-100'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium flex items-center gap-1.5">
          {new Date(dia.data).toLocaleDateString('pt-BR', {
            weekday: 'short', day: '2-digit', month: '2-digit'
          })}
          {editavel && (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-400 group-hover:text-[#A86F3C]">
              <Pencil className="w-3 h-3" />
              <span className="hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity">editar</span>
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {dia.isSemPeriodo ? (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              ⚠️ Sem período cadastrado
            </span>
          ) : dia.isFalta ? (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              Falta {dia.motivoFalta ? `— ${dia.motivoFalta}` : ''}
            </span>
          ) : dia.isFerias ? (
            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
              Férias
            </span>
          ) : dia.isFeriado ? (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              Feriado{dia.horasExtras > 0 ? ` · +${fmtH(dia.horasExtras)} extras` : ''}
            </span>
          ) : dia.isFolga ? (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              Folga
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
          {excluivel && (
            <button
              type="button"
              onClick={(e) => {
                // Não abre a edição ao clicar na lixeira.
                e.stopPropagation()
                onExcluir!(dia)
              }}
              onKeyDown={(e) => e.stopPropagation()}
              disabled={excluindo}
              className="p-1.5 -my-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
              title="Excluir este lançamento"
              aria-label="Excluir este lançamento"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {!dia.isFalta && !dia.isFolga && !(dia.isSemPeriodo && !dia.horaEntrada) && (
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
            <span
              className={`font-medium ${dia.passouDiretoAlmoco && (dia.almocoNoHorario ?? 1) > 0 ? 'text-green-600' : 'text-gray-600'}`}
              title="Almoço: 11:00 às 12:00"
            >
              {textoAlmoco(dia)}
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
