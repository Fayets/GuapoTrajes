from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict, ValidationInfo
from typing import List, Optional, Dict, Literal
from datetime import date, datetime

from src.fechas_ar import parse_fecha_presupuesto_entrada
from src.models import Roles, Sucursal, MetodoPago

Role = Literal["SUPER_ADMIN", "ADMIN", "EMPLEADO"]
class UsuarioOut(BaseModel):
    id: int
    email: str
    rol: Role
    sucursal_nombre: Optional[str] = None
    sucursal_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

#SUCURSALES
class SucursalCreate(BaseModel):
    nombre: str
    direccion: str
    provincia: str

class SucursalResponse(SucursalCreate):
    id: int

# RESPUESTA DE ACTUALIZACIÓN DE SUCURSAL
class SucursalUpdateResponse(BaseModel):
    message: str
    success: bool
    data: SucursalResponse

# CUENTAS DESTINO
class CuentaDestinoCreate(BaseModel):
    sucursal_id: int
    nombre_titular: str

class CuentaDestinoUpdate(BaseModel):
    nombre_titular: Optional[str] = None
    activa: Optional[bool] = None

class CuentaDestinoResponse(BaseModel):
    id: int
    sucursal_id: int
    nombre_titular: str
    activa: bool

    model_config = ConfigDict(from_attributes=True)

class CuentaDestinoUpdateResponse(BaseModel):
    message: str
    success: bool
    data: CuentaDestinoResponse

# MÉTODOS DE PAGO CONFIGURABLES
class SubmetodoPagoCreate(BaseModel):
    metodo_pago_id: int
    nombre: str
    activo: Optional[bool] = True
    orden: Optional[int] = 0

class SubmetodoPagoUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None
    orden: Optional[int] = None

class SubmetodoPagoResponse(BaseModel):
    id: int
    metodo_pago_id: int
    nombre: str
    activo: bool
    orden: int
    fecha_creacion: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class MetodoPagoConfigurableCreate(BaseModel):
    sucursal_id: int
    nombre: str
    activo: Optional[bool] = True
    tiene_submetodos: Optional[bool] = False
    orden: Optional[int] = 0

class MetodoPagoConfigurableUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None
    tiene_submetodos: Optional[bool] = None
    orden: Optional[int] = None

class MetodoPagoConfigurableResponse(BaseModel):
    id: int
    sucursal_id: int
    nombre: str
    activo: bool
    tiene_submetodos: bool
    orden: int
    fecha_creacion: Optional[datetime] = None
    submétodos: List[SubmetodoPagoResponse] = []

    model_config = ConfigDict(from_attributes=True)

class MetodoPagoConfigurableListResponse(BaseModel):
    message: str
    success: bool
    data: List[MetodoPagoConfigurableResponse]

class MetodoPagoConfigurableSingleResponse(BaseModel):
    message: str
    success: bool
    data: MetodoPagoConfigurableResponse

class SubmetodoPagoListResponse(BaseModel):
    message: str
    success: bool
    data: List[SubmetodoPagoResponse]

class SubmetodoPagoSingleResponse(BaseModel):
    message: str
    success: bool
    data: SubmetodoPagoResponse

#USUARIOS
class BaseUser(BaseModel):
    username: str
    email: str
    nombre: str
    apellido: str
    role: Roles
    sucursal: int

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

class UserCreate(BaseUser):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Roles] = None
    sucursal: Optional[int] = None

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    nombre: str
    apellido: str
    rol: str
    sucursal_id: int
    sucursal_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class UserListResponse(BaseModel):
    message: str
    success: bool
    data: List[UserResponse]

class UserSingleResponse(BaseModel):
    message: str
    success: bool
    data: UserResponse

