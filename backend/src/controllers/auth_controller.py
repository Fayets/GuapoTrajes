from fastapi import HTTPException, APIRouter, Depends, Header
from src import schemas
from src.services.usuario_services import UsuariosServices
from jose import jwt, JWTError
from pydantic import BaseModel
from datetime import datetime, timedelta
from ..security import SECRET_KEY, ALGORITHM
from ..schemas import UsuarioOut
from ..deps import get_current_user
from src import models
from pony.orm import db_session
import logging


#Auth Controller

router = APIRouter()
servicio = UsuariosServices()
logger = logging.getLogger("guapotrajes")

ACCESS_TOKEN_DURATION = 60

class RegisterMessage(BaseModel):
    message: str
    success: bool



@router.get("/_debug/header")
async def debug_header(authorization: str = Header(None)):
    return {"authorization": authorization}


@router.post("/verify-token")
async def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("id")

        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")

        user = servicio.buscar_usuario_por_id(user_id)

        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")

        return {
            "message": "Token válido",
            "user": {
                "username": user.username,
                "email": user.email
            }
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

@router.post("/register", response_model=RegisterMessage, status_code=201)
async def register(user: schemas.UserCreate):
    try:
        servicio.crear_usuario(user)
        return {"message": "Usuario creado correctamente", "success": True}
    except HTTPException as e:
        return {"message": e.detail, "success": False}
    except Exception:
        return {"message": "Error inesperado al crear el usuario.", "success": False}


@router.post("/login")
async def login(request: schemas.LoginRequest):
    username = request.username
    email = request.email
    password = request.password

    if not username and not email:
        raise HTTPException(status_code=400, detail="Se requiere un nombre de usuario o un email")

    # Buscar el usuario con el servicio
    user = servicio.buscar_usuario(username=username, email=email, password=password)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    logger.info(
        "Usuario autenticado correctamente",
        extra={"actor_id": user.id, "actor_role": str(user.rol), "actor_username": user.username},
    )

    # Payload del JWT
    payload = {
        "sub": str(user.id),  
        "type": "access",
        "iat": int(datetime.utcnow().timestamp()),
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_DURATION)  # ACCESS_TOKEN_DURATION > 0
    }

    token = jwt.encode(payload, key=SECRET_KEY, algorithm=ALGORITHM)

    return {
        "message": "Usuario autenticado correctamente",
        "success": True,
        "access_token": token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UsuarioOut)
@db_session
def read_me(user = Depends(get_current_user)):
    usuario = models.Usuario.get(id=user.id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    sucursal_nombre = None
    sucursal_id = None

    if usuario.sucursal is not None:
        sucursal_nombre = usuario.sucursal.nombre
        sucursal_id = usuario.sucursal.id

    return {
        "id": usuario.id,
        "email": usuario.email,
        "rol": usuario.rol,
        "sucursal_nombre": sucursal_nombre,
        "sucursal_id": sucursal_id,
    }
