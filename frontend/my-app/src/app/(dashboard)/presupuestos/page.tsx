"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import PresupuestoModal from "@/components/modales/presupuestoModal";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
    | "convertido_orden";
  observaciones: string;
  fecha_retiro?: string;
  fecha_devolucion?: string;
  categoria_evento?: string;
  nombre_agasajado?: string;
  lugar_evento?: string;
  seña_pagada?: number;
  payment_method?: string;  // Cambiado de metodo_pago
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
  payment_method?: string;  // Cambiado de metodo_pago
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
  const [metodoPago, setMetodoPago] = useState("");

  // Métodos de pago consistentes con ventas
  const metodosPago = [
    { value: "EFECTIVO", label: "Efectivo" },
    { value: "DEBITO", label: "Débito" },
    { value: "CREDITO", label: "Crédito" },
    { value: "BILLETERA_VIRTUAL", label: "Billetera Virtual" },
    { value: "TRANSFERENCIA", label: "Transferencia" },
  ];
  const [mostrarModalRecibo, setMostrarModalRecibo] = useState(false);
  const [eventos, setEventos] = useState<string[]>([]);

  const [presupuestoParaRecibo, setPresupuestoParaRecibo] =
    useState<Presupuesto | null>(null);

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
  });

  const [modalSeniaAbierto, setModalSeniaAbierto] = useState(false);
  const [senia, setSenia] = useState("");
  const [presupuestoAConvertir, setPresupuestoAConvertir] = useState<{
    id: number;
    cliente: string;
  } | null>(null);

  useEffect(() => {
    fetchClientes();
    fetchProductos();
    fetchPresupuestos();
  }, []);

  const fetchClientes = async () => {
    try {
      const token = localStorage.getItem("token"); // o donde guardes el token JWT
      const res = await fetch("http://127.0.0.1:8000/clientes/all", {
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
      const res = await fetch("http://127.0.0.1:8000/productos/all", {
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
        `http://127.0.0.1:8000/productos/${productoId}/disponibilidad?fecha_retiro=${fechaRetiro}&fecha_devolucion=${fechaDevolucion}`
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
      `http://127.0.0.1:8000/productos/${producto.id}/disponibilidad?fecha_retiro=${formData.fechaRetiro}&fecha_devolucion=${formData.fechaDevolucion}`
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
    setNuevoItem({ productoId: "", cantidad: 1 });
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

    const total = calcularTotal();
    const payload = {
      cliente_id: parseInt(formData.clienteId),
      fecha_evento: formData.fechaEvento,
      fecha_retiro: formData.fechaRetiro || null,
      fecha_devolucion: formData.fechaDevolucion || null,
      categoria_evento: formData.categoria,
      nombre_agasajado: formData.agasajado,
      lugar_evento: formData.lugar,
      observaciones: formData.observaciones,
      items: items.map((item) => ({
        producto_id: item.productoId,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        subtotal: item.subtotal,
      })),
    };

    console.log("Enviando payload:", payload);
    console.log("Token:", localStorage.getItem("token") ? "Presente" : "Ausente");

    try {
      const res = await fetch("http://127.0.0.1:8000/presupuestos/", {
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
      console.log("URL esperada: http://127.0.0.1:8000/presupuestos/");

      if (res.ok) {
        const responseData = await res.json();
        console.log("Respuesta exitosa:", responseData);
        setShowModal(false);
        fetchPresupuestos();
        alert("Presupuesto guardado exitosamente");
      } else {
        const errorText = await res.text();
        console.error("Error al guardar presupuesto:", res.status, errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          alert(`Error al guardar presupuesto: ${errorData.detail || errorData.message || 'Error desconocido'}`);
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
      const res = await fetch(
        "http://127.0.0.1:8000/presupuestos/",
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

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
              item.productoId ??
              item.producto_id ??
              item.producto?.id ??
              0;

            const precioUnitario =
              item.precioUnitario ??
              item.precio_unitario ??
              item.producto?.precio_alquiler_efectivo ??
              0;

            const cantidad = item.cantidad ?? 0;
            const subtotal =
              item.subtotal ??
              cantidad * precioUnitario;

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
      const res = await fetch(
        "http://127.0.0.1:8000/ordenes/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            presupuesto_id: presupuestoId,
            seña_pagada: parseFloat(seña),
            payment_method: metodoPago,  // Cambiado a payment_method
          }),
        }
      );

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

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/ordenes/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            presupuesto_id: presupuestoAConvertir.id,
            seña_pagada: monto,
            payment_method: metodoPago,  // Cambiado a payment_method
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const orderId = data.id;
        alert("Orden de trabajo generada con éxito.");
        setModalSeniaAbierto(false);
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
      const res = await fetch(
        `http://127.0.0.1:8000/presupuestos/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

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
  const abrirModalRecibo = (presupuesto: Presupuesto) => {
    setPresupuestoParaRecibo(presupuesto);
    setMostrarModalRecibo(true);
  };

  const imprimirRecibo = () => {
    const recibo = document.getElementById("recibo-impresion");
    if (!recibo) return;

    const ventana = window.open("", "_blank", "width=600,height=800");
    if (!ventana) return;

    const contenido = recibo.cloneNode(true) as HTMLElement;

    const style = `
    <style>
      body {
        margin: 20px;
        font-family: sans-serif;
      }
      h3 {
        text-align: center;
      }
      p {
        margin: 4px 0;
      }
    </style>
  `;

    ventana.document.body.innerHTML = style;
    ventana.document.body.appendChild(contenido);

    setTimeout(() => {
      ventana.print();
      ventana.close();
    }, 500);
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
      `${cliente.nombre ?? ""} ${cliente.apellido ?? ""}`.trim() ||
      presupuesto.cliente_nombre;

    const totalFormateado = presupuesto.total.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const formatearFecha = (fecha?: string) => {
      if (!fecha) return null;
      try {
        return format(new Date(fecha), "dd/MM/yyyy", { locale: es });
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
    if (fechaDevolucion) detalles.push(`Fecha de devolución: ${fechaDevolucion}`);

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
                item.productoNombre || (item as any).producto_descripcion || "Producto";
              const subtotal = (item.subtotal ?? item.cantidad * (item.precioUnitario ?? 0)).toLocaleString(
                "es-AR",
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
              );
              return `${index + 1}) ${item.cantidad} x ${nombreProducto} - $${subtotal}`;
            })
            .join("\n")
        : "Sin productos asociados.";

    let mensaje = `Hola ${nombreCliente}, te envío el presupuesto N° ${presupuesto.numero} por un total de $${totalFormateado}.`;

    if (detalles.length > 0) {
      mensaje += `\n\nDetalles:\n${detalles.map((detalle) => `- ${detalle}`).join("\n")}`;
    }

    mensaje += `\n\nProductos incluidos:\n${detalleProductos}`;

    const url = `https://api.whatsapp.com/send?phone=${telefonoNormalizado}&text=${encodeURIComponent(
      mensaje
    )}`;

    window.open(url, "_blank");
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
                          ? format(new Date(p.fecha_evento), "dd/MM/yyyy", {
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
                          p.estado.toLowerCase() === "aprobado" ? (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              title="Presupuesto ya convertido"
                              onClick={() => abrirModalRecibo(p)}
                            >
                              Emitir Recibo
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              title="Convertir en orden"
                              onClick={() => {
                                setPresupuestoAConvertir({
                                  id: p.id,
                                  cliente: p.cliente_nombre,
                                });
                                setSenia("");
                                setModalSeniaAbierto(true);
                              }}
                            >
                              Generar Orden
                            </button>
                          )}
                          {p.estado.toLowerCase() === "convertido_orden" ||
                          p.estado.toLowerCase() === "aprobado" ? (
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
            <DialogTitle className="fw-semibold">
              Ingrese seña
            </DialogTitle>
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

                <div>
                  <label className="form-label fw-bold">Método de pago</label>
                  <div className="row g-3 mt-1">
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
              disabled={!metodoPago}
            >
              Confirmar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mostrarModalRecibo && !!presupuestoParaRecibo}
        onOpenChange={(open) => !open && setMostrarModalRecibo(false)}
      >
        <DialogContent
          id="recibo-impresion"
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-md"
          dialogStyle={{ maxWidth: "520px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-2 position-relative">
            <DialogTitle className="fw-semibold">Recibo de Seña</DialogTitle>
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar"
              onClick={() => setMostrarModalRecibo(false)}
            ></button>
          </DialogHeader>

          <div className="modal-body px-3 px-md-4">
            {presupuestoParaRecibo && (
              <div className="d-flex flex-column gap-2 text-body">
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Cliente</span>
                  <strong>{presupuestoParaRecibo.cliente_nombre}</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Fecha del evento</span>
                  <strong>{presupuestoParaRecibo.fecha_evento}</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Seña pagada</span>
                  <strong>
                    ${" "}
                    {presupuestoParaRecibo.seña_pagada?.toLocaleString("es-AR")}
                  </strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Método de pago</span>
                  <strong>{presupuestoParaRecibo.payment_method || "-"}</strong>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button className="btn btn-primary" onClick={() => imprimirRecibo()}>
              Imprimir Recibo
            </button>
            <button
              className="btn btn-light border"
              onClick={() => setMostrarModalRecibo(false)}
            >
              Cerrar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
