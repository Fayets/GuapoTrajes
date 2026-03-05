from pony.orm import db_session
from fastapi import HTTPException
from pony.orm.core import TransactionIntegrityError
from src import models, schemas
from datetime import date

class ModistaServices:
    def crear_modista(self, nueva_modista: schemas.ModistaCreate) -> dict:
        with db_session:
            try:
                nueva = models.Modista(
                    nombre=nueva_modista.nombre,
                    direccion=nueva_modista.direccion,
                    telefono=nueva_modista.telefono,
                )
                return {"message": "Modista creada exitosamente", "success": True, "data": nueva.to_dict()}
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="La modista ya existe")
    
    def get_todas_modistas(self):
        with db_session:
            modistas = list(models.Modista.select())
            if not modistas:
                raise HTTPException(status_code=404, detail="No hay modistas disponibles")
            return [m.to_dict() for m in modistas]
    
    def actualizar_modista(self, id: int, data: schemas.ModistaCreate) -> dict:
        with db_session:
            modista = models.Modista.get(id=id)
            if not modista:
                raise HTTPException(status_code=404, detail="Modista no encontrada")
            modista.nombre = data.nombre
            modista.direccion = data.direccion
            modista.telefono = data.telefono
            return {"message": "Modista actualizada correctamente", "success": True, "data": modista.to_dict()}
    
    def eliminar_modista(self, id: int) -> dict:
        with db_session:
            modista = models.Modista.get(id=id)
            if not modista:
                raise HTTPException(status_code=404, detail="Modista no encontrada")
            modista.delete()
            return {"message": "Modista eliminada correctamente"}
        
    def asignar_producto(self, modista_id: int, producto_id: int) -> dict:
        with db_session:
            modista = models.Modista.get(id=modista_id)
            producto = models.Producto.get(id=producto_id)

            if not modista:
                raise HTTPException(status_code=404, detail="Modista no encontrada")
            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            # Asignar producto a modista
            models.ProductoModista(
                producto=producto,
                modista=modista
            )

            producto.estado = models.EstadoProducto.MODISTA
            producto.inmovilizado = False

            return {
                "message": "Producto asignado a modista exitosamente",
                "success": True,
                "data": producto.to_dict()
            }

    def regresar_producto_de_modista(self, producto_id: int):
        with db_session:
            producto = models.Producto.get(id=producto_id)

            if not producto:
                raise HTTPException(status_code=404, detail="Producto no encontrado")

            producto_modista = models.ProductoModista.get(
                producto=producto,
                fecha_salida=None
            )

            if not producto_modista:
                raise HTTPException(status_code=400, detail="El producto no está en modista o ya fue regresado")

            producto_modista.fecha_salida = date.today()
            producto.estado = models.EstadoProducto.SALON
            producto.inmovilizado = False

            return schemas.RegresoProductoModistaResponse(
                fecha_ingreso=producto_modista.fecha_ingreso,
                fecha_salida=producto_modista.fecha_salida,
                estado=producto.estado
            )
    def get_productos_modista(self):
        with db_session:
            productos_modista = models.ProductoModista.select(lambda pm: pm.fecha_salida is None)

            resultado = []
            for pm in productos_modista:
                producto = pm.producto
                if producto.estado != models.EstadoProducto.MODISTA:
                    continue

                producto_dict = producto.to_dict()
                producto_dict["modista"] = pm.modista.to_dict()
                producto_dict["fecha_ingreso"] = pm.fecha_ingreso

                resultado.append(producto_dict)

            return resultado


