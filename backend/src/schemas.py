from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional, Dict, Literal
from datetime import date, datetime
from src.models import Roles, Sucursal, MetodoPago


Role = Literal["ADMIN", "EMPLEADO"]
class UsuarioOut(BaseModel):
    id: int
    email: str
    rol: Role

    class Config:
        orm_mode = True

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

#USUARIOS
class BaseUser(BaseModel):
    username: str
    email: str
    nombre: str
    apellido: str
    role: Roles
    sucursal: int

    class Config:
        from_attributes = True
        use_enum_values = True

class UserCreate(BaseUser):
    password: str

#LOGIN
class LoginRequest(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str

class TokenVerificationRequest(BaseModel):
    token: str

#PRODUCTOS

class ProductBase(BaseModel):
    codigo_barra: str
    descripcion: str
    linea: str
    tela: str
    talle: str
    color: str
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

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int

class ProductUpdateResponse(BaseModel):
    message: str
    success: bool
    data: ProductResponse

class ProductUpdate(BaseModel):
    codigo_barra: Optional[str] = None
    linea: Optional[str] = None
    talle: Optional[str] = None
    tela: Optional[str] = None
    color: Optional[str] = None
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
    cliente_id: int
    fecha_evento: date
    fecha_retiro: Optional[date]
    fecha_devolucion: Optional[date]
    categoria_evento: Optional[str]
    nombre_agasajado: Optional[str]
    lugar_evento: Optional[str]
    observaciones: Optional[str]
    items: List[ItemPresupuestoIn]

class ItemPresupuestoOut(BaseModel):
    producto_id: int
    descripcion: str
    cantidad: int
    precio_unitario: float
    subtotal: float

    class Config:
        from_attributes = True

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
    cliente_id: int
    cliente_nombre: str
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
    metodo_pago: Optional[MetodoPago] = None

# --- ORDEN DE TRABAJO ---
class ProductoReservadoSchema(BaseModel):
    producto_id: int
    estado: str
    fecha_bloqueo: date
    observaciones: Optional[str] = None

class OrdenTrabajoCreateSchema(BaseModel):
    presupuesto_id: int
    seña_pagada: float = Field(..., gt=0, description="Monto de la seña inicial")
    payment_method: Optional[str] = Field(None, description="Método de pago: EFECTIVO, DEBITO, CREDITO, BILLETERA_VIRTUAL, TRANSFERENCIA")
    metodo_pago: Optional[str] = Field(None, description="Campo alternativo para compatibilidad")

    @field_validator('payment_method', 'metodo_pago', mode='before')
    @classmethod
    def validate_payment_method(cls, v, info):
        if v is not None:
            return v
        return None

    @model_validator(mode='after')
    def validate_payment_method_present(self):
        if not self.payment_method and not self.metodo_pago:
            raise ValueError('Debe proporcionar payment_method o metodo_pago')
        return self

    class Config:
        json_schema_extra = {
            "example": {
                "presupuesto_id": 1,
                "seña_pagada": 100.0,
                "payment_method": "EFECTIVO"
            }
        }

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
    payment_method: str = Field(..., description="Método de pago: EFECTIVO, DEBITO, CREDITO, BILLETERA_VIRTUAL, TRANSFERENCIA")

    class Config:
        json_schema_extra = {
            "example": {
                "monto_pagado": 50.0,
                "payment_method": "DEBITO"
            }
        }

class VentaDetalleCreate(BaseModel):
    producto_id: int
    cantidad: int

class VentaCreate(BaseModel):
    cliente_id: int
    sucursal_id: int
    tipo_precio: str  # Debe ser uno de: Lista, Efectivo, Medio Uso, Liquidacion
    payment_method: str  # Debe ser uno de: EFECTIVO, DEBITO, CREDITO, BILLETERA_VIRTUAL
    productos: List[VentaDetalleCreate]

class ProductoVentaOut(BaseModel):
    producto_id: int
    codigo: str
    descripcion: str
    cantidad: int
    precio_unitario: float
    subtotal: float

class VentaOut(BaseModel):
    id: int
    fecha_hora: datetime
    total: float
    tipo_precio: str
    payment_method: str
    cliente_id: int
    cliente_nombre: str
    sucursal_id: int
    sucursal_nombre: str
    usuario_id: int
    productos: List[ProductoVentaOut]

# PAGOS
class PagoAdicionalRequest(BaseModel):
    presupuesto_id: int
    monto: float
    metodo_pago: str
    concepto: str = "Pago adicional"

# CAJA
class CajaMovimientoCreate(BaseModel):
    tipo: str  # INGRESO, EGRESO, AJUSTE_NEGATIVO, AJUSTE_POSITIVO
    monto: float
    payment_method: Optional[str] = None  # EFECTIVO, DEBITO, CREDITO, BILLETERA_VIRTUAL
    origen: str
    categoria: Optional[str] = None  # Categoría del movimiento
    venta_id: Optional[int] = None
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