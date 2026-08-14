import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { paraDataBrasilia } from '@/lib/dataBrasilia'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Apenas GESTOR ou GERENTE podem editar abastecimentos' }, { status: 403 })
    }

    const body = await request.json()
    const { data, horimetroAnterior, horimetroAtual, litrosAbastecidos, confirmarCascata } = body

    if (data == null || horimetroAnterior == null || horimetroAtual == null || litrosAbastecidos == null) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }
    if (Number(horimetroAtual) <= Number(horimetroAnterior)) {
      return NextResponse.json({ error: 'Horímetro atual deve ser maior que o horímetro anterior' }, { status: 400 })
    }
    if (Number(litrosAbastecidos) <= 0) {
      return NextResponse.json({ error: 'Litros deve ser maior que zero' }, { status: 400 })
    }

    const atual = await prisma.abastecimentoTrator.findUnique({
      where: { id: params.id },
      include: { saidaProduto: true },
    })
    if (!atual) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }

    const novaData = paraDataBrasilia(data)
    const novoAnterior = Number(horimetroAnterior)
    const novoAtual = Number(horimetroAtual)
    const novosLitros = Number(litrosAbastecidos)

    // Trava física: mesma checagem de plausibilidade usada no cadastro
    // (POST /api/abastecimentos) — a edição não pode indicar mais horas
    // de uso do que o tempo real decorrido desde a última leitura
    // conhecida dessa máquina (abastecimento ou ajuste de horímetro
    // mais recente antes da nova data, excluindo o próprio registro em
    // edição). É essa checagem que teria pego o erro de digitação do
    // trator 3306 antes de distorcer o histórico.
    const [abastecimentoAnterior, ajusteAnterior] = await Promise.all([
      prisma.abastecimentoTrator.findFirst({
        where: { maquinaId: atual.maquinaId, data: { lt: novaData }, id: { not: params.id } },
        orderBy: { data: 'desc' },
      }),
      prisma.ajusteHorimetro.findFirst({
        where: { maquinaId: atual.maquinaId, data: { lt: novaData } },
        orderBy: { data: 'desc' },
      }),
    ])

    let horimetroReferencia = 0
    let dataReferencia: Date | null = null
    let origemReferencia = ''
    if (abastecimentoAnterior && (!ajusteAnterior || abastecimentoAnterior.data >= ajusteAnterior.data)) {
      horimetroReferencia = abastecimentoAnterior.horimetroAtual
      dataReferencia = abastecimentoAnterior.data
      origemReferencia = `abastecimento anterior (${new Date(abastecimentoAnterior.data).toLocaleDateString('pt-BR')})`
    } else if (ajusteAnterior) {
      horimetroReferencia = ajusteAnterior.horimetroNovo
      dataReferencia = ajusteAnterior.data
      origemReferencia = `ajuste de horímetro (${new Date(ajusteAnterior.data).toLocaleDateString('pt-BR')})`
    }
    if (dataReferencia) {
      // O horímetro anterior digitado precisa bater com o último
      // lançamento conhecido dessa máquina — é justamente essa
      // conferência que faltava no cadastro original e que teria
      // pego o dígito perdido do trator 3306. Tolerância de 1h pra
      // cobrir pequenas divergências legítimas (arredondamento etc.).
      const TOLERANCIA_HORAS = 1
      const divergencia = Math.abs(novoAnterior - horimetroReferencia)
      if (divergencia > TOLERANCIA_HORAS) {
        return NextResponse.json(
          {
            error: `O horímetro anterior digitado (${novoAnterior.toFixed(1)}h) não bate com o último lançamento conhecido dessa máquina (${horimetroReferencia.toFixed(1)}h, registrado em ${origemReferencia}). Confira o valor.`,
          },
          { status: 400 }
        )
      }

      const elapsedHoras = (novaData.getTime() - dataReferencia.getTime()) / (1000 * 60 * 60)
      const horasImplicadas = novoAtual - novoAnterior
      if (horasImplicadas > elapsedHoras) {
        return NextResponse.json(
          {
            error: `Horímetro implausível: essa edição indicaria ${horasImplicadas.toFixed(1)}h de uso da máquina, mas só se passaram ${elapsedHoras.toFixed(1)}h desde o(a) ${origemReferencia}. Confira o valor digitado.`,
          },
          { status: 400 }
        )
      }
    }

    // Próximo lançamento cronológico da mesma máquina — usado pra
    // cascata de horímetro anterior quando o horímetro atual muda.
    const proximo = await prisma.abastecimentoTrator.findFirst({
      where: { maquinaId: atual.maquinaId, data: { gt: novaData }, id: { not: params.id } },
      orderBy: { data: 'asc' },
    })

    const horimetroAtualMudou = novoAtual !== atual.horimetroAtual

    if (proximo && horimetroAtualMudou) {
      if (proximo.horimetroAtual <= novoAtual) {
        return NextResponse.json(
          {
            error: `Não é possível salvar: o próximo lançamento dessa máquina (${new Date(proximo.data).toLocaleDateString('pt-BR')}) tem horímetro atual de ${proximo.horimetroAtual}h, que ficaria menor ou igual ao novo horímetro atual (${novoAtual}h). Corrija o próximo lançamento primeiro.`,
          },
          { status: 400 }
        )
      }

      if (!confirmarCascata) {
        return NextResponse.json({
          success: false,
          needsConfirmation: true,
          cascade: {
            proximoId: proximo.id,
            proximoData: proximo.data,
            horimetroAnteriorAntigo: proximo.horimetroanterior,
            horimetroAnteriorNovo: novoAtual,
          },
        })
      }
    }

    const horasTrabalhadad = Math.max(0, novoAtual - novoAnterior)
    const consumoLporH = horasTrabalhadad > 0 ? novosLitros / horasTrabalhadad : 0
    const custoAbastecimento = novosLitros * atual.valorPorLitro

    // Correção de bug: editar os litros de um abastecimento precisa
    // refletir no estoque de diesel (Produto.quantidadeEstoque, a
    // SaidaProduto vinculada e o EstoqueLocal do local dessa saída) —
    // antes desta correção, só o registro de AbastecimentoTrator era
    // atualizado, deixando o estoque dessincronizado da saída real.
    const litrosAntigos = atual.litrosAbastecidos
    const deltaLitros = novosLitros - litrosAntigos

    if (atual.saidaProduto && deltaLitros > 0) {
      const saldoLocalAtual = atual.saidaProduto.localId
        ? (
            await prisma.estoqueLocal.findUnique({
              where: {
                produtoId_localId: { produtoId: atual.saidaProduto.produtoId, localId: atual.saidaProduto.localId },
              },
            })
          )?.quantidade ?? 0
        : (await prisma.produto.findUnique({ where: { id: atual.saidaProduto.produtoId } }))?.quantidadeEstoque ?? 0

      if (deltaLitros > saldoLocalAtual) {
        return NextResponse.json(
          {
            error: `Estoque de diesel insuficiente pra cobrir o aumento de litros: essa edição pede ${deltaLitros.toFixed(1)}L a mais do que o abastecimento original, mas só há ${saldoLocalAtual.toFixed(1)}L disponíveis. Registre uma entrada de diesel antes de aumentar os litros desse abastecimento.`,
          },
          { status: 400 }
        )
      }
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const editado = await tx.abastecimentoTrator.update({
        where: { id: params.id },
        data: {
          data: novaData,
          horimetroanterior: novoAnterior,
          horimetroAtual: novoAtual,
          litrosAbastecidos: novosLitros,
          horasTrabalhadad,
          consumoLporH,
          custoAbastecimento,
        },
        include: { maquina: true, talhao: true, safra: true },
      })

      if (atual.saidaProduto && deltaLitros !== 0) {
        await tx.saidaProduto.update({
          where: { id: atual.saidaProduto.id },
          data: { quantidade: novosLitros },
        })
        await tx.produto.update({
          where: { id: atual.saidaProduto.produtoId },
          data: { quantidadeEstoque: { decrement: deltaLitros } },
        })
        if (atual.saidaProduto.localId) {
          await tx.estoqueLocal.upsert({
            where: {
              produtoId_localId: { produtoId: atual.saidaProduto.produtoId, localId: atual.saidaProduto.localId },
            },
            create: { produtoId: atual.saidaProduto.produtoId, localId: atual.saidaProduto.localId, quantidade: -deltaLitros },
            update: { quantidade: { decrement: deltaLitros } },
          })
        }
      }

      let proximoAtualizado = null
      if (proximo && horimetroAtualMudou) {
        const horasTrabalhadadProximo = Math.max(0, proximo.horimetroAtual - novoAtual)
        const consumoLporHProximo =
          horasTrabalhadadProximo > 0 ? proximo.litrosAbastecidos / horasTrabalhadadProximo : 0
        proximoAtualizado = await tx.abastecimentoTrator.update({
          where: { id: proximo.id },
          data: {
            horimetroanterior: novoAtual,
            horasTrabalhadad: horasTrabalhadadProximo,
            consumoLporH: consumoLporHProximo,
          },
          include: { maquina: true, talhao: true, safra: true },
        })
      }

      return { editado, proximo: proximoAtualizado }
    })

    const maquinaAtual = await prisma.maquina.findUnique({ where: { id: atual.maquinaId } })
    if (maquinaAtual && novoAtual > (maquinaAtual.ultimoHorimetro || 0)) {
      await prisma.maquina.update({
        where: { id: atual.maquinaId },
        data: { ultimoHorimetro: novoAtual },
      })
    }

    return NextResponse.json({ success: true, data: resultado })
  } catch (error) {
    console.error('PATCH /api/abastecimentos/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const abastecimento = await prisma.abastecimentoTrator.findUnique({
      where: { id: params.id },
      include: { saidaProduto: true },
    })

    if (!abastecimento) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // Se tinha uma Saída de Produto vinculada (diesel debitado), credita
      // de volta pro estoque e remove a saída — pra não deixar entrada
      // "solta" no histórico nem estoque incorreto. Se essa saída tiver
      // localId (abastecimentos novos sempre têm, sempre FAZ), credita
      // de volta também no EstoqueLocal correspondente.
      if (abastecimento.saidaProduto) {
        await tx.produto.update({
          where: { id: abastecimento.saidaProduto.produtoId },
          data: { quantidadeEstoque: { increment: abastecimento.saidaProduto.quantidade } },
        })
        if (abastecimento.saidaProduto.localId) {
          await tx.estoqueLocal.upsert({
            where: {
              produtoId_localId: {
                produtoId: abastecimento.saidaProduto.produtoId,
                localId: abastecimento.saidaProduto.localId,
              },
            },
            create: {
              produtoId: abastecimento.saidaProduto.produtoId,
              localId: abastecimento.saidaProduto.localId,
              quantidade: abastecimento.saidaProduto.quantidade,
            },
            update: { quantidade: { increment: abastecimento.saidaProduto.quantidade } },
          })
        }
        await tx.abastecimentoTrator.delete({ where: { id: params.id } })
        await tx.saidaProduto.delete({ where: { id: abastecimento.saidaProduto.id } })
      } else {
        await tx.abastecimentoTrator.delete({ where: { id: params.id } })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/abastecimentos/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
