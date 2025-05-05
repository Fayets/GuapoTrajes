from pony.orm import db_session
from fastapi import HTTPException
from typing import Optional
from pony.orm.core import TransactionIntegrityError, flush
from src import models, schemas

class ClientServices:
    def __init__(self):
        pass

    def crear_cliente(self, cliente: schemas.ClientCreate) -> dict:
        with db_session:
            try:
                nuevo_cliente = models.Cliente(
                    nombre=cliente.nombre,
                    apellido=cliente.apellido,
                    dni=cliente.dni,
                    direccion=cliente.direccion,
                    celular=cliente.celular,
                    notas=cliente.notas
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
                clientes = list(models.Cliente.select())

                clientes_list = []
                for cliente in clientes:
                    clientes_dict = {
                        "id": cliente.id,
                        "nombre": cliente.nombre,
                        "apellido": cliente.apellido,
                        "dni":cliente.dni,
                        "direccion": cliente.direccion,
                        "celular": cliente.celular,
                        "notas":cliente.notas
                    }
                    clientes_list.append(clientes_dict)
                
                if not clientes_list:
                    raise HTTPException(status_code=404, detail="No hay clientes disponibles")
                return clientes_list
            except Exception as e:
                raise HTTPException(status_code=500, detail="Error al obtener los clientes")
            
    def buscar_sucursal_por_dni(self, cliente_dni: int) -> dict:
        with db_session:
            cliente = models.Cliente.get(id=cliente_dni)
            if not cliente:
                raise HTTPException(status_code=404, detail="Cliente no encontrado")
            return {
                "id": cliente.id,
                "nombre": cliente.nombre,
                "apellido": cliente.apellido,
                "dni":cliente.dni,
                "direccion": cliente.direccion,
                "celular": cliente.celular,
                "notas":cliente.notas
            }
        
    def actualizar_cliente(self, id: int, cliente_actualizar: schemas.ClientCreate) -> dict:
        with db_session:
            try:
                cliente = models.Cliente.get(id=id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")
                
                #actualiza los atributos de la sucursal
                cliente.nombre = cliente_actualizar.nombre
                cliente.apellido = cliente_actualizar.apellido
                cliente.dni = cliente_actualizar.dni
                cliente.direccion = cliente_actualizar.direccion
                cliente.celular = cliente_actualizar.celular
                cliente.notas = cliente_actualizar.notas
                return {"message": "Cliente actualizado correctamente",
                        "success" : True, 
                        "data": {
                            "id": cliente.id,
                            "nombre": cliente.nombre,
                            "apellido": cliente.apellido,
                            "dni":cliente.dni,
                            "direccion": cliente.direccion,
                            "celular": cliente.celular,
                            "notas":cliente.notas
                        }
                }
            
            except Exception as e:
                print(f"Error al actualizar el cliente: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al actualizar el cliente")

    
    def eliminar_cliente(self, id: int) -> dict:
        with db_session:
            try:
                cliente = models.Cliente.get(id=id)
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")
                cliente.delete()
                return {"message": "Cliente eliminado correctamente"}
            
            except Exception as e:
                print(f"Error al eliminar el cliente: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al eliminar el cliente")
