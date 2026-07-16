# Investigação de Horímetro — Máquinas COLHEDEIRA, 3406 e 265

Consultas rodadas via psql (Railway Console: Postgres) em produção, apenas leitura (SELECT). Nenhum dado foi alterado.

## IDs das máquinas

```sql
SELECT id, nome FROM maquinas WHERE nome IN ('COLHEDEIRA', '3406', '265');
```

| id | nome |
|---|---|
| cmqs2s5oo0003x7oklf70bvqj | 265 |
| cmr591y6t0002croc3x0axgdy | COLHEDEIRA |
| cmqs2jzgo00008ztfp71d7xvk | 3406 |

---

## 265 (`cmqs2s5oo0003x7oklf70bvqj`)

### registros_atividade (5 rows)

| data | horimetroInicial | horimetroFinal | horasMaquina | funcionario |
|---|---|---|---|---|
| 2026-07-04 12:00:00 | 24681.6 | 24690.3 | 8.7 | GERINALDO JOAQUIM DA SILVA |
| 2026-07-05 12:00:00 | 24690.3 | 24695.5 | 5.2 | GERINALDO JOAQUIM DA SILVA |
| 2026-07-06 12:00:00 | 24695.5 | 24698 | 2.5 | GERINALDO JOAQUIM DA SILVA |
| 2026-07-06 12:00:00 | 24698 | 24705.7 | 7.7 | GERINALDO JOAQUIM DA SILVA |
| 2026-07-08 12:00:00 | 24711.4 | 24722.6 | 11.2 | GERINALDO JOAQUIM DA SILVA |

### abastecimentos_trator (4 rows)

| data | horimetroanterior | horimetroAtual | horasTrabalhadad | litrosAbastecidos |
|---|---|---|---|---|
| 2026-07-08 09:07:00 | 0 | 24711.5 | 0 | 25 |
| 2026-07-09 13:13:00 | 24711.5 | 24722.7 | 11.20000000000073 | 39 |
| 2026-07-10 07:02:00 | 24722.7 | 24730.9 | 8.200000000000728 | 30 |
| 2026-07-14 17:04:00 | 24730.9 | 24740.5 | 9.599999999998545 | 26 |

---

## COLHEDEIRA (`cmr591y6t0002croc3x0axgdy`)

### registros_atividade (9 rows)

| data | horimetroInicial | horimetroFinal | horasMaquina | funcionario |
|---|---|---|---|---|
| 2026-07-03 12:00:00 | 1 | 2 | 1 | FABIANO SILVA |
| 2026-07-04 15:00:00 | 1 | 2 | 1 | FABIANO SILVA |
| 2026-07-06 15:00:00 | 1 | 2 | 1 | FABIANO SILVA |
| 2026-07-07 12:00:00 | 1 | 2 | 1 | FABIANO SILVA |
| 2026-07-08 12:00:00 | 5642.5 | 5653.2 | 10.7 | FABIANO SILVA |
| 2026-07-09 12:00:00 | 5653.2 | 5660.9 | 7.7 | FABIANO SILVA |
| 2026-07-12 12:00:00 | 1 | 2 | 1 | FABIANO SILVA |
| 2026-07-13 12:00:00 | 1 | 2 | 1 | FABIANO SILVA |
| 2026-07-14 12:00:00 | 1 | 2 | 1 | FABIANO SILVA |

### abastecimentos_trator (5 rows)

| data | horimetroanterior | horimetroAtual | horasTrabalhadad | litrosAbastecidos |
|---|---|---|---|---|
| 2026-07-08 14:54:00 | 0 | 5647.9 | 0 | 104 |
| 2026-07-09 13:08:00 | 5647.9 | 5657 | 9.100000000000364 | 80 |
| 2026-07-13 15:22:00 | 5657 | 5668.1 | 11.10000000000036 | 93 |
| 2026-07-14 18:55:00 | 5668.1 | 5679.8 | 11.69999999999982 | 115 |
| 2026-07-15 17:38:00 | 5679.8 | 5688.6 | 8.800000000000182 | 85 |

---

## 3406 (`cmqs2jzgo00008ztfp71d7xvk`)

### registros_atividade (11 rows)

