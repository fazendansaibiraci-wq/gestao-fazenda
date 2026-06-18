import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const receitas = await prisma.receitaAplicacao.findMany({
      include: {
        produtosAplicacao: {
          include: {
            produto: {
              select: {
                id: true,
                nomeComercial: true,
                unidadeMedida: true,
              },
            },
          },
        },
      },
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json({ success: true, data: receitas })
  } catch (error) {
    console.error('GET /api/receitas:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.nome || !body.tipo) {
      return NextResponse.json(
        { error: 'Nome e tipo são obrigatórios' },
        { status: 400 }
      )
    }

    if (!body.produtos || body.produtos.length === 0) {
      return NextResponse.json(
        { error: 'Receita deve ter pelo menos um produto' },
        { status: 400 }
      )
    }

    // Verificar se receita com esse nome já existe
    const existente = await prisma.receitaAplicacao.findUnique({
      where: { nome: body.nome },
    })

    if (existente) {
      return NextResponse.json(
        { error: 'Receita com este nome já existe' },
        { status: 409 }
      )
    }

    // Criar receita com produtos
    const receita = await prisma.receitaAplicacao.create({
      data: {
        nome: body.nome,
        tipo: body.tipo,
        observacoes: body.observacoes || null,
        ativo: body.ativo !== false,
        produtosAplicacao: {
          create: body.produtos.map((p: any) => ({
            produtoId: p.produtoId,
            dosagem: parseFloat(p.dosagem),
            unidade: p.unidade,
          })),
        },
      },
      include: {
        produtosAplicacao: {
          include: {
            produto: {
              select: {
                id: true,
                nomeComercial: true,
                unidadeMedida: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: receita }, { status: 201 })
  } catch (error) {
    console.error('POST /api/receitas:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, nome, tipo, observacoes, ativo, produtos } = body

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    // Verificar se receita existe
    const receitaExistente = await prisma.receitaAplicacao.findUnique({
      where: { id },
    })

    if (!receitaExistente) {
      return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 })
    }

    // Verificar se novo nome já existe (se foi alterado)
    if (nome && nome !== receitaExistente.nome) {
      const receitaComNome = await prisma.receitaAplicacao.findUnique({
        where: { nome },
      })
      if (receitaComNome) {
        return NextResponse.json(
          { error: 'Receita com este nome já existe' },
          { status: 409 }
        )
      }
    }

    // Deletar produtos antigos se novos foram fornecidos
    if (produtos && produtos.length > 0) {
      await prisma.produtoAplicacao.deleteMany({
        where: { receitaId: id },
      })
    }

    // Atualizar receita
    const receita = await prisma.receitaAplicacao.update({
      where: { id },
      data: {
        nome: nome || undefined,
        tipo: tipo || undefined,
        observacoes: observacoes !== undefined ? observacoes : undefined,
        ativo: ativo !== undefined ? ativo : undefined,
        produtosAplicacao:
          produtos && produtos.length > 0
            ? {
                create: produtos.map((p: any) => ({
                  produtoId: p.produtoId,
                  dosagem: parseFloat(p.dosagem),
                  unidade: p.unidade,
                })),
              }
            : undefined,
      },
      include: {
        produtosAplicacao: {
          include: {
            produto: {
              select: {
                id: true,
                nomeComercial: true,
                unidadeMedida: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: receita })
  } catch (error) {
    console.error('PUT /api/receitas:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const receita = await prisma.receitaAplicacao.findUnique({ where: { id } })

    if (!receita) {
      return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 })
    }

    await prisma.receitaAplicacao.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Receita deletada com sucesso',
    })
  } catch (error) {
    console.error('DELETE /api/receitas:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
