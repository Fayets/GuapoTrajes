from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date
from src.models import Roles, Sucursal

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