#LOGIN
class LoginRequest(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str

class TokenVerificationRequest(BaseModel):
    token: str

# Catálogos de atributos de producto (config)
class ProductoLineaCreate(BaseModel):
    nombre: str
    codigo: str

class ProductoLineaResponse(BaseModel):
    id: int
    nombre: str
    codigo: str
    model_config = ConfigDict(from_attributes=True)

class ProductoTalleCreate(BaseModel):
    nombre: str
    codigo: str

class ProductoTalleResponse(BaseModel):
    id: int
    nombre: str
    codigo: str
    model_config = ConfigDict(from_attributes=True)

class ProductoTelaCreate(BaseModel):
    nombre: str
    codigo: str

class ProductoTelaResponse(BaseModel):
    id: int
    nombre: str
    codigo: str
    model_config = ConfigDict(from_attributes=True)

class ProductoColorCreate(BaseModel):
    nombre: str
    codigo: str

class ProductoColorResponse(BaseModel):
    id: int
    nombre: str
    codigo: str
    model_config = ConfigDict(from_attributes=True)


#PRODUCTOS

class ProductBase(BaseModel):
    # El código de barras se genera en backend; no se exige en creación.
    codigo_barra: Optional[str] = None
    # La descripción puede venir vacía; el backend la genera a partir de los atributos.
    descripcion: Optional[str] = None
    linea_id: Optional[int] = None
    tela_id: Optional[int] = None
    talle_id: Optional[int] = None
    color_id: Optional[int] = None
    costo: float
    precio_alquiler_lista: float
    precio_alquiler_efectivo: float
    precio_venta_nuevo_lista: float
    precio_venta_nuevo_efectivo: float
    precio_de_venta_medio_uso: float
    precio_venta: float
    precio_liquidacion: float
    stock: int
    stock_minimo: int
    fecha_alta: date
    estado: str
    sucursal_id: int
    inmovilizado: bool
    veces_alquilado: int = 0

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int
    linea_nombre: Optional[str] = None
    talle_nombre: Optional[str] = None
    tela_nombre: Optional[str] = None
    color_nombre: Optional[str] = None
    destino_tipo: Optional[str] = None
    destino_nombre: Optional[str] = None
    destino_notas: Optional[str] = None
    destino_cliente_nombre: Optional[str] = None
    destino_cliente_celular: Optional[str] = None
    # Si el cliente envía fecha_retiro + fecha_devolucion en GET /productos/all
    disponible_en_fechas: Optional[bool] = None
    # Si incluir_ventana_reserva=1: hoy está en [R-5,R] (presupuesto u orden)
    en_ventana_reserva_hoy: Optional[bool] = None

class ProductUpdateResponse(BaseModel):
    message: str
    success: bool
    data: ProductResponse

class ProductUpdate(BaseModel):
    codigo_barra: Optional[str] = None
    linea_id: Optional[int] = None
    talle_id: Optional[int] = None
    tela_id: Optional[int] = None
    color_id: Optional[int] = None
    descripcion: Optional[str] = None
    costo: Optional[float] = None
    precio_alquiler_lista: Optional[float] = None
    precio_alquiler_efectivo: Optional[float] = None
    precio_venta_nuevo_lista: Optional[float] = None
    precio_venta_nuevo_efectivo: Optional[float] = None
    precio_de_venta_medio_uso: Optional[float] = None
    precio_venta: Optional[float] = None
    precio_liquidacion: Optional[float] = None
    stock: Optional[int] = None
    stock_minimo: Optional[int] = None
    estado: Optional[str] = None
    sucursal_id: Optional[int] = None  # Se actualiza la FK si es necesario
    inmovilizado: Optional[bool] = None


#Clientes
class ClientCreate(BaseModel):
    nombre: str
    apellido: str
    dni: str
    direccion: str
    celular: str
    notas: str

class ClientResponse(ClientCreate):
    id: int

class ClientUpdateResponse(BaseModel):
    message: str
    success: bool
    data: ClientResponse

#Preclientes
class PreclientCreate(BaseModel):
    nombre: str
    apellido: str
    celular: str

class PreclientResponse(PreclientCreate):
    id: int

class PreclientUpdateResponse(BaseModel):
    message: str
    success: bool
    data: PreclientResponse

class ConvertirPreclienteRequest(BaseModel):
    direccion: str
    dni: str

#Evento
class EventoCreate(BaseModel):
    nombre: str

class EventoResponse(BaseModel):
    id: int
    nombre: str


#Lavanderia
class LavanderiaCreate(BaseModel):
    nombre: str
    direccion: str
    telefono: str

class LavanderiaResponse(BaseModel):
    id: int
    nombre: str
    direccion: str
    telefono: str

class RegresoProductoLavanderiaResponse(BaseModel):
    fecha_ingreso: Optional[date] = None 
    fecha_salida: Optional[date] = None
    estado: Optional[str] = None  

# Modistas

class ModistaCreate(BaseModel):
    nombre: str
    direccion: str
    telefono: str

class ModistaResponse(BaseModel):
    id: int
    nombre: str
    direccion: str
    telefono: str

class RegresoProductoModistaResponse(BaseModel):
    fecha_ingreso: Optional[date] = None
    fecha_salida: Optional[date] = None
    estado: Optional[str] = None


# --- PRESUPUESTOS ---
class ItemPresupuestoIn(BaseModel):
    producto_id: int
    cantidad: int
    precio_unitario: float
    subtotal: float

class PresupuestoCreate(BaseModel):
    cliente_id: Optional[int] = None
    precliente_id: Optional[int] = None
    fecha_evento: date
    fecha_retiro: Optional[date]
    fecha_devolucion: Optional[date]
    categoria_evento: Optional[str]
    nombre_agasajado: Optional[str]
    lugar_evento: Optional[str]
    observaciones: Optional[str]
    items: List[ItemPresupuestoIn]
    # Campos de descuento extra
    extra_discount_percentage: Optional[float] = None
    extra_discount_amount: Optional[float] = None
    extra_discount_reason: Optional[str] = None

    @field_validator("fecha_evento", "fecha_retiro", "fecha_devolucion", mode="before")
    @classmethod
    def fechas_calendario_negocio(cls, v, info: ValidationInfo):
        field = info.field_name
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            if field == "fecha_evento":
                raise ValueError("fecha_evento no puede estar vacía")
            return None
        return parse_fecha_presupuesto_entrada(v)

    @model_validator(mode="after")
    def cliente_o_precliente(self):
        if self.cliente_id is None and self.precliente_id is None:
            raise ValueError("Se debe indicar cliente_id o precliente_id")
        if self.cliente_id is not None and self.precliente_id is not None:
            raise ValueError("Solo se debe indicar cliente_id o precliente_id, no ambos")
        return self

class ItemPresupuestoOut(BaseModel):
    producto_id: int
    descripcion: str
    cantidad: int
    precio_unitario: float
    subtotal: float

    model_config = ConfigDict(from_attributes=True)

class ItemPresupuestoResponse(BaseModel):
    id: int
    producto_id: int
    producto_descripcion: str
    cantidad: int
    precio_unitario: float
    subtotal: float

class PresupuestoResponse(BaseModel):
    id: int
    numero: str
    cliente_id: Optional[int] = None
    precliente_id: Optional[int] = None
    cliente_nombre: str
    es_precliente: bool = False
    cliente_dni: Optional[str] = None
    cliente_direccion: Optional[str] = None
    cliente_celular: Optional[str] = None
    fecha_evento: str
    fecha_retiro: Optional[str]
    fecha_devolucion: Optional[str]
    categoria_evento: Optional[str]
    nombre_agasajado: Optional[str]
    lugar_evento: Optional[str]
    observaciones: str
    total: float
    estado: str
    fecha_creacion: Optional[str] = None
    items: List[ItemPresupuestoResponse]
    seña_pagada: Optional[float] = None
    metodo_pago: Optional[str] = None  # Cambiado de MetodoPago enum a str para soportar métodos configurables
    # Campos de descuento extra
    extra_discount_percentage: Optional[float] = None
    extra_discount_amount: Optional[float] = None
    extra_discount_reason: Optional[str] = None
    extra_discount_applied_by_id: Optional[int] = None
    extra_discount_applied_by_nombre: Optional[str] = None
    extra_discount_created_at: Optional[str] = None
    orden_id: Optional[int] = None


class ConjuntoMismaFechaCategoriaOut(BaseModel):
    """Resumen de un presupuesto existente para avisar conjuntos ya armados (misma fecha y categoría)."""

    presupuesto_id: int
    numero: str
    nombre_agasajado: str
    lugar_evento: Optional[str] = None
    productos: List[str]


# --- ORDEN DE TRABAJO ---
class ProductoReservadoSchema(BaseModel):
    producto_id: int
    estado: str
    fecha_bloqueo: date
    observaciones: Optional[str] = None

class OrdenTrabajoCreateSchema(BaseModel):
    presupuesto_id: int
    seña_pagada: float = Field(..., gt=0, description="Monto de la seña inicial")
    payment_method: Optional[str] = Field(None, description="Método de pago: EFECTIVO, DEBITO, CREDITO, BILLETERA_VIRTUAL, TRANSFERENCIA (compatibilidad)")
    metodo_pago: Optional[str] = Field(None, description="Campo alternativo para compatibilidad")
    metodo_pago_id: Optional[int] = Field(None, description="ID del método de pago configurable")
    submetodo_pago_id: Optional[int] = Field(None, description="ID del submétodo de pago (opcional, solo si el método tiene submétodos)")
    cuenta_destino_id: int = Field(..., description="ID de la cuenta destino (obligatoria)")

    @field_validator('payment_method', 'metodo_pago', mode='before')
    @classmethod
    def validate_payment_method(cls, v, info):
        if v is not None:
            return v
        return None

    @model_validator(mode='after')
    def validate_payment_method_present(self):
        # Debe tener o el método antiguo o el nuevo configurable
        has_old_method = self.payment_method or self.metodo_pago
        has_new_method = self.metodo_pago_id is not None
        
        if not has_old_method and not has_new_method:
            raise ValueError('Debe proporcionar payment_method/metodo_pago (compatibilidad) o metodo_pago_id (nuevo sistema)')
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "presupuesto_id": 1,
                "seña_pagada": 100.0,
                "payment_method": "EFECTIVO"
            }
        }
    )

