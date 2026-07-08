"""Utilidades de montos en pesos (enteros, sin centavos erróneos por float)."""


def round_pesos(value: float | int | None) -> float:
    if value is None:
        return 0.0
    try:
        return float(round(float(value)))
    except (TypeError, ValueError):
        return 0.0
