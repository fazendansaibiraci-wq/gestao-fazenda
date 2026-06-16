import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando população do banco de dados...')

  // Criar usuário admin
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@fazenda.com',
      password: 'admin123', // Em produção, usar bcrypt
      name: 'Administrador',
      role: UserRole.GESTOR,
      active: true,
    },
  })

  console.log('✓ Usuário admin criado:', adminUser.email)

  // Criar usuário gerente
  const gerenteUser = await prisma.user.create({
    data: {
      email: 'gerente@fazenda.com',
      password: 'gerente123',
      name: 'Gerente de Produção',
      role: UserRole.GERENTE,
      active: true,
    },
  })

  console.log('✓ Usuário gerente criado:', gerenteUser.email)

  // Criar usuário agrônomo
  const agronomoUser = await prisma.user.create({
    data: {
      email: 'agronomo@fazenda.com',
      password: 'agronomo123',
      name: 'Engenheiro Agrônomo',
      role: UserRole.AGRONOMO,
      active: true,
    },
  })

  console.log('✓ Usuário agrônomo criado:', agronomoUser.email)

  // Criar usuário funcionário
  const funcionarioUser = await prisma.user.create({
    data: {
      email: 'funcionario@fazenda.com',
      password: 'funcionario123',
      name: 'Funcionário',
      role: UserRole.FUNCIONARIO,
      active: true,
    },
  })

  console.log('✓ Usuário funcionário criado:', funcionarioUser.email)

  console.log('\n✅ População do banco de dados concluída com sucesso!')
  console.log('\n📝 Usuários criados:')
  console.log(`   Admin: admin@fazenda.com / admin123`)
  console.log(`   Gerente: gerente@fazenda.com / gerente123`)
  console.log(`   Agrônomo: agronomo@fazenda.com / agronomo123`)
  console.log(`   Funcionário: funcionario@fazenda.com / funcionario123`)
}

main()
  .catch((e) => {
    console.error('❌ Erro ao popular banco de dados:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
