import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const funcionarios = await prisma.user.findMany({
      where: {
        role: { in: ['FUNCIONARIO', 'GERENTE', 'AGRONOMO'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        tipoSalario: true,
        salarioEntressafra: true,
        salarioSafra: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: funcionarios,
    })
  } catch (error) {
    console.error('GET /api/funcionarios:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validações
    if (!body.name || !body.email || !body.password) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 409 }
      )
    }

    // Hash da senha com bcrypt
    const hashedPassword = await bcrypt.hash(body.password, 10)

    // Criar funcionário
    const funcionario = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        phone: body.phone,
        role: body.role || 'FUNCIONARIO',
        active: body.active !== false,
        tipoSalario: body.tipoSalario,
        salarioEntressafra: body.salarioEntressafra ? parseFloat(body.salarioEntressafra) : null,
        salarioSafra: body.salarioSafra ? parseFloat(body.salarioSafra) : null,
        valorHoraExtraEntressafra: body.valorHoraExtraEntressafra ? parseFloat(body.valorHoraExtraEntressafra) : null,
        valorHoraExtraSafra: body.valorHoraExtraSafra ? parseFloat(body.valorHoraExtraSafra) : null,
        bancoHorasAtivo: body.bancoHorasAtivo || false,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: funcionario,
        message: 'Funcionário criado com sucesso',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/funcionarios:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
