# Modelos 3D de exemplo — FICTÍCIOS

> **FICTÍCIO.** Os arquivos desta pasta não representam nenhum guindaste real. Servem só para testar
> o carregamento de GLB/glTF (ADR-008) e o mapeamento cinemático enquanto o modelo real não chega
> (`docs/known-gaps.md`, L-002). Rótulo exigido pelo ADR-012.

## `guindaste-provisorio.ficticio.glb`

| Campo | Valor |
|-------|-------|
| Origem | guindaste provisório da PoC (`frontend/src/three/crane/createProvisionalCrane.ts`, TASK-013/016) exportado com o `GLTFExporter` do Three.js |
| Gerado por | `frontend/tests/three/loaders/exampleModel.test.ts` (TASK-026); a geração é determinística |
| Formato | GLB (glTF 2.0 binário), cerca de 62 KB, sem texturas |
| Unidade e eixos | metro; Y para cima, +Z para a frente do chassi (ADR-013 C-1) |
| Pose | repouso do ADR-013 C-4, regra 4: ψ = 0, θ = 0, lança toda recolhida, gancho na ponta (c = 0) |
| Rótulo no arquivo | `extras` do nó `crane-base`: `{ "ficticio": true, "aviso": "MODELO FICTÍCIO: ..." }` |

Medidas FICTÍCIAS usadas para montá-lo (as mesmas da PoC): pino da lança com a = −1,56 m e h = 3,3 m
(a passou de −1,2 m para −1,56 m na TASK-041, igual à ficha de demo e ao modelo ilustrativo da TASK-043);
lança recolhida de 12 m e estendida de 22 m. No sistema, a, h e os limites vêm da ficha técnica, **nunca
do GLB** (RN-003; ADR-013 C-4, regra 1). O GLB só precisa ser coerente com eles, e a divergência é
avisada pelo mapeamento como erro de calibração (só visual).

Para regenerar (depois de mudar o guindaste provisório), em `frontend/`:

```bash
UPDATE_EXAMPLE_GLB=1 npx vitest run tests/three/loaders/exampleModel.test.ts
```

No PowerShell: `$env:UPDATE_EXAMPLE_GLB='1'; npx vitest run tests/three/loaders/exampleModel.test.ts`.
Sem a variável, o mesmo teste confere que o arquivo versionado continua com a hierarquia e as posições
do guindaste provisório.

### Hierarquia de nós

```text
crane-base                     papel base          chassi; origem O no chão, sob o eixo de giro
└── crane-turret               papel turret        gira em Y (ψ)
    └── crane-boom             papel boom          origem no pino P = (0, h, a); inclina em X (θ)
        └── crane-boom-extension  papel boomExtension  desliza no +Z da lança (L)
            └── crane-boom-tip    papel boomTip        ponta T, a L_min do pino em repouso
                └── crane-cable      papel cable       pivô do cabo, mantido na vertical
                    ├── crane-cable-line  papel cableLine  linha de altura 1, topo na origem, escalada em Y
                    └── crane-hook        papel hook       ponto de suspensão G
```

Os nós sem nome (malhas: caixas, rodas, polia) viram `mesh_N` ao carregar e não entram no mapeamento.

## Requisitos para um GLB real

Baseados na doc-fonte (`docs/produto/documentacao-tecnica-v0.1.md` § 12.1) e no que o
`CraneController` e o mapeamento (`frontend/src/three/crane/craneKinematics.ts`) conferem hoje:

1. **Escala conhecida e consistente:** metros, sem escala nos nós do mapeamento nem nos pais deles. Um
   asset em milímetros ou centímetros é reconhecido e avisado.
2. **Partes móveis separadas em nós:** torre, lança, extensão telescópica (se houver), ponta, cabo e
   gancho, na hierarquia acima (cada papel abaixo do anterior; nós intermediários são tolerados, desde
   que sem escala nem rotação).
3. **Pivôs nas articulações reais:** origem da torre sobre o eixo de giro; origem da lança no pino do pé
   da lança; origem da ponta no eixo da polia; origem do gancho no ponto de suspensão.
4. **Pose de repouso** (ADR-013 C-4, regra 4): lança horizontal, apontando para +Z, toda recolhida, e
   os nós sem rotação em relação ao chassi. Outra pose ainda não é suportada (é avisada).
5. **Nomes de nós únicos e estáveis, ou mapeamento configurável:** o mapeamento papel → nome é
   configurável (`CraneKinematicsNodeNames`); nomes repetidos são erro. Obrigatórios: `turret`,
   `boom`, `boomTip`, `cable`, `hook`. Opcionais: `base` (sem ele, usa-se a raiz do asset),
   `boomExtension` (lança fixa) e `cableLine`.
6. **Coerente com a ficha técnica:** P = (0, h, a) e T = (0, h, a + L_min) na pose de repouso, com a,
   h e L_min da ficha técnica.
7. **Complexidade poligonal compatível com uso web** e **versão do asset rastreável** (ainda não há
   limite nem cadastro definidos; ver pendências da TASK-026).
8. **Testes visuais de rotação, inclinação e extensão:** a conferência automática de calibração do
   mapeamento cobre a pose de repouso; os testes com o `CraneController` cobrem os movimentos.
