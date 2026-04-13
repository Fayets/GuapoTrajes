from pony.orm import db_session
from fastapi import HTTPException
from typing import List, Optional
from pony.orm.core import TransactionIntegrityError, flush
from src import models, schemas
from src.models import Roles

class CuentaDestinoServices:
    def __init__(self):
        pass

    def crear_cuenta_destino(self, cuenta_data: schemas.CuentaDestinoCreate, user_id: int) -> dict:
        """Crear una nueva cuenta destino. Solo ADMIN puede crear."""
        with db_session:
            try:
                # Verificar que el usuario es ADMIN
                usuario = models.Usuario.get(id=user_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
                if usuario.rol != Roles.ADMIN:
                    raise HTTPException(status_code=403, detail="Solo los administradores pueden crear cuentas destino")
                
                # Verificar que la sucursal existe
                sucursal = models.Sucursal.get(id=cuenta_data.sucursal_id)
                if not sucursal:
                    raise HTTPException(status_code=404, detail="Sucursal no encontrada")
                
                # Crear la cuenta destino
                cuenta = models.CuentaDestino(
                    sucursal=sucursal,
                    nombre_titular=cuenta_data.nombre_titular,
                    activa=True
                )
                flush()
                
                return {
                    "message": "Cuenta destino creada exitosamente",
                    "success": True,
                    "data": {
                        "id": cuenta.id,
                        "sucursal_id": cuenta.sucursal.id,
                        "nombre_titular": cuenta.nombre_titular,
                        "activa": cuenta.activa
                    }
                }
            except HTTPException:
                raise
            except Exception as e:
                print(f"Error al crear cuenta destino: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al crear la cuenta destino")

    def get_cuentas_destino_por_sucursal(self, sucursal_id: int, user_id: int) -> List[dict]:
        """Obtener todas las cuentas destino de una sucursal. Filtra por sucursal del usuario si es EMPLEADO."""
        with db_session:
            try:
                print(f"🔍 [CuentaDestino] Buscando cuentas para sucursal_id={sucursal_id}, user_id={user_id}")
                
                usuario = models.Usuario.get(id=user_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
                print(f"👤 [CuentaDestino] Usuario encontrado: {usuario.username}, rol: {usuario.rol}")
                
                # Si es EMPLEADO, solo puede ver cuentas de su sucursal
                if usuario.rol == Roles.EMPLEADO:
                    if usuario.sucursal and usuario.sucursal.id != sucursal_id:
                        raise HTTPException(status_code=403, detail="No tienes permiso para ver cuentas destino de otras sucursales")
                
                # Verificar que la sucursal existe
                sucursal = models.Sucursal.get(id=sucursal_id)
                if not sucursal:
                    raise HTTPException(status_code=404, detail="Sucursal no encontrada")
                
                print(f"🏢 [CuentaDestino] Sucursal encontrada: {sucursal.nombre}")
                
                # Obtener todas las cuentas destino primero (sin filtro) para debug
                todas_cuentas = list(models.CuentaDestino.select())
                print(f"📋 [CuentaDestino] Total de cuentas destino en BD: {len(todas_cuentas)}")
                for c in todas_cuentas:
                    print(f"   - ID: {c.id}, Sucursal ID: {c.sucursal.id}, Nombre: {c.nombre_titular}, Activa: {c.activa}")
                
                # Obtener cuentas destino usando la relación directa de la sucursal (más confiable)
                cuentas = list(sucursal.cuentas_destino)
                print(f"✅ [CuentaDestino] Cuentas encontradas para sucursal {sucursal_id} (desde relación): {len(cuentas)}")
                
                # Si no hay resultados con la relación, intentar con select lambda como fallback
                if len(cuentas) == 0:
                    print(f"⚠️ [CuentaDestino] No se encontraron cuentas con relación directa, intentando con select lambda...")
                    cuentas = list(models.CuentaDestino.select(lambda c: c.sucursal.id == sucursal_id))
                    print(f"🔍 [CuentaDestino] Cuentas con select lambda: {len(cuentas)}")
                
                cuentas_list = []
                for cuenta in cuentas:
                    cuentas_list.append({
                        "id": cuenta.id,
                        "sucursal_id": cuenta.sucursal.id,
                        "nombre_titular": cuenta.nombre_titular,
                        "activa": cuenta.activa
                    })
                    print(f"   ✓ Agregada cuenta: ID={cuenta.id}, Nombre={cuenta.nombre_titular}")
                
                print(f"📤 [CuentaDestino] Retornando {len(cuentas_list)} cuentas")
                return cuentas_list
            except HTTPException:
                raise
            except Exception as e:
                print(f"Error al obtener cuentas destino: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al obtener las cuentas destino")

    def get_cuentas_destino_activas_por_sucursal(self, sucursal_id: int, user_id: int) -> List[dict]:
        """Obtener solo las cuentas destino activas de una sucursal."""
        with db_session:
            try:
                usuario = models.Usuario.get(id=user_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
                # Si es EMPLEADO, solo puede ver cuentas de su sucursal
                if usuario.rol == Roles.EMPLEADO:
                    if usuario.sucursal and usuario.sucursal.id != sucursal_id:
                        raise HTTPException(status_code=403, detail="No tienes permiso para ver cuentas destino de otras sucursales")
                
                # Verificar que la sucursal existe
                sucursal = models.Sucursal.get(id=sucursal_id)
                if not sucursal:
                    raise HTTPException(status_code=404, detail="Sucursal no encontrada")
                
                # Obtener todas las cuentas de la sucursal y filtrar por activa en Python
                # Esto evita el problema de TO_BOOL en Pony ORM
                todas_cuentas = list(sucursal.cuentas_destino)
                cuentas = [c for c in todas_cuentas if c.activa == True]
                
                cuentas_list = []
                for cuenta in cuentas:
                    cuentas_list.append({
                        "id": cuenta.id,
                        "sucursal_id": cuenta.sucursal.id,
                        "nombre_titular": cuenta.nombre_titular,
                        "activa": cuenta.activa
                    })
                
                return cuentas_list
            except HTTPException:
                raise
            except Exception as e:
                print(f"Error al obtener cuentas destino activas: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail="Error inesperado al obtener las cuentas destino activas")

    def actualizar_cuenta_destino(self, id: int, cuenta_update: schemas.CuentaDestinoUpdate, user_id: int) -> dict:
        """Actualizar una cuenta destino. Solo ADMIN puede actualizar."""
        with db_session:
            try:
                # Verificar que el usuario es ADMIN
                usuario = models.Usuario.get(id=user_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
                if usuario.rol != Roles.ADMIN:
                    raise HTTPException(status_code=403, detail="Solo los administradores pueden actualizar cuentas destino")
                
                # Obtener la cuenta destino
                cuenta = models.CuentaDestino.get(id=id)
                if not cuenta:
                    raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                
                # Actualizar campos
                update_data = cuenta_update.model_dump(exclude_unset=True)
                for k, v in update_data.items():
                    setattr(cuenta, k, v)
                
                flush()
                
                return {
                    "message": "Cuenta destino actualizada correctamente",
                    "success": True,
                    "data": {
                        "id": cuenta.id,
                        "sucursal_id": cuenta.sucursal.id,
                        "nombre_titular": cuenta.nombre_titular,
                        "activa": cuenta.activa
                    }
                }
            except HTTPException:
                raise
            except Exception as e:
                print(f"Error al actualizar cuenta destino: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al actualizar la cuenta destino")

    def activar_cuenta_destino(self, id: int, user_id: int) -> dict:
        """Activar una cuenta destino. Solo ADMIN puede activar."""
        with db_session:
            try:
                usuario = models.Usuario.get(id=user_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
                if usuario.rol != Roles.ADMIN:
                    raise HTTPException(status_code=403, detail="Solo los administradores pueden activar cuentas destino")
                
                cuenta = models.CuentaDestino.get(id=id)
                if not cuenta:
                    raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                
                cuenta.activa = True
                flush()
                
                return {
                    "message": "Cuenta destino activada correctamente",
                    "success": True,
                    "data": {
                        "id": cuenta.id,
                        "sucursal_id": cuenta.sucursal.id,
                        "nombre_titular": cuenta.nombre_titular,
                        "activa": cuenta.activa
                    }
                }
            except HTTPException:
                raise
            except Exception as e:
                print(f"Error al activar cuenta destino: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al activar la cuenta destino")

    def desactivar_cuenta_destino(self, id: int, user_id: int) -> dict:
        """Desactivar una cuenta destino. Solo ADMIN puede desactivar."""
        with db_session:
            try:
                usuario = models.Usuario.get(id=user_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
                if usuario.rol != Roles.ADMIN:
                    raise HTTPException(status_code=403, detail="Solo los administradores pueden desactivar cuentas destino")
                
                cuenta = models.CuentaDestino.get(id=id)
                if not cuenta:
                    raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                
                cuenta.activa = False
                flush()
                
                return {
                    "message": "Cuenta destino desactivada correctamente",
                    "success": True,
                    "data": {
                        "id": cuenta.id,
                        "sucursal_id": cuenta.sucursal.id,
                        "nombre_titular": cuenta.nombre_titular,
                        "activa": cuenta.activa
                    }
                }
            except HTTPException:
                raise
            except Exception as e:
                print(f"Error al desactivar cuenta destino: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al desactivar la cuenta destino")

    def get_cuenta_destino_por_id(self, id: int, user_id: int) -> dict:
        """Obtener una cuenta destino por ID."""
        with db_session:
            try:
                usuario = models.Usuario.get(id=user_id)
                if not usuario:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
                cuenta = models.CuentaDestino.get(id=id)
                if not cuenta:
                    raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")
                
                # Si es EMPLEADO, solo puede ver cuentas de su sucursal
                if usuario.rol == Roles.EMPLEADO:
                    if usuario.sucursal and usuario.sucursal.id != cuenta.sucursal.id:
                        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta cuenta destino")
                
                return {
                    "id": cuenta.id,
                    "sucursal_id": cuenta.sucursal.id,
                    "nombre_titular": cuenta.nombre_titular,
                    "activa": cuenta.activa
                }
            except HTTPException:
                raise
            except Exception as e:
                print(f"Error al obtener cuenta destino: {e}")
                raise HTTPException(status_code=500, detail="Error inesperado al obtener la cuenta destino")
