"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, ArrowUp, ArrowDown, AlertTriangle, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// Tipos
type Categoria = {
  id: string
  nombre: string
}

type Producto = {
  id: string
  codigo: string
  nombre: string
  categoriaId: string
  categoriaNombre: string
  stock: number
  stockMinimo: number
  precio: number
}

type MovimientoStock = {
  id: string
  fecha: Date
  productoId: string
  productoNombre: string
  tipo: "entrada" | "salida"
  cantidad: number
  motivo: string
  usuario: string
  observaciones: string
}

// Datos de ejemplo
const categoriasEjemplo: Categoria[] = [
  { id: "1", nombre: "Trajes" },
  { id: "2", nombre: "Camisas" },
  { id: "3", nombre: "Pantalones" },
  { id: "4", nombre: "Accesorios" },
]

const productosEjemplo: Producto[] = [
  {
    id: "1",
    codigo: "TRJ-001",
    nombre: "Traje Slim Fit Negro",
    categoriaId: "1",
    categoriaNombre: "Trajes",
    stock: 10,
    stockMinimo: 3,
    precio: 120000,
  },
  {
    id: "2",
    codigo: "CAM-001",
    nombre: "Camisa Formal Blanca",
    categoriaId: "2",
    categoriaNombre: "Camisas",
    stock: 2,
    stockMinimo: 5,
    precio: 35000,
  },
  {
    id: "3",
    codigo: "ACC-001",
    nombre: "Corbata Seda Azul",
    categoriaId: "4",
    categoriaNombre: "Accesorios",
    stock: 30,
    stockMinimo: 10,
    precio: 15000,
  },
  {
    id: "4",
    codigo: "PAN-001",
    nombre: "Pantalón Vestir Negro",
    categoriaId: "3",
    categoriaNombre: "Pantalones",
    stock: 15,
    stockMinimo: 5,
    precio: 45000,
  },
]

const movimientosEjemplo: MovimientoStock[] = [
  {
    id: "1",
    fecha: new Date(2023, 3, 15, 10, 30),
    productoId: "1",
    productoNombre: "Traje Slim Fit Negro",
    tipo: "entrada",
    cantidad: 5,
    motivo: "Compra",
    usuario: "Admin",
    observaciones: "Compra a proveedor Textiles SA",
  },
  {
    id: "2",
    fecha: new Date(2023, 3, 15, 14, 20),
    productoId: "1",
    productoNombre: "Traje Slim Fit Negro",
    tipo: "salida",
    cantidad: 1,
    motivo: "Venta",
    usuario: "Admin",
    observaciones: "Venta a cliente Juan Pérez",
  },
  {
    id: "3",
    fecha: new Date(2023, 3, 16, 9, 15),
    productoId: "2",
    productoNombre: "Camisa Formal Blanca",
    tipo: "salida",
    cantidad: 3,
    motivo: "Venta",
    usuario: "Admin",
    observaciones: "Venta a cliente María López",
  },
]

