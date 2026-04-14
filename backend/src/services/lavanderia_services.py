from pony.orm import db_session, flush
from fastapi import HTTPException
from pony.orm.core import TransactionIntegrityError
from src import models, schemas
from src.services.productos_services import _producto_to_response_dict

# from src.schemas import RegresoProductoLavanderiaResponse
from datetime import date
from typing import List, Optional

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
    ) -> dict:
        with db_session:
            lavanderia = models.Lavanderia.get(id=lavanderia_id)
            producto = models.Producto.get(id=producto_id)

            if not lavanderia:
                raise HTTPException(status_code=404, detail="Lavandería no encontrada")
            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            hoy = date.today()
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
            models.ProductoLavanderia(**pl_kwargs)

            producto.estado = models.EstadoProducto.LAVANDERIA
            producto.inmovilizado = False
            flush()

            return {
                "message": "Producto asignado a lavandería exitosamente",
                "success": True,
                "data": _producto_to_response_dict(producto),
            }
        


    def regresar_producto_de_lavanderia(self, producto_id: int):
        with db_session:
            # Verificamos si el producto existe
            producto = models.Producto.get(id=producto_id)

            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            # Verificamos si el producto está en lavandería
            producto_lavanderia = models.ProductoLavanderia.get(
                producto=producto,
                fecha_salida=None
            )

            if not producto_lavanderia:
                raise HTTPException(status_code=400, detail="El producto no está en lavandería o ya fue regresado")

            # Actualizamos la fecha de salida
            producto_lavanderia.fecha_salida = date.today()

            # Cambiamos el estado del producto a SALON (o el estado que corresponda)
            producto.estado = models.EstadoProducto.SALON
            # Cambiamos inmovilizado a False
            producto.inmovilizado = False

            # Devuelve el formato esperado por el esquema
            return schemas.RegresoProductoLavanderiaResponse(
                fecha_ingreso=producto_lavanderia.fecha_ingreso,
                fecha_salida=producto_lavanderia.fecha_salida,
                estado=producto.estado
            )

    def _producto_en_lavanderia_dict(self, pl) -> dict:
        producto = pl.producto
        lav = pl.lavanderia
        est = producto.estado
        est_val = est.value if hasattr(est, "value") else str(est)
        return {
            "id": producto.id,
            "codigo_barra": producto.codigo_barra or "",
            "descripcion": producto.descripcion or "",
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
        }

    def get_productos_lavanderia(self, lavanderia_id: Optional[int] = None):
        """Productos con ingreso activo a lavandería (fecha_salida nula). Opcional: filtrar por lavandería."""
        with db_session:
            if lavanderia_id is not None:
                lav = models.Lavanderia.get(id=lavanderia_id)
                if not lav:
                    raise HTTPException(status_code=404, detail="Lavandería no encontrada")

            candidatos = list(
                models.ProductoLavanderia.select(lambda pl: pl.fecha_salida is None)
            )
            if lavanderia_id is not None:
                candidatos = [pl for pl in candidatos if pl.lavanderia.id == lavanderia_id]

            resultado = []
            for pl in candidatos:
                producto = pl.producto
                if producto.estado != models.EstadoProducto.LAVANDERIA:
                    continue
                resultado.append(self._producto_en_lavanderia_dict(pl))

            return resultado

    def regresar_varios_de_lavanderia(self, productos_ids: List[int]) -> dict:
        """Marca salida de lavandería y estado SALON para cada producto válido."""
        regresados: List[int] = []
        errores: List[dict] = []
        hoy = date.today()
        with db_session:
            for pid in productos_ids:
                try:
                    producto = models.Producto.get(id=pid)
                    if not producto:
                        errores.append({"producto_id": pid, "detail": "Producto no encontrado"})
                        continue
                    pl = models.ProductoLavanderia.get(producto=producto, fecha_salida=None)
                    if not pl:
                        errores.append(
                            {
                                "producto_id": pid,
                                "detail": "No está en lavandería o ya fue regresado",
                            }
                        )
                        continue
                    pl.fecha_salida = hoy
                    producto.estado = models.EstadoProducto.SALON
                    producto.inmovilizado = False
                    regresados.append(pid)
                except Exception as e:
                    errores.append({"producto_id": pid, "detail": str(e)})
            flush()

        return {
            "message": f"Regresaron {len(regresados)} producto(s) al salón."
            + (f" {len(errores)} con aviso." if errores else ""),
            "success": True,
            "data": {"regresados": regresados, "errores": errores},
        }
