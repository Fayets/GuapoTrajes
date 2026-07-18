"""Utilidades de montos en pesos (enteros, sin centavos erróneos por float)."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def round_pesos(value: float | int | str | None) -> float:
    """Redondea a peso entero con HALF_UP (igual que Math.round en JS positivo).

    Evita el redondeo bancario de ``round()`` de Python, que convierte
    40058.5 → 40058 y hace que un pago mostrado como $40.059 quede en $40.058.
    """
    if value is None:
        return 0.0
    try:
        return float(Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    except (TypeError, ValueError, InvalidOperation):
        return 0.0
