'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { BarChart3, Leaf, DollarSign, ClipboardList, TrendingUp, Filter, FileSpreadsheet, FileText } from 'lucide-react'

export default function RelatoriosPage() {
  const { data: session } = useSession()
  const [aba, setAba] = useState('consumo')
  const [registros, setRegistros] = useState<any[]>([])
  const [talhoes, setTalhoes] = useState<any[]>([])
  const [safras, setSafras] = useState<any[]>([])
  const [tiposAtividade, setTiposAtividade] = useState<{ id: string; nome: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)

  const [filtros, setFiltros] = useState({
    safraId: '',
    talhaoId: '',
    dataInicio: '',
    dataFim: '',
    tipoAtividade: '',
  })

  useEffect(() => {
    loadDados()
  }, [])

  const loadDados = async () => {
    try {
      setLoading(true)
      const [regRes, talRes, safRes, tipRes] = await Promise.all([
        fetch('/api/registros-atividade'),
        fetch('/api/talhoes'),
        fetch('/api/safras'),
        fetch('/api/tipos-atividade?ativo=true'),
      ])
      if (regRes.ok) setRegistros((await regRes.json()).data || [])
      if (talRes.ok) setTalhoes((await talRes.json()).data || [])
      if (safRes.ok) setSafras((await safRes.json()).data || [])
      if (tipRes.ok) setTiposAtividade(await tipRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const registrosFiltrados = registros.filter(r => {
    if (filtros.safraId && r.safraId !== filtros.safraId) return false
    if (filtros.talhaoId && r.talhaoId !== filtros.talhaoId) return false
    if (filtros.tipoAtividade && r.tipoAtividade !== filtros.tipoAtividade) return false
    if (filtros.dataInicio && new Date(r.data) < new Date(filtros.dataInicio)) return false
    if (filtros.dataFim && new Date(r.data) > new Date(filtros.dataFim)) return false
    return true
  })

  const agruparPor = (campo: string) => {
    const grupos: Record<string, any[]> = {}
    registrosFiltrados.forEach(r => {
      const chave = r[campo] || 'Não informado'
      if (!grupos[chave]) grupos[chave] = []
      grupos[chave].push(r)
    })
    return grupos
  }

  const calcularHoras = (regs: any[]) =>
    regs.reduce((acc, r) => acc + (r.horasCalculadas || 0), 0).toFixed(1)

  const calcularBombas = (regs: any[]) =>
    regs.reduce((acc, r) => acc + (r.totalBombas || 0), 0)

  const calcularHorasMaquina = (regs: any[]) =>
    regs.reduce((acc, r) => acc + (r.horasMaquina || 0), 0).toFixed(1)

  const getTalhaoNome = (id: string) => talhoes.find(t => t.id === id)?.nome || id
  const getSafraNome = (id: string) => safras.find(s => s.id === id)?.nome || id
  const getTipoLabel = (tipo: string) => tiposAtividade.find(t => t.nome === tipo)?.nome || tipo

  const abas = [
    { id: 'consumo', label: 'Consumo de Produtos', icon: Leaf },
    { id: 'historico', label: 'Histórico de Aplicações', icon: ClipboardList },
    { id: 'agronomico', label: 'Relatório Agronômico', icon: BarChart3 },
    { id: 'operacional', label: 'Indicadores Operacionais', icon: TrendingUp },
    { id: 'custos', label: 'Custos', icon: DollarSign },
  ]

  const getNomeAba = () => abas.find(a => a.id === aba)?.label || aba

  // ─── Dados por aba para exportação ───────────────────────────────────────

  const getDadosExportacao = () => {
    switch (aba) {
      case 'consumo':
        return {
          sheets: [
            {
              nome: 'Consumo por Talhão',
              colunas: ['Talhão', 'Atividades', 'Total Bombas', 'Qtd Adubo (kg)', 'Qtd Corretivo (ton)'],
              linhas: Object.entries(agruparPor('talhaoId')).map(([id, regs]) => [
                getTalhaoNome(id),
                regs.length,
                calcularBombas(regs),
                regs.reduce((a, r) => a + (r.quantidadeAdubo || 0), 0).toFixed(2),
                regs.reduce((a, r) => a + (r.quantidadeCorretivo || 0), 0).toFixed(2),
              ]),
            },
            {
              nome: 'Consumo por Atividade',
              colunas: ['Tipo de Atividade', 'Registros', 'Total Bombas', 'Horas Homem'],
              linhas: Object.entries(agruparPor('tipoAtividade')).map(([tipo, regs]) => [
                getTipoLabel(tipo),
                regs.length,
                calcularBombas(regs),
                `${calcularHoras(regs)}h`,
              ]),
            },
          ],
        }
      case 'historico':
        return {
          sheets: [
            {
              nome: 'Histórico de Aplicações',
              colunas: ['Data', 'Talhão', 'Safra', 'Atividade', 'Responsável', 'Bombas', 'Horas Homem', 'Implemento'],
              linhas: registrosFiltrados.map(r => [
                new Date(r.data).toLocaleDateString('pt-BR'),
                r.talhao?.nome || '-',
                r.safra?.nome || '-',
                getTipoLabel(r.tipoAtividade),
                r.funcionario?.name || '-',
                r.totalBombas || '-',
                r.horasCalculadas ? `${r.horasCalculadas.toFixed(1)}h` : '-',
                r.implementoUtilizado || '-',
              ]),
            },
          ],
        }
      case 'agronomico':
        return {
          sheets: Object.entries(agruparPor('talhaoId')).map(([id, regs]) => ({
            nome: getTalhaoNome(id).substring(0, 31),
            colunas: ['Data', 'Atividade', 'Bombas', 'Adubo', 'Operador', 'Máquina'],
            linhas: regs
              .sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime())
              .map((r: any) => [
                new Date(r.data).toLocaleDateString('pt-BR'),
                getTipoLabel(r.tipoAtividade),
                r.totalBombas || '-',
                r.quantidadeAdubo ? `${r.quantidadeAdubo}kg` : '-',
                r.funcionario?.name || '-',
                r.maquina?.nome || '-',
              ]),
          })),
        }
      case 'operacional':
        return {
          sheets: [
            {
              nome: 'Desempenho por Operador',
              colunas: ['Operador', 'Atividades', 'Horas Homem', 'Média h/atividade', 'Faltas'],
              linhas: Object.entries(
                registrosFiltrados.reduce((acc: any, r) => {
                  const nome = r.funcionario?.name || 'Desconhecido'
                  if (!acc[nome]) acc[nome] = []
                  acc[nome].push(r)
                  return acc
                }, {})
              ).map(([nome, regs]: any) => [
                nome,
                regs.length,
                `${calcularHoras(regs)}h`,
                `${regs.length > 0 ? (parseFloat(calcularHoras(regs)) / regs.length).toFixed(1) : 0}h`,
                regs.filter((r: any) => r.isFalta).length,
              ]),
            },
            {
              nome: 'Desempenho por Equipamento',
              colunas: ['Máquina', 'Usos', 'Horas Homem', 'Implemento mais usado'],
              linhas: Object.entries(
                registrosFiltrados
                  .filter((r: any) => r.maquinaId)
                  .reduce((acc: any, r: any) => {
                    const nome = r.maquina?.nome || r.maquinaId
                    if (!acc[nome]) acc[nome] = []
                    acc[nome].push(r)
                    return acc
                  }, {})
              ).map(([nome, regs]: any) => {
                const implementos = regs.map((r: any) => r.implementoUtilizado).filter(Boolean)
                const maisUsado = implementos.length > 0
                  ? implementos.sort((a: string, b: string) =>
                      implementos.filter((v: string) => v === b).length - implementos.filter((v: string) => v === a).length
                    )[0]
                  : '-'
                return [nome, regs.length, `${calcularHorasMaquina(regs)}h`, maisUsado]
              }),
            },
          ],
        }
      case 'custos':
        return {
          sheets: [
            {
              nome: 'Custos por Talhão',
              colunas: ['Talhão', 'Atividades', 'Horas Homem', 'Horas Máquina', 'Total Bombas'],
              linhas: Object.entries(agruparPor('talhaoId')).map(([id, regs]) => [
                getTalhaoNome(id),
                regs.length,
                `${calcularHoras(regs)}h`,
                `${calcularHorasMaquina(regs)}h`,
                calcularBombas(regs),
              ]),
            },
            {
              nome: 'Resumo por Safra',
              colunas: ['Safra', 'Total Atividades', 'Horas Homem', 'Horas Máquina', 'Total Bombas'],
              linhas: Object.entries(agruparPor('safraId')).map(([id, regs]) => [
                getSafraNome(id),
                regs.length,
                `${calcularHoras(regs)}h`,
                `${calcularHorasMaquina(regs)}h`,
                calcularBombas(regs),
              ]),
            },
          ],
        }
      default:
        return { sheets: [] }
    }
  }

  // ─── Exportar Excel ───────────────────────────────────────────────────────

  const exportarExcel = async () => {
    setExportando(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Gestão Fazenda'
      wb.created = new Date()

      const { sheets } = getDadosExportacao()

      sheets.forEach(sheet => {
        const ws = wb.addWorksheet(sheet.nome)

        // Cabeçalho
        const headerRow = ws.addRow(sheet.colunas)
        headerRow.eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2d6a4f' } }
          cell.alignment = { horizontal: 'center' }
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
          }
        })

        // Dados
        sheet.linhas.forEach((linha, idx) => {
          const row = ws.addRow(linha)
          if (idx % 2 === 1) {
            row.eachCell(cell => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7F4' } }
            })
          }
        })

        // Auto-width
        ws.columns.forEach(col => {
          let max = 12
          col.eachCell?.({ includeEmpty: false }, cell => {
            const len = cell.value ? String(cell.value).length : 0
            if (len > max) max = len
          })
          col.width = Math.min(max + 4, 40)
        })
      })

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio_${aba}_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Erro ao exportar Excel')
    } finally {
      setExportando(false)
    }
  }

  // ─── Exportar PDF ─────────────────────────────────────────────────────────

  const exportarPDF = async () => {
    setExportando(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'landscape' })
      const { sheets } = getDadosExportacao()
      const dataHoje = new Date().toLocaleDateString('pt-BR')

      sheets.forEach((sheet, idx) => {
        if (idx > 0) doc.addPage()

        // Título
        doc.setFontSize(16)
        doc.setTextColor(45, 106, 79)
        doc.text(`Gestão Fazenda — ${getNomeAba()}`, 14, 16)

        doc.setFontSize(11)
        doc.setTextColor(100)
        doc.text(`${sheet.nome}   |   Gerado em: ${dataHoje}`, 14, 23)

        autoTable(doc, {
          head: [sheet.colunas],
          body: sheet.linhas,
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
      })

      doc.save(`relatorio_${aba}_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err) {
      console.error(err)
      alert('Erro ao exportar PDF')
    } finally {
      setExportando(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Relatórios</h1>
        <p className="text-gray-600 mt-1">Análises e indicadores da fazenda</p>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-primary">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="form-group">
            <label>Safra</label>
            <select value={filtros.safraId} onChange={e => setFiltros(p => ({ ...p, safraId: e.target.value }))}>
              <option value="">Todas</option>
              {safras.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Talhão</label>
            <select value={filtros.talhaoId} onChange={e => setFiltros(p => ({ ...p, talhaoId: e.target.value }))}>
              <option value="">Todos</option>
              {talhoes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Tipo de Atividade</label>
            <select value={filtros.tipoAtividade} onChange={e => setFiltros(p => ({ ...p, tipoAtividade: e.target.value }))}>
              <option value="">Todos</option>
              {tiposAtividade.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Data Início</label>
            <input type="date" value={filtros.dataInicio} onChange={e => setFiltros(p => ({ ...p, dataInicio: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Data Fim</label>
            <input type="date" value={filtros.dataFim} onChange={e => setFiltros(p => ({ ...p, dataFim: e.target.value }))} />
          </div>
        </div>
       <div className="flex justify-between items-center mt-2">
          <p className="text-sm text-gray-500">{registrosFiltrados.length} registros encontrados</p>
          <div className="flex gap-2">
            <button
              onClick={() => setFiltros({ safraId: '', talhaoId: '', dataInicio: '', dataFim: '', tipoAtividade: '' })}
              className="btn btn-outline btn-sm"
            >
              Limpar Filtros
            </button>
            <button
              onClick={loadDados}
              className="btn btn-primary btn-sm"
            >
              Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* Abas + Botões de exportação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {abas.map(a => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                aba === a.id ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <a.icon className="w-4 h-4" />
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            disabled={exportando || registrosFiltrados.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exportando ? 'Exportando...' : 'Excel'}
          </button>
          <button
            onClick={exportarPDF}
            disabled={exportando || registrosFiltrados.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            {exportando ? 'Exportando...' : 'PDF'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-gray-500">Carregando dados...</div>
      ) : registrosFiltrados.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">Nenhum registro encontrado com os filtros selecionados.</div>
      ) : (
        <>
          {aba === 'consumo' && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">Consumo por Talhão</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Talhão</th>
                      <th className="text-left py-2 px-3 text-gray-600">Atividades</th>
                      <th className="text-left py-2 px-3 text-gray-600">Total Bombas</th>
                      <th className="text-left py-2 px-3 text-gray-600">Qtd Adubo (kg)</th>
                      <th className="text-left py-2 px-3 text-gray-600">Qtd Corretivo (ton)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agruparPor('talhaoId')).map(([talhaoId, regs]) => (
                      <tr key={talhaoId} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{getTalhaoNome(talhaoId)}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularBombas(regs)}</td>
                        <td className="py-2 px-3">{regs.reduce((a, r) => a + (r.quantidadeAdubo || 0), 0).toFixed(2)}</td>
                        <td className="py-2 px-3">{regs.reduce((a, r) => a + (r.quantidadeCorretivo || 0), 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">Consumo por Atividade</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Tipo de Atividade</th>
                      <th className="text-left py-2 px-3 text-gray-600">Registros</th>
                      <th className="text-left py-2 px-3 text-gray-600">Total Bombas</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agruparPor('tipoAtividade')).map(([tipo, regs]) => (
                      <tr key={tipo} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{getTipoLabel(tipo)}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularBombas(regs)}</td>
                        <td className="py-2 px-3">{calcularHoras(regs)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {aba === 'historico' && (
            <div className="card">
              <h3 className="text-lg font-semibold text-primary mb-4">Histórico de Aplicações</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Data</th>
                      <th className="text-left py-2 px-3 text-gray-600">Talhão</th>
                      <th className="text-left py-2 px-3 text-gray-600">Safra</th>
                      <th className="text-left py-2 px-3 text-gray-600">Atividade</th>
                      <th className="text-left py-2 px-3 text-gray-600">Responsável</th>
                      <th className="text-left py-2 px-3 text-gray-600">Bombas</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                      <th className="text-left py-2 px-3 text-gray-600">Implemento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrosFiltrados.map(r => (
                      <tr key={r.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3">{new Date(r.data).toLocaleDateString('pt-BR')}</td>
                        <td className="py-2 px-3">{r.talhao?.nome || '-'}</td>
                        <td className="py-2 px-3">{r.safra?.nome || '-'}</td>
                        <td className="py-2 px-3">{getTipoLabel(r.tipoAtividade)}</td>
                        <td className="py-2 px-3">{r.funcionario?.name || '-'}</td>
                        <td className="py-2 px-3">{r.totalBombas || '-'}</td>
                        <td className="py-2 px-3">{r.horasCalculadas ? `${r.horasCalculadas.toFixed(1)}h` : '-'}</td>
                        <td className="py-2 px-3">{r.implementoUtilizado || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {aba === 'agronomico' && (
            <div className="space-y-4">
              {Object.entries(agruparPor('talhaoId')).map(([talhaoId, regs]) => (
                <div key={talhaoId} className="card">
                  <h3 className="text-lg font-semibold text-primary mb-4">Talhão: {getTalhaoNome(talhaoId)}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{regs.length}</p>
                      <p className="text-sm text-gray-600">Aplicações</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{calcularBombas(regs)}</p>
                      <p className="text-sm text-gray-600">Total Bombas</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{calcularHoras(regs)}h</p>
                      <p className="text-sm text-gray-600">Horas Homem</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{calcularHorasMaquina(regs)}h</p>
                      <p className="text-sm text-gray-600">Horas Máquina</p>
                    </div>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-gray-600">Data</th>
                        <th className="text-left py-2 px-3 text-gray-600">Atividade</th>
                        <th className="text-left py-2 px-3 text-gray-600">Bombas</th>
                        <th className="text-left py-2 px-3 text-gray-600">Adubo</th>
                        <th className="text-left py-2 px-3 text-gray-600">Operador</th>
                        <th className="text-left py-2 px-3 text-gray-600">Máquina</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regs.sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime()).map((r: any) => (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3">{new Date(r.data).toLocaleDateString('pt-BR')}</td>
                          <td className="py-2 px-3">{getTipoLabel(r.tipoAtividade)}</td>
                          <td className="py-2 px-3">{r.totalBombas || '-'}</td>
                          <td className="py-2 px-3">{r.quantidadeAdubo ? `${r.quantidadeAdubo}kg` : '-'}</td>
                          <td className="py-2 px-3">{r.funcionario?.name || '-'}</td>
                          <td className="py-2 px-3">{r.maquina?.nome || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {aba === 'operacional' && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">Desempenho por Operador</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Operador</th>
                      <th className="text-left py-2 px-3 text-gray-600">Atividades</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                      <th className="text-left py-2 px-3 text-gray-600">Média h/atividade</th>
                      <th className="text-left py-2 px-3 text-gray-600">Faltas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      registrosFiltrados.reduce((acc: any, r) => {
                        const nome = r.funcionario?.name || 'Desconhecido'
                        if (!acc[nome]) acc[nome] = []
                        acc[nome].push(r)
                        return acc
                      }, {})
                    ).map(([nome, regs]: any) => (
                      <tr key={nome} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{nome}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularHoras(regs)}h</td>
                        <td className="py-2 px-3">{regs.length > 0 ? (parseFloat(calcularHoras(regs)) / regs.length).toFixed(1) : 0}h</td>
                        <td className="py-2 px-3">{regs.filter((r: any) => r.isFalta).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">Desempenho por Equipamento</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Máquina</th>
                      <th className="text-left py-2 px-3 text-gray-600">Usos</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                      <th className="text-left py-2 px-3 text-gray-600">Implemento mais usado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      registrosFiltrados
                        .filter((r: any) => r.maquinaId)
                        .reduce((acc: any, r: any) => {
                          const nome = r.maquina?.nome || r.maquinaId
                          if (!acc[nome]) acc[nome] = []
                          acc[nome].push(r)
                          return acc
                        }, {})
                    ).map(([nome, regs]: any) => {
                      const implementos = regs.map((r: any) => r.implementoUtilizado).filter(Boolean)
                      const maisUsado = implementos.length > 0
                        ? implementos.sort((a: string, b: string) =>
                            implementos.filter((v: string) => v === b).length - implementos.filter((v: string) => v === a).length
                          )[0]
                        : '-'
                      return (
                        <tr key={nome} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium">{nome}</td>
                          <td className="py-2 px-3">{regs.length}</td>
                          <td className="py-2 px-3">{calcularHorasMaquina(regs)}h</td>
                          <td className="py-2 px-3">{maisUsado}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {aba === 'custos' && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-2">Custos por Talhão</h3>
                <p className="text-sm text-gray-500 mb-4">* Para custos detalhados por produto, cadastre os preços nos Produtos e vincule Receitas de Aplicação às atividades.</p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Talhão</th>
                      <th className="text-left py-2 px-3 text-gray-600">Atividades</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Máquina</th>
                      <th className="text-left py-2 px-3 text-gray-600">Total Bombas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agruparPor('talhaoId')).map(([talhaoId, regs]) => (
                      <tr key={talhaoId} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{getTalhaoNome(talhaoId)}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularHoras(regs)}h</td>
                        <td className="py-2 px-3">{calcularHorasMaquina(regs)}h</td>
                        <td className="py-2 px-3">{calcularBombas(regs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">Resumo por Safra</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Safra</th>
                      <th className="text-left py-2 px-3 text-gray-600">Total Atividades</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Máquina</th>
                      <th className="text-left py-2 px-3 text-gray-600">Total Bombas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agruparPor('safraId')).map(([safraId, regs]) => (
                      <tr key={safraId} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{getSafraNome(safraId)}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularHoras(regs)}h</td>
                        <td className="py-2 px-3">{calcularHorasMaquina(regs)}h</td>
                        <td className="py-2 px-3">{calcularBombas(regs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
