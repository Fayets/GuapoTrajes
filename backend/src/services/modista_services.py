from pony.orm import db_session, flush
from fastapi import HTTPException
from pony.orm.core import TransactionIntegrityError
from src import models, schemas
from src.descripcion_producto import format_descripcion_producto
from src.services.productos_services import _producto_to_response_dict
from typing import List, Optional

from src.fechas_ar import hoy_ar
from src.revision_devolucion import (
    MENSAJE_CUIDADO_ESPECIAL,
    cuidado_especial_desde_ingresos,
    notas_indican_revision,
)


class ModistaServices:
    def crear_modista(self, nueva_modista: schemas.ModistaCreate) -> dict:
        with db_session:
            try:
                nueva = models.Modista(
                    nombre=nueva_modista.nombre,
                    direccion=nueva_modista.direccion,
                    telefono=nueva_modista.telefono,
                )
                return {
                    "message": "Modista creada exitosamente",
                    "success": True,
                    "data": nueva.to_dict(),
                }
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="La modista ya existe")

    def get_todas_modistas(self):
        with db_session:
            modistas = list(models.Modista.select())
            if not modistas:
                return []
            return [m.to_dict() for m in modistas]

    def actualizar_modista(self, id: int, data: schemas.ModistaCreate) -> dict:
        with db_session:
            modista = models.Modista.get(id=id)
            if not modista:
                raise HTTPException(status_code=404, detail="Modista no encontrada")
            modista.nombre = data.nombre
            modista.direccion = data.direccion
            modista.telefono = data.telefono
            return {
                "message": "Modista actualizada correctamente",
                "success": True,
                "data": modista.to_dict(),
            }

    def eliminar_modista(self, id: int) -> dict:
        with db_session:
            modista = models.Modista.get(id=id)
            if not modista:
                raise HTTPException(status_code=404, detail="Modista no encontrada")
            modista.delete()
            return {"message": "Modista eliminada correctamente"}

    def asignar_producto(
        self,
        modista_id: int,
        producto_id: int,
        notas: Optional[str] = None,
        cliente_nombre: Optional[str] = None,
        cliente_celular: Optional[str] = None,
        usuario_id: Optional[int] = None,
    ) -> dict:
        with db_session:
            modista = models.Modista.get(id=modista_id)
            producto = models.Producto.get(id=producto_id)

            if not modista:
                raise HTTPException(status_code=404, detail="Modista no encontrada")
            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            hoy = hoy_ar()
            for pl in list(producto.productos_lavanderias):
                if pl.fecha_salida is None:
                    pl.fecha_salida = hoy
            for pm in list(producto.productos_modistas):
                if pm.fecha_salida is None:
                    pm.fecha_salida = hoy

            notas_val = (notas or "").strip() or None
            cli_n = (cliente_nombre or "").strip() or None
            cli_c = (cliente_celular or "").strip() or None
            usuario = models.Usuario.get(id=usuario_id) if usuario_id else None

            pm_kwargs = {
                "producto": producto,
                "modista": modista,
                "fecha_ingreso": hoy,
            }
            if notas_val is not None:
                pm_kwargs["notas"] = notas_val
            if cli_n is not None:
                pm_kwargs["cliente_nombre"] = cli_n
            if cli_c is not None:
                pm_kwargs["cliente_celular"] = cli_c
            if usuario is not None:
                pm_kwargs["enviado_por"] = usuario
            models.ProductoModista(**pm_kwargs)

            producto.estado = models.EstadoProducto.MODISTA
            producto.inmovilizado = False
            flush()

            from src.services.auditoria_services import registrar_auditoria
            from src.models import AccionAuditoria
            registrar_auditoria(
                usuario,
                AccionAuditoria.MODISTA_ENVIO,
                "producto",
                producto.id,
                f"Producto {producto.codigo_barra} enviado a modista",
                {"modista_id": modista.id},
            )

            return {
                "message": "Producto asignado a modista exitosamente",
                "success": True,
                "data": _producto_to_response_dict(producto),
            }

    def regresar_producto_de_modista(self, producto_id: int, usuario_id: Optional[int] = None):
        with db_session:
            producto = models.Producto.get(id=producto_id)

            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            abiertos = self._ingresos_abiertos_producto(producto)
            if not abiertos:
                raise HTTPException(
                    status_code=400,
                    detail="El producto no está en modista o ya fue regresado",
                )

            hoy = hoy_ar()
            usuario = models.Usuario.get(id=usuario_id) if usuario_id else None
            for pm in abiertos:
                pm.fecha_salida = hoy
                if usuario is not None:
                    pm.recibido_por = usuario
            producto.estado = models.EstadoProducto.SALON
            producto.inmovilizado = False

            from src.services.auditoria_services import registrar_auditoria
            from src.models import AccionAuditoria
            registrar_auditoria(
                usuario,
                AccionAuditoria.MODISTA_RECEPCION,
                "producto",
                producto.id,
                f"Recepción desde modista — {producto.codigo_barra}",
                None,
            )

            principal = max(abiertos, key=lambda x: x.id or 0)
            est = producto.estado
            est_str = est.value if hasattr(est, "value") else str(est)
            cuidado, orden_rev = cuidado_especial_desde_ingresos(producto, abiertos)
            return schemas.RegresoProductoModistaResponse(
                fecha_ingreso=principal.fecha_ingreso,
                fecha_salida=principal.fecha_salida,
                estado=est_str,
                requiere_cuidado_especial=cuidado,
                mensaje_revision=MENSAJE_CUIDADO_ESPECIAL if cuidado else None,
                orden_id=orden_rev,
                producto_id=producto.id,
            )

    def _producto_en_modista_dict(self, pm) -> dict:
        producto = pm.producto
        mod = pm.modista
        est = producto.estado
        est_val = est.value if hasattr(est, "value") else str(est)
        return {
            "id": producto.id,
            "ingreso_id": pm.id,
            "codigo_barra": producto.codigo_barra or "",
            "descripcion": format_descripcion_producto(
                producto.descripcion, producto.descripcion_extra
            ),
            "precio_alquiler_efectivo": float(producto.precio_alquiler_efectivo or 0),
            "estado": est_val,
            "modista": {
                "id": mod.id,
                "nombre": mod.nombre or "",
                "telefono": mod.telefono or "",
                "direccion": mod.direccion or "",
            },
            "fecha_ingreso": pm.fecha_ingreso.isoformat() if pm.fecha_ingreso else None,
            "notas": (pm.notas or "") or "",
            "cliente_nombre": (pm.cliente_nombre or "") or "",
            "cliente_celular": (pm.cliente_celular or "") or "",
            "enviado_por_id": pm.enviado_por.id if getattr(pm, "enviado_por", None) else None,
            "enviado_por_nombre": (
                f"{pm.enviado_por.nombre} {pm.enviado_por.apellido}".strip()
                if getattr(pm, "enviado_por", None)
                else None
            ),
            "recibido_por_id": pm.recibido_por.id if getattr(pm, "recibido_por", None) else None,
            "recibido_por_nombre": (
                f"{pm.recibido_por.nombre} {pm.recibido_por.apellido}".strip()
                if getattr(pm, "recibido_por", None)
                else None
            ),
            "requiere_cuidado_especial": notas_indican_revision(pm.notas)
            or cuidado_especial_desde_ingresos(pm.producto, [pm])[0],
        }

    @staticmethod
    def _ingresos_abiertos_producto(producto) -> list:
        return [pm for pm in list(producto.productos_modistas) if pm.fecha_salida is None]

    def get_productos_modista(self, modista_id: Optional[int] = None):
        """Productos con ingreso activo a modista. Opcional: filtrar por modista."""
        with db_session:
            if modista_id is not None:
                mod = models.Modista.get(id=modista_id)
                if not mod:
                    raise HTTPException(status_code=404, detail="Modista no encontrada")

            candidatos = [
                pm for pm in list(models.ProductoModista.select()) if pm.fecha_salida is None
            ]
            if modista_id is not None:
                candidatos = [pm for pm in candidatos if pm.modista.id == modista_id]

            por_producto: dict = {}
            for pm in candidatos:
                if pm.producto.estado != models.EstadoProducto.MODISTA:
                    continue
                prev = por_producto.get(pm.producto.id)
                if prev is None or (pm.id or 0) > (prev.id or 0):
                    por_producto[pm.producto.id] = pm

            return [self._producto_en_modista_dict(pm) for pm in por_producto.values()]

    def regresar_varios_de_modista(
        self, productos_ids: List[int], usuario_id: Optional[int] = None
    ) -> dict:
        """Marca salida de modista y estado SALON para cada producto válido."""
        regresados: List[int] = []
        errores: List[dict] = []
        cuidado_especial: List[dict] = []
        hoy = hoy_ar()
        ids_unicos = list(dict.fromkeys(productos_ids))
        with db_session:
            usuario = models.Usuario.get(id=usuario_id) if usuario_id else None
            for pid in ids_unicos:
                try:
                    producto = models.Producto.get(id=pid)
                    if not producto:
                        errores.append(
                            {"producto_id": pid, "detail": "Producto no encontrado"}
                        )
                        continue
                    abiertos = self._ingresos_abiertos_producto(producto)
                    if not abiertos:
                        errores.append(
                            {
                                "producto_id": pid,
                                "detail": "No está en modista o ya fue regresado",
                            }
                        )
                        continue
                    cuidado, orden_rev = cuidado_especial_desde_ingresos(producto, abiertos)
                    for pm in abiertos:
                        pm.fecha_salida = hoy
                        if usuario is not None:
                            pm.recibido_por = usuario
                    producto.estado = models.EstadoProducto.SALON
                    producto.inmovilizado = False
                    regresados.append(pid)
                    if cuidado:
                        cuidado_especial.append(
                            {
                                "producto_id": pid,
                                "orden_id": orden_rev,
                                "mensaje": MENSAJE_CUIDADO_ESPECIAL,
                            }
                        )
                except Exception as e:
                    errores.append({"producto_id": pid, "detail": str(e)})
            flush()
            if regresados:
                from src.services.auditoria_services import registrar_auditoria
                from src.models import AccionAuditoria
                registrar_auditoria(
                    usuario,
                    AccionAuditoria.MODISTA_RECEPCION,
                    "producto",
                    regresados[0],
                    f"Recepción desde modista — {len(regresados)} prenda(s)",
                    {"productos": regresados},
                )

        msg = f"Regresaron {len(regresados)} producto(s) al salón."
        if errores:
            msg += f" {len(errores)} con aviso."
        if cuidado_especial:
            msg += f" {len(cuidado_especial)} con revisión pendiente (cuidado especial)."

        return {
            "message": msg,
            "success": True,
            "data": {
                "regresados": regresados,
                "errores": errores,
                "requiere_cuidado_especial": len(cuidado_especial) > 0,
                "cuidado_especial": cuidado_especial,
                "mensaje_revision": MENSAJE_CUIDADO_ESPECIAL if cuidado_especial else None,
            },
        }
