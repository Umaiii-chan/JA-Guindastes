# ADR-026 — acessórios de içamento com modelos 3D de terceiros

| Campo | Valor |
|-------|-------|
| **Status** | Aceito (Anderson Sehnem, em chat em 2026-10-14) |
| **Data** | 2026-10-14 |
| **Decisores** | Anderson Sehnem, em chat em 2026-10-14 |
| **Tarefa relacionada** | TASK-056 |
| **Regra** | RN-014 (estende o ADR-018) |

## Decisão

- Catálogo `accessories` (id, tipo, nome, peso, `rigging_height_m`, `model_file` anulável, crédito e licença), com CRUD (leitura: qualquer perfil logado; escrita: ADMIN). Tipos: moitão/gancho, bola de peso, gancho giratório, manilha, linga de cabo de aço, linga de corrente, cinta de poliéster, balancim e tapete de patola. Jib e contrapeso são configurações.
- A avaliação aceita `accessory_ids`; o peso comparado é carga + gancho + acessórios (`weight_compared_with_capacity`). Id desconhecido torna a operação "não avaliável" (`ACCESSORY_NOT_FOUND`), para não subestimar o peso. O mesmo id repetido soma de novo.
- Frontend: a carga desce a soma de `rigging_height_m` (`computeLoadBox`, aditivo). Modelos GLB/glTF só de terceiros, em `frontend/public/models/acessorios/<arquivo>`, com licença em `CREDITS.md`. Sem arquivo, o acessório entra só no peso e na distância, com o aviso "modelo 3D pendente". Nada é modelado por código.
- `model_file` aceita só nome de arquivo `.glb`/`.gltf` (sem pasta).
