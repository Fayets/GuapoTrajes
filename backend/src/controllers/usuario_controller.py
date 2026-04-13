from fastapi import APIRouter, Depends, HTTPException
from pony.orm import db_session
from src import schemas
from src.services.usuario_services import UsuariosServices
from src.models import Roles
from src.deps import require_role, get_current_user
from typing import List
import logging

router = APIRouter()
servicio = UsuariosServices()
logger = logging.getLogger("guapotrajes")


@router.get("/all", response_model=List[schemas.UserResponse])
@db_session
def listar_usuarios(
    current_user=Depends(require_role(Roles.ADMIN, Roles.SUPER_ADMIN)),
):
    """
    Lista todos los usuarios.
    Solo ADMIN y SUPER_ADMIN pueden acceder.
    """
    try:
        usuarios = servicio.listar_usuarios()
        result = []
        for usuario in usuarios:
            # Extraer todos los datos dentro del db_session
            sucursal_id = None
            sucursal_nombre = None
            if usuario.sucursal:
                sucursal_id = usuario.sucursal.id
                sucursal_nombre = usuario.sucursal.nombre
            
            result.append({
                "id": usuario.id,
                "username": usuario.username,
                "email": usuario.email,
                "nombre": usuario.nombre,
                "apellido": usuario.apellido,
                "rol": str(usuario.rol),
                "sucursal_id": sucursal_id,
                "sucursal_nombre": sucursal_nombre,
            })
        return result
    except Exception as e:
        logger.exception("Error al listar usuarios")
        raise HTTPException(status_code=500, detail="Error al obtener los usuarios")


@router.get("/{usuario_id}", response_model=schemas.UserResponse)
@db_session
def obtener_usuario_por_id(
    usuario_id: int,
    current_user=Depends(require_role(Roles.ADMIN, Roles.SUPER_ADMIN)),
):
    """
    Obtiene un usuario por su ID.
    Solo ADMIN y SUPER_ADMIN pueden acceder.
    """
    try:
        usuario = servicio.buscar_usuario_por_id(usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Extraer todos los datos dentro del db_session
        sucursal_id = None
        sucursal_nombre = None
        if usuario.sucursal:
            sucursal_id = usuario.sucursal.id
            sucursal_nombre = usuario.sucursal.nombre
        
        return {
            "id": usuario.id,
            "username": usuario.username,
            "email": usuario.email,
            "nombre": usuario.nombre,
            "apellido": usuario.apellido,
            "rol": str(usuario.rol),
            "sucursal_id": sucursal_id,
            "sucursal_nombre": sucursal_nombre,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error al obtener usuario")
        raise HTTPException(status_code=500, detail="Error al obtener el usuario")


@router.post("/create", response_model=schemas.UserSingleResponse, status_code=201)
@db_session
def crear_usuario(
    usuario: schemas.UserCreate,
    current_user=Depends(require_role(Roles.ADMIN, Roles.SUPER_ADMIN)),
):
    """
    Crea un nuevo usuario (solo tipo EMPLEADO).
    Solo ADMIN y SUPER_ADMIN pueden crear usuarios.
    """
    try:
        # Solo permitir crear usuarios tipo EMPLEADO
        if usuario.role != Roles.EMPLEADO:
            raise HTTPException(
                status_code=403,
                detail="Solo se pueden crear usuarios tipo EMPLEADO"
            )
        
        usuario_creado = servicio.crear_usuario(usuario)
        
        # Extraer todos los datos dentro del db_session
        sucursal_id = None
        sucursal_nombre = None
        if usuario_creado.sucursal:
            sucursal_id = usuario_creado.sucursal.id
            sucursal_nombre = usuario_creado.sucursal.nombre
        
        logger.info(
            "Usuario creado",
            extra={
                "actor_id": getattr(current_user, "id", None),
                "actor_role": getattr(current_user, "rol", None),
                "usuario_id": usuario_creado.id,
                "usuario_username": usuario_creado.username,
            },
        )
        
        return {
            "message": "Usuario creado correctamente",
            "success": True,
            "data": {
                "id": usuario_creado.id,
                "username": usuario_creado.username,
                "email": usuario_creado.email,
                "nombre": usuario_creado.nombre,
                "apellido": usuario_creado.apellido,
                "rol": str(usuario_creado.rol),
                "sucursal_id": sucursal_id,
                "sucursal_nombre": sucursal_nombre,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error al crear usuario")
        raise HTTPException(status_code=500, detail=f"Error al crear el usuario: {str(e)}")


@router.put("/update/{usuario_id}", response_model=schemas.UserSingleResponse)
@db_session
def actualizar_usuario(
    usuario_id: int,
    usuario_update: schemas.UserUpdate,
    current_user=Depends(require_role(Roles.ADMIN, Roles.SUPER_ADMIN)),
):
    """
    Actualiza un usuario existente.
    Solo ADMIN y SUPER_ADMIN pueden actualizar usuarios.
    """
    try:
        usuario_actualizado = servicio.actualizar_usuario(usuario_id, usuario_update)
        
        # Extraer todos los datos dentro del db_session
        sucursal_id = None
        sucursal_nombre = None
        if usuario_actualizado.sucursal:
            sucursal_id = usuario_actualizado.sucursal.id
            sucursal_nombre = usuario_actualizado.sucursal.nombre
        
        logger.info(
            "Usuario actualizado",
            extra={
                "actor_id": getattr(current_user, "id", None),
                "actor_role": getattr(current_user, "rol", None),
                "usuario_id": usuario_id,
            },
        )
        
        return {
            "message": "Usuario actualizado correctamente",
            "success": True,
            "data": {
                "id": usuario_actualizado.id,
                "username": usuario_actualizado.username,
                "email": usuario_actualizado.email,
                "nombre": usuario_actualizado.nombre,
                "apellido": usuario_actualizado.apellido,
                "rol": str(usuario_actualizado.rol),
                "sucursal_id": sucursal_id,
                "sucursal_nombre": sucursal_nombre,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error al actualizar usuario")
        raise HTTPException(status_code=500, detail=f"Error al actualizar el usuario: {str(e)}")


@router.delete("/delete/{usuario_id}")
def eliminar_usuario(
    usuario_id: int,
    current_user=Depends(require_role(Roles.ADMIN, Roles.SUPER_ADMIN)),
):
    """
    Elimina un usuario.
    Solo ADMIN y SUPER_ADMIN pueden eliminar usuarios.
    No se pueden eliminar usuarios SUPER_ADMIN.
    """
    try:
        servicio.eliminar_usuario(usuario_id)
        logger.info(
            "Usuario eliminado",
            extra={
                "actor_id": getattr(current_user, "id", None),
                "actor_role": getattr(current_user, "rol", None),
                "usuario_id": usuario_id,
            },
        )
        return {"message": "Usuario eliminado correctamente", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error al eliminar usuario")
        raise HTTPException(status_code=500, detail=f"Error al eliminar el usuario: {str(e)}")