class OrdenTrabajoResponseSchema(BaseModel):
    message: str
    success: bool
    data: dict

class OrdenTrabajoCreateSchemaTest(BaseModel):
    """Schema de prueba para diagnosticar problemas"""
    presupuesto_id: int
    seña_pagada: float
    payment_method: str
    # Campos opcionales para debug
    metodo_pago: Optional[str] = None  # Campo antiguo por si acaso
    debug_info: Optional[dict] = None

class PagoSaldoPendienteSchema(BaseModel):
    monto_pagado: float = Field(..., gt=0, description="Monto a pagar del saldo pendiente")
    payment_method: Optional[str] = Field(None, description="Compatibilidad: Método de pago: EFECTIVO, DEBITO, CREDITO, BILLETERA_VIRTUAL, TRANSFERENCIA")
    metodo_pago_id: Optional[int] = Field(None, description="ID del método de pago configurable")
    submetodo_pago_id: Optional[int] = Field(None, description="ID del submétodo de pago (opcional)")
    cuenta_destino_id: int = Field(..., description="ID de la cuenta destino (obligatoria)")
    motivo_recibo: Optional[str] = Field(None, description="Motivo del recibo: Seña, Alquilado, Cancelación, etc.")

    @model_validator(mode='after')
    def validate_payment_method_present(self):
        has_old_method = self.payment_method is not None
        has_new_method = self.metodo_pago_id is not None
        
        if not has_old_method and not has_new_method:
            raise ValueError('Debe proporcionar payment_method (compatibilidad) o metodo_pago_id (nuevo sistema)')
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "monto_pagado": 50.0,
                "metodo_pago_id": 1,
                "submetodo_pago_id": 2
            }
        }
    )

