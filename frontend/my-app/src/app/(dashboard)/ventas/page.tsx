"use client";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-config";
import { fetchAllProductos } from "@/lib/fetch-productos";
import { formatDescripcionProducto } from "@/lib/descripcion-producto";
import { MetodoPagoSelector } from "@/components/metodo-pago-selector";
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
import { useAuth } from "@/context/auth-context";
import {
  GUAPO_VENTA_IMPORT_PAYLOAD,
  clearScanQueue,
  type ScanQueueRow,
} from "@/lib/scan-queue";

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
  cuenta_destino_id?: number | null;
  cuenta_destino_nombre?: string | null;
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
  codigo_barra?: string;
  descripcion: string;
  descripcion_extra?: string | null;
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
  { value: "BILLETERA_VIRTUAL", label: "Transferencia" },
];

export default function VentasPage() {
  const { me, isAdmin } = useAuth();
  const esAdminPrivilegiado =
    isAdmin || me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";
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
    tipo_precio: "",
    porcentaje: "",
  });
  const [porcentajeDescuento, setPorcentajeDescuento] = useState<number | null>(
    null
  );
  const [totalConDescuento, setTotalConDescuento] = useState<number | null>(
    null
  );
  const [motivoDescuentoExtra, setMotivoDescuentoExtra] = useState("");
  const [descuentoPendiente, setDescuentoPendiente] = useState<{
    porcentaje: number;
    total: number;
  } | null>(null);
  const [mostrarModalMotivoDescuento, setMostrarModalMotivoDescuento] =
    useState(false);
  const [metodoPago, setMetodoPago] = useState(""); // Compatibilidad hacia atrás
  const [metodoPagoId, setMetodoPagoId] = useState<number | null>(null);
  const [submetodoPagoId, setSubmetodoPagoId] = useState<number | null>(null);
  const [cuentaDestinoId, setCuentaDestinoId] = useState<number | null>(null);
  const [cuentasDestino, setCuentasDestino] = useState<Array<{ id: number; nombre_titular: string; sucursal_id: number }>>([]);
  const [showMetodoPagoModal, setShowMetodoPagoModal] = useState(false);
  const [items, setItems] = useState<
    Array<{
      productoId: number;
      productoNombre: string;
      productoCodigo: string;
      productoEstado?: string;
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
      tipo_precio: string;
    }>
  >([]);

  const pendingVentaImportRef = useRef<ScanQueueRow[] | null>(null);
  /** Si la venta se armó desde la cola del Dashboard; al guardar OK se vacía localStorage. */
  const importedFromQueueRef = useRef(false);

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
        console.log("📦 Ventas recibidas:", data.length);
        if (data.length > 0) {
          const primeraVenta = data[0];
          console.log("🔍 Primera venta ejemplo (completa):", primeraVenta);
          console.log("🔍 Campos cuenta destino:", {
            cuenta_destino_id: primeraVenta.cuenta_destino_id,
            cuenta_destino_nombre: primeraVenta.cuenta_destino_nombre,
            tiene_cuenta_destino_id: 'cuenta_destino_id' in primeraVenta,
            tiene_cuenta_destino_nombre: 'cuenta_destino_nombre' in primeraVenta
          });
        }
        // Asegurar que todas las ventas tengan los campos de cuenta destino
        const ventasNormalizadas = data.map((v: any) => ({
          ...v,
          cuenta_destino_id: v.cuenta_destino_id ?? null,
          cuenta_destino_nombre: v.cuenta_destino_nombre ?? null
        }));
        setVentas(ventasNormalizadas);
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
        const token = localStorage.getItem("token");
        if (!token) return;
        const data = (await fetchAllProductos(token)) as typeof productos;
        setProductos(data);
      } catch {
        toast.error("Error al cargar productos");
      }
    };

    fetchClientes();
    fetchProductos();
    fetchVentas();
    
    // Cargar cuentas destino activas de la sucursal del usuario
    const cargarCuentasDestino = async () => {
      try {
        // Obtener sucursal del usuario
        const sucursalId = me?.sucursalId;
        
        if (!sucursalId) {
          console.warn("⚠️ Usuario no tiene sucursal asignada, no se pueden cargar cuentas destino");
          setCuentasDestino([]);
          return;
        }
        
        const res = await fetch(`${API_BASE}/cuentas-destino/sucursal/${sucursalId}?solo_activas=true`, {
          headers: getAuthHeaders(),
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          let errorMessage = `Error ${res.status} al obtener cuentas destino`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.detail || errorJson.message || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          console.error("❌ Error al obtener cuentas destino:", {
            status: res.status,
            statusText: res.statusText,
            message: errorMessage,
            sucursalId: sucursalId
          });
          
          // Si es un error 404 o 403, puede ser que la sucursal no exista o no tenga permisos
          if (res.status === 404) {
            console.warn("⚠️ Sucursal no encontrada o usuario sin sucursal asignada");
          } else if (res.status === 403) {
            console.warn("⚠️ Usuario sin permisos para ver cuentas destino de esta sucursal");
          }
          
          setCuentasDestino([]);
          return;
        }
        
        const data = await res.json();
        setCuentasDestino(Array.isArray(data) ? data : []);
        console.log(`✅ ${data.length} cuentas destino cargadas para sucursal ${sucursalId}`);
      } catch (error: any) {
        console.error("❌ Error al cargar cuentas destino:", error);
        setCuentasDestino([]);
        // No mostrar toast para no interrumpir el flujo de venta
      }
    };
    
    if (me) {
      cargarCuentasDestino();
    }
  }, [me]);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(GUAPO_VENTA_IMPORT_PAYLOAD);
    } catch {
      /* ignore */
    }
    if (!raw?.trim()) return;
    try {
      sessionStorage.removeItem(GUAPO_VENTA_IMPORT_PAYLOAD);
    } catch {
      /* ignore */
    }
    let parsed: { items?: ScanQueueRow[] };
    try {
      parsed = JSON.parse(raw) as { items?: ScanQueueRow[] };
    } catch {
      return;
    }
    const rows = parsed?.items;
    if (!Array.isArray(rows) || rows.length === 0) return;

    pendingVentaImportRef.current = rows;
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
    setMetodoPagoId(null);
    setSubmetodoPagoId(null);
    setCuentaDestinoId(null);
    setNuevoItem({
      productoId: "",
      tipo_precio: "",
      porcentaje: "",
    });
    setItems([]);
    resetDescuentoVenta();
    setIsModalOpen(true);
    toast.info(
      "Desde la cola: completá el cliente y revisá las prendas; después elegí el método de pago."
    );
  }, []);

  const resetDescuentoVenta = () => {
    setPorcentajeDescuento(null);
    setTotalConDescuento(null);
    setMotivoDescuentoExtra("");
    setDescuentoPendiente(null);
    setMostrarModalMotivoDescuento(false);
    setNuevoItem((prev) => ({ ...prev, porcentaje: "" }));
  };

  const limpiarFormularioVenta = () => {
    setVentaActual(null);
    setIsModalOpen(false);
    setShowMetodoPagoModal(false);
    setItems([]);
    setNuevoItem({ productoId: "", tipo_precio: "", porcentaje: "" });
    setProductoFiltro("");
    setClienteFiltro("");
    setMetodoPago("");
    setMetodoPagoId(null);
    setSubmetodoPagoId(null);
    setCuentaDestinoId(null);
    resetDescuentoVenta();
    pendingVentaImportRef.current = null;
  };

  const cargarItemsDesdeColaPendiente = async () => {
    const pending = pendingVentaImportRef.current;
    if (!pending?.length || items.length > 0) return;

    let list = productos;
    if (list.length === 0) {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          list = (await fetchAllProductos(token)) as typeof productos;
          setProductos(list);
        }
      } catch {
        /* ignore */
      }
    }
    if (list.length === 0) {
      toast.error(
        "No se pudieron cargar los productos. Intentá de nuevo en unos segundos."
      );
      return;
    }
    const defaultTipo = "Efectivo";
    const newItems = pending.map((row) => {
      const p = list.find((pr) => pr.id === row.productoId);
      const precio_unitario = p ? p.precio_venta_nuevo_efectivo || 0 : 0;
      const cod = p?.codigo ?? p?.codigo_barra ?? row.codigoBarra;
      return {
        productoId: row.productoId,
        productoNombre:
          (p
            ? formatDescripcionProducto(p.descripcion, p.descripcion_extra)
            : row.descripcion) ?? row.descripcion,
        productoCodigo: cod ?? "Sin código",
        productoEstado: p?.estado,
        cantidad: 1,
        precio_unitario,
        subtotal: precio_unitario,
        tipo_precio: defaultTipo,
      };
    });
    setItems(newItems);
    importedFromQueueRef.current = true;
    pendingVentaImportRef.current = null;
  };

  useEffect(() => {
    if (isModalOpen) {
      void cargarItemsDesdeColaPendiente();
    }
  }, [isModalOpen, productos.length]);

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

    if (!metodoPagoId) {
      toast.error("Debes seleccionar un método de pago");
      return;
    }

    if (!cuentaDestinoId) {
      toast.error("Debes seleccionar una cuenta destino");
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

    const totalOriginal = calcularTotal();
    const tieneDescuento =
      totalConDescuento !== null && porcentajeDescuento !== null;
    const descuentoMaximoEstandar = esAdminPrivilegiado ? 50 : 15;
    const tieneDescuentoExtra =
      tieneDescuento && (porcentajeDescuento as number) > descuentoMaximoEstandar;

    const payload = {
      cliente_id: ventaActual.cliente_id,
      sucursal_id: me?.sucursalId || 1,
      tipo_precio: tiposPrecio[0],
      metodo_pago_id: metodoPagoId,
      submetodo_pago_id: submetodoPagoId || null,
      payment_method: null,
      cuenta_destino_id: cuentaDestinoId,
      descuento_porcentaje: tieneDescuento ? porcentajeDescuento : null,
      extra_discount_percentage: tieneDescuentoExtra
        ? porcentajeDescuento
        : null,
      extra_discount_amount: tieneDescuentoExtra
        ? totalOriginal - (totalConDescuento as number)
        : null,
      extra_discount_reason: tieneDescuentoExtra ? motivoDescuentoExtra : null,
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
      if (importedFromQueueRef.current) {
        clearScanQueue();
        importedFromQueueRef.current = false;
      }
      limpiarFormularioVenta();
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

  const codigoProducto = (producto: Producto) =>
    producto.codigo?.trim() || producto.codigo_barra?.trim() || "Sin código";

  const handleItemChange = (campo: string, valor: any) => {
    setNuevoItem((prev) => ({ ...prev, [campo]: valor }));
  };

  const agregarItem = () => {
    const tipoPrecio =
      items.length > 0 ? items[0].tipo_precio : nuevoItem.tipo_precio;

    if (!nuevoItem.productoId || !tipoPrecio) {
      toast.error("Seleccioná producto y tipo de precio");
      return;
    }

    const productoId = Number(nuevoItem.productoId);
    if (items.some((i) => i.productoId === productoId)) {
      toast.error("Este producto ya está en la venta");
      return;
    }

    if (items.length > 0 && tipoPrecio !== items[0].tipo_precio) {
      toast.error(
        `Todos los productos deben usar el mismo tipo de precio (${getTipoPrecioLabel(
          items[0].tipo_precio
        )})`
      );
      return;
    }

    const producto = productos.find((p) => p.id === productoId);
    if (!producto) {
      toast.error("Producto no encontrado");
      return;
    }

    const precio_unitario = getPrecioUnitario(productoId, tipoPrecio);
    const nuevoItemCompleto = {
      productoId,
      productoNombre: formatDescripcionProducto(
        producto.descripcion,
        producto.descripcion_extra
      ),
      productoCodigo: codigoProducto(producto),
      productoEstado: producto.estado,
      cantidad: 1,
      precio_unitario,
      subtotal: precio_unitario,
      tipo_precio: tipoPrecio,
    };

    setItems((prev) => [...prev, nuevoItemCompleto]);
    setNuevoItem({
      productoId: "",
      tipo_precio: tipoPrecio,
      porcentaje: nuevoItem.porcentaje,
    });
    setProductoFiltro("");
  };

  const eliminarItem = (productoId: number) => {
    setItems((prev) => prev.filter((item) => item.productoId !== productoId));
    resetDescuentoVenta();
  };

  const calcularTotal = () => {
    return items.reduce((total, item) => total + item.subtotal, 0);
  };

  const aplicarDescuento = () => {
    const total = calcularTotal();
    if (total <= 0) {
      toast.error("Agregá productos antes de aplicar un descuento.");
      return;
    }

    const porcentaje = Number(nuevoItem.porcentaje);
    if (!porcentaje || Number.isNaN(porcentaje) || porcentaje <= 0) {
      toast.error("Ingresá un porcentaje de descuento válido.");
      return;
    }
    if (porcentaje > 100) {
      toast.error("El descuento no puede superar el 100%.");
      return;
    }

    const descuentoMaximoEstandar = esAdminPrivilegiado ? 50 : 15;

    if (porcentaje > descuentoMaximoEstandar) {
      setDescuentoPendiente({ porcentaje, total });
      setMostrarModalMotivoDescuento(true);
      return;
    }

    const descuento = (total * porcentaje) / 100;
    setTotalConDescuento(total - descuento);
    setPorcentajeDescuento(porcentaje);
    setMotivoDescuentoExtra("");
  };

  const confirmarDescuentoExtra = () => {
    if (!motivoDescuentoExtra.trim()) {
      toast.error("El motivo es obligatorio para descuentos mayores al estándar.");
      return;
    }

    if (descuentoPendiente) {
      const descuento =
        (descuentoPendiente.total * descuentoPendiente.porcentaje) / 100;
      setTotalConDescuento(descuentoPendiente.total - descuento);
      setPorcentajeDescuento(descuentoPendiente.porcentaje);
      setMostrarModalMotivoDescuento(false);
      setDescuentoPendiente(null);
    }
  };

  const continuarAMetodoPago = () => {
    if (!ventaActual?.cliente_id) {
      toast.error("Seleccioná un cliente");
      return;
    }
    if (items.length === 0) {
      toast.error("Agregá al menos un producto");
      return;
    }
    setIsModalOpen(false);
    setShowMetodoPagoModal(true);
  };

  const totalMostrarVenta =
    typeof totalConDescuento === "number" ? totalConDescuento : calcularTotal();
  const hayDescuentoVenta = typeof totalConDescuento === "number";
  const totalOriginalVenta = calcularTotal();
  const etiquetaDescuentoVenta =
    hayDescuentoVenta && porcentajeDescuento != null
      ? `(-${porcentajeDescuento}%)`
      : null;

  const tipoPrecioActivo =
    items.length > 0 ? items[0].tipo_precio : nuevoItem.tipo_precio;

  const productosIdsEnVenta = new Set(items.map((i) => i.productoId));

  const productosFiltrados = productos.filter(
    (p) =>
      !productosIdsEnVenta.has(p.id) &&
      `${formatDescripcionProducto(p.descripcion, p.descripcion_extra)}${p.codigo || ""}${p.codigo_barra || ""}`
        .toLowerCase()
        .includes(productoFiltro.toLowerCase())
  );

  const productoSeleccionado = productos.find(
    (p) => p.id === Number(nuevoItem.productoId)
  );

  const puedeAgregarProducto =
    !!nuevoItem.productoId &&
    !!tipoPrecioActivo &&
    !!productoSeleccionado &&
    (!productoSeleccionado.estado || productoSeleccionado.estado === "SALON");

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
            setMetodoPagoId(null);
            setSubmetodoPagoId(null);
            setCuentaDestinoId(null);
            setNuevoItem({
              productoId: "",
              tipo_precio: "",
              porcentaje: "",
            });
            setItems([]);
            resetDescuentoVenta();
            pendingVentaImportRef.current = null;
            importedFromQueueRef.current = false;
            setIsModalOpen(true);
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
                      {(() => {
                        const prod = productos.find(
                          (pr) => pr.id === p.producto_id
                        );
                        return (
                          p.descripcion ||
                          (prod
                            ? formatDescripcionProducto(
                                prod.descripcion,
                                prod.descripcion_extra
                              )
                            : p.producto_id)
                        );
                      })()}
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
                    onClick={() => {
                      console.log("🔍 Venta seleccionada para ver:", v);
                      console.log("📋 Cuenta destino:", {
                        id: v.cuenta_destino_id,
                        nombre: v.cuenta_destino_nombre
                      });
                      setVentaParaVer(v);
                    }}
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
      <Dialog
        open={showMetodoPagoModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowMetodoPagoModal(false);
            setIsModalOpen(true);
          }
        }}
      >
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-lg"
          dialogStyle={{ maxWidth: "640px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
            <DialogTitle className="fw-semibold">Método de pago</DialogTitle>
          </DialogHeader>

          <div className="modal-body px-3 px-md-4">
            <div className="alert alert-primary mb-4">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span className="fw-semibold">Total a cobrar</span>
                <span className="fs-5 fw-bold">
                  $
                  {totalMostrarVenta.toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  {etiquetaDescuentoVenta && (
                    <small className="text-success ms-2">
                      {etiquetaDescuentoVenta}
                    </small>
                  )}
                </span>
              </div>
            </div>

            <MetodoPagoSelector
              sucursalId={me?.sucursalId}
              metodoPagoId={metodoPagoId}
              submetodoPagoId={submetodoPagoId}
              onMetodoChange={(metodoId, submetodoId, metodoDisplay) => {
                setMetodoPagoId(metodoId)
                setSubmetodoPagoId(submetodoId)
                setMetodoPago(metodoDisplay) // Para compatibilidad
                if (metodoDisplay && /efectivo/i.test(metodoDisplay.trim())) {
                  const cuentaEfectivo = cuentasDestino.find(c => /efectivo/i.test((c.nombre_titular || "").trim()))
                  if (cuentaEfectivo) setCuentaDestinoId(cuentaEfectivo.id)
                }
              }}
              required={true}
              showError={!metodoPagoId}
            />

            <div className="mb-4">
              <label className="form-label fw-bold">
                Cuenta Destino <span className="text-danger">*</span>
              </label>
              <select
                className="form-select"
                value={cuentaDestinoId || ""}
                onChange={(e) => setCuentaDestinoId(Number(e.target.value) || null)}
              >
                <option value="">Seleccionar cuenta destino</option>
                {cuentasDestino.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.nombre_titular}
                  </option>
                ))}
              </select>
              {!cuentaDestinoId && (
                <div className="text-danger small mt-2">
                  Debes seleccionar una cuenta destino
                </div>
              )}
              {cuentasDestino.length === 0 && (
                <div className="text-warning small mt-2">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  No hay cuentas destino activas disponibles para tu sucursal. 
                  {isAdmin ? (
                    <span> Creá una cuenta destino desde <strong>Ajustes → Cuentas Destino</strong>.</span>
                  ) : (
                    <span> Contactá a un administrador para que cree una cuenta destino.</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-between flex-wrap gap-2 px-3 px-md-4 pb-2">
            <button
              type="button"
              className="btn btn-light border"
              onClick={() => {
                setShowMetodoPagoModal(false);
                setIsModalOpen(true);
              }}
              disabled={isSaving}
            >
              <i className="bi bi-arrow-left me-2"></i>
              Volver
            </button>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-light border"
                onClick={limpiarFormularioVenta}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={guardarVenta}
                disabled={!metodoPagoId || !cuentaDestinoId || isSaving}
              >
                {isSaving ? (
                  <span className="d-flex align-items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Guardando...
                  </span>
                ) : (
                  "Guardar Venta"
                )}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isModalOpen && ventaActual && (
        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            if (!open && !showMetodoPagoModal) {
              limpiarFormularioVenta();
            }
          }}
        >
          <DialogContent
            className="w-full border-0"
            dialogClassName="modal-dialog-centered modal-xl"
            dialogStyle={{ maxWidth: "820px", width: "95%" }}
          >
            <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
              <DialogTitle className="fw-semibold">Nueva venta</DialogTitle>
            </DialogHeader>

            <div className="modal-body px-3 px-md-4">
              <div className="card shadow-sm mb-4">
                <div className="card-body p-4">
                  <h6 className="fw-semibold mb-3">Cliente</h6>

                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Buscar</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Apellido, nombre o DNI"
                        value={clienteFiltro}
                        onChange={(e) => setClienteFiltro(e.target.value)}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Cliente</label>
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
                            `${c.apellido} ${c.nombre} ${c.dni || ""}`
                              .toLowerCase()
                              .includes(clienteFiltro.toLowerCase())
                          )
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.apellido} {c.nombre}{" "}
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
                    <div className="col-12 col-md-4">
                      <label className="form-label">Fecha</label>
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
                  <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <h6 className="fw-semibold mb-0">Productos</h6>
                    {items.length > 0 && (
                      <span className="badge bg-primary-subtle text-primary">
                        {getTipoPrecioLabel(items[0].tipo_precio)}
                      </span>
                    )}
                  </div>

                  <div className="row g-3 align-items-end">
                    {items.length === 0 && (
                      <div className="col-12 col-md-4">
                        <label className="form-label">Tipo de precio</label>
                        <select
                          className="form-select"
                          value={nuevoItem.tipo_precio}
                          onChange={(e) =>
                            handleItemChange("tipo_precio", e.target.value)
                          }
                        >
                          <option value="">Seleccionar</option>
                          {tiposPrecios.map((tipo) => (
                            <option key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className={items.length === 0 ? "col-12 col-md-5" : "col-12 col-md-6"}>
                      <label className="form-label">Buscar producto</label>
                      <Input
                        type="text"
                        placeholder="Código o descripción"
                        value={productoFiltro}
                        onChange={(e) => setProductoFiltro(e.target.value)}
                      />
                    </div>
                    <div className={items.length === 0 ? "col-12 col-md-3" : "col-12 col-md-6"}>
                      <label className="form-label">Producto</label>
                      <select
                        className="form-select"
                        value={nuevoItem.productoId}
                        onChange={(e) =>
                          handleItemChange("productoId", e.target.value)
                        }
                      >
                        <option value="">Seleccionar</option>
                        {productosFiltrados.map((p) => (
                          <option key={p.id} value={p.id}>
                            {formatDescripcionProducto(p.descripcion, p.descripcion_extra)} — {codigoProducto(p)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-auto">
                      <Button
                        variant="success"
                        onClick={agregarItem}
                        disabled={!puedeAgregarProducto}
                        className="w-100 d-flex align-items-center justify-content-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Agregar
                      </Button>
                    </div>
                  </div>

                  {productoSeleccionado && (
                    <div className="d-flex flex-wrap align-items-center gap-2 mt-3 small">
                      <span className="text-muted">Código:</span>
                      <span className="fw-semibold">{codigoProducto(productoSeleccionado)}</span>
                      {productoSeleccionado.estado && (
                        <>
                          <span className="text-muted ms-2">Estado:</span>
                          <span
                            className={`badge ${
                              productoSeleccionado.estado === "SALON"
                                ? "bg-success-subtle text-success"
                                : "bg-danger-subtle text-danger"
                            }`}
                          >
                            {productoSeleccionado.estado}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {productoSeleccionado?.estado &&
                    productoSeleccionado.estado !== "SALON" && (
                      <div className="text-danger small mt-2">
                        Solo se pueden vender productos en estado SALON (actual:{" "}
                        {productoSeleccionado.estado}).
                      </div>
                    )}
                </div>
              </div>

              {items.length > 0 && (
                <div className="card shadow-sm mb-4">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                      <h6 className="fw-semibold mb-0">
                        Resumen ({items.length})
                      </h6>
                      {hayDescuentoVenta && (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={resetDescuentoVenta}
                        >
                          Quitar descuento
                        </button>
                      )}
                    </div>

                    <div className="row g-3 align-items-end mb-4">
                      <div className="col-12 col-md-5">
                        <label className="form-label">Descuento %</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="Ej: 10"
                          value={nuevoItem.porcentaje}
                          min={0}
                          max={100}
                          step={0.1}
                          onChange={(e) =>
                            handleItemChange("porcentaje", e.target.value)
                          }
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <button
                          type="button"
                          className="btn btn-success w-100"
                          onClick={aplicarDescuento}
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>

                    <div className="d-flex flex-column gap-2">
                      {items.map((item) => (
                        <div
                          key={item.productoId}
                          className="border rounded-3 p-3 bg-light d-flex justify-content-between align-items-center flex-wrap gap-2"
                        >
                          <div className="flex-grow-1">
                            <div className="fw-semibold">{item.productoNombre}</div>
                            <div className="d-flex flex-wrap align-items-center gap-2 mt-1 small">
                              <span className="text-muted">
                                Código: <span className="text-dark fw-medium">{item.productoCodigo}</span>
                              </span>
                              {item.productoEstado && (
                                <span
                                  className={`badge ${
                                    item.productoEstado === "SALON"
                                      ? "bg-success-subtle text-success"
                                      : "bg-secondary-subtle text-secondary"
                                  }`}
                                >
                                  {item.productoEstado}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-3">
                            <span className="fw-semibold">
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
                        <div className="fw-bold fs-5">
                          {hayDescuentoVenta && (
                            <span
                              className="text-muted d-block text-decoration-line-through fs-6"
                            >
                              Subtotal: $
                              {totalOriginalVenta.toLocaleString("es-AR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          )}
                          <span className="text-primary">
                            Total: $
                            {totalMostrarVenta.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            {etiquetaDescuentoVenta && (
                              <span className="text-success ms-2 fs-6">
                                {etiquetaDescuentoVenta}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
              <button
                type="button"
                className="btn btn-light border"
                onClick={limpiarFormularioVenta}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={continuarAMetodoPago}
                disabled={!ventaActual.cliente_id || items.length === 0}
              >
                Continuar
                <i className="bi bi-arrow-right ms-2"></i>
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal motivo descuento extra */}
      <Dialog
        open={mostrarModalMotivoDescuento}
        onOpenChange={(open) => {
          setMostrarModalMotivoDescuento(open);
          if (!open) {
            setDescuentoPendiente(null);
            setMotivoDescuentoExtra("");
          }
        }}
      >
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered"
          dialogStyle={{ maxWidth: "480px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3 px-3 px-md-4 pt-3">
            <DialogTitle className="fw-semibold d-flex align-items-center gap-2 mb-0">
              <i className="bi bi-percent text-warning" aria-hidden="true"></i>
              Motivo del descuento extra
            </DialogTitle>
          </DialogHeader>
          <div className="modal-body px-3 px-md-4 py-4">
            <div className="alert alert-warning d-flex align-items-start gap-2 py-2 small mb-3">
              <i
                className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"
                aria-hidden="true"
              ></i>
              <div>
                <div className="fw-semibold">
                  Descuento solicitado: {descuentoPendiente?.porcentaje ?? "—"}%
                </div>
                <div className="text-muted">
                  Máximo sin motivo: {esAdminPrivilegiado ? 50 : 15}%
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label htmlFor="motivo-descuento-extra-venta" className="form-label fw-bold mb-2">
                Motivo <span className="text-danger">*</span>
              </label>
              <textarea
                id="motivo-descuento-extra-venta"
                className="form-control"
                rows={4}
                value={motivoDescuentoExtra}
                onChange={(e) => setMotivoDescuentoExtra(e.target.value)}
                placeholder="Ej: Cliente habitual, promoción especial, acuerdo comercial..."
                autoFocus
              />
              <div className="form-text mt-2">
                Quedará registrado en la venta junto con el descuento aplicado.
              </div>
            </div>
          </div>
          <DialogFooter className="border-top pt-3 pb-3 px-3 px-md-4 d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-light border"
              onClick={() => {
                setMostrarModalMotivoDescuento(false);
                setDescuentoPendiente(null);
                setMotivoDescuentoExtra("");
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmarDescuentoExtra}
              disabled={!motivoDescuentoExtra.trim()}
            >
              <i className="bi bi-check-circle me-1"></i>
              Aplicar descuento
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para ver detalle de venta */}
      <Dialog open={!!ventaParaVer} onOpenChange={() => setVentaParaVer(null)}>
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-xl"
          dialogStyle={{ maxWidth: "900px", width: "95%" }}
        >
          {ventaParaVer && (
            <>
              {console.log("🔍 Renderizando venta:", {
                id: ventaParaVer.id,
                cuenta_destino_id: ventaParaVer.cuenta_destino_id,
                cuenta_destino_nombre: ventaParaVer.cuenta_destino_nombre
              })}
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
                      <div className="col-12 col-md-6">
                        <p className="text-muted text-uppercase small mb-1">
                          Cuenta Destino
                        </p>
                        <p className="fw-semibold text-dark mb-0">
                          {ventaParaVer.cuenta_destino_nombre ? (
                            ventaParaVer.cuenta_destino_nombre
                          ) : (
                            <span className="text-muted fst-italic">No asignada</span>
                          )}
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
                              p.descripcion ||
                              (productoCatalogo
                                ? formatDescripcionProducto(
                                    productoCatalogo.descripcion,
                                    productoCatalogo.descripcion_extra
                                  )
                                : p.producto_id);
                            const codigo =
                              p.codigo || productoCatalogo?.codigo || "—";

                            return (
                              <tr key={`${ventaParaVer.id}-${p.producto_id}`}>
                                <td className="fw-medium text-dark">{descripcion}</td>
                                <td>{codigo}</td>
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
