from fastapi import APIRouter, Depends, HTTPException, status, Query
from pony.orm import db_session
from decouple import config
from pydantic import BaseModel
from typing import List, Optional
from enum import Enum
from datetime import datetime, date
import os
import re
import json

from src.models import Roles
from src.deps import require_role, get_current_user

router = APIRouter()

LOG_FILE_PATH = config("SYSTEM_LOG_FILE", default="logs/system.log")

# Categorías de logs disponibles
class LogCategory(str, Enum):
    USUARIOS = "USUARIOS"
    SUCURSALES = "SUCURSALES"
    VENTAS = "VENTAS"
    CAJA = "CAJA"
    PRODUCTOS = "PRODUCTOS"
    CLIENTES = "CLIENTES"
    PRESUPUESTOS = "PRESUPUESTOS"
    ORDENES = "ORDENES"
    SISTEMA = "SISTEMA"
    AUTENTICACION = "AUTENTICACION"
    OTROS = "OTROS"


class LogEntry(BaseModel):
    timestamp: str
    level: str
    category: str
    message: str
    details: Optional[dict] = None
    raw_line: str


class LogsResponse(BaseModel):
    message: str
    total_logs: int
    filtered_logs: int
    logs: List[LogEntry]
    categories: List[str]
    date_range: Optional[dict] = None


def parse_log_line(line: str) -> Optional[LogEntry]:
    """
    Parsea una línea de log y extrae información estructurada.
    Formato esperado: YYYY-MM-DD HH:MM:SS,mmm [LEVEL] name: message
    """
    if not line.strip():
        return None

    # Patrón para parsear logs estándar de Python
    pattern = r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) \[(\w+)\] (\w+): (.+)"
    match = re.match(pattern, line)

    if not match:
        # Si no coincide el patrón, devolver la línea completa
        return LogEntry(
            timestamp=datetime.now().isoformat(),
            level="INFO",
            category="SISTEMA",
            message=line.strip(),
            raw_line=line,
        )

    timestamp_str, level, logger_name, message = match.groups()

    # Intentar extraer categoría del mensaje o logger
    category = "SISTEMA"
    details = None

    # Detectar categoría basada en palabras clave
    message_lower = message.lower()
    if any(word in message_lower for word in ["usuario", "empleado", "creado", "actualizado", "eliminado"]):
        category = "USUARIOS"
    elif any(word in message_lower for word in ["sucursal", "sucursales"]):
        category = "SUCURSALES"
    elif any(word in message_lower for word in ["venta", "ventas"]):
        category = "VENTAS"
    elif any(word in message_lower for word in ["caja", "movimiento"]):
        category = "CAJA"
    elif any(word in message_lower for word in ["producto", "productos"]):
        category = "PRODUCTOS"
    elif any(word in message_lower for word in ["cliente", "clientes"]):
        category = "CLIENTES"
    elif any(word in message_lower for word in ["presupuesto", "presupuestos"]):
        category = "PRESUPUESTOS"
    elif any(word in message_lower for word in ["orden", "ordenes"]):
        category = "ORDENES"
    elif any(word in message_lower for word in ["login", "autenticado", "token"]):
        category = "AUTENTICACION"

    # Intentar extraer JSON del mensaje si existe
    json_match = re.search(r'\{[^}]+\}', message)
    if json_match:
        try:
            details = json.loads(json_match.group())
        except:
            pass

    return LogEntry(
        timestamp=timestamp_str,
        level=level,
        category=category,
        message=message,
        details=details,
        raw_line=line,
    )


@router.get("/system", response_model=LogsResponse)
def get_system_logs(
    current_user=Depends(require_role(Roles.SUPER_ADMIN)),
    categoria: Optional[str] = Query(None, description="Filtrar por categoría"),
    fecha_desde: Optional[date] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[date] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    limit: int = Query(1000, description="Límite de logs a devolver"),
):
    """
    Devuelve los logs del sistema con filtros por categoría y fecha.
    Acceso restringido a SUPER_ADMIN.
    """
    try:
        if not os.path.exists(LOG_FILE_PATH):
            return {
                "message": "Archivo de logs no encontrado",
                "total_logs": 0,
                "filtered_logs": 0,
                "logs": [],
                "categories": [],
            }

        # Leer el archivo completo
        with open(LOG_FILE_PATH, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        # Parsear todas las líneas
        all_logs = []
        for line in lines:
            log_entry = parse_log_line(line)
            if log_entry:
                all_logs.append(log_entry)

        # Aplicar filtros
        filtered_logs = all_logs

        # Filtrar por categoría
        if categoria:
            filtered_logs = [log for log in filtered_logs if log.category == categoria.upper()]

        # Filtrar por fecha
        if fecha_desde or fecha_hasta:
            filtered_by_date = []
            for log in filtered_logs:
                try:
                    # Extraer fecha del timestamp
                    log_date_str = log.timestamp.split()[0]  # YYYY-MM-DD
                    log_date = datetime.strptime(log_date_str, "%Y-%m-%d").date()

                    if fecha_desde and log_date < fecha_desde:
                        continue
                    if fecha_hasta and log_date > fecha_hasta:
                        continue

                    filtered_by_date.append(log)
                except:
                    # Si no se puede parsear la fecha, incluir el log
                    filtered_by_date.append(log)

            filtered_logs = filtered_by_date

        # Limitar resultados
        filtered_logs = filtered_logs[-limit:] if limit > 0 else filtered_logs

        # Obtener categorías únicas
        categories = sorted(list(set(log.category for log in all_logs)))

        date_range = None
        if fecha_desde or fecha_hasta:
            date_range = {
                "desde": fecha_desde.isoformat() if fecha_desde else None,
                "hasta": fecha_hasta.isoformat() if fecha_hasta else None,
            }

        return {
            "message": "OK",
            "total_logs": len(all_logs),
            "filtered_logs": len(filtered_logs),
            "logs": filtered_logs,
            "categories": categories,
            "date_range": date_range,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al leer los logs: {e}",
        )


@router.get("/categories")
def get_log_categories(current_user=Depends(require_role(Roles.SUPER_ADMIN))):
    """
    Devuelve las categorías disponibles de logs.
    """
    return {
        "categories": [cat.value for cat in LogCategory],
    }

