'use client'

import { useEffect, useState } from 'react'

// Aba "Relatório por Atividade" da tela Aplicação de Insumos.
// Escolhe Atividade (Tipo de Atividade) + Safra e mostra datas, situação,
// talhões (com Encerrar/Reabrir), funcionários, turmas, produtos e custos
// totais e por hectare. Dados de /api/relatorios/por-atividade.

interface Safra { id: string; nome: string }
interface TipoAtividade { id: number; nome: string }
interface TalhaoRel {
  talhaoId: string; nome: string; area: number | null
  inicio: string | null; ultimoLancamento: string | null
  horasHH: number; horasHM: number
  custoHH: number; custoHM: number; custoTurmas: number; custoProdutos: number
  custoTotal: number; custoPorHa: number | null
  encerramento: { id: string; dataFim: string } | null
}
interface Relatorio {
  atividade: string
  safra: Safra
  resumo: {
    situacao: 'SEM_LANCAMENTO' | 'EM_ANDAMENTO' | 'CONCLUIDA'
    inicio: string | null; fim: string | null
    areaTotal: number; nTalhoes: number; nTalhoesEncerrados: number; nFuncionarios: number
    horasHH: number; horasHM: number
    custoHH: number; custoHM: number; custoTurmas: number; custoProdutos: number; custoTotal: number
    porHa: { hh: number | null; hm: number | null; turmas: number | null; produtos: number | null; total: number | null }
  }
  avisos: { funcionariosSemSalario: number; lancamentosSemTalhao: boolean; talhoesSemArea: string[] }
  talhoes: TalhaoRel[]
  funcionarios: { funcionarioId: string; nome: string; horasHH: number; horasHM: number; dias: number; talhoes: string[] }[]
  turmas: { turmaId: string; nome: string; pessoasDia: number; dias: number; valorTotal: number }[]
  produtos: { produtoId: string; nome: string; unidade: string; quantidade: number; custo: number; quantidadePorHa: number | null; custoPorHa: number | null }[]
}

