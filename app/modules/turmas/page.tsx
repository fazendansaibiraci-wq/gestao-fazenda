'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus, Trash2, FileSpreadsheet, FileText, MessageSquare, Fuel } from 'lucide-react'
import { redirect } from 'next/navigation'

interface DiariaTurma {
    id: string
    data: string
    turma: { nome: string }
    quantidadePessoas: number
    tipoAtividade: string
    valorDiaria: number
    valorTotal: number
    observacao?: string
    talhao: { nome: string }
    safra: { nome: string }
    criadoPor?: { name: string }
}

export default function TurmasPage() {
    const { data: session, status } = useSession()
    const [diarias, setDiarias] = useState<DiariaTurma[]>([])
    const [talhoes, setTalhoes] = useState([])
    const [turmas, setTurmas] = useState([])
    const [loading, setLoading] = useState(true)
    const [filtroDataInicio, setFiltroDataInicio] = useState('')
    const [filtroDataFim, setFiltroDataFim] = useState('')
    const [filtroTalhao, setFiltroTalhao] = useState('')
    const [filtroTurma, setFiltroTurma] = useState('')
    const [exportando, setExportando] = useState(false)

  const userRole = (session?.user as any)?.role || ''
    const podeAcessar = ['GESTOR', 'GERENTE'].includes(userRole)

  useEffect(() => {
        if (status === 'unauthenticated') redirect('/login')
        if (status === 'authenticated' && !podeAcessar) redirect('/dashboard')
        if (status === 'authenticated') {
                loadTalhoes()
                loadTurmas()
                load()
        }
  }, [status])

  const loadTalhoes = async () => {
        try {
                const res = await fetch('/api/talhoes')
                if (res.ok) setTalhoes((await res.json()).data)
        } catch (err) { console.error(err) }
  }

  const loadTurmas = async () => {
        try {
                const res = await fetch('/api/turmas?ativo=true')
                if (res.ok) setTurmas(await res.json())
        } catch (err) { console.error(err) }
  }

  const load = async () => {
        try {
                let url = '/api/diarias-turma'
                const params = new URLSearchParams()
                if (filtroDataInicio) params.append('dataInicio', filtroDataInicio)
                if (filtroDataFim) params.append('dataFim', filtroDataFim)
                if (filtroTalhao) params.append('talhaoId', filtroTalhao)
                if (filtroTurma) params.append('turmaId', filtroTurma)
                if (params.toString()) url += '?' + params.toString()
                const response = await fetch(url)
                if (!response.ok) throw new Error('Erro')
                const data = await response.json()
                setDiarias(data.data || [])
        } catch (err) {
                console.error(err)
        } finally {
                setLoading(false)
        }
  }

  useEffect(() => {
        if (status === 'authenticated') {
                setLoading(true)
                load()
        }
  }, [filtroDataInicio, filtroDataFim, filtroTalhao, filtroTurma])

  const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta diaria de turma?')) return
        try {
                const res = await fetch(`/api/diarias-turma/${id}`, { method: 'DELETE' })
                if (!res.ok) {
                          const data = await res.json()
                          throw new Error(data.error || 'Erro ao excluir')
                }
                load()
        } catch (err) {
                alert(err instanceof Error ? err.message : 'Erro ao excluir')
        }
  }

  const colunasExportacao = ['Data', 'Turma', 'Talhão', 'Safra', 'Atividade', 'Pessoas', 'Valor Diária', 'Valor Total']
  const linhasExportacao = () => diarias.map((d) => [
    new Date(d.data).toLocaleDateString('pt-BR'),
    d.turma?.nome || '',
    d.talhao?.nome || '',
    d.safra?.nome || '',
    d.tipoAtividade || '',
    d.quantidadePessoas,
    Number(d.valorDiaria).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    Number(d.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  ])
  const exportarExcel = async () => {
    setExportando(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Gestão Fazenda'
      wb.created = new Date()
      const ws = wb.addWorksheet('Turmas')
      const headerRow = ws.addRow(colunasExportacao)
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2d6a4f' } }
        cell.alignment = { horizontal: 'center' }
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } }
      })
      linhasExportacao().forEach((linha, idx) => {
        const row = ws.addRow(linha)
        if (idx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7F4' } }
          })
        }
      })
      ws.columns.forEach((col) => {
        let max = 12
        col.eachCell?.({ includeEmpty: false }, (cell) => {
          const len = cell.value ? String(cell.value).length : 0
          if (len > max) max = len
        })
        col.width = Math.min(max + 4, 40)
      })
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `turmas_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Erro ao exportar Excel')
    } finally {
      setExportando(false)
    }
  }
  const exportarPDF = async () => {
    setExportando(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape' })
      const dataHoje = new Date().toLocaleDateString('pt-BR')
      doc.setFontSize(16)
      doc.setTextColor(45, 106, 79)
      doc.text('Gestão Fazenda — Turmas', 14, 16)
      doc.setFontSize(11)
      doc.setTextColor(100)
      doc.text(`Diárias de turmas de diaristas   |   Gerado em: ${dataHoje}`, 14, 23)
      autoTable(doc, {
        head: [colunasExportacao],
        body: linhasExportacao(),
        startY: 28,
        headStyles: {
          fillColor: [45, 106, 79],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 247, 244] },
        styles: { cellPadding: 3 },
        margin: { left: 14, right: 14 },
      })
      doc.save(`turmas_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err) {
      console.error(err)
      alert('Erro ao exportar PDF')
    } finally {
      setExportando(false)
    }
  }

  const custoTotal = diarias.reduce((acc, d) => acc + (d.valorTotal || 0), 0)

  if (status === 'loading' || loading) {
        return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
          }

            return (
                  <div className="space-y-6">
                        <div className="flex items-center justify-between">
                                <div>
                                          <h1 className="text-3xl font-bold text-primary">Turmas</h1>
                                          <p className="text-gray-600 mt-1">Diarias de turmas de diaristas</p>
                                </div>
                                <div className="flex items-center gap-2">
                                          <button
                                            onClick={exportarExcel}
                                            disabled={exportando || diarias.length === 0}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
                                          >
                                            <FileSpreadsheet className="w-4 h-4" />
                                            {exportando ? 'Exportando...' : 'Excel'}
                                          </button>
                                          <button
                                            onClick={exportarPDF}
                                            disabled={exportando || diarias.length === 0}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                                          >
                                            <FileText className="w-4 h-4" />
                                            {exportando ? 'Exportando...' : 'PDF'}
                                          </button>
                                          <Link href="/modules/turmas/nova">
                                                    <button className="btn btn-primary">
                                                                <Plus className="w-5 h-5" />
                                                                Nova Diaria
                                                    </button>
                                          </Link>
                                </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <Fuel className="w-5 h-5 text-amber-600 flex-shrink-0" />
                          <p className="text-sm text-amber-800">
                            <strong>Lembrete:</strong> não esqueça de descontar o diesel usado pelas turmas no pagamento semanal.
                          </p>
                        </div>

                        <div className="card space-y-3">
                                <h3 className="font-semibold text-primary">Filtros</h3>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                          <div>
                                                      <label className="block text-xs text-gray-500 mb-1">Data Inicial</label>
                                                      <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-full" />
                                          </div>
                                          <div>
                                                      <label className="block text-xs text-gray-500 mb-1">Data Final</label>
                                                      <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-full" />
                                          </div>
                                          <select value={filtroTalhao} onChange={(e) => setFiltroTalhao(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                                                      <option value="">Todos os Talhoes</option>
                                            {talhoes.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                                          </select>
                                          <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                                                      <option value="">Todas as Turmas</option>
                                            {turmas.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                                          </select>
                                </div>
                        </div>

                        <div className="card overflow-x-auto">
                                <table className="w-full text-sm">
                                          <thead>
                                                      <tr className="border-b bg-gray-50">
                                                                    <th className="px-4 py-3 text-left font-semibold">Data</th>
                                                                    <th className="px-4 py-3 text-left font-semibold">Turma</th>
                                                                    <th className="px-4 py-3 text-left font-semibold">Talhao</th>
                                                                    <th className="px-4 py-3 text-left font-semibold">Safra</th>
                                                                    <th className="px-4 py-3 text-left font-semibold">Atividade</th>
                                                                    <th className="px-4 py-3 text-right font-semibold">Pessoas</th>
                                                                    <th className="px-4 py-3 text-right font-semibold">Valor Diaria</th>
                                                                    <th className="px-4 py-3 text-right font-semibold">Valor Total</th>
                                                                    <th className="px-4 py-3 text-center font-semibold">Obs</th>
                                                                    <th className="px-4 py-3 text-right font-semibold">Acoes</th>
                                                      </tr>
                                          </thead>
                                          <tbody>
                                            {diarias.length === 0 ? (
                                  <tr>
                                                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                                                                    Nenhuma diaria de turma registrada
                                                  </td>
                                  </tr>
                                ) : (
                                  diarias.map((d) => (
                                                    <tr key={d.id} className="border-b hover:bg-gray-50">
                                                                      <td className="px-4 py-3">{new Date(d.data).toLocaleDateString('pt-BR')}</td>
                                                                      <td className="px-4 py-3 font-medium">{d.turma?.nome}</td>
                                                                      <td className="px-4 py-3">{d.talhao?.nome}</td>
                                                                      <td className="px-4 py-3">{d.safra?.nome}</td>
                                                                      <td className="px-4 py-3 text-gray-600">{d.tipoAtividade}</td>
                                                                      <td className="px-4 py-3 text-right">{d.quantidadePessoas}</td>
                                                                      <td className="px-4 py-3 text-right">R$ {Number(d.valorDiaria).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                                      <td className="px-4 py-3 text-right font-semibold">R$ {Number(d.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                                      <td className="px-4 py-3 text-center">
                                                                                          {d.observacao && (
                                                                                              <span title={d.observacao}>
                                                                                                  <MessageSquare className="w-4 h-4 text-blue-500 inline-block" />
                                                                                              </span>
                                                                                          )}
                                                                      </td>
                                                                      <td className="px-4 py-3 text-right">
                                                                                          <div className="flex items-center justify-end gap-2">
                                                                                                                <Link href={`/modules/turmas/${d.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Editar</Link>
                                                                                                                <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors" title="Excluir">
                                                                                                                                        <Trash2 className="w-4 h-4" />
                                                                                                                  </button>
                                                                                            </div>
                                                                      </td>
                                                    </tr>
                                                  ))
                                )}
                                          </tbody>
                                </table>
                        </div>

                        <div className="card">
                                <p className="text-gray-600 text-sm">Custo Total do Periodo Filtrado</p>
                                <p className="text-3xl font-bold text-primary mt-2">R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                  </div>
                )
}
