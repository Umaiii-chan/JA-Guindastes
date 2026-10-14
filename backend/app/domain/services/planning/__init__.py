"""Planejamento da operação: modelo de guindaste, posição e trajetória (TASK-075; ADR-038).

Serviços de domínio puros, sem E/S. A capacidade e a segurança vêm só do cálculo determinístico
(tabela de carga, limites e RN-011 a RN-015), injetado como `StateEvaluator`; nada aqui estima
capacidade por heurística.
"""
