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
                    "data": {
                        "id": nuevo_cliente.id,
                        "nombre": nuevo_cliente.nombre,
                        "apellido": nuevo_cliente.apellido,
                        "dni": nuevo_cliente.dni,
                        "direccion": nuevo_cliente.direccion,
                        "celular": nuevo_cliente.celular,
                        "notas": nuevo_cliente.notas
                    }
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
                
                #actualiza los atributos del cliente
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
                
                # Recolectar información sobre las relaciones antes de eliminar
                relaciones = []
                advertencias = []
                
                presupuestos_count = cliente.presupuestos.count()
                if presupuestos_count > 0:
                    relaciones.append(f"{presupuestos_count} presupuesto(s)")
                    advertencias.append(f"Se eliminarán {presupuestos_count} presupuesto(s) asociado(s)")
                    # Eliminar presupuestos y sus relaciones anidadas
                    for presupuesto in cliente.presupuestos:
                        # Eliminar orden de trabajo si existe
                        if presupuesto.orden_trabajo:
                            presupuesto.orden_trabajo.delete()
                        # Eliminar items del presupuesto
                        for item in presupuesto.items:
                            item.delete()
                        presupuesto.delete()
                
                cuentas_count = cliente.cuentas_corrientes.count()
                if cuentas_count > 0:
                    relaciones.append(f"{cuentas_count} movimiento(s) en cuenta corriente")
                    advertencias.append(f"Se eliminarán {cuentas_count} movimiento(s) en cuenta corriente")
                    # Eliminar movimientos de cuenta corriente
                    for cuenta in cliente.cuentas_corrientes:
                        cuenta.delete()
                
                ventas_count = cliente.ventas.count()
                if ventas_count > 0:
                    relaciones.append(f"{ventas_count} venta(s)")
                    advertencias.append(f"Se eliminarán {ventas_count} venta(s) asociada(s)")
                    # Eliminar ventas y sus detalles
                    for venta in cliente.ventas:
                        # Eliminar detalles de venta
                        for detalle in venta.detalles:
                            detalle.delete()
                        venta.delete()
                
                # Ahora eliminar el cliente
                cliente.delete()
                
                mensaje = "Cliente eliminado correctamente"
                if relaciones:
                    mensaje += f". También se eliminaron: {', '.join(relaciones)}"
                
                return {
                    "message": mensaje, 
                    "success": True,
                    "advertencias": advertencias,
                    "relaciones_eliminadas": relaciones
                }
            
            except HTTPException:
                raise
            except Exception as e:
                print(f"Error al eliminar el cliente: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al eliminar el cliente")

    def buscar_cliente_por_id(self, id: int) -> dict:
        with db_session:
            cliente = models.Cliente.get(id=id)
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
    
    def obtener_relaciones_cliente(self, id: int) -> dict:
        with db_session:
            cliente = models.Cliente.get(id=id)
            if not cliente:
                raise HTTPException(status_code=404, detail="Cliente no encontrado")
            
            presupuestos_count = cliente.presupuestos.count()
            cuentas_count = cliente.cuentas_corrientes.count()
            ventas_count = cliente.ventas.count()
            
            return {
                "cliente_id": id,
                "nombre": cliente.nombre,
                "apellido": cliente.apellido,
                "relaciones": {
                    "presupuestos": presupuestos_count,
                    "cuentas_corrientes": cuentas_count,
                    "ventas": ventas_count,
                    "total_relaciones": presupuestos_count + cuentas_count + ventas_count
                },
                "tiene_relaciones": (presupuestos_count + cuentas_count + ventas_count) > 0
            }