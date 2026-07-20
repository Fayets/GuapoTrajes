"""Helpers para revisiones de devolución (parcial)."""
from __future__ import annotations

from typing import Any, List, Optional, Tuple

PREFIJO_REVISION_NOTA = "[REVISIÓN]"
MENSAJE_CUIDADO_ESPECIAL = (
    "Revisión pendiente: revisar la prenda con especial cuidado antes de cerrar el contrato. "
    "No romper el pagaré hasta finalizar la revisión."
)


def notas_indican_revision(notas: Optional[str]) -> bool:
    if not notas:
        return False
    return notas.strip().startswith(PREFIJO_REVISION_NOTA)


def cuidado_especial_desde_ingresos(
    producto, ingresos: List[Any]
) -> Tuple[bool, Optional[int]]:
    """Detecta si el regreso de taller requiere cuidado especial.

    Returns:
        (requiere_cuidado, orden_id)
    """
    from src.models import EstadoRevisionDevolucion

    orden_id = None
    for ingreso in ingresos or []:
        if notas_indican_revision(getattr(ingreso, "notas", None)):
            # Preferir orden vinculada a revisión abierta del mismo producto
            break

    for r in list(getattr(producto, "revisiones_devolucion", []) or []):
        if (r.estado or "") == EstadoRevisionDevolucion.ABIERTA.value:
            orden_id = r.orden.id if r.orden else None
            return True, orden_id

    for ingreso in ingresos or []:
        if notas_indican_revision(getattr(ingreso, "notas", None)):
            return True, orden_id

    return False, None
