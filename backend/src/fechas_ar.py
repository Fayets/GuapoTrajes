"""
Fechas de negocio en Argentina (Buenos Aires).
Toda fecha con hora/zona se interpreta o se expone según America/Argentina/Buenos_Aires.
Las cadenas solo "YYYY-MM-DD" son día civil sin conversión.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional, Union

from zoneinfo import ZoneInfo

ZONA_ARGENTINA = ZoneInfo("America/Argentina/Buenos_Aires")


def instante_a_fecha_ar(val: Union[date, datetime]) -> date:
    """Convierte date o datetime al día civil en Argentina."""
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=ZONA_ARGENTINA).date()
        return val.astimezone(ZONA_ARGENTINA).date()
    raise TypeError(f"Tipo no soportado: {type(val)}")


def parse_fecha_presupuesto_entrada(val) -> date:
    """Entrada API / JSON → date (día civil AR si hay componente horario)."""
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return instante_a_fecha_ar(val)
    if isinstance(val, str):
        s = val.strip()
        if not s:
            raise ValueError("fecha vacía")
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
            return date.fromisoformat(s)
        normalized = s.replace("Z", "+00:00").replace("z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZONA_ARGENTINA)
        return dt.astimezone(ZONA_ARGENTINA).date()
    raise ValueError("formato de fecha no válido")


def parse_fecha_query_presupuesto(s: str) -> date:
    """
    Query param (ej. conjuntos): YYYY-MM-DD o ISO completo → date en AR si aplica.
    """
    raw = (s or "").strip()
    if not raw:
        raise ValueError("fecha vacía")
    if len(raw) == 10 and raw[4] == "-" and raw[7] == "-":
        try:
            return date.fromisoformat(raw)
        except ValueError:
            pass
    return parse_fecha_presupuesto_entrada(raw)


def ahora_ar() -> datetime:
    """Hora actual en Argentina como datetime naive (convención de almacenamiento en BD)."""
    return datetime.now(ZONA_ARGENTINA).replace(tzinfo=None)


def hoy_ar() -> date:
    """Día civil actual en Argentina (no usar date.today() del servidor UTC)."""
    return datetime.now(ZONA_ARGENTINA).date()


def utc_naive_a_ar_naive(val: datetime) -> datetime:
    """Interpreta un datetime naive como UTC y lo convierte a hora Argentina naive."""
    if val.tzinfo is not None:
        return val.astimezone(ZONA_ARGENTINA).replace(tzinfo=None)
    return val.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZONA_ARGENTINA).replace(tzinfo=None)


def parece_timestamp_utc_tras_medianoche(val: datetime) -> bool:
    """
    Detecta el bug típico: hora de negocio AR (21:00–23:59) guardada como UTC naive
    (00:00–02:59 del día siguiente). No toca valores ya normalizados a AR.
    """
    if val is None:
        return False
    naive = val.replace(tzinfo=None) if val.tzinfo is not None else val
    ar = utc_naive_a_ar_naive(naive)
    return (
        ar.date() != naive.date()
        and naive.hour < 3
        and ar.hour >= 21
    )


def normalizar_fecha_hora_ar(val: datetime) -> datetime:
    """Normaliza un datetime a hora Argentina naive."""
    if val.tzinfo is None:
        return val
    return val.astimezone(ZONA_ARGENTINA).replace(tzinfo=None)


def formatear_hora_ar(val: datetime, fmt: str = "%H:%M") -> str:
    """Formatea la hora de un instante en Argentina."""
    return normalizar_fecha_hora_ar(val).strftime(fmt)


def formatear_fecha_ar(val: datetime, fmt: str = "%Y-%m-%d") -> str:
    """Formatea la fecha de un instante en Argentina."""
    return normalizar_fecha_hora_ar(val).strftime(fmt)


def fecha_presupuesto_api_ymd(val) -> Optional[str]:
    """Serializa fecha de presupuesto a 'YYYY-MM-DD' (día civil Argentina si era datetime)."""
    if val is None:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, datetime):
        return instante_a_fecha_ar(val).isoformat()
    text = str(val).strip()
    if len(text) >= 10 and "T" not in text[:11]:
        return text[:10]
    try:
        return parse_fecha_presupuesto_entrada(text).isoformat()
    except ValueError:
        return text[:10] if len(text) >= 10 else text


def isoformat_ar(val: Optional[datetime]) -> Optional[str]:
    """
    Serializa datetime para APIs con offset Argentina (-03:00).
    Los valores naive se interpretan como hora de negocio en Buenos Aires.
    """
    if val is None:
        return None
    if val.tzinfo is not None:
        dt = val.astimezone(ZONA_ARGENTINA)
    else:
        dt = val.replace(tzinfo=ZONA_ARGENTINA)
    return dt.isoformat()
