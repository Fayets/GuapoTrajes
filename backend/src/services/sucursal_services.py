from pony.orm import db_session
from fastapi import HTTPException
from typing import Optional
from pony.orm.core import TransactionIntegrityError, flush
from src import models, schemas

class SucursalServices:
    def __init__(self):
        pass

    def crear_sucursal(self, sucursal: schemas.SucursalCreate) -> dict:
        with db_session:
            try:
                sucursal = models.Sucursal(
                    nombre=sucursal.nombre,
                    direccion=sucursal.direccion,
                    provincia=sucursal.provincia
                )
                flush()  # Para que se genere el ID sin hacer commit todavía (si usás Pony ORM)
                return {
                    "message": "Sucursal creada exitosamente",
                    "success": True,
                    "data": sucursal.to_dict()
                }
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="La sucursal ya existe")

        
    def get_todas_sucursales(self):
        with db_session:
            try:
                sucursales = list(models.Sucursal.select())

                sucursales_list = []
                for sucursal in sucursales:
                    sucursales_dict = {
                        "id": sucursal.id,
                        "nombre": sucursal.nombre,
                        "direccion": sucursal.direccion,
                        "provincia": sucursal.provincia
                    }
                    sucursales_list.append(sucursales_dict)
                
                if not sucursales_list:
                    raise HTTPException(status_code=404, detail="No hay sucursales disponibles")
                return sucursales_list
            except Exception as e:
                raise HTTPException(status_code=500, detail="Error al obtener las sucursales")
            
    def buscar_sucursal_por_id(self, sucursal_id: int) -> dict:
        with db_session:
            sucursal = models.Sucursal.get(id=sucursal_id)
            if not sucursal:
                raise HTTPException(status_code=404, detail="Sucursal no encontrada")
            return {
                "id": sucursal.id,
                "nombre": sucursal.nombre,
                "direccion": sucursal.direccion,
                "provincia": sucursal.provincia
            }
    
    def actualizar_sucursal(self, id: int, sucursal_actualizar: schemas.SucursalCreate) -> dict:
        with db_session:
            try:
                sucursal = models.Sucursal.get(id=id)
                if not sucursal:
                    raise HTTPException(status_code=404, detail="Sucursal no encontrada")
                
                #actualiza los atributos de la sucursal
                sucursal.nombre = sucursal_actualizar.nombre
                sucursal.direccion = sucursal_actualizar.direccion
                sucursal.provincia = sucursal_actualizar.provincia
                return {"message": "Sucursal actualizada correctamente",
                        "success" : True, 
                        "data": {
                            "id": sucursal.id,
                            "nombre": sucursal.nombre,
                            "direccion": sucursal.direccion,
                            "provincia": sucursal.provincia
                    }
                }
            
            except Exception as e:
                print(f"Error al actualizar la sucursal: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al actualizar la sucursal")
            
    def eliminar_sucursal(self, id: int) -> dict:
        with db_session:
            try:
                sucursal = models.Sucursal.get(id=id)
                if not sucursal:
                    raise HTTPException(status_code=404, detail="Sucursal no encontrada")
                sucursal.delete()
                return {"message": "Sucursal eliminada correctamente"}
            
            except Exception as e:
                print(f"Error al eliminar la sucursal: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al eliminar la sucursal")