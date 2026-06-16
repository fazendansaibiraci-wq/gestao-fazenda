import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando população do banco de dados...')

  // Limpar dados existentes
  await prisma.atividade.deleteMany({})
  await prisma.safra.deleteMany({})
  await prisma.talhao.deleteMany({})
  await prisma.maquina.deleteMany({})
  await prisma.produto.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.feriado.deleteMany({})

  // Criar usuários
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@fazenda.com',
      password: 'senha123', // Em produção, usar bcrypt
      name: 'Administrador',
      role: UserRole.GESTOR,
      phone: '11999999999',
      active: true,
    },
  })

  const gerenteUser = await prisma.user.create({
    data: {
      email: 'gerente@fazenda.com',
      password: 'senha123',
      name: 'Gerente de Produção',
      role: UserRole.GERENTE,
      phone: '11988888888',
      active: true,
    },
  })

  const agronomoUser = await prisma.user.create({
    data: {
      email: 'agronomo@fazenda.com',
      password: 'senha123',
      name: 'Engenheiro Agrônomo',
      role: UserRole.AGRONOMO,
      phone: '11987654321',
      active: true,
    },
  })

  const funcionarioUser = await prisma.user.create({
    data: {
      email: 'funcionario@fazenda.com',
      password: 'senha123',
      name: 'Funcionário',
      role: UserRole.FUNCIONARIO,
      phone: '11987654322',
      active: true,
    },
  })

  console.log('✓ Usuários criados')

  // Criar talhões
  const talhao1 = await prisma.talhao.create({
    data: {
      nome: 'Talhão A',
      area: 50.5,
      localizacao: 'Zona Norte',
      status: 'ATIVO',
      tipoSolo: 'Latossolo Vermelho',
      ph: 6.5,
      responsavelId: gerenteUser.id,
    },
  })

  const talhao2 = await prisma.talhao.create({
    data: {
      nome: 'Talhão B',
      area: 45.0,
      localizacao: 'Zona Sul',
      status: 'ATIVO',
      tipoSolo: 'Latossolo Vermelho-Amarelo',
      ph: 6.2,
      responsavelId: gerenteUser.id,
    },
  })

  const talhao3 = await prisma.talhao.create({
    data: {
      nome: 'Talhão C',
      area: 30.0,
      localizacao: 'Zona Leste',
      status: 'PREPARACAO',
      tipoSolo: 'Argissolo Vermelho',
      ph: 6.8,
      responsavelId: gerenteUser.id,
    },
  })

  console.log('✓ Talhões criados')

  // Criar máquinas
  await prisma.maquina.create({
    data: {
      nome: 'Trator 1',
      tipo: 'Trator',
      marca: 'John Deere',
      modelo: '5075E',
      placa: 'ABC1234',
      status: 'ATIVA',
      horasUso: 1250,
      dataAquisicao: new Date('2021-03-15'),
      proximaManutencao: new Date('2026-07-01'),
    },
  })

  await prisma.maquina.create({
    data: {
      nome: 'Colhedora 1',
      tipo: 'Colhedora',
      marca: 'Massey Ferguson',
      modelo: 'MF 5650 ADVANCE',
      placa: 'DEF5678',
      status: 'ATIVA',
      horasUso: 850,
      dataAquisicao: new Date('2020-08-20'),
      proximaManutencao: new Date('2026-08-20'),
    },
  })

  await prisma.maquina.create({
    data: {
      nome: 'Pulverizador 1',
      tipo: 'Pulverizador',
      marca: 'Jacto',
      modelo: 'Falcon 3000',
      placa: 'GHI9012',
      status: 'MANUTENCAO',
      horasUso: 520,
      dataAquisicao: new Date('2022-05-10'),
      proximaManutencao: new Date('2026-06-15'),
    },
  })

  console.log('✓ Máquinas criadas')

  // Criar produtos
  await prisma.produto.create({
    data: {
      nome: 'Adubo NPK 10-10-10',
      tipo: 'Adubo',
      descricao: 'Adubo mineral completo',
      unidade: 'kg',
      quantidade: 5000,
      preco: 1.50,
    },
  })

  await prisma.produto.create({
    data: {
      nome: 'Inseticida Deltametrina',
      tipo: 'Defensivo',
      descricao: 'Controla insetos pragas',
      unidade: 'l',
      quantidade: 500,
      preco: 25.00,
    },
  })

  await prisma.produto.create({
    data: {
      nome: 'Fungicida Cobre',
      tipo: 'Defensivo',
      descricao: 'Previne doenças fúngicas',
      unidade: 'kg',
      quantidade: 200,
      preco: 18.00,
    },
  })

  console.log('✓ Produtos criados')

  // Criar safras
  const safra1 = await prisma.safra.create({
    data: {
      nome: 'Safra 2024/2025',
      ano: 2024,
      status: 'PLANTIO',
      dataInicio: new Date('2024-05-01'),
      dataFimEstimada: new Date('2025-08-31'),
      estimadoProduzir: 500,
      talhaoId: talhao1.id,
    },
  })

  const safra2 = await prisma.safra.create({
    data: {
      nome: 'Safra 2024/2025',
      ano: 2024,
      status: 'DESENVOLVIMENTO',
      dataInicio: new Date('2024-05-15'),
      dataFimEstimada: new Date('2025-08-31'),
      estimadoProduzir: 450,
      talhaoId: talhao2.id,
    },
  })

  await prisma.safra.create({
    data: {
      nome: 'Safra 2024/2025',
      ano: 2024,
      status: 'PLANEJAMENTO',
      dataInicio: new Date('2024-06-01'),
      dataFimEstimada: new Date('2025-09-30'),
      estimadoProduzir: 300,
      talhaoId: talhao3.id,
    },
  })

  console.log('✓ Safras criadas')

  // Criar atividades
  await prisma.atividade.create({
    data: {
      titulo: 'Adubação de Cobertura',
      descricao: 'Aplicar adubo NPK no talhão A',
      tipo: 'adubacao',
      status: 'pendente',
      dataPrevista: new Date('2026-06-20'),
      safraId: safra1.id,
      talhaoId: talhao1.id,
      responsavelId: funcionarioUser.id,
    },
  })

  await prisma.atividade.create({
    data: {
      titulo: 'Pulverização de Defensivo',
      descricao: 'Aplicar inseticida no talhão B',
      tipo: 'pulverizacao',
      status: 'pendente',
      dataPrevista: new Date('2026-06-25'),
      safraId: safra2.id,
      talhaoId: talhao2.id,
      responsavelId: funcionarioUser.id,
    },
  })

  await prisma.atividade.create({
    data: {
      titulo: 'Preparação do Solo',
      descricao: 'Aração e gradagem',
      tipo: 'preparacao',
      status: 'em_progresso',
      dataPrevista: new Date('2026-06-30'),
      dataExecucao: new Date('2026-06-15'),
      talhaoId: talhao3.id,
      responsavelId: agronomoUser.id,
    },
  })

  console.log('✓ Atividades criadas')

  // Criar feriados
  await prisma.feriado.create({
    data: {
      data: new Date('2026-09-07'),
      nome: 'Independência do Brasil',
    },
  })

  await prisma.feriado.create({
    data: {
      data: new Date('2026-12-25'),
      nome: 'Natal',
    },
  })

  console.log('✓ Feriados criados')

  console.log('✅ População do banco de dados concluída com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
