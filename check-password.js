const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@fazenda.com' } });
  console.log('✓ Usuário encontrado:', user ? 'SIM' : 'NÃO');
  
  if (user) {
    console.log('✓ Campo senha existe:', user.password ? 'SIM' : 'NÃO');
    
    if (user.password) {
      console.log('✓ Hash da senha (primeiros 20 caracteres):', user.password.substring(0, 20) + '...');
      
      // Testar com a senha que usamos (admin123)
      const senha1 = await bcrypt.compare('admin123', user.password);
      console.log('✓ Senha "admin123" bate:', senha1 ? 'SIM ✓' : 'NÃO ✗');
      
      // Testar com a senha antiga (senha123)
      const senha2 = await bcrypt.compare('senha123', user.password);
      console.log('✓ Senha "senha123" bate:', senha2 ? 'SIM' : 'NÃO');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
