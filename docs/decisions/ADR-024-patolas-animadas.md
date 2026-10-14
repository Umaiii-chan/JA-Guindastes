# ADR-024 — patolas animadas: só do modelo 3D, nada desenhado por código

| Campo                  | Valor                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| **Status**             | Aceito                                                                |
| **Data**               | 2026-10-14                                                            |
| **Autor**              | agente Claude Code, registrando decisão da pessoa responsável         |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-14                                |
| **Tarefa relacionada** | TASK-054                                                              |

## Contexto

A RN-013 (TASK-055) usa o estado das patolas no risco de tombamento, e a tabela de carga pressupõe
patolas estendidas e apoiadas (PEND-005). A pessoa responsável decidiu que as patolas devem vir do
**modelo 3D**, e que nada desenhado por código serve de substituto.

O GLB atual (`frontend/public/models/guindaste-caminhao.glb`) foi gerado de um FBX que não está no
repositório; o conversor (regra R9 de `frontend/scripts/convert-crane-model.mjs`) fundiu o chassi em
quatro malhas por material. Foi preciso conferir se vigas, macacos e sapatas existem ali.

## Decisão

1. **Análise do GLB.** As quatro malhas do chassi foram separadas em componentes conexos (27, 32,
   48 e 6 peças) e cada caixa delimitadora foi examinada. Não há viga transversal estendível, macaco
   nem sapata: as peças de maior extensão em X são o quadro e a carroceria; as 20 peças com y de 0 a
   0,94 m são pneus (cinco eixos, rodado duplo); as demais são para-lamas, faróis, para-choque e
   cabine. Nada tem a forma de patola. **O modelo não traz patolas.**
2. **Nada é modelado por código.** Nenhum script gera caixas ou cilindros no lugar. O contrato dos
   nós (`crane-outrigger-{fl,fr,rl,rr}-{beam,jack,pad}`) fica fixado; quando houver um modelo 3D de
   terceiros com patolas, com licença registrada, um script determinístico novo o converte para
   esses nomes e atualiza o SHA em `tests/three/loaders/truckCraneModel.test.ts`.
3. **`OutriggerController`** (`frontend/src/three/crane/`) implementa a animação já: extensão de 0 a
   100 %, descida dos macacos até o terreno (`groundHeightAt`, plano em 0 por padrão) e nivelamento
   até `max_leveling_deg`. Move apenas os nós com esses nomes; sem eles, guarda o estado e não
   desenha nada. A ordem é natural: macacos só descem com as vigas estendidas e sobem antes de elas
   recolherem. O render é sob demanda: o controller invalida enquanto anima.
4. **Estado enviado ao backend:** `outriggers: { extension_percent, jacks_set }` (REST e WebSocket).
   O backend valida (0 a 100 %, booleano, sem campo extra) e ainda não usa o valor.
5. **Nivelamento:** `max_leveling_deg` ainda não existe no tipo do catálogo (TASK-051). Até lá vale a
   constante **FICTÍCIA** de 3° (`FICTITIOUS_MAX_LEVELING_DEG`). O curso das vigas também é
   FICTÍCIO (1,2 m) até o modelo dizer.
6. A cena é só ilustração: quem decide é o backend (RN-008).

## Alternativas consideradas

| Alternativa | Por que não |
|-------------|-------------|
| Desenhar caixas e cilindros por código | rejeitada pela pessoa: nada desenhado por código como substituto |
| Gerar o GLB com patolas a partir das peças do chassi | as peças não existem no modelo |
| Esperar o modelo para fazer tudo | atrasa o contrato, os controles, o aviso "não prontas" e o envio ao backend |

## Consequências

- Os controles (estender, recolher, apoiar e nivelar) e o aviso de "patolas não prontas" já
  funcionam, e o backend já recebe o estado; **a cena ainda não mostra as patolas**, e a tela avisa.
- Falta um modelo 3D com patolas (pendência registrada no handoff da TASK-054).
- O nivelamento só muda o número mostrado e o `levelingDeg` do estado; inclinar o guindaste na cena
  depende do terreno da TASK-052.
