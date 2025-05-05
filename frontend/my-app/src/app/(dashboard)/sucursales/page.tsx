"use client"
import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import JsBarcode from "jsbarcode"
import { toast } from "sonner"

interface Producto {
  id: number
  codigo_barra: string
  descripcion: string
  linea: string
  tela: string
  talle: string
  color: string
  costo: number
  precio_alquiler_lista: number
  precio_alquiler_efectivo: number
  precio_venta_nuevo_lista: number
  precio_venta_nuevo_efectivo: number
  precio_de_venta_medio_uso: number
  precio_venta: number
  precio_liquidacion: number
  stock: number
  stock_minimo: number
  fecha_alta: string
  estado: string
  sucursal_id: number
  inmovilizado: boolean
  sucursal?: {
    nombre: string
  }
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [productoActual, setProductoActual] = useState<Partial<Producto> | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [productoEtiqueta, setProductoEtiqueta] = useState<Producto | null>(null)
  const [isModalEtiquetaOpen, setIsModalEtiquetaOpen] = useState(false)
  const barcodeRef = useRef<SVGSVGElement | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const API_URL = "http://127.0.0.1:8000/productos"

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (t) setToken(t)
  }, [])

  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error("No autorizado o error en el servidor")
          return res.json()
        })
        .then((data) => {
          if (Array.isArray(data)) {
            setProductos(data)
          } else {
            console.error("Formato de datos inesperado:", data)
            setProductos([])
          }
        })
        .catch((error) => {
          console.error("Error al obtener productos:", error.message)
          setProductos([])
        })
    }
  }, [token])

  const guardarProducto = async () => {
    if (!productoActual || !token) {
      toast.error("No hay producto o token disponible.")
      return
    }

    const isEditing = !!productoActual.id
    const url = isEditing
      ? `${API_URL}/update/${productoActual.id}`
      : `${API_URL}/register`
    const method = isEditing ? "PUT" : "POST"

    const { id, ...productoSinId } = productoActual

    if (!productoSinId.codigo_barra || !productoSinId.descripcion) {
      toast.error("Código de barra y descripción son obligatorios.")
      return
    }

    const payload = {
      codigo_barra: productoSinId.codigo_barra,
      descripcion: productoSinId.descripcion,
      linea: productoSinId.linea,
      tela: productoSinId.tela,
      talle: productoSinId.talle,
      color: productoSinId.color,
      costo: productoSinId.costo ?? 0,
      precio_alquiler_lista: productoSinId.precio_alquiler_lista ?? 0,
      precio_alquiler_efectivo: productoSinId.precio_alquiler_efectivo ?? 0,
      precio_venta_nuevo_lista: productoSinId.precio_venta_nuevo_lista ?? 0,
      precio_venta_nuevo_efectivo: productoSinId.precio_venta_nuevo_efectivo ?? 0,
      precio_de_venta_medio_uso: productoSinId.precio_de_venta_medio_uso ?? 0,
      precio_venta: productoSinId.precio_venta ?? 0,
      precio_liquidacion: productoSinId.precio_liquidacion ?? 0,
      stock: productoSinId.stock ?? 0,
      stock_minimo: productoSinId.stock_minimo ?? 0,
      fecha_alta: productoSinId.fecha_alta && !isNaN(Date.parse(productoSinId.fecha_alta))
        ? productoSinId.fecha_alta
        : new Date().toISOString().split("T")[0],
      estado: productoSinId.estado ?? "activo",
      sucursal_id: productoSinId.sucursal_id ?? 1,
      inmovilizado: productoSinId.inmovilizado ?? false,
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Error al crear o actualizar el producto.")
      }

      const updatedProduct = result.producto ?? result.data
      if (!updatedProduct?.id) {
        throw new Error("El backend no devolvió el producto actualizado correctamente.")
      }

      setProductos((prev) =>
        isEditing
          ? prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
          : [...prev, updatedProduct]
      )

      setIsModalOpen(false)
      toast.success(
        isEditing
          ? "Producto actualizado correctamente"
          : "Producto creado correctamente"
      )
    } catch (error: any) {
      console.error("❌ Error al guardar el producto", error)
      toast.error(error.message || "Error desconocido al guardar el producto.")
    }
  }

  const eliminarProducto = async (codigo_barra: string) => {
    if (!token) return
    try {
      const response = await fetch(`${API_URL}/${codigo_barra}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) throw new Error("Error al eliminar el producto")

      setProductos((prev) => prev.filter((p) => p.codigo_barra !== codigo_barra))
      toast.success("Producto eliminado")
    } catch (error) {
      toast.error("Error al eliminar el producto")
      console.error(error)
    }
  }

  const generarEtiqueta = (producto: Producto) => {
    setProductoEtiqueta(producto)
    setIsModalEtiquetaOpen(true)
    toast.success(`Etiqueta generada para ${producto.descripcion}`)
  }

  useEffect(() => {
    if (isModalEtiquetaOpen && productoEtiqueta) {
      const timer = setTimeout(() => {
        if (barcodeRef.current) {
          JsBarcode(barcodeRef.current, productoEtiqueta.codigo_barra || "000000000000", {
            format: "CODE128",
            lineColor: "#000",
            width: 2,
            height: 80,
            displayValue: true,
          })
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isModalEtiquetaOpen, productoEtiqueta])

  const imprimirEtiqueta = () => {
    const etiqueta = document.getElementById("etiqueta-impresion")
    if (!etiqueta) return

    const ventana = window.open('', '_blank', 'width=300,height=400')
    if (!ventana) return

    const contenido = etiqueta.cloneNode(true) as HTMLElement
    const style = `
      <style>
        body {
          margin: 0;
          padding: 10px;
          font-family: sans-serif;
          text-align: center;
        }
        svg {
          display: block;
          margin: 0 auto;
        }
      </style>
    `
    ventana.document.body.innerHTML = style
    ventana.document.body.appendChild(contenido)

    setTimeout(() => {
      ventana.print()
      ventana.close()
    }, 500)
  }

  const [estado, setEstado] = useState("SALON")
  const estadosDisponibles = ["SALON", "CLIENTE", "LAVANDERIA", "MODISTA", "VENDIDO"]

  console.log("Productos renderizados:", productos)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gestión de Productos</h1>

      {/* Botón Agregar */}
      <Button
        onClick={() => {
          setProductoActual({
            codigo_barra: "",
            descripcion: "",
            linea: "",
            tela: "",
            talle: "",
            color: "",
            costo: 0,
            precio_alquiler_lista: 0,
            precio_alquiler_efectivo: 0,
            precio_venta_nuevo_lista: 0,
            precio_venta_nuevo_efectivo: 0,
            precio_de_venta_medio_uso: 0,
            precio_venta: 0,
            precio_liquidacion: 0,
            stock: 0,
            stock_minimo: 0,
            fecha_alta: new Date().toISOString().split("T")[0],
            estado: "SALON",
            sucursal_id: 1,
            inmovilizado: false,
          });
          setIsModalOpen(true);
        }}
        >
          Agregar Producto
      </Button>


      {/* Tabla de productos */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código de Barra</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Línea</TableHead>
                <TableHead>Talle</TableHead>
                <TableHead>Tela</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Precio Alq. Lista</TableHead>
                <TableHead>Precio Alq. Efectivo</TableHead>
                <TableHead>Precio Venta Nuevo Lista</TableHead>
                <TableHead>Precio Venta Nuevo Efectivo</TableHead>
                <TableHead>Precio Medio Uso</TableHead>
                <TableHead>Precio Venta</TableHead>
                <TableHead>Precio Liquidación</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Stock Mínimo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Sucursal ID</TableHead>
                <TableHead>Fecha Alta</TableHead>
                <TableHead>Inmovilizado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((producto) => (
                <TableRow key={producto.codigo_barra || producto.id || Math.random()}>
                  <TableCell>{producto.codigo_barra}</TableCell>
                  <TableCell>{producto.descripcion}</TableCell>
                  <TableCell>{producto.linea}</TableCell>
                  <TableCell>{producto.talle}</TableCell>
                  <TableCell>{producto.tela}</TableCell>
                  <TableCell>{producto.color}</TableCell>
                  <TableCell>${producto.costo}</TableCell>
                  <TableCell>${producto.precio_alquiler_lista}</TableCell>
                  <TableCell>${producto.precio_alquiler_efectivo}</TableCell>
                  <TableCell>${producto.precio_venta_nuevo_lista}</TableCell>
                  <TableCell>${producto.precio_venta_nuevo_efectivo}</TableCell>
                  <TableCell>${producto.precio_de_venta_medio_uso}</TableCell>
                  <TableCell>${producto.precio_venta}</TableCell>
                  <TableCell>${producto.precio_liquidacion}</TableCell>
                  <TableCell>{producto.stock}</TableCell>
                  <TableCell>{producto.stock_minimo}</TableCell>
                  <TableCell>
                    <select
                      value={producto.estado}
                      onChange={async (e) => {
                        const nuevoEstado = e.target.value;

                        // Crear una copia del producto con el nuevo estado
                        const productoActualizado = { ...producto, estado: nuevoEstado };

                        try {
                          const response = await fetch(`${API_URL}/update/${producto.id}`, {
                            method: "PUT",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify(productoActualizado),
                          });

                          const result = await response.json();

                          if (!response.ok || result.success === false) {
                            throw new Error(result.message || "Error al actualizar el estado.");
                          }

                          // Actualizar el estado local
                          setProductos((prev) =>
                            prev.map((p) => (p.id === producto.id ? { ...p, estado: nuevoEstado } : p))
                          );

                          toast.success("Estado actualizado correctamente");
                        } catch (error: any) {
                          toast.error(error.message || "Error al actualizar el estado");
                          console.error(error);
                        }
                      }}
                    >
                      {estadosDisponibles.map((estado) => (
                        <option key={estado} value={estado}>
                          {estado}
                        </option>
                      ))}
                  </select>

                </TableCell>

                  <TableCell>{producto.sucursal_id}</TableCell>
                  <TableCell>{new Date(producto.fecha_alta).toLocaleDateString()}</TableCell>
                  <TableCell>{producto.inmovilizado ? "Sí" : "No"}</TableCell>
                  <TableCell className="flex gap-2">
                  <Button
                        size="sm"
                        onClick={() => {
                          console.log("Editando producto:", producto) // <-- ESTE es el PASO 1
                          setProductoActual(producto)
                          setIsModalOpen(true)
                          }}>Editar
                  </Button>
                  <Button size="sm" onClick={() => generarEtiqueta(producto)}>Etiquetado</Button>*
                  <Button size="sm" variant="warning" onClick={() => eliminarProducto(producto.codigo_barra)}>Eliminar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
        </Table>


      {/* Modal para generar Etiqueta */}
      <Dialog open={isModalEtiquetaOpen} onOpenChange={setIsModalEtiquetaOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle>Etiqueta del Producto</DialogTitle>
          </DialogHeader>
          {productoEtiqueta && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold">Nombre del Producto:</p>
                <p>{productoEtiqueta.descripcion}</p>
              </div>
              <div>
                <p className="font-semibold">Código de Barra:</p>
                <p>{productoEtiqueta.codigo_barra}</p>
              </div>
              <div>
                <p className="font-semibold">Código de Barra:</p>
                <svg ref={barcodeRef} id="etiqueta-impresion"></svg>
              </div>
              <Button
                variant="secondary"
                onClick={() => imprimirEtiqueta()}
              >
                Imprimir
              </Button>

            </div>
            
          )}
          <DialogFooter>
            <Button onClick={() => setIsModalEtiquetaOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Agregar/Editar Producto */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{productoActual?.id ? "Editar Producto" : "Agregar Producto"}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <label>Código de Barra</label>
              <Input value={productoActual?.codigo_barra || ""} onChange={(e) => setProductoActual({ ...productoActual!, codigo_barra: e.target.value })} />
            </div>
            <div>
              <label>Descripción</label>
              <Input value={productoActual?.descripcion || ""} onChange={(e) => setProductoActual({ ...productoActual!, descripcion: e.target.value })} />
            </div>
            <div>
              <label>Línea</label>
              <Input value={productoActual?.linea || ""} onChange={(e) => setProductoActual({ ...productoActual!, linea: e.target.value })} />
            </div>
            <div>
              <label>Talle</label>
              <Input value={productoActual?.talle || ""} onChange={(e) => setProductoActual({ ...productoActual!, talle: e.target.value })} />
            </div>
            <div>
              <label>Tela</label>
              <Input value={productoActual?.tela || ""} onChange={(e) => setProductoActual({ ...productoActual!, tela: e.target.value })} />
            </div>
            <div>
              <label>Color</label>
              <Input value={productoActual?.color || ""} onChange={(e) => setProductoActual({ ...productoActual!, color: e.target.value })} />
            </div>
            <div>
              <label>Costo</label>
              <Input type="number" value={productoActual?.costo || 0} onChange={(e) => setProductoActual({ ...productoActual!, costo: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label>Precio Alquiler Lista</label>
              <Input type="number" value={productoActual?.precio_alquiler_lista || 0} onChange={(e) => setProductoActual({ ...productoActual!, precio_alquiler_lista: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label>Precio Alquiler Efectivo</label>
              <Input type="number" value={productoActual?.precio_alquiler_efectivo || 0} onChange={(e) => setProductoActual({ ...productoActual!, precio_alquiler_efectivo: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label>Precio Venta Nuevo Lista</label>
              <Input type="number" value={productoActual?.precio_venta_nuevo_lista || 0} onChange={(e) => setProductoActual({ ...productoActual!, precio_venta_nuevo_lista: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label>Precio Venta Nuevo Efectivo</label>
              <Input type="number" value={productoActual?.precio_venta_nuevo_efectivo || 0} onChange={(e) => setProductoActual({ ...productoActual!, precio_venta_nuevo_efectivo: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label>Precio Medio Uso</label>
              <Input type="number" value={productoActual?.precio_de_venta_medio_uso || 0} onChange={(e) => setProductoActual({ ...productoActual!, precio_de_venta_medio_uso: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label>Precio Venta</label>
              <Input type="number" value={productoActual?.precio_venta || 0} onChange={(e) => setProductoActual({ ...productoActual!, precio_venta: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label>Precio Liquidación</label>
              <Input type="number" value={productoActual?.precio_liquidacion || 0} onChange={(e) => setProductoActual({ ...productoActual!, precio_liquidacion: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label>Stock</label>
              <Input type="number" value={productoActual?.stock || 0} onChange={(e) => setProductoActual({ ...productoActual!, stock: parseInt(e.target.value) })} />
            </div>
            <div>
              <label>Stock Mínimo</label>
              <Input type="number" value={productoActual?.stock_minimo || 0} onChange={(e) => setProductoActual({ ...productoActual!, stock_minimo: parseInt(e.target.value) })} />
            </div>
            <div>
              <label>Estado</label>
              <Input value={productoActual?.estado || ""} onChange={(e) => setProductoActual({ ...productoActual!, estado: e.target.value })} />
            </div>
            <div>
              <label>Sucursal ID</label>
              <Input type="number" value={productoActual?.sucursal_id || 0} onChange={(e) => setProductoActual({ ...productoActual!, sucursal_id: parseInt(e.target.value) })} />
            </div>
            <div>
              <label>Fecha Alta</label>
              <Input type="date" value={productoActual?.fecha_alta || new Date().toISOString().slice(0, 10)} onChange={(e) => setProductoActual({ ...productoActual!, fecha_alta: e.target.value })} />
            </div>
            <div>
              <label>¿Inmovilizado?</label>
              <input type="checkbox" checked={productoActual?.inmovilizado || false} onChange={(e) => setProductoActual({ ...productoActual!, inmovilizado: e.target.checked })} />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={(e)=>guardarProducto()}>
              {productoActual?.id ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>



    </div>
  );
}