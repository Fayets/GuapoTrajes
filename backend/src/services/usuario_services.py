from pony.orm import db_session
from fastapi import HTTPException
from typing import Optional
import bcrypt
from pony.orm.core import TransactionIntegrityError
from src import models, schemas

class UsuariosServices:
    def __init__(self):
        pass
    

    def crear_usuario(self, usuario: schemas.UserCreate):
        with db_session:
            try:
                hashed_password = self.hash_password(usuario.password).decode("utf-8")  # 🔥 Decodificar bytes a str

                sucursal = models.Sucursal.get(id=usuario.sucursal)
                if not sucursal:
                    raise HTTPException(status_code=400, detail="Sucursal no encontrada")

                usuario_db = models.Usuario(
                    username=usuario.username,
                    email=usuario.email,
                    password=hashed_password,
                    nombre=usuario.nombre,
                    apellido=usuario.apellido,
                    rol=usuario.role,
                    sucursal=sucursal  # Asignamos la instancia de Sucursal
                )
                return usuario_db
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="El usuario o email ya existen")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error al crear el usuario: {str(e)}")

            
    def buscar_usuario_por_id(self, user_id: int):
        with db_session:
            return models.Usuario.get(id=user_id)
            
    def buscar_usuario(self, username: Optional[str], email: Optional[str], password: str):
        with db_session:
            user = None
            if username:
                user = models.Usuario.get(username=username)
            elif email:
                user = models.Usuario.get(email=email)
            
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
            if not self.check_password(user.password, password):
                raise HTTPException(status_code=401, detail="Contraseña incorrecta")
            
            return user  # Retornamos el usuario si todo está bien

    @staticmethod
    def hash_password(password: str) -> bytes:
        """ Hashea una contraseña con bcrypt """
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed  # Se mantiene en formato bytes

    @staticmethod
    def check_password(stored_password: bytes, provided_password: str) -> bool:
        """ Verifica si la contraseña ingresada coincide con la almacenada """
        if isinstance(stored_password, str):
            stored_password = stored_password.encode('utf-8')  # Si es string, convertir a bytes
        return bcrypt.checkpw(provided_password.encode('utf-8'), stored_password)
