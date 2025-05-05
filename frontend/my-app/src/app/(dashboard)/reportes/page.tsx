"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Download, BarChart3, PieChartIcon, TrendingUp, Calendar } from "lucide-react"
import { format, subDays, subMonths } from "date-fns"
import { es } from "date-fns/locale"

// Datos de ejemplo para los reportes
const ventasPorMes = [
  { name: "Ene", ventas: 1200000 },
  { name: "Feb", ventas: 1500000 },
  { name: "Mar", ventas: 1800000 },
  { name: "Abr", ventas: 2200000 },
  { name: "May", ventas: 1900000 },
  { name: "Jun", ventas: 2500000 },
]

const ventasPorCategoria = [
  { name: "Trajes", value: 45 },
  { name: "Camisas", value: 25 },
  { name: "Pantalones", value: 15 },
  { name: "Accesorios", value: 15 },
]

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"]

const productosVendidos = [
  { id: 1, codigo: "TRJ-001", nombre: "Traje Slim Fit Negro", categoria: "Trajes", cantidad: 15, total: 1800000 },
  { id: 2, codigo: "CAM-001", nombre: "Camisa Formal Blanca", categoria: "Camisas", cantidad: 28, total: 980000 },
  { id: 3, codigo: "ACC-001", nombre: "Corbata Seda Azul", categoria: "Accesorios", cantidad: 22, total: 330000 },
  { id: 4, codigo: "PAN-001", nombre: "Pantalón Vestir Negro", categoria: "Pantalones", cantidad: 18, total: 810000 },
]

const stockCritico = [
  { id: 1, codigo: "CAM-001", nombre: "Camisa Formal Blanca", categoria: "Camisas", stock: 2, stockMinimo: 5 },
  { id: 2, codigo: "TRJ-002", nombre: "Traje Slim Fit Azul", categoria: "Trajes", stock: 1, stockMinimo: 3 },
  { id: 3, codigo: "ACC-002", nombre: "Pañuelo de Bolsillo", categoria: "Accesorios", stock: 4, stockMinimo: 8 },
]

const movimientosCaja = [
  { id: 1, fecha: subDays(new Date(), 2), tipo: "ingreso", concepto: "Venta de traje", monto: 120000 },
  { id: 2, fecha: subDays(new Date(), 2), tipo: "ingreso", concepto: "Anticipo por confección", monto: 50000 },
  { id: 3, fecha: subDays(new Date(), 2), tipo: "egreso", concepto: "Compra de telas", monto: 80000 },
  { id: 4, fecha: subDays(new Date(), 1), tipo: "ingreso", concepto: "Venta de camisas", monto: 70000 },
  { id: 5, fecha: subDays(new Date(), 1), tipo: "egreso", concepto: "Pago de servicios", monto: 25000 },
  { id: 6, fecha: new Date(), tipo: "ingreso", concepto: "Venta de accesorios", monto: 45000 },
]

