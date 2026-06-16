const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🗑️  Deletando usuário admin@fazenda.com...\n');

    const result = await prisma.user.delete({
      where: { email: 'admin@fazenda.com' }
    });

    console.log('✅ Usuário deletado com sucesso!\n');
    console.log(`   Email deletado: ${result.email}`);
    console.log(`   Nome: ${result.name}`);
    console.log(`   ID: ${result.id}\n`);

  } catch (error) {
    if (error.code === 'P2025') {
      console.log('⚠️  Usuário não encontrado (já foi deletado ou não existe)\n');
    } else {
      console.error('❌ Erro ao deletar usuário:', error.message);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
