'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Plus, Trash2, FileSpreadsheet, FileText, MessageSquare, Fuel, Pencil, Save, X } from 'lucide-react'
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

interface ConfiguracaoLembrete {
    lembreteTurmasTexto: string | null
    lembreteTurmasAtivo: boolean
}

export default function TurmasPage() {
    const { data: session, status } = useSession()
    const [diarias, setDiarias] = useState<DiariaTurma[]>([])
    const [talhoes, setTalhoes] = useState([])
    const [turmas, setTurmas] = useState([])
    const [tiposAtividade, setTiposAtividade] = useState<{id: number, nome: string}[]>([])
    const [loading, setLoading] = useState(true)
    const [carregandoFiltro, setCarregandoFiltro] = useState(false)
    const primeiraCargaFeita = useRef(false)
    const [filtroDataInicio, setFiltroDataInicio] = useState('')
    const [filtroDataFim, setFiltroDataFim] = useState('')
    const [filtroTalhao, setFiltroTalhao] = useState('')
    const [filtroTurma, setFiltroTurma] = useState('')
    const [filtroTipoAtividade, setFiltroTipoAtividade] = useState('')
    const [exportando, setExportando] = useState(false)

    const [config, setConfig] = useState<ConfiguracaoLembrete | null>(null)
    const [editingLembrete, setEditingLembrete] = useState(false)
    const [lembreteForm, setLembreteForm] = useState({ texto: '', ativo: false })
    const [savingLembrete, setSavingLembrete] = useState(false)

  const userRole = (session?.user as any)?.role || ''
    const podeAcessar = ['GESTOR', 'GERENTE'].includes(userRole)
    const isGestor = userRole === 'GESTOR' || userRole === 'GERENTE'

  useEffect(() => {
        if (status === 'unauthenticated') redirect('/login')
        if (status === 'authenticated' && !podeAcessar) redirect('/dashboard')
        if (status === 'authenticated') {
                loadTalhoes()
                loadTurmas()
                loadTiposAtividade()
                loadConfig()
                load()
        }
  }, [status])

  const loadTalhoes = async () => {
        try {
                const res = await fetch('/api/talhoes')
                if (res.ok) setTalhoes((await res.json()).data)
        } catch (err) { console.error(err) }
  }

  const loadConfig = async () => {
        try {
                const res = await fetch('/api/configuracoes')
                if (res.ok) {
                          const data = await res.json()
                          setConfig(data.data)
                }
        } catch (err) { console.error(err) }
  }

  const handleEditLembrete = () => {
        setLembreteForm({
                texto: config?.lembreteTurmasTexto || '',
                ativo: config?.lembreteTurmasAtivo || false,
        })
        setEditingLembrete(true)
  }

  const handleSaveLembrete = async () => {
        setSavingLembrete(true)
        try {
                const res = await fetch('/api/configuracoes', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                                    lembreteTurmasTexto: lembreteForm.texto,
                                    lembreteTurmasAtivo: lembreteForm.ativo,
                          }),
                })
                if (res.ok) {
                          await loadConfig()
                          setEditingLembrete(false)
                } else {
                          alert('Erro ao salvar lembrete')
                }
        } catch (err) {
                console.error(err)
                alert('Erro ao salvar lembrete')
        } finally {
                setSavingLembrete(false)
        }
  }

  const loadTurmas = async () => {
        try {
                const res = await fetch('/api/turmas?ativo=true')
                if (res.ok) setTurmas(await res.json())
        } catch (err) { console.error(err) }
  }

  const loadTiposAtividade = async () => {
        try {
                const res = await fetch('/api/tipos-atividade?ativo=true')
                if (res.ok) setTiposAtividade(await res.json())
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
                if (filtroTipoAtividade) params.append('tipoAtividade', filtroTipoAtividade)
                if (params.toString()) url += '?' + params.toString()
                const response = await fetch(url)
                if (!response.ok) throw new Error('Erro')
                const data = await response.json()
                setDiarias(data.data || [])
        } catch (err) {
                console.error(err)
        } finally {
                setLoading(false)
                setCarregandoFiltro(false)
                primeiraCargaFeita.current = true
        }
  }

  useEffect(() => {
        if (status === 'authenticated') {
                if (primeiraCargaFeita.current) {
                        setCarregandoFiltro(true)
                } else {
                        setLoading(true)
                }
                load()
        }
  }, [filtroDataInicio, filtroDataFim, filtroTalhao, filtroTurma, filtroTipoAtividade])

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
      // Linha de totais do período filtrado — mesmos números dos
      // cards abaixo da tabela em tela (Custo Total e Total de
      // Diárias), alinhados nas colunas Pessoas e Valor Total.
      const totalPessoasFormatado = totalPessoas % 1 === 0 ? totalPessoas : totalPessoas.toFixed(1)
      const totalRow = ws.addRow([
        '', '', '', '', '',
        `Total de Diárias: ${totalPessoasFormatado}`,
        '',
        `Custo Total: R$ ${custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      ])
      totalRow.eachCell((cell) => {
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
        cell.border = { top: { style: 'thin', color: { argb: 'FF9CA3AF' } } }
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
      // Linha de totais do período filtrado (rodapé da tabela) — mesmos
      // números dos cards abaixo da tabela em tela.
      const totalPessoasFormatado = totalPessoas % 1 === 0 ? totalPessoas : totalPessoas.toFixed(1)
      autoTable(doc, {
        head: [colunasExportacao],
        body: linhasExportacao(),
        foot: [[
          '', '', '', '', '',
          `Total de Diárias: ${totalPessoasFormatado}`,
          '',
          `Custo Total: R$ ${custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        ]],
        footStyles: {
          fillColor: [229, 231, 235],
          textColor: [17, 24, 39],
          fontStyle: 'bold',
          fontSize: 9,
        },
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
  // Arredonda pra 1 casa antes de checar se é inteiro, pra evitar
  // artefato de ponto flutuante (ex: 8.5 + 8.5 podendo virar
  // 17.000000000000002) na soma de valores fracionados.
  const totalPessoasRaw = diarias.reduce((acc, d) => acc + (d.quantidadePessoas || 0), 0)
  const totalPessoas = Math.round(totalPessoasRaw * 10) / 10

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

                        {isGestor ? (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            {editingLembrete ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Fuel className="w-5 h-5 text-amber-600 flex-shrink-0" />
                                  <span className="text-sm font-medium text-amber-800">Lembrete de Turmas</span>
                                </div>
                                <textarea
                                  value={lembreteForm.texto}
                                  onChange={(e) => setLembreteForm({ ...lembreteForm, texto: e.target.value })}
                                  className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm"
                                  rows={2}
                                  placeholder="Ex: não esqueça de descontar o diesel usado pelas turmas no pagamento semanal."
                                />
                                <label className="flex items-center gap-2 text-sm text-amber-800">
                                  <input
                                    type="checkbox"
                                    checked={lembreteForm.ativo}
                                    onChange={(e) => setLembreteForm({ ...lembreteForm, ativo: e.target.checked })}
                                  />
                                  Exibir lembrete para todos os usuários
                                </label>
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleSaveLembrete}
                                    disabled={savingLembrete}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                  >
                                    <Save className="w-4 h-4" />
                                    {savingLembrete ? 'Salvando...' : 'Salvar'}
                                  </button>
                                  <button
                                    onClick={() => setEditingLembrete(false)}
                                    disabled={savingLembrete}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50 transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <Fuel className="w-5 h-5 text-amber-600 flex-shrink-0" />
                                  {config?.lembreteTurmasAtivo && config?.lembreteTurmasTexto ? (
                                    <p className="text-sm text-amber-800">
                                      <strong>Lembrete:</strong> {config.lembreteTurmasTexto}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-amber-700 italic">Lembrete desativado</p>
                                  )}
                                </div>
                                <button
                                  onClick={handleEditLembrete}
                                  className="p-2 hover:bg-amber-100 rounded transition flex-shrink-0"
                                  title="Editar lembrete"
                                >
                                  <Pencil className="w-4 h-4 text-amber-700" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          config?.lembreteTurmasAtivo && config?.lembreteTurmasTexto && (
                            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                              <Fuel className="w-5 h-5 text-amber-600 flex-shrink-0" />
                              <p className="text-sm text-amber-800">
                                <strong>Lembrete:</strong> {config.lembreteTurmasTexto}
                              </p>
                            </div>
                          )
                        )}

                        <div className="card space-y-3">
                                <h3 className="font-semibold text-primary">Filtros</h3>
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                                          <select value={filtroTipoAtividade} onChange={(e) => setFiltroTipoAtividade(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                                                      <option value="">Todas as Atividades</option>
                                            {tiposAtividade.map((t: any) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                                          </select>
                                </div>
                        </div>

                        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden relative">
                                <div className="px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 flex items-center justify-between">
                                        <p className="text-sm font-semibold text-white">Diárias</p>
                                        <p className="text-xs text-green-100">{diarias.length} registro{diarias.length === 1 ? '' : 's'}</p>
                                </div>
                                {carregandoFiltro && (
                                        <div className="absolute inset-0 top-[49px] bg-white/60 flex items-start justify-center pt-8 z-10">
                                                <div className="spinner"></div>
                                        </div>
                                )}
                                <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                          <thead>
                                                      <tr className="text-left text-xs text-green-800 bg-green-50 border-b border-green-100">
                                                                    <th className="px-4 py-3 font-semibold">Data</th>
                                                                    <th className="px-4 py-3 font-semibold">Turma</th>
                                                                    <th className="px-4 py-3 font-semibold">Talhao</th>
                                                                    <th className="px-4 py-3 font-semibold">Safra</th>
                                                                    <th className="px-4 py-3 font-semibold">Atividade</th>
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
                                  diarias.map((d, i) => (
                                                    <tr key={d.id} className={'border-b border-gray-100 last:border-0 transition-colors hover:bg-green-50 ' + (i % 2 === 1 ? 'bg-gray-50' : '')}>
                                                                      <td className="px-4 py-3">{new Date(d.data).toLocaleDateString('pt-BR')}</td>
                                                                      <td className="px-4 py-3 font-medium">{d.turma?.nome}</td>
                                                                      <td className="px-4 py-3">{d.talhao?.nome}</td>
                                                                      <td className="px-4 py-3">{d.safra?.nome}</td>
                                                                      <td className="px-4 py-3">
                                                                                          <span className="inline-block text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">{d.tipoAtividade}</span>
                                                                      </td>
                                                                      <td className="px-4 py-3 text-right">{d.quantidadePessoas % 1 === 0 ? d.quantidadePessoas : d.quantidadePessoas.toFixed(1)}</td>
                                                                      <td className="px-4 py-3 text-right">R$ {Number(d.valorDiaria).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                                      <td className="px-4 py-3 text-right font-semibold text-green-800">R$ {Number(d.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
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
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5 shadow-sm text-white">
                                        <p className="text-xs uppercase tracking-wide text-green-100">Custo Total do Periodo Filtrado</p>
                                        <p className="text-3xl font-bold mt-2">R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="card">
                                        <p className="text-gray-600 text-sm">Total de Diárias do Periodo Filtrado</p>
                                        <p className="text-3xl font-bold text-primary mt-2">{totalPessoas % 1 === 0 ? totalPessoas : totalPessoas.toFixed(1)}</p>
                                </div>
                        </div>
                  </div>
                )
}
