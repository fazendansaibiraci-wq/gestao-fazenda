# Gestão Fazenda - PWA para Gestão Agrícola

Sistema completo de gestão agrícola para fazendas de café com suporte offline via PWA.

## 🌱 Características

- **PWA (Progressive Web App)**: Funciona offline com sincronização automática
- **Responsivo**: Interface mobile-first para tablets e smartphones
- **Autenticação**: Sistema de controle de acesso com perfis de usuário
- **Módulos**:
  - 🌾 Talhões - Gestão de áreas de plantio
  - 📅 Safras - Acompanhamento de colheitas
  - 🚜 Máquinas - Controle de equipamentos
  - 📦 Produtos - Gestão de insumos
  - ✓ Atividades - Planejamento de tarefas
  - 📊 Relatórios - Análises e exportações

## 📋 Requisitos

- Node.js 18+
- npm ou yarn
- PostgreSQL (para produção)

## 🚀 Instalação e Configuração

### 1. Instalar Dependências

```bash
npm install
# ou
yarn install
```

### 2. Configurar Variáveis de Ambiente

Copie o arquivo `.env.local` e configure:

```bash
# .env.local
DATABASE_URL="postgresql://user:password@localhost:5432/gestao_fazenda"
NEXTAUTH_SECRET="seu-segredo-aqui"
NEXTAUTH_URL="http://localhost:3000"
```

Para gerar um segredo NEXTAUTH seguro:
```bash
openssl rand -base64 32
```

### 3. Configurar Banco de Dados

```bash
# Gerar cliente Prisma
npx prisma generate

# Executar migrações
npx prisma migrate dev --name init

# (Opcional) Abrir Prisma Studio para visualizar dados
npx prisma studio
```

### 4. Criar Usuários de Teste

```bash
npx prisma db seed
```

Ou manualmente via Prisma Studio.

## 🏃 Executar em Desenvolvimento

```bash
npm run dev
# ou
yarn dev
```

Acesse http://localhost:3000

### Credenciais de Teste

- **Email**: admin@fazenda.com
- **Senha**: senha123
- **Perfil**: Gestor

## 📱 Testar PWA

1. Abra http://localhost:3000 no navegador
2. No Chrome: Menu → Instalar "Gestão Fazenda"
3. No navegador: Abra DevTools → Application → Service Workers
4. Desative a rede para testar modo offline

## 🗂️ Estrutura do Projeto

```
Gestao_Fazenda/
├── app/                    # Rotas Next.js (App Router)
│   ├── layout.tsx         # Layout raiz com metadados PWA
│   ├── page.tsx           # Página inicial (redireciona para dashboard)
│   ├── login/             # Página de autenticação
│   ├── dashboard/         # Dashboard principal
│   ├── modules/           # Módulos da aplicação
│   │   ├── talhoes/
│   │   ├── safras/
│   │   ├── maquinas/
│   │   ├── produtos/
│   │   ├── atividades/
│   │   └── relatorios/
│   ├── settings/          # Configurações
│   └── api/               # Rotas API
│       ├── auth/          # NextAuth
│       ├── talhoes/
│       ├── safras/
│       ├── sync/          # Sincronização offline
│       └── ...
├── components/            # Componentes reutilizáveis
│   ├── layout/           # Componentes de layout
│   ├── forms/            # Formulários
│   ├── tables/           # Tabelas
│   └── ui/               # Componentes UI
├── lib/                   # Utilitários e bibliotecas
│   ├── db.ts             # Dexie (IndexedDB)
│   ├── prisma.ts         # Prisma Client
│   ├── auth.ts           # NextAuth config
│   ├── utils.ts          # Funções auxiliares
│   └── api.ts            # Cliente API
├── prisma/
│   └── schema.prisma     # Schema do banco de dados
├── public/
│   ├── manifest.json     # PWA manifest
│   ├── sw.js             # Service Worker
│   ├── icons/            # Ícones da PWA
│   └── ...
├── styles/               # Estilos globais
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 🔐 Perfis de Acesso

- **Funcionário**: Pode visualizar e registrar atividades
- **Gerente**: Gerencia talhões e safras
- **Agrônomo**: Supervisiona atividades agrícolas
- **Gestor/Proprietário**: Acesso total ao sistema

## 🔄 Sincronização Offline

O sistema sincroniza automaticamente quando:

- A conexão é restaurada
- O usuário acessa a aplicação
- A cada 5 minutos (em background)

Dados locais são armazenados em IndexedDB (Dexie.js).

## 📤 Exportações

- **Excel**: Relatórios de talhões, safras e atividades
- **PDF**: Documentos formatados para impressão

## 🛠️ Desenvolvimento

### Adicionar Novo Módulo

1. Criar pasta em `app/modules/novo-modulo`
2. Criar página em `app/modules/novo-modulo/page.tsx`
3. Adicionar rotas API em `app/api/novo-modulo/`
4. Implementar modelo Dexie em `lib/db.ts`
5. Atualizar menu de navegação

### Criar Nova Tabela no Banco

1. Editar `prisma/schema.prisma`
2. Executar `npx prisma migrate dev --name descricao`
3. Atualizar `lib/db.ts` com o novo modelo
4. Gerar cliente Prisma: `npx prisma generate`

## 📦 Build para Produção

```bash
npm run build
npm run start
```

## 🐛 Troubleshooting

### Service Worker não registra
- Limpar cache: DevTools → Application → Clear Storage
- Limpar site data em Settings → Privacy
- Recarregar página (Ctrl+Shift+R)

### Banco offline não sincroniza
- Verificar conexão com internet
- Abrir DevTools → Application → Service Workers
- Verificar logs em console

### Erro ao fazer login
- Verificar `.env.local` está configurado
- Verificar banco PostgreSQL está rodando
- Executar migrações: `npx prisma migrate deploy`

## 📞 Suporte

Para suporte, abra uma issue no repositório ou entre em contato.

## 📄 Licença

MIT

---

**Desenvolvido com ❤️ para a gestão agrícola**