| data | horimetroInicial | horimetroFinal | horasMaquina | funcionario |
|---|---|---|---|---|
| 2026-07-02 12:00:00 | 1200.5 | 1205.1 | 4.6 | LUIS HENRIQUE DE OLIVEIRA |
| 2026-07-03 12:00:00 | 1205.1 | 1214.6 | 9.5 | LUIS HENRIQUE DE OLIVEIRA |
| 2026-07-04 12:00:00 | 1214.6 | 1221 | 6.4 | LUIS HENRIQUE DE OLIVEIRA |
| 2026-07-05 15:00:00 | 1221 | 1227.8 | 6.8 | LUIS HENRIQUE DE OLIVEIRA |
| 2026-07-06 15:00:00 | 1227.9 | 1242 | 14.1 | LUIS HENRIQUE DE OLIVEIRA |
| 2026-07-07 15:00:00 | 1242 | 1254.9 | 12.9 | LUIS HENRIQUE DE OLIVEIRA |
| 2026-07-08 15:00:00 | 1254.9 | 1272.5 | 17.6 | LUIS HENRIQUE DE OLIVEIRA |
| 2026-07-09 12:00:00 | 1272.5 | 1283.2 | 10.7 | LUIS HENRIQUE DE OLIVEIRA |
| 2026-07-10 12:00:00 | 1283.2 | 1297.3 | 14.1 | LUIS HENRIQUE DE OLIVEIRA |
| 2026-07-11 12:00:00 | 1297.3 | 1309.6 | 12.3 | LUIS HENRIQUE DE OLIVEIRA |
| 2026-07-14 12:00:00 | 1309.6 | 1323.5 | 13.9 | LUIS HENRIQUE DE OLIVEIRA |

### abastecimentos_trator (11 rows)

| data | horimetroanterior | horimetroAtual | horasTrabalhadad | litrosAbastecidos |
|---|---|---|---|---|
| 2026-07-08 07:10:00 | 0 | 1254.9 | 0 | 29 |
| 2026-07-08 21:20:00 | 1254.9 | 1263.5 | 8.599999999999909 | 90 |
| 2026-07-09 10:39:00 | 1263.5 | 1272.3 | 8.799999999999955 | 57 |
| 2026-07-10 07:30:00 | 1272.3 | 1283.2 | 10.90000000000009 | 78 |
| 2026-07-10 18:30:00 | 1283.2 | 1293.5 | 10.29999999999995 | 40 |
| 2026-07-11 07:15:00 | 1293.5 | 1297.4 | 3.900000000000091 | 27 |
| 2026-07-11 20:02:00 | 1297.4 | 1307.6 | 10.19999999999982 | 50 |
| 2026-07-14 16:36:00 | 1307.6 | 1318.4 | 10.80000000000018 | 65 |
| 2026-07-15 07:28:00 | 1318.4 | 1323.5 | 5.099999999999909 | 27 |
| 2026-07-15 13:33:00 | 1323.5 | 1328.2 | 4.700000000000045 | 25 |
| 2026-07-15 22:56:00 | 1328.2 | 1336.9 | 8.7000000000000045 | 60 |

---

## Observações

- **COLHEDEIRA**: a maioria dos registros de atividade tem `horimetroInicial = 1` e `horimetroFinal = 2` (valores de placeholder, não horímetro real), exceto os dois registros de 08/09 de julho, que usam valores reais (5642.5–5660.9), consistentes com os abastecimentos da mesma janela.
- **265** e **3406**: registros de atividade e abastecimentos estão consistentes entre si (horímetro final de atividade bate com horímetro de abastecimento subsequente).
- Os últimos abastecimentos de COLHEDEIRA (15/07 17:38) e 3406 (15/07 22:56) foram lançados após a consulta anterior desta investigação — a base é de produção e reflete lançamentos em tempo real.

---

## Correções aplicadas em 16/07/2026

Todas as correções abaixo foram aplicadas via UPDATE no psql (Railway Console: Postgres), cada uma seguida de um SELECT de confirmação antes de seguir para a próxima. Todas afetaram exatamente 1 (ou 7, no último caso) linha, conforme esperado.

### 1) 3306 — 1º abastecimento (08/07), horímetro anterior real = 6329.1 (atividade mais antiga em 03/07)

```sql
UPDATE abastecimentos_trator
SET "horimetroanterior" = 6329.1,
    "horasTrabalhadad" = 6378.2 - 6329.1
WHERE "maquinaId" = 'cmqs2r2ei0002x7oknmu7y7hd'
  AND data = '2026-07-08 10:09:00';
```

- **UPDATE 1** — linha afetada.
- Confirmação: `horimetroanterior = 6329.1`, `horimetroAtual = 6378.2`, `horasTrabalhadad = 49.1`.

### 2) AGRALE — 1º abastecimento (09/07), horímetro anterior real = 9922.6 (atividade mais antiga em 03/07)

```sql
UPDATE abastecimentos_trator
SET "horimetroanterior" = 9922.6,
    "horasTrabalhadad" = 9982.1 - 9922.6
WHERE "maquinaId" = 'cmqs2p70x0000x7okdb6z48gu'
  AND data = '2026-07-09 12:57:00';
```

- **UPDATE 1** — linha afetada.
- Confirmação: `horimetroanterior = 9922.6`, `horimetroAtual = 9982.1`, `horasTrabalhadad = 59.5`.

