from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from .security import decode_token
from .models import Usuario, Roles
from jose import JWTError
from pony.orm import db_session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

@db_session
def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido (ID no encontrado)")

    user = Usuario.get(id=int(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    return user


def _as_str(role) -> str:
    # Soporta Enum y str
    return role.value if hasattr(role, "value") else str(role)

def require_role(*roles: str):
    """
    Dependencia para proteger endpoints por rol.
    Uso: Depends(require_role("ADMIN")) o Depends(require_role(Roles.ADMIN))
    """
    allowed = { _as_str(r) for r in roles }
    def _checker(user: Usuario = Depends(get_current_user)) -> Usuario:
        user_role = _as_str(user.rol)
        if user_role not in allowed:
            raise HTTPException(status_code=403, detail="Permiso denegado")
        return user
    return _checker


def require_any_role() -> Usuario:
    """
    Útil si querés forzar autenticación pero permitir cualquier rol.
    """
    return Depends(get_current_user)