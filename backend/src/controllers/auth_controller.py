from fastapi import HTTPException, APIRouter, Depends, Header
from src import schemas
from src.services.usuario_services import UsuariosServices
from jose import jwt, JWTError
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta
from ..security import SECRET_KEY, ALGORITHM, secret_fingerprint, decode_token
from ..schemas import UsuarioOut
from ..deps import get_current_user
from src import models
from pony.orm import db_session

#Auth Controller

router = APIRouter()
servicio = UsuariosServices()

ACCESS_TOKEN_DURATION = 60
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

class RegisterMessage(BaseModel):
    message: str
    success: bool



@router.get("/_debug/header")
async def debug_header(authorization: str = Header(None)):
    return {"authorization": authorization}


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """ Verifica el token y obtiene el usuario actual """
    try:
        payload = decode_token(token)
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido (ID no encontrado)")

        try:
            user_id = (user_id)  # Asegurar que el ID es UUID válido
        except ValueError:
            raise HTTPException(status_code=401, detail="Token inválido (ID malformado)")

        user = servicio.buscar_usuario_por_id(user_id)

        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")

        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


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
