"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import ReactPaginate from "react-paginate";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import PresupuestoModal from "@/components/modales/presupuestoModal";
import { getApiBaseUrl } from "@/lib/api-config";
import { fetchAllProductos } from "@/lib/fetch-productos";
import { formatDescripcionProducto } from "@/lib/descripcion-producto";
import {
  inferirTipoPrecioProducto,
  normalizarTipoPrecioProducto,
  precioProductoPorTipo,
  type TipoPrecioProducto,
} from "@/lib/tipos-precio-producto";
import { fechaNegocioYmd, formatDdMmYyyyDesdeIso } from "@/lib/fecha-calendario";
import {
  observacionesParaCliente,
  observacionesParaGuardar,
} from "@/lib/presupuesto-observaciones";
import { formatPesosAr, formatMoneyAr, parseMontoInput, roundPesos } from "@/lib/money";
import { abrirWhatsAppEnvio, normalizarTelefonoWhatsapp } from "@/lib/whatsapp";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import {
  MetodoPagoSelector,
  METODO_PAGO_CUENTA_CORRIENTE_ID,
  type MetodoPagoComplemento,
} from "@/components/metodo-pago-selector";
import {
  clearScanQueue,
  peekPresupuestoImport,
  clearPresupuestoImport,
  shouldNotifyPresupuestoImport,
  shouldValidateQuoteAvailability,
  type ScanQueueRow,
} from "@/lib/scan-queue";
import {
  construirEtiquetaResumenConjunto,
  imprimirEtiquetaResumenConjunto,
} from "@/lib/imprimir-etiqueta-conjunto-completo";
import {
  isPlausibleProductBarcode,
  shouldIgnoreBarcodeTarget,
} from "@/lib/barcode-scan";
import { ConfirmDeleteDialog } from "@/components/modales/confirm-delete-dialog";
import { scheduleUndoableDelete } from "@/lib/undoable-delete";
import { useFlushUndoableDeletesOnLeave } from "@/hooks/use-flush-undoable-deletes";

// Tipos

type Cliente = {
  id: number;
  nombre: string;
  apellido: string;
  celular?: string;
  telefono?: string;
  notas?: string;
};

type Precliente = {
  id: number;
  nombre: string;
  apellido: string;
  celular: string;
};

type Producto = {
  id: number;
  descripcion: string;
  descripcion_extra?: string | null;
  codigo_barra: string;
  precio_alquiler_lista: number;
  precio_alquiler_efectivo?: number;
  precio_venta_nuevo_lista?: number;
  precio_venta_nuevo_efectivo?: number;
  precio_de_venta_medio_uso?: number;
  precio_venta?: number;
  precio_liquidacion?: number;
  inmovilizado: boolean;
  estado?: string;
  /** false = no disponible por ventana de reserva (backend); null/undefined = sin evaluar fechas */
  disponible_en_fechas?: boolean | null;
};

type ItemPresupuesto = {
  id: number;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  tipoPrecio: TipoPrecioProducto;
  precioUnitario: number;
  subtotal: number;
};

type Presupuesto = {
  id: number;
  numero: string;
  fecha_evento: string;
  cliente_id?: number | null;
  precliente_id?: number | null;
  cliente_nombre: string;
  cliente_dni?: string | null;
  es_precliente?: boolean;
  cliente_celular?: string | null;
  items: ItemPresupuesto[];
  total: number;
  estado:
    | "pendiente"
    | "aprobado"
    | "rechazado"
    | "vencido"
    | "convertido_orden"
    | "cancelada";
  observaciones: string;
  fecha_retiro?: string;
  fecha_devolucion?: string;
  categoria_evento?: string;
  nombre_agasajado?: string;
  lugar_evento?: string;
  seña_pagada?: number;
  payment_method?: string; // Cambiado de metodo_pago
  orden_id?: number | null;
  creado_por_id?: number | null;
  creado_por_nombre?: string | null;
  actualizado_por_id?: number | null;
  actualizado_por_nombre?: string | null;
};

type PresupuestoResponse = {
  id: number;
  numero: string;
  cliente_id?: number | null;
  precliente_id?: number | null;
  cliente_nombre: string;
  es_precliente?: boolean;
  fecha_evento: string;
  fecha_retiro?: string;
  fecha_devolucion?: string;
  categoria_evento?: string;
  nombre_agasajado?: string;
  lugar_evento?: string;
  observaciones?: string;
  total: number;
  estado: string;
  items: ItemPresupuesto[];
  seña_pagada?: number;
  payment_method?: string; // Cambiado de metodo_pago
  orden_id?: number | null;
  creado_por_nombre?: string | null;
  actualizado_por_nombre?: string | null;
};

