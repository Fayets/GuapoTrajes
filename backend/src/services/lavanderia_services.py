from pony.orm import db_session, flush
from fastapi import HTTPException
from pony.orm.core import TransactionIntegrityError
from src import models, schemas
from src.descripcion_producto import format_descripcion_producto
from src.services.productos_services import _producto_to_response_dict

# from src.schemas import RegresoProductoLavanderiaResponse
from typing import List, Optional

from src.fechas_ar import hoy_ar
from src.revision_devolucion import (
    MENSAJE_CUIDADO_ESPECIAL,
    cuidado_especial_desde_ingresos,
    notas_indican_revision,
)

class LavanderiaServices:
    def crear_lavanderia(self, nueva_lavanderia: schemas.LavanderiaCreate) -> dict:
        with db_session:
            try:
                nueva_lavanderia = models.Lavanderia(
                    nombre=nueva_lavanderia.nombre,
                    direccion=nueva_lavanderia.direccion,
                    telefono=nueva_lavanderia.telefono,
                )
                return {"message": "Lavandería creada exitosamente", "success": True, "data": nueva_lavanderia.to_dict()}
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="La lavandería ya existe")
    
    def get_todas_lavanderias(self):
        with db_session:
            lavanderias = list(models.Lavanderia.select())
            if not lavanderias:
                return []
            return [l.to_dict() for l in lavanderias]
    
    def actualizar_lavanderia(self, id: int, data: schemas.LavanderiaCreate) -> dict:
        with db_session:
            update_lavanderia = models.Lavanderia.get(id=id)
            if not update_lavanderia:
                raise HTTPException(status_code=404, detail="Lavandería no encontrada")
            update_lavanderia.nombre = data.nombre
            update_lavanderia.direccion = data.direccion
            update_lavanderia.telefono = data.telefono
            return {"message": "Lavandería actualizada correctamente", "success": True, "data": update_lavanderia.to_dict()}
    
    def eliminar_lavanderia(self, id: int) -> dict:
        with db_session:
            lavanderia = models.Lavanderia.get(id=id)
            if not lavanderia:
                raise HTTPException(status_code=404, detail="Lavandería no encontrada")
            lavanderia.delete()
            return {"message": "Lavandería eliminada correctamente"}
        
    def asignar_producto(
        self,
        lavanderia_id: int,
        producto_id: int,
        notas: Optional[str] = None,
        cliente_nombre: Optional[str] = None,
        cliente_celular: Optional[str] = None,
        usuario_id: Optional[int] = None,
    ) -> dict:
        with db_session:
            lavanderia = models.Lavanderia.get(id=lavanderia_id)
            producto = models.Producto.get(id=producto_id)

            if not lavanderia:
                raise HTTPException(status_code=404, detail="Lavandería no encontrada")
            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            hoy = hoy_ar()
            # No usar select(lambda … producto == entidad): Pony no traduce bien la captura;
            # recorremos las relaciones cargadas en la misma sesión.
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

            # Pony: no pasar None a Optional(str) en el constructor (falla la validación).
            pl_kwargs = {
                "producto": producto,
                "lavanderia": lavanderia,
                "fecha_ingreso": hoy,
            }
            if notas_val is not None:
                pl_kwargs["notas"] = notas_val
            if cli_n is not None:
                pl_kwargs["cliente_nombre"] = cli_n
            if cli_c is not None:
                pl_kwargs["cliente_celular"] = cli_c
            if usuario is not None:
                pl_kwargs["enviado_por"] = usuario
            models.ProductoLavanderia(**pl_kwargs)

            producto.estado = models.EstadoProducto.LAVANDERIA
            producto.inmovilizado = False
            flush()

            from src.services.auditoria_services import registrar_auditoria
            from src.models import AccionAuditoria
            registrar_auditoria(
                usuario,
                AccionAuditoria.LAVANDERIA_ENVIO,
                "producto",
                producto.id,
                f"Producto {producto.codigo_barra} enviado a lavandería",
                {"lavanderia_id": lavanderia.id},
            )

            return {
                "message": "Producto asignado a lavandería exitosamente",
                "success": True,
                "data": _producto_to_response_dict(producto),
            }
        


    def _producto_en_lavanderia_dict(self, pl) -> dict:
        producto = pl.producto
        lav = pl.lavanderia
        est = producto.estado
        est_val = est.value if hasattr(est, "value") else str(est)
        return {
            "id": producto.id,
            "ingreso_id": pl.id,
            "codigo_barra": producto.codigo_barra or "",
            "descripcion": format_descripcion_producto(
                producto.descripcion, producto.descripcion_extra
            ),
            "precio_alquiler_efectivo": float(producto.precio_alquiler_efectivo or 0),
            "estado": est_val,
            "lavanderia": {
                "id": lav.id,
                "nombre": lav.nombre or "",
                "telefono": lav.telefono or "",
                "direccion": lav.direccion or "",
            },
            "fecha_ingreso": pl.fecha_ingreso.isoformat() if pl.fecha_ingreso else None,
            "notas": (pl.notas or "") or "",
            "cliente_nombre": (pl.cliente_nombre or "") or "",
            "cliente_celular": (pl.cliente_celular or "") or "",
            "enviado_por_id": pl.enviado_por.id if getattr(pl, "enviado_por", None) else None,
            "enviado_por_nombre": (
                f"{pl.enviado_por.nombre} {pl.enviado_por.apellido}".strip()
                if getattr(pl, "enviado_por", None)
                else None
            ),
            "recibido_por_id": pl.recibido_por.id if getattr(pl, "recibido_por", None) else None,
            "recibido_por_nombre": (
                f"{pl.recibido_por.nombre} {pl.recibido_por.apellido}".strip()
                if getattr(pl, "recibido_por", None)
                else None
            ),
            "requiere_cuidado_especial": notas_indican_revision(pl.notas)
            or cuidado_especial_desde_ingresos(pl.producto, [pl])[0],
        }

    @staticmethod
    def _ingresos_abiertos_producto(producto) -> list:
        """Todos los ProductoLavanderia abiertos del producto (sin .get(), que falla si hay duplicados)."""
        return [pl for pl in list(producto.productos_lavanderias) if pl.fecha_salida is None]

    def get_productos_lavanderia(self, lavanderia_id: Optional[int] = None):
        """Productos con ingreso activo a lavandería (fecha_salida nula). Opcional: filtrar por lavandería."""
        with db_session:
            if lavanderia_id is not None:
                lav = models.Lavanderia.get(id=lavanderia_id)
                if not lav:
                    raise HTTPException(status_code=404, detail="Lavandería no encontrada")

            candidatos = [
                pl for pl in list(models.ProductoLavanderia.select()) if pl.fecha_salida is None
            ]
            if lavanderia_id is not None:
                candidatos = [pl for pl in candidatos if pl.lavanderia.id == lavanderia_id]

            # Un producto físico = una fila. Si hay ingresos abiertos duplicados (bug histórico),
            # nos quedamos con el más reciente y al regresar se cierran todos.
            por_producto: dict = {}
            for pl in candidatos:
                producto = pl.producto
                if producto.estado != models.EstadoProducto.LAVANDERIA:
                    continue
                prev = por_producto.get(producto.id)
                if prev is None or (pl.id or 0) > (prev.id or 0):
                    por_producto[producto.id] = pl

            return [self._producto_en_lavanderia_dict(pl) for pl in por_producto.values()]

    def regresar_producto_de_lavanderia(self, producto_id: int, usuario_id: Optional[int] = None):
        with db_session:
            producto = models.Producto.get(id=producto_id)

            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            abiertos = self._ingresos_abiertos_producto(producto)
            if not abiertos:
                raise HTTPException(
                    status_code=400,
                    detail="El producto no está en lavandería o ya fue regresado",
                )

            hoy = hoy_ar()
            usuario = models.Usuario.get(id=usuario_id) if usuario_id else None
            for pl in abiertos:
                pl.fecha_salida = hoy
                if usuario is not None:
                    pl.recibido_por = usuario

            producto.estado = models.EstadoProducto.SALON
            producto.inmovilizado = False

            from src.services.auditoria_services import registrar_auditoria
            from src.models import AccionAuditoria
            registrar_auditoria(
                usuario,
                AccionAuditoria.LAVANDERIA_RECEPCION,
                "producto",
                producto.id,
                f"Recepción desde lavandería — {producto.codigo_barra}",
                None,
            )

            principal = max(abiertos, key=lambda x: x.id or 0)
            cuidado, orden_rev = cuidado_especial_desde_ingresos(producto, abiertos)
            return schemas.RegresoProductoLavanderiaResponse(
                fecha_ingreso=principal.fecha_ingreso,
                fecha_salida=principal.fecha_salida,
                estado=producto.estado,
                requiere_cuidado_especial=cuidado,
                mensaje_revision=MENSAJE_CUIDADO_ESPECIAL if cuidado else None,
                orden_id=orden_rev,
                producto_id=producto.id,
            )

    def regresar_varios_de_lavanderia(
        self, productos_ids: List[int], usuario_id: Optional[int] = None
    ) -> dict:
        """Marca salida de lavandería y estado SALON para cada producto válido.

        Tolera ingresos abiertos duplicados del mismo producto (cierra todos).
        Deduplica IDs en el pedido para no reportar el mismo aviso dos veces.
        """
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
                        errores.append({"producto_id": pid, "detail": "Producto no encontrado"})
                        continue
                    abiertos = self._ingresos_abiertos_producto(producto)
                    if not abiertos:
                        errores.append(
                            {
                                "producto_id": pid,
                                "detail": "No está en lavandería o ya fue regresado",
                            }
                        )
                        continue
                    cuidado, orden_rev = cuidado_especial_desde_ingresos(producto, abiertos)
                    for pl in abiertos:
                        pl.fecha_salida = hoy
                        if usuario is not None:
                            pl.recibido_por = usuario
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
                    AccionAuditoria.LAVANDERIA_RECEPCION,
                    "producto",
                    regresados[0],
                    f"Recepción desde lavandería — {len(regresados)} prenda(s)",
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
