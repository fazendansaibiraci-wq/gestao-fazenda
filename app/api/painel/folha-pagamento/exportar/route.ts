import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { getDaysInMonth, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.user?.role !== 'GESTOR' && session.user?.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7)
    const formato = searchParams.get('formato') || 'xlsx' // xlsx ou pdf

    const [ano, mesNum] = mes.split('-').map(Number)
    const mesStart = startOfMonth(new Date(ano, mesNum - 1))
    const mesEnd = endOfMonth(new Date(ano, mesNum - 1))
    const diasUteisDoMes = getDaysInMonth(new Date(ano, mesNum - 1))

    // Buscar todos os funcionários
    const funcionarios = await prisma.user.findMany({
      where: {
        role: 'FUNCIONARIO',
        active: true,
        tipoSalario: { not: null },
      },
    })

    // Calcular dados de cada funcionário
    const folha = await Promise.all(
      funcionarios.map(async (func) => {
        // Dias trabalhados
        const registrosAtividade = await prisma.registroAtividade.count({
          where: {
            funcionarioId: func.id,
            data: {
              gte: mesStart,
              lte: mesEnd,
            },
          },
        })

        // Salário base
        let salarioBase = 0
        if (func.tipoSalario === 'MENSAL' && func.salarioEntressafra) {
          const horasDiaUtil = 8
          const horasUteisDoMes = diasUteisDoMes * horasDiaUtil
          const valorHora = func.salarioEntressafra / horasUteisDoMes
          salarioBase = valorHora * horasDiaUtil * registrosAtividade
        } else if (func.tipoSalario === 'DIARIO' && func.salarioEntressafra) {
          salarioBase = func.salarioEntressafra * registrosAtividade
        }

        // Horas extras aprovadas
        const horasExtrasAp = await prisma.aprovacaoHoraExtra.aggregate({
          where: {
            funcionarioId: func.id,
            status: 'aprovado',
            aprovadoEm: {
              gte: mesStart,
              lte: mesEnd,
            },
          },
          _sum: { horasExtras: true },
        })

        const horasExtrasValue = (horasExtrasAp._sum.horasExtras || 0) *
          (func.valorHoraExtraEntressafra || 0)

        // Vales
        const vales = await prisma.vale.aggregate({
          where: {
            usuarioId: func.id,
            mesPagamento: mes,
            status: { in: ['PENDENTE', 'DESCONTADO'] },
          },
          _sum: { valor: true },
        })

        // Descontos
        const banco = await prisma.bancoHoras.findUnique({
          where: { funcionarioId: func.id },
        })

        const horasNegativas = Math.max(0, -(banco?.saldoHoras || 0))
        const desconto = horasNegativas * ((func.salarioEntressafra || 0) / (diasUteisDoMes * 8))

        const liquido = salarioBase + horasExtrasValue - (vales._sum.valor || 0) - desconto

        return {
          nome: func.name,
          diasTrabalhados: registrosAtividade,
          salarioBase,
          horasExtras: horasExtrasValue,
          vales: vales._sum.valor || 0,
          descontos: desconto,
          liquido,
          bancoHoras: banco?.saldoHoras || 0,
        }
      })
    )

    // ============ EXPORTAR XLSX ============
    if (formato === 'xlsx') {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Folha de Pagamento')

      // Cabeçalho
      worksheet.mergeCells('A1', 'H1')
      const headerCell = worksheet.getCell('A1')
      headerCell.value = `FOLHA DE PAGAMENTO - ${mes}`
      headerCell.font = { bold: true, size: 14 }
      headerCell.alignment = { horizontal: 'center', vertical: 'center' }

      // Colunas
      worksheet.columns = [
        { header: 'Funcionário', key: 'nome', width: 20 },
        { header: 'Dias Trab.', key: 'diasTrabalhados', width: 12 },
        { header: 'Salário Base', key: 'salarioBase', width: 15 },
        { header: 'Horas Extras', key: 'horasExtras', width: 15 },
        { header: 'Vales', key: 'vales', width: 12 },
        { header: 'Descontos', key: 'descontos', width: 12 },
        { header: 'Líquido', key: 'liquido', width: 15 },
        { header: 'Banco Horas', key: 'bancoHoras', width: 12 },
      ]

      // Dados
      folha.forEach((f) => {
        worksheet.addRow({
          nome: f.nome,
          diasTrabalhados: f.diasTrabalhados,
          salarioBase: f.salarioBase,
          horasExtras: f.horasExtras,
          vales: f.vales,
          descontos: f.descontos,
          liquido: f.liquido,
          bancoHoras: f.bancoHoras,
        })
      })

      // Totais
      const totalRow = worksheet.addRow({
        nome: 'TOTAL',
        diasTrabalhados: '',
        salarioBase: folha.reduce((s, f) => s + f.salarioBase, 0),
        horasExtras: folha.reduce((s, f) => s + f.horasExtras, 0),
        vales: folha.reduce((s, f) => s + f.vales, 0),
        descontos: folha.reduce((s, f) => s + f.descontos, 0),
        liquido: folha.reduce((s, f) => s + f.liquido, 0),
        bancoHoras: '',
      })

      // Formatação
      totalRow.font = { bold: true }
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } }

      // Formato moeda
      worksheet.eachRow((row) => {
        ;[3, 4, 5, 6, 7, 8].forEach((col) => {
          const cell = row.getCell(col)
          cell.numFmt = 'R$ #,##0.00'
        })
      })

      // Gerar arquivo
      const buffer = await workbook.xlsx.writeBuffer()
      const filename = `folha_pagamento_${mes}.xlsx`

      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // ============ EXPORTAR PDF ============
    if (formato === 'pdf') {
      const pdf = new jsPDF()
      pdf.setFontSize(16)
      pdf.text(`FOLHA DE PAGAMENTO - ${mes}`, 105, 15, { align: 'center' })

      const tableData = folha.map((f) => [
        f.nome,
        f.diasTrabalhados,
        `R$ ${f.salarioBase.toFixed(2)}`,
        `R$ ${f.horasExtras.toFixed(2)}`,
        `R$ ${f.vales.toFixed(2)}`,
        `R$ ${f.descontos.toFixed(2)}`,
        `R$ ${f.liquido.toFixed(2)}`,
      ])

      ;(pdf as any).autoTable({
        startY: 25,
        head: [['Funcionário', 'Dias', 'Base', 'Extras', 'Vales', 'Descontos', 'Líquido']],
        body: tableData,
        foot: [
          [
            'TOTAL',
            '',
            `R$ ${folha.reduce((s, f) => s + f.salarioBase, 0).toFixed(2)}`,
            `R$ ${folha.reduce((s, f) => s + f.horasExtras, 0).toFixed(2)}`,
            `R$ ${folha.reduce((s, f) => s + f.vales, 0).toFixed(2)}`,
            `R$ ${folha.reduce((s, f) => s + f.descontos, 0).toFixed(2)}`,
            `R$ ${folha.reduce((s, f) => s + f.liquido, 0).toFixed(2)}`,
          ],
        ],
      })

      const pdfBuffer = pdf.output('arraybuffer')
      const filename = `folha_pagamento_${mes}.pdf`

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json({ error: 'Formato inválido (xlsx ou pdf)' }, { status: 400 })
  } catch (error) {
    console.error('GET /api/painel/folha-pagamento/exportar:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
