import React from "react";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getApiBaseUrl } from "@/lib/api-config";

/** Parsea "YYYY-MM-DD" en hora local para evitar que medianoche UTC se interprete como día anterior (ej. lunes → domingo en Argentina). */
function parseDateLocal(s: string): Date {
  const parts = s.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return new Date(s);
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

type Cliente = { id: number; nombre: string; apellido: string };
type Precliente = { id: number; nombre: string; apellido: string; celular: string };
type Producto = {
  id: number;
  descripcion: string;
  codigo_barra: string;
  precio_alquiler_efectivo: number;
};
type Item = {
  id?: number;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  subtotal: number;
};

type Props = {
  esAdmin: boolean;
  show: boolean;
  verModoLectura: boolean;
  presupuestoSeleccionado?: any;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  clientes: Cliente[];
  clienteFiltro: string;
  setClienteFiltro: (value: string) => void;
  handleClienteChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  selectClientePreclienteValue?: string;
  modoClientePrecliente?: "cliente" | "precliente";
  setModoClientePrecliente?: (v: "cliente" | "precliente") => void;
  preclienteForm?: { nombre: string; apellido: string; telefono: string };
  setPreclienteForm?: React.Dispatch<React.SetStateAction<{ nombre: string; apellido: string; telefono: string }>>;
  preclienteNombreSeleccionado?: string | null;
  resumenClienteNombre?: string;
  clienteOPreclienteSeleccionado?: { tipo: "cliente" | "precliente"; id: number; nombre: string } | null;
  preclientes?: Precliente[];
  onSelectPrecliente?: (id: number, nombre: string) => void;
  crearPreclienteYUsar?: () => Promise<void>;
  onClearPrecliente?: () => void;
  onActualizarListas?: () => void | Promise<void>;
  productos: Producto[];
  productoFiltro: string;
  setProductoFiltro: (value: string) => void;
  nuevoItem: { productoId: string; cantidad: number; porcentaje: string };
  handleItemChange: (campo: string, valor: any) => void;
  verificarDisponibilidad: () => Promise<boolean>;
  agregarItem: () => void;
  eliminarItem: (id: number) => void;
  items: Item[];
  calcularTotal: () => number;
  guardarPresupuesto: () => void;
  totalConDescuento?: number | null;
  porcentajeDescuento?: number | null;
  aplicarDescuento: () => void;
  solicitarDescuento?: () => void;
  onClose: () => void;
};

export default function PresupuestoModal({
  show,
  esAdmin,
  verModoLectura,
  presupuestoSeleccionado,
  formData,
  setFormData,
  clientes,
  clienteFiltro,
  setClienteFiltro,
  handleClienteChange,
  selectClientePreclienteValue = "",
  modoClientePrecliente = "cliente",
  setModoClientePrecliente,
  preclienteForm = { nombre: "", apellido: "", telefono: "" },
  setPreclienteForm,
  preclienteNombreSeleccionado = null,
  resumenClienteNombre,
  clienteOPreclienteSeleccionado = null,
  preclientes = [],
  onSelectPrecliente,
  crearPreclienteYUsar,
  onClearPrecliente,
  onActualizarListas,
  productos,
  productoFiltro,
  setProductoFiltro,
  nuevoItem,
  handleItemChange,
  verificarDisponibilidad,
  agregarItem,
  eliminarItem,
  items,
  calcularTotal,
  guardarPresupuesto,
  totalConDescuento,
  porcentajeDescuento,
  aplicarDescuento,
  onClose,
}: Props) {
  const [eventos, setEventos] = React.useState<
    { id: number; nombre: string }[]
  >([]);
  React.useEffect(() => {
    const fetchEventos = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.warn("Token no disponible, no se cargarán eventos");
          setEventos([]);
          return;
        }

        const API_BASE = getApiBaseUrl();
        const res = await fetch(`${API_BASE}/eventos/all`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 404) {
          setEventos([]);
          return;
        }

        if (!res.ok) {
          const detalle = await res.text();
          throw new Error(detalle || "Error al cargar eventos");
        }

        const data = await res.json();
        setEventos(data);
      } catch (error) {
        console.error("Error al cargar eventos:", error);
      }
    };

    fetchEventos();
  }, []);

  // Agrega arriba del return, dentro del componente (parse local para evitar UTC → día anterior)
  const fechaEvento = formData.fechaEvento
    ? parseDateLocal(formData.fechaEvento)
    : null;
  const fechaRetiro = formData.fechaRetiro
    ? parseDateLocal(formData.fechaRetiro)
    : null;
  const fechaDevolucion = formData.fechaDevolucion
    ? parseDateLocal(formData.fechaDevolucion)
    : null;

  const formatDate = (date: Date) => date.toISOString().split("T")[0];

  const clienteSeleccionado = React.useMemo(() => {
    return clientes.find((c) => String(c.id) === String(formData.clienteId));
  }, [clientes, formData.clienteId]);

  const nombreClienteResumen = React.useMemo(() => {
    if (presupuestoSeleccionado?.cliente_nombre) {
      return presupuestoSeleccionado.cliente_nombre;
    }
    if (preclienteNombreSeleccionado?.trim()) {
      return preclienteNombreSeleccionado.trim();
    }
    if (clienteSeleccionado) {
      return `${clienteSeleccionado.apellido} ${clienteSeleccionado.nombre}`.trim();
    }
    return "-";
  }, [presupuestoSeleccionado, clienteSeleccionado, formData.preclienteId, preclienteNombreSeleccionado]);

  const handleFechaChange = (key: string, value: string) => {
    const nuevaFecha = parseDateLocal(value);
    setFormData((prev: any) => {
      const nuevaData = { ...prev, [key]: value };

    if (key === "fechaEvento") {
      if (prev.fechaRetiro && parseDateLocal(prev.fechaRetiro) > nuevaFecha) {
        nuevaData.fechaRetiro = value;
      }
      if (
        prev.fechaDevolucion &&
        parseDateLocal(prev.fechaDevolucion) <= nuevaFecha
      ) {
        const siguiente = new Date(nuevaFecha);
        siguiente.setDate(siguiente.getDate() + 1);
        nuevaData.fechaDevolucion = formatDate(siguiente);
      }
    }

    if (key === "fechaRetiro") {
      if (prev.fechaEvento && nuevaFecha > parseDateLocal(prev.fechaEvento)) {
        nuevaData.fechaEvento = value;
      }
      if (
        prev.fechaDevolucion &&
        nuevaFecha >= parseDateLocal(prev.fechaDevolucion)
      ) {
        const siguiente = new Date(nuevaFecha);
        siguiente.setDate(siguiente.getDate() + 1);
        nuevaData.fechaDevolucion = formatDate(siguiente);
      }
    }

    if (key === "fechaDevolucion") {
      const eventoOK =
        prev.fechaEvento && nuevaFecha > parseDateLocal(prev.fechaEvento);
      const retiroOK =
        prev.fechaRetiro && nuevaFecha > parseDateLocal(prev.fechaRetiro);
      if (!eventoOK || !retiroOK) {
        const fev = prev.fechaEvento ? parseDateLocal(prev.fechaEvento) : null;
        const fret = prev.fechaRetiro ? parseDateLocal(prev.fechaRetiro) : null;
        const base = fev && fret ? new Date(Math.max(+fev, +fret)) : fev || fret;
        if (base) {
          base.setDate(base.getDate() + 1);
          nuevaData.fechaDevolucion = formatDate(base);
        }
      } else {
        // Validar que no sea domingo (0 = domingo en getDay()) — usando hora local
        const diaSemana = nuevaFecha.getDay();
        if (diaSemana === 0) {
          // Si es domingo, ajustar al lunes siguiente
          nuevaFecha.setDate(nuevaFecha.getDate() + 1);
          nuevaData.fechaDevolucion = formatDate(nuevaFecha);
          // Mostrar mensaje informativo
          alert(
            "La fecha de devolución no puede ser domingo. Se ajustó automáticamente al lunes siguiente."
          );
        }
      }
    }

    return nuevaData;
    });
  };

  const totalMostrado =
    typeof totalConDescuento === "number" ? totalConDescuento : calcularTotal();

  const totalOriginal = calcularTotal();
  const hayDescuento = typeof totalConDescuento === "number";
  const totalMostrar = hayDescuento
    ? (totalConDescuento as number)
    : totalOriginal;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-full border-0"
        dialogClassName="modal-xl"
        dialogStyle={{ maxWidth: "900px", width: "95%" }}
      >
        <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
          <DialogTitle>
            {verModoLectura ? "Ver Presupuesto" : "Nuevo Presupuesto"}
          </DialogTitle>
          <DialogDescription>
            {verModoLectura
              ? "Visualización de presupuesto existente"
              : "Completá los datos del evento y seleccioná los productos"}
          </DialogDescription>
        </DialogHeader>

        <div className="modal-body px-3 px-md-4">
          <div className="card mb-4 shadow-sm">
            <div className="card-header bg-light">
              <h6 className="mb-0">
                <i className="bi bi-person-circle me-2"></i>
                Información del Cliente
              </h6>
            </div>
            <div className="card-body p-4">
              <label className="form-label fw-bold" id="presupuesto-cliente-label">Cliente</label>
              {verModoLectura ? (
                <div className="form-control-plaintext border rounded p-2 bg-light">
                  {presupuestoSeleccionado?.cliente_nombre || "No disponible"}
                </div>
              ) : (
                <>
                  {(clienteOPreclienteSeleccionado != null || formData.preclienteId != null || preclienteNombreSeleccionado) ? (
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <div className="form-control bg-light border-0">
                        {clienteOPreclienteSeleccionado?.nombre ?? preclienteNombreSeleccionado ?? "Precliente seleccionado"}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={onClearPrecliente}
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="d-flex gap-2 mb-3">
                        <button
                          type="button"
                          className={`btn btn-sm ${modoClientePrecliente === "cliente" ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => setModoClientePrecliente?.("cliente")}
                        >
                          Seleccionar Cliente
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${modoClientePrecliente === "precliente" ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => setModoClientePrecliente?.("precliente")}
                        >
                          Cargar Precliente
                        </button>
                      </div>
                      {modoClientePrecliente === "cliente" ? (
                        <>
                          <label className="visually-hidden" htmlFor="presupuesto-buscar-cliente">Buscar cliente</label>
                          <input
                            id="presupuesto-buscar-cliente"
                            name="buscarCliente"
                            type="text"
                            className="form-control mb-3"
                            placeholder="Buscar por apellido o nombre"
                            value={clienteFiltro}
                            onChange={(e) => setClienteFiltro(e.target.value)}
                          />
                          <div className="d-flex align-items-center gap-2 mb-2">
                            {onActualizarListas && (
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => onActualizarListas()}
                              >
                                Actualizar
                              </button>
                            )}
                          </div>
                          <label className="visually-hidden" htmlFor="presupuesto-select-cliente">Seleccionar cliente o precliente</label>
                          <select
                            id="presupuesto-select-cliente"
                            name="clienteId"
                            className="form-select"
                            value={selectClientePreclienteValue}
                            onChange={handleClienteChange}
                          >
                            <option value="">Seleccionar cliente</option>
                            <optgroup label="Clientes">
                              {clientes
                                .filter((c) =>
                                  `${c.apellido} ${c.nombre}`
                                    .toLowerCase()
                                    .includes(clienteFiltro.toLowerCase())
                                )
                                .map((c) => (
                                  <option key={`c-${c.id}`} value={`c-${c.id}`}>
                                    {c.apellido} {c.nombre}
                                  </option>
                                ))}
                            </optgroup>
                            {preclientes.length > 0 && (
                              <optgroup label="Preclientes">
                                {preclientes
                                  .filter((p) =>
                                    `${p.apellido} ${p.nombre} ${p.celular || ""}`
                                      .toLowerCase()
                                      .includes(clienteFiltro.toLowerCase())
                                  )
                                  .map((p) => (
                                    <option key={`p-${p.id}`} value={`p-${p.id}`}>
                                      {p.apellido} {p.nombre} {p.celular ? `(${p.celular})` : ""}
                                    </option>
                                  ))}
                              </optgroup>
                            )}
                          </select>
                        </>
                      ) : (
                        <div className="border rounded p-3 bg-light">
                          <div className="mb-2">
                            <label className="form-label small fw-bold mb-1" htmlFor="presupuesto-precliente-apellido">Apellido</label>
                            <input
                              id="presupuesto-precliente-apellido"
                              name="preclienteApellido"
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Apellido"
                              value={preclienteForm.apellido}
                              onChange={(e) => setPreclienteForm?.((p) => ({ ...p, apellido: e.target.value }))}
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label small fw-bold mb-1" htmlFor="presupuesto-precliente-nombre">Nombre</label>
                            <input
                              id="presupuesto-precliente-nombre"
                              name="preclienteNombre"
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Nombre"
                              value={preclienteForm.nombre}
                              onChange={(e) => setPreclienteForm?.((p) => ({ ...p, nombre: e.target.value }))}
                            />
                          </div>
                          <div className="mb-3">
                            <label className="form-label small fw-bold mb-1" htmlFor="presupuesto-precliente-telefono">Teléfono</label>
                            <input
                              id="presupuesto-precliente-telefono"
                              name="preclienteTelefono"
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Teléfono"
                              value={preclienteForm.telefono}
                              onChange={(e) => setPreclienteForm?.((p) => ({ ...p, telefono: e.target.value }))}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={crearPreclienteYUsar}
                          >
                            Crear precliente
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="card mb-4 shadow-sm">
            <div className="card-header bg-light">
              <h6 className="mb-0">
                <i className="bi bi-calendar-event me-2"></i>
                Fechas del Evento
              </h6>
            </div>
            <div className="card-body p-4">
              <div className="row g-3 g-md-4">
                {/* Fecha del evento */}
                <div className="col-12 col-md-4">
                  <label className="form-label fw-bold" htmlFor="presupuesto-fecha-evento">Fecha del evento</label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext border rounded p-2 bg-light">
                      {formData.fechaEvento}
                    </div>
                  ) : (
                    <input
                      id="presupuesto-fecha-evento"
                      name="fechaEvento"
                      type="date"
                      className="form-control"
                      value={formData.fechaEvento}
                      min={formData.fechaRetiro || undefined}
                      max={
                        formData.fechaRetiro && formData.fechaEvento
                          ? formData.fechaEvento
                          : undefined
                      }
                      onChange={(e) =>
                        handleFechaChange("fechaEvento", e.target.value)
                      }
                    />
                  )}
                </div>

                {/* Fecha de retiro */}
                <div className="col-12 col-md-4">
                  <label className="form-label fw-bold" htmlFor="presupuesto-fecha-retiro">Fecha de retiro</label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext border rounded p-2 bg-light">
                      {formData.fechaRetiro}
                    </div>
                  ) : (
                    <input
                      id="presupuesto-fecha-retiro"
                      name="fechaRetiro"
                      type="date"
                      className="form-control"
                      value={formData.fechaRetiro}
                      max={formData.fechaEvento || undefined}
                      onChange={(e) =>
                        handleFechaChange("fechaRetiro", e.target.value)
                      }
                    />
                  )}
                </div>

                {/* Fecha de devolución */}
                <div className="col-12 col-md-4">
                  <label className="form-label fw-bold" htmlFor="presupuesto-fecha-devolucion">
                    Fecha de devolución
                  </label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext border rounded p-2 bg-light">
                      {formData.fechaDevolucion}
                    </div>
                  ) : (
                    <input
                      id="presupuesto-fecha-devolucion"
                      name="fechaDevolucion"
                      type="date"
                      className="form-control"
                      value={formData.fechaDevolucion}
                      min={
                        formData.fechaEvento &&
                        formData.fechaRetiro &&
                        formatDate(
                          new Date(
                            Math.max(
                              parseDateLocal(formData.fechaEvento).getTime(),
                              parseDateLocal(formData.fechaRetiro).getTime()
                            ) + 86400000
                          )
                        )
                      }
                      onChange={(e) =>
                        handleFechaChange("fechaDevolucion", e.target.value)
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-4 shadow-sm">
            <div className="card-header bg-light">
              <h6 className="mb-0">
                <i className="bi bi-info-circle me-2"></i>
                Detalles del Evento
              </h6>
            </div>
            <div className="card-body p-4">
              <div className="row g-3 g-md-4">
                <div className="col-12 col-md-6">
                  <label className="form-label fw-bold" htmlFor="presupuesto-categoria">Categoría</label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext border rounded p-2 bg-light">
                      {formData.categoria}
                    </div>
                  ) : (
                    <select
                      id="presupuesto-categoria"
                      name="categoria"
                      className="form-select"
                      value={formData.categoria}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          categoria: e.target.value,
                        }))
                      }
                    >
                      <option value="">Seleccionar evento</option>
                      {eventos.map((evento) => (
                        <option key={evento.id} value={evento.nombre}>
                          {evento.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label fw-bold" htmlFor="presupuesto-agasajado">
                    Nombre del agasajado
                  </label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext border rounded p-2 bg-light">
                      {formData.agasajado}
                    </div>
                  ) : (
                    <input
                      id="presupuesto-agasajado"
                      name="agasajado"
                      type="text"
                      className="form-control"
                      value={formData.agasajado}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          agasajado: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label fw-bold" htmlFor="presupuesto-lugar">Lugar del evento</label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext border rounded p-2 bg-light">
                      {formData.lugar}
                    </div>
                  ) : (
                    <input
                      id="presupuesto-lugar"
                      name="lugar"
                      type="text"
                      className="form-control"
                      value={formData.lugar}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          lugar: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
                <div className="col-12">
                  <label className="form-label fw-bold" htmlFor="presupuesto-observaciones">Observaciones</label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext border rounded p-2 bg-light">
                      {formData.observaciones}
                    </div>
                  ) : (
                    <textarea
                      id="presupuesto-observaciones"
                      name="observaciones"
                      className="form-control"
                      rows={3}
                      value={formData.observaciones}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          observaciones: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-4 shadow-sm">
            <div className="card-header bg-light">
              <h6 className="mb-0">
                <i className="bi bi-list-check me-2"></i>
                Resumen del Presupuesto
              </h6>
            </div>
            <div className="card-body p-4">
              <div className="d-flex flex-column gap-2">
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Cliente:</span>
                  <strong>{resumenClienteNombre ?? nombreClienteResumen}</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Fecha evento:</span>
                  <strong>{formData.fechaEvento || "-"}</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Categoría:</span>
                  <strong>{formData.categoria || "-"}</strong>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted">Total estimado:</span>
                  <div className="text-end">
                    {hayDescuento && (
                      <div
                        className="text-muted"
                        style={{
                          textDecoration: "line-through",
                          fontSize: "0.9rem",
                        }}
                      >
                        ${totalOriginal.toLocaleString()}
                      </div>
                    )}
                    <div className="fw-bold">
                      ${totalMostrar.toLocaleString()}
                      {hayDescuento && porcentajeDescuento && (
                        <span className="text-success ms-1">
                          (-{porcentajeDescuento}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sección: Productos */}
          <div className="card shadow-sm">
            <div className="card-header bg-light">
              <h6 className="mb-0">
                <i className="bi bi-box-seam me-2"></i>
                Productos
              </h6>
            </div>
            <div className="card-body p-4">
              {verModoLectura ? (
                <div className="border rounded p-3 bg-light">
                  <h6 className="mb-3">Productos seleccionados:</h6>
                  <ul className="list-group list-group-flush">
                    {items.map((item, index) => {
                      const nombreProducto =
                        (item as any).productoNombre ||
                        (item as any).producto_nombre ||
                        (item as any).producto_descripcion ||
                        (item as any).descripcion ||
                        "Producto";
                      const subtotal = (item as any).subtotal ?? 0;
                      return (
                        <li
                          key={
                            (item as any).id ??
                            `${(item as any).productoId || "producto"}-${index}`
                          }
                          className="list-group-item d-flex justify-content-between align-items-center bg-transparent border-0 px-0"
                        >
                          <span className="fw-medium">
                            {nombreProducto} x{(item as any).cantidad ?? 0}
                          </span>
                          <span className="badge bg-primary rounded-pill">
                            ${subtotal}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <>
                  <div className="border rounded p-3 mb-3 bg-light">
                    <h6 className="mb-3">Agregar Producto</h6>
                    <div className="row align-items-end g-3">
                      <div className="col-md-4">
                        <label className="form-label fw-bold">
                          Buscar producto
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={productoFiltro}
                          onChange={(e) => setProductoFiltro(e.target.value)}
                          placeholder="Buscar por código o descripción"
                        />
                      </div>
                      <div className="col-md-4">
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
                              `${p.descripcion}${p.codigo_barra}`
                                .toLowerCase()
                                .includes(productoFiltro.toLowerCase())
                            )
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.descripcion} ({p.codigo_barra}) - $
                                {p.precio_alquiler_efectivo.toLocaleString()}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold">Cantidad</label>
                        <input
                          type="number"
                          className="form-control"
                          min={1}
                          value={nuevoItem.cantidad}
                          onChange={(e) =>
                            handleItemChange(
                              "cantidad",
                              parseInt(e.target.value)
                            )
                          }
                        />
                      </div>
                      <div className="col-md-2">
                        <button
                          onClick={async () => {
                            const disponible = await verificarDisponibilidad();
                            if (!disponible) {
                              alert(
                                "El producto no está disponible en las fechas seleccionadas."
                              );
                              return;
                            }
                            agregarItem();
                          }}
                          className="btn btn-success w-100"
                        >
                          <i className="bi bi-plus-circle me-1"></i>
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sección: Descuento */}
                  <div className="border rounded p-3 mb-3 bg-light">
                    <h6 className="mb-3">Agregar Descuento</h6>
                    <div className="row align-items-end g-3">
                      <div className="col-md-4">
                        <label className="form-label fw-bold">
                          Porcentaje de descuento
                        </label>
                        {/* ADMIN — Selector 5–50 */}
                        {esAdmin && (
                          <select
                            className="form-select"
                            value={nuevoItem.porcentaje || ""}
                            onChange={(e) =>
                              handleItemChange("porcentaje", e.target.value)
                            }
                          >
                            <option value="">Seleccionar descuento</option>
                            {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(
                              (p) => (
                                <option key={p} value={p}>
                                  {p}%
                                </option>
                              )
                            )}
                          </select>
                        )}

                        {/* EMPLEADO — input libre para cualquier descuento */}
                        {!esAdmin && (
                          <input
                            type="number"
                            className="form-control"
                            placeholder="Ej: 5, 10, 15, 20, 25..."
                            value={nuevoItem.porcentaje || ""}
                            min={0}
                            max={100}
                            step={0.1}
                            onChange={(e) =>
                              handleItemChange("porcentaje", e.target.value)
                            }
                          />
                        )}
                      </div>

                      <div className="col-md-2">
                        <button
                          onClick={async () => {
                            aplicarDescuento();
                          }}
                          className="btn btn-success w-100"
                          id="aplicarDescuento"
                        >
                          <i className="bi bi-plus-circle me-1"></i>
                          Aplicar
                        </button>
                      </div>
                      {!esAdmin && (
                        <div className="col-md-6">
                          <small className="text-muted">
                            <i className="bi bi-info-circle me-1"></i>
                            Descuentos mayores a 15% requieren motivo
                            obligatorio
                          </small>
                        </div>
                      )}
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="border rounded p-3 bg-light">
                      <h6 className="mb-3">Productos Seleccionados</h6>
                      <ul className="list-group list-group-flush">
                        {items.map((item, index) => (
                          <li
                            key={item.id || `${item.productoId}-${index}`}
                            className="list-group-item d-flex justify-content-between align-items-center bg-transparent border-0 px-0"
                          >
                            <span className="fw-medium">
                              {item.productoNombre} x{item.cantidad}
                            </span>
                            <div className="d-flex align-items-center">
                              <span className="badge bg-primary rounded-pill me-2">
                                ${item.subtotal}
                              </span>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => item.id && eliminarItem(item.id)}
                                title="Eliminar producto"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="border-top pt-3 mt-3">
                        <div className="d-flex justify-content-end">
                          <h5 className="mb-0 text-end">
                            <span className="text-muted me-2">Total:</span>
                            <span className="d-block">
                              {hayDescuento && (
                                <span
                                  className="text-muted d-block"
                                  style={{
                                    textDecoration: "line-through",
                                    fontSize: "0.9rem",
                                  }}
                                >
                                  ${totalOriginal.toLocaleString()}
                                </span>
                              )}
                              <span className="text-primary fw-bold d-block">
                                ${totalMostrar.toLocaleString()}
                                {hayDescuento && porcentajeDescuento && (
                                  <span className="text-success ms-1">
                                    (-{porcentajeDescuento}%)
                                  </span>
                                )}
                              </span>
                            </span>
                          </h5>
                        </div>
                      </div>

                      {/* Sección de descuento extra para ADMIN */}
                      {esAdmin &&
                        presupuestoSeleccionado?.extra_discount_percentage &&
                        presupuestoSeleccionado.extra_discount_percentage >
                          15 && (
                          <div className="border-top pt-3 mt-3">
                            <div className="alert alert-info mb-0">
                              <h6 className="fw-bold mb-2">
                                <i className="bi bi-info-circle me-2"></i>
                                Descuento Extra Aplicado
                              </h6>
                              <div className="small">
                                {/* Calcular total original antes del descuento */}
                                {(() => {
                                  const totalFinal =
                                    presupuestoSeleccionado.total || 0;
                                  const porcentaje =
                                    presupuestoSeleccionado.extra_discount_percentage ||
                                    0;
                                  const montoDescontado =
                                    presupuestoSeleccionado.extra_discount_amount ||
                                    0;
                                  // Calcular total original: total_original = total_final / (1 - porcentaje/100)
                                  const totalOriginal =
                                    porcentaje < 100
                                      ? totalFinal / (1 - porcentaje / 100)
                                      : totalFinal + montoDescontado;

                                  return (
                                    <>
                                      <div className="mb-1">
                                        <strong>Total sin descuento:</strong>{" "}
                                        <span
                                          style={{
                                            textDecoration: "line-through",
                                          }}
                                        >
                                          $
                                          {totalOriginal.toLocaleString(
                                            "es-AR",
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          )}
                                        </span>
                                      </div>
                                      <div className="mb-1">
                                        <strong>Total con descuento:</strong>{" "}
                                        <span className="text-success fw-bold">
                                          $
                                          {totalFinal.toLocaleString("es-AR", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                        </span>
                                      </div>
                                      <div className="mb-1">
                                        <strong>Porcentaje:</strong>{" "}
                                        {porcentaje}%
                                      </div>
                                      {montoDescontado > 0 && (
                                        <div className="mb-1">
                                          <strong>Monto descontado:</strong> $
                                          {montoDescontado.toLocaleString(
                                            "es-AR",
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          )}
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                                {presupuestoSeleccionado.extra_discount_reason && (
                                  <div className="mb-1">
                                    <strong>Motivo:</strong>{" "}
                                    {
                                      presupuestoSeleccionado.extra_discount_reason
                                    }
                                  </div>
                                )}
                                {presupuestoSeleccionado.extra_discount_applied_by_nombre && (
                                  <div className="mb-1">
                                    <strong>Aplicado por:</strong>{" "}
                                    {
                                      presupuestoSeleccionado.extra_discount_applied_by_nombre
                                    }
                                  </div>
                                )}
                                {presupuestoSeleccionado.extra_discount_created_at && (
                                  <div className="mb-0">
                                    <strong>Fecha:</strong>{" "}
                                    {format(
                                      new Date(
                                        presupuestoSeleccionado.extra_discount_created_at
                                      ),
                                      "dd/MM/yyyy HH:mm",
                                      { locale: es }
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            <i className="bi bi-x-circle me-1"></i>
            Cerrar
          </button>
          {!verModoLectura && (
            <button type="button" className="btn btn-primary" onClick={guardarPresupuesto}>
              <i className="bi bi-check-circle me-1"></i>
              Guardar
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
