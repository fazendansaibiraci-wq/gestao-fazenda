// Gera o PDF de registro diário de um funcionário (entrada/saída, horas
// trabalhadas, carga contratual, extras/devidas) para um período — pensado
// pra servir de espelho de ponto pra conferência, similar ao formato de
// sistemas de apuração de ponto por biometria.
//
// Roda inteiramente no navegador (não precisa de rota de API nova): a
// página de Resumo Mensal já carrega esse dado do /api/resumo-mensal, então
// só reaproveitamos o que já está em memória.
//
// Segue o mesmo padrão de jsPDF + jspdf-autotable já usado em
// app/api/painel/folha-pagamento/exportar/route.ts.

import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import type { RegistroDiario } from '@/components/RegistroDiarioCard'

const fmtH = (h: number) => {
  const horas = Math.floor(h)
  const minutos = Math.round((h - horas) * 60)
  return `${horas}h${minutos.toString().padStart(2, '0')}`
}

const fmtData = (iso: string) => {
  const d = new Date(iso)
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm} ${dias[d.getUTCDay()]}`
}

interface ExportarRegistroDiarioParams {
  nomeFuncionario: string
  mesLabel: string // ex: "Agosto"
  ano: number
  registrosDiarios: RegistroDiario[]
}

export function exportarRegistroDiarioPdf({
  nomeFuncionario,
  mesLabel,
  ano,
  registrosDiarios,
}: ExportarRegistroDiarioParams) {
  const pdf = new jsPDF()

  pdf.setFontSize(14)
  pdf.text('Registro de Atividades — Espelho Mensal', 105, 15, { align: 'center' })

  pdf.setFontSize(10)
  pdf.text(`Funcionário: ${nomeFuncionario}`, 14, 25)
  pdf.text(`Período: ${mesLabel}/${ano}`, 14, 31)

  const linhas = [...registrosDiarios].sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
  )

  const tableData = linhas.map((dia) => {
    if (dia.isFalta) {
      return [fmtData(dia.data), '—', '—', 'FALTA', fmtH(dia.cargaContratual), '—', '—']
    }
    if (dia.isFolga) {
      return [fmtData(dia.data), '—', '—', 'FOLGA', '—', '—', '—']
    }
    return [
      fmtData(dia.data),
      dia.horaEntrada ?? '—',
      dia.horaSaida ?? '—',
      fmtH(dia.horasTrabalhadas),
      fmtH(dia.cargaContratual),
      dia.horasExtras > 0 ? fmtH(dia.horasExtras) : '—',
      dia.horasDevidas > 0 ? fmtH(dia.horasDevidas) : '—',
    ]
  })

  const totalHorasTrabalhadas = linhas.reduce((acc, d) => acc + (d.isFalta || d.isFolga ? 0 : d.horasTrabalhadas), 0)
  const totalExtras = linhas.reduce((acc, d) => acc + d.horasExtras, 0)
  const totalDevidas = linhas.reduce((acc, d) => acc + d.horasDevidas, 0)
  const totalFaltas = linhas.filter((d) => d.isFalta).length

  ;(pdf as any).autoTable({
    startY: 37,
    head: [['Data', 'Entrada', 'Saída', 'Horas Trab.', 'Carga Contratual', 'Extras', 'Devidas']],
    body: tableData,
    foot: [[
      `TOTAL (${totalFaltas} falta${totalFaltas === 1 ? '' : 's'})`,
      '', '',
      fmtH(totalHorasTrabalhadas), '',
      fmtH(totalExtras),
      fmtH(totalDevidas),
    ]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [45, 106, 79] }, // verde da identidade visual do app
    footStyles: { fillColor: [232, 232, 232], textColor: [0, 0, 0], fontStyle: 'bold' },
  })

  const nomeArquivo = `registro_${nomeFuncionario.replace(/\s+/g, '_').toLowerCase()}_${mesLabel.toLowerCase()}_${ano}.pdf`
  pdf.save(nomeArquivo)
}
