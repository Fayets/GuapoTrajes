"""
Limpia datos transaccionales y conserva maestros operativos.

Uso:
  - Vista previa (no borra): python scripts/limpiar_datos_transaccionales.py
  - Ejecutar borrado:        python scripts/limpiar_datos_transaccionales.py --apply --confirm LIMPIAR_DATOS
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import List, Tuple, Type

from pony.orm import db_session, flush


# Permite ejecutar el script desde backend/
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from src.db import db  # noqa: E402
from src.models import (  # noqa: E402
    CajaChica,
    CajaConcentradora,
    CajaMovimiento,
    CierreCaja,
    CuentaCorriente,
    DetalleVenta,
    EstadoProducto,
    ItemPresupuesto,
    OrdenTrabajo,
    Presupuesto,
    Producto,
    ProductoLavanderia,
    ProductoModista,
    ProductoReservado,
    ReciboOrden,
    Venta,
)


TRANSACCIONALES: List[Tuple[str, Type]] = [
    ("ReciboOrden", ReciboOrden),
    ("ProductoReservado", ProductoReservado),
    ("ProductoLavanderia", ProductoLavanderia),
    ("ProductoModista", ProductoModista),
    ("DetalleVenta", DetalleVenta),
    ("Venta", Venta),
    ("ItemPresupuesto", ItemPresupuesto),
    ("OrdenTrabajo", OrdenTrabajo),
    ("Presupuesto", Presupuesto),
    ("CuentaCorriente", CuentaCorriente),
    ("CajaMovimiento", CajaMovimiento),
    ("CajaChica", CajaChica),
    ("CajaConcentradora", CajaConcentradora),
    ("CierreCaja", CierreCaja),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Borra datos transaccionales y deja solo maestros operativos."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Ejecuta borrado real. Sin este flag solo muestra vista previa.",
    )
    parser.add_argument(
        "--confirm",
        type=str,
        default="",
        help="Texto de confirmación requerido para borrado real: LIMPIAR_DATOS",
    )
    return parser.parse_args()


@db_session
def obtener_conteos() -> List[Tuple[str, int]]:
    return [(nombre, entidad.select().count()) for nombre, entidad in TRANSACCIONALES]


@db_session
def ejecutar_limpieza() -> None:
    for nombre, entidad in TRANSACCIONALES:
        total = entidad.select().count()
        if total == 0:
            print(f"[OK] {nombre}: 0 registros (sin cambios)")
            continue
        for obj in entidad.select():
            obj.delete()
        flush()
        print(f"[OK] {nombre}: {total} registros eliminados")

    # Dejar productos en estado operativo
    ajustados = 0
    for p in Producto.select():
        cambio = False
        if p.estado != EstadoProducto.SALON:
            p.estado = EstadoProducto.SALON
            cambio = True
        if p.inmovilizado:
            p.inmovilizado = False
            cambio = True
        if p.veces_alquilado != 0:
            p.veces_alquilado = 0
            cambio = True
        if cambio:
            ajustados += 1
    flush()
    print(f"[OK] Productos normalizados: {ajustados}")


def main() -> None:
    args = parse_args()

    # Solo genera mapping, no crea tablas nuevas
    db.generate_mapping(create_tables=False)

    conteos = obtener_conteos()
    print("=== Vista previa de limpieza ===")
    total = 0
    for nombre, cantidad in conteos:
        total += cantidad
        print(f"- {nombre}: {cantidad}")
    print(f"Total registros transaccionales: {total}")

    if not args.apply:
        print("\nNo se realizaron cambios (modo vista previa).")
        print("Para ejecutar: --apply --confirm LIMPIAR_DATOS")
        return

    if args.confirm != "LIMPIAR_DATOS":
        print("Confirmación inválida. Debe usar: --confirm LIMPIAR_DATOS")
        return

    print("\nEjecutando limpieza...")
    ejecutar_limpieza()
    print("Limpieza finalizada.")


if __name__ == "__main__":
    main()
