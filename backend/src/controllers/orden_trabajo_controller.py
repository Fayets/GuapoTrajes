from fastapi import APIRouter, Depends, HTTPException, Request
from src.schemas import OrdenTrabajoCreateSchema, OrdenTrabajoResponseSchema, ProductoReservadoSchema, PagoSaldoPendienteSchema, OrdenTrabajoCreateSchemaTest
from src.services.orden_trabajo_services import OrdenTrabajoServices
from pony.orm import db_session
from src.controllers.auth_controller import get_current_user
from fastapi.responses import FileResponse
from src.models import OrdenTrabajo
from datetime import datetime
from typing import List

router = APIRouter(prefix="/ordenes")
servicio = OrdenTrabajoServices()

@router.get("/metodos-pago")
def obtener_metodos_pago():
    """Obtener los métodos de pago disponibles"""
    try:
        from src.models import MetodoPago
        metodos = [
            {
                "value": metodo.value, 
                "label": metodo.value.replace("_", " ").title(),
                "descripcion": f"Pago con {metodo.value.lower().replace('_', ' ')}"
            }
            for metodo in MetodoPago
        ]
        
        print(f"🔍 Métodos de pago disponibles: {[m['value'] for m in metodos]}")
        
        return {
            "message": "Métodos de pago obtenidos exitosamente",
            "success": True,
            "data": {
                "metodos": metodos,
                "valores_validos": [metodo.value for metodo in MetodoPago],
                "total": len(metodos)
            }
        }
    except Exception as e:
        print(f"❌ Error al obtener métodos de pago: {e}")
        raise HTTPException(status_code=500, detail=f"Error al obtener métodos de pago: {str(e)}")

@router.post("/debug-raw")
async def debug_raw_data(request: Request):
    """Endpoint para debug - recibe datos raw y los muestra"""
    try:
        # Obtener datos raw
        raw_data = await request.json()
        print(f"🔍 DEBUG RAW: Datos recibidos:")
        print(f"  - Tipo de request: {type(raw_data)}")
        print(f"  - Contenido: {raw_data}")
        print(f"  - Keys disponibles: {list(raw_data.keys()) if isinstance(raw_data, dict) else 'No es dict'}")
        
        if isinstance(raw_data, dict):
            for key, value in raw_data.items():
                print(f"    - {key}: {value} (tipo: {type(value)})")
        
        return {
            "message": "Datos raw recibidos correctamente",
            "success": True,
            "data": {
                "raw_data": raw_data,
                "keys": list(raw_data.keys()) if isinstance(raw_data, dict) else [],
                "content_type": request.headers.get("content-type", "No especificado")
            }
        }
    except Exception as e:
        print(f"❌ ERROR en debug raw: {e}")
        return {
            "message": f"Error al procesar datos raw: {str(e)}",
            "success": False,
            "error": str(e)
        }

@router.post("/test-schema-flexible")
def test_schema_flexible(data: OrdenTrabajoCreateSchemaTest):
    """Endpoint de prueba con schema más permisivo"""
    try:
        print(f"🧪 TEST SCHEMA FLEXIBLE:")
        print(f"  - presupuesto_id: {data.presupuesto_id}")
        print(f"  - seña_pagada: {data.seña_pagada}")
        print(f"  - payment_method: '{data.payment_method}'")
        print(f"  - metodo_pago (antiguo): '{data.metodo_pago}'")
        print(f"  - debug_info: {data.debug_info}")
        
        return {
            "message": "Schema flexible validado correctamente",
            "success": True,
            "data": {
                "presupuesto_id": data.presupuesto_id,
                "seña_pagada": data.seña_pagada,
                "payment_method": data.payment_method,
                "metodo_pago_antiguo": data.metodo_pago,
                "debug_info": data.debug_info
            }
        }
    except Exception as e:
        print(f"❌ ERROR en schema flexible: {e}")
        raise HTTPException(status_code=500, detail=f"Error en validación flexible: {str(e)}")

