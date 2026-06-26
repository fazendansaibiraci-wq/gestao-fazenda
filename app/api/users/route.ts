import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET: Listar todos os usuários
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GESTOR e GERENTE podem listar usuários
    const userRole = (session.user as any)?.role
    if (userRole !== 'GESTOR' && userRole !== 'GERENTE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error('GET /api/users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Criar novo usuário
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GESTOR e GERENTE podem criar usuários
    const userRole = (session.user as any)?.role
    if (userRole !== 'GESTOR' && userRole !== 'GERENTE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, password, role } = body

    // Validar campos obrigatórios
    if (!name || !password || !role) {
      return NextResponse.json(
        { error: 'Nome, senha e perfil são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se usuário já existe
    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        return NextResponse.json({ error: 'Usuário com este email já existe' }, { status: 400 })
      }
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10)

    // Criar usuário
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role,
        active: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, data: newUser }, { status: 201 })
  } catch (error) {
    console.error('POST /api/users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Editar usuário
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GESTOR e GERENTE podem editar usuários
    const userRole = (session.user as any)?.role
    if (userRole !== 'GESTOR' && userRole !== 'GERENTE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, email, role, password } = body

    if (!id) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 })
    }

    // Verificar se usuário existe
    const existingUser = await prisma.user.findUnique({ where: { id } })
    if (!existingUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Se email foi alterado, verificar se já existe outro usuário com ele
    if (email && email !== existingUser.email) {
      const userWithEmail = await prisma.user.findUnique({ where: { email } })
      if (userWithEmail) {
        return NextResponse.json({ error: 'Já existe outro usuário com este email' }, { status: 400 })
      }
    }

    // Preparar dados para atualização
    const updateData: any = {}
    if (name) updateData.name = name
    if (email) updateData.email = email
    if (role) updateData.role = role
    if (password) updateData.password = await bcrypt.hash(password, 10)

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, data: updatedUser })
  } catch (error) {
    console.error('PUT /api/users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Desativar ou deletar permanentemente usuário
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GESTOR pode desativar/deletar usuários
    const userRole = (session.user as any)?.role
    if (userRole !== 'GESTOR') {
      return NextResponse.json({ error: 'Apenas GESTOR pode gerenciar usuários' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    const action = searchParams.get('action')

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 })
    }

    // Não permitir desativar/deletar a si mesmo
    if (userId === session.user?.id) {
      return NextResponse.json({ error: 'Você não pode desativar/deletar sua própria conta' }, { status: 400 })
    }

    if (action === 'delete') {
      // Deletar permanentemente
      const deletedUser = await prisma.user.delete({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          createdAt: true,
        },
      })
      return NextResponse.json({ success: true, data: deletedUser })
    } else {
      // Desativar usuário (padrão)
      const deactivatedUser = await prisma.user.update({
        where: { id: userId },
        data: { active: false },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          createdAt: true,
        },
      })
      return NextResponse.json({ success: true, data: deactivatedUser })
    }
  } catch (error) {
    console.error('DELETE /api/users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Reativar usuário
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GESTOR pode reativar usuários
    const userRole = (session.user as any)?.role
    if (userRole !== 'GESTOR') {
      return NextResponse.json({ error: 'Apenas GESTOR pode reativar usuários' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    const action = searchParams.get('action')

    if (!userId) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 })
    }

    if (action === 'reactivate') {
      // Reativar usuário
      const reactivatedUser = await prisma.user.update({
        where: { id: userId },
        data: { active: true },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          createdAt: true,
        },
      })
      return NextResponse.json({ success: true, data: reactivatedUser })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    console.error('PATCH /api/users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
