import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { put, del } from '@vercel/blob'
import { calcularCargaHorariaDia } from '@/lib/calculoCargaHoraria'
import { buscarPeriodosRegimeSalarial, obterRegimeNaData, mensagemPeriodoNaoCadastrado } from '@/lib/regimeSalarial'
import { buscarPeriodosComId, obterPeriodoNaData, buscarSalarioPeriodoFuncionario, mensagemSalarioNaoCadastrado, shimsParaCargaHoraria } from '@/lib/salarioPeriodo'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const registroId = formData.get('registroId') as string | null

    if (!file || !registroId) {
      return NextResponse.json({ error: 'Arquivo e registro são obrigatórios' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Só é permitido anexar arquivos PDF' }, { status: 400 })
    }

    if (file.size > 4.5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo maior que 4,5MB' }, { status: 400 })
    }

    const registro = await prisma.registroAtividade.findUnique({ where: { id: registroId } })
    if (!registro) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
    }

    const blob = await put(`atestados/${registroId}-${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
    })

    // Atestado anexado com sucesso: deixa de contar como falta e passa a
    // contar como dia normal trabalhado, creditando a carga horária cheia
    // do dia (sem desconto pro funcionário). Sem talhão, pois não é
    // atividade feita em nenhum lugar real.
    const funcionario = await prisma.user.findUnique({
      where: { id: registro.funcionarioId },
      select: { name: true },
    })

    // Regime salarial: determinado automaticamente pela data deste
    // registro, comparada contra os períodos cadastrados em
    // Configurações → Safra/Entressafra (ver lib/regimeSalarial.ts).
    const periodosComId = await buscarPeriodosComId()
    const periodoDoDia = obterPeriodoNaData(registro.data, periodosComId)
    if (!periodoDoDia) {
      return NextResponse.json({ error: mensagemPeriodoNaoCadastrado(registro.data) }, { status: 400 })
    }
    const estaNaSafra = periodoDoDia.tipo === 'SAFRA'

    // Salário/hora extra/jornada: cadastrados por funcionário e por
    // período em Funcionários → Salário Safra/Entressafra (ver
    // lib/salarioPeriodo.ts).
    const dadosSalario = await buscarSalarioPeriodoFuncionario(registro.funcionarioId, periodoDoDia.id)
    if (!dadosSalario) {
      return NextResponse.json(
        { error: mensagemSalarioNaoCadastrado(funcionario?.name || 'Funcionário', registro.data) },
        { status: 400 }
      )
    }
    const { funcionarioShim, configShim } = shimsParaCargaHoraria(dadosSalario)
    const cargaHorariaDia = calcularCargaHorariaDia(registro.data, funcionarioShim, configShim, false, estaNaSafra)

    const atualizado = await prisma.registroAtividade.update({
      where: { id: registroId },
      data: {
        atestadoUrl: blob.url,
        isFalta: false,
        talhaoId: null,
        tipoAtividade: 'ATESTADO_MEDICO',
        horasCalculadas: cargaHorariaDia,
        horasprevistasdia: cargaHorariaDia,
      },
    })

    return NextResponse.json({ success: true, data: atualizado })
  } catch (error) {
    console.error('POST /api/registros-atividade/atestado:', error)
    return NextResponse.json({ error: 'Erro ao enviar o atestado' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const registroId = searchParams.get('registroId')

    if (!registroId) {
      return NextResponse.json({ error: 'registroId é obrigatório' }, { status: 400 })
    }

    const registro = await prisma.registroAtividade.findUnique({ where: { id: registroId } })
    if (!registro) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
    }

    if (registro.atestadoUrl) {
      try {
        await del(registro.atestadoUrl)
      } catch (err) {
        console.error('Erro ao apagar blob do atestado (seguindo mesmo assim):', err)
      }
    }

    // Remover o atestado reverte o registro pra falta de novo — sem prova
    // anexada, volta a contar como ausência não justificada.
    await prisma.registroAtividade.update({
      where: { id: registroId },
      data: {
        atestadoUrl: null,
        isFalta: true,
        talhaoId: null,
        tipoAtividade: 'GERAIS',
        horasCalculadas: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/registros-atividade/atestado:', error)
    return NextResponse.json({ error: 'Erro ao remover o atestado' }, { status: 500 })
  }
}
