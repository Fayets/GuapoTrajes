"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Eye, Trash2 } from "lucide-react";

interface ProductoVenta {
  producto_id: number;
  codigo?: string;
  descripcion?: string;
  cantidad: number;
  precio_unitario?: number;
  subtotal?: number;
}

interface Venta {
  id: number;
  fecha: string;
  cliente_nombre: string;
  sucursal_nombre: string;
  tipo_precio: string;
  total: number;
  productos: ProductoVenta[];
}

interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
}

interface Producto {
  id: number;
  descripcion: string;
  precio_venta_nuevo_lista?: number;
  precio_venta_nuevo_efectivo?: number;
  precio_de_venta_medio_uso?: number;
  precio_venta?: number;
  precio_liquidacion?: number;
}

const tiposPrecios = [
  { value: "Lista", label: "Precio Venta Nuevo Lista" },
  { value: "Efectivo", label: "Precio Venta Nuevo Efectivo" },
  { value: "Medio Uso", label: "Precio de Venta Medio Uso" },
  { value: "Liquidacion", label: "Precio Liquidación" },
];

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [ventaActual, setVentaActual] = useState<Partial<
    Venta & {
      cliente_id?: number;
      producto_id?: number;
      cantidad?: number;
      tipo_precio?: string;
    }
  > | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [touched, setTouched] = useState<{ [k: string]: boolean }>({});
  const [ventaParaVer, setVentaParaVer] = useState<Venta | null>(null);
  const [ventaAEliminar, setVentaAEliminar] = useState<Venta | null>(null);

  const API_URL = "http://127.0.0.1:8000/ventas";

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const fetchVentas = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/all`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setVentas(data);
        toast.success("Ventas cargadas correctamente");
      } else {
        throw new Error("Formato inesperado de respuesta");
      }
    } catch (error: any) {
      console.error("Error al obtener ventas:", error.message);
      toast.error("Error al cargar ventas: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/clientes/all", {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Error al obtener clientes");
        const data = await res.json();
        setClientes(data);
      } catch (error) {
        toast.error("Error al cargar clientes");
      }
    };

    const fetchProductos = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/productos/all", {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Error al obtener productos");
        const data = await res.json();
        setProductos(data);
      } catch (error) {
        toast.error("Error al cargar productos");
      }
    };

    fetchClientes();
    fetchProductos();
    fetchVentas();
  }, []);

  const isFormValid =
    !!ventaActual?.cliente_id &&
    !!ventaActual?.producto_id &&
    !!ventaActual?.cantidad &&
    !!ventaActual?.tipo_precio &&
    ventaActual.cliente_id !== 0 &&
    ventaActual.producto_id !== 0;

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const guardarVenta = async () => {
    if (!isFormValid) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }
    setIsSaving(true);
    const total =
      (ventaActual.cantidad || 0) *
      getPrecioUnitario(ventaActual.producto_id, ventaActual.tipo_precio);
    const payload = {
      cliente_id: ventaActual.cliente_id,
      sucursal_id: 1, // Ajustar según corresponda o agregar selector de sucursal
      tipo_precio: ventaActual.tipo_precio,
      productos: [
        {
          producto_id: ventaActual.producto_id,
          cantidad: ventaActual.cantidad,
        },
      ],
    };
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Error al guardar venta.");
      }
      toast.success("Venta registrada correctamente");
      setIsModalOpen(false);
      // Refresca la lista desde el backend para evitar problemas de formato
      await fetchVentas();
    } catch (error: any) {
      toast.error(
        "Error al guardar venta: " + (error.message || "desconocido")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const eliminarVenta = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error al eliminar venta");
      setVentas((prev) => prev.filter((v) => v.id !== id));
      toast.success("Venta eliminada");
    } catch (err) {
      toast.error("No se pudo eliminar la venta");
    }
  };

  const getPrecioUnitario = (producto_id?: number, tipo_precio?: string) => {
    if (!producto_id || !tipo_precio) return 0;
    const producto = productos.find((p) => p.id === Number(producto_id));
    if (!producto) return 0;
    switch (tipo_precio) {
      case "Lista":
        return producto.precio_venta_nuevo_lista || 0;
      case "Efectivo":
        return producto.precio_venta_nuevo_efectivo || 0;
      case "Medio Uso":
        return producto.precio_de_venta_medio_uso || 0;
      case "Liquidacion":
        return producto.precio_liquidacion || 0;
      default:
        return 0;
    }
  };

  const actualizarTotal = (campo: string, valor: any) => {
    const ventaActualizada = { ...ventaActual! };
    if (
      campo === "cantidad" ||
      campo === "tipo_precio" ||
      campo === "producto_id"
    ) {
      if (campo === "cantidad") {
        ventaActualizada.cantidad = Number(valor);
      } else if (campo === "tipo_precio") {
        ventaActualizada.tipo_precio = valor;
      } else if (campo === "producto_id") {
        ventaActualizada.producto_id = Number(valor);
      }
      const cantidad = ventaActualizada.cantidad || 0;
      const precioUnitario = getPrecioUnitario(
        ventaActualizada.producto_id,
        ventaActualizada.tipo_precio
      );
      ventaActualizada.total = cantidad * precioUnitario;
    } else {
      (ventaActualizada as any)[campo] = valor;
    }
    setVentaActual(ventaActualizada);
  };

  const getTipoPrecioLabel = (tipoPrecio: string) => {
    const tipo = tiposPrecios.find((t) => t.value === tipoPrecio);
    return tipo?.label || tipoPrecio;
  };

  // Normaliza fechas tipo 'YYYY-MM-DD' para evitar 'Invalid Date'
  function parseFecha(fecha: string | Date | undefined): Date {
    if (!fecha) return new Date("");
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return new Date(fecha + "T00:00:00");
    }
    return new Date(fecha);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gestión de Ventas</h1>
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => {
            setVentaActual({
              fecha: new Date().toISOString().split("T")[0],
              cliente_id: undefined,
              producto_id: undefined,
              cantidad: 1,
              tipo_precio: "",
              total: 0,
            });
            setIsModalOpen(true);
          }}
        >
          Agregar Venta
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-500 py-8">Cargando ventas...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Tipo Precio</TableHead>
              <TableHead>Precio Unit.</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ventas.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  {parseFecha(v.fecha).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {clientes.find(
                    (c) =>
                      c.id ===
                      (typeof v.cliente_nombre === "number"
                        ? v.cliente_nombre
                        : Number(v.cliente_nombre))
                  )?.nombre || v.cliente_nombre}
                </TableCell>
                <TableCell>
                  {(v.productos || []).map((p) => (
                    <div key={`${v.id}-${p.producto_id}`}>
                      {productos.find((prod) => prod.id === p.producto_id)
                        ?.descripcion || p.producto_id}
                    </div>
                  ))}
                </TableCell>
                <TableCell>
                  {(v.productos || []).map((p) => (
                    <div key={`${v.id}-${p.producto_id}-cantidad`}>
                      {p.cantidad}
                    </div>
                  ))}
                </TableCell>
                <TableCell>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {getTipoPrecioLabel(v.tipo_precio)}
                  </span>
                </TableCell>
                <TableCell>
                  {(v.productos || []).map((p) => (
                    <div key={`${v.id}-${p.producto_id}-precio`}>
                      ${p.precio_unitario?.toLocaleString()}
                    </div>
                  ))}
                </TableCell>
                <TableCell className="font-semibold">
                  ${(v.total ?? 0).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVentaParaVer(v)}
                  >
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="ms-2"
                    onClick={() => setVentaAEliminar(v)}
                  >
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {isModalOpen && ventaActual && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {ventaActual?.id ? "Editar Venta" : "Nueva Venta"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 px-2">
              <div>
                <label className="text-sm font-medium">Fecha</label>
                <Input
                  type="date"
                  value={ventaActual.fecha || ""}
                  onChange={(e) =>
                    setVentaActual({ ...ventaActual, fecha: e.target.value })
                  }
                  onBlur={() => handleBlur("fecha")}
                  className={
                    touched["fecha"] && !ventaActual.fecha
                      ? "border-red-500"
                      : ""
                  }
                />
                {touched["fecha"] && !ventaActual.fecha && (
                  <span className="text-xs text-red-500">Obligatorio</span>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Cliente</label>
                <select
                  className={`form-select ${
                    touched["cliente_id"] && !ventaActual.cliente_id
                      ? "border-red-500"
                      : ""
                  }`}
                  value={ventaActual.cliente_id || ""}
                  onChange={(e) =>
                    setVentaActual({
                      ...ventaActual,
                      cliente_id: Number(e.target.value),
                    })
                  }
                  onBlur={() => handleBlur("cliente_id")}
                >
                  <option value="">Seleccionar cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre} {cliente.apellido}
                    </option>
                  ))}
                </select>
                {touched["cliente_id"] && !ventaActual.cliente_id && (
                  <span className="text-xs text-red-500">Obligatorio</span>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Producto</label>
                <select
                  className={`form-select ${
                    touched["producto_id"] && !ventaActual.producto_id
                      ? "border-red-500"
                      : ""
                  }`}
                  value={ventaActual.producto_id || ""}
                  onChange={(e) =>
                    actualizarTotal("producto_id", e.target.value)
                  }
                  onBlur={() => handleBlur("producto_id")}
                >
                  <option value="">Seleccionar producto</option>
                  {productos.map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.descripcion}
                    </option>
                  ))}
                </select>
                {touched["producto_id"] && !ventaActual.producto_id && (
                  <span className="text-xs text-red-500">Obligatorio</span>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Cantidad</label>
                <Input
                  type="number"
                  value={ventaActual.cantidad || ""}
                  onChange={(e) => actualizarTotal("cantidad", e.target.value)}
                  onBlur={() => handleBlur("cantidad")}
                  className={
                    touched["cantidad"] && !ventaActual.cantidad
                      ? "border-red-500"
                      : ""
                  }
                />
                {touched["cantidad"] && !ventaActual.cantidad && (
                  <span className="text-xs text-red-500">Obligatorio</span>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Tipo de Precio</label>
                <select
                  className={`form-select ${
                    touched["tipo_precio"] && !ventaActual.tipo_precio
                      ? "border-red-500"
                      : ""
                  }`}
                  value={ventaActual.tipo_precio || ""}
                  onChange={(e) =>
                    actualizarTotal("tipo_precio", e.target.value)
                  }
                  onBlur={() => handleBlur("tipo_precio")}
                >
                  <option value="">Seleccionar tipo de precio</option>
                  {tiposPrecios.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
                {touched["tipo_precio"] && !ventaActual.tipo_precio && (
                  <span className="text-xs text-red-500">Obligatorio</span>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Precio Unitario</label>
                <Input
                  disabled
                  value={
                    ventaActual.producto_id && ventaActual.tipo_precio
                      ? `$${getPrecioUnitario(
                          ventaActual.producto_id,
                          ventaActual.tipo_precio
                        ).toLocaleString()}`
                      : "-"
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Total</label>
                <Input
                  disabled
                  value={`$${(ventaActual.total || 0).toLocaleString()}`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={guardarVenta}
                disabled={!isFormValid || isSaving}
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin w-4 h-4" /> Guardando...
                  </span>
                ) : ventaActual?.id ? (
                  "Actualizar"
                ) : (
                  "Guardar"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal para ver detalle de venta */}
      <Dialog open={!!ventaParaVer} onOpenChange={() => setVentaParaVer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Venta</DialogTitle>
          </DialogHeader>
          {ventaParaVer && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="bg-muted border rounded p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Fecha
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {parseFecha(ventaParaVer.fecha).toLocaleDateString()}
                </div>
              </div>
              <div className="bg-muted border rounded p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Cliente
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {ventaParaVer.cliente_nombre}
                </div>
              </div>
              <div className="bg-muted border rounded p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Sucursal
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {ventaParaVer.sucursal_nombre}
                </div>
              </div>
              <div className="bg-muted border rounded p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Tipo de Precio
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {getTipoPrecioLabel(ventaParaVer.tipo_precio)}
                </div>
              </div>
              <div className="bg-muted border rounded p-4 md:col-span-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Productos
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {ventaParaVer.productos.map((p) => (
                    <div
                      key={`${ventaParaVer.id}-${p.producto_id}`}
                      className="flex justify-between border-b py-1"
                    >
                      <span>
                        {p.descripcion ||
                          productos.find((prod) => prod.id === p.producto_id)
                            ?.descripcion ||
                          p.producto_id}
                      </span>
                      <span>${p.precio_unitario?.toLocaleString()}</span>
                      <span className="font-semibold">
                        Subtotal: ${p.subtotal?.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-muted border rounded p-4 md:col-span-2 flex justify-end">
                <span className="font-bold text-lg">
                  Total: ${ventaParaVer.total.toLocaleString()}
                </span>
              </div>
              <div className="md:col-span-2 flex justify-end mt-4">
                <Button variant="outline" onClick={() => setVentaParaVer(null)}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar venta */}
      <Dialog
        open={!!ventaAEliminar}
        onOpenChange={() => setVentaAEliminar(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar venta?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            ¿Está seguro que desea eliminar la venta de{" "}
            <b>{ventaAEliminar?.cliente_nombre}</b> del día{" "}
            <b>
              {ventaAEliminar &&
                new Date(ventaAEliminar.fecha).toLocaleDateString()}
            </b>
            ?
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setVentaAEliminar(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (ventaAEliminar) {
                  eliminarVenta(ventaAEliminar.id);
                  setVentaAEliminar(null);
                }
              }}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
