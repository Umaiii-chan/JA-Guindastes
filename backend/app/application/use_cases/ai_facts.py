"""Fatos calculados que o assistente de IA recebe e o texto fixo dos relatórios (TASK-076; ADR-039).

Tudo aqui é determinístico: números que já vieram do cálculo do simulador (avaliação do backend,
RN-004, RN-008) ou contas simples sobre uma gravação. A IA recebe estes fatos para explicá-los, e as
tabelas dos relatórios são montadas por código, nunca escritas pelo modelo.

Os quadros de uma gravação são JSON opaco escrito pelo frontend (ADR-027): a leitura é tolerante,
e o que faltar vira "sem dado".
"""

from collections.abc import Mapping, Sequence
from typing import Any

MAX_TIMELINE_ROWS = 24
MAX_ALERTS = 15

_LEVEL_LABEL = {"OK": "Dentro do limite", "WARNING": "Em atenção", "OVER": "Acima do limite"}
_RISK_LABEL = {"LOW": "Baixo", "ATTENTION": "Atenção", "HIGH": "Alto"}
_RISK_ORDER = {"LOW": 0, "ATTENTION": 1, "HIGH": 2}
_REASON_LABEL = {
    "CRANE_GEOMETRY_NOT_FOUND": "o guindaste não tem ficha técnica cadastrada",
    "OUTSIDE_GEOMETRIC_DOMAIN": "a ponta da lança ficou atrás do eixo de giro",
    "ACTIVE_LOAD_CHART_NOT_FOUND": "não há tabela de carga ativa para este guindaste e este giro",
    "UTILIZATION_UNDEFINED": "a tabela informa capacidade zero neste ponto",
    "ACCESSORY_NOT_FOUND": "um acessório de içamento informado não existe no cadastro",
}


def fmt(value: float | int | None, decimals: int = 1, unit: str = "") -> str:
    """Número no formato brasileiro (`1.234,5`); `None` vira um traço."""
    if value is None:
        return "—"
    text = f"{value:,.{decimals}f}".replace(",", "#").replace(".", ",").replace("#", ".")
    return f"{text} {unit}".strip()


def _get(data: Mapping[str, Any] | None, *path: str) -> Any:
    current: Any = data
    for key in path:
        if not isinstance(current, Mapping):
            return None
        current = current.get(key)
    return current


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value)


# --- Relatório de içamento ------------------------------------------------------------------


def evaluation_table(
    *,
    evaluation: Mapping[str, Any],
    state: Mapping[str, Any],
    load: Mapping[str, Any],
    crane_label: str | None,
) -> str:
    """Tabela Markdown "Dados do cálculo", só com valores do cálculo e do que a pessoa informou."""
    rows: list[tuple[str, str]] = []
    rows.append(("Guindaste", crane_label or str(evaluation.get("configuration_id", "—"))))
    description = str(load.get("description") or "Carga")
    dims = [_number(load.get(key)) for key in ("length_m", "width_m", "height_m")]
    dims_text = (
        f" ({' × '.join(fmt(d, 2) for d in dims)} m)" if all(d is not None for d in dims) else ""
    )
    rows.append(
        ("Carga", f"{description}: {fmt(_number(state.get('load_weight_kg')), 0, 'kg')}{dims_text}")
    )
    rows.append(("Comprimento da lança", fmt(_number(state.get("boom_length_m")), 2, "m")))
    rows.append(("Ângulo da lança", fmt(_number(state.get("boom_angle_deg")), 1, "°")))
    rows.append(("Giro da torre", fmt(_number(state.get("turret_rotation_deg")), 1, "°")))
    rows.append(("Cabo", fmt(_number(state.get("cable_length_m")), 2, "m")))

    evaluated = evaluation.get("status") == "EVALUATED"
    radius = _number(_get(evaluation, "geometry", "working_radius_m"))
    rows.append(("Raio de trabalho", fmt(radius, 2, "m")))
    rows.append(
        ("Altura do gancho", fmt(_number(_get(evaluation, "geometry", "hook_height_m")), 2, "m"))
    )
    zone = evaluation.get("rotation_zone_name")
    if zone:
        rows.append(("Zona de giro", str(zone)))
    rows.append(
        (
            "Peso comparado (carga + gancho + acessórios)",
            fmt(_number(evaluation.get("compared_weight_kg")), 0, "kg"),
        )
    )
    accessories = evaluation.get("accessories") or []
    if accessories:
        names = ", ".join(str(item.get("name", "?")) for item in accessories)
        rows.append(("Acessórios de içamento", names))
    if evaluated:
        rows.append(
            (
                "Capacidade na tabela",
                fmt(_number(_get(evaluation, "capacity", "maximum_capacity_kg")), 0, "kg"),
            )
        )
        rows.append(
            (
                "Utilização da capacidade da tabela",
                fmt(_number(evaluation.get("utilization_percent")), 1, "%"),
            )
        )
        limit = evaluation.get("capacity_limit")
        if isinstance(limit, Mapping):
            limit_label = fmt(_number(limit.get("limit_percent")), 0, "%")
            rows.append(
                (
                    f"Utilização do limite do guindaste ({limit_label})",
                    fmt(_number(limit.get("limit_utilization_percent")), 1, "%"),
                )
            )
            rows.append(
                ("Situação frente ao limite", _LEVEL_LABEL.get(str(limit.get("level")), "—"))
            )
    else:
        reasons = [
            _REASON_LABEL.get(str(item.get("code")), str(item.get("code")))
            for item in evaluation.get("reasons") or []
            if isinstance(item, Mapping)
        ]
        rows.append(("Resultado", "não avaliável: " + "; ".join(reasons) if reasons else "—"))
    risk = evaluation.get("tipping_risk")
    rows.append(("Risco de tombamento", _RISK_LABEL.get(str(risk), "não calculado")))
    chart_id, version = evaluation.get("load_chart_id"), evaluation.get("load_chart_version")
    if chart_id:
        rows.append(("Tabela de carga usada", f"{chart_id} (versão {version})"))

    lines = ["| Item | Valor |", "| --- | --- |"]
    lines += [f"| {_cell(name)} | {_cell(value)} |" for name, value in rows]
    alerts = [a for a in evaluation.get("alerts") or [] if isinstance(a, Mapping)]
    if alerts:
        lines += ["", "**Alertas do cálculo**", ""]
        lines += [f"- {_cell(str(a.get('message', a.get('code', ''))))}" for a in alerts]
    return "\n".join(lines)


