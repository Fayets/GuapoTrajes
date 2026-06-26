from datetime import datetime
from zoneinfo import ZoneInfo

from src.fechas_ar import (
    ZONA_ARGENTINA,
    ahora_ar,
    formatear_hora_ar,
    instante_a_fecha_ar,
    normalizar_fecha_hora_ar,
)


def test_ahora_ar_es_naive_hora_argentina():
    ahora = ahora_ar()
    assert ahora.tzinfo is None
    ref = datetime.now(ZONA_ARGENTINA).replace(tzinfo=None)
    assert abs((ahora - ref).total_seconds()) < 2


def test_formatear_hora_ar_desde_utc_naive():
    # 15:13 UTC ≈ 12:13 en Argentina (UTC-3)
    utc_naive = datetime(2026, 6, 24, 15, 13, 0)
    utc_aware = utc_naive.replace(tzinfo=ZoneInfo("UTC"))
    assert formatear_hora_ar(utc_aware) == "12:13"


def test_instante_a_fecha_ar_trata_naive_como_argentina():
    val = datetime(2026, 6, 24, 23, 30, 0)
    assert instante_a_fecha_ar(val).isoformat() == "2026-06-24"


def test_normalizar_fecha_hora_ar_desde_utc():
    aware = datetime(2026, 6, 24, 14, 0, 0, tzinfo=ZoneInfo("UTC"))
    assert normalizar_fecha_hora_ar(aware) == datetime(2026, 6, 24, 11, 0, 0)
