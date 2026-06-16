# Guia de Uso - M4: Rastreabilidade do Café

## 🎯 Objetivo

Rastrear **100% do processo de processamento de café** desde a colheita até o armazém, com rastreabilidade completa de lotes, fusões, divisões, e rendimento.

---

## 📍 Como Acessar

### Menu Principal
```
Módulos → Rastreabilidade do Café
```

### URLs Diretas
- Dashboard Principal: `/modules/rastreabilidade`
- Novo Lote: `/modules/rastreabilidade/novo-lote`
- Terreiro: `/modules/rastreabilidade/terreiro`
- Secador: `/modules/rastreabilidade/secador`
- Tulha: `/modules/rastreabilidade/tulha`
- Benefício: `/modules/rastreabilidade/beneficio`
- Classificação: `/modules/rastreabilidade/classificacao`
- Silo: `/modules/rastreabilidade/silo`
- Armazém: `/modules/rastreabilidade/armazem`
- Detalhes Lote: `/modules/rastreabilidade/L2526-001`
- Relatórios: `/modules/rastreabilidade/relatorios`

---

## 🔄 Fluxo de Processamento

```
Colheita (Etapa 1)
    ↓ [Múltiplas chegadas de diferentes talhões]
    ↓
Terreiro (Etapa 2)
    ↓ [Meia seca ao ar livre, 4-7 dias]
    ↓
Secador (Etapa 3)
    ↓ [Secagem estática, 24-48 horas]
    ↓
Tulha (Etapa 4)
    ↓ [Descanso, 3-5 dias] ⟷ FUSÃO possível
    ↓
Benefício (Etapa 5a)
    ↓ [Descascamento, 2-4 horas]
    ↓
Classificação (Etapa 5b)
    ↓ [Peneiramento - ACESSO RESTRITO GERENTE]
    ↓
Silo (Etapa 6)
    ↓ [Armazenagem] ⟷ FUSÃO possível
    ↓
Armazém (Etapa 7)
    ↓ [Saída para venda/distribuição]
    ↓
FIM
```

---

## 📋 Guia Passo a Passo

### Passo 1️⃣: Criar Novo Lote (Colheita)

**Acesse**: `/modules/rastreabilidade/novo-lote`

**O que fazer**:
1. Selecione a **Safra** (ex: Safra 2025)
2. Adicione **múltiplas chegadas**:
   - Selecione o talhão (ex: T01, T02)
   - Tipo de colheita:
     - **MÁQUINA**: quantidade em carretas (× 4.000 L)
     - **MANUAL**: quantidade em alqueires (× 60 L)
     - **VARRIÇÃO**: quantidade em caminhões (× 12.000 L)
   - Digite a quantidade
3. **Sistema calcula automaticamente**:
   - Total em litros
   - Equivalente em sacas (÷60)
   - ID único (ex: L2526-001)
4. Clique "Criar Lote" → **Lote criado com status COLHEITA**

**Exemplo**:
```
Safra: Safra 2025
Chegadas:
  - T01 MÁQUINA 10 carretas → 40.000 L
  - T02 MANUAL 500 alqueires → 30.000 L
Total: 70.000 L (1.166 sacas)
ID Gerado: L2526-001
```

---

### Passo 2️⃣: Registrar no Terreiro

**Acesse**: `/modules/rastreabilidade/terreiro`

**O que fazer**:
1. Na seção "Lotes em Colheita", localize seu lote
2. Clique "Registrar no Terreiro"
3. Digite:
   - **Umidade de entrada** (ex: 50%)
   - **Data de entrada** (ex: 15/06/2026)
4. Clique confirmar → **Status muda para TERREIRO**

**Duração esperada**: 4-7 dias (depende do clima)

---

### Passo 3️⃣: Passar para Secador

**Acesse**: `/modules/rastreabilidade/secador`

**O que fazer**:
1. Na seção "Lotes em Terreiro", localize seu lote
2. **Sistema mostra 3 secadores** disponíveis com capacidade
3. Selecione o secador com espaço disponível
4. Digite a hora de entrada (ex: 08:00)
5. Clique confirmar → **Status muda para SECADOR**

**Capacidade**: 38.000 L por secador
**Duração esperada**: 24-48 horas

**Nota**: Sistema bloqueia se não houver espaço - aguarde outro lote sair do secador

---

### Passo 4️⃣: Transferir para Tulha (com possibilidade de fusão)

**Acesse**: `/modules/rastreabilidade/tulha`

