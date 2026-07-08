import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const funcionario = await prisma.user.findUnique({
      where: { id: params.id },
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
        valorHoraExtraEntressafra: true,
        valorHoraExtraSafra: true,
        cargaHorariaSafra: true,
        cargaHorariaSegSex: true,
        cargaHorariaSabado: true,
        cargaHorariaDomingo: true,
        domingosPorMes: true,
        bancoHorasAtivo: true,
        pagamentoProporcionalDiario: true,
      },
    })

    if (!funcionario) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: funcionario })
  } catch (error) {
    console.error('GET /api/funcionarios/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const funcionarioExistente = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!funcionarioExistente) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      )
    }

    if (body.email && body.email !== funcionarioExistente.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: body.email },
      })
      if (emailExists) {
        return NextResponse.json(
          { error: 'Email já cadastrado' },
          { status: 409 }
        )
      }
    }

    let updateData: any = {
      name: body.name || undefined,
      email: body.email || undefined,
      phone: body.phone,
      role: body.role || undefined,
      active: body.active !== undefined ? body.active : undefined,
      tipoSalario: body.tipoSalario || undefined,
      salarioEntressafra: body.salarioEntressafra ? parseFloat(body.salarioEntressafra) : undefined,
      salarioSafra: body.salarioSafra ? parseFloat(body.salarioSafra) : undefined,
      valorHoraExtraEntressafra: body.valorHoraExtraEntressafra ? parseFloat(body.valorHoraExtraEntressafra) : undefined,
      valorHoraExtraSafra: body.valorHoraExtraSafra ? parseFloat(body.valorHoraExtraSafra) : undefined,
      cargaHorariaSafra: body.cargaHorariaSafra ? parseFloat(body.cargaHorariaSafra) : null,
      cargaHorariaSegSex: body.cargaHorariaSegSex ? parseFloat(body.cargaHorariaSegSex) : null,
      cargaHorariaSabado: body.cargaHorariaSabado ? parseFloat(body.cargaHorariaSabado) : null,
      cargaHorariaDomingo: body.cargaHorariaDomingo ? parseFloat(body.cargaHorariaDomingo) : null,
      domingosPorMes: body.domingosPorMes !== undefined ? parseInt(body.domingosPorMes) : 2,
      bancoHorasAtivo: body.bancoHorasAtivo !== undefined ? body.bancoHorasAtivo : undefined,
      pagamentoProporcionalDiario: body.pagamentoProporcionalDiario !== undefined ? body.pagamentoProporcionalDiario === true : undefined,
    }

    if (body.password) {
      updateData.password = await bcrypt.hash(body.password, 10)
    }

    const funcionario = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: funcionario,
      message: 'Funcionário atualizado com sucesso',
    })
  } catch (error) {
    console.error('PUT /api/funcionarios/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const funcionario = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!funcionario) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      )
    }

    await prisma.user.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Funcionário deletado com sucesso',
    })
  } catch (error) {
    console.error('DELETE /api/funcionarios/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
