"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import PresupuestoModal from "@/components/modales/presupuestoModal";
import { getApiBaseUrl } from "@/lib/api-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { MetodoPagoSelector } from "@/components/metodo-pago-selector";

// Tipos

type Cliente = {
  id: number;
  nombre: string;
  apellido: string;
  celular?: string;
  telefono?: string;
};

type Producto = {
  id: number;
  descripcion: string;
  codigo_barra: string;
  precio_alquiler_efectivo: number;
  inmovilizado: boolean;
  estado?: string;
};

type ItemPresupuesto = {
  id: number;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

type Presupuesto = {
  id: number;
  numero: string;
  fecha_evento: string;
  cliente_id: number;
  cliente_nombre: string;
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
};

type PresupuestoResponse = {
  id: number;
  numero: string;
  cliente_id: number;
  cliente_nombre: string;
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
};

export default function PresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [presupuestoActual, setPresupuestoActual] =
    useState<Presupuesto | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
  const [descuentoPendiente, setDescuentoPendiente] = useState<{ porcentaje: number; total: number } | null>(null);

  const { me, loading } = useAuth();
  const esAdmin = me?.role === "ADMIN";
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
  const [formData, setFormData] = useState({
    clienteId: "",
    observaciones: "",
    fechaEvento: "",
    fechaRetiro: "",
    fechaDevolucion: "",
    categoria: "",
    agasajado: "",
    lugar: "",
  });

  const [items, setItems] = useState<ItemPresupuesto[]>([]);
  const [nuevoItem, setNuevoItem] = useState({
    productoId: "",
    cantidad: 1,
    porcentaje: "",
  });

  const [modalSeniaAbierto, setModalSeniaAbierto] = useState(false);
  const [senia, setSenia] = useState("");
  const [cuentaDestinoId, setCuentaDestinoId] = useState<number | null>(null);
  const [cuentasDestino, setCuentasDestino] = useState<Array<{ id: number; nombre_titular: string; sucursal_id: number }>>([]);
  const [presupuestoAConvertir, setPresupuestoAConvertir] = useState<{
    id: number;
    cliente: string;
  } | null>(null);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    fetchClientes();
    fetchProductos();
    fetchPresupuestos();
  }, []);

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

  const fetchProductos = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/productos/all`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Error al obtener productos");

      const data = await res.json();
      console.log("Productos cargados:", data);
      setProductos(data);
    } catch (error) {
      console.error("Error fetching productos:", error);
    }
  };

  const handleClienteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, clienteId: e.target.value }));
  };

  const handleItemChange = (name: string, value: string | number) => {
    setNuevoItem((prev) => ({ ...prev, [name]: value }));
  };

  const verificarDisponibilidad = async () => {
    const { fechaRetiro, fechaDevolucion } = formData;
    const productoId = nuevoItem.productoId;

    if (!productoId || !fechaRetiro || !fechaDevolucion) {
      alert("Por favor completá las fechas y seleccioná un producto.");
      return false;
    }

    try {
      const res = await fetch(
        `${API_BASE}/productos/${productoId}/disponibilidad?fecha_retiro=${fechaRetiro}&fecha_devolucion=${fechaDevolucion}`
      );

      const data = await res.json();
      return data.disponible;
    } catch (error) {
      console.error("Error al verificar disponibilidad", error);
      alert("No se pudo verificar la disponibilidad. Intente más tarde.");
      return false;
    }
  };

  const agregarItem = async () => {
    const producto = productos.find(
      (p) => p.id === Number(nuevoItem.productoId)
    );
    if (!producto) return;

    const res = await fetch(
      `${API_BASE}/productos/${producto.id}/disponibilidad?fecha_retiro=${formData.fechaRetiro}&fecha_devolucion=${formData.fechaDevolucion}`
    );
    const data = await res.json();

    if (!data.disponible) {
      alert(
        `El producto ${producto.descripcion} no está disponible en la fecha seleccionada.`
      );
      return;
    }

    const precioUnitario = producto.precio_alquiler_efectivo;
    const subtotal = precioUnitario * nuevoItem.cantidad;

    const newItem: ItemPresupuesto = {
      id: Date.now(),
      productoId: producto.id,
      productoNombre: producto.descripcion,
      cantidad: nuevoItem.cantidad,
      precioUnitario,
      subtotal,
    };

    setItems([...items, newItem]);
    setNuevoItem({ productoId: "", cantidad: 1, porcentaje: "" });
  };

  const eliminarItem = (id: number) => {
    setItems(items.filter((item) => item.id !== Number(id)));
  };

  const calcularTotal = () => {
    return items.reduce((total, item) => total + item.subtotal, 0);
  };

  const nuevoPresupuesto = () => {
    setPresupuestoActual(null);
    setVerModoLectura(false);
    setFormData({
      clienteId: "",
      observaciones: "",
      fechaEvento: "",
      fechaRetiro: "",
      fechaDevolucion: "",
      categoria: "",
      agasajado: "",
      lugar: "",
    });
    setItems([]);
    setTotalConDescuento(null);
    setPorcentajeDescuento(null);
    setShowModal(true);
  };

  const guardarPresupuesto = async () => {
    if (
      !formData.clienteId ||
      items.length === 0 ||
      !formData.fechaEvento ||
      !formData.categoria
    ) {
      alert("Completa todos los campos requeridos");
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

    const payload = {
      cliente_id: parseInt(formData.clienteId),
      fecha_evento: formData.fechaEvento,
      fecha_retiro: formData.fechaRetiro || null,
      fecha_devolucion: formData.fechaDevolucion || null,
      categoria_evento: formData.categoria,
      nombre_agasajado: formData.agasajado,
      lugar_evento: formData.lugar,
      observaciones: formData.observaciones,
      items: itemsParaEnviar.map((item) => ({
        producto_id: item.productoId,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        subtotal: item.subtotal,
      })),
      // Campos de descuento extra
      extra_discount_percentage: tieneDescuentoExtra ? porcentajeDescuento : null,
      extra_discount_amount: tieneDescuentoExtra ? (totalOriginal - totalFinal) : null,
      extra_discount_reason: tieneDescuentoExtra ? motivoDescuentoExtra : null,
    };

    console.log("Enviando payload:", payload);
    console.log(
      "Token:",
      localStorage.getItem("token") ? "Presente" : "Ausente"
    );

    try {
      const res = await fetch(`${API_BASE}/presupuestos/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      console.log("Status Code:", res.status);
      console.log("Response Headers:", res.headers);
      console.log("Response URL:", res.url);

      if (res.ok) {
        const responseData = await res.json();
        console.log("Respuesta exitosa:", responseData);
        setShowModal(false);
        setTotalConDescuento(null);
        setPorcentajeDescuento(null);
        setMotivoDescuentoExtra("");
        fetchPresupuestos();
        alert("Presupuesto guardado exitosamente");
      } else {
        const errorText = await res.text();
        console.error("Error al guardar presupuesto:", res.status, errorText);

        try {
          const errorData = JSON.parse(errorText);
          alert(
            `Error al guardar presupuesto: ${
              errorData.detail || errorData.message || "Error desconocido"
            }`
          );
        } catch {
          alert(`Error al guardar presupuesto: ${errorText}`);
        }
      }
    } catch (error) {
      console.error("Error de conexión:", error);
      alert("Error de conexión al guardar presupuesto");
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
        const presupuestosAdaptados = data.map((p: any) => ({
          ...p,
          items: (p.items ?? []).map((item: any) => {
            const productoId =
              item.productoId ?? item.producto_id ?? item.producto?.id ?? 0;

            const precioUnitario =
              item.precioUnitario ??
              item.precio_unitario ??
              item.producto?.precio_alquiler_efectivo ??
              0;

            const cantidad = item.cantidad ?? 0;
            const subtotal = item.subtotal ?? cantidad * precioUnitario;

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
              precioUnitario,
              subtotal,
            };
          }),
        }));

        setPresupuestos(presupuestosAdaptados);
      }
    } catch (error) {
      console.error("Error en fetchPresupuestos:", error);
      setPresupuestos([]); // Prevención adicional
    } finally {
      setCargando(false);
    }
  };

  const getEstadoClass = (estado: string) => {
    switch (estado) {
      case "aprobado":
        return "bg-success";
      case "rechazado":
        return "bg-danger";
      case "cancelada":
        return "bg-danger";
      case "vencido":
        return "bg-secondary";
      case "convertido_orden":
        return "bg-success"; // nuevo estado
      default:
        return "bg-warning";
    }
  };

  const convertirEnOrden = async (
    presupuestoId: number,
    clienteNombre: string,
    metodoPago: string
  ) => {
    const seña = prompt(
      `Ingrese el monto de la seña recibida de ${clienteNombre}:`
    );
    if (!seña || isNaN(parseFloat(seña))) {
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
          seña_pagada: parseFloat(seña),
          payment_method: metodoPago, // Cambiado a payment_method
        }),
      });

      if (res.ok) {
        alert("Orden de trabajo generada con éxito.");
      } else {
        const error = await res.json();
        alert(`Error al generar orden: ${error.detail}`);
      }
    } catch (err) {
      console.error("Error al convertir en orden:", err);
      alert("Error inesperado al generar orden.");
    }
  };

  const abrirPresupuestoVista = (presupuesto: PresupuestoResponse) => {
    setPresupuestoSeleccionado(presupuesto);

    setFormData({
      clienteId: presupuesto.cliente_id.toString(),
      fechaEvento: presupuesto.fecha_evento,
      fechaRetiro: presupuesto.fecha_retiro || "",
      fechaDevolucion: presupuesto.fecha_devolucion || "",
      categoria: presupuesto.categoria_evento || "",
      agasajado: presupuesto.nombre_agasajado || "",
      lugar: presupuesto.lugar_evento || "",
      observaciones: presupuesto.observaciones || "",
    });

    setItems(presupuesto.items);
    setTotalConDescuento(null);
    setPorcentajeDescuento(null);
    setVerModoLectura(true);
    setVerModoLectura(true);
    setShowModal(true);
  };

  function toPresupuestoResponse(p: Presupuesto): PresupuestoResponse {
    return {
      id: p.id,
      numero: p.numero,
      cliente_id: p.cliente_id,
      cliente_nombre: p.cliente_nombre,
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
    };
  }
  const confirmarSenia = async () => {
    if (!presupuestoAConvertir) return;

    const monto = parseFloat(senia);
    if (isNaN(monto) || monto <= 0) {
      alert("Monto inválido.");
      return;
    }

    if (!cuentaDestinoId) {
      alert("Debes seleccionar una cuenta destino.");
      return;
    }

    if (!metodoPagoId) {
      alert("Debes seleccionar un método de pago.");
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
          presupuesto_id: presupuestoAConvertir.id,
          seña_pagada: monto,
          metodo_pago_id: metodoPagoId,
          submetodo_pago_id: submetodoPagoId || null,
          payment_method: null, // Ya no se usa, pero mantenido para compatibilidad
          cuenta_destino_id: cuentaDestinoId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const orderId = data.id;
        alert("Orden de trabajo generada con éxito.");
        setModalSeniaAbierto(false);
        setSenia("");
        setCuentaDestinoId(null);
        setMetodoPago("");
        setMetodoPagoId(null);
        setSubmetodoPagoId(null);
        fetchPresupuestos();
      } else {
        const error = await res.json();
        alert(`Error al generar orden: ${error.detail}`);
      }
    } catch (err) {
      console.error("Error al generar orden:", err);
      alert("Error inesperado.");
    }
  };

  const eliminarPresupuesto = async (id: number) => {
    const confirmar = confirm(
      "¿Estás seguro que querés eliminar este presupuesto?"
    );
    if (!confirmar) return;

    try {
      const res = await fetch(`${API_BASE}/presupuestos/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (res.ok) {
        alert("Presupuesto eliminado.");
        fetchPresupuestos(); // Recargar tabla
      } else {
        const error = await res.json();
        alert(`Error al eliminar: ${error.detail}`);
      }
    } catch (err) {
      console.error("Error al eliminar presupuesto:", err);
      alert("Error inesperado al eliminar presupuesto.");
    }
  };

  const normalizarTelefono = (telefono?: string): string | null => {
    if (!telefono) return null;
    let limpio = telefono.replace(/\D/g, "");
    if (!limpio) return null;
    limpio = limpio.replace(/^0+/, "");

    if (limpio.startsWith("54")) {
      if (!limpio.startsWith("549")) {
        limpio = `549${limpio.slice(2)}`;
      }
    } else {
      if (limpio.startsWith("9")) {
        limpio = limpio.slice(1);
      }
      limpio = `549${limpio}`;
    }

    return limpio;
  };

  const handleEnviarWhatsapp = (presupuesto: Presupuesto) => {
    const cliente = clientes.find((c) => c.id === presupuesto.cliente_id);

    if (!cliente) {
      alert("No se encontró información del cliente asociado al presupuesto.");
      return;
    }

    const telefonoCliente = cliente.celular || cliente.telefono;
    if (!telefonoCliente) {
      alert("El cliente no tiene un número de teléfono registrado.");
      return;
    }

    const telefonoNormalizado = normalizarTelefono(telefonoCliente);
    if (!telefonoNormalizado) {
      alert("El número de teléfono del cliente es inválido.");
      return;
    }

    const nombreCliente =
      `${cliente.apellido ?? ""} ${cliente.nombre ?? ""}`.trim() ||
      presupuesto.cliente_nombre;

    const totalFormateado = presupuesto.total.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const formatearFecha = (fecha?: string) => {
      if (!fecha) return null;
      try {
        // Agregar T00:00:00 para evitar problemas de zona horaria
        const fechaConHora = fecha.includes("T") ? fecha : fecha + "T00:00:00";
        return format(new Date(fechaConHora), "dd/MM/yyyy", { locale: es });
      } catch {
        return fecha;
      }
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

    if (presupuesto.observaciones) {
      detalles.push(`Observaciones: ${presupuesto.observaciones}`);
    }

    const detalleProductos =
      presupuesto.items?.length > 0
        ? presupuesto.items
            .map((item, index) => {
              const nombreProducto =
                item.productoNombre ||
                (item as any).producto_descripcion ||
                "Producto";
              const subtotal = (
                item.subtotal ?? item.cantidad * (item.precioUnitario ?? 0)
              ).toLocaleString("es-AR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              return `${index + 1}) ${
                item.cantidad
              } x ${nombreProducto} - $${subtotal}`;
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

    const url = `https://api.whatsapp.com/send?phone=${telefonoNormalizado}&text=${encodeURIComponent(
      mensaje
    )}`;

    window.open(url, "_blank");
  };

  const aplicarDescuento = () => {
    const porcentaje = Number(nuevoItem.porcentaje);
    const total = calcularTotal();

    if (!porcentaje || isNaN(porcentaje)) {
      alert("Seleccioná un porcentaje de descuento válido.");
      return;
    }

    const descuentoMaximoEstandar = esAdmin ? 50 : 15; // 50% para admin, 15% para empleados

    // Si el descuento es mayor al estándar, pedir motivo
    if (porcentaje > descuentoMaximoEstandar) {
      setDescuentoPendiente({ porcentaje, total });
      setMostrarModalMotivoDescuento(true);
      return;
    }

    // Si es descuento estándar, aplicar directamente
    const descuento = (total * porcentaje) / 100;
    const totalFinal = total - descuento;

    setTotalConDescuento(totalFinal);
    setPorcentajeDescuento(porcentaje);
    setMotivoDescuentoExtra(""); // Limpiar motivo para descuentos estándar
  };

  const confirmarDescuentoExtra = () => {
    if (!motivoDescuentoExtra.trim()) {
      alert("El motivo es obligatorio para descuentos mayores al estándar.");
      return;
    }

    if (descuentoPendiente) {
      const descuento = (descuentoPendiente.total * descuentoPendiente.porcentaje) / 100;
      const totalFinal = descuentoPendiente.total - descuento;

      setTotalConDescuento(totalFinal);
      setPorcentajeDescuento(descuentoPendiente.porcentaje);
      setMostrarModalMotivoDescuento(false);
      setDescuentoPendiente(null);
    }
  };

  return (
    <div className="container py-4 p-2">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Presupuestos</h1>
          <p className="text-muted">Gestión y seguimiento de presupuestos.</p>
        </div>
        <button className="btn btn-primary" onClick={nuevoPresupuesto}>
          <i className="bi bi-plus me-2"></i>
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
        <div className="card">
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead className="table-light">
                <tr>
                  <th>N°</th>
                  <th>Cliente</th>
                  <th>Fecha Evento</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {presupuestos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No hay presupuestos cargados.
                    </td>
                  </tr>
                ) : (
                  presupuestos.map((p) => (
                    <tr key={p.id}>
                      <td>{p.numero}</td>
                      <td>{p.cliente_nombre}</td>
                      <td>
                        {p.fecha_evento
                          ? format(new Date(p.fecha_evento + "T00:00:00"), "dd/MM/yyyy", {
                              locale: es,
                            })
                          : "Sin fecha"}
                      </td>

                      <td>${p.total.toLocaleString()}</td>
                      <td>
                        <span className={`badge ${getEstadoClass(p.estado)}`}>
                          {p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-success"
                            title="Enviar por WhatsApp"
                            onClick={() => handleEnviarWhatsapp(p)}
                          >
                            <i className="bi bi-whatsapp me-1"></i>
                            WhatsApp
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            title="Ver presupuesto"
                            onClick={() =>
                              abrirPresupuestoVista(toPresupuestoResponse(p))
                            }
                          >
                            Ver
                          </button>
                          {p.estado.toLowerCase() === "convertido_orden" ||
                          p.estado.toLowerCase() === "aprobado" ||
                          p.estado.toLowerCase() === "cancelada" ? (
                            <div></div>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              title="Convertir en orden"
                              onClick={async () => {
                                setPresupuestoAConvertir({
                                  id: p.id,
                                  cliente: p.cliente_nombre,
                                });
                                setSenia("");
                                setCuentaDestinoId(null);
                                setMetodoPagoId(null);
                                setSubmetodoPagoId(null);
                                
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
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => eliminarPresupuesto(p.id)}
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
        </div>
      )}
      {/* Modal */}
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
        productos={productos}
        productoFiltro={productoFiltro}
        setProductoFiltro={setProductoFiltro}
        nuevoItem={nuevoItem}
        handleItemChange={handleItemChange}
        verificarDisponibilidad={verificarDisponibilidad}
        agregarItem={agregarItem}
        eliminarItem={eliminarItem}
        items={items}
        calcularTotal={calcularTotal}
        guardarPresupuesto={guardarPresupuesto}
        totalConDescuento={totalConDescuento}
        porcentajeDescuento={porcentajeDescuento}
        aplicarDescuento={aplicarDescuento}
        onClose={() => {
          setShowModal(false);
          setVerModoLectura(false);
        }}
      />

      {/* Modal de Seña */}
      <Dialog open={modalSeniaAbierto} onOpenChange={setModalSeniaAbierto}>
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
            <div className="card shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="mb-4">
                  <label className="form-label fw-bold">Monto de la seña</label>
                  <input
                    type="number"
                    className="form-control w-100"
                    placeholder="Ingresá el monto recibido"
                    value={senia}
                    onChange={(e) => setSenia(e.target.value)}
                  />
                </div>

                <MetodoPagoSelector
                  sucursalId={me?.sucursalId}
                  metodoPagoId={metodoPagoId}
                  submetodoPagoId={submetodoPagoId}
                  onMetodoChange={(metodoId, submetodoId, metodoDisplay) => {
                    setMetodoPagoId(metodoId)
                    setSubmetodoPagoId(submetodoId)
                    setMetodoPago(metodoDisplay) // Para compatibilidad
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
                      No hay cuentas destino activas disponibles. Contactá a un administrador.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button
              className="btn btn-light border"
              onClick={() => setModalSeniaAbierto(false)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={confirmarSenia}
              disabled={!metodoPagoId || !cuentaDestinoId || !senia || parseFloat(senia) <= 0}
            >
              Confirmar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de motivo para descuento extra */}
      <Dialog open={mostrarModalMotivoDescuento} onOpenChange={setMostrarModalMotivoDescuento}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo del Descuento Extra</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted mb-3">
              El descuento de {descuentoPendiente?.porcentaje}% supera el máximo estándar. 
              Por favor, ingresá el motivo de este descuento extra.
            </p>
            <label className="form-label fw-bold">Motivo (obligatorio)</label>
            <textarea
              className="form-control"
              rows={4}
              value={motivoDescuentoExtra}
              onChange={(e) => setMotivoDescuentoExtra(e.target.value)}
              placeholder="Ej: Cliente habitual con compra grande, promoción especial, etc."
            />
          </div>
          <DialogFooter>
            <button
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
              className="btn btn-primary"
              onClick={confirmarDescuentoExtra}
            >
              Aplicar Descuento
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
