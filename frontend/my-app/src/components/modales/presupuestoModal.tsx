import React from "react";
<<<<<<< HEAD
import { useState } from "react";
=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Cliente = { id: number; nombre: string; apellido: string };
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
<<<<<<< HEAD
  esAdmin: boolean;
=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
  show: boolean;
  verModoLectura: boolean;
  presupuestoSeleccionado?: any;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  clientes: Cliente[];
  clienteFiltro: string;
  setClienteFiltro: (value: string) => void;
  handleClienteChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  productos: Producto[];
  productoFiltro: string;
  setProductoFiltro: (value: string) => void;
<<<<<<< HEAD
  nuevoItem: { productoId: string; cantidad: number; porcentaje: string };
=======
  nuevoItem: { productoId: string; cantidad: number };
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
  handleItemChange: (campo: string, valor: any) => void;
  verificarDisponibilidad: () => Promise<boolean>;
  agregarItem: () => void;
  eliminarItem: (id: number) => void;
  items: Item[];
  calcularTotal: () => number;
  guardarPresupuesto: () => void;
<<<<<<< HEAD
  totalConDescuento?: number | null;
  porcentajeDescuento?: number | null;
  aplicarDescuento: () => void;
  solicitarDescuento?: () => void;
=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
  onClose: () => void;
};