@router.post("/test-validacion")
def test_validacion_metodo_pago(data: OrdenTrabajoCreateSchema):
    """Endpoint de prueba para validar el schema"""
    try:
        print(f"🧪 TEST: Datos recibidos en endpoint de prueba:")
        print(f"  - presupuesto_id: {data.presupuesto_id}")
        print(f"  - seña_pagada: {data.seña_pagada}")
        print(f"  - payment_method: '{data.payment_method}' (tipo: {type(data.payment_method)})")
        
        return {
            "message": "Validación exitosa",
            "success": True,
            "data": {
                "presupuesto_id": data.presupuesto_id,
                "seña_pagada": data.seña_pagada,
                "payment_method": data.payment_method,
                "tipo_payment_method": str(type(data.payment_method))
            }
        }
    except Exception as e:
        print(f"❌ ERROR en endpoint de prueba: {e}")
        raise HTTPException(status_code=500, detail=f"Error en validación: {str(e)}")

@router.post("/", response_model=OrdenTrabajoResponseSchema)
def convertir_presupuesto_orden(data: OrdenTrabajoCreateSchema, current_user=Depends(get_current_user)):
    try:
        print(f"🔍 DEBUG: Datos recibidos en controlador:")
        print(f"  - presupuesto_id: {data.presupuesto_id}")
        print(f"  - seña_pagada: {data.seña_pagada}")
        print(f"  - payment_method: '{data.payment_method}' (tipo: {type(data.payment_method)})")
        print(f"  - metodo_pago: '{data.metodo_pago}' (tipo: {type(data.metodo_pago)})")
        print(f"🔍 DEBUG: Datos completos recibidos: {data}")
        
        # Usar payment_method si está presente, sino metodo_pago
        metodo_pago_final = data.payment_method if data.payment_method else data.metodo_pago
        
        if not metodo_pago_final:
            raise HTTPException(status_code=400, detail="Debe proporcionar payment_method o metodo_pago")
        
        resultado = servicio.crear_orden_trabajo(data.presupuesto_id, data.seña_pagada, metodo_pago_final, current_user.id)
        return resultado
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ ERROR inesperado en controlador: {e}")
        raise HTTPException(status_code=500, detail=f"Error inesperado al crear orden de trabajo: {str(e)}")

@router.get("/")
def get_ordenes_trabajo(current_user=Depends(get_current_user)):
    try:
        return servicio.listar_ordenes_trabajo()
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener órdenes de trabajo: {str(e)}")

@router.get("/{orden_id}")
def obtener_orden_por_id(orden_id: int, current_user=Depends(get_current_user)):
    try:
        return servicio.obtener_orden_por_id(orden_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener orden de trabajo: {str(e)}")

@router.get("/semana/{fecha_base}")
def obtener_ordenes_semana(fecha_base: str, current_user=Depends(get_current_user)):
    try:
        fecha = datetime.fromisoformat(fecha_base)
        return servicio.obtener_ordenes_para_semana(fecha)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use ISO format (YYYY-MM-DD)")
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener órdenes de la semana: {str(e)}")

@router.put("/{orden_id}/estado")
def actualizar_estado_orden(orden_id: int, nuevo_estado: str, current_user=Depends(get_current_user)):
    try:
        return servicio.actualizar_estado_orden(orden_id, nuevo_estado)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al actualizar estado de orden: {str(e)}")

@router.post("/{orden_id}/pagar-saldo")
def pagar_saldo_pendiente(
    orden_id: int, 
    pago_data: PagoSaldoPendienteSchema,
    current_user=Depends(get_current_user)
):
    """Registrar el pago del saldo pendiente de una orden de trabajo"""
    try:
        return servicio.registrar_pago_saldo(
            orden_id, 
            pago_data.monto_pagado, 
            pago_data.payment_method, 
            current_user.id
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al registrar pago: {str(e)}")

@router.get("/{orden_id}/historial-pagos")
def obtener_historial_pagos(orden_id: int, current_user=Depends(get_current_user)):
    """Obtener el historial de pagos de una orden de trabajo"""
    try:
        return servicio.obtener_historial_pagos(orden_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener historial de pagos: {str(e)}")

