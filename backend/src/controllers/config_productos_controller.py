# Rutas de configuración: atributos de producto (líneas, talles, telas, colores)
from fastapi import APIRouter, Depends, HTTPException
from src import schemas
from src.services.config_productos_services import ConfigProductosServices
from src.deps import get_current_user, require_role
from typing import List

router = APIRouter()
service = ConfigProductosServices()

# Todas las rutas requieren ADMIN o SUPER_ADMIN (igual que Ajustes en el frontend)
_dep = [Depends(get_current_user), Depends(require_role("ADMIN", "SUPER_ADMIN"))]


# ----- Líneas -----
@router.get("/productos/lineas", response_model=List[schemas.ProductoLineaResponse], dependencies=_dep)
def get_lineas(current_user=Depends(get_current_user)):
    try:
        items = service.get_lineas()
        return [schemas.ProductoLineaResponse(**x) for x in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/productos/lineas", response_model=schemas.ProductoLineaResponse, status_code=201, dependencies=_dep)
def create_linea(data: schemas.ProductoLineaCreate, current_user=Depends(get_current_user)):
    try:
        return service.create_linea(data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/productos/lineas/{id}", status_code=204, dependencies=_dep)
def delete_linea(id: int, current_user=Depends(get_current_user)):
    service.delete_linea(id)


# ----- Talles -----
@router.get("/productos/talles", response_model=List[schemas.ProductoTalleResponse], dependencies=_dep)
def get_talles(current_user=Depends(get_current_user)):
    try:
        items = service.get_talles()
        return [schemas.ProductoTalleResponse(**x) for x in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/productos/talles", response_model=schemas.ProductoTalleResponse, status_code=201, dependencies=_dep)
def create_talle(data: schemas.ProductoTalleCreate, current_user=Depends(get_current_user)):
    try:
        return service.create_talle(data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/productos/talles/{id}", status_code=204, dependencies=_dep)
def delete_talle(id: int, current_user=Depends(get_current_user)):
    service.delete_talle(id)


# ----- Telas -----
@router.get("/productos/telas", response_model=List[schemas.ProductoTelaResponse], dependencies=_dep)
def get_telas(current_user=Depends(get_current_user)):
    try:
        items = service.get_telas()
        return [schemas.ProductoTelaResponse(**x) for x in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/productos/telas", response_model=schemas.ProductoTelaResponse, status_code=201, dependencies=_dep)
def create_tela(data: schemas.ProductoTelaCreate, current_user=Depends(get_current_user)):
    try:
        return service.create_tela(data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/productos/telas/{id}", status_code=204, dependencies=_dep)
def delete_tela(id: int, current_user=Depends(get_current_user)):
    service.delete_tela(id)


# ----- Colores -----
@router.get("/productos/colores", response_model=List[schemas.ProductoColorResponse], dependencies=_dep)
def get_colores(current_user=Depends(get_current_user)):
    try:
        items = service.get_colores()
        return [schemas.ProductoColorResponse(**x) for x in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/productos/colores", response_model=schemas.ProductoColorResponse, status_code=201, dependencies=_dep)
def create_color(data: schemas.ProductoColorCreate, current_user=Depends(get_current_user)):
    try:
        return service.create_color(data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/productos/colores/{id}", status_code=204, dependencies=_dep)
def delete_color(id: int, current_user=Depends(get_current_user)):
    service.delete_color(id)
