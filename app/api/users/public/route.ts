import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

    return NextResponse.json(
      { success: true, data: users },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      }
    )
  } catch (error) {
    console.error('GET /api/users/public:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
