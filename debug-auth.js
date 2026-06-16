const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 DEBUG: Verificando configuração de autenticação\n');
  console.log('=' .repeat(60));

  // 1. Verificar variáveis de ambiente
  console.log('\n📝 1. VARIÁVEIS DE AMBIENTE:');
  console.log('   NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? 'CONFIGURADO ✓' : 'NÃO CONFIGURADO ✗');
  console.log('   NEXTAUTH_URL:', process.env.NEXTAUTH_URL || 'NÃO CONFIGURADO');
  console.log('   NODE_ENV:', process.env.NODE_ENV);

  // 2. Verificar usuário no banco
  console.log('\n📝 2. USUÁRIO NO BANCO:');
  const user = await prisma.user.findUnique({
    where: { email: 'admin@fazenda.com' }
  });

  if (user) {
    console.log('   Email:', user.email);
    console.log('   Nome:', user.name);
    console.log('   Role:', user.role);
    console.log('   Ativo:', user.active);
    console.log('   Tem senha:', user.password ? 'SIM ✓' : 'NÃO ✗');

    if (user.password) {
      console.log('   Hash (primeiros 30 chars):', user.password.substring(0, 30) + '...');
      console.log('   Tamanho do hash:', user.password.length);

      // 3. Testar bcrypt.compare
      console.log('\n📝 3. TESTE DE COMPARAÇÃO DE SENHA:');

      const senhas = ['admin123', 'senha123', 'Admin123', 'ADMIN123'];

      for (const senha of senhas) {
        const resultado = await bcrypt.compare(senha, user.password);
        console.log(`   bcrypt.compare('${senha}'): ${resultado ? 'BATE ✓' : 'não bate'}`);
      }

      // 4. Testar com hash novo
      console.log('\n📝 4. TESTE DE NOVO HASH:');
      const novoHash = await bcrypt.hash('admin123', 10);
      console.log('   Novo hash criado com bcrypt.hash()');
      console.log('   Hash:', novoHash.substring(0, 30) + '...');

      const testeNovoHash = await bcrypt.compare('admin123', novoHash);
      console.log('   bcrypt.compare("admin123", novoHash):', testeNovoHash ? 'BATE ✓' : 'não bate');

      // 5. Testar com salt rounds
      console.log('\n📝 5. INFORMAÇÕES DO HASH ATUAL:');
      const match = user.password.match(/^\$2[aby]\$(\d+)\$/);
      if (match) {
        console.log('   Algoritmo: bcrypt');
        console.log('   Cost factor:', match[1]);
      }
    }
  } else {
    console.log('   ✗ Usuário NÃO ENCONTRADO');
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
