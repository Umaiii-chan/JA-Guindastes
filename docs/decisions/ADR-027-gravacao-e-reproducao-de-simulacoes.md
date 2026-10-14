# ADR-027 — gravar, salvar e reproduzir simulações

| Campo                  | Valor                                                    |
| ---------------------- | -------------------------------------------------------- |
| **Status** | Aceito (Anderson Sehnem, em chat em 2026-10-14) |
| **Data**               | 2026-10-14                                               |
| **Tarefa relacionada** | TASK-057 (leva E)                                        |
| **Regras**             | RN-005 (versão da tabela registrada), RN-008, ADR-016    |

## Decisão

- **Quadro** (`RecordingFrame`): `tMs`, estado do guindaste, `configurationId`, `loadWeightKg`, `evaluation`
  (resultado do backend, com alertas) e, opcionais das outras tarefas, `outriggers`, `accessoryIds`,
  `collisions`. O gravador (`frontend/src/application/recording/`) é puro: um quadro por mudança, no
  máximo a 10 Hz; o primeiro quadro é o estado inicial completo; guarda uma cópia do `ScenarioSpec`
  (opcional até a TASK-052 integrar).
- **Reprodução** só escolhe o quadro gravado; nunca reavalia (RN-008). Controles travados.
- **Backend** `simulation_recordings`: metadados, `load_chart_refs` (id e versão, RN-005), cenário em JSON e
  quadros em JSON comprimido com gzip (`bytea`). O backend não interpreta os quadros.
- **Rotas** `/api/v1/simulations`: listar e abrir (logado), criar (autor = quem chama), apagar (autor ou
  admin, ADR-016). Só existem com banco e autenticação.
- **Limites PROVISÓRIOS** (A VALIDAR): 10 min e 5 MB (JSON antes da compressão). 413 `RECORDING_TOO_LARGE`,
  422 `RECORDING_TOO_LONG`.
- Chaves dos quadros em camelCase (como o frontend as escreve); o contrato REST dos metadados é snake_case.

## Consequências

Gravações antigas continuam abríveis se campos opcionais faltarem. Mudar a forma dos quadros exige
tolerância a versões antigas (não há campo de versão do formato ainda).
