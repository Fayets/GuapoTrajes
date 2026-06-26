# Contexto: fix horario caja diaria (commit 408e89f)

**Commit completo:** `408e89f` — "Fix etiquetas and fix horario caja diaria"  
**Base anterior:** `f3bed56`  
**Fecha del fix:** 24 jun 2026

## Problema que resolvía

En producción (Render, servidor en UTC), los movimientos de **caja diaria** se guardaban con `datetime.now()` del servidor (UTC). Eso causaba:

- Horas mostradas incorrectas (desfasadas ~3 h respecto a Argentina).
- Movimientos que caían en el **día equivocado** al filtrar por fecha (`fecha_hora.date()` usaba la fecha UTC, no la fecha civil argentina).

## Solución (solo caja diaria — NO incluir cambios de etiquetas)

Usar siempre hora Argentina (`America/Argentina/Buenos_Aires`) para crear, filtrar y formatear timestamps de caja.

---

## Archivos a modificar (fix caja diaria)

### 1. `backend/src/fechas_ar.py` — agregar helpers

Después de `parse_fecha_query_presupuesto`, agregar:

```python
def ahora_ar() -> datetime:
    """Hora actual en Argentina como datetime naive (convención de almacenamiento en BD)."""
    return datetime.now(ZONA_ARGENTINA).replace(tzinfo=None)


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
```

(`instante_a_fecha_ar` ya existía en f3bed56.)

### 2. `backend/src/models.py` — defaults de entidades de caja

Import: `from src.fechas_ar import ahora_ar`

Reemplazar `default=lambda: datetime.now()` por `default=ahora_ar` en:

- `ReciboOrden.fecha_hora`
- `Venta.fecha_hora`
- `CajaMovimiento.fecha_hora`
- `CierreCaja.fecha_hora`

### 3. `backend/src/services/caja_services.py` — lógica principal

Import:

```python
from src.fechas_ar import ahora_ar, formatear_fecha_ar, formatear_hora_ar, instante_a_fecha_ar
```

Cambios:

| Antes | Después |
|-------|---------|
| `fecha_hora=datetime.now()` (crear movimientos) | `fecha_hora=ahora_ar()` |
| `cm.fecha_hora.date()` (filtros por día) | `instante_a_fecha_ar(cm.fecha_hora)` |
| `cm.fecha_hora.strftime("%H:%M")` | `formatear_hora_ar(cm.fecha_hora)` |
| `cm.fecha_hora.strftime("%Y-%m-%d")` | `formatear_fecha_ar(cm.fecha_hora)` |
| `strftime("%H:%M:%S")` | `formatear_hora_ar(..., "%H:%M:%S")` |
| sort key `(x.fecha_hora.date(), ...)` | `(instante_a_fecha_ar(x.fecha_hora), ...)` |

Afecta métodos de listado/filtrado/resumen de caja diaria (movimientos del día, rangos, saldo efectivo, búsqueda).

### 4. `backend/src/services/caja_concentradora_services.py`

Import `ahora_ar`; en creación de `CajaMovimiento`: `fecha_hora=ahora_ar()` (una ocurrencia).

### 5. `backend/src/services/orden_trabajo_services.py`

Import `ahora_ar`; en creación de `CajaMovimiento` por pagos de OT: `fecha_hora=ahora_ar()` (2 ocurrencias, ~líneas 307 y 710).

### 6. `backend/src/migrations.py` — patch datos históricos en prod

Nueva función `ensure_caja_movimientos_fecha_hora_ar()`:

- Solo PostgreSQL + `ENV=production`.
- Tabla `_schema_patches` para ejecutar una sola vez.
- SQL: convierte `CajaMovimientos.fecha_hora` de UTC a `America/Argentina/Buenos_Aires`.
- Patch name: `caja_movimientos_fecha_hora_ar`.

### 7. `backend/main.py` — registrar migración al arranque

- Importar `ensure_caja_movimientos_fecha_hora_ar` desde `migrations`.
- Llamar `ensure_caja_movimientos_fecha_hora_ar()` junto a los otros `ensure_*`.

### 8. `backend/tests/test_fechas_ar.py` — tests nuevos

4 tests unitarios para `ahora_ar`, `formatear_hora_ar`, `instante_a_fecha_ar`, `normalizar_fecha_hora_ar`.

---

## Archivos del commit 408e89f que NO tocar (fix etiquetas)

| Archivo | Qué cambió (etiquetas) |
|---------|------------------------|
| `frontend/my-app/src/lib/imprimir-etiqueta-50x25.ts` | CSS/layout del barcode 50×25 mm: tamaños de fuente, flex, alturas, márgenes |
| `frontend/my-app/package-lock.json` | Cambio menor de lockfile (1 línea) |

**No hay cambios de frontend para caja diaria** en ese commit; el fix es 100% backend.

---

## Checklist para reaplicar en f3bed56

```
[ ] backend/src/fechas_ar.py          — 4 funciones nuevas
[ ] backend/src/models.py             — 4 defaults a ahora_ar
[ ] backend/src/services/caja_services.py
[ ] backend/src/services/caja_concentradora_services.py
[ ] backend/src/services/orden_trabajo_services.py
[ ] backend/src/migrations.py         — ensure_caja_movimientos_fecha_hora_ar
[ ] backend/main.py                   — import + llamada ensure
[ ] backend/tests/test_fechas_ar.py   — archivo nuevo
[ ] NO tocar imprimir-etiqueta-50x25.ts
[ ] NO tocar package-lock.json (salvo que sea necesario por otra razón)
```

## Comando útil para ver solo el diff de caja

```bash
git show 408e89f -- \
  backend/src/fechas_ar.py \
  backend/src/models.py \
  backend/src/services/caja_services.py \
  backend/src/services/caja_concentradora_services.py \
  backend/src/services/orden_trabajo_services.py \
  backend/src/migrations.py \
  backend/main.py \
  backend/tests/test_fechas_ar.py
```

## Prompt sugerido para Cursor (después de volver a f3bed56)

> Aplicá solo el fix de horario caja diaria documentado en `CONTEXT-FIX-CAJA-DIARIA-HORARIO.md` (equivalente al commit 408e89f). No modifiques nada de etiquetas (`imprimir-etiqueta-50x25.ts` ni package-lock).