def _cell(text: str) -> str:
    return text.replace("|", "/").replace("\n", " ")


def scenario_summary(scenario: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """Resumo curto do cenário (sem as coordenadas todas) para o texto do relatório."""
    if not isinstance(scenario, Mapping):
        return None
    obstacles = scenario.get("obstacles")
    labels = [
        str(item.get("label"))
        for item in (obstacles if isinstance(obstacles, list) else [])
        if isinstance(item, Mapping) and item.get("label")
    ]
    wind = scenario.get("wind")
    return {
        "inclinacao_x_percent": _get(scenario, "terrain", "slope_x_percent"),
        "inclinacao_z_percent": _get(scenario, "terrain", "slope_z_percent"),
        "feicoes_do_terreno": len(_get(scenario, "terrain", "features") or []),
        "obstaculos": labels[:20],
        "vento_ms": _get(wind, "speed_ms") if isinstance(wind, Mapping) else None,
        "zonas_de_solo": [
            z.get("kind") for z in scenario.get("soil_zones") or [] if isinstance(z, Mapping)
        ],
        "posicao_do_guindaste": scenario.get("crane"),
        "posicao_da_carga": scenario.get("cargo"),
        "entrega": scenario.get("delivery"),
    }


# --- Gravação -------------------------------------------------------------------------------


def recording_facts(frames: Sequence[Mapping[str, Any]], duration_ms: int) -> dict[str, Any]:
    """Indicadores e linha do tempo de uma gravação, a partir dos quadros gravados."""
    level_frames = {"OK": 0, "WARNING": 0, "OVER": 0}
    evaluated = not_evaluable = collision_frames = 0
    first_collision: float | None = None
    max_util: tuple[float, float] | None = None
    max_limit_util: tuple[float, float] | None = None
    worst_risk: str | None = None
    alerts: dict[str, dict[str, Any]] = {}
    ranges: dict[str, list[float]] = {}
    configuration_ids: set[str] = set()
    max_weight = 0.0

    for frame in frames:
        t_s = (_number(frame.get("tMs")) or 0.0) / 1000
        crane = frame.get("crane")
        for key, name in (
            ("boomAngleDeg", "boom_angle_deg"),
            ("boomLengthM", "boom_length_m"),
            ("turretRotationDeg", "turret_rotation_deg"),
            ("cableLengthM", "cable_length_m"),
        ):
            value = _number(_get(crane, key))
            if value is not None:
                low, high = ranges.setdefault(name, [value, value])
                ranges[name] = [min(low, value), max(high, value)]
        if isinstance(frame.get("configurationId"), str):
            configuration_ids.add(frame["configurationId"])
        max_weight = max(max_weight, _number(frame.get("loadWeightKg")) or 0.0)
        collisions = frame.get("collisions")
        if isinstance(collisions, list) and collisions:
            collision_frames += 1
            first_collision = t_s if first_collision is None else first_collision

        result = frame.get("evaluation")
        if not isinstance(result, Mapping):
            continue
        if result.get("kind") == "EVALUATED":
            evaluated += 1
            util = _number(result.get("utilizationPercent"))
            if util is not None and (max_util is None or util > max_util[0]):
                max_util = (util, t_s)
        else:
            not_evaluable += 1
        limit = result.get("capacityLimit")
        if isinstance(limit, Mapping):
            level = str(limit.get("level"))
            if level in level_frames:
                level_frames[level] += 1
            lim_util = _number(limit.get("limitUtilizationPercent"))
            if lim_util is not None and (max_limit_util is None or lim_util > max_limit_util[0]):
                max_limit_util = (lim_util, t_s)
        risk = result.get("tippingRisk")
        if isinstance(risk, str) and risk in _RISK_ORDER:
            if worst_risk is None or _RISK_ORDER[risk] > _RISK_ORDER[worst_risk]:
                worst_risk = risk
        for alert in result.get("alerts") or []:
            if isinstance(alert, Mapping) and isinstance(alert.get("code"), str):
                entry = alerts.setdefault(
                    alert["code"],
                    {
                        "code": alert["code"],
                        "severity": alert.get("severity"),
                        "message": alert.get("message"),
                        "first_at_s": round(t_s, 1),
                        "frames": 0,
                    },
                )
                entry["frames"] += 1

    return {
        "duration_s": round(duration_ms / 1000, 1),
        "frame_count": len(frames),
        "configuration_ids": sorted(configuration_ids),
        "max_load_weight_kg": max_weight or None,
        "evaluated_frames": evaluated,
        "not_evaluable_frames": not_evaluable,
        "max_utilization_percent": _peak(max_util),
        "max_limit_utilization_percent": _peak(max_limit_util),
        "frames_by_limit_level": level_frames,
        "worst_tipping_risk": worst_risk,
        "alerts": sorted(alerts.values(), key=lambda a: a["first_at_s"])[:MAX_ALERTS],
        "collision_frames": collision_frames,
        "first_collision_at_s": None if first_collision is None else round(first_collision, 1),
        "crane_ranges": {name: [round(v, 1) for v in span] for name, span in ranges.items()},
        "timeline": _timeline(frames),
    }


def _peak(peak: tuple[float, float] | None) -> dict[str, float] | None:
    return None if peak is None else {"value": round(peak[0], 1), "at_s": round(peak[1], 1)}


def _timeline(frames: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    if not frames:
        return []
    step = max(1, -(-len(frames) // MAX_TIMELINE_ROWS))
    picked = list(frames[::step])
    if picked[-1] is not frames[-1]:
        picked.append(frames[-1])
    rows: list[dict[str, Any]] = []
    for frame in picked:
        crane = frame.get("crane")
        result = frame.get("evaluation")
        limit = _get(result, "capacityLimit")
        rows.append(
            {
                "t_s": round((_number(frame.get("tMs")) or 0.0) / 1000, 1),
                "boom_angle_deg": _round(_get(crane, "boomAngleDeg")),
                "boom_length_m": _round(_get(crane, "boomLengthM")),
                "turret_rotation_deg": _round(_get(crane, "turretRotationDeg")),
                "working_radius_m": _round(_get(result, "workingRadiusM")),
                "utilization_percent": _round(_get(result, "utilizationPercent")),
                "limit_level": _get(limit, "level") if isinstance(limit, Mapping) else None,
                "tipping_risk": _get(result, "tippingRisk"),
            }
        )
    return rows


def _round(value: Any) -> float | None:
    number = _number(value)
    return None if number is None else round(number, 1)


def recording_table(facts: Mapping[str, Any], name: str) -> str:
    """Tabela Markdown "Indicadores da gravação", montada só dos fatos calculados."""
    peak = facts.get("max_utilization_percent")
    limit_peak = facts.get("max_limit_utilization_percent")
    levels = facts.get("frames_by_limit_level") or {}
    rows = [
        ("Gravação", name),
        ("Duração", fmt(_number(facts.get("duration_s")), 1, "s")),
        ("Quadros", fmt(_number(facts.get("frame_count")), 0)),
        (
            "Pico de utilização da tabela",
            "—" if not peak else f"{fmt(peak['value'], 1, '%')} aos {fmt(peak['at_s'], 1, 's')}",
        ),
        (
            "Pico de utilização do limite",
            "—"
            if not limit_peak
            else f"{fmt(limit_peak['value'], 1, '%')} aos {fmt(limit_peak['at_s'], 1, 's')}",
        ),
        (
            "Quadros por situação",
            f"dentro do limite {levels.get('OK', 0)}, em atenção {levels.get('WARNING', 0)}, "
            f"acima do limite {levels.get('OVER', 0)}",
        ),
        ("Pior risco de tombamento", _RISK_LABEL.get(str(facts.get("worst_tipping_risk")), "—")),
        ("Quadros com colisão", fmt(_number(facts.get("collision_frames")), 0)),
        ("Quadros não avaliáveis", fmt(_number(facts.get("not_evaluable_frames")), 0)),
    ]
    lines = ["| Item | Valor |", "| --- | --- |"]
    lines += [f"| {_cell(a)} | {_cell(b)} |" for a, b in rows]
    return "\n".join(lines)
