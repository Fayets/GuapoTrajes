"""Orden de prendas para etiquetado: línea (tipo) y luego talle."""
from __future__ import annotations

from typing import Any, Iterable, List, TypeVar

T = TypeVar("T", bound=dict[str, Any])


def _norm(s: str | None) -> str:
    return (s or "").strip().casefold()


def _norm_o_ultimo(s: str | None) -> str:
    v = _norm(s)
    return v if v else "\uffff"


def clave_orden_etiquetado(item: dict[str, Any]) -> tuple:
    """Clave de orden: línea → talle (código, luego nombre) → descripción → id."""
    return (
        _norm_o_ultimo(item.get("linea_nombre")),
        _norm_o_ultimo(item.get("talle_codigo")),
        _norm_o_ultimo(item.get("talle_nombre")),
        _norm(item.get("descripcion")),
        item.get("id") or 0,
    )


def ordenar_productos_para_etiquetado(items: Iterable[T]) -> List[T]:
    """Ordena prendas por tipo (línea) y talle para facilitar el etiquetado."""
    return sorted(items, key=clave_orden_etiquetado)
