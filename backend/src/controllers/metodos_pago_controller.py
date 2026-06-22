from fastapi import APIRouter, Depends, HTTPException
from pony.orm import db_session, select
from src import schemas
from src.services.metodos_pago_services import MetodosPagoServices
from src.controllers.auth_controller import get_current_user
from src.deps import require_role
from src.models import SubmetodoPago
from typing import Dict

router = APIRouter()
servicio = MetodosPagoServices()

@router.get("/sucursal/{sucursal_id}", response_model=schemas.MetodoPagoConfigurableListResponse)
def obtener_metodos_pago_por_sucursal(
    sucursal_id: int,
    solo_activos: bool = False,
    current_user=Depends(get_current_user)
):
    """Obtener métodos de pago de una sucursal. Por defecto devuelve todos (activos e inactivos), usa solo_activos=true para filtrar."""
    try:
        print(f"🔍 Controlador: Obteniendo métodos para sucursal {sucursal_id}, solo_activos={solo_activos}")
        metodos = servicio.get_metodos_por_sucursal(sucursal_id, current_user.id, solo_activos)
        print(f"✅ Controlador: Servicio devolvió {len(metodos)} métodos")
        
        # Convertir a formato de respuesta
        metodos_response = []
        for metodo in metodos:
            submétodos_response = [
                schemas.SubmetodoPagoResponse(
                    id=s["id"],
                    metodo_pago_id=metodo["id"],
                    nombre=s["nombre"],
                    activo=s["activo"],
                    orden=s["orden"],
                    fecha_creacion=None  # No incluido en la respuesta simple
                )
                for s in metodo["submétodos"]
            ]
            
            metodo_response = schemas.MetodoPagoConfigurableResponse(
                id=metodo["id"],
                sucursal_id=sucursal_id,
                nombre=metodo["nombre"],
                activo=metodo["activo"],
                tiene_submetodos=metodo["tiene_submetodos"],
                orden=metodo["orden"],
                fecha_creacion=None,  # No incluido en la respuesta simple
                submétodos=submétodos_response
            )
            metodos_response.append(metodo_response)
        
        print(f"✅ Controlador: Devolviendo {len(metodos_response)} métodos en formato de respuesta")
        
        return {
            "message": "Métodos de pago obtenidos exitosamente",
            "success": True,
            "data": metodos_response
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al obtener métodos de pago: {str(e)}")

@router.post("/", response_model=schemas.MetodoPagoConfigurableSingleResponse, dependencies=[Depends(require_role("ADMIN"))])
def crear_metodo_pago(
    metodo: schemas.MetodoPagoConfigurableCreate,
    current_user=Depends(get_current_user)
):
    """Crear un nuevo método de pago. Solo ADMIN."""
    try:
        metodo_data = {
            "sucursal_id": metodo.sucursal_id,
            "nombre": metodo.nombre,
            "activo": metodo.activo,
            "tiene_submetodos": metodo.tiene_submetodos,
            "orden": metodo.orden
        }
        metodo_creado = servicio.crear_metodo_pago(metodo_data, current_user.id)
        
        # Obtener los datos necesarios dentro de una sesión de base de datos
        with db_session:
            from src.models import MetodoPagoConfigurable
            metodo_obj = MetodoPagoConfigurable.get(id=metodo_creado.id)
            if not metodo_obj:
                raise HTTPException(status_code=404, detail="Método de pago no encontrado después de crearlo")
            
            metodo_response = schemas.MetodoPagoConfigurableResponse(
                id=metodo_obj.id,
                sucursal_id=metodo_obj.sucursal.id,
                nombre=metodo_obj.nombre,
                activo=metodo_obj.activo,
                tiene_submetodos=metodo_obj.tiene_submetodos,
                orden=metodo_obj.orden,
                fecha_creacion=metodo_obj.fecha_creacion,
                submétodos=[]
            )
        
        return {
            "message": "Método de pago creado exitosamente",
            "success": True,
            "data": metodo_response
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al crear método de pago: {str(e)}")

@router.put("/{metodo_id}", response_model=schemas.MetodoPagoConfigurableSingleResponse, dependencies=[Depends(require_role("ADMIN"))])
def actualizar_metodo_pago(
    metodo_id: int,
    metodo: schemas.MetodoPagoConfigurableUpdate,
    current_user=Depends(get_current_user)
):
    """Actualizar un método de pago. Solo ADMIN."""
    try:
        metodo_data = metodo.model_dump(exclude_unset=True)
        metodo_actualizado = servicio.actualizar_metodo_pago(metodo_id, metodo_data, current_user.id)
        
        # Obtener submétodos
        with db_session:
            submétodos_query = select(
                s for s in SubmetodoPago 
                if s.metodo_pago.id == metodo_id
            )
            submétodos_response = [
                schemas.SubmetodoPagoResponse(
                    id=s.id,
                    metodo_pago_id=s.metodo_pago.id,
                    nombre=s.nombre,
                    activo=s.activo,
                    orden=s.orden,
                    fecha_creacion=s.fecha_creacion
                )
                for s in submétodos_query
            ]
        
        metodo_response = schemas.MetodoPagoConfigurableResponse(
            id=metodo_actualizado.id,
            sucursal_id=metodo_actualizado.sucursal.id,
            nombre=metodo_actualizado.nombre,
            activo=metodo_actualizado.activo,
            tiene_submetodos=metodo_actualizado.tiene_submetodos,
            orden=metodo_actualizado.orden,
            fecha_creacion=metodo_actualizado.fecha_creacion,
            submétodos=submétodos_response
        )
        
        return {
            "message": "Método de pago actualizado exitosamente",
            "success": True,
            "data": metodo_response
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al actualizar método de pago: {str(e)}")

@router.post("/submetodos/", response_model=schemas.SubmetodoPagoSingleResponse, dependencies=[Depends(require_role("ADMIN"))])
def crear_submetodo(
    submetodo: schemas.SubmetodoPagoCreate,
    current_user=Depends(get_current_user)
):
    """Crear un nuevo submétodo de pago. Solo ADMIN."""
    try:
        submetodo_data = {
            "metodo_pago_id": submetodo.metodo_pago_id,
            "nombre": submetodo.nombre,
            "activo": submetodo.activo,
            "orden": submetodo.orden
        }
        submetodo_creado = servicio.crear_submetodo(submetodo_data, current_user.id)
        
        submetodo_response = schemas.SubmetodoPagoResponse(
            id=submetodo_creado.id,
            metodo_pago_id=submetodo_creado.metodo_pago.id,
            nombre=submetodo_creado.nombre,
            activo=submetodo_creado.activo,
            orden=submetodo_creado.orden,
            fecha_creacion=submetodo_creado.fecha_creacion
        )
        
        return {
            "message": "Submétodo de pago creado exitosamente",
            "success": True,
            "data": submetodo_response
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al crear submétodo de pago: {str(e)}")

@router.put("/submetodos/{submetodo_id}", response_model=schemas.SubmetodoPagoSingleResponse, dependencies=[Depends(require_role("ADMIN"))])
def actualizar_submetodo(
    submetodo_id: int,
    submetodo: schemas.SubmetodoPagoUpdate,
    current_user=Depends(get_current_user)
):
    """Actualizar un submétodo de pago. Solo ADMIN."""
    try:
        submetodo_data = submetodo.model_dump(exclude_unset=True)
        submetodo_actualizado = servicio.actualizar_submetodo(submetodo_id, submetodo_data, current_user.id)
        
        submetodo_response = schemas.SubmetodoPagoResponse(
            id=submetodo_actualizado.id,
            metodo_pago_id=submetodo_actualizado.metodo_pago.id,
            nombre=submetodo_actualizado.nombre,
            activo=submetodo_actualizado.activo,
            orden=submetodo_actualizado.orden,
            fecha_creacion=submetodo_actualizado.fecha_creacion
        )
        
        return {
            "message": "Submétodo de pago actualizado exitosamente",
            "success": True,
            "data": submetodo_response
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al actualizar submétodo de pago: {str(e)}")
