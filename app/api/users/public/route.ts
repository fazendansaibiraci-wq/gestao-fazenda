import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { 
        active: true,
        role: { in: ['GESTOR', 'GERENTE', 'FUNCIONARIO', 'AGRONOMO'] }
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error('GET /api/users/public:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
