'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { FileText, Download, AlertCircle } from 'lucide-react'

export default function FolhaPagamentoPage() {
  const { data: session, status } = useSession()
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role !== 'GESTOR' && session?.user?.role !== 'GERENTE') {
      redirect('/modules')
    }
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const res = await fetch(`/api/painel/folha-pagamento?mes=${mes}`)
      if (res.ok) {
        const data = await res.json()
        setFuncionarios(data.data.funcionarios)
        setWarning(data.data.aviso)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
  }, [mes, status])

  const handleExportarExcel = async () => {
    if (warning) {
      alert('Não é possível exportar com horas extras pendentes no período')
      return
    }

    try {
      const res = await fetch(`/api/painel/folha-pagamento/exportar?mes=${mes}&formato=xlsx`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `folha_pagamento_${mes}.xlsx`
        a.click()
        window.URL.revokeObjectURL(url)
        alert('Arquivo Excel exportado com sucesso!')
      }
    } catch (err) {
      alert('Erro ao exportar')
    }
  }

  const handleExportarPDF = async () => {
    if (warning) {
      alert('Não é possível exportar com horas extras pendentes no período')
      return
    }

    try {
      const res = await fetch(`/api painel/folha-pagamento/exportar?mes=${mes}&formato=pdf`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `folha_pagamento_${mes}.pdf`
        a.click()
        window.URL.revokeObjectURL(url)
        alert('Arquivo PDF exportado com sucesso!')
      }
    } catch (err) {
      alert('Erro ao exportar')
    }
  }

  const handleEnviarEmail = () => {
    const emailBody = `Segue em anexo a folha de pagamento referente a ${mes}`
    const mailtoLink = `mailto:?subject=Folha de Pagamento ${mes}&body=${encodeURIComponent(emailBody)}`
    window.location.href = mailtoLink
  }

  const handleEnviarWhatsApp = () => {
    const mensagem = `Olá! Segue a folha de pagamento referente a ${mes}. Acesse o sistema para mais detalhes.`
    const waLink = `https://wa.me/?text=${encodeURIComponent(mensagem)}`
    window.open(waLink, '_blank')
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  const totalBruto = funcionarios.reduce((sum, f) => sum + f.salarioBase + f.horasExtras, 0)
  const totalDescontos = funcionarios.reduce((sum, f) => sum + f.descontos, 0)
  const totalLiquido = funcionarios.reduce((sum, f) => sum + f.liquido, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <FileText className="w-8 h-8" />
          Folha de Pagamento
        </h1>
        <p className="text-gray-600 mt-1">Detalhamento de salários, extras e descontos</p>
      </div>

      {/* Aviso de Horas Extras Pendentes */}
      {warning && (
        <div className="card bg-red-50 border-l-4 border-red-500 flex gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">{warning}</p>
            <p className="text-sm text-red-700 mt-1">Aprove as horas extras antes de exportar a folha</p>
          </div>
        </div>
      )}

      {/* Filtro e Exportação */}
      <div className="card space-y-4">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <label className="text-sm font-semibold">Mês/Ano:</label>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="border rounded px-3 py-2 mt-1"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportarExcel}
              disabled={!!warning}
              className={`btn ${warning ? 'btn-outline opacity-50' : 'btn-primary'} flex items-center gap-2 text-sm`}
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={handleExportarPDF}
              disabled={!!warning}
              className={`btn ${warning ? 'btn-outline opacity-50' : 'btn-secondary'} flex items-center gap-2 text-sm`}
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={handleEnviarEmail}
              disabled={!!warning}
              className={`btn ${warning ? 'btn-outline opacity-50' : 'btn-outline'} flex items-center gap-2 text-sm`}
              title="Enviar por e-mail"
            >
              ✉️ Email
            </button>
            <button
              onClick={handleEnviarWhatsApp}
              disabled={!!warning}
              className={`btn ${warning ? 'btn-outline opacity-50' : 'btn-outline'} flex items-center gap-2 text-sm`}
              title="Enviar por WhatsApp"
            >
              💬 WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Folha */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Funcionário</th>
              <th className="px-4 py-3 text-right font-semibold">Dias Trab.</th>
              <th className="px-4 py-3 text-right font-semibold">Salário Base</th>
              <th className="px-4 py-3 text-right font-semibold">Horas Extras</th>
              <th className="px-4 py-3 text-right font-semibold">Vales</th>
              <th className="px-4 py-3 text-right font-semibold">Descontos</th>
              <th className="px-4 py-3 text-right font-semibold">Líquido</th>
              <th className="px-4 py-3 text-center font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody>
            {funcionarios.map((func) => (
              <tr key={func.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{func.nome}</td>
                <td className="px-4 py-3 text-right">{func.diasTrabalhados}</td>
                <td className="px-4 py-3 text-right">R$ {func.salarioBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-orange-600 font-semibold">
                  + R$ {func.horasExtras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right text-red-600">
                  - R$ {func.vales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right text-red-600">
                  - R$ {func.descontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right font-bold text-green-600">
                  R$ {func.liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => window.location.href = `/modules/painel/folha-pagamento/${func.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Detalhes
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-primary/5 font-bold">
              <td colSpan={2} className="px-4 py-3">TOTAL</td>
              <td className="px-4 py-3 text-right">R$ {totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td colSpan={2}></td>
              <td className="px-4 py-3 text-right">R$ {totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-right text-green-600">
                R$ {totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Informações Importantes */}
      <div className="card bg-light border-l-4 border-primary">
        <h3 className="font-semibold text-primary mb-3">ℹ️ Cálculos da Folha</h3>
        <ul className="text-sm space-y-2 text-gray-700">
          <li>• <strong>Salário Base:</strong> (Salário ÷ Horas Úteis do Mês) × Dias Trabalhados</li>
          <li>• <strong>Horas Extras:</strong> Valor hora extra × horas aprovadas no período</li>
          <li>• <strong>Vales:</strong> Lançados neste mês (debitados do salário)</li>
          <li>• <strong>Descontos:</strong> Saldo negativo do banco de horas</li>
          <li>• <strong>Líquido:</strong> Base + Extras - Vales - Descontos</li>
          <li>• <strong>Restrição:</strong> Não pode exportar com horas extras pendentes</li>
        </ul>
      </div>
    </div>
  )
}
