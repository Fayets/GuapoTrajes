from pony.orm import db_session
from fastapi import HTTPException
from typing import Optional
from pony.orm.core import TransactionIntegrityError, flush
from src import models, schemas

class PreclientServices:
    def __init__(self):
        pass

    def crear_cliente(self, cliente: schemas.PreclientCreate) -> dict:
        with db_session:
            try:
                nuevo_cliente = models.Precliente(
                    nombre=cliente.nombre,
                    apellido=cliente.apellido,
                    celular=cliente.celular
                )
                return {
                    "message": "Cliente creado exitosamente",
                    "success": True,
                    "data": nuevo_cliente.to_dict()
                }
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="El cliente ya existe")

            
    def get_todos_clientes(self):
        with db_session:
            try:
                clientes = list(models.Precliente.select())

                clientes_list = []
                for cliente in clientes:
                    clientes_dict = {
                        "id": cliente.id,
                        "nombre": cliente.nombre,
                        "apellido": cliente.apellido,
                        "celular": cliente.celular
                    }
                    clientes_list.append(clientes_dict)
                
                return clientes_list
            except Exception as e:
                raise HTTPException(status_code=500, detail="Error al obtener los clientes")
            
    def buscar_cliente_por_celular(self, cliente_celular: str) -> dict:
        with db_session:
            cliente = models.Precliente.get(id=cliente_celular)
            if not cliente:
                raise HTTPException(status_code=404, detail="Cliente no encontrado")
            return {
                "id": cliente.id,
                "nombre": cliente.nombre,
                "apellido": cliente.apellido,
                "celular": cliente.celular,
            }
        
    def actualizar_cliente(self, id: int, cliente_actualizar: schemas.PreclientCreate) -> dict:
        with db_session:
            try:
                cliente = models.Precliente.get(id=id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")
                
                #actualiza los atributos del cliente
                cliente.nombre = cliente_actualizar.nombre
                cliente.apellido = cliente_actualizar.apellido
                cliente.celular = cliente_actualizar.celular
                return {"message": "Cliente actualizado correctamente",
                        "success" : True, 
                        "data": {
                            "id": cliente.id,
                            "nombre": cliente.nombre,
                            "apellido": cliente.apellido,
                            "celular": cliente.celular,
                        }
                }
            
            except Exception as e:
                print(f"Error al actualizar el cliente: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al actualizar el cliente")

    
    def eliminar_cliente(self, id: int) -> dict:
        with db_session:
            try:
                cliente = models.Precliente.get(id=id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")
                cliente.delete()
                return {"message": "Cliente eliminado correctamente"}
            
            except Exception as e:
                print(f"Error al eliminar el cliente: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al eliminar el cliente")
            

    def convertir_a_cliente(self, precliente_id: int, direccion: str, dni: str) -> dict:
        with db_session:
            precliente = models.Precliente.get(id=precliente_id)
            if not precliente:
                raise HTTPException(status_code=404, detail="Precliente no encontrado")

            # Validar duplicados por DNI o celular
            cliente_existente = models.Cliente.get(lambda c: c.dni == dni or c.celular == precliente.celular)
            if cliente_existente:
                raise HTTPException(status_code=400, detail="Ya existe un cliente con ese DNI o celular")

            # Crear cliente completo
            cliente = models.Cliente(
                nombre=precliente.nombre,
                apellido=precliente.apellido,
                celular=precliente.celular,
                direccion=direccion,
                dni=dni
            )

            # Eliminar el precliente
            precliente.delete()

            return {
                "message": "Precliente convertido exitosamente",
                "success": True,
                "data": cliente.to_dict()
            }