const SEM_TALHAO = '__sem_talhao__'
const brl = (n: number | null | undefined) => n == null ? '-' : 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n: number | null | undefined, casas = 2) => n == null ? '-' : n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas })
const horas = (n: number) => num(n, 1) + ' h'
const dataBR = (s: string | null | undefined) => (s ? s.split('-').reverse().join('/') : '-')
const SITUACAO_LABEL = { SEM_LANCAMENTO: 'Sem lançamentos', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída' } as const
const SITUACAO_COR = { SEM_LANCAMENTO: 'bg-gray-100 text-gray-600', EM_ANDAMENTO: 'bg-amber-100 text-amber-800', CONCLUIDA: 'bg-green-100 text-green-800' } as const

export default function RelatorioPorAtividade({ safras }: { safras: Safra[] }) {
  const [tipos, setTipos] = useState<TipoAtividade[]>([])
  const [atividade, setAtividade] = useState('')
  const [safraId, setSafraId] = useState(safras[0]?.id || '')
  const [rel, setRel] = useState<Relatorio | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [exportando, setExportando] = useState(false)
  // Encerrar: talhão sendo encerrado + data escolhida
  const [encerrando, setEncerrando] = useState<{ talhaoId: string; nome: string; data: string } | null>(null)
  const [salvandoEnc, setSalvandoEnc] = useState(false)

  useEffect(() => {
    fetch('/api/tipos-atividade?ativo=true')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setTipos(Array.isArray(d) ? d : []))
      .catch(() => setTipos([]))
  }, [])
  useEffect(() => { if (!safraId && safras.length) setSafraId(safras[0].id) }, [safras, safraId])
  useEffect(() => { carregar() }, [atividade, safraId])

  async function carregar() {
    setErro('')
    if (!atividade || !safraId) { setRel(null); return }
    setCarregando(true)
    try {
      const params = new URLSearchParams({ tipoAtividade: atividade, safraId })
      const r = await fetch('/api/relatorios/por-atividade?' + params.toString())
      const d = await r.json().catch(() => ({}))
      if (r.status === 401) throw new Error('Somente Gestor e Gerente podem ver este relatório.')
      if (!r.ok) throw new Error(d.error || 'Erro ao carregar o relatório')
      setRel(d.data)
    } catch (e: unknown) {
      setRel(null)
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o relatório')
    } finally {
      setCarregando(false)
    }
  }

  async function encerrar(talhaoId: string, dataFim: string) {
    const r = await fetch('/api/encerramentos-atividade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoAtividade: atividade, talhaoId, safraId, dataFim }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      throw new Error(d.error || 'Erro ao encerrar')
    }
  }

  async function confirmarEncerramento() {
    if (!encerrando) return
    setSalvandoEnc(true)
    try {
      await encerrar(encerrando.talhaoId, encerrando.data)
      setEncerrando(null)
      await carregar()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao encerrar')
    } finally {
      setSalvandoEnc(false)
    }
  }

  async function encerrarTodos() {
    if (!rel) return
    const abertos = rel.talhoes.filter(t => t.talhaoId !== SEM_TALHAO && !t.encerramento)
    if (!abertos.length) return
    if (!confirm(`Encerrar ${abertos.length} talhão(ões) em aberto? Cada um fica com a data do seu último lançamento.`)) return
    setSalvandoEnc(true)
    try {
      for (const t of abertos) await encerrar(t.talhaoId, t.ultimoLancamento || t.inicio || new Date().toISOString().slice(0, 10))
      await carregar()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao encerrar')
      await carregar()
    } finally {
      setSalvandoEnc(false)
    }
  }

  async function reabrir(t: TalhaoRel) {
    if (!t.encerramento) return
    if (!confirm(`Reabrir ${t.nome}? Ele volta a ficar "Em andamento".`)) return
    const r = await fetch('/api/encerramentos-atividade?id=' + encodeURIComponent(t.encerramento.id), { method: 'DELETE' })
    if (!r.ok) alert('Não foi possível reabrir')
    await carregar()
  }

  const nomeArquivo = () => `relatorio_${(rel?.atividade || 'atividade').replace(/[^\p{L}\p{N}]+/gu, '_')}_${(rel?.safra.nome || '').replace(/[^\p{L}\p{N}]+/gu, '_')}`
  const situacaoTalhao = (t: TalhaoRel) => (t.talhaoId === SEM_TALHAO ? '-' : t.encerramento ? `Encerrado ${dataBR(t.encerramento.dataFim)}` : 'Em andamento')

  async function exportarExcel() {
    if (!rel) return
    setExportando(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Gestão Fazenda'
      wb.created = new Date()
      const cab = (ws: any, colunas: string[]) => {
        const row = ws.addRow(colunas)
        row.eachCell((c: any) => {
          c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2d6a4f' } }
          c.alignment = { horizontal: 'center', wrapText: true }
        })
      }
      const moeda = '"R$" #,##0.00'
      const r = rel.resumo

      const ws1 = wb.addWorksheet('Resumo')
      ws1.addRow([`Relatório por Atividade — ${rel.atividade}`]).font = { bold: true, size: 14 }
      ws1.addRow([`Safra: ${rel.safra.nome}`])
      ws1.addRow([])
      const linhas: [string, any, string?][] = [
        ['Situação', SITUACAO_LABEL[r.situacao]],
        ['Início', dataBR(r.inicio)],
        ['Término', r.situacao === 'CONCLUIDA' ? dataBR(r.fim) : SITUACAO_LABEL[r.situacao]],
        ['Área total (ha)', r.areaTotal, '#,##0.00'],
        ['Talhões', `${r.nTalhoes} (${r.nTalhoesEncerrados} encerrados)`],
        ['Funcionários', r.nFuncionarios],
        ['Horas homem', r.horasHH, '#,##0.0'],
        ['Horas máquina', r.horasHM, '#,##0.0'],
        ['Custo hora homem', r.custoHH, moeda],
        ['Custo hora máquina', r.custoHM, moeda],
        ['Custo diárias de turma', r.custoTurmas, moeda],
        ['Custo de produtos', r.custoProdutos, moeda],
        ['CUSTO TOTAL', r.custoTotal, moeda],
        ['Hora homem / ha', r.porHa.hh, moeda],
        ['Hora máquina / ha', r.porHa.hm, moeda],
        ['Diárias de turma / ha', r.porHa.turmas, moeda],
        ['Produtos / ha', r.porHa.produtos, moeda],
        ['CUSTO TOTAL / ha', r.porHa.total, moeda],
      ]
      for (const [rot, val, fmt] of linhas) {
        const row = ws1.addRow([rot, val ?? '-'])
        if (fmt) row.getCell(2).numFmt = fmt
        if (rot.startsWith('CUSTO TOTAL')) row.font = { bold: true }
      }
      ws1.getColumn(1).width = 28; ws1.getColumn(2).width = 26

      const ws2 = wb.addWorksheet('Talhões')
      cab(ws2, ['Talhão', 'Área (ha)', 'Início', 'Situação', 'Horas homem', 'Horas máquina', 'Custo HH', 'Custo HM', 'Diárias turma', 'Produtos', 'Custo total', 'Custo / ha'])
      for (const t of rel.talhoes) {
        const row = ws2.addRow([t.nome, t.area ?? '', dataBR(t.inicio), situacaoTalhao(t), t.horasHH, t.horasHM, t.custoHH, t.custoHM, t.custoTurmas, t.custoProdutos, t.custoTotal, t.custoPorHa ?? ''])
        ;[7, 8, 9, 10, 11, 12].forEach(i => { row.getCell(i).numFmt = moeda })
      }
      ws2.columns.forEach((c: any, i: number) => { c.width = i === 0 ? 22 : 15 })

      const ws3 = wb.addWorksheet('Funcionários')
      cab(ws3, ['Funcionário', 'Dias', 'Horas homem', 'Horas máquina', 'Talhões'])
      for (const f of rel.funcionarios) ws3.addRow([f.nome, f.dias, f.horasHH, f.horasHM, f.talhoes.join(', ')])
      if (rel.turmas.length) {
        ws3.addRow([])
        cab(ws3, ['Turma', 'Dias', 'Pessoas × dia', 'Valor diárias', ''])
        for (const t of rel.turmas) ws3.addRow([t.nome, t.dias, t.pessoasDia, t.valorTotal]).getCell(4).numFmt = moeda
      }
      ws3.columns.forEach((c: any, i: number) => { c.width = i === 0 ? 28 : i === 4 ? 40 : 15 })

      const ws4 = wb.addWorksheet('Produtos')
      cab(ws4, ['Produto', 'Unidade', 'Quantidade', 'Quantidade / ha', 'Custo', 'Custo / ha'])
      for (const p of rel.produtos) {
        const row = ws4.addRow([p.nome, p.unidade, p.quantidade, p.quantidadePorHa ?? '', p.custo, p.custoPorHa ?? ''])
        row.getCell(5).numFmt = moeda; row.getCell(6).numFmt = moeda
      }
      ws4.columns.forEach((c: any, i: number) => { c.width = i === 0 ? 30 : 15 })

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = nomeArquivo() + '.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('Erro ao exportar Excel')
    } finally {
      setExportando(false)
    }
  }

  async function exportarPdf() {
    if (!rel) return
    setExportando(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const r = rel.resumo
      const verde: [number, number, number] = [45, 106, 79]

      pdf.setFontSize(15); pdf.setFont('helvetica', 'bold')
      pdf.text(`Relatório por Atividade — ${rel.atividade}`, 14, 15)
      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal')
      pdf.text(`Safra: ${rel.safra.nome}    Situação: ${SITUACAO_LABEL[r.situacao]}    Início: ${dataBR(r.inicio)}    Término: ${r.situacao === 'CONCLUIDA' ? dataBR(r.fim) : '-'}`, 14, 22)
      pdf.text(`Área: ${num(r.areaTotal)} ha    Talhões: ${r.nTalhoes} (${r.nTalhoesEncerrados} encerrados)    Funcionários: ${r.nFuncionarios}    Horas homem: ${horas(r.horasHH)}    Horas máquina: ${horas(r.horasHM)}`, 14, 28)

      autoTable(pdf, {
        startY: 33,
        head: [['', 'Hora homem', 'Hora máquina', 'Diárias turma', 'Produtos', 'TOTAL']],
        body: [
          ['Custo total', brl(r.custoHH), brl(r.custoHM), brl(r.custoTurmas), brl(r.custoProdutos), brl(r.custoTotal)],
          ['Custo por hectare', brl(r.porHa.hh), brl(r.porHa.hm), brl(r.porHa.turmas), brl(r.porHa.produtos), brl(r.porHa.total)],
        ],
        styles: { fontSize: 9 }, headStyles: { fillColor: verde }, columnStyles: { 5: { fontStyle: 'bold' } },
      })

      const y = () => ((pdf as any).lastAutoTable?.finalY || 40) + 7
      autoTable(pdf, {
        startY: y(),
        head: [['Talhão', 'Área (ha)', 'Início', 'Situação', 'H. homem', 'H. máquina', 'Mão de obra + máq.', 'Produtos', 'Custo total', 'Custo / ha']],
        body: rel.talhoes.map(t => [t.nome, num(t.area), dataBR(t.inicio), situacaoTalhao(t), num(t.horasHH, 1), num(t.horasHM, 1), brl(t.custoHH + t.custoHM + t.custoTurmas), brl(t.custoProdutos), brl(t.custoTotal), brl(t.custoPorHa)]),
        styles: { fontSize: 8 }, headStyles: { fillColor: verde },
      })
      autoTable(pdf, {
        startY: y(),
        head: [['Funcionário', 'Dias', 'Horas homem', 'Horas máquina', 'Talhões']],
        body: [
          ...rel.funcionarios.map(f => [f.nome, String(f.dias), num(f.horasHH, 1), num(f.horasHM, 1), f.talhoes.join(', ')]),
          ...rel.turmas.map(t => [`Turma ${t.nome}`, String(t.dias), `${num(t.pessoasDia, 1)} pessoas×dia`, '-', brl(t.valorTotal)]),
        ],
        styles: { fontSize: 8 }, headStyles: { fillColor: verde },
      })
      autoTable(pdf, {
        startY: y(),
        head: [['Produto', 'Unidade', 'Quantidade', 'Qtd / ha', 'Custo', 'Custo / ha']],
        body: rel.produtos.map(p => [p.nome, p.unidade, num(p.quantidade, 3), num(p.quantidadePorHa, 3), brl(p.custo), brl(p.custoPorHa)]),
        styles: { fontSize: 8 }, headStyles: { fillColor: verde },
      })
      pdf.save(nomeArquivo() + '.pdf')
    } catch (e) {
      console.error(e)
      alert('Erro ao exportar PDF')
    } finally {
      setExportando(false)
    }
  }

  const r = rel?.resumo
  const abertos = rel ? rel.talhoes.filter(t => t.talhaoId !== SEM_TALHAO && !t.encerramento).length : 0

  const Card = ({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) => (
    <div className={`rounded-xl border p-3 ${destaque ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
      <p className="text-xs text-gray-500">{rotulo}</p>
      <p className={`mt-1 font-semibold ${destaque ? 'text-green-800 text-lg' : 'text-gray-800'}`}>{valor}</p>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Atividade</label>
          <select value={atividade} onChange={e => setAtividade(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Selecionar</option>
            {tipos.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Safra</label>
          <select value={safraId} onChange={e => setSafraId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            {safras.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div className="flex gap-2 md:justify-end">
          <button onClick={exportarPdf} disabled={!rel || exportando} className="text-sm px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50">PDF</button>
          <button onClick={exportarExcel} disabled={!rel || exportando} className="text-sm px-4 py-2 border border-green-200 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50">Excel</button>
        </div>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{erro}</div>}
      {!atividade && !erro && <div className="text-center py-10 text-gray-400">Escolha uma atividade para ver o relatório</div>}
      {carregando && <div className="text-center py-8 text-gray-400">Carregando...</div>}

      {rel && r && !carregando && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-800">{rel.atividade}</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SITUACAO_COR[r.situacao]}`}>{SITUACAO_LABEL[r.situacao]}</span>
            <span className="text-sm text-gray-500">Safra {rel.safra.nome}</span>
          </div>

          {r.situacao === 'SEM_LANCAMENTO' ? (
            <div className="text-center py-10 text-gray-400">Nenhum lançamento desta atividade nesta safra</div>
          ) : (
            <>
              {(rel.avisos.funcionariosSemSalario > 0 || rel.avisos.lancamentosSemTalhao || rel.avisos.talhoesSemArea.length > 0) && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-sm space-y-1">
                  {rel.avisos.funcionariosSemSalario > 0 && <p>{rel.avisos.funcionariosSemSalario} funcionário(s) sem salário cadastrado no período: as horas contam, mas o custo HH deles não entrou.</p>}
                  {rel.avisos.lancamentosSemTalhao && <p>Há lançamentos sem talhão: os custos entram no total, mas não na área.</p>}
                  {rel.avisos.talhoesSemArea.length > 0 && <p>Talhão sem área no cadastro: {rel.avisos.talhoesSemArea.join(', ')}.</p>}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card rotulo="Início" valor={dataBR(r.inicio)} />
                <Card rotulo="Término" valor={r.situacao === 'CONCLUIDA' ? dataBR(r.fim) : 'Em andamento'} />
                <Card rotulo="Área total" valor={`${num(r.areaTotal)} ha`} />
                <Card rotulo="Talhões" valor={`${r.nTalhoes} (${r.nTalhoesEncerrados} encerrados)`} />
                <Card rotulo="Horas homem" valor={horas(r.horasHH)} />
                <Card rotulo="Horas máquina" valor={horas(r.horasHM)} />
              </div>

              <div className="bg-white rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[#4E5A60] bg-[#EFE9DF] border-b">
                      <th className="py-2 px-4 font-semibold"></th>
                      <th className="py-2 px-4 font-semibold text-right">Hora homem</th>
                      <th className="py-2 px-4 font-semibold text-right">Hora máquina</th>
                      {r.custoTurmas > 0 && <th className="py-2 px-4 font-semibold text-right">Diárias turma</th>}
                      <th className="py-2 px-4 font-semibold text-right">Produtos</th>
                      <th className="py-2 px-4 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2.5 px-4 font-medium">Custo total</td>
                      <td className="py-2.5 px-4 text-right">{brl(r.custoHH)}</td>
                      <td className="py-2.5 px-4 text-right">{brl(r.custoHM)}</td>
                      {r.custoTurmas > 0 && <td className="py-2.5 px-4 text-right">{brl(r.custoTurmas)}</td>}
                      <td className="py-2.5 px-4 text-right">{brl(r.custoProdutos)}</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{brl(r.custoTotal)}</td>
                    </tr>
                    <tr className="bg-green-50">
                      <td className="py-2.5 px-4 font-medium">Custo por hectare</td>
                      <td className="py-2.5 px-4 text-right">{brl(r.porHa.hh)}</td>
                      <td className="py-2.5 px-4 text-right">{brl(r.porHa.hm)}</td>
                      {r.custoTurmas > 0 && <td className="py-2.5 px-4 text-right">{brl(r.porHa.turmas)}</td>}
                      <td className="py-2.5 px-4 text-right">{brl(r.porHa.produtos)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-green-800 text-base">{brl(r.porHa.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 bg-grafite flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">Talhões</p>
                  {abertos > 0 && (
                    <button onClick={encerrarTodos} disabled={salvandoEnc} className="text-xs bg-white/10 text-white border border-white/30 rounded-full px-3 py-1 hover:bg-white/20 disabled:opacity-50">
                      Encerrar todos em aberto ({abertos})
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[#4E5A60] bg-[#EFE9DF] border-b">
                        <th className="py-2 px-4 font-semibold">Talhão</th>
                        <th className="py-2 px-4 font-semibold text-right">Área (ha)</th>
                        <th className="py-2 px-4 font-semibold">Início</th>
                        <th className="py-2 px-4 font-semibold">Situação</th>
                        <th className="py-2 px-4 font-semibold text-right">H. homem</th>
                        <th className="py-2 px-4 font-semibold text-right">H. máquina</th>
                        <th className="py-2 px-4 font-semibold text-right">Mão de obra + máq.</th>
                        <th className="py-2 px-4 font-semibold text-right">Produtos</th>
                        <th className="py-2 px-4 font-semibold text-right">Custo total</th>
                        <th className="py-2 px-4 font-semibold text-right">Custo / ha</th>
                        <th className="py-2 px-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rel.talhoes.map((t, i) => (
                        <tr key={t.talhaoId} className={'border-b last:border-0 ' + (i % 2 === 1 ? 'bg-gray-50' : '')}>
                          <td className="py-2.5 px-4 font-medium text-gray-800">{t.nome}</td>
                          <td className="py-2.5 px-4 text-right">{num(t.area)}</td>
                          <td className="py-2.5 px-4 whitespace-nowrap">{dataBR(t.inicio)}</td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {t.talhaoId === SEM_TALHAO ? '-' : t.encerramento
                              ? <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">Encerrado {dataBR(t.encerramento.dataFim)}</span>
                              : <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">Em andamento</span>}
                          </td>
                          <td className="py-2.5 px-4 text-right">{num(t.horasHH, 1)}</td>
                          <td className="py-2.5 px-4 text-right">{num(t.horasHM, 1)}</td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">{brl(t.custoHH + t.custoHM + t.custoTurmas)}</td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">{brl(t.custoProdutos)}</td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap font-semibold">{brl(t.custoTotal)}</td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap font-semibold text-green-800">{brl(t.custoPorHa)}</td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            {t.talhaoId !== SEM_TALHAO && (t.encerramento
                              ? <button onClick={() => reabrir(t)} className="text-xs text-gray-600 border border-gray-300 rounded-full px-2.5 py-1 hover:bg-gray-100">Reabrir</button>
                              : <button onClick={() => setEncerrando({ talhaoId: t.talhaoId, nome: t.nome, data: t.ultimoLancamento || t.inicio || new Date().toISOString().slice(0, 10) })} className="text-xs text-green-700 border border-green-300 rounded-full px-2.5 py-1 hover:bg-green-50">Encerrar</button>)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-grafite"><p className="text-sm font-semibold text-white">Funcionários</p></div>
                  {rel.funcionarios.length === 0 && rel.turmas.length === 0 ? (
                    <p className="text-sm text-gray-400 p-4">Nenhum registro de atividade</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-[#4E5A60] bg-[#EFE9DF] border-b">
                            <th className="py-2 px-4 font-semibold">Nome</th>
                            <th className="py-2 px-4 font-semibold text-right">Dias</th>
                            <th className="py-2 px-4 font-semibold text-right">H. homem</th>
                            <th className="py-2 px-4 font-semibold text-right">H. máquina</th>
                            <th className="py-2 px-4 font-semibold">Talhões</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rel.funcionarios.map(f => (
                            <tr key={f.funcionarioId} className="border-b last:border-0">
                              <td className="py-2 px-4 font-medium text-gray-800">{f.nome}</td>
                              <td className="py-2 px-4 text-right">{f.dias}</td>
                              <td className="py-2 px-4 text-right">{num(f.horasHH, 1)}</td>
                              <td className="py-2 px-4 text-right">{num(f.horasHM, 1)}</td>
                              <td className="py-2 px-4 text-gray-600">{f.talhoes.join(', ')}</td>
                            </tr>
                          ))}
                          {rel.turmas.map(t => (
                            <tr key={t.turmaId} className="border-b last:border-0 bg-blue-50/50">
                              <td className="py-2 px-4 font-medium text-gray-800">Turma {t.nome}</td>
                              <td className="py-2 px-4 text-right">{t.dias}</td>
                              <td className="py-2 px-4 text-right text-gray-600" colSpan={2}>{num(t.pessoasDia, 1)} pessoas×dia</td>
                              <td className="py-2 px-4 text-gray-600">{brl(t.valorTotal)} em diárias</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-grafite"><p className="text-sm font-semibold text-white">Produtos usados</p></div>
                  {rel.produtos.length === 0 ? (
                    <p className="text-sm text-gray-400 p-4">Nenhum produto lançado na aba Produtos por Atividade</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-[#4E5A60] bg-[#EFE9DF] border-b">
                            <th className="py-2 px-4 font-semibold">Produto</th>
                            <th className="py-2 px-4 font-semibold text-right">Quantidade</th>
                            <th className="py-2 px-4 font-semibold text-right">Qtd / ha</th>
                            <th className="py-2 px-4 font-semibold text-right">Custo</th>
                            <th className="py-2 px-4 font-semibold text-right">Custo / ha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rel.produtos.map(p => (
                            <tr key={p.produtoId} className="border-b last:border-0">
                              <td className="py-2 px-4 font-medium text-gray-800">{p.nome}</td>
                              <td className="py-2 px-4 text-right whitespace-nowrap">{num(p.quantidade, 3)} {p.unidade}</td>
                              <td className="py-2 px-4 text-right whitespace-nowrap">{num(p.quantidadePorHa, 3)} {p.unidade}</td>
                              <td className="py-2 px-4 text-right whitespace-nowrap">{brl(p.custo)}</td>
                              <td className="py-2 px-4 text-right whitespace-nowrap">{brl(p.custoPorHa)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {encerrando && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">Encerrar {encerrando.nome}</h3>
            <p className="text-sm text-gray-600">{atividade} — o talhão passa a contar como concluído nesta safra.</p>
            <div>
              <label className="block text-sm font-medium mb-1">Data de término</label>
              <input type="date" value={encerrando.data} onChange={e => setEncerrando({ ...encerrando, data: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEncerrando(null)} className="px-4 py-2 text-sm border rounded-lg">Cancelar</button>
              <button onClick={confirmarEncerramento} disabled={salvandoEnc || !encerrando.data} className="px-4 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-60">{salvandoEnc ? 'Salvando...' : 'Encerrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