class CompletarDevolucionSchema(BaseModel):
    """Destino de los productos al completar la devolución."""
    destino: Literal["SALON", "LAVANDERIA", "MODISTA"] = Field(..., description="Estado destino: SALON, LAVANDERIA o MODISTA")
    lavanderia_id: Optional[int] = Field(None, description="ID de lavandería (obligatorio si destino=LAVANDERIA)")
    modista_id: Optional[int] = Field(None, description="ID de modista (obligatorio si destino=MODISTA)")


class DevolucionParcialSchema(BaseModel):
    productos_ids: List[int] = Field(..., description="Lista de IDs de productos a devolver parcialmente")
    descripcion: str = Field(..., min_length=1, description="Descripción del motivo de la devolución parcial")
    destino: Literal["SALON", "LAVANDERIA", "MODISTA"] = Field(..., description="Estado destino de las prendas devueltas")
    lavanderia_id: Optional[int] = Field(None, description="ID de lavandería (obligatorio si destino=LAVANDERIA)")
    modista_id: Optional[int] = Field(None, description="ID de modista (obligatorio si destino=MODISTA)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "productos_ids": [1, 2, 3],
                "descripcion": "La camisa tiene una mancha que requiere revisión",
                "destino": "LAVANDERIA",
                "lavanderia_id": 1
            }
        }
    )

