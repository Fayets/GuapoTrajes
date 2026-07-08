import React, { useEffect, useRef } from "react";
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
import {
  descripcionProductoTextClass,
  formatDescripcionProducto,
} from "@/lib/descripcion-producto";
import {
  labelTipoPrecioProducto,
  normalizarTipoPrecioProducto,
  resumenPreciosProducto,
  TIPOS_PRECIO_PRODUCTO,
  type TipoPrecioProducto,
} from "@/lib/tipos-precio-producto";
import {
  addDaysYmd,
  compareYmd,
  fechaNegocioYmd,
  ymdWeekdayUtc,
} from "@/lib/fecha-calendario";

/** ISO / YYYY-MM-DD → DD/MM/AAAA (día ya normalizado a negocio AR). */
function formatFechaArgentina(iso: string): string {
  const t = fechaNegocioYmd(iso);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return (iso || "").trim() || "";
  const [y, m, d] = t.split("-");
  return `${d}/${m}/${y}`;
}

type Cliente = { id: number; nombre: string; apellido: string };
type Precliente = { id: number; nombre: string; apellido: string; celular: string };

/** Respuesta de /presupuestos/conjuntos-misma-fecha-categoria (aviso en modal). */
type ConjuntoMismaFechaFila = {
  nombre_agasajado: string;
  lugar_evento?: string | null;
  productos: string[];
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
  disponible_en_fechas?: boolean | null;
  inmovilizado?: boolean;
  estado?: string;
};

type Item = {
  id?: number;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  tipoPrecio?: TipoPrecioProducto | string;
  precioUnitario?: number;
  subtotal: number;
};

