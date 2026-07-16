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
