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
  estado: "pendiente" | "aprobado" | "rechazado" | "vencido";
  observaciones: string;
  fecha_retiro?: string;
  fecha_devolucion?: string;
  categoria_evento?: string;
  nombre_agasajado?: string;
  lugar_evento?: string;
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
      // aquí puedes agregar un estado de error o mostrar notificación
    }
  };

  const fetchProductos = async () => {
    try {
      const token = localStorage.getItem("token"); // o donde guardes el token JWT
      const res = await fetch("http://127.0.0.1:8000/productos/all", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // agregas el Bearer token aquí
        },
      });

      if (!res.ok) throw new Error("Error al obtener productos");

      const data = await res.json();
      console.log("Productos cargados:", data); // <-- agregá esta línea
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

    const res = await fetch("http://127.0.0.1:8000/presupuestos/presupuestos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setShowModal(false);
      fetchPresupuestos();
    } else {
      alert("Error al guardar presupuesto");
    }
  };

  const fetchPresupuestos = async () => {
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/presupuestos/presupuestos",
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
          items: p.items.map((item: any) => ({
            ...item,
            productoNombre: item.producto_nombre,
          })),
        }));

        setPresupuestos(presupuestosAdaptados);
      }
    } catch (error) {
      console.error("Error en fetchPresupuestos:", error);
      setPresupuestos([]); // Prevención adicional
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
      default:
        return "bg-warning";
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
                          className="btn btn-sm btn-outline-secondary"
                          title="Ver presupuesto"
                          onClick={() =>
                            abrirPresupuestoVista(toPresupuestoResponse(p))
                          }
                        >
                          Ver
                        </button>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          title="Convertir en orden"
                          onClick={() => alert("Funcionalidad en desarrollo")}
                        >
                          Orden
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          title="Eliminar"
                          onClick={() => alert("Eliminar en desarrollo")}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
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
    </div>
  );
}
