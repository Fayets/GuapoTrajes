from typing import Optional


def format_descripcion_producto(
    descripcion: Optional[str],
    descripcion_extra: Optional[str] = None,
) -> str:
    """Combina descripción y descripción extra separadas por guión."""
    base = (descripcion or "").strip()
    extra = (descripcion_extra or "").strip()
    if extra:
        return f"{base} - {extra}" if base else extra
    return base
