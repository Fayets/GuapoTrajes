from pony.orm import db_session
from fastapi import HTTPException
from typing import Optional
from pony.orm.core import TransactionIntegrityError, flush
import logging
from src import models, schemas
from src.services.cliente_services import _cliente_a_dict
from src.presupuesto_titular import normalizar_celular, normalizar_nombre_persona

logger = logging.getLogger(__name__)


def _es_misma_persona(nombre_a, apellido_a, celular_a, nombre_b, apellido_b, celular_b) -> bool:
    return (
        normalizar_nombre_persona(nombre_a) == normalizar_nombre_persona(nombre_b)
        and normalizar_nombre_persona(apellido_a) == normalizar_nombre_persona(apellido_b)
        and normalizar_celular(celular_a)
        and normalizar_celular(celular_a) == normalizar_celular(celular_b)
    )


def _precliente_tripleta_duplicada(nombre, apellido, celular, excluir_id=None):
    for p in models.Precliente.select():
        if excluir_id is not None and p.id == excluir_id:
            continue
        if _es_misma_persona(nombre, apellido, celular, p.nombre, p.apellido, p.celular):
            return p
    return None


def _cliente_tripleta_duplicada(nombre, apellido, celular):
    for c in models.Cliente.select():
        if _es_misma_persona(nombre, apellido, celular, c.nombre, c.apellido, c.celular):
            return c
    return None


def _buscar_cliente_para_precliente(precliente, dni: Optional[str] = None):
    dni_n = (str(dni).strip() if dni is not None else "") or ""
    clientes = list(models.Cliente.select())
    if dni_n:
        for c in clientes:
            if str(c.dni or "").strip() == dni_n:
                return c, "dni"
    cel = normalizar_celular(precliente.celular)
    nom = normalizar_nombre_persona(precliente.nombre)
    ape = normalizar_nombre_persona(precliente.apellido)
    if cel:
        triples = []
        for c in clientes:
            if normalizar_celular(c.celular) != cel:
                continue
            if (
                normalizar_nombre_persona(c.nombre) == nom
                and normalizar_nombre_persona(c.apellido) == ape
            ):
                triples.append(c)
        if triples:
            return max(triples, key=lambda c: c.id), "triple"
        for c in clientes:
            if normalizar_celular(c.celular) == cel:
                return c, "solo_celular"
    return None, None


def _payload_cliente_existente(cliente, confianza: str) -> dict:
    return {
        "code": "CLIENTE_EXISTENTE",
        "confianza": confianza,
        "mensaje": (
            f"Esta persona ya está registrada como cliente: "
            f"{cliente.apellido} {cliente.nombre}"
            + (f" (DNI {cliente.dni})" if cliente.dni else "")
            + "."
        ),
        "cliente": _cliente_a_dict(cliente),
    }


class PreclientServices:
    def __init__(self):
        pass

    def crear_cliente(self, cliente: schemas.PreclientCreate) -> dict:
        with db_session:
            try:
                dup_pc = _precliente_tripleta_duplicada(
                    cliente.nombre, cliente.apellido, cliente.celular
                )
                if dup_pc:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Ya existe un precliente con el mismo nombre, apellido y celular. "
                            "Seleccioná el existente."
                        ),
                    )
                dup_cli = _cliente_tripleta_duplicada(
                    cliente.nombre, cliente.apellido, cliente.celular
                )
                if dup_cli:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Esta persona ya está cargada como cliente "
                            f"({dup_cli.apellido} {dup_cli.nombre}). "
                            "Seleccioná el cliente, no armes otro precliente."
                        ),
                    )
                nuevo_cliente = models.Precliente(
                    nombre=cliente.nombre,
                    apellido=cliente.apellido,
                    celular=cliente.celular
                )
                flush()
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
            except HTTPException:
                raise
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
                dup_pc = _precliente_tripleta_duplicada(
                    cliente.nombre, cliente.apellido, cliente.celular, excluir_id=id
                )
                if dup_pc:
                    raise HTTPException(
                        status_code=400,
                        detail="Ya existe un precliente con el mismo nombre, apellido y celular.",
                    )
                return {"message": "Cliente actualizado correctamente",
                        "success" : True, 
                        "data": {
                            "id": cliente.id,
                            "nombre": cliente.nombre,
                            "apellido": cliente.apellido,
                            "celular": cliente.celular,
                        }
                }
            
            except HTTPException:
                raise
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
            

    def detectar_cliente_existente(self, precliente_id: int, dni: Optional[str] = None) -> dict:
        with db_session:
            precliente = models.Precliente.get(id=precliente_id)
            if not precliente:
                raise HTTPException(status_code=404, detail="Precliente no encontrado")
            cliente, confianza = _buscar_cliente_para_precliente(precliente, dni)
            if not cliente:
                return {
                    "encontrado": False,
                    "confianza": None,
                    "cliente": None,
                    "mensaje": None,
                }
            payload = _payload_cliente_existente(cliente, confianza or "triple")
            return {
                "encontrado": True,
                "confianza": payload["confianza"],
                "cliente": payload["cliente"],
                "mensaje": payload["mensaje"],
            }

    def convertir_a_cliente(
        self,
        precliente_id: int,
        direccion: str,
        dni: str,
        fecha_nacimiento=None,
        usar_cliente_id: Optional[int] = None,
        confirmar_existente: bool = False,
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

                cliente_existente = None
                confianza = None
                if usar_cliente_id is not None:
                    cliente_existente = models.Cliente.get(id=usar_cliente_id)
                    if not cliente_existente:
                        raise HTTPException(status_code=404, detail="Cliente existente no encontrado")
                    confianza = "confirmado"
                else:
                    cliente_existente, confianza = _buscar_cliente_para_precliente(precliente, dni)

                if cliente_existente and not usar_cliente_id and not confirmar_existente:
                    raise HTTPException(
                        status_code=409,
                        detail=_payload_cliente_existente(cliente_existente, confianza or "triple"),
                    )

                if cliente_existente:
                    if dni and not str(cliente_existente.dni or "").strip():
                        cliente_existente.dni = dni
                    if direccion and not str(cliente_existente.direccion or "").strip():
                        cliente_existente.direccion = direccion
                    if fecha_nacimiento and not cliente_existente.fecha_nacimiento:
                        cliente_existente.fecha_nacimiento = fecha_nacimiento
                    cliente = cliente_existente
                else:
                    clientes_todos = list(models.Cliente.select())
                    if any(str(c.dni or "").strip() == dni for c in clientes_todos):
                        raise HTTPException(status_code=400, detail="Ya existe un cliente con ese DNI")
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
