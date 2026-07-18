"use client";

import { useEffect, useMemo, useState } from "react";
import ReactPaginate from "react-paginate";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/context/auth-context";
import { useSucursal } from "@/context/sucursal-context";

type MovimientoCajaChica = {
  id: number;
  fecha: string;
  usuario_id: number;
  usuario_nombre: string;
  tipo_movimiento: "INGRESO" | "EGRESO";
  metodo_pago: string;
  tipo_egreso: string | null;
  monto: number;
  descripcion: string | null;
  estado: string;
  etiqueta?: string | null;
  referencia?: string | null;
  caja_movimiento_id?: number | null;
  caja_diaria_id?: number | null;
  enviado_concentradora?: boolean;
};

const tiposEgresoOptions = [
  { value: "OPERATIVO", label: "Operativo" },
  { value: "ADMINISTRATIVO", label: "Administrativo" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "OTROS", label: "Otros" },
];

const estadoOptions = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "RECHAZADO", label: "Rechazado" },
];

const estadoBadgeClasses: Record<string, string> = {
  PENDIENTE: "bg-warning-subtle text-warning",
  APROBADO: "bg-success-subtle text-success",
  RECHAZADO: "bg-danger-subtle text-danger",
};

import { getApiBaseUrl } from "@/lib/api-config";

const API_BASE = getApiBaseUrl();

const formatCurrency = (value: number) =>
  value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const METODO_CAJA_CHICA = "EFECTIVO";

const getMetodoPagoLabel = (value: string) =>
  value === METODO_CAJA_CHICA ? "Efectivo" : value;

const getTipoEgresoLabel = (value?: string | null) =>
  value
    ? tiposEgresoOptions.find((item) => item.value === value)?.label || value
    : "—";

const getEstadoBadge = (estado: string) =>
  estadoBadgeClasses[estado] || "bg-secondary text-white";