export default function PresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const presupuestosPorPagina = 18;
  const offset = currentPage * presupuestosPorPagina;

  const handlePageChange = (selectedItem: { selected: number }) => {
    setCurrentPage(selectedItem.selected);
  };
  const [presupuestoActual, setPresupuestoActual] =
    useState<Presupuesto | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [presupuestoAEliminar, setPresupuestoAEliminar] =
    useState<Presupuesto | null>(null);

  useFlushUndoableDeletesOnLeave();
  const [showViewModal, setShowViewModal] = useState(false);
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [productoFiltro, setProductoFiltro] = useState("");
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] =
    useState<PresupuestoResponse | null>(null);
  const [verModoLectura, setVerModoLectura] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [metodoPago, setMetodoPago] = useState(""); // Compatibilidad
  const [metodoPagoId, setMetodoPagoId] = useState<number | null>(null);
  const [submetodoPagoId, setSubmetodoPagoId] = useState<number | null>(null);
  const [totalConDescuento, setTotalConDescuento] = useState<number | null>(
    null
  );
  const [porcentajeDescuento, setPorcentajeDescuento] = useState<number | null>(
    null
  );
  const [motivoDescuentoExtra, setMotivoDescuentoExtra] = useState<string>("");
  const [mostrarModalMotivoDescuento, setMostrarModalMotivoDescuento] = useState(false);
  const [descuentoPendiente, setDescuentoPendiente] = useState<{
    porcentaje: number;
    total: number;
  } | null>(null);

  const { me, loading } = useAuth();
  const esAdmin =
    me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";
  if (loading) return null;

  // Métodos de pago consistentes con ventas
  const metodosPago = [
    { value: "EFECTIVO", label: "Efectivo" },
    { value: "DEBITO", label: "Débito" },
    { value: "CREDITO", label: "Crédito" },
    { value: "BILLETERA_VIRTUAL", label: "Transferencia" },
    { value: "TRANSFERENCIA", label: "Transferencia" },
  ];
  const [eventos, setEventos] = useState<string[]>([]);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [formData, setFormData] = useState<{
    clienteId: string;
    preclienteId?: number | null;
    observaciones: string;
    fechaEvento: string;
    fechaRetiro: string;
    fechaDevolucion: string;
    categoria: string;
    agasajado: string;
    lugar: string;
  }>({
    clienteId: "",
    preclienteId: null,
    observaciones: "",
    fechaEvento: "",
    fechaRetiro: "",
    fechaDevolucion: "",
    categoria: "",
    agasajado: "",
    lugar: "",
  });

  const [preclientes, setPreclientes] = useState<Precliente[]>([]);
  const [modoClientePrecliente, setModoClientePrecliente] = useState<"cliente" | "precliente">("cliente");
  const [preclienteForm, setPreclienteForm] = useState({ nombre: "", apellido: "", telefono: "" });
  const [preclienteNombreSeleccionado, setPreclienteNombreSeleccionado] = useState<string | null>(null);
  const preclienteIdRef = useRef<number | null>(null);

  /** Fuente única de verdad: quién está seleccionado para este presupuesto (cliente o precliente). Usado en resumen, guardado y UI. */
  const [clienteOPreclienteSeleccionado, setClienteOPreclienteSeleccionado] = useState<
    { tipo: "cliente"; id: number; nombre: string } | { tipo: "precliente"; id: number; nombre: string } | null
  >(null);

  const [items, setItems] = useState<ItemPresupuesto[]>([]);
  /** Confirmación explícita del administrador para omitir conflictos entre reservas. */
  const ignorarConflictosReservaRef = useRef(false);
  const [tipoPrecioPresupuesto, setTipoPrecioPresupuesto] =
    useState<TipoPrecioProducto>("precio_alquiler_lista");
  const [avisoAgregarProducto, setAvisoAgregarProducto] = useState<string | null>(
    null
  );
  const [nuevoItem, setNuevoItem] = useState({
    productoId: "",
    porcentaje: "",
  });

  const [modalSeniaAbierto, setModalSeniaAbierto] = useState(false);
  const [conjuntoSeparadoSenia, setConjuntoSeparadoSenia] = useState(false);
  const [senia, setSenia] = useState("");
  const [cuentaDestinoId, setCuentaDestinoId] = useState<number | null>(null);
  const [cuentasDestino, setCuentasDestino] = useState<Array<{ id: number; nombre_titular: string; sucursal_id: number }>>([]);
  const [presupuestoAConvertir, setPresupuestoAConvertir] = useState<{
    id: number;
    cliente: string;
    cliente_nombre: string;
    total: number;
    cliente_id?: number | null;
    es_precliente?: boolean;
    items: ItemPresupuesto[];
    fecha_evento: string;
    fecha_retiro: string;
    categoria_evento: string;
    lugar_evento: string;
  } | null>(null);
  const [saldoClienteSenia, setSaldoClienteSenia] = useState(0);
  const [metodoPagoComplementoSenia, setMetodoPagoComplementoSenia] =
    useState<MetodoPagoComplemento | null>(null);
  const [modalEtiquetaResumenOrdenAbierto, setModalEtiquetaResumenOrdenAbierto] =
    useState(false);
  const [ordenResumenPendiente, setOrdenResumenPendiente] = useState<{
    ordenId: number;
    clienteNombre: string;
    fechaRetiro: string;
    fechaEvento: string;
    categoriaEvento: string;
    lugarEvento: string;
    productos: Array<{
      linea: string | null;
      talle: string | null;
      color: string | null;
      descripcion: string;
      cantidad: number;
    }>;
  } | null>(null);
  const [imprimiendoEtiquetaResumenOrden, setImprimiendoEtiquetaResumenOrden] =
    useState(false);

  /** True si el modal se abrió importando ítems desde la cola del dashboard; al guardar OK se vacía localStorage. */
  const importedFromQueueRef = useRef(false);
  /** Ítems de la cola pendientes de validar cuando haya fechas cargadas. */
  const pendingQueueImportRef = useRef<ScanQueueRow[] | null>(null);
  const nuevoPresupuestoRef = useRef<() => void>(() => {});
  const abrirPresupuestoEdicionRef = useRef<(p: Presupuesto) => void>(() => {});

  const API_BASE = getApiBaseUrl();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const adaptPresupuestoDesdeApi = useCallback((p: any): Presupuesto => {
    const items = (p.items ?? []).map((item: any) => {
      const productoId =
        item.productoId ?? item.producto_id ?? item.producto?.id ?? 0;
      const precioUnitario =
        item.precioUnitario ??
        item.precio_unitario ??
        item.producto?.precio_alquiler_lista ??
        0;
      const cantidad = item.cantidad ?? 0;
      const subtotal = item.subtotal ?? cantidad * precioUnitario;
      const productoPrecios = {
        precio_alquiler_lista:
          item.producto?.precio_alquiler_lista ?? precioUnitario,
        precio_alquiler_efectivo: item.producto?.precio_alquiler_efectivo,
        precio_venta_nuevo_lista: item.producto?.precio_venta_nuevo_lista,
        precio_venta_nuevo_efectivo: item.producto?.precio_venta_nuevo_efectivo,
        precio_de_venta_medio_uso: item.producto?.precio_de_venta_medio_uso,
        precio_venta: item.producto?.precio_venta,
        precio_liquidacion: item.producto?.precio_liquidacion,
      };
      const tipoPrecio: TipoPrecioProducto = item.tipoPrecio
        ? normalizarTipoPrecioProducto(item.tipoPrecio)
        : inferirTipoPrecioProducto(productoPrecios, precioUnitario);
      return {
        id: item.id ?? `${productoId}-${cantidad}`,
        productoId,
        productoNombre:
          item.productoNombre ??
          item.producto_nombre ??
          item.producto_descripcion ??
          item.descripcion ??
          item.producto?.descripcion ??
          "Producto",
        cantidad,
        tipoPrecio,
        precioUnitario,
        subtotal,
      };
    });
    return {
      ...p,
      orden_id: p.orden_id ?? null,
      items,
    };
  }, []);

  useEffect(() => {
    fetchClientes();
    fetchProductos();
    fetchPresupuestos();
  }, []);

  useEffect(() => {
    if (!modalSeniaAbierto || !presupuestoAConvertir?.cliente_id) {
      setSaldoClienteSenia(0);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;
    const cid = Number(presupuestoAConvertir.cliente_id);
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/pagos/saldo/${cid}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        if (r.ok) {
          const j = await r.json();
          if (j.cliente_id != null && Number(j.cliente_id) !== cid) {
            console.warn("[seña] saldo: respuesta con cliente_id distinto al pedido", j.cliente_id, cid);
          }
          const s = Number(j.saldo_actual);
          setSaldoClienteSenia(Number.isFinite(s) ? Math.round(s) : 0);
        } else {
          setSaldoClienteSenia(0);
        }
      } catch {
        if (ac.signal.aborted) return;
        setSaldoClienteSenia(0);
      }
    })();
    return () => ac.abort();
  }, [modalSeniaAbierto, presupuestoAConvertir?.cliente_id, API_BASE]);

  // Mantener el ref sincronizado con el precliente seleccionado (por si el estado se pierde en algún render)
  useEffect(() => {
    if (formData.preclienteId != null && formData.preclienteId !== undefined) {
      preclienteIdRef.current = Number(formData.preclienteId);
    }
  }, [formData.preclienteId]);

  // Nombre para el resumen: fuente única clienteOPreclienteSeleccionado o presupuesto en vista
  const resumenClienteNombre =
    clienteOPreclienteSeleccionado?.nombre ??
    presupuestoSeleccionado?.cliente_nombre ??
    "-";

  const fetchClientes = async () => {
    try {
      const token = localStorage.getItem("token"); // o donde guardes el token JWT
      const res = await fetch(`${API_BASE}/clientes/all`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // agregas el Bearer token aquí
        },
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setClientes(data);
    } catch (error) {
      console.error("Error fetching clientes:", error);
    }
  };

  const fetchProductos = useCallback(
    async (opts?: {
      fechaRetiro?: string;
      fechaDevolucion?: string;
      ordenExcluirId?: number;
    }) => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const params: Record<string, string | number> = {};
        if (opts?.fechaRetiro && opts?.fechaDevolucion) {
          params.fecha_retiro = opts.fechaRetiro;
          params.fecha_devolucion = opts.fechaDevolucion;
        }
        if (opts?.ordenExcluirId != null) {
          params.orden_excluir_id = opts.ordenExcluirId;
        }
        const data = (await fetchAllProductos(token, params)) as Producto[];
        setProductos(data);
      } catch (error) {
        console.error("Error fetching productos:", error);
      }
    },
    []
  );

  const fechasAlquilerEfectivas = useCallback(() => {
    const fechaEvento = fechaNegocioYmd(formData.fechaEvento);
    const fechaRetiro =
      fechaNegocioYmd(formData.fechaRetiro) || fechaEvento || "";
    const fechaDevolucion =
      fechaNegocioYmd(formData.fechaDevolucion) || fechaEvento || "";
    return { fechaEvento, fechaRetiro, fechaDevolucion };
  }, [formData.fechaEvento, formData.fechaRetiro, formData.fechaDevolucion]);

  useEffect(() => {
    if (!showModal || verModoLectura) return;
    const { fechaRetiro, fechaDevolucion } = fechasAlquilerEfectivas();
    const ordenExcluirId = presupuestoSeleccionado?.orden_id ?? undefined;
    if (fechaRetiro && fechaDevolucion) {
      void fetchProductos({
        fechaRetiro,
        fechaDevolucion,
        ordenExcluirId,
      });
    } else {
      void fetchProductos({ ordenExcluirId });
    }
  }, [
    showModal,
    verModoLectura,
    formData.fechaEvento,
    formData.fechaRetiro,
    formData.fechaDevolucion,
    presupuestoSeleccionado?.orden_id,
    fetchProductos,
    fechasAlquilerEfectivas,
  ]);

  const fetchPreclientes = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/preclientes/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setPreclientes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error fetching preclientes:", e);
      setPreclientes([]);
    }
  };

  const handleClienteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value;
    if (!raw) {
      preclienteIdRef.current = null;
      setClienteOPreclienteSeleccionado(null);
      setFormData((prev) => ({ ...prev, clienteId: "", preclienteId: null }));
      setPreclienteNombreSeleccionado(null);
      return;
    }
    if (raw.startsWith("p-")) {
      const id = Number(raw.slice(2));
      const p = preclientes.find((x) => Number(x.id) === id);
      if (p) {
        const nombre = `${p.apellido} ${p.nombre}`.trim();
        preclienteIdRef.current = id;
        setClienteOPreclienteSeleccionado({ tipo: "precliente", id, nombre });
        setFormData((prev) => ({ ...prev, preclienteId: id, clienteId: "" }));
        setPreclienteNombreSeleccionado(nombre);
      }
      return;
    }
    const idStr = raw.startsWith("c-") ? raw.slice(2) : raw;
    preclienteIdRef.current = null;
    setFormData((prev) => ({ ...prev, clienteId: idStr, preclienteId: null }));
    setPreclienteNombreSeleccionado(null);
    const c = clientes.find((x) => String(x.id) === idStr);
    setClienteOPreclienteSeleccionado(
      c ? { tipo: "cliente", id: c.id, nombre: `${c.apellido} ${c.nombre}`.trim() } : null
    );
  };

  const selectClientePreclienteValue =
    clienteOPreclienteSeleccionado?.tipo === "cliente"
      ? `c-${clienteOPreclienteSeleccionado.id}`
      : clienteOPreclienteSeleccionado?.tipo === "precliente"
        ? `p-${clienteOPreclienteSeleccionado.id}`
        : "";

  const crearPreclienteYUsar = async () => {
    const { nombre, apellido, telefono } = preclienteForm;
    if (!nombre.trim() || !apellido.trim() || !telefono.trim()) {
      toast.error("Completá nombre, apellido y teléfono del precliente.");
      return;
    }
    const telNorm = telefono.replace(/\s/g, "");
    const yaExiste = preclientes.some((p) => (p.celular || "").replace(/\s/g, "") === telNorm);
    if (yaExiste) {
      toast.error("Ya existe un precliente con este teléfono. Seleccionalo del listado.");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/preclientes/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          celular: telefono.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success || !data.data?.id) {
        toast.error(data.message || "Error al crear el precliente.");
        return;
      }
      const id = Number(data.data.id);
      const nombreCompleto = `${apellido.trim()} ${nombre.trim()}`.trim();
      const nuevoPrecliente: Precliente = {
        id,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        celular: telefono.trim(),
      };
      preclienteIdRef.current = id;
      flushSync(() => {
        setPreclientes((prev) => (prev.some((p) => Number(p.id) === id) ? prev : [...prev, nuevoPrecliente]));
        setClienteOPreclienteSeleccionado({ tipo: "precliente", id, nombre: nombreCompleto });
        setFormData((prev) => ({ ...prev, preclienteId: id, clienteId: "" }));
        setPreclienteNombreSeleccionado(nombreCompleto);
        setModoClientePrecliente("cliente");
        setPreclienteForm({ nombre: "", apellido: "", telefono: "" });
      });
      fetchPreclientes().catch(() => {}); // actualizar en segundo plano; no mostrar error para no tapar el éxito
      toast("Precliente creado", {
        duration: 4000,
        unstyled: true,
        style: {
          background: "#dcfce7",
          borderLeft: "4px solid #16a34a",
          color: "#166534",
          padding: "12px 16px",
          borderRadius: "8px",
          fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        },
        className: "toast-precliente-ok",
      });
    } catch (e) {
      console.error(e);
      toast.error("Error de conexión al crear el precliente.");
    }
  };

  const handleItemChange = (name: string, value: string | number) => {
    setAvisoAgregarProducto(null);
    setNuevoItem((prev) => ({ ...prev, [name]: value }));
  };

  const handleProductoFiltroChange = (value: string) => {
    setAvisoAgregarProducto(null);
    setProductoFiltro(value);
  };

  const ordenExcluirDisponibilidadQuery = () => {
    const oid = presupuestoSeleccionado?.orden_id;
    return oid != null ? `&orden_excluir_id=${encodeURIComponent(String(oid))}` : "";
  };

  const normalizarProductoDesdeApi = (raw: Record<string, unknown>): Producto => ({
    id: Number(raw.id),
    descripcion: String(raw.descripcion ?? ""),
    descripcion_extra:
      raw.descripcion_extra != null ? String(raw.descripcion_extra) : null,
    codigo_barra: String(raw.codigo_barra ?? ""),
    precio_alquiler_lista: Number(raw.precio_alquiler_lista ?? 0),
    precio_alquiler_efectivo: Number(raw.precio_alquiler_efectivo ?? 0),
    precio_venta_nuevo_lista: Number(raw.precio_venta_nuevo_lista ?? 0),
    precio_venta_nuevo_efectivo: Number(raw.precio_venta_nuevo_efectivo ?? 0),
    precio_de_venta_medio_uso: Number(raw.precio_de_venta_medio_uso ?? 0),
    precio_venta: Number(raw.precio_venta ?? 0),
    precio_liquidacion: Number(raw.precio_liquidacion ?? 0),
    inmovilizado: Boolean(raw.inmovilizado),
    estado: raw.estado != null ? String(raw.estado) : undefined,
    disponible_en_fechas:
      raw.disponible_en_fechas === true
        ? true
        : raw.disponible_en_fechas === false
          ? false
          : null,
  });

  const validarProductoParaAgregar = useCallback(async (
    producto: Producto,
    itemsActuales: ItemPresupuesto[]
  ): Promise<string | null> => {
    const { fechaEvento, fechaRetiro, fechaDevolucion } = fechasAlquilerEfectivas();
    const nombre = formatDescripcionProducto(
      producto.descripcion,
      producto.descripcion_extra
    );

    if (itemsActuales.some((i) => i.productoId === producto.id)) {
      return "Este producto ya está en el presupuesto (cada prenda es única).";
    }

    if (producto.inmovilizado) {
      return `El producto ${nombre} no está disponible (inmovilizado).`;
    }

    const estado = (producto.estado ?? "").trim().toUpperCase();
    if (estado && estado !== "SALON") {
      return `El producto ${nombre} no está disponible (estado actual: ${estado}). Debe estar en salón.`;
    }

    if (
      !shouldValidateQuoteAvailability(
        fechaEvento,
        fechaRetiro,
        fechaDevolucion
      )
    ) {
      return null;
    }

    if (producto.disponible_en_fechas === false) {
      if (!esAdmin) {
        return `El producto ${nombre} no está disponible en las fechas elegidas (reservado en otra orden).`;
      }
      if (
        !ignorarConflictosReservaRef.current &&
        !window.confirm(
          `${nombre} está dentro de la ventana de seguridad de otra reserva.\n\n` +
            "Como administrador podés omitir este bloqueo. ¿Agregarlo de todos modos?"
        )
      ) {
        return "No se agregó el producto porque se mantuvo el bloqueo de seguridad.";
      }
      ignorarConflictosReservaRef.current = true;
      return null;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE}/productos/${producto.id}/disponibilidad?fecha_retiro=${encodeURIComponent(fechaRetiro)}&fecha_devolucion=${encodeURIComponent(fechaDevolucion)}${ordenExcluirDisponibilidadQuery()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) {
        return "No se pudo verificar la disponibilidad. Intentá de nuevo.";
      }
      const data = (await res.json()) as { disponible?: boolean };
      if (!data.disponible) {
        if (!esAdmin) {
          return `El producto ${nombre} no está disponible en las fechas elegidas (conflicto con otra reserva).`;
        }
        if (
          !ignorarConflictosReservaRef.current &&
          !window.confirm(
            `${nombre} está dentro de la ventana de seguridad de otra reserva.\n\n` +
              "Como administrador podés omitir este bloqueo. ¿Agregarlo de todos modos?"
          )
        ) {
          return "No se agregó el producto porque se mantuvo el bloqueo de seguridad.";
        }
        ignorarConflictosReservaRef.current = true;
      }
    } catch (error) {
      console.error("Error al verificar disponibilidad", error);
      return "No se pudo verificar la disponibilidad. Intentá de nuevo.";
    }

    return null;
  }, [fechasAlquilerEfectivas, presupuestoSeleccionado?.orden_id, items, esAdmin]);

  const resetCamposAgregarProducto = useCallback(() => {
    setProductoFiltro("");
    setNuevoItem((prev) => ({ ...prev, productoId: "" }));
  }, []);

  const appendItemPresupuesto = (producto: Producto) => {
    if (items.some((i) => i.productoId === producto.id)) {
      return;
    }
    const tipoPrecio = tipoPrecioPresupuesto;
    const precioUnitario = precioProductoPorTipo(producto, tipoPrecio);
    const newItem: ItemPresupuesto = {
      id: Date.now(),
      productoId: producto.id,
      productoNombre: formatDescripcionProducto(
        producto.descripcion,
        producto.descripcion_extra
      ),
      cantidad: 1,
      tipoPrecio,
      precioUnitario,
      subtotal: precioUnitario,
    };
    setItems((prev) => [...prev, newItem]);
    setNuevoItem({ productoId: "", porcentaje: "" });
  };

  const agregarProductoAlPresupuesto = useCallback(
    async (producto: Producto): Promise<boolean> => {
      const error = await validarProductoParaAgregar(producto, items);
      if (error) {
        setAvisoAgregarProducto(error);
        resetCamposAgregarProducto();
        return false;
      }
      setAvisoAgregarProducto(null);
      appendItemPresupuesto(producto);
      resetCamposAgregarProducto();
      return true;
    },
    [items, validarProductoParaAgregar, resetCamposAgregarProducto]
  );

  const resolverProductoPorCodigo = useCallback(
    async (codigoRaw: string): Promise<Producto | null> => {
    const codigo = codigoRaw.trim();
    if (!codigo) return null;

    const local = productos.find(
      (p) =>
        (p.codigo_barra ?? "").trim().toLowerCase() === codigo.toLowerCase()
    );
    if (local) return local;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE}/productos/get/${encodeURIComponent(codigo)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) return null;
      const raw = (await res.json()) as Record<string, unknown>;
      const producto = normalizarProductoDesdeApi(raw);
      setProductos((prev) =>
        prev.some((p) => p.id === producto.id) ? prev : [...prev, producto]
      );
      return producto;
    } catch {
      return null;
    }
    },
    [productos]
  );

  const agregarPorCodigoBarra = useCallback(
    async (codigoRaw: string) => {
      const codigo = codigoRaw.trim();
      if (!codigo) return;
      const producto = await resolverProductoPorCodigo(codigo);
      if (!producto) {
        setAvisoAgregarProducto("Código no encontrado.");
        resetCamposAgregarProducto();
        return;
      }
      await agregarProductoAlPresupuesto(producto);
    },
    [
      resolverProductoPorCodigo,
      agregarProductoAlPresupuesto,
      resetCamposAgregarProducto,
    ]
  );

  const agregarProductoPorId = useCallback(
    async (productoId: string) => {
      if (!productoId) return;
      const producto = productos.find((p) => p.id === Number(productoId));
      if (!producto) return;
      await agregarProductoAlPresupuesto(producto);
    },
    [productos, agregarProductoAlPresupuesto]
  );

  useEffect(() => {
    if (!showModal || verModoLectura) return;

    const bufferRef = { current: "" };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (shouldIgnoreBarcodeTarget(e.target)) {
        bufferRef.current = "";
        return;
      }
      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (!code || !isPlausibleProductBarcode(code)) return;
        e.preventDefault();
        void agregarPorCodigoBarra(code);
        return;
      }
      if (e.key.length === 1) {
        const ch = e.key;
        if (ch >= " " && ch <= "~") {
          bufferRef.current += ch;
          if (bufferRef.current.length > 64) {
            bufferRef.current = bufferRef.current.slice(-64);
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showModal, verModoLectura, agregarPorCodigoBarra]);

  const procesarColaPendiente = useCallback(
    async (rows: ScanQueueRow[]) => {
      let agregados = 0;
      let rechazados = 0;
      const itemsLocales = [...items];

      for (const row of rows) {
        let producto = productos.find((p) => p.id === row.productoId);
        if (!producto) {
          const resuelto = await resolverProductoPorCodigo(row.codigoBarra);
          producto =
            resuelto ??
            ({
              id: row.productoId,
              descripcion: row.descripcion,
              codigo_barra: row.codigoBarra,
              precio_alquiler_lista: row.precio_alquiler_efectivo,
              inmovilizado: false,
            } satisfies Producto);
        }

        const error = await validarProductoParaAgregar(producto, itemsLocales);
        if (error) {
          toast.error(`${row.descripcion}: ${error}`);
          rechazados += 1;
          continue;
        }

        const tipoPrecio = tipoPrecioPresupuesto;
        const precioUnitario = precioProductoPorTipo(producto, tipoPrecio);
        itemsLocales.push({
          id: Date.now() + itemsLocales.length,
          productoId: producto.id,
          productoNombre: formatDescripcionProducto(
            producto.descripcion,
            producto.descripcion_extra
          ),
          cantidad: 1,
          tipoPrecio,
          precioUnitario,
          subtotal: precioUnitario,
        });
        agregados += 1;
      }

      if (agregados > 0) {
        setItems(itemsLocales);
        clearPresupuestoImport();
        toast.success(
          `Se agregaron ${agregados} prenda(s) de la cola del escáner.`
        );
      }
      if (rechazados > 0) {
        toast.warning(
          `${rechazados} prenda(s) de la cola no se pudieron agregar.`
        );
      }
      if (agregados === 0 && rechazados > 0) {
        clearPresupuestoImport();
      }
    },
    [items, productos, tipoPrecioPresupuesto, validarProductoParaAgregar]
  );

  useEffect(() => {
    const pending = pendingQueueImportRef.current;
    if (!showModal || verModoLectura || !pending?.length) return;

    pendingQueueImportRef.current = null;
    void procesarColaPendiente(pending);
  }, [
    showModal,
    verModoLectura,
    procesarColaPendiente,
  ]);

  const eliminarItem = (id: number) => {
    setItems(items.filter((item) => item.id !== Number(id)));
  };

  const cambiarTipoPrecioPresupuesto = (tipo: TipoPrecioProducto) => {
    const tipoNorm = normalizarTipoPrecioProducto(tipo);
    setTipoPrecioPresupuesto(tipoNorm);
    setItems((prev) =>
      prev.map((item) => {
        const producto = productos.find((p) => p.id === item.productoId);
        const precioUnitario = producto
          ? precioProductoPorTipo(producto, tipoNorm)
          : item.precioUnitario;
        return {
          ...item,
          tipoPrecio: tipoNorm,
          precioUnitario,
          subtotal: precioUnitario * item.cantidad,
        };
      })
    );
    setTotalConDescuento(null);
    setPorcentajeDescuento(null);
  };

  const calcularTotal = () => {
    return items.reduce((total, item) => total + item.subtotal, 0);
  };

  const nuevoPresupuesto = () => {
    ignorarConflictosReservaRef.current = false;
    setPresupuestoActual(null);
    setPresupuestoSeleccionado(null);
    setVerModoLectura(false);
    preclienteIdRef.current = null;
    setClienteOPreclienteSeleccionado(null);
    setFormData({
      clienteId: "",
      preclienteId: null,
      observaciones: "",
      fechaEvento: "",
      fechaRetiro: "",
      fechaDevolucion: "",
      categoria: "",
      agasajado: "",
      lugar: "",
    });
    setPreclienteNombreSeleccionado(null);
    setModoClientePrecliente("cliente");
    setPreclienteForm({ nombre: "", apellido: "", telefono: "" });
    setItems([]);
    setTipoPrecioPresupuesto("precio_alquiler_lista");
    setAvisoAgregarProducto(null);
    setProductoFiltro("");
    setNuevoItem({ productoId: "", porcentaje: "" });
    setTotalConDescuento(null);
    setPorcentajeDescuento(null);
    setShowModal(true);
    fetchPreclientes();
  };

  nuevoPresupuestoRef.current = nuevoPresupuesto;

  useEffect(() => {
    const rows = peekPresupuestoImport();
    if (!rows?.length) return;
    // No borrar acá: React Strict Mode remonta y volvería a necesitar el payload.
    // Se limpia en clearPresupuestoImport tras agregar prendas (o al guardar).

    importedFromQueueRef.current = true;
    pendingQueueImportRef.current = rows;

    flushSync(() => {
      nuevoPresupuestoRef.current();
    });
    flushSync(() => {
      setProductos((prev) => {
        const next = [...prev];
        for (const row of rows) {
          if (!next.some((p) => p.id === row.productoId)) {
            next.push({
              id: row.productoId,
              descripcion: row.descripcion,
              codigo_barra: row.codigoBarra,
              precio_alquiler_lista: row.precio_alquiler_efectivo,
              inmovilizado: false,
            });
          }
        }
        return next;
      });
    });
    if (shouldNotifyPresupuestoImport(rows)) {
      toast.info(
        "Cotización rápida cargada. Ya podés ver las prendas y el total; completá los datos solo si el cliente acepta."
      );
    }
  }, [pathname]);

  const guardarPresupuesto = async () => {
    const sel = clienteOPreclienteSeleccionado;
    const tieneCliente = sel?.tipo === "cliente";
    const tienePrecliente = sel?.tipo === "precliente";
    const preclienteId = sel?.tipo === "precliente" ? sel.id : formData.preclienteId ?? preclienteIdRef.current;
    const faltan: string[] = [];
    if (!tieneCliente && !tienePrecliente) faltan.push("seleccioná un cliente o cargá/elegí un precliente");
    if (items.length === 0) faltan.push("al menos un ítem");
    if (!formData.fechaEvento) faltan.push("fecha del evento");
    if (!formData.categoria) faltan.push("categoría del evento");
    if (faltan.length > 0) {
      toast.error("Completá lo que falta: " + faltan.join(", "));
      return;
    }

    const totalOriginal = calcularTotal();
    const tieneDescuento =
      totalConDescuento !== null && porcentajeDescuento !== null;
    const totalFinal = tieneDescuento
      ? (totalConDescuento as number)
      : totalOriginal;

    let itemsParaEnviar = [...items];

    if (tieneDescuento && totalOriginal > 0) {
      const factor = totalFinal / totalOriginal;

      let acumulado = 0;
      itemsParaEnviar = items.map((item, index) => {
        let nuevoSubtotal = Math.round(item.subtotal * factor);

        if (index === items.length - 1) {
          const diferencia = totalFinal - (acumulado + nuevoSubtotal);
          nuevoSubtotal += diferencia;
        }

        acumulado += nuevoSubtotal;

        const nuevoPrecioUnitario = nuevoSubtotal / item.cantidad;

        return {
          ...item,
          precioUnitario: nuevoPrecioUnitario,
          subtotal: nuevoSubtotal,
        };
      });
    }

    const descuentoMaximoEstandar = esAdmin ? 50 : 15; // 50% para admin, 15% para empleados
    const tieneDescuentoExtra = porcentajeDescuento !== null && porcentajeDescuento > descuentoMaximoEstandar;

    const payload: Record<string, unknown> = {
      fecha_evento: fechaNegocioYmd(formData.fechaEvento) || formData.fechaEvento,
      fecha_retiro: formData.fechaRetiro
        ? fechaNegocioYmd(formData.fechaRetiro) || formData.fechaRetiro
        : null,
      fecha_devolucion: formData.fechaDevolucion
        ? fechaNegocioYmd(formData.fechaDevolucion) || formData.fechaDevolucion
        : null,
      categoria_evento: formData.categoria,
      nombre_agasajado: formData.agasajado,
      lugar_evento: formData.lugar,
      observaciones: observacionesParaGuardar(formData.observaciones),
      ignorar_conflictos_reserva:
        esAdmin && ignorarConflictosReservaRef.current,
      items: itemsParaEnviar.map((item) => ({
        producto_id: item.productoId,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        subtotal: item.subtotal,
      })),
      extra_discount_percentage: tieneDescuentoExtra ? porcentajeDescuento : null,
      extra_discount_amount: tieneDescuentoExtra ? (totalOriginal - totalFinal) : null,
      extra_discount_reason: tieneDescuentoExtra ? motivoDescuentoExtra : null,
    };
    if (tienePrecliente && preclienteId != null) {
      (payload as any).precliente_id = Number(preclienteId);
    } else if (tieneCliente && sel?.tipo === "cliente") {
      (payload as any).cliente_id = sel.id;
    } else {
      (payload as any).cliente_id = parseInt(formData.clienteId, 10);
    }

    const editando =
      Boolean(presupuestoSeleccionado?.id) && !verModoLectura;
    const url = editando
      ? `${API_BASE}/presupuestos/${presupuestoSeleccionado!.id}`
      : `${API_BASE}/presupuestos/`;
    const method = editando ? "PUT" : "POST";

    try {
      toast.loading("Guardando presupuesto...", { id: "guardar-presupuesto" });
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();

      if (res.ok) {
        try {
          JSON.parse(responseText);
        } catch {
          // Respuesta OK pero no es JSON
        }
        toast.success(
          editando ? "Presupuesto actualizado correctamente" : "Presupuesto generado correctamente",
          { id: "guardar-presupuesto" }
        );
        if (importedFromQueueRef.current) {
          clearScanQueue();
          clearPresupuestoImport();
          importedFromQueueRef.current = false;
        }
        preclienteIdRef.current = null;
        setClienteOPreclienteSeleccionado(null);
        setPresupuestoSeleccionado(null);
        setShowModal(false);
        setTotalConDescuento(null);
        setPorcentajeDescuento(null);
        setMotivoDescuentoExtra("");
        fetchPresupuestos();
      } else {
        let mensaje = "Error al guardar presupuesto";
        try {
          const errorData = JSON.parse(responseText);
          const detail = errorData.detail;
          if (Array.isArray(detail) && detail.length > 0) {
            mensaje = detail.map((d: { msg?: string; loc?: string[] }) => d.msg || (d.loc && d.loc.join(" ")) || "").filter(Boolean).join(". ") || mensaje;
          } else if (detail && typeof detail === "string") {
            mensaje = detail;
          } else if (errorData.message) {
            mensaje = errorData.message;
          }
        } catch {
          if (responseText) mensaje = responseText.slice(0, 200);
        }
        console.error("Error al guardar presupuesto:", res.status, responseText);
        toast.error(mensaje, { id: "guardar-presupuesto" });
      }
    } catch (error) {
      console.error("Error de conexión:", error);
      toast.error("Error de conexión al guardar presupuesto", { id: "guardar-presupuesto" });
    }
  };

  const fetchPresupuestos = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/presupuestos/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Respuesta inválida:", res.status, errText);
        throw new Error("Error al obtener presupuestos");
      }

      const data = await res.json();
      console.log("Presupuestos desde backend:", data);
      if (!Array.isArray(data)) {
        console.warn("La respuesta de presupuestos no es un array:", data);
        setPresupuestos([]); // Prevención
      } else {
        const presupuestosAdaptados = data.map(adaptPresupuestoDesdeApi);

        setPresupuestos(presupuestosAdaptados);
      }
    } catch (error) {
      console.error("Error en fetchPresupuestos:", error);
      setPresupuestos([]); // Prevención adicional
    } finally {
      setCargando(false);
    }
  };

  // Normalizar texto para búsqueda (minúsculas, sin acentos)
  const normalizarParaBusqueda = (s: string): string =>
    (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();

  useEffect(() => {
    setCurrentPage(0);
  }, [busqueda]);

  // Filtrar presupuestos por DNI, apellido solo, nombre solo o apellido + nombre
  const presupuestosFiltrados = (() => {
    const termino = normalizarParaBusqueda(busqueda);
    if (!termino) return presupuestos;
    return presupuestos.filter((p) => {
      const nombreCompleto = (p.cliente_nombre ?? "").trim();
      const dni = (p.cliente_dni ?? "").toString().trim();
      if (normalizarParaBusqueda(dni).includes(termino)) return true;
      const partes = nombreCompleto.split(/\s+/).filter(Boolean);
      const apellido = partes[0] ?? "";
      const nombre = partes.slice(1).join(" ") ?? "";
      const apellidoNorm = normalizarParaBusqueda(apellido);
      const nombreNorm = normalizarParaBusqueda(nombre);
      const completoNorm = normalizarParaBusqueda(nombreCompleto);
      return (
        apellidoNorm.includes(termino) ||
        nombreNorm.includes(termino) ||
        completoNorm.includes(termino)
      );
    });
  })();
  const presupuestosPaginados = presupuestosFiltrados.slice(
    offset,
    offset + presupuestosPorPagina
  );
  const pageCount = Math.ceil(
    presupuestosFiltrados.length / presupuestosPorPagina
  );

  const getEstadoClass = (estado: string) => {
    const e = (estado ?? "").toLowerCase().trim();
    // startsWith tolera variantes de género/número (aprobado/aprobada, etc.)
    if (e.startsWith("aprobad") || e === "convertido_orden") return "bg-success";
    if (e.startsWith("rechazad") || e.startsWith("cancelad")) return "bg-danger";
    if (e.startsWith("vencid")) return "bg-secondary";
    return "bg-warning";
  };

  const convertirEnOrden = async (
    presupuestoId: number,
    clienteNombre: string,
    metodoPago: string
  ) => {
    const señaRaw = prompt(
      `Ingrese el monto de la seña recibida de ${clienteNombre}:`
    );
    const seña = señaRaw ? parseMontoInput(señaRaw) : NaN;
    if (!señaRaw || Number.isNaN(seña) || seña <= 0) {
      alert("Monto inválido.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/ordenes/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          presupuesto_id: presupuestoId,
          seña_pagada: seña,
          payment_method: metodoPago, // Cambiado a payment_method
        }),
      });

      if (res.ok) {
        toast.success("Orden de trabajo generada con éxito.");
      } else {
        const error = await res.json();
        toast.error(`Error al generar orden: ${error.detail}`);
      }
    } catch (err) {
      console.error("Error al convertir en orden:", err);
      toast.error("Error inesperado al generar orden.");
    }
  };

  function toPresupuestoResponse(p: Presupuesto): PresupuestoResponse {
    return {
      id: p.id,
      numero: p.numero,
      cliente_id: p.cliente_id,
      precliente_id: p.precliente_id,
      cliente_nombre: p.cliente_nombre,
      es_precliente: p.es_precliente ?? false,
      fecha_evento: p.fecha_evento,
      total: p.total,
      estado: p.estado,
      items: p.items,
      observaciones: p.observaciones,
      fecha_retiro: p["fecha_retiro"] || "",
      fecha_devolucion: p["fecha_devolucion"] || "",
      categoria_evento: p["categoria_evento"] || "",
      nombre_agasajado: p["nombre_agasajado"] || "",
      lugar_evento: p["lugar_evento"] || "",
      orden_id: p.orden_id ?? null,
    };
  }

  const abrirPresupuestoInterno = (presupuesto: Presupuesto, verLectura: boolean) => {
    ignorarConflictosReservaRef.current = false;
    const pr = toPresupuestoResponse(presupuesto);
    setPresupuestoSeleccionado(pr);
    const nombre = pr.cliente_nombre?.trim();
    if (pr.es_precliente && pr.precliente_id != null && nombre) {
      setClienteOPreclienteSeleccionado({ tipo: "precliente", id: pr.precliente_id, nombre });
    } else if (pr.cliente_id != null && nombre) {
      setClienteOPreclienteSeleccionado({ tipo: "cliente", id: pr.cliente_id, nombre });
    } else {
      setClienteOPreclienteSeleccionado(null);
    }
    setFormData({
      clienteId: pr.cliente_id != null ? String(pr.cliente_id) : "",
      preclienteId: pr.precliente_id ?? null,
      fechaEvento: fechaNegocioYmd(pr.fecha_evento) || pr.fecha_evento || "",
      fechaRetiro: fechaNegocioYmd(pr.fecha_retiro || "") || pr.fecha_retiro || "",
      fechaDevolucion:
        fechaNegocioYmd(pr.fecha_devolucion || "") || pr.fecha_devolucion || "",
      categoria: pr.categoria_evento || "",
      agasajado: pr.nombre_agasajado || "",
      lugar: pr.lugar_evento || "",
      observaciones: observacionesParaGuardar(pr.observaciones),
    });

    setItems(pr.items);
    setTipoPrecioPresupuesto(
      pr.items.length > 0
        ? normalizarTipoPrecioProducto(pr.items[0].tipoPrecio)
        : "precio_alquiler_lista"
    );
    setTotalConDescuento(null);
    setPorcentajeDescuento(null);
    setVerModoLectura(verLectura);
    setShowModal(true);
  };

  const abrirPresupuestoVista = (presupuesto: Presupuesto) => {
    abrirPresupuestoInterno(presupuesto, true);
  };

  const abrirPresupuestoEdicion = (presupuesto: Presupuesto) => {
    setPresupuestoActual(presupuesto);
    abrirPresupuestoInterno(presupuesto, false);
  };

  abrirPresupuestoEdicionRef.current = abrirPresupuestoEdicion;

  useEffect(() => {
    const raw = searchParams.get("editar");
    if (!raw?.trim()) return;
    const pid = parseInt(raw, 10);
    if (Number.isNaN(pid)) return;
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/presupuestos/${pid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          toast.error("No se pudo cargar el presupuesto para editar.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const p = adaptPresupuestoDesdeApi(data);
        abrirPresupuestoEdicionRef.current(p);
        router.replace(pathname || "/presupuestos");
      } catch {
        toast.error("Error al abrir el presupuesto.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams.get("editar"), API_BASE, adaptPresupuestoDesdeApi, pathname, router]);
  const productosResumenDesdeItemsPresupuesto = (items: ItemPresupuesto[]) =>
    items.map((item) => {
      const prod = productos.find((p) => p.id === item.productoId);
      return {
        linea: null,
        talle: null,
        color: null,
        descripcion:
          item.productoNombre ||
          formatDescripcionProducto(prod?.descripcion, prod?.descripcion_extra) ||
          "Prenda",
        cantidad: item.cantidad,
      };
    });

  const abrirModalResumenTrasCrearOrden = async (
    orderId: number,
    snapshot: {
      cliente_nombre: string;
      fecha_evento: string;
      fecha_retiro: string;
      categoria_evento: string;
      lugar_evento: string;
      items: ItemPresupuesto[];
    }
  ) => {
    let productos = productosResumenDesdeItemsPresupuesto(snapshot.items);

    try {
      const resOrden = await fetch(`${API_BASE}/ordenes/${orderId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (resOrden.ok) {
        const orden = await resOrden.json();
        const reservados = orden.productos_reservados || [];
        if (reservados.length > 0) {
          productos = reservados.map(
            (pr: { producto_descripcion?: string; cantidad?: number }) => ({
              linea: null,
              talle: null,
              color: null,
              descripcion: pr.producto_descripcion || "Prenda",
              cantidad: pr.cantidad ?? 1,
            })
          );
        }
      }
    } catch (e) {
      console.warn("No se pudo cargar la orden para etiqueta resumen:", e);
    }

    if (productos.length === 0) {
      toast.info(
        "Orden creada. No hay prendas en el presupuesto para imprimir la etiqueta resumen."
      );
      return;
    }

    setOrdenResumenPendiente({
      ordenId: orderId,
      clienteNombre: snapshot.cliente_nombre,
      fechaRetiro: formatDdMmYyyyDesdeIso(snapshot.fecha_retiro) || "—",
      fechaEvento: formatDdMmYyyyDesdeIso(snapshot.fecha_evento) || "—",
      categoriaEvento: snapshot.categoria_evento || "",
      lugarEvento: snapshot.lugar_evento || "",
      productos,
    });
    setModalEtiquetaResumenOrdenAbierto(true);
  };

  const confirmarSenia = async () => {
    if (!presupuestoAConvertir) return;

    const monto = parseMontoInput(senia);
    if (isNaN(monto) || monto <= 0) {
      alert("Monto inválido.");
      return;
    }
    if (monto > roundPesos(presupuestoAConvertir.total)) {
      alert("La seña no puede ser mayor al total del presupuesto.");
      return;
    }

    if (metodoPagoId == null) {
      alert("Debes seleccionar un método de pago.");
      return;
    }

    if (
      metodoPagoId === METODO_PAGO_CUENTA_CORRIENTE_ID &&
      (!presupuestoAConvertir.cliente_id || saldoClienteSenia <= 0)
    ) {
      toast.error("No hay saldo en cuenta corriente para usar como método de pago.");
      return;
    }

    const esCC =
      metodoPagoId === METODO_PAGO_CUENTA_CORRIENTE_ID &&
      !!presupuestoAConvertir.cliente_id &&
      saldoClienteSenia > 0;
    const creditoAplicado = esCC
      ? roundPesos(Math.min(saldoClienteSenia, monto))
      : 0;
    const montoCaja = roundPesos(Math.max(monto - creditoAplicado, 0));

    if (esCC && monto > saldoClienteSenia + 1e-9 && !metodoPagoComplementoSenia?.metodoId) {
      alert("Indicá el método de pago para el importe que ingresa en caja.");
      return;
    }

    if (montoCaja > 1e-9 && !cuentaDestinoId) {
      alert("Debes seleccionar una cuenta destino.");
      return;
    }

    try {
      const cajaMetodoId = esCC ? metodoPagoComplementoSenia?.metodoId ?? null : metodoPagoId;
      const cajaSubId = esCC
        ? metodoPagoComplementoSenia?.submetodoId ?? null
        : submetodoPagoId || null;

      const res = await fetch(`${API_BASE}/ordenes/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          presupuesto_id: presupuestoAConvertir.id,
          seña_pagada: monto,
          credito_aplicado: creditoAplicado,
          metodo_pago_id: montoCaja > 1e-9 ? cajaMetodoId : null,
          submetodo_pago_id: montoCaja > 1e-9 ? cajaSubId : null,
          payment_method: null,
          cuenta_destino_id: montoCaja > 1e-9 ? cuentaDestinoId : null,
          conjunto_separado: conjuntoSeparadoSenia,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const orderId = Number(data?.data?.id ?? data?.id);
        if (!orderId || Number.isNaN(orderId)) {
          toast.error(
            "Orden creada, pero no se pudo obtener el ID para las etiquetas."
          );
          fetchPresupuestos();
          return;
        }

        const snapshotResumen = {
          cliente_nombre: presupuestoAConvertir.cliente_nombre,
          fecha_evento: presupuestoAConvertir.fecha_evento,
          fecha_retiro: presupuestoAConvertir.fecha_retiro,
          categoria_evento: presupuestoAConvertir.categoria_evento,
          lugar_evento: presupuestoAConvertir.lugar_evento,
          items: [...presupuestoAConvertir.items],
        };

        toast.success("Orden de trabajo generada con éxito.");
        setModalSeniaAbierto(false);
        setSenia("");
        setConjuntoSeparadoSenia(false);
        setCuentaDestinoId(null);
        setMetodoPago("");
        setMetodoPagoId(null);
        setSubmetodoPagoId(null);
        setMetodoPagoComplementoSenia(null);
        setPresupuestoAConvertir(null);
        fetchPresupuestos();

        await abrirModalResumenTrasCrearOrden(orderId, snapshotResumen);
      } else {
        const error = await res.json();
        toast.error(`Error al generar orden: ${error.detail}`);
      }
    } catch (err) {
      console.error("Error al generar orden:", err);
      toast.error("Error inesperado.");
    }
  };

  const imprimirEtiquetaResumenOrdenRecienCreada = async () => {
    if (!ordenResumenPendiente) return;
    setImprimiendoEtiquetaResumenOrden(true);
    try {
      const payload = construirEtiquetaResumenConjunto({
        ordenId: ordenResumenPendiente.ordenId,
        clienteNombre: ordenResumenPendiente.clienteNombre,
        fechaRetiro: ordenResumenPendiente.fechaRetiro,
        fechaEvento: ordenResumenPendiente.fechaEvento,
        categoriaEvento: ordenResumenPendiente.categoriaEvento,
        lugarEvento: ordenResumenPendiente.lugarEvento,
        productos: ordenResumenPendiente.productos,
      });
      const resultado = await imprimirEtiquetaResumenConjunto(payload);
      if (resultado.resultado === "ok") {
        const msg =
          resultado.metodo === "qz" && resultado.impresora
            ? `Etiqueta resumen enviada a ${resultado.impresora}.`
            : resultado.mensajeAyuda ||
              `Etiqueta resumen de la orden #${ordenResumenPendiente.ordenId} enviada a impresión.`;
        toast.success(msg);
        setModalEtiquetaResumenOrdenAbierto(false);
        setOrdenResumenPendiente(null);
      } else {
        toast.error("No se pudo abrir la impresión de la etiqueta resumen.");
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Error al imprimir etiqueta resumen";
      toast.error(msg);
    } finally {
      setImprimiendoEtiquetaResumenOrden(false);
    }
  };

  const solicitarEliminarPresupuesto = (p: Presupuesto) => {
    setPresupuestoAEliminar(p);
  };

  const confirmarEliminarPresupuesto = () => {
    const p = presupuestoAEliminar;
    if (!p) return;
    setPresupuestoAEliminar(null);
    const snapshot = p;
    scheduleUndoableDelete({
      id: `presupuesto-${snapshot.id}`,
      message: `Presupuesto #${snapshot.numero} eliminado`,
      description: "Podés deshacer durante 10 segundos",
      onOptimisticRemove: () => {
        setPresupuestos((prev) => prev.filter((x) => x.id !== snapshot.id));
      },
      onRestore: () => {
        setPresupuestos((prev) => {
          if (prev.some((x) => x.id === snapshot.id)) return prev;
          return [...prev, snapshot];
        });
      },
      executeDelete: async () => {
        const res = await fetch(`${API_BASE}/presupuestos/${snapshot.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.detail || "No se pudo eliminar el presupuesto");
        }
        toast.success("Presupuesto eliminado");
      },
    });
  };

  const normalizarTelefono = (telefono?: string): string | null =>
    normalizarTelefonoWhatsapp(telefono);

  const handleEnviarWhatsapp = (presupuesto: Presupuesto) => {
    const cliente = presupuesto.cliente_id != null ? clientes.find((c) => c.id === presupuesto.cliente_id) : null;
    const telefonoCliente = (cliente?.celular || cliente?.telefono) ?? presupuesto.cliente_celular ?? null;

    if (!telefonoCliente) {
      alert(
        presupuesto.es_precliente
          ? "No se encontró teléfono del precliente."
          : "No se encontró información del cliente asociado al presupuesto."
      );
      return;
    }
    const telefonoNormalizado = normalizarTelefono(telefonoCliente);
    if (!telefonoNormalizado) {
      alert("El número de teléfono del cliente es inválido.");
      return;
    }

    const nombreCliente =
      (cliente ? `${cliente.apellido ?? ""} ${cliente.nombre ?? ""}`.trim() : null) ||
      presupuesto.cliente_nombre ||
      "";

    const totalFormateado = formatPesosAr(presupuesto.total);

    const formatearFecha = (fecha?: string) => {
      if (!fecha) return null;
      const s = formatDdMmYyyyDesdeIso(fecha);
      return s || fecha;
    };

    const detalles: string[] = [];
    const fechaEvento = formatearFecha(presupuesto.fecha_evento);
    if (fechaEvento) detalles.push(`Fecha del evento: ${fechaEvento}`);

    const fechaRetiro = formatearFecha(presupuesto.fecha_retiro);
    if (fechaRetiro) detalles.push(`Fecha de retiro: ${fechaRetiro}`);

    const fechaDevolucion = formatearFecha(presupuesto.fecha_devolucion);
    if (fechaDevolucion)
      detalles.push(`Fecha de devolución: ${fechaDevolucion}`);

    if (presupuesto.categoria_evento) {
      detalles.push(`Categoría: ${presupuesto.categoria_evento}`);
    }

    if (presupuesto.nombre_agasajado) {
      detalles.push(`Agasajado/a: ${presupuesto.nombre_agasajado}`);
    }

    if (presupuesto.lugar_evento) {
      detalles.push(`Lugar: ${presupuesto.lugar_evento}`);
    }

    const obsCliente = observacionesParaCliente(presupuesto.observaciones);
    if (obsCliente) {
      detalles.push(`Observaciones: ${obsCliente}`);
    }

    const detalleProductos =
      presupuesto.items?.length > 0
        ? presupuesto.items
            .map((item, index) => {
              const nombreProducto =
                item.productoNombre ||
                (item as any).producto_descripcion ||
                "Producto";
              const cantidad =
                item.cantidad > 1 ? ` (x${item.cantidad})` : "";
              return `${index + 1}) ${nombreProducto}${cantidad}`;
            })
            .join("\n")
        : "Sin productos asociados.";

    let mensaje = `Hola ${nombreCliente}, te envío el presupuesto N° ${presupuesto.numero} por un total de $${totalFormateado}.`;

    if (detalles.length > 0) {
      mensaje += `\n\nDetalles:\n${detalles
        .map((detalle) => `- ${detalle}`)
        .join("\n")}`;
    }

    mensaje += `\n\nProductos incluidos:\n${detalleProductos}`;

    if (!abrirWhatsAppEnvio(telefonoNormalizado, mensaje)) {
      alert("El número de teléfono del cliente es inválido.");
    }
  };

  const quitarDescuento = () => {
    setTotalConDescuento(null);
    setPorcentajeDescuento(null);
    setMotivoDescuentoExtra("");
    setDescuentoPendiente(null);
    setMostrarModalMotivoDescuento(false);
    setNuevoItem((prev) => ({ ...prev, porcentaje: "" }));
  };

  const aplicarDescuento = () => {
    const total = calcularTotal();
    if (total <= 0) {
      alert("Agregá productos antes de aplicar un descuento.");
      return;
    }

    const porcentaje = Number(nuevoItem.porcentaje);
    if (!porcentaje || Number.isNaN(porcentaje) || porcentaje <= 0) {
      alert("Ingresá un porcentaje de descuento válido.");
      return;
    }
    if (porcentaje > 100) {
      alert("El descuento no puede superar el 100%.");
      return;
    }

    const descuentoMaximoEstandar = esAdmin ? 50 : 15;

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
      alert("El motivo es obligatorio para descuentos mayores al estándar.");
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

  return (
    <div className="container-fluid px-2 px-sm-3 px-md-4 py-3">
      <div className="gt-page-header d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="page-title mb-1">Presupuestos</h1>
          <p className="text-muted mb-0">Gestión y seguimiento de presupuestos.</p>
        </div>
        <button className="btn btn-oxblood d-flex align-items-center gap-2" onClick={nuevoPresupuesto}>
          <i className="bi bi-plus"></i>
          Nuevo Presupuesto
        </button>
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="card-body border-bottom">
            <label htmlFor="presupuestos-busqueda" className="form-label visually-hidden">
              Buscar por DNI, apellido, nombre o apellido y nombre
            </label>
            <div className="input-group gt-search">
              <span className="input-group-text">
                <i className="bi bi-search"></i>
              </span>
              <input
                id="presupuestos-busqueda"
                type="search"
                className="form-control"
                placeholder="Buscar por DNI, apellido, nombre o apellido y nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar presupuestos por cliente"
              />
            </div>
          </div>
          <div className="table-responsive">
            <table className="table gt-table align-middle mb-0">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Cliente</th>
                  <th>Fecha Evento</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Creado por</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {presupuestosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      {presupuestos.length === 0
                        ? "No hay presupuestos cargados."
                        : "Ningún presupuesto coincide con la búsqueda."}
                    </td>
                  </tr>
                ) : (
                  presupuestosPaginados.map((p) => (
                    <tr key={p.id}>
                      <td>{p.numero}</td>
                      <td>{p.cliente_nombre}</td>
                      <td>
                        {p.fecha_evento ? formatDdMmYyyyDesdeIso(p.fecha_evento) : "Sin fecha"}
                      </td>

                      <td>{formatMoneyAr(p.total)}</td>
                      <td>
                        <span className={`badge ${getEstadoClass(p.estado)}`}>
                          {p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
                        </span>
                      </td>
                      <td className="text-muted small">{p.creado_por_nombre || "—"}</td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                          <button
                            className="btn-action btn-action--wide btn-action--whatsapp"
                            title="Enviar por WhatsApp"
                            onClick={() => handleEnviarWhatsapp(p)}
                          >
                            <i className="bi bi-whatsapp"></i>
                            WhatsApp
                          </button>
                          <button
                            className="btn-action btn-action--wide btn-action--ver"
                            title="Ver presupuesto"
                            onClick={() => abrirPresupuestoVista(p)}
                          >
                            Ver
                          </button>
                          {p.estado.toLowerCase() !== "cancelada" && (
                            <button
                              className="btn-action btn-action--wide btn-action--editar"
                              type="button"
                              title="Editar fechas e ítems"
                              onClick={() => abrirPresupuestoEdicion(p)}
                            >
                              Editar
                            </button>
                          )}
                          {p.estado.toLowerCase() === "convertido_orden" ||
                          p.estado.toLowerCase() === "aprobado" ||
                          p.estado.toLowerCase() === "cancelada" ? (
                            <div></div>
                          ) : (
                            <button
                              className="btn-action btn-action--wide btn-action--credito"
                              title="Convertir en orden"
                              onClick={async () => {
                                setPresupuestoAConvertir({
                                  id: p.id,
                                  cliente: p.cliente_nombre,
                                  cliente_nombre: p.cliente_nombre,
                                  total: p.total,
                                  cliente_id: p.cliente_id ?? null,
                                  es_precliente: !!p.es_precliente,
                                  items: p.items ?? [],
                                  fecha_evento: p.fecha_evento,
                                  fecha_retiro: p.fecha_retiro || "",
                                  categoria_evento: p.categoria_evento || "",
                                  lugar_evento: p.lugar_evento || "",
                                });
                                setSenia("");
                                setCuentaDestinoId(null);
                                setMetodoPagoId(null);
                                setSubmetodoPagoId(null);
                                setMetodoPagoComplementoSenia(null);
                                
                                // Cargar cuentas destino activas de la sucursal del usuario
                                try {
                                  const sucursalId = me?.sucursalId || 1;
                                  const token = localStorage.getItem("token");
                                  const res = await fetch(`${API_BASE}/cuentas-destino/sucursal/${sucursalId}?solo_activas=true`, {
                                    headers: {
                                      Authorization: `Bearer ${token}`,
                                    },
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setCuentasDestino(Array.isArray(data) ? data : []);
                                  }
                                } catch (error) {
                                  console.error("Error al cargar cuentas destino:", error);
                                }
                                
                                setConjuntoSeparadoSenia(false);
                                setModalSeniaAbierto(true);
                              }}
                            >
                              Generar Orden
                            </button>
                          )}
                          {p.estado.toLowerCase() === "convertido_orden" ||
                          p.estado.toLowerCase() === "aprobado" ||
                          p.estado.toLowerCase() === "cancelada" ? (
                            <div></div>
                          ) : (
                            <button
                              className="btn-action btn-action--borrar"
                              title="Eliminar"
                              onClick={() => solicitarEliminarPresupuesto(p)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="d-flex flex-column align-items-center gap-1 px-3 py-2">
              <ReactPaginate
                previousLabel={"←"}
                nextLabel={"→"}
                breakLabel={"..."}
                pageCount={pageCount}
                onPageChange={handlePageChange}
                containerClassName={"pagination mb-0"}
                pageClassName={"page-item"}
                pageLinkClassName={"page-link"}
                previousClassName={"page-item"}
                previousLinkClassName={"page-link"}
                nextClassName={"page-item"}
                nextLinkClassName={"page-link"}
                breakClassName={"page-item"}
                breakLinkClassName={"page-link"}
                activeClassName={"active"}
                forcePage={currentPage}
              />
              <span className="text-muted small text-center">
                Mostrando {offset + 1}–
                {Math.min(offset + presupuestosPorPagina, presupuestosFiltrados.length)} de{" "}
                {presupuestosFiltrados.length} presupuestos
              </span>
            </div>
          )}
        </div>
      )}
      <PresupuestoModal
        esAdmin={esAdmin}
        show={showModal}
        verModoLectura={verModoLectura}
        presupuestoSeleccionado={presupuestoSeleccionado}
        formData={formData}
        setFormData={setFormData}
        clientes={clientes}
        clienteFiltro={clienteFiltro}
        setClienteFiltro={setClienteFiltro}
        handleClienteChange={handleClienteChange}
        selectClientePreclienteValue={selectClientePreclienteValue}
        modoClientePrecliente={modoClientePrecliente}
        setModoClientePrecliente={setModoClientePrecliente}
        preclienteForm={preclienteForm}
        setPreclienteForm={setPreclienteForm}
        preclienteNombreSeleccionado={preclienteNombreSeleccionado}
        resumenClienteNombre={resumenClienteNombre}
        clienteOPreclienteSeleccionado={clienteOPreclienteSeleccionado}
        preclientes={preclientes}
        onSelectPrecliente={(id, nombre) => {
          preclienteIdRef.current = id;
          setClienteOPreclienteSeleccionado({ tipo: "precliente", id, nombre });
          setFormData((prev) => ({ ...prev, preclienteId: id, clienteId: "" }));
          setPreclienteNombreSeleccionado(nombre);
        }}
        crearPreclienteYUsar={crearPreclienteYUsar}
        onActualizarListas={async () => {
          await Promise.all([fetchClientes(), fetchPreclientes()]);
        }}
        onClearPrecliente={() => {
          preclienteIdRef.current = null;
          setClienteOPreclienteSeleccionado(null);
          setFormData((prev) => ({ ...prev, preclienteId: null }));
          setPreclienteNombreSeleccionado(null);
        }}
        productos={productos}
        productoFiltro={productoFiltro}
        setProductoFiltro={handleProductoFiltroChange}
        avisoAgregarProducto={avisoAgregarProducto}
        nuevoItem={nuevoItem}
        handleItemChange={handleItemChange}
        agregarPorCodigoBarra={agregarPorCodigoBarra}
        agregarProductoPorId={agregarProductoPorId}
        eliminarItem={eliminarItem}
        tipoPrecioPresupuesto={tipoPrecioPresupuesto}
        cambiarTipoPrecioPresupuesto={cambiarTipoPrecioPresupuesto}
        items={items}
        calcularTotal={calcularTotal}
        guardarPresupuesto={guardarPresupuesto}
        totalConDescuento={totalConDescuento}
        porcentajeDescuento={porcentajeDescuento}
        aplicarDescuento={aplicarDescuento}
        quitarDescuento={quitarDescuento}
        onClose={() => {
          setShowModal(false);
          setVerModoLectura(false);
          setPresupuestoSeleccionado(null);
          setAvisoAgregarProducto(null);
        }}
      />

      {/* Modal de Seña */}
      <Dialog
        open={modalSeniaAbierto}
        onOpenChange={(open) => {
          setModalSeniaAbierto(open);
          if (!open) setConjuntoSeparadoSenia(false);
        }}
      >
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-lg"
          dialogStyle={{ maxWidth: "640px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
            <DialogTitle className="fw-semibold">Ingrese seña</DialogTitle>
            <DialogDescription className="mb-0">
              Seña recibida de {presupuestoAConvertir?.cliente}
            </DialogDescription>
          </DialogHeader>

          <div className="modal-body px-3 px-md-4">
            {(() => {
              const montoSenia = parseMontoInput(senia);
              const totalPresupuesto = roundPesos(presupuestoAConvertir?.total ?? 0);
              const seniaExcedeTotal =
                !!presupuestoAConvertir &&
                !Number.isNaN(montoSenia) &&
                montoSenia > totalPresupuesto;
              return (
            <div className="card shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="mb-4">
                  <label className="form-label fw-bold">Monto de la seña</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control w-100"
                    placeholder="Ingresá el monto recibido (ej: 40059 o 40.059)"
                    value={senia}
                    onChange={(e) => setSenia(e.target.value)}
                  />
                  {!!presupuestoAConvertir && (
                    <div className="small text-muted mt-2">
                      Máximo permitido: ${formatPesosAr(presupuestoAConvertir.total)}
                    </div>
                  )}
                  {seniaExcedeTotal && (
                    <div className="text-danger small mt-2">
                      La seña no puede ser mayor al total del presupuesto.
                    </div>
                  )}
                </div>

                <MetodoPagoSelector
                  sucursalId={me?.sucursalId}
                  metodoPagoId={metodoPagoId}
                  submetodoPagoId={submetodoPagoId}
                  saldoCuentaCorriente={
                    presupuestoAConvertir?.cliente_id && !presupuestoAConvertir?.es_precliente
                      ? saldoClienteSenia
                      : null
                  }
                  montoReferencia={senia ? parseMontoInput(senia) || null : null}
                  onMetodoChange={(metodoId, submetodoId, metodoDisplay, complemento) => {
                    setMetodoPagoId(metodoId);
                    setSubmetodoPagoId(submetodoId);
                    setMetodoPago(metodoDisplay);
                    setMetodoPagoComplementoSenia(complemento ?? null);
                    if (metodoDisplay && /efectivo/i.test(metodoDisplay.trim())) {
                      const cuentaEfectivo = cuentasDestino.find((c) =>
                        /efectivo/i.test((c.nombre_titular || "").trim())
                      );
                      if (cuentaEfectivo) setCuentaDestinoId(cuentaEfectivo.id);
                    }
                  }}
                  required={true}
                  showError={metodoPagoId == null}
                />

                {(() => {
                  const mt = parseMontoInput(senia || "0") || 0;
                  const esCC =
                    metodoPagoId === METODO_PAGO_CUENTA_CORRIENTE_ID &&
                    !!presupuestoAConvertir?.cliente_id &&
                    saldoClienteSenia > 0;
                  const cred = esCC ? roundPesos(Math.min(saldoClienteSenia, mt)) : 0;
                  const montoCajaUi = Math.max(mt - cred, 0);
                  return montoCajaUi > 1e-6 ? (
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
                          No hay cuentas destino activas disponibles. Contactá a un administrador.
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="small text-muted mb-0">
                      Si la seña se cubre solo con cuenta corriente, no se registra movimiento de caja.
                    </p>
                  );
                })()}

                <div className="border rounded-3 p-3 mt-3 bg-success bg-opacity-10">
                  <div className="form-check mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="conjunto-separado-senia"
                      checked={conjuntoSeparadoSenia}
                      onChange={(e) => setConjuntoSeparadoSenia(e.target.checked)}
                    />
                    <label
                      className="form-check-label fw-semibold"
                      htmlFor="conjunto-separado-senia"
                    >
                      Conjunto ya separado en perchero
                    </label>
                  </div>
                  <p className="small text-muted mb-0 mt-2 ps-4">
                    Marcá esta opción si las prendas del presupuesto ya quedaron
                    separadas y colgadas en el perchero. Quedará registrado en
                    la orden y en Reportes → Prendas a armar.
                  </p>
                </div>
              </div>
            </div>
              );
            })()}
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button
              className="btn btn-light border"
              onClick={() => {
                setModalSeniaAbierto(false);
                setConjuntoSeparadoSenia(false);
              }}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={confirmarSenia}
              disabled={(() => {
                const mt = parseMontoInput(senia || "0") || 0;
                const totalMax = roundPesos(presupuestoAConvertir?.total ?? 0);
                const esCC =
                  metodoPagoId === METODO_PAGO_CUENTA_CORRIENTE_ID &&
                  !!presupuestoAConvertir?.cliente_id &&
                  saldoClienteSenia > 0;
                const cred = esCC ? roundPesos(Math.min(saldoClienteSenia, mt)) : 0;
                const montoCajaUi = roundPesos(Math.max(mt - cred, 0));
                const faltaComplemento =
                  esCC &&
                  mt > saldoClienteSenia + 1e-9 &&
                  !metodoPagoComplementoSenia?.metodoId;
                return (
                  metodoPagoId == null ||
                  faltaComplemento ||
                  (montoCajaUi > 1e-6 && !cuentaDestinoId) ||
                  !senia ||
                  mt <= 0 ||
                  (!!presupuestoAConvertir && mt > totalMax)
                );
              })()}
            >
              Confirmar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: etiqueta resumen del conjunto al crear la orden */}
      <Dialog
        open={modalEtiquetaResumenOrdenAbierto}
        onOpenChange={(open) => {
          if (!open && !imprimiendoEtiquetaResumenOrden) {
            setModalEtiquetaResumenOrdenAbierto(false);
            setOrdenResumenPendiente(null);
          }
        }}
      >
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered"
          dialogStyle={{ maxWidth: "480px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3">
            <DialogTitle>Etiqueta resumen del conjunto</DialogTitle>
            <DialogDescription className="mb-0">
              Orden #{ordenResumenPendiente?.ordenId} ·{" "}
              {ordenResumenPendiente?.clienteNombre}
              <br />
              <span className="small">
                Imprimí la etiqueta resumen (XP-470B) para el perchero con
                cliente, fechas, evento y listado de prendas. Podés omitir y
                reimprimir después desde Reportes → Prendas a armar.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="modal-body py-3">
            <p className="mb-0 small text-muted">
              {ordenResumenPendiente?.productos.length ?? 0} prenda(s) en el
              conjunto.
            </p>
          </div>
          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-light border"
              onClick={() => {
                setModalEtiquetaResumenOrdenAbierto(false);
                setOrdenResumenPendiente(null);
              }}
              disabled={imprimiendoEtiquetaResumenOrden}
            >
              Omitir
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={() => void imprimirEtiquetaResumenOrdenRecienCreada()}
              disabled={imprimiendoEtiquetaResumenOrden}
            >
              {imprimiendoEtiquetaResumenOrden ? (
                <>
                  <i className="bi bi-arrow-clockwise spin me-2"></i>
                  Imprimiendo...
                </>
              ) : (
                <>
                  <i className="bi bi-printer-fill me-2"></i>
                  Imprimir etiqueta resumen (XP-470B)
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de motivo para descuento extra */}
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
                  Máximo sin motivo: {esAdmin ? 50 : 15}%
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label htmlFor="motivo-descuento-extra-presupuesto" className="form-label fw-bold mb-2">
                Motivo <span className="text-danger">*</span>
              </label>
              <textarea
                id="motivo-descuento-extra-presupuesto"
                className="form-control"
                rows={4}
                value={motivoDescuentoExtra}
                onChange={(e) => setMotivoDescuentoExtra(e.target.value)}
                placeholder="Ej: Cliente habitual, promoción especial, acuerdo comercial..."
                autoFocus
              />
              <div className="form-text mt-2">
                Quedará registrado en el presupuesto junto con el descuento aplicado.
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

      <ConfirmDeleteDialog
        open={presupuestoAEliminar != null}
        onOpenChange={(open) => {
          if (!open) setPresupuestoAEliminar(null);
        }}
        itemLabel={
          presupuestoAEliminar
            ? `el presupuesto #${presupuestoAEliminar.numero} (${presupuestoAEliminar.cliente_nombre})`
            : "este presupuesto"
        }
        onConfirm={confirmarEliminarPresupuesto}
      />
    </div>
  );
}