**Opção A: Alocar Lote**:
1. Na seção "Lotes em Secador", selecione a tulha
2. Sistema valida capacidade (76.000 L)
3. Clique confirmar → **Status muda para TULHA**

**Opção B: Fundir Dois Lotes** (⭐ Recurso exclusivo Tulha):
1. Clique "Modo Fusão"
2. Selecione lote principal (ex: L2526-001)
3. Digite ID do segundo lote (ex: L2526-002)
4. Selecione a tulha
5. Sistema **combina os volumes** e rastreia origem
   - Lote principal recebe: `lotesOrigem: [L2526-002]`
   - Lote secundário marcado como fundido

**Capacidade**: 76.000 L por tulha (2 secadores)
**Duração esperada**: 3-5 dias de descanso

---

### Passo 5️⃣: Iniciar Benefício

**Acesse**: `/modules/rastreabilidade/beneficio`

**O que fazer**:
1. Na seção "Lotes em Tulha", clique "Iniciar"
2. Digite:
   - **Hora de início** (ex: 08:00)
   - **Umidade de entrada** (ex: 12%)
3. Lote passa para **Status BENEFICIO**
4. Volte quando terminar a operação

**O que esperar**:
- Sistema calcula **tempo de processamento automaticamente**
- Máquina descasca, separa silverskin, padroniza
- **Duração**: 2-4 horas

---

### Passo 6️⃣: Realizar Classificação (Etapa 5b - 🔐 Restrito)

**Acesse**: `/modules/rastreabilidade/classificacao`

**⚠️ Requisito**: Você deve ser **GERENTE** ou **GESTOR**

**O que fazer**:
1. Na seção "Lotes Aguardando Classificação", clique "Classificar"
2. **Preencha as peneiras** (em %, devem somar 100%):
   - Peneira 17+: ____%
   - Peneira 16: ____%
   - Peneira 15: ____%
   - Moça 10: ____%
   - Peneira 13: ____%
   - Catação: ____%
   - Fundo: ____%
3. **Sistema valida**: Soma = 100% (validação obrigatória)
4. Digite:
   - **Pontuação da bebida** (0-100, ex: 85)
   - **Umidade final** (ex: 11%)
5. Clique "Confirmar Classificação" → **Status muda para SILO**

**Exemplo válido**:
```
17+: 35% + 16: 25% + 15: 15% + Moça 10: 10% + 13: 8% + Catação: 5% + Fundo: 2% = 100% ✓
Pontuação: 85 (excelente)
Umidade: 11%
```

---

### Passo 7️⃣: Alocar em Silo (com possibilidade de fusão)

**Acesse**: `/modules/rastreabilidade/silo`

**Opção A: Alocar Lote**:
1. Selecione tipo de silo:
   - Silo Peneira 17+ (melhor qualidade)
   - Silo Peneira 16
   - Silo Bica Corrida (miscelânea)
2. Lote passa para **Status SILO**

**Opção B: Fundir Dois Lotes**:
1. Clique "Modo Fusão"
2. Selecione lote principal
3. Digite ID do segundo lote
4. Selecione silo
5. Sistema **combina e rastreia origem**

**Duração**: Armazenagem indefinida até saída

---

### Passo 8️⃣: Registrar Saída para Armazém

**Acesse**: `/modules/rastreabilidade/armazem`

**O que fazer**:
1. Na seção "Lotes em Silo", clique "Registrar Saída"
2. Digite:
   - **Peso total em kg** (ex: 70.000 kg)
   - Sistema **converte automaticamente** para sacas (÷60)
   - **NF de transporte** (opcional)
   - **Armazém destino** (opcional)
   - **Números de pesagem** (opcional)
3. Clique confirmar → **Status muda para ARMAZÉM**

**Lote finalizado** ✅ - Pronto para venda/distribuição

---

## 📊 Visualizar Detalhes de um Lote

**Acesse**: `/modules/rastreabilidade/L2526-001` (substitua pelo ID do lote)

**O que você vê**:
- **Timeline visual** com todas as 8 etapas
- Status atual de cada etapa (⏳ Pendente | ● Em andamento | ✓ Completo)
- Datas e responsáveis por etapa
- Dados específicos:
  - Chegadas (talhão, tipo, quantidade)
  - Peneiras e pontuação
  - Peso final em kg e sacas
  - Números de NF e transporte
- **Linhagem**: Lotes de origem (se foi fusão) ou destino (se foi dividido)

---

## 📈 Consultar Relatórios

**Acesse**: `/modules/rastreabilidade/relatorios`

### 6 Relatórios Disponíveis

