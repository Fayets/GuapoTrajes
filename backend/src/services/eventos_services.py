from pony.orm import db_session, flush
from fastapi import HTTPException
from pony.orm.core import TransactionIntegrityError
from src import models, schemas
#from src.schemas import RegresoProductoLavanderiaResponse
from datetime import date

class EventosServices:
    def crear_evento(self, nuevo_evento: schemas.EventoCreate) -> dict:
        with db_session:
            try:
                nuevo_evento = models.Evento(
                    nombre=nuevo_evento.nombre,
                )
                return {"message": "Evento creado exitosamente", "success": True, "data": nuevo_evento.to_dict()}
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="El evento ya existe")
    
    def get_todos_eventos(self):
        with db_session:
            eventos = list(models.Evento.select())
            if not eventos:
                raise HTTPException(status_code=404, detail="No hay eventos disponibles")
            return [l.to_dict() for l in eventos]
    
    def actualizar_evento(self, id: int, data: schemas.EventoCreate) -> dict:
        with db_session:
            update_evento = models.Evento.get(id=id)
            if not update_evento:
                raise HTTPException(status_code=404, detail="Evento no encontrado")
            update_evento.nombre = data.nombre
            return {"message": "Evento actualizado correctamente", "success": True, "data": update_evento.to_dict()}
    
    def eliminar_evento(self, id: int) -> dict:
        with db_session:
            evento = models.Evento.get(id=id)
            if not evento:
                raise HTTPException(status_code=404, detail="Evento no encontrado")
            evento.delete()
            return {"message": "Evento eliminado correctamente"}
        
