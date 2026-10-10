"""Resumen del día para el dashboard, sin armar las grillas de cada módulo."""

from datetime import date
from typing import Optional

from pony.orm import db_session

from src.db import db
from src.models import Usuario
from src.services.caja_services import CajaServices
from src.services.productos_services import ProductoServices
from src.services.reportes_services import ReportesServices

class DashboardServices:
    def __init__(self):
        self._caja = CajaServices()
        self._productos = ProductoServices()
        self._reportes = ReportesServices()

    @db_session
    def kpis(
        self,
        fecha: date,
        user_id: int,
        sucursal_caja_id: Optional[int] = None,
    ) -> dict:
        ventas_total = None
        ventas_cantidad = None
        user = Usuario.get(id=user_id)
        if user and user.sucursal:
            try:
                ingresos = self._reportes.obtener_ingresos_por_tipo(
                    fecha_desde=fecha,
                    fecha_hasta=fecha,
                    sucursal_id=user.sucursal.id,
                    categoria="VENTAS",
                )
                total = ingresos.get("total_general")
                cantidad = ingresos.get("cantidad_total")
                ventas_total = float(total) if isinstance(total, (int, float)) else None
                ventas_cantidad = int(cantidad) if isinstance(cantidad, int) else None
            except Exception as exc:
                print(f"❌ Error al armar ventas del dashboard: {exc}")

        saldo_efectivo = None
        if sucursal_caja_id is not None:
            try:
                saldo_efectivo = self._caja.get_saldo_efectivo_dia(fecha, sucursal_caja_id)
            except Exception as exc:
                print(f"❌ Error al armar efectivo del dashboard: {exc}")

        prendas_salon = None
        try:
            stats = self._productos.get_status_stats(user_id=user_id)
            salon = stats.get("SALON")
            prendas_salon = int(salon) if isinstance(salon, int) else None
        except Exception as exc:
            print(f"❌ Error al armar stock del dashboard: {exc}")

        return {
            "ventas_total": ventas_total,
            "ventas_cantidad": ventas_cantidad,
            "saldo_efectivo": saldo_efectivo,
            "ordenes_activas": self._ordenes_activas(),
            "prendas_salon": prendas_salon,
        }

    def _ordenes_activas(self) -> int:
        """Misma regla que el dashboard: no cuenta completada, cancelada ni entregada."""
        rows = db.execute(
            """
            SELECT COUNT(*) FROM "OrdenesTrabajo"
            WHERE lower(COALESCE(estado, '')) NOT IN ('completada', 'cancelada', 'entregada')
            """
        )
        row = next(iter(rows), None)
        if not row or row[0] is None:
            return 0
        return int(row[0])
