# Servicio para CRUD de catálogos de atributos de producto (líneas, talles, telas, colores)
from pony.orm import db_session, flush, select
from fastapi import HTTPException
from pony.orm.core import TransactionIntegrityError
from src import models, schemas


def _listar_catalogo(entidad):
    """Lee el catálogo como filas sueltas: si la base tuviera dos códigos repetidos,
    cargarlos como entidades rompe la caché única de Pony y la lista entera da 500."""
    with db_session:
        filas = select((e.id, e.nombre, e.codigo) for e in entidad)[:]
        return [{"id": int(i), "nombre": str(n), "codigo": str(c)} for i, n, c in filas]


def _rechazar_repetido(entidad, nombre: str, codigo: str, etiqueta: str) -> None:
    """La base puede no tener el índice único: se valida acá antes de insertar."""
    con_codigo = select(e.nombre for e in entidad if e.codigo == codigo)[:1]
    if con_codigo:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe {etiqueta} con el código {codigo} ({con_codigo[0]}).",
        )
    nombre_min = nombre.lower()
    if select(e for e in entidad if e.nombre.lower() == nombre_min).exists():
        raise HTTPException(status_code=400, detail=f"Ya existe {etiqueta} con el nombre {nombre}.")


def _get_lineas():
    return _listar_catalogo(models.ProductoLinea)


def _get_talles():
    return _listar_catalogo(models.ProductoTalle)


def _get_telas():
    return _listar_catalogo(models.ProductoTela)


def _get_colores():
    return _listar_catalogo(models.ProductoColor)


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
                _rechazar_repetido(models.ProductoLinea, nombre, codigo, "una línea")
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
                _rechazar_repetido(models.ProductoTalle, nombre, codigo, "un talle")
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
                _rechazar_repetido(models.ProductoTela, nombre, codigo, "una tela")
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
                _rechazar_repetido(models.ProductoColor, nombre, codigo, "un color")
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