### 3) 3406 — 1º abastecimento (08/07), horímetro anterior real = 1200.5 (atividade mais antiga em 02/07)

```sql
UPDATE abastecimentos_trator
SET "horimetroanterior" = 1200.5,
    "horasTrabalhadad" = 1254.9 - 1200.5
WHERE "maquinaId" = 'cmqs2jzgo00008ztfp71d7xvk'
  AND data = '2026-07-08 07:10:00';
```

- **UPDATE 1** — linha afetada.
- Confirmação: `horimetroanterior = 1200.5`, `horimetroAtual = 1254.9`, `horasTrabalhadad = 54.4`.

### 4) 265 — 1º abastecimento (08/07), horímetro anterior real = 24681.6 (atividade mais antiga em 04/07)

```sql
UPDATE abastecimentos_trator
SET "horimetroanterior" = 24681.6,
    "horasTrabalhadad" = 24711.5 - 24681.6
WHERE "maquinaId" = 'cmqs2s5oo0003x7oklf70bvqj'
  AND data = '2026-07-08 09:07:00';
```

- **UPDATE 1** — linha afetada.
- Confirmação: `horimetroanterior = 24681.6`, `horimetroAtual = 24711.5`, `horasTrabalhadad = 29.9`.

### 5) COLHEDEIRA — zerar registros de atividade com horímetro placeholder (1 → 2)

```sql
UPDATE registros_atividade
SET "horimetroInicial" = NULL, "horimetroFinal" = NULL, "horasMaquina" = NULL
WHERE "maquinaId" = 'cmr591y6t0002croc3x0axgdy'
  AND "horimetroInicial" = 1 AND "horimetroFinal" = 2;
```

- **UPDATE 7** — 7 linhas afetadas (as datas 03/07, 04/07, 06/07, 07/07, 12/07, 13/07 e 14/07, que tinham valores de placeholder em vez de leituras reais de horímetro).
- Confirmação: os 7 registros agora têm `horimetroInicial`, `horimetroFinal` e `horasMaquina` = NULL; os 2 registros com horímetro real (08/07 e 09/07, 5642.5–5660.9) permaneceram intactos.

---

## Reconferência 3306 — 16/07/2026

Consulta rodada via psql (Railway Console: Postgres) em produção, apenas leitura (SELECT). Nenhum dado foi alterado.

### registros_atividade (11 rows)

| data | horimetroInicial | horimetroFinal | horasMaquina | funcionario |
|---|---|---|---|---|
| 2026-07-03 12:00:00 | 6329.1 | 6339.5 | 10.4 | EDIVALDO DA SILVA |
| 2026-07-04 12:00:00 | 6339.5 | 6347.2 | 7.7 | EDIVALDO DA SILVA |
| 2026-07-05 12:00:00 | 6347.2 | 6354 | 6.8 | EDIVALDO DA SILVA |
| 2026-07-06 15:00:00 | 6354 | 6367.3 | 13.3 | EDIVALDO DA SILVA |
| 2026-07-07 15:00:00 | 6367.3 | 6378.2 | 10.9 | EDIVALDO DA SILVA |
| 2026-07-08 12:00:00 | 6378.2 | 6388.5 | 10.3 | EDIVALDO DA SILVA |
| 2026-07-09 12:00:00 | 6388.5 | 6393.9 | 5.4 | EDIVALDO DA SILVA |
| 2026-07-09 12:00:00 | 6393.9 | 6401.6 | 7.7 | EDIVALDO DA SILVA |
| 2026-07-13 12:00:00 | 6411.9 | 6413.9 | 2 | EDIVALDO DA SILVA |
| 2026-07-14 12:00:00 | 6413.9 | 6419.9 | 6 | EDIVALDO DA SILVA |
| 2026-07-14 12:00:00 | 6419.9 | 6425.3 | 5.4 | EDIVALDO DA SILVA |

Sem mudanças em relação à consulta anterior desta investigação.

### abastecimentos_trator (7 rows)

| data | horimetroanterior | horimetroAtual | horasTrabalhadad | litrosAbastecidos |
|---|---|---|---|---|
| 2026-07-08 10:09:00 | 6329.1 | 6378.2 | 49.1 | 78 |
| 2026-07-09 06:57:00 | 6378.2 | 6388.6 | 10.40000000000055 | 80 |
| 2026-07-09 14:09:00 | 6388.6 | 6393.8 | 5.199999999999818 | 33 |
| 2026-07-12 07:15:00 | 6393.8 | 6401.7 | 7.899999999999636 | 59 |
| 2026-07-13 12:48:00 | 6401.7 | 6411.9 | 10.19999999999982 | 68 |
| 2026-07-14 17:57:00 | 6411.9 | 6423.4 | 11.5 | 58 |
| 2026-07-16 07:26:00 | 6423.4 | 6437.4 | 14 | 73 |