export default function ReportesPage() {
  const [periodoVentas, setPeriodoVentas] = useState("mes")
  const [fechaInicio, setFechaInicio] = useState(format(subMonths(new Date(), 1), "yyyy-MM-dd"))
  const [fechaFin, setFechaFin] = useState(format(new Date(), "yyyy-MM-dd"))
  const [tabActiva, setTabActiva] = useState("ventas")

  // Calcular totales para el reporte de caja
  const totalIngresos = movimientosCaja.filter((m) => m.tipo === "ingreso").reduce((sum, m) => sum + m.monto, 0)

  const totalEgresos = movimientosCaja.filter((m) => m.tipo === "egreso").reduce((sum, m) => sum + m.monto, 0)

  const saldo = totalIngresos - totalEgresos

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">Visualización de datos y generación de reportes</p>
      </div>

      <Tabs value={tabActiva} onValueChange={setTabActiva}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ventas">
            <BarChart3 className="h-4 w-4 mr-2" />
            Ventas
          </TabsTrigger>
          <TabsTrigger value="productos">
            <PieChartIcon className="h-4 w-4 mr-2" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="stock">
            <TrendingUp className="h-4 w-4 mr-2" />
            Stock
          </TabsTrigger>
          <TabsTrigger value="caja">
            <Calendar className="h-4 w-4 mr-2" />
            Caja
          </TabsTrigger>
        </TabsList>

        {/* Reporte de Ventas */}
        <TabsContent value="ventas" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Select value={periodoVentas} onValueChange={setPeriodoVentas} className="w-[180px]">
                <option value="">Seleccione período</option>
                <option value="mes">Último mes</option>
                <option value="trimestre">Último trimestre</option>
                <option value="semestre">Último semestre</option>
                <option value="anio">Último año</option>
                <option value="personalizado">Personalizado</option>
              </Select>

              {periodoVentas === "personalizado" && (
                <div className="flex items-center space-x-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Desde</span>
                    <Input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Hasta</span>
                    <Input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                </div>
              )}
            </div>

            <Button>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Mes</CardTitle>
                <CardDescription>Evolución de ventas en los últimos meses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={ventasPorMes}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, "Ventas"]} />
                      <Legend />
                      <Bar dataKey="ventas" fill="#8884d8" name="Ventas ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ventas por Categoría</CardTitle>
                <CardDescription>Distribución de ventas por categoría de producto</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ventasPorCategoria}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {ventasPorCategoria.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Productos más Vendidos</CardTitle>
              <CardDescription>Listado de productos con mayor volumen de ventas</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productosVendidos.map((producto) => (
                    <TableRow key={producto.id}>
                      <TableCell>{producto.codigo}</TableCell>
                      <TableCell className="font-medium">{producto.nombre}</TableCell>
                      <TableCell>{producto.categoria}</TableCell>
                      <TableCell>{producto.cantidad}</TableCell>
                      <TableCell>${producto.total.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reporte de Productos */}
        <TabsContent value="productos" className="space-y-4">
          <div className="flex justify-end">
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Productos por Categoría</CardTitle>
              <CardDescription>Distribución de productos por categoría</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ventasPorCategoria}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {ventasPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos más Vendidos</CardTitle>
              <CardDescription>Listado de productos con mayor volumen de ventas</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productosVendidos.map((producto) => (
                    <TableRow key={producto.id}>
                      <TableCell>{producto.codigo}</TableCell>
                      <TableCell className="font-medium">{producto.nombre}</TableCell>
                      <TableCell>{producto.categoria}</TableCell>
                      <TableCell>{producto.cantidad}</TableCell>
                      <TableCell>${producto.total.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reporte de Stock */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex justify-end">
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Productos en Stock Crítico</CardTitle>
              <CardDescription>Productos que requieren reposición urgente</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Stock Actual</TableHead>
                    <TableHead>Stock Mínimo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockCritico.map((producto) => (
                    <TableRow key={producto.id}>
                      <TableCell>{producto.codigo}</TableCell>
                      <TableCell className="font-medium">{producto.nombre}</TableCell>
                      <TableCell>{producto.categoria}</TableCell>
                      <TableCell className="text-red-500 font-medium">{producto.stock}</TableCell>
                      <TableCell>{producto.stockMinimo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Valor de Inventario por Categoría</CardTitle>
              <CardDescription>Distribución del valor del inventario</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ventasPorCategoria}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {ventasPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reporte de Caja */}
        <TabsContent value="caja" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Desde</span>
                <Input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-auto"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Hasta</span>
                <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-auto" />
              </div>
            </div>

            <Button>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Ingresos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">${totalIngresos.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Egresos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">${totalEgresos.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ${saldo.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Movimientos de Caja</CardTitle>
              <CardDescription>Detalle de ingresos y egresos en el período seleccionado</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientosCaja.map((movimiento) => (
                    <TableRow key={movimiento.id}>
                      <TableCell>{format(movimiento.fecha, "dd/MM/yyyy", { locale: es })}</TableCell>
                      <TableCell>
                        <span className={movimiento.tipo === "ingreso" ? "text-green-600" : "text-red-600"}>
                          {movimiento.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{movimiento.concepto}</TableCell>
                      <TableCell className={movimiento.tipo === "ingreso" ? "text-green-600" : "text-red-600"}>
                        ${movimiento.monto.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

