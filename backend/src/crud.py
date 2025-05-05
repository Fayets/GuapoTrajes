from pony.orm import *
import bcrypt
from fastapi import HTTPException
from src import models, schemas

# Función para crear usuario
def create_user(user: schemas.UserCreate):
    with db_session:
        try:
            # Verificar si la sucursal existe
            sucursal_obj = models.Sucursal.get(id=user.sucursal.id)
            if not sucursal_obj:
                raise HTTPException(status_code=400, detail="Sucursal no encontrada")

            hashed_password = hash_password(user.password)

            usuario = models.Usuario(
                username=user.username,
                email=user.email,
                password=hashed_password,
                nombre=user.nombre,  # Corregido
                apellido=user.apellido,  # Corregido
                rol=user.role,
                sucursal=sucursal_obj  # Asigna el objeto sucursal
            )

            flush()  # Guarda los cambios en la BD

            print("Usuario creado correctamente.")
            return usuario.to_dict(exclude=['id', 'password'])

        except TransactionIntegrityError:
            raise HTTPException(status_code=400, detail="El usuario o email ya existen")
        except Exception as e:
            print(f"Error al crear el usuario: {e}")
            raise HTTPException(status_code=500, detail="Error al crear el usuario")

# Obtener todos los usuarios
def get_users():
    with db_session:
        users = select(u for u in models.Usuario)[:]  # Corregido
        return [
            {key: str(value) if isinstance(value) else value for key, value in user.to_dict(exclude=['password']).items()}
            for user in users
        ]

# Buscar usuario por username/email y validar contraseña
def search_user(username, email, password):
    with db_session:
        user = select(u for u in models.Usuario if (u.username == username or u.email == email)).first()  # Corregido

        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        if not check_password(user.password, password):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta")

        return user.to_dict(exclude=['password'])  # No devolver la contraseña

# Función para encriptar contraseñas
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

# Función para verificar contraseñas
def check_password(stored_password: str, provided_password: str) -> bool:
    return bcrypt.checkpw(provided_password.encode('utf-8'), stored_password.encode('utf-8'))


# {
#   "username": "tomas",
#   "email": "tomas@test.com",
#   "firstName": "Tomas",
#   "lastName": "Schmira",
#   "role": "ADMIN",
#   "password": "1234"
# }


