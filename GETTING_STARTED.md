# Começando a Usar o Gestão Fazenda

## ⚡ Quick Start (5 minutos)

### 1️⃣ Instalar Dependências
```bash
cd C:\Gestao_Fazenda
npm install
```

### 2️⃣ Configurar Banco de Dados
```bash
# Criar arquivo .env.local com suas credenciais PostgreSQL
# Exemplo:
# DATABASE_URL="postgresql://user:password@localhost:5432/gestao_fazenda"

# Executar migrações
npx prisma migrate dev --name init

# Popular com dados de teste (opcional)
npx prisma db seed
```

### 3️⃣ Gerar Segredo NextAuth
```bash
# Windows (PowerShell)
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString())) | Out-Host

# Adicionar em .env.local
# NEXTAUTH_SECRET=seu-segredo-aqui
```

### 4️⃣ Iniciar Servidor
```bash
npm run dev
```

**Acesse**: http://localhost:3000

---

## 🔑 Login Padrão

Após `npx prisma db seed`:

| Campo | Valor |
|-------|-------|
| Email | `admin@fazenda.com` |
| Senha | `senha123` |
| Perfil | Gestor |

---

## 📱 Estrutura de Navegação

### Para Gestor/Admin
```
Dashboard
├── Funcionários (CRUD completo)
├── Talhões (CRUD completo)
├── Máquinas (CRUD inline)
├── Produtos (CRUD inline)
├── Safras (CRUD inline)
├── Feriados (Nacionalais + Municipais)
└── Atividades (Visualizar todas)
```

### Para Funcionário
```
Dashboard
└── Atividades
    ├── Registrar Nova (Sua própria)
    ├── Listar Minhas Atividades
    └── Editar Minhas Atividades
```

### Para Gerente
```
Dashboard
├── Atividades (Visualizar todas)
├── Aprovação de Horas Extras
└── Relatórios
```

---

## 🎯 Guia de Uso Prático

### Cenário 1: Novo Funcionário
1. Acesse "Funcionários"
2. Clique "Novo Funcionário"
3. Preencha dados pessoais
4. Configure salário e hora extra
5. Marque "Banco de Horas Ativo" (opcional)
6. Salve

### Cenário 2: Criar Talhão
1. Acesse "Talhões"
2. Clique "Novo Talhão"
3. Nome: "Talhão A"
4. Área: "50.5"
5. Fazenda: "Fazenda Esperança"
6. Cultura: "Café Arábica"
7. Salve

### Cenário 3: Registrar Atividade (Funcionário)
1. Acesse "Atividades"
2. Clique "Nova Atividade"
3. Preencha:
   - Data (obrigatório)
   - Hora Entrada (obrigatório)
   - Talhão (obrigatório)
   - Safra (obrigatório)
   - Tipo de Atividade (obrigatório)
4. Se "Pulverização", preencha "Total de Bombas"
5. Se selecionou Máquina, preencha horímetro inicial e final
6. Adicione observações (opcional)
7. Salve

### Cenário 4: Registrar Máquina
1. Acesse "Máquinas"
2. Preencha formulário:
   - Nome: "Trator 1"
   - Tipo: "Trator"
   - Marca: "John Deere"
   - Modelo: "5075E"
   - Ano: "2021"
   - Placa: "ABC1234"
3. Clique "Adicionar"

---

## 🔧 Estrutura de Pastas para Desenvolvedor

```
C:\Gestao_Fazenda/
│
├── app/
│   ├── api/                    # Todas as rotas API
│   │   ├── funcionarios/
│   │   ├── talhoes/
│   │   ├── maquinas/
│   │   ├── produtos/
│   │   ├── safras/
│   │   ├── feriados/
│   │   ├── registros-atividade/
│   │   ├── auth/
│   │   └── health/
│   │
│   ├── modules/                # Páginas de módulos
│   │   ├── funcionarios/
│   │   ├── talhoes/
│   │   ├── maquinas/
│   │   ├── produtos/
│   │   ├── safras/
│   │   ├── feriados/
│   │   ├── atividades/
│   │   ├── dashboard/
│   │   └── relatorios/
│   │
│   ├── layout.tsx             # Layout raiz
│   ├── page.tsx               # Home (redireciona para dashboard)
│   └── globals.css            # Estilos globais
│
├── components/
│   ├── forms/                 # Formulários reutilizáveis
│   ├── layout/                # Componentes de layout
│   └── ui/                    # Componentes UI
│
├── lib/
│   ├── db.ts                  # Dexie (IndexedDB)
│   ├── prisma.ts              # Prisma Client
│   ├── auth.ts                # NextAuth configuração
│   └── utils.ts               # Funções auxiliares
│
├── prisma/
│   ├── schema.prisma          # Schema do banco
│   └── seed.ts                # Dados de teste
│
├── public/
│   ├── manifest.json          # PWA config
│   ├── sw.js                  # Service Worker
│   └── icons/                 # Ícones PWA
│
├── package.json               # Dependências
├── tsconfig.json              # TypeScript config
├── next.config.js             # Next.js com PWA
├── tailwind.config.ts         # Tailwind config
├── postcss.config.js          # PostCSS config
├── .env.local                 # Variáveis de ambiente
├── README.md                  # Documentação
├── API.md                     # Referência API
└── FASE_F1_PROGRESS.md        # Status dessa fase
```

