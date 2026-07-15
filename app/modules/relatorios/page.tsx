'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { DollarSign, ClipboardList, TrendingUp, Filter, FileSpreadsheet, FileText, Fuel, AlertCircle, BarChart3 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { calcularTotaisHoras } from '@/lib/calculoTotaisFuncionario'
import { calcularCombustivelPorMaquina } from '@/lib/calculoCombustivelPorMaquina'

export default function RelatoriosPage() {
  const { data: session } = useSession()
  const [aba, setAba] = useState('historico')
  const [registros, setRegistros] = useState<any[]>([])
  const [talhoes, setTalhoes] = useState<any[]>([])
  const [safras, setSafras] = useState<any[]>([])
  const [tiposAtividade, setTiposAtividade] = useState<{ id: string; nome: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [abastecimentos, setAbastecimentos] = useState<any[]>([])
  const [custoHHHM, setCustoHHHM] = useState<{ talhaoId: string; nomeTalhao: string; custoHHPorHa: number | null; custoHMPorHa: number | null }[]>([])

  const [filtros, setFiltros] = useState({
    safraId: '',
    talhaoId: '',
    dataInicio: '',
    dataFim: '',
    tipoAtividade: '',
  })

  const [filtroDataInicioComb, setFiltroDataInicioComb] = useState('')
  const [filtroDataFimComb, setFiltroDataFimComb] = useState('')

  useEffect(() => {
    loadDados()
  }, [])

  const loadDados = async () => {
    try {
      setLoading(true)
      const [regRes, talRes, safRes, tipRes, abaRes] = await Promise.all([
        fetch('/api/registros-atividade'),
        fetch('/api/talhoes'),
        fetch('/api/safras'),
        fetch('/api/tipos-atividade?ativo=true'),
        fetch('/api/abastecimentos'),
      ])
      if (regRes.ok) setRegistros((await regRes.json()).data || [])
      if (talRes.ok) setTalhoes((await talRes.json()).data || [])
      if (safRes.ok) setSafras((await safRes.json()).data || [])
      if (tipRes.ok) setTiposAtividade(await tipRes.json())
      if (abaRes.ok) setAbastecimentos((await abaRes.json()).data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Custo HH/ha e Custo HM/ha por talhão: calculados inteiramente no servidor
  // (envolve salário individual de cada funcionário), só os totais agregados
  // por talhão chegam aqui. Buscado sempre que a aba Custos está ativa ou
  // quando os filtros de data mudam.
  const loadCustoHHHM = async () => {
    try {
      const params = new URLSearchParams()
      if (filtros.dataInicio) params.set('dataInicio', filtros.dataInicio)
      if (filtros.dataFim) params.set('dataFim', filtros.dataFim)
      const res = await fetch(`/api/relatorios/custo-hh-hm?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setCustoHHHM(data.data || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (aba === 'custos') {
      loadCustoHHHM()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, filtros.dataInicio, filtros.dataFim])

  const getCustoHHHMPorTalhao = (talhaoId: string) => custoHHHM.find(c => c.talhaoId === talhaoId)

  const formatarCustoPorHa = (valor: number | null | undefined) =>
    valor != null ? `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/ha` : '—'

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

  const calcularHorasMaquina = (regs: any[]) =>
    regs.reduce((acc, r) => acc + (r.horasMaquina || 0), 0).toFixed(1)

  const calcularHorasExtras = (regs: any[]) =>
    calcularTotaisHoras(regs).totalHorasExtras.toFixed(1)

  const getTalhaoNome = (id: string) => talhoes.find(t => t.id === id)?.nome || id
  const getSafraNome = (id: string) => safras.find(s => s.id === id)?.nome || id
  const getTipoLabel = (tipo: string) => tiposAtividade.find(t => t.nome === tipo)?.nome || tipo

  // ─── Comparativo de combustível por máquina ──────────────────────────────

  const getResumoCombustivelPorMaquina = () => {
    return calcularCombustivelPorMaquina(abastecimentos, registros, filtroDataInicioComb, filtroDataFimComb)
  }

  // ─── Comparativo Hora Homem x Hora Máquina por Operador ──────────────────
  // Reaproveita o mesmo agrupamento por operador usado na tabela "Desempenho
  // por Operador" (aba Indicadores Operacionais), evitando duplicar a lógica.

  const agruparPorOperador = () => {
    return registrosFiltrados.reduce((acc: Record<string, any[]>, r) => {
      const nome = r.funcionario?.name || 'Desconhecido'
      if (!acc[nome]) acc[nome] = []
      acc[nome].push(r)
      return acc
    }, {} as Record<string, any[]>)
  }

  const getDadosComparativoHHHM = () => {
    return Object.entries(agruparPorOperador())
      .map(([nome, regs]) => {
        const horasHomem = parseFloat(calcularHoras(regs))
        const horasMaquina = parseFloat(calcularHorasMaquina(regs))
        const total = horasHomem + horasMaquina
        const percentualHoraMaquina = total > 0 ? (horasMaquina / total) * 100 : 0
        return { operador: nome, horasHomem, horasMaquina, percentualHoraMaquina }
      })
      .sort((a, b) => b.horasHomem - a.horasHomem)
  }

  const abas = [
    { id: 'historico', label: 'Histórico de Atividades', icon: ClipboardList },
    { id: 'operacional', label: 'Indicadores Operacionais', icon: TrendingUp },
    { id: 'custos', label: 'Custos', icon: DollarSign },
    { id: 'combustivel', label: 'Combustível', icon: Fuel },
    { id: 'comparativo-hh-hm', label: 'Comparativo HH/HM', icon: BarChart3 },
  ]

  const getNomeAba = () => abas.find(a => a.id === aba)?.label || aba

  const resumoCombustivel = getResumoCombustivelPorMaquina()
  const dadosComparativoHHHM = getDadosComparativoHHHM()

  // ─── Dados por aba para exportação ───────────────────────────────────────

  const getDadosExportacao = () => {
    switch (aba) {
      case 'historico':
        return {
          sheets: [
            {
              nome: 'Histórico de Atividades',
              colunas: ['Data', 'Talhão', 'Safra', 'Atividade', 'Responsável', 'Máquina', 'Hora Máquina', 'Bombas', 'Horas Homem', 'Implemento'],
              linhas: registrosFiltrados.map(r => [
                new Date(r.data).toLocaleDateString('pt-BR'),
                r.talhao?.nome || '-',
                r.safra?.nome || '-',
                getTipoLabel(r.tipoAtividade),
                r.funcionario?.name || '-',
                r.maquina?.nome || '-',
                r.horasMaquina ? `${r.horasMaquina.toFixed(1)}h` : '-',
                r.totalBombas || '-',
                r.horasCalculadas ? `${r.horasCalculadas.toFixed(1)}h` : '-',
                r.implementoUtilizado || '-',
              ]),
            },
          ],
        }
      case 'operacional':
        return {
          sheets: [
            {
              nome: 'Desempenho por Operador',
              colunas: ['Operador', 'Atividades', 'Horas Homem', 'Hora Máquina', 'Hora Extra', 'Faltas'],
              linhas: Object.entries(agruparPorOperador()).map(([nome, regs]: any) => [
                nome,
                regs.length,
                `${calcularHoras(regs)}h`,
                `${calcularHorasMaquina(regs)}h`,
                `${calcularHorasExtras(regs)}h`,
                regs.filter((r: any) => r.isFalta).length,
              ]),
            },
            {
              nome: 'Desempenho por Equipamento',
              colunas: ['Máquina', 'Usos', 'Hora Máquina'],
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
                return [nome, regs.length, `${calcularHorasMaquina(regs)}h`]
              }),
            },
          ],
        }
      case 'custos':
        return {
          sheets: [
            {
              nome: 'Custos por Talhão',
              colunas: ['Talhão', 'Atividades', 'Horas Homem', 'Horas Máquina', 'Custo HH/ha', 'Custo HM/ha'],
              linhas: Object.entries(agruparPor('talhaoId')).map(([id, regs]) => [
                getTalhaoNome(id),
                regs.length,
                `${calcularHoras(regs)}h`,
                `${calcularHorasMaquina(regs)}h`,
                formatarCustoPorHa(getCustoHHHMPorTalhao(id)?.custoHHPorHa),
                formatarCustoPorHa(getCustoHHHMPorTalhao(id)?.custoHMPorHa),
              ]),
            },
            {
              nome: 'Resumo por Safra',
              colunas: ['Safra', 'Total Atividades', 'Horas Homem', 'Horas Máquina'],
              linhas: Object.entries(agruparPor('safraId')).map(([id, regs]) => [
                getSafraNome(id),
                regs.length,
                `${calcularHoras(regs)}h`,
                `${calcularHorasMaquina(regs)}h`,
              ]),
            },
          ],
        }
      case 'combustivel': {
        const resumoCombustivel = getResumoCombustivelPorMaquina()
        const totalGeralHoras = resumoCombustivel.reduce((acc, m) => acc + m.totalHoras, 0)
        const totalGeralLitros = resumoCombustivel.reduce((acc, m) => acc + m.totalLitros, 0)
        const totalGeralCusto = resumoCombustivel.reduce((acc, m) => acc + m.custoTotal, 0)
        const totalGeralHorasAtividades = resumoCombustivel.reduce((acc, m) => acc + m.horasRegistradasAtividades, 0)
        const consumoMedioGeral = totalGeralHoras > 0 ? totalGeralLitros / totalGeralHoras : 0
        return {
          sheets: [
            {
              nome: 'Comparativo de Combustível',
              colunas: [
                'Máquina',
                'Horas Trabalhadas (Horímetro)',
                'Litros Abastecidos',
                'Consumo Médio (L/h)',
                'Horas em Atividades (conferência)',
                'Custo Total (R$)',
              ],
              linhas: [
                ...resumoCombustivel.map(m => [
                  m.nomeMaquina,
                  `${m.totalHoras.toFixed(1)}h`,
                  `${m.totalLitros.toFixed(1)}L`,
                  `${m.consumoMedioLH.toFixed(2)} L/h`,
                  `${m.horasRegistradasAtividades.toFixed(1)}h`,
                  `R$ ${m.custoTotal.toFixed(2)}`,
                ]),
                [
                  'Total Geral',
                  `${totalGeralHoras.toFixed(1)}h`,
                  `${totalGeralLitros.toFixed(1)}L`,
                  `${consumoMedioGeral.toFixed(2)} L/h`,
                  `${totalGeralHorasAtividades.toFixed(1)}h`,
                  `R$ ${totalGeralCusto.toFixed(2)}`,
                ],
              ],
            },
          ],
        }
      }
      case 'comparativo-hh-hm':
        return {
          sheets: [
            {
              nome: 'Comparativo HH/HM',
              colunas: ['Operador', 'Horas Homem', 'Horas Máquina', '% Hora Máquina'],
              linhas: dadosComparativoHHHM.map(d => [
                d.operador,
                `${d.horasHomem.toFixed(1)}h`,
                `${d.horasMaquina.toFixed(1)}h`,
                `${d.percentualHoraMaquina.toFixed(1)}%`,
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
        <div className={`grid grid-cols-1 gap-4 ${aba === 'combustivel' ? 'md:grid-cols-2' : 'md:grid-cols-3 lg:grid-cols-5'}`}>
          {aba === 'combustivel' ? (
            <>
              <div className="form-group">
                <label>Data Início</label>
                <input type="date" value={filtroDataInicioComb} onChange={e => setFiltroDataInicioComb(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Data Fim</label>
                <input type="date" value={filtroDataFimComb} onChange={e => setFiltroDataFimComb(e.target.value)} />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
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
            disabled={exportando || (aba === 'combustivel' ? resumoCombustivel.length === 0 : registrosFiltrados.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exportando ? 'Exportando...' : 'Excel'}
          </button>
          <button
            onClick={exportarPDF}
            disabled={exportando || (aba === 'combustivel' ? resumoCombustivel.length === 0 : registrosFiltrados.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            {exportando ? 'Exportando...' : 'PDF'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-gray-500">Carregando dados...</div>
      ) : (aba !== 'combustivel' && registrosFiltrados.length === 0) ? (
        <div className="card text-center py-12 text-gray-500">Nenhum registro encontrado com os filtros selecionados.</div>
      ) : (
        <>
          {aba === 'historico' && (
            <div className="card">
              <h3 className="text-lg font-semibold text-primary mb-4">Histórico de Atividades</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Data</th>
                      <th className="text-left py-2 px-3 text-gray-600">Talhão</th>
                      <th className="text-left py-2 px-3 text-gray-600">Safra</th>
                      <th className="text-left py-2 px-3 text-gray-600">Atividade</th>
                      <th className="text-left py-2 px-3 text-gray-600">Responsável</th>
                      <th className="text-left py-2 px-3 text-gray-600">Máquina</th>
                      <th className="text-left py-2 px-3 text-gray-600">Hora Máquina</th>
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
                        <td className="py-2 px-3">{r.maquina?.nome || '-'}</td>
                        <td className="py-2 px-3">{r.horasMaquina ? `${r.horasMaquina.toFixed(1)}h` : '-'}</td>
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
                      <th className="text-left py-2 px-3 text-gray-600">Hora Máquina</th>
                      <th className="text-left py-2 px-3 text-gray-600">Hora Extra</th>
                      <th className="text-left py-2 px-3 text-gray-600">Faltas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agruparPorOperador()).map(([nome, regs]: any) => (
                      <tr key={nome} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{nome}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularHoras(regs)}h</td>
                        <td className="py-2 px-3">{calcularHorasMaquina(regs)}h</td>
                        <td className="py-2 px-3">{calcularHorasExtras(regs)}h</td>
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
                      <th className="text-left py-2 px-3 text-gray-600">Hora Máquina</th>
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
                      return (
                        <tr key={nome} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium">{nome}</td>
                          <td className="py-2 px-3">{regs.length}</td>
                          <td className="py-2 px-3">{calcularHorasMaquina(regs)}h</td>
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
                <p className="text-sm text-gray-500 mb-4">* Para custos detalhados por produto, cadastre os preços nos Produtos.</p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-600">Talhão</th>
                      <th className="text-left py-2 px-3 text-gray-600">Atividades</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                      <th className="text-left py-2 px-3 text-gray-600">Horas Máquina</th>
                      <th className="text-left py-2 px-3 text-gray-600">Custo HH/ha</th>
                      <th className="text-left py-2 px-3 text-gray-600">Custo HM/ha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agruparPor('talhaoId')).map(([talhaoId, regs]) => (
                      <tr key={talhaoId} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{getTalhaoNome(talhaoId)}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularHoras(regs)}h</td>
                        <td className="py-2 px-3">{calcularHorasMaquina(regs)}h</td>
                        <td className="py-2 px-3">{formatarCustoPorHa(getCustoHHHMPorTalhao(talhaoId)?.custoHHPorHa)}</td>
                        <td className="py-2 px-3">{formatarCustoPorHa(getCustoHHHMPorTalhao(talhaoId)?.custoHMPorHa)}</td>
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
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agruparPor('safraId')).map(([safraId, regs]) => (
                      <tr key={safraId} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{getSafraNome(safraId)}</td>
                        <td className="py-2 px-3">{regs.length}</td>
                        <td className="py-2 px-3">{calcularHoras(regs)}h</td>
                        <td className="py-2 px-3">{calcularHorasMaquina(regs)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {aba === 'combustivel' && (
            <div className="card">
              <h3 className="text-lg font-semibold text-primary mb-4">Comparativo de Combustível por Máquina</h3>
              {resumoCombustivel.length === 0 ? (
                <p className="text-center py-12 text-gray-500">Nenhum abastecimento encontrado no período selecionado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-gray-600">Máquina</th>
                        <th className="text-left py-2 px-3 text-gray-600">Horas Trabalhadas (Horímetro)</th>
                        <th className="text-left py-2 px-3 text-gray-600">Litros Abastecidos</th>
                        <th className="text-left py-2 px-3 text-gray-600">Consumo Médio (L/h)</th>
                        <th className="text-left py-2 px-3 text-gray-600">Horas em Atividades (conferência)</th>
                        <th className="text-left py-2 px-3 text-gray-600">Custo Total (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const maxConsumoMedio = Math.max(...resumoCombustivel.map(m => m.consumoMedioLH))
                        const maxTotalLitros = Math.max(...resumoCombustivel.map(m => m.totalLitros))
                        const totalGeralHoras = resumoCombustivel.reduce((acc, m) => acc + m.totalHoras, 0)
                        const totalGeralLitros = resumoCombustivel.reduce((acc, m) => acc + m.totalLitros, 0)
                        const totalGeralCusto = resumoCombustivel.reduce((acc, m) => acc + m.custoTotal, 0)
                        const totalGeralHorasAtividades = resumoCombustivel.reduce((acc, m) => acc + m.horasRegistradasAtividades, 0)
                        const consumoMedioGeral = totalGeralHoras > 0 ? totalGeralLitros / totalGeralHoras : 0

                        return (
                          <>
                            {resumoCombustivel.map(m => (
                              <tr key={m.maquinaId} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-3 font-medium">{m.nomeMaquina}</td>
                                <td className="py-2 px-3">
                                  {m.totalHoras.toFixed(1)}h
                                  {m.divergente && (
                                    <AlertCircle
                                      className="inline-block w-4 h-4 text-amber-500 ml-1 align-text-bottom"
                                      title="Divergência entre horímetro e horas registradas nas atividades"
                                    />
                                  )}
                                </td>
                                <td className={`py-2 px-3 ${m.totalLitros === maxTotalLitros && maxTotalLitros > 0 ? 'text-blue-600 font-bold' : ''}`}>
                                  {m.totalLitros.toFixed(1)}L
                                </td>
                                <td className={`py-2 px-3 ${m.consumoMedioLH === maxConsumoMedio && maxConsumoMedio > 0 ? 'text-red-600 font-bold' : ''}`}>
                                  {m.consumoMedioLH.toFixed(2)} L/h
                                </td>
                                <td className="py-2 px-3">{m.horasRegistradasAtividades.toFixed(1)}h</td>
                                <td className="py-2 px-3">R$ {m.custoTotal.toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                              <td className="py-2 px-3">Total Geral</td>
                              <td className="py-2 px-3">{totalGeralHoras.toFixed(1)}h</td>
                              <td className="py-2 px-3">{totalGeralLitros.toFixed(1)}L</td>
                              <td className="py-2 px-3">{consumoMedioGeral.toFixed(2)} L/h</td>
                              <td className="py-2 px-3">{totalGeralHorasAtividades.toFixed(1)}h</td>
                              <td className="py-2 px-3">R$ {totalGeralCusto.toFixed(2)}</td>
                            </tr>
                          </>
                        )
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {aba === 'comparativo-hh-hm' && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">
                  Comparativo Hora Homem x Hora Máquina por Operador
                </h3>
                {dadosComparativoHHHM.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                    Sem dados
                  </div>
                ) : (() => {
                  const truncarNomeOperador = (nome: string, maxLen: number = 14) => {
                    if (nome.length <= maxLen) return nome
                    return `${nome.slice(0, maxLen - 1)}…`
                  }
                  const dadosGrafico = dadosComparativoHHHM.map(d => ({
                    ...d,
                    operadorCurto: truncarNomeOperador(d.operador),
                  }))
                  const alturaGrafico = Math.max(320, dadosGrafico.length * 10 + 280)

                  return (
                    <ResponsiveContainer width="100%" height={alturaGrafico}>
                      <BarChart data={dadosGrafico} margin={{ left: 8, right: 16, top: 8, bottom: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="operadorCurto"
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          labelFormatter={(_, payload) =>
                            payload && payload[0] ? (payload[0].payload as any).operador : ''
                          }
                          formatter={(value: number) => `${value.toFixed(1)}h`}
                        />
                        <Legend />
                        <Bar dataKey="horasHomem" name="Horas Homem" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="horasMaquina" name="Horas Máquina" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-primary mb-4">Comparativo HH/HM por Operador</h3>
                {dadosComparativoHHHM.length === 0 ? (
                  <p className="text-center py-12 text-gray-500">Nenhum registro encontrado no período selecionado.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-gray-600">Operador</th>
                        <th className="text-left py-2 px-3 text-gray-600">Horas Homem</th>
                        <th className="text-left py-2 px-3 text-gray-600">Horas Máquina</th>
                        <th className="text-left py-2 px-3 text-gray-600">% Hora Máquina</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosComparativoHHHM.map(d => (
                        <tr key={d.operador} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium">{d.operador}</td>
                          <td className="py-2 px-3">{d.horasHomem.toFixed(1)}h</td>
                          <td className="py-2 px-3">{d.horasMaquina.toFixed(1)}h</td>
                          <td className="py-2 px-3">{d.percentualHoraMaquina.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
