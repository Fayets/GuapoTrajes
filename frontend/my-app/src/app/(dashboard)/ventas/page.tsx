"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-config";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Eye, Trash2, Plus } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";

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
  fecha_hora: string;
  cliente_nombre: string;
  sucursal_nombre: string;
  tipo_precio: string;
  payment_method: string;
  total: number;
  productos: ProductoVenta[];
}

interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  dni?: string;
}

interface Producto {
  id: number;
  codigo?: string;
  descripcion: string;
  estado?: string;
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

const metodosPago = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "DEBITO", label: "Débito" },
  { value: "CREDITO", label: "Crédito" },
  { value: "BILLETERA_VIRTUAL", label: "Billetera Virtual" },
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
  const [searchTerm, setSearchTerm] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [productoFiltro, setProductoFiltro] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [nuevoItem, setNuevoItem] = useState({
    productoId: "",
    cantidad: 1,
    tipo_precio: "",
  });
  const [metodoPago, setMetodoPago] = useState("");
  const [showMetodoPagoModal, setShowMetodoPagoModal] = useState(false);
  const [items, setItems] = useState<
    Array<{
      productoId: number;
      productoNombre: string;
      productoCodigo?: string;
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
      tipo_precio: string;
    }>
  >([]);

  const API_BASE = getApiBaseUrl();
  const API_URL = `${API_BASE}/ventas`;

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
        const res = await fetch(`${API_BASE}/clientes/all`, {
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
        const res = await fetch(`${API_BASE}/productos/all`, {
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
    if (!ventaActual?.cliente_id || items.length === 0) {
      toast.error("Selecciona un cliente y al menos un producto");
      return;
    }

    if (!metodoPago) {
      toast.error("Debes seleccionar un método de pago");
      return;
    }

    // Verificar que todos los productos tengan el mismo tipo de precio
    const tiposPrecio = [...new Set(items.map((item) => item.tipo_precio))];
    if (tiposPrecio.length > 1) {
      toast.error("Todos los productos deben tener el mismo tipo de precio");
      return;
    }

    // Verificar el estado de los productos antes de enviar
    const productosConEstadoInvalido = items.filter((item) => {
      const producto = productos.find((p) => p.id === item.productoId);
      // Por ahora solo verificamos que el producto exista, el estado se valida en el backend
      return !producto;
    });

    if (productosConEstadoInvalido.length > 0) {
      toast.error("Algunos productos seleccionados no están disponibles");
      return;
    }

    setIsSaving(true);

    const payload = {
      cliente_id: ventaActual.cliente_id,
      sucursal_id: 1, // Ajustar según corresponda o agregar selector de sucursal
      tipo_precio: tiposPrecio[0], // Tipo de precio principal de la venta
      payment_method: metodoPago,
      productos: items.map((item) => ({
        producto_id: item.productoId,
        cantidad: item.cantidad,
      })),
    };

    try {
      console.log("Enviando payload al backend:", payload);
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        // Verificar si es un error específico de estado del producto
        if (
          result.message &&
          result.message.includes("no se puede vender porque está en estado")
        ) {
          // Extraer el estado del producto del mensaje de error
          const estadoMatch = result.message.match(/estado '([^']+)'/);
          const estado = estadoMatch ? estadoMatch[1] : "desconocido";

          // Mostrar alerta específica para estado del producto
          toast.error(
            `❌ No se puede vender el producto porque está en estado "${estado}". Solo se pueden vender productos en estado "SALON".`,
            {
              duration: 5000, // Mostrar por más tiempo
              action: {
                label: "Entendido",
                onClick: () => {},
              },
            }
          );
        } else {
          // Otros tipos de errores
          throw new Error(result.message || "Error al guardar venta.");
        }
        return; // No continuar si hay error
      }

      toast.success("Venta registrada correctamente");
      setIsModalOpen(false);
      // Limpiar el estado
      setItems([]);
      setNuevoItem({
        productoId: "",
        cantidad: 1,
        tipo_precio: "",
      });
      setProductoFiltro("");
      setClienteFiltro("");
      setMetodoPago("");
      // Refresca la lista desde el backend
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

  const handleItemChange = (campo: string, valor: any) => {
    setNuevoItem((prev) => ({ ...prev, [campo]: valor }));
  };

  const agregarItem = () => {
    if (
      !nuevoItem.productoId ||
      !nuevoItem.cantidad ||
      !nuevoItem.tipo_precio
    ) {
      toast.error("Completa todos los campos del producto");
      return;
    }

    // Verificar que el tipo de precio sea el mismo que los productos ya agregados
    if (items.length > 0) {
      const primerTipoPrecio = items[0].tipo_precio;
      if (nuevoItem.tipo_precio !== primerTipoPrecio) {
        toast.error(
          `Todos los productos deben tener el mismo tipo de precio. Ya tienes productos con tipo: ${getTipoPrecioLabel(
            primerTipoPrecio
          )}`
        );
        return;
      }
    }

    const producto = productos.find(
      (p) => p.id === Number(nuevoItem.productoId)
    );
    if (!producto) {
      toast.error("Producto no encontrado");
      return;
    }

    const precio_unitario = getPrecioUnitario(
      Number(nuevoItem.productoId),
      nuevoItem.tipo_precio
    );
    const subtotal = precio_unitario * nuevoItem.cantidad;

    const nuevoItemCompleto = {
      productoId: Number(nuevoItem.productoId),
      productoNombre: producto.descripcion,
      productoCodigo: producto.codigo,
      cantidad: nuevoItem.cantidad,
      precio_unitario,
      subtotal,
      tipo_precio: nuevoItem.tipo_precio,
    };

    setItems((prev) => [...prev, nuevoItemCompleto]);

    // Limpiar el formulario
    setNuevoItem({
      productoId: "",
      cantidad: 1,
      tipo_precio: "",
    });
    setProductoFiltro("");
  };

  const eliminarItem = (productoId: number) => {
    setItems((prev) => prev.filter((item) => item.productoId !== productoId));
  };

  const calcularTotal = () => {
    return items.reduce((total, item) => total + item.subtotal, 0);
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Ventas</h1>
          <p className="text-muted">Gestión de ventas de Guapo Trajes</p>
        </div>
        <Button
          onClick={() => {
            setVentaActual({
              fecha_hora: new Date().toISOString().split("T")[0],
              cliente_id: undefined,
              producto_id: undefined,
              cantidad: 1,
              tipo_precio: "",
              total: 0,
            });
            setSearchTerm("");
            setShowProductDropdown(false);
            setProductoFiltro("");
            setClienteFiltro("");
            setMetodoPago("");
            setNuevoItem({
              productoId: "",
              cantidad: 1,
              tipo_precio: "",
            });
            setItems([]);
            setShowMetodoPagoModal(true);
          }}
        >
          + Agregar Venta
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
              <TableHead>Método Pago</TableHead>
              <TableHead>Precio Unit.</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ventas.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  {parseFecha(v.fecha_hora).toLocaleDateString()}
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
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    {metodosPago.find((m) => m.value === v.payment_method)
                      ?.label || v.payment_method}
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
                  <RoleGate allow={["ADMIN"]}>
                    <Button
                      size="sm"
                      variant="danger"
                      className="ms-2"
                      onClick={() => setVentaAEliminar(v)}
                    >
                      Eliminar
                    </Button>
                  </RoleGate>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Modal de Método de Pago */}
      <Dialog open={showMetodoPagoModal} onOpenChange={setShowMetodoPagoModal}>
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-lg"
          dialogStyle={{ maxWidth: "640px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
            <DialogTitle className="fw-semibold">Método de Pago</DialogTitle>
            <DialogDescription className="mb-0">
              Selecciona el método de pago para completar la venta
            </DialogDescription>
          </DialogHeader>

          <div className="modal-body px-3 px-md-4">
            <div className="card shadow-sm">
              <div className="card-body p-4">
                <div className="row g-3">
                  {metodosPago.map((metodo) => {
                    const activo = metodoPago === metodo.value;
                    return (
                      <div className="col-12 col-md-6" key={metodo.value}>
                        <div
                          className={`border rounded-3 p-3 h-100 d-flex align-items-center gap-3 transition ${
                            activo
                              ? "border-primary bg-primary bg-opacity-10"
                              : "border-light bg-white"
                          }`}
                          role="button"
                          onClick={() => setMetodoPago(metodo.value)}
                          style={{ cursor: "pointer" }}
                        >
                          <div className="form-check m-0">
                            <input
                              type="radio"
                              name="metodoPago"
                              value={metodo.value}
                              checked={activo}
                              onChange={() => setMetodoPago(metodo.value)}
                              className="form-check-input"
                            />
                          </div>
                          <div>
                            <span className="fw-semibold d-block">
                              {metodo.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!metodoPago && (
                  <div className="text-danger small mt-3">
                    Debes seleccionar un método de pago
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button
              className="btn btn-light border"
              onClick={() => setShowMetodoPagoModal(false)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (metodoPago) {
                  setShowMetodoPagoModal(false);
                  setIsModalOpen(true);
                }
              }}
              disabled={!metodoPago}
            >
              Continuar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isModalOpen && ventaActual && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent
            className="w-full border-0"
            dialogClassName="modal-dialog-centered modal-xl"
            dialogStyle={{ maxWidth: "820px", width: "95%" }}
          >
            <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
              <DialogTitle className="fw-semibold">
                Nueva Venta
              </DialogTitle>
              <DialogDescription className="mb-0">
                Completá los datos del cliente, agregá los productos y confirmá la venta.
              </DialogDescription>
            </DialogHeader>

            <div className="modal-body px-3 px-md-4">
              <div className="card shadow-sm mb-4">
                <div className="card-body p-4">
                  <h6 className="fw-semibold text-secondary mb-3 d-flex align-items-center">
                    <i className="bi bi-person-circle me-2 text-primary"></i>
                    Información del Cliente
                  </h6>

                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold">Buscar Cliente</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar por nombre, apellido o DNI..."
                        value={clienteFiltro}
                        onChange={(e) => setClienteFiltro(e.target.value)}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold">Seleccionar Cliente</label>
                      <select
                        className={`form-select ${
                          touched["cliente_id"] && !ventaActual.cliente_id
                            ? "is-invalid"
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
                        {clientes
                          .filter((c) =>
                            `${c.nombre} ${c.apellido} ${c.dni || ""}`
                              .toLowerCase()
                              .includes(clienteFiltro.toLowerCase())
                          )
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} {c.apellido}{" "}
                              {c.dni ? `(DNI: ${c.dni})` : ""}
                            </option>
                          ))}
                      </select>
                      {touched["cliente_id"] && !ventaActual.cliente_id && (
                        <div className="text-danger small mt-2">
                          Selecciona un cliente
                        </div>
                      )}
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-bold">Fecha de Venta</label>
                      <Input
                        type="date"
                        value={ventaActual.fecha_hora || ""}
                        onChange={(e) =>
                          setVentaActual({
                            ...ventaActual,
                            fecha_hora: e.target.value,
                          })
                        }
                        onBlur={() => handleBlur("fecha_hora")}
                        className={
                          touched["fecha_hora"] && !ventaActual.fecha_hora
                            ? "is-invalid"
                            : ""
                        }
                      />
                      {touched["fecha_hora"] && !ventaActual.fecha_hora && (
                        <div className="text-danger small mt-2">
                          Selecciona una fecha
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card shadow-sm mb-4">
                <div className="card-body p-4">
                  <h6 className="fw-semibold text-secondary mb-3 d-flex align-items-center">
                    <i className="bi bi-box-seam me-2 text-success"></i>
                    Agregar Producto
                  </h6>

                  <div className="row g-3 align-items-end">
                    <div className="col-12 col-md-4">
                      <label className="form-label fw-bold">Buscar producto</label>
                      <Input
                        type="text"
                        placeholder="Buscar por código o descripción"
                        value={productoFiltro}
                        onChange={(e) => setProductoFiltro(e.target.value)}
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label fw-bold">Producto</label>
                      <select
                        className="form-select"
                        value={nuevoItem.productoId}
                        onChange={(e) =>
                          handleItemChange("productoId", e.target.value)
                        }
                      >
                        <option value="">Seleccionar producto</option>
                        {productos
                          .filter((p) =>
                            `${p.descripcion}${p.codigo || ""}`
                              .toLowerCase()
                              .includes(productoFiltro.toLowerCase())
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.descripcion} - Código: {p.codigo || "Sin código"} - $
                              {getPrecioUnitario(
                                p.id,
                                nuevoItem.tipo_precio || "Lista"
                              ).toLocaleString()}
                            </option>
                          ))}
                      </select>
                      {nuevoItem.productoId &&
                        (() => {
                          const producto = productos.find(
                            (p) => p.id === Number(nuevoItem.productoId)
                          );
                          if (producto && producto.estado) {
                            const puedeVender = producto.estado === "SALON";
                            return (
                              <div
                                className={`mt-2 p-2 rounded-3 border text-sm ${
                                  puedeVender
                                    ? "border-success bg-success bg-opacity-10 text-success"
                                    : "border-danger bg-danger bg-opacity-10 text-danger"
                                }`}
                              >
                                <div className="d-flex align-items-center gap-2">
                                  <span
                                    className={`badge rounded-circle p-2 ${
                                      puedeVender
                                        ? "bg-success"
                                        : "bg-danger"
                                    }`}
                                  ></span>
                                  <span className="fw-semibold">
                                    Estado: {producto.estado}
                                  </span>
                                </div>
                                {!puedeVender && (
                                  <div className="small mt-2">
                                    ❌ Este producto no se puede vender. Solo se
                                    pueden vender productos en estado "SALON".
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label fw-bold">Cantidad</label>
                      <Input
                        type="number"
                        min={1}
                        value={nuevoItem.cantidad}
                        onChange={(e) =>
                          handleItemChange("cantidad", parseInt(e.target.value))
                        }
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label fw-bold">
                        Tipo de Precio
                        {items.length > 0 && (
                          <span className="text-primary small ms-2">
                            (Usando: {getTipoPrecioLabel(items[0].tipo_precio)})
                          </span>
                        )}
                      </label>
                      <select
                        className="form-select"
                        value={
                          items.length > 0
                            ? items[0].tipo_precio
                            : nuevoItem.tipo_precio
                        }
                        onChange={(e) =>
                          handleItemChange("tipo_precio", e.target.value)
                        }
                        disabled={items.length > 0}
                      >
                        <option value="">Seleccionar tipo</option>
                        {tiposPrecios.map((tipo) => (
                          <option key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </option>
                        ))}
                      </select>
                      {items.length > 0 && (
                        <div className="text-muted small mt-2">
                          El tipo de precio se establece con el primer producto
                        </div>
                      )}
                    </div>
                    <div className="col-12 col-md-4 col-lg-2">
                      <Button
                        variant="success"
                        onClick={agregarItem}
                        disabled={
                          !nuevoItem.productoId ||
                          !nuevoItem.cantidad ||
                          !nuevoItem.tipo_precio ||
                          (() => {
                            const producto = productos.find(
                              (p) => p.id === Number(nuevoItem.productoId)
                            );
                            return !!(
                              producto &&
                              producto.estado &&
                              producto.estado !== "SALON"
                            );
                          })()
                        }
                        className="w-100 d-flex align-items-center justify-content-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Agregar
                      </Button>
                      {(() => {
                        const producto = productos.find(
                          (p) => p.id === Number(nuevoItem.productoId)
                        );
                        if (
                          producto &&
                          producto.estado &&
                          producto.estado !== "SALON"
                        ) {
                          return (
                            <div className="text-danger small mt-2 text-center">
                              No se puede agregar: producto en estado "
                              {producto.estado}"
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {items.length > 0 && (
                <div className="card shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h6 className="fw-semibold text-secondary mb-3 d-flex align-items-center">
                      <i className="bi bi-list-check me-2 text-purple"></i>
                      Productos Seleccionados ({items.length})
                    </h6>

                    <div className="d-flex flex-column gap-3">
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className="border rounded-3 p-3 bg-light d-flex justify-content-between flex-wrap gap-3"
                        >
                          <div className="flex-grow-1">
                            <div className="fw-semibold">{item.productoNombre}</div>
                            <div className="text-muted small">
                              Código: {item.productoCodigo || "Sin código"} · Tipo: {getTipoPrecioLabel(item.tipo_precio)} · Cantidad: {item.cantidad}
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-3">
                            <span className="text-muted">
                              ${item.precio_unitario.toLocaleString()}
                            </span>
                            <span className="fw-semibold text-primary">
                              ${item.subtotal.toLocaleString()}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => eliminarItem(item.productoId)}
                              className="text-danger border-danger-subtle"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className="border-top pt-3 mt-2 text-end">
                        <span className="fw-bold fs-5">
                          Total: ${calcularTotal().toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
              <button
                className="btn btn-light border"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={guardarVenta}
                disabled={
                  !ventaActual.cliente_id || items.length === 0 || isSaving
                }
              >
                {isSaving ? (
                  <span className="d-flex align-items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Guardando...
                  </span>
                ) : (
                  "Guardar Venta"
                )}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal para ver detalle de venta */}
      <Dialog open={!!ventaParaVer} onOpenChange={() => setVentaParaVer(null)}>
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-xl"
          dialogStyle={{ maxWidth: "900px", width: "95%" }}
        >
          {ventaParaVer && (
            <>
              <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
                <DialogTitle className="d-flex justify-content-between align-items-center">
                  <span>
                    <span className="text-muted text-uppercase small d-block">
                      Venta #{ventaParaVer.id}
                    </span>
                    Detalle de la Venta
                  </span>
                  <span className="badge bg-primary-subtle text-primary">
                    {getTipoPrecioLabel(ventaParaVer.tipo_precio)}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-muted">
                  Información detallada de la operación y sus productos asociados.
                </DialogDescription>
              </DialogHeader>

              <div className="modal-body px-3 px-md-4">
                <div className="card mb-4 shadow-sm">
                  <div className="card-header bg-light">
                    <h6 className="mb-0 d-flex align-items-center gap-2">
                      <i className="bi bi-person-lines-fill text-primary"></i>
                      Información General
                    </h6>
                  </div>
                  <div className="card-body p-4">
                    <div className="row g-4">
                      <div className="col-12 col-md-6">
                        <p className="text-muted text-uppercase small mb-1">Cliente</p>
                        <p className="fw-semibold text-dark mb-0">
                          {ventaParaVer.cliente_nombre}
                        </p>
                      </div>
                      <div className="col-12 col-md-6">
                        <p className="text-muted text-uppercase small mb-1">Fecha</p>
                        <p className="fw-semibold text-dark mb-0">
                          {format(parseFecha(ventaParaVer.fecha_hora), "dd/MM/yyyy HH:mm", { locale: es })}
                        </p>
                      </div>
                      <div className="col-12 col-md-6">
                        <p className="text-muted text-uppercase small mb-1">Sucursal</p>
                        <p className="fw-semibold text-dark mb-0">
                          {ventaParaVer.sucursal_nombre}
                        </p>
                      </div>
                      <div className="col-12 col-md-6">
                        <p className="text-muted text-uppercase small mb-1">
                          Método de pago
                        </p>
                        <p className="fw-semibold text-dark mb-0">
                          {ventaParaVer.payment_method || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card shadow-sm">
                  <div className="card-header bg-light">
                    <h6 className="mb-0 d-flex align-items-center gap-2">
                      <i className="bi bi-box-seam text-primary"></i>
                      Productos incluidos
                    </h6>
                  </div>
                  <div className="card-body p-0">
                    <div className="table-responsive">
                      <table className="table align-middle mb-0">
                        <thead className="table-light text-muted text-uppercase small">
                          <tr>
                            <th>Descripción</th>
                            <th>Código</th>
                            <th className="text-center">Cantidad</th>
                            <th className="text-end">Precio</th>
                            <th className="text-end">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ventaParaVer.productos.map((p) => {
                            const productoCatalogo = productos.find(
                              (prod) => prod.id === p.producto_id
                            );
                            const descripcion =
                              p.descripcion || productoCatalogo?.descripcion || p.producto_id;
                            const codigo =
                              p.codigo || productoCatalogo?.codigo || "—";

                            return (
                              <tr key={`${ventaParaVer.id}-${p.producto_id}`}>
                                <td className="fw-medium text-dark">{descripcion}</td>
                                <td>{codigo}</td>
                                <td className="text-center">{p.cantidad}</td>
                                <td className="text-end">
                                  ${p.precio_unitario?.toLocaleString()}
                                </td>
                                <td className="text-end fw-semibold text-primary">
                                  ${p.subtotal?.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="d-flex justify-content-end align-items-baseline gap-3 border-top px-4 py-3">
                      <span className="text-muted text-uppercase small">Total</span>
                      <span className="fs-4 fw-bold text-primary">
                        ${ventaParaVer.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-top px-3 px-md-4">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setVentaParaVer(null)}
                >
                  Cerrar
                </button>
              </div>
            </>
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
                new Date(ventaAEliminar.fecha_hora).toLocaleDateString()}
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