class VentaDetalleCreate(BaseModel):
    producto_id: int
    cantidad: int

class VentaCreate(BaseModel):
    cliente_id: int
    sucursal_id: int
    tipo_precio: str  # Debe ser uno de: Lista, Efectivo, Medio Uso, Liquidacion
    payment_method: Optional[str] = None  # Compatibilidad hacia atrás: EFECTIVO, DEBITO, CREDITO, BILLETERA_VIRTUAL
    metodo_pago_id: Optional[int] = None  # ID del método de pago configurable
    submetodo_pago_id: Optional[int] = None  # ID del submétodo de pago (opcional, solo si el método tiene submétodos)
    productos: List[VentaDetalleCreate]
    cuenta_destino_id: int  # Cuenta destino obligatoria
    # Campos de descuento extra
    extra_discount_percentage: Optional[float] = None
    extra_discount_amount: Optional[float] = None
    extra_discount_reason: Optional[str] = None
    
    @model_validator(mode='after')
    def validate_payment_method_present(self):
        # Debe tener o el método antiguo o el nuevo configurable
        has_old_method = self.payment_method is not None
        has_new_method = self.metodo_pago_id is not None
        
        if not has_old_method and not has_new_method:
            raise ValueError('Debe proporcionar payment_method (compatibilidad) o metodo_pago_id (nuevo sistema)')
        return self

class ProductoVentaOut(BaseModel):
    producto_id: int
    codigo: str
    descripcion: str
    cantidad: int
    precio_unitario: float
    subtotal: float

class VentaOut(BaseModel):
    id: int
    fecha_hora: str  # Cambiado a str porque se envía como string formateado
    total: float
    tipo_precio: str
    payment_method: str
    cliente_id: int
    cliente_nombre: str
    sucursal_id: int
    sucursal_nombre: str
    usuario_id: int
    usuario_nombre: Optional[str] = None  # Nombre del usuario que realizó la venta
    cuenta_destino_id: Optional[int] = None  # ID de la cuenta destino
    cuenta_destino_nombre: Optional[str] = None  # Nombre del titular de la cuenta destino
    productos: List[ProductoVentaOut]
    # Campos de descuento extra
    extra_discount_percentage: Optional[float] = None
    extra_discount_amount: Optional[float] = None
    extra_discount_reason: Optional[str] = None
    extra_discount_applied_by_id: Optional[int] = None
    extra_discount_applied_by_nombre: Optional[str] = None
    extra_discount_created_at: Optional[datetime] = None

# PAGOS
class PagoAdicionalRequest(BaseModel):
    presupuesto_id: int
    monto: float
    metodo_pago: Optional[str] = None  # Compatibilidad hacia atrás
    metodo_pago_id: Optional[int] = None  # ID del método de pago configurable
    submetodo_pago_id: Optional[int] = None  # ID del submétodo de pago (opcional)
    concepto: str = "Pago adicional"
    cuenta_destino_id: int  # Cuenta destino obligatoria
    
    @model_validator(mode='after')
    def validate_payment_method_present(self):
        has_old_method = self.metodo_pago is not None
        has_new_method = self.metodo_pago_id is not None
        
        if not has_old_method and not has_new_method:
            raise ValueError('Debe proporcionar metodo_pago (compatibilidad) o metodo_pago_id (nuevo sistema)')
        return self

