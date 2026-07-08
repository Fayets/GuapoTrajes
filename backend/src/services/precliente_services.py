from pony.orm import db_session
from fastapi import HTTPException
from typing import Optional
from pony.orm.core import TransactionIntegrityError, flush
import logging
from src import models, schemas
from src.services.cliente_services import _cliente_a_dict

logger = logging.getLogger(__name__)

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
                    "data": {
                        "id": nuevo_cliente.id,
                        "nombre": nuevo_cliente.nombre,
                        "apellido": nuevo_cliente.apellido,
                        "celular": nuevo_cliente.celular
                    }
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
                precliente = models.Precliente.get(id=id)
                if not precliente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")

                presupuestos = list(precliente.presupuestos)
                if presupuestos:
                    numeros = ", ".join(
                        p.numero for p in presupuestos[:5]
                    )
                    extra = f" (+{len(presupuestos) - 5} más)" if len(presupuestos) > 5 else ""
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"No se puede eliminar: tiene {len(presupuestos)} presupuesto(s) "
                            f"asociado(s) ({numeros}{extra}). "
                            "Convertí el precliente a cliente o vinculalo al cliente existente "
                            "antes de borrarlo."
                        ),
                    )

                precliente.delete()
                return {"message": "Cliente eliminado correctamente"}
            
            except HTTPException:
                raise
            except Exception as e:
                print(f"Error al eliminar el cliente: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al eliminar el cliente")
            

    def convertir_a_cliente(
        self,
        precliente_id: int,
        direccion: str,
        dni: str,
        fecha_nacimiento=None,
    ) -> dict:
        with db_session:
            try:
                dni = (str(dni).strip() if dni is not None else "") or ""
                direccion = (str(direccion).strip() if direccion is not None else "") or ""
                if not dni:
                    raise HTTPException(status_code=400, detail="El DNI es obligatorio")
                if not direccion:
                    raise HTTPException(status_code=400, detail="La dirección es obligatoria")

                precliente = models.Precliente.get(id=precliente_id)
                if not precliente:
                    raise HTTPException(status_code=404, detail="Precliente no encontrado")

                clientes_todos = list(models.Cliente.select())
                cliente_existente = None
                if dni:
                    for c in clientes_todos:
                        if str(c.dni or "").strip() == dni:
                            cliente_existente = c
                            break
                if cliente_existente is None:
                    celular_precliente = str(precliente.celular or "").strip()
                    if celular_precliente:
                        for c in clientes_todos:
                            if str(c.celular or "").strip() == celular_precliente:
                                cliente_existente = c
                                break

                if cliente_existente:
                    if dni and str(cliente_existente.dni or "").strip() and str(cliente_existente.dni or "").strip() != dni:
                        raise HTTPException(
                            status_code=400,
                            detail="Ya existe un cliente con ese celular pero con otro DNI. Revisá los datos.",
                        )
                    if dni and not str(cliente_existente.dni or "").strip():
                        cliente_existente.dni = dni
                    if direccion and not str(cliente_existente.direccion or "").strip():
                        cliente_existente.direccion = direccion
                    if fecha_nacimiento and not cliente_existente.fecha_nacimiento:
                        cliente_existente.fecha_nacimiento = fecha_nacimiento
                    cliente = cliente_existente
                else:
                    if any(str(c.dni or "").strip() == dni for c in clientes_todos):
                        raise HTTPException(status_code=400, detail="Ya existe un cliente con ese DNI")
                    celular_precliente = str(precliente.celular or "").strip()
                    if celular_precliente and any(
                        str(c.celular or "").strip() == celular_precliente for c in clientes_todos
                    ):
                        raise HTTPException(status_code=400, detail="Ya existe un cliente con ese celular")

                    cliente = models.Cliente(
                        nombre=precliente.nombre,
                        apellido=precliente.apellido,
                        celular=precliente.celular,
                        direccion=direccion,
                        dni=dni,
                        notas="",
                        fecha_nacimiento=fecha_nacimiento,
                    )
                flush()

                for presupuesto in list(precliente.presupuestos):
                    presupuesto.cliente = cliente
                    presupuesto.precliente = None
                flush()

                precliente.delete()

                return {
                    "message": "Precliente convertido exitosamente",
                    "success": True,
                    "data": _cliente_a_dict(cliente),
                }
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("Error al convertir precliente a cliente")
                raise HTTPException(
                    status_code=500,
                    detail=f"Error inesperado al convertir precliente: {str(e)}"
                )