export default function StockPage() {
  const [productos, setProductos] = useState<Producto[]>(productosEjemplo)
  const [movimientos, setMovimientos] = useState<MovimientoStock[]>(movimientosEjemplo)
  const [busqueda, setBusqueda] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState("")
  const [tabActiva, setTabActiva] = useState("todos")
  const [dialogoMovimiento, setDialogoMovimiento] = useState(false)
  const [dialogoHistorial, setDialogoHistorial] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)

  // Estado para el formulario de movimiento
  const [formData, setFormData] = useState({
    tipo: "entrada",
    cantidad: "",
    motivo: "",
    observaciones: "",
  })

  // Filtrar productos por búsqueda, categoría y tab activa
  const productosFiltrados = productos.filter((producto) => {
    const coincideBusqueda =
      producto.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      producto.nombre.toLowerCase().includes(busqueda.toLowerCase())

    const coincideCategoria = !categoriaFiltro || producto.categoriaId === categoriaFiltro

    if (tabActiva === "todos") return coincideBusqueda && coincideCategoria
    if (tabActiva === "criticos") return coincideBusqueda && coincideCategoria && producto.stock <= producto.stockMinimo

    return false
  })

  // Filtrar movimientos por producto seleccionado
  const movimientosFiltrados = productoSeleccionado
    ? movimientos.filter((m) => m.productoId === productoSeleccionado.id)
    : []

  // Estadísticas de stock
  const estadisticas = {
    totalProductos: productos.length,
    productosCriticos: productos.filter((p) => p.stock <= p.stockMinimo).length,
    valorTotal: productos.reduce((sum, p) => sum + p.stock * p.precio, 0),
  }

  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Manejar cambio de select
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Abrir formulario para nuevo movimiento
  const nuevoMovimiento = (producto: Producto, tipo: "entrada" | "salida") => {
    setProductoSeleccionado(producto)
    setFormData({
      tipo,
      cantidad: "",
      motivo: tipo === "entrada" ? "Compra" : "Venta",
      observaciones: "",
    })
    setDialogoMovimiento(true)
  }

  // Abrir historial de movimientos
  const verHistorial = (producto: Producto) => {
    setProductoSeleccionado(producto)
    setDialogoHistorial(true)
  }

  // Guardar movimiento
  const guardarMovimiento = () => {
    if (!productoSeleccionado || !formData.cantidad || !formData.motivo) {
      alert("Todos los campos son obligatorios")
      return
    }

    const cantidad = Number.parseInt(formData.cantidad)
    if (isNaN(cantidad) || cantidad <= 0) {
      alert("La cantidad debe ser un número positivo")
      return
    }

    // Validar que haya suficiente stock para salidas
    if (formData.tipo === "salida" && cantidad > productoSeleccionado.stock) {
      alert("No hay suficiente stock para realizar esta salida")
      return
    }

    // Crear nuevo movimiento
    const nuevoId = (Math.max(...movimientos.map((m) => Number.parseInt(m.id))) + 1).toString()
    const nuevoMovimiento: MovimientoStock = {
      id: nuevoId,
      fecha: new Date(),
      productoId: productoSeleccionado.id,
      productoNombre: productoSeleccionado.nombre,
      tipo: formData.tipo as "entrada" | "salida",
      cantidad,
      motivo: formData.motivo,
      usuario: "Admin", // En un caso real, esto vendría del usuario logueado
      observaciones: formData.observaciones,
    }

    setMovimientos([...movimientos, nuevoMovimiento])

    // Actualizar stock del producto
    setProductos(
      productos.map((p) =>
        p.id === productoSeleccionado.id
          ? {
              ...p,
              stock: formData.tipo === "entrada" ? p.stock + cantidad : p.stock - cantidad,
            }
          : p,
      ),
    )

    setDialogoMovimiento(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Control de Stock</h1>
          <p className="text-muted-foreground">Gestión de inventario y movimientos de stock</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estadisticas.totalProductos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Productos en Stock Crítico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{estadisticas.productosCriticos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total del Inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${estadisticas.valorTotal.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar productos..."
            className="pl-8"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-4">
          <Select value={categoriaFiltro} onValueChange={(value) => setCategoriaFiltro(value)} className="w-[180px]">
            <option value="">Todas las categorías</option>
            {categoriasEjemplo.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </Select>
          <Tabs value={tabActiva} onValueChange={setTabActiva} className="w-auto">
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="criticos">Stock Crítico</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Stock Actual</TableHead>
              <TableHead>Stock Mínimo</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead className="w-[200px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productosFiltrados.length > 0 ? (
              productosFiltrados.map((producto) => (
                <TableRow key={producto.id}>
                  <TableCell>{producto.codigo}</TableCell>
                  <TableCell className="font-medium">{producto.nombre}</TableCell>
                  <TableCell>{producto.categoriaNombre}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <span className={producto.stock <= producto.stockMinimo ? "text-red-500 font-medium" : ""}>
                        {producto.stock}
                      </span>
                      {producto.stock <= producto.stockMinimo && (
                        <AlertTriangle className="ml-2 h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{producto.stockMinimo}</TableCell>
                  <TableCell>${producto.precio.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => nuevoMovimiento(producto, "entrada")}
                        title="Registrar entrada"
                      >
                        <ArrowUp className="mr-1 h-4 w-4 text-green-600" />
                        Entrada
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => nuevoMovimiento(producto, "salida")}
                        title="Registrar salida"
                        disabled={producto.stock <= 0}
                      >
                        <ArrowDown className="mr-1 h-4 w-4 text-red-600" />
                        Salida
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => verHistorial(producto)} title="Ver historial">
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  No se encontraron productos
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Diálogo para registrar movimiento */}
      <Dialog open={dialogoMovimiento} onOpenChange={setDialogoMovimiento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formData.tipo === "entrada" ? "Registrar Entrada" : "Registrar Salida"} de Stock</DialogTitle>
            <DialogDescription>
              {productoSeleccionado && (
                <span>
                  Producto: <strong>{productoSeleccionado.nombre}</strong> - Stock actual:{" "}
                  <strong>{productoSeleccionado.stock}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Movimiento</Label>
              <Select value={formData.tipo} onValueChange={(value) => handleSelectChange("tipo", value)}>
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cantidad">Cantidad *</Label>
              <Input
                id="cantidad"
                name="cantidad"
                type="number"
                min="1"
                value={formData.cantidad}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo *</Label>
              <Select value={formData.motivo} onValueChange={(value) => handleSelectChange("motivo", value)}>
                <option value="">Seleccione motivo</option>
                {formData.tipo === "entrada" ? (
                  <>
                    <option value="Compra">Compra</option>
                    <option value="Devolución">Devolución</option>
                    <option value="Ajuste">Ajuste de inventario</option>
                    <option value="Otro">Otro</option>
                  </>
                ) : (
                  <>
                    <option value="Venta">Venta</option>
                    <option value="Consumo interno">Consumo interno</option>
                    <option value="Merma">Merma o pérdida</option>
                    <option value="Ajuste">Ajuste de inventario</option>
                    <option value="Otro">Otro</option>
                  </>
                )}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Input
                id="observaciones"
                name="observaciones"
                value={formData.observaciones}
                onChange={handleChange}
                placeholder="Detalles adicionales del movimiento"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoMovimiento(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarMovimiento}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para ver historial de movimientos */}
      <Dialog open={dialogoHistorial} onOpenChange={setDialogoHistorial}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Historial de Movimientos</DialogTitle>
            <DialogDescription>
              {productoSeleccionado && (
                <span>
                  Producto: <strong>{productoSeleccionado.nombre}</strong> - Stock actual:{" "}
                  <strong>{productoSeleccionado.stock}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientosFiltrados.length > 0 ? (
                  movimientosFiltrados.map((movimiento) => (
                    <TableRow key={movimiento.id}>
                      <TableCell>{format(movimiento.fecha, "dd/MM/yyyy HH:mm", { locale: es })}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            movimiento.tipo === "entrada" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }
                        >
                          {movimiento.tipo === "entrada" ? "Entrada" : "Salida"}
                        </Badge>
                      </TableCell>
                      <TableCell>{movimiento.cantidad}</TableCell>
                      <TableCell>{movimiento.motivo}</TableCell>
                      <TableCell>{movimiento.usuario}</TableCell>
                      <TableCell>{movimiento.observaciones || "-"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No hay movimientos registrados para este producto
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setDialogoHistorial(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

