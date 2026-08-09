"""Observaciones de presupuesto visibles para cliente/orden (excluye avisos internos)."""

PREFIJO_CONJUNTOS_ARMADOS = "Conjuntos ya armados para esta fecha:"


def es_observacion_conjuntos_armados(observaciones: str | None) -> bool:
    if not (observaciones or "").strip():
        return False
    return observaciones.strip().startswith(PREFIJO_CONJUNTOS_ARMADOS)


def observaciones_presupuesto_para_mostrar(observaciones: str | None) -> str:
    """Texto de observaciones útil para orden, reportes y modista (sin aviso interno)."""
    if not (observaciones or "").strip():
        return ""
    if es_observacion_conjuntos_armados(observaciones):
        return ""
    return observaciones.strip()