**Observações:**
- A correção do primeiro abastecimento (08/07) aplicada anteriormente persiste corretamente: `horimetroanterior = 6329.1` e `horasTrabalhadad = 49.1`.
- Um novo abastecimento foi lançado em 16/07 às 07:26 (73 litros, horímetro 6423.4 → 6437.4, 14h trabalhadas) — a base é de produção e reflete lançamentos em tempo real.

## Faltas automáticas duplicadas — 16/07/2026

Consulta read-only (sem alterações) para identificar faltas automáticas (`isFalta = true`, `motivoFalta = 'nao_registrado'`) que já têm um registro de atividade real (`isFalta = false`) para o mesmo funcionário no mesmo dia — ou seja, duplicadas.

```sql
SELECT falta.id, falta.data, falta."funcionarioId", u.name
FROM registros_atividade falta
JOIN users u ON u.id = falta."funcionarioId"
WHERE falta."isFalta" = true
  AND falta."motivoFalta" = 'nao_registrado'
  AND EXISTS (
    SELECT 1 FROM registros_atividade real
    WHERE real."funcionarioId" = falta."funcionarioId"
      AND real.data = falta.data
      AND real."isFalta" = false
  );
```

Resultado (6 rows):

| id | data | funcionarioId | name |
|---|---|---|---|
| cmrkkt6di000t64w88yqye0rj | 2026-07-13 12:00:00 | cmrb2x9830000119al1fgntz8 | GERINALDO JOAQUIM DA SILVA |
| cmrmzy9g20001149uc8jxr08g | 2026-07-15 12:00:00 | cmr3v47jr00007evjgkjf1jqz | LUIS HENRIQUE DE OLIVEIRA |
| cmrncepl40005auehg9sjl9cd | 2026-07-15 12:00:00 | cmrb2x9830000119al1fgntz8 | GERINALDO JOAQUIM DA SILVA |
| cmrlxq5hb0005ltwf66ri8us2 | 2026-07-14 12:00:00 | cmrb2x9830000119al1fgntz8 | GERINALDO JOAQUIM DA SILVA |
| cmrncepby0001auehyzq21zyj | 2026-07-15 12:00:00 | cmr4ygj4f00052pghgyst49ot | MARIA EUNICE JESUS CARVALHO |
| cmrnr9zi50001z5gc4mip70e1 | 2026-07-15 12:00:00 | cmr3v4qly00017evjwqiyd8sm | EDIVALDO DA SILVA |

**DELETE executado em 16/07/2026, autorizado pelo usuário:**

```sql
DELETE FROM registros_atividade falta
WHERE falta."isFalta" = true
  AND falta."motivoFalta" = 'nao_registrado'
  AND EXISTS (
    SELECT 1 FROM registros_atividade real
    WHERE real."funcionarioId" = falta."funcionarioId"
      AND real.data = falta.data
      AND real."isFalta" = false
  );
```

Resultado: `DELETE 6` — as 6 faltas automáticas duplicadas listadas na tabela acima foram removidas com sucesso.

## Faxina completa de faltas duplicadas — 16/07/2026

Consulta read-only (sem alterações) para identificar TODAS as faltas automáticas ainda duplicadas em qualquer funcionário, usando comparação por DIA (`DATE()`) em vez de igualdade exata de timestamp — para pegar duplicatas que a correção anterior (comparação exata) poderia não detectar.

```sql
SELECT falta.id, DATE(falta.data) AS dia, falta."funcionarioId", u.name
FROM registros_atividade falta
JOIN users u ON u.id = falta."funcionarioId"
WHERE falta."isFalta" = true
  AND falta."motivoFalta" = 'nao_registrado'
  AND EXISTS (
    SELECT 1 FROM registros_atividade real
    WHERE real."funcionarioId" = falta."funcionarioId"
      AND DATE(real.data) = DATE(falta.data)
      AND real."isFalta" = false
  )
ORDER BY u.name, dia;
```

Resultado (1 row):

| id | dia | funcionarioId | name |
|---|---|---|---|
| cmrlxpch100015gj3om680zuj | 2026-07-14 | cmr4ygj4f00052pghgyst49ot | MARIA EUNICE JESUS CARVALHO |

**DELETE executado em 16/07/2026, autorizado pelo usuário:**

```sql
DELETE FROM registros_atividade
WHERE id = 'cmrlxpch100015gj3om680zuj';
```

Resultado: `DELETE 1` — a falta automática duplicada de MARIA EUNICE JESUS CARVALHO (14/07) foi removida com sucesso. Faxina completa concluída.
