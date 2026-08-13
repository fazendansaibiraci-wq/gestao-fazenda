'use client'

import { Fragment, useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Search, AlertTriangle, FileSpreadsheet, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { RegistrarSaidaProduto } from '@/components/RegistrarSaidaProduto'
import { AjustarEstoque } from '@/components/AjustarEstoque'
import { ImportarNFeEstoque } from '@/components/ImportarNFeEstoque'

export default function EstoquePage() {
  const { status } = useSession()
  const [produtos, setProdutos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [exportando, setExportando] = useState(false)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [locais, setLocais] = useState<any[]>([])
  const [localIdFiltro, setLocalIdFiltro] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') {
      load()
      fetch('/api/locais')
        .then((r) => r.json())
        .then((d) => setLocais((d.data || []).filter((l: any) => l.status)))
        .catch(() => {})
    }
  }, [status])

  const load = async () => {
    try {
      const res = await fetch('/api/produtos')
      const data = await res.json()
      setProdutos((data.data || []).filter((p: any) => p.status))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Quantidade "efetiva" de um produto: o saldo no local filtrado (0 se
  // não tiver entrada nesse local), ou o total do produto quando
  // "Todos os locais" estiver selecionado.
  const getQuantidadeEfetiva = (p: any) => {
    if (!localIdFiltro) return p.quantidadeEstoque || 0
    const entrada = (p.estoqueLocais || []).find((e: any) => e.localId === localIdFiltro)
    return entrada?.quantidade || 0
  }

  const produtosFiltrados = produtos.filter((p) => {
    const buscaOk =
      p.nomeComercial.toLowerCase().includes(busca.toLowerCase()) ||
      p.categoria.toLowerCase().includes(busca.toLowerCase())
    if (!buscaOk) return false
    // Com um local específico selecionado, esconde produto sem saldo
    // nesse local — senão a lista mostraria zerado pra quase tudo.
    if (localIdFiltro) return getQuantidadeEfetiva(p) > 0
    return true
  })

  const valorTotalEstoque = produtosFiltrados.reduce(
    (acc, p) => acc + getQuantidadeEfetiva(p) * (p.valorUnitario || 0),
    0
  )

  // estoqueMinimo é um valor único do produto (não por local) — o
  // alerta só faz sentido olhando o total, então fica desligado quando
  // a visão está filtrada por local específico.
  const estoqueAbaixoMinimo = (p: any) =>
    !localIdFiltro && p.estoqueMinimo > 0 && p.quantidadeEstoque <= p.estoqueMinimo

  const localSelecionadoNome = locais.find((l) => l.id === localIdFiltro)?.nome || ''

  const todosSelecionados = produtosFiltrados.length > 0 && produtosFiltrados.every((p) => selecionados.has(p.id))

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpandir = (id: string) => {
    setExpandidos((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) {
        novo.delete(id)
      } else {
        novo.add(id)
      }
      return novo
    })
  }

  const toggleSelecionarTodos = () => {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (todosSelecionados) {
        produtosFiltrados.forEach((p) => next.delete(p.id))
      } else {
        produtosFiltrados.forEach((p) => next.add(p.id))
      }
      return next
    })
  }

  const getProdutosParaExportar = () =>
    selecionados.size > 0 ? produtosFiltrados.filter((p) => selecionados.has(p.id)) : produtosFiltrados

  const getDadosExportacao = () => {
    const colunas = ['Nome', 'Categoria', 'Quantidade', 'Valor Unitário', 'Valor em Estoque']
    const linhas = getProdutosParaExportar()
      .sort((a, b) => a.nomeComercial.localeCompare(b.nomeComercial))
      .map((p) => {
        const quantidade = getQuantidadeEfetiva(p)
        return [
          p.nomeComercial,
          p.categoria,
          `${quantidade.toLocaleString('pt-BR')} ${p.unidadeMedida}`,
          `R$ ${(p.valorUnitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${(quantidade * (p.valorUnitario || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        ]
      })
    return { colunas, linhas }
  }

  // Sufixo pro nome do arquivo exportado, com o local filtrado (se
  // houver) — ex: "estoque_Bolsa_2026-08-13.xlsx".
  const sufixoArquivoLocal = localSelecionadoNome ? `_${localSelecionadoNome.replace(/\s+/g, '-')}` : ''

  // ─── Exportar Excel ───────────────────────────────────────────────────────

  const exportarExcel = async () => {
    setExportando(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Gestão Fazenda'
      wb.created = new Date()

      const { colunas, linhas } = getDadosExportacao()
      const ws = wb.addWorksheet('Estoque')

      // Cabeçalho
      const headerRow = ws.addRow(colunas)
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2d6a4f' } }
        cell.alignment = { horizontal: 'center' }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
        }
      })

      // Dados
      linhas.forEach((linha, idx) => {
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

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `estoque${sufixoArquivoLocal}_${new Date().toISOString().split('T')[0]}.xlsx`
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
      const { colunas, linhas } = getDadosExportacao()
      const dataHoje = new Date().toLocaleDateString('pt-BR')

      // Título
      doc.setFontSize(16)
      doc.setTextColor(45, 106, 79)
      doc.text(`Gestão Fazenda — Estoque${localSelecionadoNome ? ` — ${localSelecionadoNome}` : ''}`, 14, 16)

      doc.setFontSize(11)
      doc.setTextColor(100)
      doc.text(`Gerado em: ${dataHoje}`, 14, 23)

      autoTable(doc, {
        head: [colunas],
        body: linhas,
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

      doc.save(`estoque${sufixoArquivoLocal}_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err) {
      console.error(err)
      alert('Erro ao exportar PDF')
    } finally {
      setExportando(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="spinner"></div></div>

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Estoque</h1>
      <p className="text-gray-500">Quantidade atual de cada produto, atualizada manualmente ou por importação do Ideagri.</p>

      <div className="card">
        <p className="text-sm text-gray-500">Valor total em estoque</p>
        <p className="text-2xl font-bold text-primary">
          R$ {valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>

      <RegistrarSaidaProduto produtos={produtos} onAtualizado={load} />
      <AjustarEstoque produtos={produtos} onAtualizado={load} />
      <ImportarNFeEstoque onImportado={load} />

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar produto por nome ou categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full border rounded-lg pl-10 pr-4 py-2"
            />
          </div>
          <select
            value={localIdFiltro}
            onChange={(e) => setLocalIdFiltro(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm sm:w-56"
          >
            <option value="">Todos os locais</option>
            {locais.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
          <p className="text-sm text-gray-500">
            {produtosFiltrados.length} produto(s)
            {selecionados.size > 0 ? ` — ${selecionados.size} selecionado(s)` : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={exportarExcel}
              disabled={exportando || produtosFiltrados.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exportando ? 'Exportando...' : 'Exportar Excel'}
            </button>
            <button
              onClick={exportarPDF}
              disabled={exportando || produtosFiltrados.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              {exportando ? 'Exportando...' : 'Exportar PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left w-10"></th>
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={todosSelecionados}
                  onChange={toggleSelecionarTodos}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-left">Quantidade</th>
              <th className="px-4 py-3 text-left">Valor Unitário</th>
              <th className="px-4 py-3 text-left">Valor em Estoque</th>
            </tr>
          </thead>
          <tbody>
            {produtosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Nenhum produto encontrado</td>
              </tr>
            ) : (
              produtosFiltrados
                .sort((a, b) => a.nomeComercial.localeCompare(b.nomeComercial))
                .map((p) => {
                  const locaisComSaldo = (p.estoqueLocais || []).filter((e: any) => e.quantidade > 0)
                  const quantidadeEfetiva = getQuantidadeEfetiva(p)
                  return (
                  <Fragment key={p.id}>
                  <tr className={`border-b hover:bg-gray-50 ${estoqueAbaixoMinimo(p) ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleExpandir(p.id)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700 transition-colors"
                        title={expandidos.has(p.id) ? 'Recolher detalhes' : 'Ver saldo por local'}
                      >
                        {expandidos.has(p.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selecionados.has(p.id)}
                        onChange={() => toggleSelecionado(p.id)}
                        aria-label={`Selecionar ${p.nomeComercial}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      {p.nomeComercial}
                      {estoqueAbaixoMinimo(p) && (
                        <span title="Estoque no mínimo ou abaixo">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.categoria}</td>
                    <td className="px-4 py-3">{quantidadeEfetiva.toLocaleString('pt-BR')} {p.unidadeMedida}</td>
                    <td className="px-4 py-3">R$ {(p.valorUnitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">
                      R$ {(quantidadeEfetiva * (p.valorUnitario || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {expandidos.has(p.id) && (
                    <tr className="border-b bg-gray-50">
                      <td colSpan={7} className="px-4 py-4">
                        {locaisComSaldo.length === 0 ? (
                          <p className="text-xs text-gray-500">Sem estoque em nenhum local</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
                            {locaisComSaldo.map((e: any) => (
                              <div key={e.localId}>
                                <span className="block text-gray-400">{e.local?.nome}</span>
                                <span className="font-medium text-gray-700">
                                  {e.quantidade.toLocaleString('pt-BR')} {p.unidadeMedida}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