const ITEMS_PRECIO_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 6.25rem 2.25rem",
  columnGap: "0.75rem",
  rowGap: "0.35rem",
  alignItems: "center",
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
  avisoAgregarProducto?: string | null;
  nuevoItem: { productoId: string; porcentaje: string };
  handleItemChange: (campo: string, valor: any) => void;
  agregarPorCodigoBarra?: (codigo: string) => Promise<void>;
  agregarProductoPorId?: (productoId: string) => Promise<void>;
  eliminarItem: (id: number) => void;
  tipoPrecioPresupuesto: TipoPrecioProducto;
  cambiarTipoPrecioPresupuesto: (tipo: TipoPrecioProducto) => void;
  items: Item[];
  calcularTotal: () => number;
  guardarPresupuesto: () => void;
  totalConDescuento?: number | null;
  porcentajeDescuento?: number | null;
  aplicarDescuento: () => void;
  quitarDescuento?: () => void;
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
  avisoAgregarProducto = null,
  nuevoItem,
  handleItemChange,
  agregarPorCodigoBarra,
  agregarProductoPorId,
  eliminarItem,
  tipoPrecioPresupuesto,
  cambiarTipoPrecioPresupuesto,
  items,
  calcularTotal,
  guardarPresupuesto,
  totalConDescuento,
  porcentajeDescuento,
  aplicarDescuento,
  quitarDescuento,
  onClose,
}: Props) {
  const buscarProductoRef = useRef<HTMLInputElement>(null);
  const [eventos, setEventos] = React.useState<
    { id: number; nombre: string }[]
  >([]);

  useEffect(() => {
    if (show && !verModoLectura) {
      buscarProductoRef.current?.focus();
    }
  }, [show, verModoLectura, items.length]);

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

  const [conjuntosMismaFechaRows, setConjuntosMismaFechaRows] = React.useState<
    ConjuntoMismaFechaFila[]
  >([]);
  /** Clave de la última petición válida; el cleanup la vacía para descartar respuestas obsoletas. */
  const conjuntosClaveRef = React.useRef("");

  React.useEffect(() => {
    if (!show) {
      conjuntosClaveRef.current = "";
      setConjuntosMismaFechaRows([]);
      return;
    }
    const fecha = fechaNegocioYmd(formData.fechaEvento);
    const cat = (formData.categoria || "").trim();
    if (!fecha || !cat || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      conjuntosClaveRef.current = "";
      setConjuntosMismaFechaRows([]);
      return;
    }

    const excl = presupuestoSeleccionado?.id;
    const clave = `${fecha}|${cat}|${excl ?? ""}`;
    conjuntosClaveRef.current = clave;

    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      if (conjuntosClaveRef.current !== clave) return;
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setConjuntosMismaFechaRows([]);
          return;
        }
        const API_BASE = getApiBaseUrl();
        const params = new URLSearchParams({
          fecha_evento: fecha,
          categoria_evento: cat,
        });
        if (excl != null) {
          params.set("excluir_id", String(excl));
        }
        const res = await fetch(
          `${API_BASE}/presupuestos/conjuntos-misma-fecha-categoria?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: ctrl.signal,
          }
        );
        if (conjuntosClaveRef.current !== clave) return;
        if (!res.ok) {
          setConjuntosMismaFechaRows([]);
          return;
        }
        const data = (await res.json()) as ConjuntoMismaFechaFila[];
        if (conjuntosClaveRef.current !== clave) return;
        if (!Array.isArray(data) || data.length === 0) {
          setConjuntosMismaFechaRows([]);
          return;
        }
        setConjuntosMismaFechaRows(data);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        if (conjuntosClaveRef.current === clave) setConjuntosMismaFechaRows([]);
      }
    }, 120);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [show, formData.fechaEvento, formData.categoria, presupuestoSeleccionado?.id]);

  const minIsoDevolucion = React.useMemo(() => {
    if (!formData.fechaEvento || !formData.fechaRetiro) return undefined;
    const fe = fechaNegocioYmd(formData.fechaEvento);
    const fr = fechaNegocioYmd(formData.fechaRetiro);
    if (!fe || !fr) return undefined;
    const later = compareYmd(fe, fr) >= 0 ? fe : fr;
    return addDaysYmd(later, 1);
  }, [formData.fechaEvento, formData.fechaRetiro]);

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
    setFormData((prev: any) => {
      const nuevaData = { ...prev, [key]: value };

      if (key === "fechaEvento") {
        if (prev.fechaRetiro && compareYmd(prev.fechaRetiro, value) > 0) {
          nuevaData.fechaRetiro = value;
        }
        if (prev.fechaDevolucion && compareYmd(prev.fechaDevolucion, value) <= 0) {
          nuevaData.fechaDevolucion = addDaysYmd(value, 1);
        }
      }

      if (key === "fechaRetiro") {
        if (prev.fechaEvento && compareYmd(value, prev.fechaEvento) > 0) {
          nuevaData.fechaEvento = value;
        }
        if (prev.fechaDevolucion && compareYmd(value, prev.fechaDevolucion) >= 0) {
          nuevaData.fechaDevolucion = addDaysYmd(value, 1);
        }
      }

      if (key === "fechaDevolucion") {
        const eventoOK =
          prev.fechaEvento && compareYmd(value, prev.fechaEvento) > 0;
        const retiroOK =
          prev.fechaRetiro && compareYmd(value, prev.fechaRetiro) > 0;
        if (!eventoOK || !retiroOK) {
          const fev = prev.fechaEvento || null;
          const fret = prev.fechaRetiro || null;
          let base: string | null = null;
          if (fev && fret) {
            base = compareYmd(fev, fret) >= 0 ? fev : fret;
          } else {
            base = fev || fret;
          }
          if (base) {
            nuevaData.fechaDevolucion = addDaysYmd(base, 1);
          }
        } else if (ymdWeekdayUtc(value) === 0) {
          nuevaData.fechaDevolucion = addDaysYmd(value, 1);
          alert(
            "La fecha de devolución no puede ser domingo. Se ajustó automáticamente al lunes siguiente."
          );
        }
      }

      return nuevaData;
    });
  };

  const totalMostrado =
    typeof totalConDescuento === "number" ? totalConDescuento : calcularTotal();

  const totalOriginal = calcularTotal();
  const hayDescuento = typeof totalConDescuento === "number";
  const etiquetaDescuento =
    hayDescuento && porcentajeDescuento
      ? `(-${porcentajeDescuento}%)`
      : null;
  const totalMostrar = hayDescuento
    ? (totalConDescuento as number)
    : totalOriginal;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-full border-0"
        dialogClassName="modal-xl"
        dialogStyle={{ maxWidth: "min(1480px, 99vw)", width: "99%" }}
      >
        <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
          <DialogTitle>
            {verModoLectura
              ? "Ver Presupuesto"
              : presupuestoSeleccionado?.id
                ? "Editar Presupuesto"
                : "Nuevo Presupuesto"}
          </DialogTitle>
          <DialogDescription>
            {verModoLectura
              ? "Visualización de presupuesto existente"
              : presupuestoSeleccionado?.id
                ? "Modificá fechas o ítems; se revalida disponibilidad y las reservas de la orden si aplica."
                : "Completá los datos del evento y seleccioná los productos"}
          </DialogDescription>
        </DialogHeader>

        <div className="modal-body px-3 px-md-4">
          <div className="row g-4 align-items-lg-start">
            <div className="col-12 col-lg-6 col-xl-6 d-flex flex-column gap-3 gap-lg-4">
          <div className="card shadow-sm mb-0">
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

          <div className="card shadow-sm mb-0">
            <div className="card-header bg-light py-2">
              <h6 className="mb-0 fs-6">
                <i className="bi bi-calendar-event me-2"></i>
                Fechas del Evento
              </h6>
            </div>
            <div className="card-body p-3">
              <div className="row g-2 g-lg-3">
                {/* Fecha del evento */}
                <div className="col-12 col-md-4">
                  <label
                    className="form-label small fw-bold mb-1 d-block"
                    htmlFor="presupuesto-fecha-evento"
                    title="Fecha del evento"
                  >
                    Fecha del evento
                  </label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext form-control-sm border rounded p-2 bg-light">
                      {formatFechaArgentina(formData.fechaEvento) || "-"}
                    </div>
                  ) : (
                    <input
                      id="presupuesto-fecha-evento"
                      name="fechaEvento"
                      type="date"
                      className="form-control form-control-sm"
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
                  <label
                    className="form-label small fw-bold mb-1 d-block"
                    htmlFor="presupuesto-fecha-retiro"
                    title="Fecha de retiro"
                  >
                    Fecha de retiro
                  </label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext form-control-sm border rounded p-2 bg-light">
                      {formatFechaArgentina(formData.fechaRetiro) || "-"}
                    </div>
                  ) : (
                    <input
                      id="presupuesto-fecha-retiro"
                      name="fechaRetiro"
                      type="date"
                      className="form-control form-control-sm"
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
                  <label
                    className="form-label small fw-bold mb-1 d-block"
                    htmlFor="presupuesto-fecha-devolucion"
                    title="Fecha de devolución"
                  >
                    Fecha de devolución
                  </label>
                  {verModoLectura ? (
                    <div className="form-control-plaintext form-control-sm border rounded p-2 bg-light">
                      {formatFechaArgentina(formData.fechaDevolucion) || "-"}
                    </div>
                  ) : (
                    <input
                      id="presupuesto-fecha-devolucion"
                      name="fechaDevolucion"
                      type="date"
                      className="form-control form-control-sm"
                      value={formData.fechaDevolucion}
                      min={minIsoDevolucion}
                      onChange={(e) =>
                        handleFechaChange("fechaDevolucion", e.target.value)
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow-sm mb-0">
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
                  <label className="form-label fw-bold" htmlFor="presupuesto-observaciones">
                    Conjuntos ya armados (solo uso interno)
                  </label>
                  {conjuntosMismaFechaRows.length > 0 ? (
                    <div
                      id="presupuesto-observaciones"
                      className="border rounded bg-light overflow-auto"
                      style={{
                        maxHeight: "min(40vh, 15rem)",
                        fontSize: "0.8125rem",
                        userSelect: "none",
                      }}
                      aria-live="polite"
                    >
                      <div className="px-2 py-1 px-md-3 py-md-2 border-bottom border-secondary border-opacity-25 small text-muted fw-semibold">
                        Conjuntos ya armados para esta fecha
                      </div>
                      {conjuntosMismaFechaRows.map((row, idx) => (
                        <div
                          key={`${row.nombre_agasajado}-${idx}`}
                          className={
                            idx < conjuntosMismaFechaRows.length - 1
                              ? "px-2 py-2 px-md-3 border-bottom border-secondary border-opacity-25"
                              : "px-2 py-2 px-md-3"
                          }
                        >
                          <div className="fw-semibold text-body">{row.nombre_agasajado}</div>
                          {(row.lugar_evento ?? "").trim() ? (
                            <div className="text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                              <i className="bi bi-geo-alt me-1" aria-hidden />
                              {(row.lugar_evento ?? "").trim()}
                            </div>
                          ) : null}
                          <ul className="mb-0 mt-1 ps-3 text-body-secondary" style={{ fontSize: "0.75rem" }}>
                            {(row.productos?.length ? row.productos : ["(sin ítems)"]).map((p, j) => (
                              <li key={j}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      id="presupuesto-observaciones"
                      className="form-control-plaintext border rounded p-2 bg-light text-muted small"
                      style={{ minHeight: "2.75rem", userSelect: "none" }}
                      aria-live="polite"
                    >
                      {formData.categoria?.trim() &&
                      formData.fechaEvento?.trim() &&
                      /^\d{4}-\d{2}-\d{2}$/.test(fechaNegocioYmd(formData.fechaEvento))
                        ? "No hay otros conjuntos armados para esta fecha y categoría."
                        : "—"}
                    </div>
                  )}
                  {!verModoLectura &&
                  formData.categoria?.trim() &&
                  (!formData.fechaEvento?.trim() ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(fechaNegocioYmd(formData.fechaEvento))) ? (
                    <p className="small text-muted mt-2 mb-0">
                      Elegí también la <strong>fecha del evento</strong> para ver acá los conjuntos ya armados en esa fecha y categoría.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

            </div>

            <div className="col-12 col-lg-6 col-xl-6 d-flex flex-column gap-3 gap-lg-4">
          {/* Sección: Productos */}
          <div className="card shadow-sm mb-0">
            <div className="card-header bg-light">
              <h6 className="mb-0">
                <i className="bi bi-box-seam me-2"></i>
                Productos
              </h6>
            </div>
            <div className="card-body p-4">
              {verModoLectura ? (
                <div className="border rounded p-3 bg-light">
                  <h6 className="mb-3">
                    Productos seleccionados
                    <span className="badge bg-secondary bg-opacity-25 text-secondary ms-2 fw-normal">
                      {labelTipoPrecioProducto(tipoPrecioPresupuesto)}
                    </span>
                  </h6>
                  <div
                    className="text-muted small fw-semibold mb-2 d-none d-md-grid"
                    style={ITEMS_PRECIO_GRID_STYLE}
                  >
                    <span>Producto</span>
                    <span className="text-end">Precio</span>
                    <span />
                  </div>
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
                          className="list-group-item bg-transparent border-0 px-0 py-2"
                        >
                          <div style={ITEMS_PRECIO_GRID_STYLE}>
                            <span
                              className={`fw-medium text-break ${descripcionProductoTextClass(nombreProducto)}`}
                            >
                              {nombreProducto}
                            </span>
                            <span className="badge bg-primary rounded-pill text-end justify-self-end">
                              ${Number(subtotal).toLocaleString("es-AR")}
                            </span>
                            <span />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <>
                  <div className="border rounded p-3 mb-3 bg-light">
                    <h6 className="mb-3">Agregar Producto</h6>
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label fw-bold">
                          Buscar producto
                        </label>
                        <input
                          ref={buscarProductoRef}
                          type="text"
                          className="form-control"
                          value={productoFiltro}
                          onChange={(e) => setProductoFiltro(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const codigo = productoFiltro.trim();
                              if (!codigo || !agregarPorCodigoBarra) return;
                              void agregarPorCodigoBarra(codigo);
                            }
                          }}
                          placeholder="Escanear código o buscar por descripción"
                          autoFocus
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold">Producto</label>
                        <select
                          className="form-select"
                          value={nuevoItem.productoId}
                          onChange={(e) => {
                            const id = e.target.value;
                            if (id && agregarProductoPorId) {
                              void agregarProductoPorId(id);
                            } else {
                              handleItemChange("productoId", id);
                            }
                          }}
                        >
                          <option value="">Seleccionar producto</option>
                          {productos
                            .filter((p) =>
                              `${formatDescripcionProducto(p.descripcion, p.descripcion_extra)}${p.codigo_barra}`
                                .toLowerCase()
                                .includes(productoFiltro.toLowerCase())
                            )
                            .map((p) => {
                              const reservado =
                                p.disponible_en_fechas === false;
                              const desc = formatDescripcionProducto(
                                p.descripcion,
                                p.descripcion_extra
                              );
                              const base = `${desc} (${p.codigo_barra}) - ${resumenPreciosProducto(p)}`;
                              const label = reservado ? `${base} — RESERVADO` : base;
                              return (
                                <option
                                  key={p.id}
                                  value={p.id}
                                  disabled={reservado}
                                  style={
                                    reservado
                                      ? { color: "#c1121f", fontWeight: 600 }
                                      : undefined
                                  }
                                >
                                  {label}
                                </option>
                              );
                            })}
                        </select>
                        {avisoAgregarProducto ? (
                          <div
                            className="alert alert-warning border-warning py-2 px-3 mt-2 mb-0 small d-flex align-items-start gap-2"
                            role="alert"
                            style={{
                              backgroundColor: "#fff8e1",
                              color: "#7a5c00",
                            }}
                          >
                            <i
                              className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"
                              aria-hidden
                            />
                            <span>{avisoAgregarProducto}</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold">
                          Tipo de precio
                        </label>
                        <select
                          className="form-select"
                          value={normalizarTipoPrecioProducto(
                            tipoPrecioPresupuesto
                          )}
                          onChange={(e) =>
                            cambiarTipoPrecioPresupuesto(
                              e.target.value as TipoPrecioProducto
                            )
                          }
                          aria-label="Tipo de precio del presupuesto"
                        >
                          {TIPOS_PRECIO_PRODUCTO.map((tipo) => (
                            <option key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </option>
                          ))}
                        </select>
                        <div className="text-muted small mt-1">
                          Aplica a todos los productos del presupuesto
                        </div>
                      </div>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="border rounded p-3 mb-3 bg-light">
                      <h6 className="mb-3">
                        Productos Seleccionados
                        <span className="badge bg-secondary bg-opacity-25 text-secondary ms-2 fw-normal">
                          {labelTipoPrecioProducto(tipoPrecioPresupuesto)}
                        </span>
                      </h6>
                      <div
                        className="text-muted small fw-semibold mb-2 d-none d-md-grid"
                        style={ITEMS_PRECIO_GRID_STYLE}
                      >
                        <span>Producto</span>
                        <span className="text-end">Precio</span>
                        <span />
                      </div>
                      <ul className="list-group list-group-flush">
                        {items.map((item, index) => (
                          <li
                            key={item.id || `${item.productoId}-${index}`}
                            className="list-group-item bg-transparent border-0 px-0 py-2"
                          >
                            <div style={ITEMS_PRECIO_GRID_STYLE}>
                              <span
                                className={`fw-medium text-break ${descripcionProductoTextClass(item.productoNombre)}`}
                              >
                                {item.productoNombre}
                              </span>
                              <span className="badge bg-primary rounded-pill text-nowrap justify-self-end">
                                ${item.subtotal.toLocaleString("es-AR")}
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger justify-self-end"
                                onClick={() =>
                                  item.id && eliminarItem(item.id)
                                }
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
                                {etiquetaDescuento && (
                                  <span className="text-success ms-1">
                                    {etiquetaDescuento}
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

                  {/* Sección: Descuento */}
                  <div className="border rounded p-3 mb-3 bg-light">
                    <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
                      <h6 className="mb-0">Agregar Descuento</h6>
                      {hayDescuento && quitarDescuento && (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={quitarDescuento}
                        >
                          <i className="bi bi-x-circle me-1"></i>
                          Quitar descuento
                        </button>
                      )}
                    </div>
                    <div className="row g-3 align-items-end">
                      <div className="col-12 col-md-8">
                        <label className="form-label fw-bold">
                          Porcentaje de descuento
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder={
                            esAdmin
                              ? "Ej: 7, 12, 23..."
                              : "Ej: 5, 10, 15..."
                          }
                          value={nuevoItem.porcentaje || ""}
                          min={0}
                          max={100}
                          step={0.1}
                          onChange={(e) =>
                            handleItemChange("porcentaje", e.target.value)
                          }
                        />
                      </div>

                      <div className="col-12 col-md-4 d-flex align-items-end">
                        <button
                          type="button"
                          onClick={async () => {
                            aplicarDescuento();
                          }}
                          className="btn btn-success text-nowrap"
                          id="aplicarDescuento"
                        >
                          <i className="bi bi-plus-circle me-1"></i>
                          Aplicar
                        </button>
                      </div>
                      <div className="col-12">
                        <small className="text-muted">
                          <i className="bi bi-info-circle me-1"></i>
                          {esAdmin
                            ? "Como administrador podés ingresar cualquier porcentaje. Si supera el 50%, se pedirá motivo."
                            : "Descuentos mayores a 15% requieren motivo obligatorio."}
                        </small>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card shadow-sm mb-0">
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
                  <strong>{formatFechaArgentina(formData.fechaEvento) || "-"}</strong>
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
                      {etiquetaDescuento && (
                        <span className="text-success ms-1">
                          {etiquetaDescuento}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
