from pony.orm import db_session, flush
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
                flush()  # asegura id antes de serializar la respuesta
                return usuario_db
            except TransactionIntegrityError:
                raise HTTPException(status_code=400, detail="El usuario o email ya existen")
            except HTTPException:
                raise
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

    def listar_usuarios(self, rol_filtro: Optional[models.Roles] = None):
        """ Lista todos los usuarios, opcionalmente filtrados por rol """
        with db_session:
            query = models.Usuario.select()
            if rol_filtro:
                query = query.filter(lambda u: u.rol == rol_filtro)
            usuarios = list(query)
            return usuarios

    def actualizar_usuario(self, usuario_id: int, usuario_update: schemas.UserUpdate):
        """ Actualiza un usuario existente """
        with db_session:
            usuario = models.Usuario.get(id=usuario_id)
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            if usuario.rol == models.Roles.SUPER_ADMIN:
                raise HTTPException(
                    status_code=403,
                    detail="No se puede modificar un usuario SUPER_ADMIN",
                )

            # Actualizar campos si se proporcionan
            if usuario_update.username is not None:
                # Verificar que el username no esté en uso por otro usuario
                existing = models.Usuario.get(username=usuario_update.username)
                if existing and existing.id != usuario_id:
                    raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso")
                usuario.username = usuario_update.username

            if usuario_update.email is not None:
                # Verificar que el email no esté en uso por otro usuario
                existing = models.Usuario.get(email=usuario_update.email)
                if existing and existing.id != usuario_id:
                    raise HTTPException(status_code=400, detail="El email ya está en uso")
                usuario.email = usuario_update.email

            if usuario_update.nombre is not None:
                usuario.nombre = usuario_update.nombre

            if usuario_update.apellido is not None:
                usuario.apellido = usuario_update.apellido

            if usuario_update.password is not None:
                hashed_password = self.hash_password(usuario_update.password).decode("utf-8")
                usuario.password = hashed_password

            if usuario_update.role is not None:
                nuevo_rol = usuario_update.role
                if isinstance(nuevo_rol, str):
                    try:
                        nuevo_rol = models.Roles(nuevo_rol)
                    except ValueError:
                        raise HTTPException(status_code=400, detail="Rol inválido")
                if nuevo_rol not in (models.Roles.EMPLEADO, models.Roles.ADMIN):
                    raise HTTPException(
                        status_code=403,
                        detail="Solo se pueden asignar roles EMPLEADO o ADMIN",
                    )
                usuario.rol = nuevo_rol

            if usuario_update.sucursal is not None:
                sucursal = models.Sucursal.get(id=usuario_update.sucursal)
                if not sucursal:
                    raise HTTPException(status_code=400, detail="Sucursal no encontrada")
                usuario.sucursal = sucursal

            return usuario

    def eliminar_usuario(self, usuario_id: int):
        """ Elimina un usuario """
        with db_session:
            usuario = models.Usuario.get(id=usuario_id)
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
            # No permitir eliminar usuarios SUPER_ADMIN
            if usuario.rol == models.Roles.SUPER_ADMIN:
                raise HTTPException(status_code=403, detail="No se puede eliminar un usuario SUPER_ADMIN")
            
            usuario.delete()
            return True