# CAJA
class CajaMovimientoCreate(BaseModel):
    tipo: str  # INGRESO, EGRESO, AJUSTE_NEGATIVO, AJUSTE_POSITIVO
    monto: float
    payment_method: Optional[str] = None  # Compatibilidad: EFECTIVO, DEBITO, CREDITO, BILLETERA_VIRTUAL
    metodo_pago_id: Optional[int] = None  # ID del método de pago configurable
    submetodo_pago_id: Optional[int] = None  # ID del submétodo de pago (opcional)
    origen: str
    categoria: Optional[str] = None  # Categoría del movimiento
    venta_id: Optional[int] = None
    cuenta_destino_id: Optional[int] = None  # Cuenta destino (obligatoria para INGRESO)
    sucursal_id: int

class CajaMovimientoOut(BaseModel):
    id: int
    fecha_hora: datetime
    tipo: str
    monto: float
    payment_method: Optional[str] = None
    origen: str
    categoria: Optional[str] = None
    venta_id: Optional[int] = None
    usuario_id: int
    usuario_nombre: str
    sucursal_id: int
    sucursal_nombre: str

class CajaReporteRequest(BaseModel):
    fecha_desde: date
    fecha_hasta: date
    payment_method: Optional[str] = None
    sucursal_id: Optional[int] = None

class CajaReporteResponse(BaseModel):
    resumen_por_metodo: List[dict]
    total_general: float
    movimientos: List[CajaMovimientoOut]

class CajaChicaMovimientoBase(BaseModel):
    sucursal_id: Optional[int] = None
    monto: float
    descripcion: Optional[str] = None
    metodo_pago: Optional[str] = Field(default="EFECTIVO", description="EFECTIVO, DEBITO, CREDITO, TRANSFERENCIA, OTROS")
    tipo_egreso: Optional[str] = Field(
        default=None,
        description="ADMINISTRATIVO, COMERCIAL, OPERATIVO, OTROS. Solo aplica para egresos."
    )
    estado: Optional[str] = Field(default="PENDIENTE", description="PENDIENTE, APROBADO, RECHAZADO")

class CajaChicaMovimientoCreate(CajaChicaMovimientoBase):
    tipo_movimiento: str = Field(default="EGRESO", pattern="^(INGRESO|EGRESO)$")

class CajaChicaMovimientoUpdate(BaseModel):
    monto: Optional[float] = None
    descripcion: Optional[str] = None
    metodo_pago: Optional[str] = None
    tipo_egreso: Optional[str] = None
    estado: Optional[str] = None

class CajaChicaMovimientoResponse(BaseModel):
    id: int
    sucursal_id: int
    usuario_id: int
    usuario_nombre: str
    fecha: datetime
    tipo_movimiento: str
    metodo_pago: str
    tipo_egreso: Optional[str]
    monto: float
    descripcion: Optional[str]
    estado: str
    referencia: Optional[str] = None
    caja_movimiento_id: Optional[int] = None
    caja_diaria_id: Optional[int] = None
    etiqueta: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class TransferenciaCajaChicaRequest(BaseModel):
    sucursal_id: int
    monto: float
    descripcion: Optional[str] = None

class CajaReporteEgresosResponse(BaseModel):
    resumen_por_categoria: Dict[str, float]
    total_general: float
    movimientos: List[dict]

class BalanceFinancieroResponse(BaseModel):
    fecha_desde: date
    fecha_hasta: date
    total_ingresos: float
    total_egresos: float
    balance: float
    balance_porcentual: float
    resumen_ingresos: Dict[str, float]
    resumen_egresos: Dict[str, float]

class SaldoPendienteCliente(BaseModel):
    presupuesto_id: int
    cliente_id: int
    cliente_nombre: str
    cliente_dni: str
    fecha_creacion: datetime
    total_presupuesto: float
    pagos_realizados: float
    saldo_pendiente: float
    sucursal_nombre: str
    estado: str

class SaldosPendientesResponse(BaseModel):
    fecha_desde: date
    fecha_hasta: date
    sucursal_id: int
    total_clientes: int
    total_saldo_pendiente: float
    saldos: List[SaldoPendienteCliente]

class BusquedaMovimientosResponse(BaseModel):
    texto_busqueda: str
    sucursal_id: int
    fecha_desde: Optional[date]
    fecha_hasta: Optional[date]
    total_resultados: int
    movimientos: List[dict]