---

## 🚀 Comandos Úteis

### Desenvolvimento
```bash
# Servidor dev com reload
npm run dev

# Compilar TypeScript
npx tsc --noEmit

# Formatar código
npx prettier --write .
```

### Banco de Dados
```bash
# Criar migração
npx prisma migrate dev --name description

# Reset banco (⚠️ perda de dados!)
npx prisma migrate reset

# Abrir Prisma Studio
npx prisma studio

# Seed dados
npx prisma db seed
```

### Build & Produção
```bash
# Build otimizado
npm run build

# Iniciar em produção
npm run start

# Analisar bundle
npm run analyze
```

---

## 🧪 Testes Manuais Recomendados

### M6 - Cadastros
- [ ] Criar funcionário
- [ ] Editar funcionário
- [ ] Deletar funcionário
- [ ] Criar talhão
- [ ] Criar máquina
- [ ] Criar produto
- [ ] Criar safra
- [ ] Adicionar feriado municipal

### M1 - Atividades
- [ ] Registrar atividade simples
- [ ] Registrar atividade com máquina (horímetro)
- [ ] Registrar atividade com Pulverização (bombas)
- [ ] Registrar atividade com Adubação
- [ ] Validar: horímetro final > inicial
- [ ] Validar: alerta se horímetro > 24h
- [ ] Editar atividade registrada
- [ ] Listar atividades com filtros
- [ ] Visualizar como funcionário (apenas próprias)
- [ ] Visualizar como gestor (todas)

### Offline (Avançado)
- [ ] Desabilitar rede (DevTools)
- [ ] Registrar atividade offline
- [ ] Verificar se aparece em IndexedDB
- [ ] Reconectar internet
- [ ] Sincronizar dados

---

## 🐛 Troubleshooting

### Erro: "DATABASE_URL not set"
```bash
# Verificar se .env.local existe
# Se não, criar:
echo 'DATABASE_URL="postgresql://..."' > .env.local
```

### Erro: "Port 3000 already in use"
```bash
# Usar outra porta
npm run dev -- -p 3001
```

### Erro: "Prisma migrations failed"
```bash
# Reset e começar do zero
npx prisma migrate reset
npx prisma migrate dev --name init
```

### Service Worker não registra
```bash
# Limpar cache e reload
# DevTools > Application > Clear Storage > Reload
Ctrl+Shift+R (hard refresh)
```

---

## 📖 Documentação

- **API.md** - Referência completa de endpoints
- **README.md** - Overview do projeto
- **FASE_F1_PROGRESS.md** - Status atual da implementação

---

## 🔐 Segurança Básica

### ⚠️ Antes de Produção
- [ ] Usar bcrypt para senhas (não plaintext!)
- [ ] Configurar CORS corretamente
- [ ] Usar variáveis de ambiente seguras
- [ ] Ativar HTTPS
- [ ] Rate limiting em produção
- [ ] Validar todas as entradas de usuário
- [ ] Implementar audit logs

---

## 📞 Suporte

Para dúvidas ou bugs:
1. Verificar logs do servidor (`npm run dev`)
2. Abrir DevTools do navegador (F12)
3. Verificar Network requests
4. Consultar documentação em API.md

---

## ✨ Next Steps Recomendados

1. **Testar M6 completo** (funciona offline)
2. **Testar M1 completo** (com cálculos automáticos)
3. **Implementar Escalas** (Entressafra e Safra)
4. **Implementar Aprovação** de Horas Extras
5. **Adicionar Relatórios** com gráficos
6. **Integrar Sincronização** Offline ↔ Cloud

---

**Bom desenvolvimento! 🚀**