**1️⃣ Colheita por Talhão**
- Distribuição de volume por talhão
- Percentual do total
- Útil para: Analisar produtividade por talhão

**2️⃣ Total Colhido**
- Resumo em litros, sacas, carretas
- Período selecionado
- Útil para: Controle de volume total

**3️⃣ Rastreamento de Lotes**
- Lista de lotes processados
- Status atual
- Útil para: Acompanhar andamento

**4️⃣ Rendimento**
- Lotes com classificação
- Total beneficiado em sacas
- Rendimento médio
- Útil para: Medir eficiência

**5️⃣ Comparação de Peneiras**
- Peneira 17+ por lote
- Pontuação sensorial
- Útil para: Análise de qualidade

**6️⃣ Tempo de Secagem**
- Tempo médio de secagem
- Tempos por lote e secador
- Útil para: Otimizar processo

### Filtros Disponíveis
- Hoje
- Esta Semana
- Este Mês
- Safra Completa

### Exportação
- PDF (botão pronto para expansão)
- Excel (botão pronto para expansão)

---

## 🔐 Permissões de Acesso

| Etapa | FUNC. | GER. | AGR. | GEST. |
|-------|:-----:|:----:|:----:|:-----:|
| Colheita | ✓ | ✓ | ✓ | ✓ |
| Terreiro | ✓ | ✓ | ✓ | ✓ |
| Secador | ✓ | ✓ | ✓ | ✓ |
| Tulha | ✗ | ✓ | ✗ | ✓ |
| Benefício | ✓ | ✓ | ✓ | ✓ |
| **Classificação** | ✗ | **✓** | ✗ | **✓** |
| Silo | ✗ | ✓ | ✗ | ✓ |
| Armazém | ✗ | ✓ | ✗ | ✓ |

**Legenda**: FUNC=Funcionário, GER=Gerente, AGR=Agrônomo, GEST=Gestor

**Nota Importante**: 🔐 **Classificação é acesso restrito** (apenas GERENTE/GESTOR) pois determina qualidade/preço do café

---

## ⚙️ Cálculos Automáticos

### Conversões de Unidades
- **1 Carreta** = 4.000 L
- **1 Alqueire** = 60 L
- **1 Caminhão** = 3 × 4.000 L = 12.000 L
- **1 Saca** = 60 kg de café beneficiado

### Tempos Calculados Automaticamente
- **Secagem**: horaFim - horaInicio = horas
- **Benefício**: horaFim - horaInicio = horas

### Validações Automáticas
- ✓ Soma de peneiras = 100% (obrigatório)
- ✓ Capacidade de secador (38.000 L máximo)
- ✓ Capacidade de tulha (76.000 L máximo)
- ✓ Umidade entrada > saída

---

## 🆘 Troubleshooting

### "Lote não aparece em Terreiro"
→ Verifique se está com status COLHEITA (vá ao dashboard principal)

### "Secador sem capacidade"
→ Aguarde outro lote sair do secador ou tente outro secador

### "Peneiras não somam 100%"
→ Verifique os valores digitados. Sistema bloqueia envio se soma ≠ 100%

### "Não consigo clasificar"
→ Você deve ter role **GERENTE** ou **GESTOR**. Peça ao gestor para fazer a classificação.

### "Lote desapareceu"
→ Lotes fundidos são marcados como "fundidos" mas histórico é preservado em `lotesOrigem`

---

## 💡 Dicas de Uso

1. **Fusão é melhor que divisão**: Use fusão em Tulha/Silo para consolidar volumes menores

2. **Rastreabilidade completa**: Todo lote tem ID único, nunca há duplicatas

3. **Classificação é o gargalo**: Faça-a logo após Benefício antes de estocar muito em Silo

4. **Peneiras devem ser EXATAS**: Soma deve dar 100.0%, use 2 casas decimais

5. **Registre weights in kg**: Armazém converte automaticamente para sacas (÷60)

6. **Monitore secagem**: Tempos > 48h indicam problema com secador ou café muito úmido

7. **Use relatórios para BI**: Comparar peneiras entre safras ajuda a otimizar processo

---

## 📞 Suporte

Para dúvidas técnicas ou bugs:
1. Verifique este guia
2. Consulte o Documento de Implementação (FASE_F3_M4_IMPLEMENTATION.md)
3. Contate o desenvolvedor com:
   - URL que estava acessando
   - Passo exato que estava fazendo
   - Mensagem de erro (se houver)

---

**Versão**: 1.0  
**Data**: 15 de junho de 2026  
**Desenvolvido para**: Gestão Fazenda - M4 Rastreabilidade do Café
