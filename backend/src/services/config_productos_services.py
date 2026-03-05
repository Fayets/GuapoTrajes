# Servicio para CRUD de catálogos de atributos de producto (líneas, talles, telas, colores)
from pony.orm import db_session, flush
from fastapi import HTTPException
from pony.orm.core import TransactionIntegrityError
from src import models, schemas


def _get_lineas():
    with db_session:
        items = list(models.ProductoLinea.select())
        return [{"id": int(e.id), "nombre": str(e.nombre), "codigo": str(e.codigo)} for e in items]


def _get_talles():
    with db_session:
        items = list(models.ProductoTalle.select())
        return [{"id": int(e.id), "nombre": str(e.nombre), "codigo": str(e.codigo)} for e in items]


def _get_telas():
    with db_session:
        items = list(models.ProductoTela.select())
        return [{"id": int(e.id), "nombre": str(e.nombre), "codigo": str(e.codigo)} for e in items]


def _get_colores():
    with db_session:
        items = list(models.ProductoColor.select())
        return [{"id": int(e.id), "nombre": str(e.nombre), "codigo": str(e.codigo)} for e in items]


class ConfigProductosServices:
    # ----- Líneas -----
    def get_lineas(self):
        return _get_lineas()

    def create_linea(self, data: schemas.ProductoLineaCreate) -> dict:
        with db_session:
            try:
                nombre = data.nombre.strip()
                codigo = data.codigo.strip()
                if not nombre:
                    raise HTTPException(status_code=400, detail="El nombre no puede estar vacío.")
                if not codigo or not codigo.isdigit() or len(codigo) != 3:
                    raise HTTPException(status_code=400, detail="El código de línea debe tener exactamente 3 dígitos numéricos.")
                obj = models.ProductoLinea(nombre=nombre, codigo=codigo)
                flush()
                return {"id": obj.id, "nombre": obj.nombre, "codigo": obj.codigo}
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="Ya existe una línea con ese nombre o código.")

    def delete_linea(self, id: int) -> None:
        with db_session:
            obj = models.ProductoLinea.get(id=id)
            if not obj:
                raise HTTPException(status_code=404, detail="Línea no encontrada.")
            obj.delete()

    # ----- Talles -----
    def get_talles(self):
        return _get_talles()

    def create_talle(self, data: schemas.ProductoTalleCreate) -> dict:
        with db_session:
            try:
                nombre = data.nombre.strip()
                codigo = data.codigo.strip()
                if not nombre:
                    raise HTTPException(status_code=400, detail="El nombre no puede estar vacío.")
                if not codigo or not codigo.isdigit() or len(codigo) != 2:
                    raise HTTPException(status_code=400, detail="El código de talle debe tener exactamente 2 dígitos numéricos.")
                obj = models.ProductoTalle(nombre=nombre, codigo=codigo)
                flush()
                return {"id": obj.id, "nombre": obj.nombre, "codigo": obj.codigo}
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="Ya existe un talle con ese nombre o código.")

    def delete_talle(self, id: int) -> None:
        with db_session:
            obj = models.ProductoTalle.get(id=id)
            if not obj:
                raise HTTPException(status_code=404, detail="Talle no encontrado.")
            obj.delete()

    # ----- Telas -----
    def get_telas(self):
        return _get_telas()

    def create_tela(self, data: schemas.ProductoTelaCreate) -> dict:
        with db_session:
            try:
                nombre = data.nombre.strip()
                codigo = data.codigo.strip()
                if not nombre:
                    raise HTTPException(status_code=400, detail="El nombre no puede estar vacío.")
                if not codigo or not codigo.isdigit() or len(codigo) != 2:
                    raise HTTPException(status_code=400, detail="El código de tela debe tener exactamente 2 dígitos numéricos.")
                obj = models.ProductoTela(nombre=nombre, codigo=codigo)
                flush()
                return {"id": obj.id, "nombre": obj.nombre, "codigo": obj.codigo}
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="Ya existe una tela con ese nombre o código.")

    def delete_tela(self, id: int) -> None:
        with db_session:
            obj = models.ProductoTela.get(id=id)
            if not obj:
                raise HTTPException(status_code=404, detail="Tela no encontrada.")
            obj.delete()

    # ----- Colores -----
    def get_colores(self):
        return _get_colores()

    def create_color(self, data: schemas.ProductoColorCreate) -> dict:
        with db_session:
            try:
                nombre = data.nombre.strip()
                codigo = data.codigo.strip()
                if not nombre:
                    raise HTTPException(status_code=400, detail="El nombre no puede estar vacío.")
                if not codigo or not codigo.isdigit() or len(codigo) != 2:
                    raise HTTPException(status_code=400, detail="El código de color debe tener exactamente 2 dígitos numéricos.")
                obj = models.ProductoColor(nombre=nombre, codigo=codigo)
                flush()
                return {"id": obj.id, "nombre": obj.nombre, "codigo": obj.codigo}
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="Ya existe un color con ese nombre o código.")

    def delete_color(self, id: int) -> None:
        with db_session:
            obj = models.ProductoColor.get(id=id)
            if not obj:
                raise HTTPException(status_code=404, detail="Color no encontrado.")
            obj.delete()