export default function PresupuestoModal({
  show,
<<<<<<< HEAD
  esAdmin,
=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
  verModoLectura,
  presupuestoSeleccionado,
  formData,
  setFormData,
  clientes,
  clienteFiltro,
  setClienteFiltro,
  handleClienteChange,
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
<<<<<<< HEAD
  totalConDescuento,
  porcentajeDescuento,
  aplicarDescuento,
=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
  onClose,
}: Props) {
  {
    console.log(items);
  }
  const [eventos, setEventos] = React.useState<
    { id: number; nombre: string }[]
  >([]);
  React.useEffect(() => {
    const fetchEventos = async () => {
      try {
<<<<<<< HEAD
        const token = localStorage.getItem("token");
        if (!token) {
          console.warn("Token no disponible, no se cargarán eventos");
          setEventos([]);
          return;
        }

        const res = await fetch("http://localhost:8000/eventos/all", {
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

=======
        const res = await fetch("http://localhost:8000/eventos/all", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (!res.ok) throw new Error("Error al cargar eventos");
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
        const data = await res.json();
        setEventos(data);
      } catch (error) {
        console.error("Error al cargar eventos:", error);
      }
    };

    fetchEventos();
  }, []);

  // Agrega arriba del return, dentro del componente
  const fechaEvento = formData.fechaEvento
    ? new Date(formData.fechaEvento)
    : null;
  const fechaRetiro = formData.fechaRetiro
    ? new Date(formData.fechaRetiro)
    : null;
  const fechaDevolucion = formData.fechaDevolucion
    ? new Date(formData.fechaDevolucion)
    : null;

  const formatDate = (date: Date) => date.toISOString().split("T")[0];

<<<<<<< HEAD
  const clienteSeleccionado = React.useMemo(() => {
    return clientes.find((c) => String(c.id) === String(formData.clienteId));
  }, [clientes, formData.clienteId]);

  const nombreClienteResumen = React.useMemo(() => {
    if (presupuestoSeleccionado?.cliente_nombre) {
      return presupuestoSeleccionado.cliente_nombre;
    }
    if (clienteSeleccionado) {
      return `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`.trim();
    }
    return "-";
  }, [presupuestoSeleccionado, clienteSeleccionado]);

=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
  const handleFechaChange = (key: string, value: string) => {
    const nuevaFecha = new Date(value);
    const nuevaData = { ...formData, [key]: value };

    if (key === "fechaEvento") {
      if (formData.fechaRetiro && new Date(formData.fechaRetiro) > nuevaFecha) {
        nuevaData.fechaRetiro = value;
      }
      if (
        formData.fechaDevolucion &&
        new Date(formData.fechaDevolucion) <= nuevaFecha
      ) {
        const siguiente = new Date(nuevaFecha);
        siguiente.setDate(siguiente.getDate() + 1);
        nuevaData.fechaDevolucion = formatDate(siguiente);
      }
    }

    if (key === "fechaRetiro") {
      if (formData.fechaEvento && nuevaFecha > new Date(formData.fechaEvento)) {
        nuevaData.fechaEvento = value;
      }
      if (
        formData.fechaDevolucion &&
        nuevaFecha >= new Date(formData.fechaDevolucion)
      ) {
        const siguiente = new Date(nuevaFecha);
        siguiente.setDate(siguiente.getDate() + 1);
        nuevaData.fechaDevolucion = formatDate(siguiente);
      }
    }

    if (key === "fechaDevolucion") {
      const eventoOK =
        formData.fechaEvento && nuevaFecha > new Date(formData.fechaEvento);
      const retiroOK =
        formData.fechaRetiro && nuevaFecha > new Date(formData.fechaRetiro);
      if (!eventoOK || !retiroOK) {
        // Se ajusta automáticamente a un día después del evento o retiro
        const base =
          fechaEvento && fechaRetiro
            ? new Date(Math.max(+fechaEvento, +fechaRetiro))
            : fechaEvento || fechaRetiro;
        if (base) {
          base.setDate(base.getDate() + 1);
          nuevaData.fechaDevolucion = formatDate(base);
        }
      }
    }

    setFormData(nuevaData);
  };

<<<<<<< HEAD
  const totalMostrado =
    typeof totalConDescuento === "number" ? totalConDescuento : calcularTotal();

  const totalOriginal = calcularTotal();
  const hayDescuento = typeof totalConDescuento === "number";
  const totalMostrar = hayDescuento
    ? (totalConDescuento as number)
    : totalOriginal;

  const [mostrarCodigoDescuento, setMostrarCodigoDescuento] = useState(false);
  const [codigoAutorizacion, setCodigoAutorizacion] = useState("");
  const [descuentoLibreHabilitado, setDescuentoLibreHabilitado] =
    useState(false);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);

  const validarCodigo = () => {
    const CODIGO = "GUAPO2025"; // ajustable
    if (codigoAutorizacion === CODIGO) {
      setDescuentoLibreHabilitado(true);
      setMostrarCodigoDescuento(false);
      setErrorCodigo(null);
    } else {
      setErrorCodigo("Código incorrecto");
    }
  };

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-full border-0"
        dialogClassName="modal-xl"
        dialogStyle={{ maxWidth: "900px", width: "95%" }}
      >
        <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
=======
  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="modal-dialog modal-lg">
        <DialogHeader className="border-bottom pb-3">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
          <DialogTitle>
            {verModoLectura ? "Ver Presupuesto" : "Nuevo Presupuesto"}
          </DialogTitle>
          <DialogDescription>
            {verModoLectura
              ? "Visualización de presupuesto existente"
              : "Completá los datos del evento y seleccioná los productos"}
          </DialogDescription>
        </DialogHeader>

<<<<<<< HEAD
        <div className="modal-body px-3 px-md-4">
          <div className="card mb-4 shadow-sm">
=======
        <div className="modal-body">
          {/* Sección: Información del Cliente */}
          <div className="card mb-4">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
            <div className="card-header bg-light">
              <h6 className="mb-0">
                <i className="bi bi-person-circle me-2"></i>
                Información del Cliente
              </h6>
            </div>
<<<<<<< HEAD
            <div className="card-body p-4">
=======
            <div className="card-body">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
              <label className="form-label fw-bold">Cliente</label>
              {verModoLectura ? (
                <div className="form-control-plaintext border rounded p-2 bg-light">
                  {presupuestoSeleccionado?.cliente_nombre || "No disponible"}
                </div>
              ) : (
                <>
                  <input
                    type="text"
<<<<<<< HEAD
                    className="form-control mb-3"
=======
                    className="form-control mb-2"
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                    placeholder="Buscar por nombre o apellido"
                    value={clienteFiltro}
                    onChange={(e) => setClienteFiltro(e.target.value)}
                  />
                  <select
                    className="form-select"
                    value={formData.clienteId}
                    onChange={handleClienteChange}
                  >
                    <option value="">Seleccionar cliente</option>
                    {clientes
                      .filter((c) =>
                        `${c.nombre} ${c.apellido}`
                          .toLowerCase()
                          .includes(clienteFiltro.toLowerCase())
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} {c.apellido}
                        </option>
                      ))}
                  </select>
                </>
              )}
            </div>
          </div>

<<<<<<< HEAD
          <div className="card mb-4 shadow-sm">
=======
          {/* Sección: Fechas del Evento */}
          <div className="card mb-4">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
            <div className="card-header bg-light">
              <h6 className="mb-0">
                <i className="bi bi-calendar-event me-2"></i>
                Fechas del Evento
              </h6>
            </div>
<<<<<<< HEAD
            <div className="card-body p-4">
              <div className="row g-3 g-md-4">
=======
            <div className="card-body">
              <div className="row g-3">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                {[
                  { label: "Fecha del evento", key: "fechaEvento" },
                  { label: "Fecha de retiro", key: "fechaRetiro" },
                  { label: "Fecha de devolución", key: "fechaDevolucion" },
                ].map(({ label, key }) => (
<<<<<<< HEAD
                  <div className="col-12 col-md-4" key={key}>
=======
                  <div className="col-md-4" key={key}>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                    <label className="form-label fw-bold">{label}</label>
                    {verModoLectura ? (
                      <div className="form-control-plaintext border rounded p-2 bg-light">
                        {formData[key]}
                      </div>
                    ) : (
                      <input
                        type="date"
                        className="form-control"
                        value={formData[key]}
                        min={
                          key === "fechaEvento"
                            ? formData.fechaRetiro || undefined
                            : key === "fechaRetiro"
                            ? undefined
                            : formData.fechaEvento &&
                              formData.fechaRetiro &&
                              formatDate(
                                new Date(
                                  Math.max(
                                    new Date(formData.fechaEvento).getTime(),
                                    new Date(formData.fechaRetiro).getTime()
                                  ) + 86400000
                                )
                              )
                        }
                        max={
                          key === "fechaRetiro" && formData.fechaEvento
                            ? formData.fechaEvento
                            : undefined
                        }
                        onChange={(e) => handleFechaChange(key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

<<<<<<< HEAD
          <div className="card mb-4 shadow-sm">
=======
          {/* Sección: Detalles del Evento */}
          <div className="card mb-4">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
            <div className="card-header bg-light">
              <h6 className="mb-0">
                <i className="bi bi-info-circle me-2"></i>
                Detalles del Evento
              </h6>
            </div>
<<<<<<< HEAD
            <div className="card-body p-4">
              <div className="row g-3 g-md-4">
                <div className="col-12 col-md-6">
=======
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                  <label className="form-label fw-bold">Categoría</label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext border rounded p-2 bg-light">
                      {formData.categoria}
                    </div>
                  ) : (
                    <select
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
<<<<<<< HEAD
                <div className="col-12 col-md-6">
                  <label className="form-label fw-bold">
                    Nombre del agasajado
                  </label>
=======
                <div className="col-md-6">
                  <label className="form-label fw-bold">Nombre del agasajado</label>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                  {verModoLectura ? (
                    <div className="form-control-plaintext border rounded p-2 bg-light">
                      {formData.agasajado}
                    </div>
                  ) : (
                    <input
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
<<<<<<< HEAD
                <div className="col-12 col-md-6">
                  <label className="form-label fw-bold">Lugar del evento</label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext border rounded p-2 bg-light">
                      {formData.lugar}
                    </div>
                  ) : (
                    <input
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
                  <label className="form-label fw-bold">Observaciones</label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext border rounded p-2 bg-light">
                      {formData.observaciones}
                    </div>
                  ) : (
                    <textarea
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
                  <strong>{nombreClienteResumen}</strong>
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
=======
              </div>
              
              <div className="mt-3">
                <label className="form-label fw-bold">Lugar del evento</label>
                {verModoLectura ? (
                  <div className="form-control-plaintext border rounded p-2 bg-light">
                    {formData.lugar}
                  </div>
                ) : (
                  <input
                    type="text"
                    className="form-control"
                    value={formData.lugar}
                    onChange={(e) =>
                      setFormData((prev: any) => ({ ...prev, lugar: e.target.value }))
                    }
                  />
                )}
              </div>
              
              <div className="mt-3">
                <label className="form-label fw-bold">Observaciones</label>
                {verModoLectura ? (
                  <div className="form-control-plaintext border rounded p-2 bg-light">
                    {formData.observaciones}
                  </div>
                ) : (
                  <textarea
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
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
              </div>
            </div>
          </div>

          {/* Sección: Productos */}
<<<<<<< HEAD
          <div className="card shadow-sm">
=======
          <div className="card">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
            <div className="card-header bg-light">
              <h6 className="mb-0">
                <i className="bi bi-box-seam me-2"></i>
                Productos
              </h6>
            </div>
<<<<<<< HEAD
            <div className="card-body p-4">
=======
            <div className="card-body">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
              {verModoLectura ? (
                <div className="border rounded p-3 bg-light">
                  <h6 className="mb-3">Productos seleccionados:</h6>
                  <ul className="list-group list-group-flush">
<<<<<<< HEAD
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
=======
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="list-group-item d-flex justify-content-between align-items-center bg-transparent border-0 px-0"
                      >
                        <span className="fw-medium">{item.productoNombre} x{item.cantidad}</span>
                        <span className="badge bg-primary rounded-pill">${item.subtotal}</span>
                      </li>
                    ))}
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                  </ul>
                </div>
              ) : (
                <>
                  <div className="border rounded p-3 mb-3 bg-light">
                    <h6 className="mb-3">Agregar Producto</h6>
                    <div className="row align-items-end g-3">
                      <div className="col-md-4">
<<<<<<< HEAD
                        <label className="form-label fw-bold">
                          Buscar producto
                        </label>
=======
                        <label className="form-label fw-bold">Buscar producto</label>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
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
<<<<<<< HEAD
                            handleItemChange(
                              "cantidad",
                              parseInt(e.target.value)
                            )
=======
                            handleItemChange("cantidad", parseInt(e.target.value))
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
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

<<<<<<< HEAD
                  {/* Sección: Descuento */}
                  <div className="border rounded p-3 mb-3 bg-light">
                    <h6 className="mb-3">Agregar Descuento</h6>
                    <div className="row align-items-end g-3">
                      <div className="col-md-4">
                        <label className="form-label fw-bold">
                          Porcentaje de descuento
                        </label>
                        {/* ADMIN — Selector 5–50 */}
                        {esAdmin && !descuentoLibreHabilitado && (
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

                        {/* EMPLEADO — selector 5–20 */}
                        {!esAdmin && !descuentoLibreHabilitado && (
                          <select
                            className="form-select"
                            value={nuevoItem.porcentaje || ""}
                            onChange={(e) =>
                              handleItemChange("porcentaje", e.target.value)
                            }
                          >
                            <option value="">Seleccionar descuento</option>
                            {[5, 10, 15, 20].map((p) => (
                              <option key={p} value={p}>
                                {p}%
                              </option>
                            ))}
                          </select>
                        )}

                        {/* EMPLEADO autorizado — input libre */}
                        {!esAdmin && descuentoLibreHabilitado && (
                          <>
                            <input
                              type="number"
                              className="form-control"
                              placeholder="Ej: 27"
                              value={nuevoItem.porcentaje}
                              min={1}
                              max={80}
                              onChange={(e) =>
                                handleItemChange("porcentaje", e.target.value)
                              }
                            />
                            <small className="text-success">Autorizado</small>
                          </>
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
                      <div className="col-md-4">
                        {!esAdmin && !descuentoLibreHabilitado && (
                          <button
                            onClick={() => setMostrarCodigoDescuento(true)}
                            className="btn btn-outline-primary w-100"
                          >
                            <i className="bi bi-key me-1"></i>
                            Solicitar Descuento
                          </button>
                        )}
                      </div>
                      {!esAdmin && mostrarCodigoDescuento && (
                        <div className="mt-3">
                          <label className="form-label fw-bold">
                            Código de autorización
                          </label>
                          <input
                            type="password"
                            className="form-control"
                            value={codigoAutorizacion}
                            onChange={(e) =>
                              setCodigoAutorizacion(e.target.value)
                            }
                          />
                          {errorCodigo && (
                            <div className="text-danger small">
                              {errorCodigo}
                            </div>
                          )}

                          <button
                            className="btn btn-primary mt-2"
                            onClick={validarCodigo}
                          >
                            Validar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                  {items.length > 0 && (
                    <div className="border rounded p-3 bg-light">
                      <h6 className="mb-3">Productos Seleccionados</h6>
                      <ul className="list-group list-group-flush">
                        {items.map((item) => (
                          <li
                            key={item.productoId}
                            className="list-group-item d-flex justify-content-between align-items-center bg-transparent border-0 px-0"
                          >
<<<<<<< HEAD
                            <span className="fw-medium">
                              {item.productoNombre} x{item.cantidad}
                            </span>
                            <div className="d-flex align-items-center">
                              <span className="badge bg-primary rounded-pill me-2">
                                ${item.subtotal}
                              </span>
=======
                            <span className="fw-medium">{item.productoNombre} x{item.cantidad}</span>
                            <div className="d-flex align-items-center">
                              <span className="badge bg-primary rounded-pill me-2">${item.subtotal}</span>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => eliminarItem(item.productoId)}
                                title="Eliminar producto"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
<<<<<<< HEAD

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
=======
                      
                      <div className="border-top pt-3 mt-3">
                        <div className="d-flex justify-content-end">
                          <h5 className="mb-0">
                            <span className="text-muted me-2">Total:</span>
                            <span className="text-primary fw-bold">${calcularTotal()}</span>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                          </h5>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

<<<<<<< HEAD
        <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
=======
        <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
          <button className="btn btn-secondary" onClick={onClose}>
            <i className="bi bi-x-circle me-1"></i>
            Cerrar
          </button>
          {!verModoLectura && (
            <button className="btn btn-primary" onClick={guardarPresupuesto}>
              <i className="bi bi-check-circle me-1"></i>
              Guardar
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