export default function CajaChicaPage() {
  const { token, me, isAdmin } = useAuth();
  const { sucursalActual } = useSucursal();

  const [movimientos, setMovimientos] = useState<MovimientoCajaChica[]>([]);
  const [totalCaja, setTotalCaja] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [movimientoEditando, setMovimientoEditando] =
    useState<MovimientoCajaChica | null>(null);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetalle, setShowDetalle] = useState(false);
  const [detalleSeleccionado, setDetalleSeleccionado] =
    useState<MovimientoCajaChica | null>(null);
  const [form, setForm] = useState({
    tipo_movimiento: "EGRESO" as "INGRESO" | "EGRESO",
    tipo_egreso: "OPERATIVO",
    monto: "",
    descripcion: "",
    estado: "PENDIENTE",
  });

  const getLocalDateString = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split("T")[0];
  };

  const [fechaExportDesde, setFechaExportDesde] = useState(() => getLocalDateString());
  const [fechaExportHasta, setFechaExportHasta] = useState(() => getLocalDateString());
  const [exportando, setExportando] = useState(false);

  const sucursalId = sucursalActual?.id ?? me?.sucursalId ?? 1;

  const headersAutenticacion = (withJson = false) => {
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
      ...(withJson ? { "Content-Type": "application/json" } : {}),
    };
  };

  const fetchMovimientos = async () => {
    if (!token || !sucursalId) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/caja_chica/movimientos?sucursal_id=${sucursalId}`,
        { headers: headersAutenticacion() }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        const message =
          data?.message || data?.detail || "No se pudieron obtener los movimientos";
        toast.error(message);
        return;
      }

      const payload = data?.data ?? { movimientos: [], total: 0 };
      const registros = Array.isArray(payload.movimientos)
        ? payload.movimientos
        : [];

      const normalizados: MovimientoCajaChica[] = registros.map((mov: any) => ({
        id: mov.id,
        fecha: mov.fecha ?? new Date().toISOString(),
        usuario_id: mov.usuario_id,
        usuario_nombre: mov.usuario_nombre,
        tipo_movimiento: (mov.tipo_movimiento || mov.tipo || "EGRESO")
          .toString()
          .toUpperCase(),
        metodo_pago: (mov.metodo_pago || "EFECTIVO").toString().toUpperCase(),
        tipo_egreso: mov.tipo_egreso
          ? mov.tipo_egreso.toString().toUpperCase()
          : null,
        monto: Number(mov.monto ?? 0),
        descripcion: mov.descripcion ?? null,
        estado: (mov.estado || "PENDIENTE").toString().toUpperCase(),
        etiqueta: mov.etiqueta,
        referencia: mov.referencia,
        caja_movimiento_id: mov.caja_movimiento_id ?? null,
        caja_diaria_id: mov.caja_diaria_id ?? null,
        enviado_concentradora: Boolean(mov.enviado_concentradora),
      }));

      setMovimientos(normalizados);
      setTotalCaja(Number(payload.total ?? 0));
    } catch (error: any) {
      console.error("Error al cargar caja chica:", error);
      toast.error(error.message || "Error al cargar movimientos de caja chica");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMovimientos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sucursalId]);

  const resetForm = () => {
    setForm({
      tipo_movimiento: "EGRESO",
      tipo_egreso: "OPERATIVO",
      monto: "",
      descripcion: "",
      estado: "PENDIENTE",
    });
  };

  useEffect(() => {
    if (!showModal) {
      resetForm();
      setIsEditing(false);
      setMovimientoEditando(null);
    }
  }, [showModal]);

  const exportarExcel = async () => {
    if (!token || !sucursalId) return;
    if (!fechaExportDesde || !fechaExportHasta) {
      toast.error("Indicá fecha desde y fecha hasta para exportar");
      return;
    }
    if (fechaExportDesde > fechaExportHasta) {
      toast.error("La fecha desde no puede ser posterior a la fecha hasta");
      return;
    }
    setExportando(true);
    try {
      const params = new URLSearchParams({
        fecha_desde: fechaExportDesde,
        fecha_hasta: fechaExportHasta,
        sucursal_id: String(sucursalId),
      });
      const response = await fetch(
        `${API_BASE}/caja_chica/exportar-excel?${params}`,
        { headers: headersAutenticacion() }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Error al exportar Excel");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `caja_chica_${fechaExportDesde}_${fechaExportHasta}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Excel exportado correctamente");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al exportar";
      toast.error(msg);
    } finally {
      setExportando(false);
    }
  };

  const movimientosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return movimientos;
    return movimientos.filter((mov) => {
      const texto = [
        mov.usuario_nombre,
        mov.tipo_movimiento,
        mov.metodo_pago,
        mov.tipo_egreso ?? "",
        mov.descripcion ?? "",
        mov.etiqueta ?? "",
        mov.estado ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return texto.includes(term);
    });
  }, [movimientos, search]);

  const [paginaActual, setPaginaActual] = useState(0);
  const MOVIMIENTOS_POR_PAGINA = 18;

  useEffect(() => {
    setPaginaActual(0);
  }, [search]);

  const pageCount = Math.ceil(movimientosFiltrados.length / MOVIMIENTOS_POR_PAGINA);
  const offsetPagina =
    Math.min(paginaActual, Math.max(0, pageCount - 1)) * MOVIMIENTOS_POR_PAGINA;
  const movimientosPaginados = movimientosFiltrados.slice(
    offsetPagina,
    offsetPagina + MOVIMIENTOS_POR_PAGINA
  );

  const totalCalculado = useMemo(() => {
    return movimientos.reduce((acc, mov) => {
      if (mov.estado === "RECHAZADO") return acc;
      if (mov.tipo_movimiento === "INGRESO") {
        return acc + mov.monto;
      }
      if (mov.tipo_movimiento === "EGRESO") {
        return acc - mov.monto;
      }
      return acc;
    }, 0);
  }, [movimientos]);

  const totalVisible =
    movimientos.length > 0 ? totalCalculado : totalCaja;

  const esIngresoManual = form.tipo_movimiento === "INGRESO";
  const esMovimientoEgreso = form.tipo_movimiento === "EGRESO";
  const esFormularioValido = esMovimientoEgreso
    ? form.monto.trim() !== "" &&
      Number(form.monto) > 0 &&
      !!form.tipo_egreso
    : isEditing && isAdmin;

  const handleSubmit = async () => {
    const esMovimientoEgreso =
      form.tipo_movimiento === "EGRESO" ||
      (isEditing && movimientoEditando?.tipo_movimiento === "EGRESO");

    const montoNumber = esMovimientoEgreso
      ? Number(form.monto)
      : movimientoEditando?.monto ?? 0;

    if (esMovimientoEgreso && (!montoNumber || montoNumber <= 0)) {
      toast.error("Ingresá un monto válido para registrar el egreso.");
      return;
    }

    if (!token || !sucursalId) {
      toast.error("No se pudo determinar la sucursal o el usuario actual.");
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && movimientoEditando) {
        const payload: Record<string, any> = {
          descripcion: form.descripcion || null,
          estado: form.estado,
          metodo_pago: METODO_CAJA_CHICA,
        };

        if (movimientoEditando.tipo_movimiento === "EGRESO") {
          payload["monto"] = montoNumber;
          payload["tipo_egreso"] = form.tipo_egreso;
        }

        const response = await fetch(
          `${API_BASE}/caja_chica/movimientos/${movimientoEditando.id}`,
          {
            method: "PUT",
            headers: headersAutenticacion(true),
            body: JSON.stringify(payload),
          }
        );
        const result = await response.json().catch(() => ({}));

        if (!response.ok || result?.success === false) {
          const message =
            result?.message ||
            result?.detail ||
            "No se pudo actualizar el movimiento";
          throw new Error(message);
        }

        toast.success("Movimiento actualizado correctamente");
      } else {
        const payload = {
          sucursal_id: sucursalId,
          tipo_movimiento: form.tipo_movimiento,
          metodo_pago: METODO_CAJA_CHICA,
          tipo_egreso: form.tipo_movimiento === "EGRESO" ? form.tipo_egreso : null,
          monto: montoNumber,
          descripcion: form.descripcion || null,
          estado: form.estado,
        };

        const response = await fetch(`${API_BASE}/caja_chica/movimientos`, {
          method: "POST",
          headers: headersAutenticacion(true),
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || result?.success === false) {
          const message =
            result?.message ||
            result?.detail ||
            "No se pudo registrar el movimiento";
          throw new Error(message);
        }

        toast.success("Movimiento de caja chica registrado correctamente");
      }

      setShowModal(false);
      await fetchMovimientos();
    } catch (error: any) {
      console.error("Error al guardar movimiento de caja chica:", error);
      toast.error(error.message || "No se pudo guardar el movimiento");
    } finally {
      setIsSaving(false);
    }
  };

  const abrirDetalle = (movimiento: MovimientoCajaChica) => {
    setDetalleSeleccionado(movimiento);
    setShowDetalle(true);
  };

  const abrirModalCrear = () => {
    resetForm();
    setIsEditing(false);
    setMovimientoEditando(null);
    setShowModal(true);
  };

  const abrirModalEditar = (movimiento: MovimientoCajaChica) => {
    if (!isAdmin) {
      toast.error("No tenés permisos para editar este movimiento.");
      return;
    }

    setIsEditing(true);
    setMovimientoEditando(movimiento);
    setForm({
      tipo_movimiento: movimiento.tipo_movimiento,
      tipo_egreso:
        movimiento.tipo_movimiento === "EGRESO"
          ? movimiento.tipo_egreso || "OPERATIVO"
          : "OPERATIVO",
      monto: movimiento.monto.toString(),
      descripcion: movimiento.descripcion || "",
      estado: movimiento.estado || "PENDIENTE",
    });
    setShowModal(true);
  };

  const handleDelete = async (movimiento: MovimientoCajaChica) => {
    if (movimiento.tipo_movimiento !== "EGRESO") {
      toast.info("Los ingresos automáticos no pueden eliminarse desde aquí.");
      return;
    }

    if (!isAdmin) {
      toast.error("No tenés permisos para eliminar este movimiento.");
      return;
    }

    const confirmacion = window.confirm(
      "¿Seguro que querés eliminar este movimiento de caja chica?"
    );
    if (!confirmacion) return;

    if (!token) {
      toast.error("No se pudo determinar el usuario actual.");
      return;
    }

    setEliminandoId(movimiento.id);
    try {
      const response = await fetch(
        `${API_BASE}/caja_chica/movimientos/${movimiento.id}`,
        {
          method: "DELETE",
          headers: headersAutenticacion(),
        }
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.success === false) {
        const message =
          result?.message ||
          result?.detail ||
          "No se pudo eliminar el movimiento";
        throw new Error(message);
      }

      toast.success("Movimiento eliminado correctamente");
      await fetchMovimientos();
    } catch (error: any) {
      console.error("Error al eliminar movimiento de caja chica:", error);
      toast.error(error.message || "No se pudo eliminar el movimiento");
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div>
      <div className="gt-page-header d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3 mb-4">
        <div>
          <h1 className="page-title mb-1">Caja Chica</h1>
          <p className="text-muted mb-0">Gestión de ingresos y egresos por sucursal.</p>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <button
            onClick={fetchMovimientos}
            disabled={isLoading}
            className="btn btn-outline-ink"
          >
            {isLoading ? (
              <i className="bi bi-arrow-clockwise spin me-2"></i>
            ) : (
              <i className="bi bi-arrow-clockwise me-2"></i>
            )}
            Refrescar
          </button>
          <button
            onClick={abrirModalCrear}
            className="btn btn-oxblood"
          >
            <i className="bi bi-plus me-2"></i>
            Registrar Movimiento
          </button>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card border-0 bg-oxblood-soft">
            <div className="card-body">
              <div className="text-muted small mb-1">Total en Caja</div>
              <div className="h4 text-oxblood mb-0">
                ${formatCurrency(totalVisible)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-light">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
            <div>
              <h5 className="card-title mb-0">Movimientos</h5>
              <p className="text-muted small mb-0">
                {movimientosFiltrados.length} movimiento{movimientosFiltrados.length === 1 ? "" : "s"} encontrado{movimientosFiltrados.length === 1 ? "" : "s"}.
              </p>
            </div>
            <div className="d-flex flex-column flex-md-row align-items-md-center gap-2 w-100 w-lg-auto">
              <div className="input-group gt-search">
                <span className="input-group-text">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar movimientos..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="d-flex align-items-center gap-2 flex-shrink-0">
                <input
                  type="date"
                  className="form-control form-control-sm gt-select"
                  title="Exportar desde"
                  value={fechaExportDesde}
                  onChange={(e) => setFechaExportDesde(e.target.value)}
                />
                <span className="text-muted small">a</span>
                <input
                  type="date"
                  className="form-control form-control-sm gt-select"
                  title="Exportar hasta"
                  value={fechaExportHasta}
                  onChange={(e) => setFechaExportHasta(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void exportarExcel()}
                  disabled={exportando || !token}
                  className="btn btn-outline-ink btn-sm text-nowrap"
                >
                  <i className="bi bi-file-earmark-excel me-1"></i>
                  {exportando ? "Exportando…" : "Excel"}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          {isLoading ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
              Cargando movimientos...
            </div>
          ) : movimientosFiltrados.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-inbox display-4 d-block mb-3"></i>
              <h5 className="text-muted">No hay movimientos registrados</h5>
              <p className="text-muted">
                Registrá un movimiento para comenzar a visualizar la actividad de caja chica.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table gt-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Tipo</th>
                    <th>Tipo de Egreso</th>
                    <th className="text-end">Monto</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosPaginados.map((movimiento) => (
                    <tr key={movimiento.id}>
                      <td className="fw-medium">
                        {format(new Date(movimiento.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
                      </td>
                      <td className="small text-muted">{movimiento.usuario_nombre}</td>
                      <td>
                        <span
                          className={`badge ${
                            movimiento.tipo_movimiento === "INGRESO"
                              ? "bg-success"
                              : "bg-danger"
                          }`}
                        >
                          {movimiento.tipo_movimiento}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-secondary">
                          {movimiento.tipo_movimiento === "EGRESO"
                            ? getTipoEgresoLabel(movimiento.tipo_egreso)
                            : "N/A"}
                        </span>
                      </td>
                      <td className="text-end fw-semibold">
                        <span className={movimiento.tipo_movimiento === "INGRESO" ? "text-success" : "text-danger"}>
                          {movimiento.tipo_movimiento === "INGRESO" ? "+" : "-"}${formatCurrency(movimiento.monto)}
                        </span>
                      </td>
                      <td>
                        <div className="small">{movimiento.descripcion || "—"}</div>
                        {movimiento.etiqueta && (
                          <span className="bg-oxblood-soft text-oxblood small px-2 py-1 rounded d-inline-block mt-1">
                            {movimiento.etiqueta}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${getEstadoBadge(movimiento.estado)}`}>
                          {movimiento.estado}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                          {isAdmin && (
                            <>
                              <button
                                className="btn-action btn-action--editar"
                                onClick={() => abrirModalEditar(movimiento)}
                                title="Editar"
                              >
                                <Pencil size={16} strokeWidth={1.75} aria-hidden />
                              </button>
                              {movimiento.tipo_movimiento === "EGRESO" && (
                                <button
                                  className="btn-action btn-action--borrar"
                                  onClick={() => handleDelete(movimiento)}
                                  disabled={eliminandoId === movimiento.id}
                                  title="Eliminar"
                                >
                                  {eliminandoId === movimiento.id ? (
                                    <i className="bi bi-arrow-clockwise spin"></i>
                                  ) : (
                                    <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                                  )}
                                </button>
                              )}
                            </>
                          )}
                          <button
                            className="btn-action btn-action--ver"
                            onClick={() => abrirDetalle(movimiento)}
                            title="Ver detalle"
                          >
                            <Eye size={16} strokeWidth={1.75} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && pageCount > 1 && (
            <div className="d-flex flex-column align-items-center gap-1 px-3 py-2 border-top">
              <ReactPaginate
                previousLabel={"←"}
                nextLabel={"→"}
                breakLabel={"..."}
                pageCount={pageCount}
                pageRangeDisplayed={3}
                marginPagesDisplayed={1}
                onPageChange={({ selected }) => setPaginaActual(selected)}
                containerClassName={"pagination"}
                pageClassName={"page-item"}
                pageLinkClassName={"page-link"}
                previousClassName={"page-item"}
                previousLinkClassName={"page-link"}
                nextClassName={"page-item"}
                nextLinkClassName={"page-link"}
                breakClassName={"page-item"}
                breakLinkClassName={"page-link"}
                activeClassName={"active"}
                forcePage={Math.min(paginaActual, Math.max(0, pageCount - 1))}
              />
              <span className="text-muted small text-center">
                Mostrando {offsetPagina + 1}–
                {Math.min(offsetPagina + MOVIMIENTOS_POR_PAGINA, movimientosFiltrados.length)} de{" "}
                {movimientosFiltrados.length} movimientos
              </span>
            </div>
          )}
        </div>
        <div className="card-footer text-end bg-white">
          <span className="text-muted me-2 fw-semibold">Total en Caja:</span>
          <span className="text-oxblood fw-bold">${formatCurrency(totalVisible)}</span>
        </div>
      </div>

      {/* Modal registrar movimiento */}
      <div
        className={`modal fade ${showModal ? "show" : ""}`}
        style={{ display: showModal ? "block" : "none" }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i
                  className={`bi ${
                    isEditing ? "bi-pencil text-warning" : "bi-plus-circle text-oxblood"
                  } me-2`}
                ></i>
                {isEditing ? "Editar Movimiento" : "Registrar Movimiento"}
              </h5>
              <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Tipo de movimiento</label>
                  <select
                    className="form-select"
                    value={form.tipo_movimiento}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        tipo_movimiento: event.target.value as "INGRESO" | "EGRESO",
                      }))
                    }
                    disabled={isEditing}
                  >
                    <option value="EGRESO">Egreso</option>
                    <option value="INGRESO">Ingreso</option>
                  </select>
                  {esIngresoManual && (
                    <div className="text-oxblood small mt-2">
                      Los ingresos se generan automáticamente desde Caja Diaria.
                    </div>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="mt-3">
                  <label className="form-label fw-semibold">Estado</label>
                  <select
                    className="form-select"
                    value={form.estado}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        estado: event.target.value,
                      }))
                    }
                  >
                    {estadoOptions.map((opcion) => (
                      <option key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.tipo_movimiento === "EGRESO" && (
                <div className="mt-3">
                  <label className="form-label fw-semibold">Tipo de egreso</label>
                  <select
                    className="form-select"
                    value={form.tipo_egreso}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        tipo_egreso: event.target.value,
                      }))
                    }
                  >
                    {tiposEgresoOptions.map((opcion) => (
                      <option key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="row g-3 mt-1">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Monto</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    step="0.01"
                    value={form.monto}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        monto: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    disabled={esIngresoManual}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Descripción</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={form.descripcion}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        descripcion: event.target.value,
                      }))
                    }
                    placeholder="Detalle del movimiento"
                    disabled={esIngresoManual && !isEditing}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                className="btn btn-oxblood"
                onClick={handleSubmit}
                disabled={isSaving || !esFormularioValido}
              >
                {isSaving
                  ? "Guardando..."
                  : isEditing
                  ? "Actualizar"
                  : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal detalle */}
      <div
        className={`modal fade ${showDetalle ? "show" : ""}`}
        style={{ display: showDetalle ? "block" : "none" }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-eye text-secondary me-2"></i>
                Detalle del movimiento
              </h5>
              <button type="button" className="btn-close" onClick={() => setShowDetalle(false)}></button>
            </div>
            <div className="modal-body">
              {detalleSeleccionado ? (
                <div className="list-group list-group-flush">
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Fecha</span>
                    <span className="text-muted">
                      {format(new Date(detalleSeleccionado.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
                    </span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Usuario</span>
                    <span className="text-muted">{detalleSeleccionado.usuario_nombre}</span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Tipo</span>
                    <span className="text-muted">{detalleSeleccionado.tipo_movimiento}</span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Método de pago</span>
                    <span className="text-muted">{getMetodoPagoLabel(detalleSeleccionado.metodo_pago)}</span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Tipo de egreso</span>
                    <span className="text-muted">{getTipoEgresoLabel(detalleSeleccionado.tipo_egreso)}</span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Monto</span>
                    <span className="text-muted">${formatCurrency(detalleSeleccionado.monto)}</span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Descripción</span>
                    <span className="text-muted">{detalleSeleccionado.descripcion || "—"}</span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Estado</span>
                    <span className="text-muted">{detalleSeleccionado.estado}</span>
                  </div>
                  {detalleSeleccionado.etiqueta && (
                    <div className="list-group-item px-0">
                      <span className="fw-semibold d-block">Origen</span>
                      <span className="text-muted">{detalleSeleccionado.etiqueta}</span>
                    </div>
                  )}
                  {isAdmin && detalleSeleccionado.caja_diaria_id && (
                    <div className="list-group-item px-0">
                      <span className="fw-semibold d-block">Movimiento en Caja Diaria</span>
                      <span className="text-muted">{detalleSeleccionado.caja_diaria_id}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted">No se pudo cargar el detalle.</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={() => setShowDetalle(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {(showModal || showDetalle) && (
        <div className="modal-backdrop fade show" style={{ display: "block" }}></div>
      )}
    </div>
  );
}

