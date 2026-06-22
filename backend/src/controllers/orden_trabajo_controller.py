from fastapi import APIRouter, Depends, HTTPException
from src.schemas import OrdenTrabajoCreateSchema, OrdenTrabajoResponseSchema, ProductoReservadoSchema, ProductoReservadoModistaUpdateSchema, PagoSaldoPendienteSchema, DevolucionParcialSchema, CompletarDevolucionSchema
from src.services.orden_trabajo_services import OrdenTrabajoServices
from pony.orm import db_session
from src.deps import get_current_user, require_role
from fastapi.responses import FileResponse
from src.models import OrdenTrabajo
from datetime import datetime
from typing import List

router = APIRouter(prefix="/ordenes")
servicio = OrdenTrabajoServices()

@router.get("/metodos-pago")
def obtener_metodos_pago(sucursal_id: int = None, current_user=Depends(get_current_user)):
    """Obtener los métodos de pago disponibles (nuevo sistema configurable por sucursal)"""
    try:
        from src.services.metodos_pago_services import MetodosPagoServices
        from src.models import Usuario
        
        usuario = Usuario.get(id=current_user.id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Si no se especifica sucursal_id, usar la del usuario
        if not sucursal_id:
            sucursal_id = usuario.sucursal.id if usuario.sucursal else None
            if not sucursal_id:
                raise HTTPException(status_code=400, detail="No se pudo determinar la sucursal")
        
        servicio_metodos = MetodosPagoServices()
        metodos = servicio_metodos.get_metodos_por_sucursal(sucursal_id, current_user.id)
        
        # Formatear respuesta para compatibilidad con frontend
        metodos_formateados = []
        for metodo in metodos:
            if metodo["tiene_submetodos"]:
                for subm in metodo["submétodos"]:
                    metodos_formateados.append({
                        "value": f"{metodo['nombre']}-{subm['nombre']}",
                        "metodo_id": metodo["id"],
                        "submetodo_id": subm["id"],
                        "label": f"{metodo['nombre']} - {subm['nombre']}",
                        "descripcion": f"Pago con {metodo['nombre']} - {subm['nombre']}"
                    })
            else:
                metodos_formateados.append({
                    "value": metodo["nombre"],
                    "metodo_id": metodo["id"],
                    "submetodo_id": None,
                    "label": metodo["nombre"],
                    "descripcion": f"Pago con {metodo['nombre']}"
                })
        
        return {
            "message": "Métodos de pago obtenidos exitosamente",
            "success": True,
            "data": {
                "metodos": metodos_formateados,
                "metodos_completos": metodos,  # Incluir estructura completa con submétodos
                "total": len(metodos_formateados)
            }
        }
    except Exception as e:
        print(f"❌ Error al obtener métodos de pago: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al obtener métodos de pago: {str(e)}")

@router.post("/", response_model=OrdenTrabajoResponseSchema)
def convertir_presupuesto_orden(data: OrdenTrabajoCreateSchema, current_user=Depends(get_current_user)):
    try:
        credito = float(data.credito_aplicado or 0)
        monto_efectivo = float(data.seña_pagada) - credito

        # Seña íntegramente con saldo a favor: no hay ingreso en caja ni método configurable
        if monto_efectivo <= 1e-9:
            metodo_pago_final = "Saldo a favor (cuenta corriente)"
            metodo_pago_id_arg = None
            submetodo_pago_id_arg = None
        elif data.metodo_pago_id:
            metodo_pago_final = "CONFIGURABLE"  # Placeholder; el servicio usa metodo_pago_id
            metodo_pago_id_arg = data.metodo_pago_id
            submetodo_pago_id_arg = data.submetodo_pago_id
        else:
            metodo_pago_final = data.payment_method if data.payment_method else data.metodo_pago
            if not metodo_pago_final:
                raise HTTPException(
                    status_code=400,
                    detail="Debe proporcionar payment_method/metodo_pago (compatibilidad) o metodo_pago_id (nuevo sistema)",
                )
            metodo_pago_id_arg = None
            submetodo_pago_id_arg = None

        resultado = servicio.crear_orden_trabajo(
            data.presupuesto_id,
            data.seña_pagada,
            metodo_pago_final or "EFECTIVO",
            current_user.id,
            data.cuenta_destino_id,
            metodo_pago_id_arg,
            submetodo_pago_id_arg,
            credito,
            bool(data.conjunto_separado),
        )
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

@router.get("/contratos")
def get_contratos(current_user=Depends(get_current_user)):
    """Listar contratos generados (órdenes con contrato_generado_at)."""
    try:
        return servicio.listar_contratos()
    except HTTPException as e:
        raise e
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("Error al listar contratos")
        return []  # Evitar 500: devolver lista vacía para que la vista cargue

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
        credito = float(pago_data.credito_aplicado or 0)
        monto_efectivo = float(pago_data.monto_pagado) - credito
        payment_compat = (
            "Saldo a favor (cuenta corriente)"
            if monto_efectivo <= 1e-9
            else (pago_data.payment_method or "EFECTIVO")
        )
        return servicio.registrar_pago_saldo(
            orden_id,
            pago_data.monto_pagado,
            payment_compat,
            current_user.id,
            pago_data.cuenta_destino_id,
            pago_data.metodo_pago_id if monto_efectivo > 1e-9 else None,
            pago_data.submetodo_pago_id if monto_efectivo > 1e-9 else None,
            pago_data.motivo_recibo,  # Motivo del recibo (Seña, Alquilado, etc.)
            credito,
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

@router.get("/{orden_id}/recibos")
def obtener_recibos_orden(orden_id: int, current_user=Depends(get_current_user)):
    """Obtener el historial de recibos de una orden (siempre generados por el sistema)."""
    try:
        return servicio.listar_recibos_orden(orden_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al obtener recibos: {str(e)}")

@router.post("/{orden_id}/registrar-etiquetas-armado")
def registrar_etiquetas_armado_impresas(
    orden_id: int, current_user=Depends(get_current_user)
):
    """Registrar que se imprimieron las etiquetas 100x50 al crear la orden (bloquea reimpresión en reportes)."""
    try:
        return servicio.registrar_etiquetas_armado_impresas(orden_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al registrar etiquetas de armado: {str(e)}",
        )


@router.patch("/{orden_id}/productos-reservados/{producto_id}/modista")
def actualizar_modista_producto_reservado(
    orden_id: int,
    producto_id: int,
    data: ProductoReservadoModistaUpdateSchema,
    current_user=Depends(get_current_user),
):
    """Marca una prenda de la orden como pendiente de modista y guarda el detalle del trabajo."""
    try:
        return servicio.actualizar_modista_producto_reservado(
            orden_id,
            producto_id,
            data.requiere_modista,
            data.notas_modista,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al actualizar modista: {str(e)}",
        )


@router.post("/{orden_id}/registrar-contrato")
def registrar_contrato_generado(orden_id: int, current_user=Depends(get_current_user)):
    """Registrar que se generó el contrato para esta orden (cliente, saldo 0, DNI y dirección)."""
    try:
        return servicio.registrar_contrato_generado(orden_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al registrar contrato: {str(e)}")

@router.delete("/{orden_id}", dependencies=[Depends(require_role("ADMIN"))])
def eliminar_orden_trabajo(orden_id: int, current_user=Depends(get_current_user)):
    """Eliminar una orden de trabajo (solo ADMIN). Libera los productos reservados."""
    try:
        return servicio.eliminar_orden_trabajo(orden_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al eliminar orden de trabajo: {str(e)}")

@router.post("/{orden_id}/completar-devolucion")
def completar_devolucion(orden_id: int, data: CompletarDevolucionSchema, current_user=Depends(get_current_user)):
    """Marcar una orden como devolución completada. Los productos pasan al estado indicado (SALON, LAVANDERIA o MODISTA)."""
    try:
        return servicio.completar_devolucion(
            orden_id,
            current_user.id,
            data.destino,
            data.lavanderia_id,
            data.modista_id,
            data.envios,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al completar devolución: {str(e)}")

@router.post("/{orden_id}/devolucion-parcial")
def devolucion_parcial(
    orden_id: int,
    data: DevolucionParcialSchema,
    current_user=Depends(get_current_user)
):
    """Registrar una devolución parcial. Los productos seleccionados pasan al estado indicado (SALON, LAVANDERIA o MODISTA)."""
    try:
        return servicio.registrar_devolucion_parcial(
            orden_id,
            data.productos_ids,
            data.descripcion,
            current_user.id,
            data.destino,
            data.lavanderia_id,
            data.modista_id,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al registrar devolución parcial: {str(e)}")

