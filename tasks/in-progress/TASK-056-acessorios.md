# TASK-056 — acessórios de içamento

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Branch** | `task/TASK-056-acessorios` |
| **ADR / regra** | ADR-026 / RN-014 |

## Critérios de aceite
- [x] CA-1 Catálogo `accessories`, migration `03845e55f0a8` e CRUD admin (leitura para logados).
- [x] CA-2 `accessory_ids` na avaliação REST e WebSocket; peso comparado soma os acessórios; resposta traz `accessories_weight_kg` e `accessories`.
- [x] CA-3 Frontend: cliente REST, seletor trocável a qualquer momento, `accessoryIds`, parcela "Acessórios" no HUD.
- [x] CA-4 Carga desce a soma de `rigging_height_m`; carregador de GLB por acessório.
- [ ] CA-5 Modelos 3D reais: pendentes de confirmação de download pela pessoa.
