
from fastapi import APIRouter, HTTPException
from src.services.presupuestos_services import crear_presupuesto, listar_presupuestos, editar_presupuesto
from src.schemas import PresupuestoCreate
from pony.orm import db_session
from src.models import Presupuesto



router = APIRouter(prefix="/presupuestos", tags=["Presupuestos"])

@router.post("/")
def crear(data: PresupuestoCreate):
    try:
        id_presupuesto = crear_presupuesto(data)
        return {"success": True, "id": id_presupuesto}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/")
def obtener_todos():
    return listar_presupuestos()



@router.put("/{presupuesto_id}")
def actualizar_presupuesto(presupuesto_id: int, data: PresupuestoCreate):
    try:
        id_editado = editar_presupuesto(presupuesto_id, data)
        return {"success": True, "id": id_editado}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/eliminar/{id}")
def eliminar_presupuesto(id: int):
    with db_session:
        presupuesto = Presupuesto.get(id=id)
        if not presupuesto:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

        if presupuesto.orden_trabajo:
            raise HTTPException(status_code=400, detail="No se puede eliminar: ya tiene orden de trabajo generada.")

        presupuesto.delete()
        return {"ok": True}