"use client";

import { useEffect, useMemo, useState } from "react";
import ReactPaginate from "react-paginate";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/context/auth-context";
import { useSucursal } from "@/context/sucursal-context";
import { ConfirmDeleteDialog } from "@/components/modales/confirm-delete-dialog";
import { scheduleUndoableDelete } from "@/lib/undoable-delete";
import { useFlushUndoableDeletesOnLeave } from "@/hooks/use-flush-undoable-deletes";

type MovimientoConcentradora = {
  id: number;
  sucursal_id: number;
  usuario_id: number | null;
  usuario_nombre: string | null;
  fecha: string;
  tipo_movimiento: string;
  origen: string;
  destino: string | null;
  monto: number;
  descripcion: string | null;
  estado: string;
  caja_movimiento_id: number | null;
};

import { getApiBaseUrl } from "@/lib/api-config";
import { parseMontoInput, formatPesosAr } from "@/lib/money";

const API_BASE = getApiBaseUrl();

const formatCurrency = (value: number) => formatPesosAr(value);
const estadoBadgeClasses: Record<string, string> = {
  Pendiente: "bg-warning-subtle text-warning",
  Confirmado: "bg-success-subtle text-success",
  Rechazado: "bg-danger-subtle text-danger",
};

const getEstadoBadge = (estado: string) =>
  estadoBadgeClasses[estado] || "bg-secondary text-white";

export default function CajaConcentradoraPage() {
  const { token, me, isAdmin } = useAuth();
  const { sucursalActual } = useSucursal();

  const [movimientos, setMovimientos] = useState<MovimientoConcentradora[]>([]);
  const [totalCaja, setTotalCaja] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showModalEnviarChica, setShowModalEnviarChica] = useState(false);
  const [showDetalle, setShowDetalle] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [movimientoEditando, setMovimientoEditando] =
    useState<MovimientoConcentradora | null>(null);
  const [movimientoAEliminar, setMovimientoAEliminar] =
    useState<MovimientoConcentradora | null>(null);
  const [detalleSeleccionado, setDetalleSeleccionado] =
    useState<MovimientoConcentradora | null>(null);

  useFlushUndoableDeletesOnLeave();
  const [form, setForm] = useState({
    tipo_movimiento: "EGRESO" as "INGRESO" | "EGRESO",
    destino: "OTRO",
    monto: "",
    descripcion: "",
    estado: "Confirmado",
  });
  const [transferenciaChica, setTransferenciaChica] = useState({
    monto: "",
    descripcion: "",
  });

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
        `${API_BASE}/caja_concentradora/movimientos?sucursal_id=${sucursalId}`,
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

      const normalizados: MovimientoConcentradora[] = registros.map((mov: any) => ({
        id: mov.id,
        sucursal_id: mov.sucursal_id,
        usuario_id: mov.usuario_id ?? null,
        usuario_nombre: mov.usuario_nombre ?? null,
        fecha: mov.fecha ?? new Date().toISOString(),
        tipo_movimiento: (mov.tipo_movimiento || "INGRESO").toString().toUpperCase(),
        origen: mov.origen ?? "Caja Diaria",
        destino: mov.destino ?? null,
        monto: Number(mov.monto ?? 0),
        descripcion: mov.descripcion ?? null,
        estado: mov.estado ?? "Confirmado",
        caja_movimiento_id: mov.caja_movimiento_id ?? null,
      }));

      setMovimientos(normalizados);
      setTotalCaja(Number(payload.total ?? 0));
    } catch (error: any) {
      console.error("Error al cargar caja concentradora:", error);
      toast.error(error.message || "Error al cargar movimientos de caja concentradora");
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
      destino: "OTRO",
      monto: "",
      descripcion: "",
      estado: "Confirmado",
    });
  };

  useEffect(() => {
    if (!showModal) {
      resetForm();
      setIsEditing(false);
      setMovimientoEditando(null);
    }
  }, [showModal]);

  const movimientosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return movimientos;
    return movimientos.filter((mov) => {
      const texto = [
        mov.usuario_nombre ?? "",
        mov.tipo_movimiento,
        mov.origen,
        mov.destino ?? "",
        mov.descripcion ?? "",
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
      if (mov.estado === "Rechazado") return acc;
      if (mov.tipo_movimiento === "INGRESO") {
        return acc + mov.monto;
      }
      if (mov.tipo_movimiento === "EGRESO") {
        return acc - mov.monto;
      }
      return acc;
    }, 0);
  }, [movimientos]);

  const totalVisible = movimientos.length > 0 ? totalCalculado : totalCaja;

  const handleRegistrarMovimiento = async () => {
    if (isEditing && movimientoEditando) {
      // Actualizar movimiento existente
      if (!token || !sucursalId) {
        toast.error("No se pudo determinar la sucursal o el usuario actual.");
        return;
      }

      setIsSaving(true);
      try {
        const payload: Record<string, any> = {
          descripcion: form.descripcion || null,
          estado: form.estado,
        };

        // Solo permitir editar monto si es un egreso manual
        if (
          movimientoEditando.tipo_movimiento === "EGRESO" &&
          movimientoEditando.origen !== "Caja Diaria"
        ) {
          if (form.monto && parseMontoInput(form.monto) > 0) {
            payload["monto"] = parseMontoInput(form.monto);
          }
          if (form.destino) {
            payload["destino"] = form.destino;
          }
        }

        const response = await fetch(
          `${API_BASE}/caja_concentradora/movimientos/${movimientoEditando.id}`,
          {
            method: "PUT",
            headers: headersAutenticacion(true),
            body: JSON.stringify(payload),
          }
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.message || "No se pudo actualizar el movimiento");
        }

        toast.success("Movimiento actualizado correctamente");
        setShowModal(false);
        await fetchMovimientos();
      } catch (error: any) {
        console.error("Error al actualizar movimiento:", error);
        toast.error(error.message || "No se pudo actualizar el movimiento");
      } finally {
        setIsSaving(false);
      }
    } else {
      // Crear nuevo movimiento
      const montoCrear = parseMontoInput(form.monto);
      if (!form.monto || Number.isNaN(montoCrear) || montoCrear <= 0) {
        toast.error("Ingresá un monto válido");
        return;
      }

      setIsSaving(true);
      try {
        const payload = {
          sucursal_id: sucursalId,
          monto: montoCrear,
          descripcion: form.descripcion || null,
        };

        const endpoint =
          form.destino === "CAJA_CHICA"
            ? `${API_BASE}/caja_concentradora/enviar-caja-chica`
            : `${API_BASE}/caja_concentradora/retiro`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: headersAutenticacion(true),
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.message || "No se pudo registrar el movimiento");
        }

        toast.success(data.message || "Movimiento registrado correctamente");
        setShowModal(false);
        await fetchMovimientos();
      } catch (error: any) {
        console.error("Error al registrar movimiento:", error);
        toast.error(error.message || "Error al registrar el movimiento");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const abrirModalEditar = (movimiento: MovimientoConcentradora) => {
    if (!isAdmin) {
      toast.error("No tenés permisos para editar este movimiento.");
      return;
    }

    setIsEditing(true);
    setMovimientoEditando(movimiento);
    setForm({
      tipo_movimiento: movimiento.tipo_movimiento as "INGRESO" | "EGRESO",
      destino: movimiento.destino || "OTRO",
      monto: movimiento.monto.toString(),
      descripcion: movimiento.descripcion || "",
      estado: movimiento.estado || "Confirmado",
    });
    setShowModal(true);
  };

  const solicitarEliminarMovimiento = (movimiento: MovimientoConcentradora) => {
    if (!isAdmin) {
      toast.error("No tenés permisos para eliminar este movimiento.");
      return;
    }

    if (!token) {
      toast.error("No se pudo determinar el usuario actual.");
      return;
    }

    setMovimientoAEliminar(movimiento);
  };

  const confirmarEliminarMovimiento = () => {
    const movimiento = movimientoAEliminar;
    if (!movimiento) return;
    setMovimientoAEliminar(null);
    const snapshot = movimiento;
    scheduleUndoableDelete({
      id: `caja-concentradora-movimiento-${snapshot.id}`,
      message: "Movimiento de caja concentradora eliminado",
      description: "Podés deshacer durante 10 segundos",
      onOptimisticRemove: () => {
        setMovimientos((prev) => prev.filter((x) => x.id !== snapshot.id));
      },
      onRestore: () => {
        setMovimientos((prev) => {
          if (prev.some((x) => x.id === snapshot.id)) return prev;
          return [...prev, snapshot];
        });
      },
      executeDelete: async () => {
        const response = await fetch(
          `${API_BASE}/caja_concentradora/movimientos/${snapshot.id}`,
          {
            method: "DELETE",
            headers: headersAutenticacion(),
          }
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.message || "No se pudo eliminar el movimiento");
        }

        if (data.data?.movimiento_caja_diaria_eliminado) {
          toast.success(
            "Movimiento eliminado correctamente. También se eliminó el egreso correspondiente en Caja Diaria.",
            { duration: 5000 }
          );
        } else {
          toast.success("Movimiento eliminado correctamente");
        }
      },
    });
  };

  const handleEnviarACajaChica = async () => {
    const montoTransfer = parseMontoInput(transferenciaChica.monto);
    if (
      !transferenciaChica.monto ||
      Number.isNaN(montoTransfer) ||
      montoTransfer <= 0
    ) {
      toast.error("Ingresá un monto válido");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        sucursal_id: sucursalId,
        monto: montoTransfer,
        descripcion: transferenciaChica.descripcion || null,
      };

      const response = await fetch(`${API_BASE}/caja_concentradora/enviar-caja-chica`, {
        method: "POST",
        headers: headersAutenticacion(true),
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "No se pudo enviar a Caja Chica");
      }

      toast.success(data.message || "Dinero enviado a Caja Chica correctamente");
      setShowModalEnviarChica(false);
      setTransferenciaChica({ monto: "", descripcion: "" });
      await fetchMovimientos();
    } catch (error: any) {
      console.error("Error al enviar a caja chica:", error);
      toast.error(error.message || "Error al enviar a Caja Chica");
    } finally {
      setIsSaving(false);
    }
  };

  const abrirDetalle = (movimiento: MovimientoConcentradora) => {
    setDetalleSeleccionado(movimiento);
    setShowDetalle(true);
  };

  // Si no es admin, mostrar mensaje de acceso denegado
  if (me && !isAdmin) {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card shadow-sm">
              <div className="card-body text-center py-5">
                <i className="bi bi-shield-x text-danger" style={{ fontSize: "4rem" }}></i>
                <h3 className="mt-3 mb-2">Acceso Denegado</h3>
                <p className="text-muted">
                  No tenés permisos para acceder a esta sección.
                </p>
                <p className="text-muted small">
                  Solo los administradores pueden ver la Caja Concentradora.
                </p>
                <button
                  className="btn btn-oxblood mt-3"
                  onClick={() => (window.location.href = "/dashboard")}
                >
                  Volver al Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="gt-page-header d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3 mb-4">
        <div>
          <h1 className="page-title mb-1">Caja Concentradora</h1>
          <p className="text-muted mb-0">
            Gestión de ingresos y egresos centralizados por sucursal.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
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
          {isAdmin && (
            <>
              <button
                onClick={() => setShowModal(true)}
                className="btn btn-oxblood"
              >
                <i className="bi bi-cash-stack me-2"></i>
                Registrar Movimiento
              </button>
              <button
                onClick={() => setShowModalEnviarChica(true)}
                className="btn btn-outline-ink"
              >
                <i className="bi bi-arrow-right-circle me-2"></i>
                Enviar a Caja Chica
              </button>
            </>
          )}
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card border-0 bg-oxblood-soft">
            <div className="card-body">
              <div className="text-muted small mb-1">Total en Caja Concentradora</div>
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
            <div className="d-flex gap-2 w-100 w-lg-auto">
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
                Los movimientos aparecerán aquí cuando se realicen transferencias desde Caja Diaria o se registren movimientos manuales.
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
                    <th>Origen</th>
                    <th>Destino</th>
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
                      <td className="small text-muted">
                        {movimiento.usuario_nombre ?? "—"}
                      </td>
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
                        <span
                          className={`badge ${
                            movimiento.origen === "Caja Diaria"
                              ? "bg-steel"
                              : movimiento.origen === "Caja Chica"
                              ? "bg-brass"
                              : "bg-secondary"
                          }`}
                        >
                          {movimiento.origen}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-secondary">
                          {movimiento.destino ?? "—"}
                        </span>
                      </td>
                      <td className="text-end fw-semibold">
                        <span
                          className={
                            movimiento.tipo_movimiento === "INGRESO"
                              ? "text-success"
                              : "text-danger"
                          }
                        >
                          {movimiento.tipo_movimiento === "INGRESO" ? "+" : "-"}
                          ${formatCurrency(movimiento.monto)}
                        </span>
                      </td>
                      <td>
                        <div className="small">
                          {movimiento.descripcion || "—"}
                        </div>
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
                              <button
                                className="btn-action btn-action--borrar"
                                onClick={() => solicitarEliminarMovimiento(movimiento)}
                                title={
                                  movimiento.tipo_movimiento === "INGRESO" &&
                                  movimiento.origen === "Caja Diaria"
                                    ? "Eliminar este movimiento también eliminará el egreso correspondiente en Caja Diaria"
                                    : "Eliminar movimiento"
                                }
                              >
                                <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                              </button>
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
          <span className="text-muted me-2 fw-semibold">Total en Caja Concentradora:</span>
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
                    isEditing ? "bi-pencil text-warning" : "bi-cash-stack text-oxblood"
                  } me-2`}
                ></i>
                {isEditing ? "Editar Movimiento" : "Registrar Movimiento"}
              </h5>
                      <button
                type="button"
                className="btn-close"
                onClick={() => setShowModal(false)}
              ></button>
            </div>
            <div className="modal-body">
              {!isEditing && (
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
                      disabled
                    >
                      <option value="EGRESO">Egreso</option>
                    </select>
                    <div className="text-muted small mt-2">
                      Solo se pueden registrar egresos manualmente. Los ingresos se generan automáticamente desde Caja Diaria.
                    </div>
                  </div>
                  {form.tipo_movimiento === "EGRESO" && (
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Destino</label>
                      <select
                        className="form-select"
                        value={form.destino}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            destino: event.target.value,
                          }))
                        }
                      >
                        <option value="OTRO">Otro</option>
                        <option value="CAJA_CHICA">Caja Chica</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {isEditing && movimientoEditando && (
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <input
                      type="text"
                      className="form-control"
                      value={movimientoEditando.tipo_movimiento}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Origen</label>
                    <input
                      type="text"
                      className="form-control"
                      value={movimientoEditando.origen}
                      disabled
                      readOnly
                    />
                  </div>
                  {movimientoEditando.tipo_movimiento === "EGRESO" &&
                    movimientoEditando.origen !== "Caja Diaria" && (
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Destino</label>
                        <select
                          className="form-select"
                          value={form.destino}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              destino: event.target.value,
                            }))
                          }
                        >
                          <option value="OTRO">Otro</option>
                          <option value="CAJA_CHICA">Caja Chica</option>
                        </select>
                      </div>
                    )}
                </div>
              )}

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
                    <option value="Pendiente">Pendiente</option>
                    <option value="Confirmado">Confirmado</option>
                    <option value="Rechazado">Rechazado</option>
                  </select>
                </div>
              )}
              <div className="row g-3 mt-1">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Monto *</label>
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
                    disabled={
                      isEditing &&
                      movimientoEditando?.origen === "Caja Diaria"
                    }
                  />
                  {isEditing &&
                    movimientoEditando?.origen === "Caja Diaria" && (
                      <div className="text-oxblood small mt-2">
                        El monto de ingresos automáticos desde Caja Diaria no puede modificarse.
                      </div>
                    )}
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
                onClick={handleRegistrarMovimiento}
                disabled={
                  isSaving ||
                  !form.monto ||
                  Number.isNaN(parseMontoInput(form.monto)) ||
                  parseMontoInput(form.monto) <= 0 ||
                  (isEditing &&
                    movimientoEditando?.origen === "Caja Diaria" &&
                    !form.descripcion)
                }
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

      {/* Modal enviar a caja chica */}
      <div
        className={`modal fade ${showModalEnviarChica ? "show" : ""}`}
        style={{ display: showModalEnviarChica ? "block" : "none" }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-arrow-right-circle text-oxblood me-2"></i>
                Enviar a Caja Chica
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowModalEnviarChica(false)}
              ></button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-12">
                  <label className="form-label fw-semibold">Monto *</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    step="0.01"
                    value={transferenciaChica.monto}
                    onChange={(event) =>
                      setTransferenciaChica((prev) => ({
                        ...prev,
                        monto: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="col-md-12">
                  <label className="form-label fw-semibold">Descripción</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={transferenciaChica.descripcion}
                    onChange={(event) =>
                      setTransferenciaChica((prev) => ({
                        ...prev,
                        descripcion: event.target.value,
                      }))
                    }
                    placeholder="Detalle de la transferencia"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModalEnviarChica(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                className="btn btn-oxblood"
                onClick={handleEnviarACajaChica}
                disabled={
                  isSaving ||
                  !transferenciaChica.monto ||
                  Number.isNaN(parseMontoInput(transferenciaChica.monto)) ||
                  parseMontoInput(transferenciaChica.monto) <= 0
                }
              >
                {isSaving ? "Enviando..." : "Enviar"}
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
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowDetalle(false)}
              ></button>
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
                    <span className="text-muted">
                      {detalleSeleccionado.usuario_nombre ?? "—"}
                    </span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Tipo</span>
                    <span className="text-muted">{detalleSeleccionado.tipo_movimiento}</span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Origen</span>
                    <span className="text-muted">{detalleSeleccionado.origen}</span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Destino</span>
                    <span className="text-muted">{detalleSeleccionado.destino ?? "—"}</span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Monto</span>
                    <span className="text-muted">
                      ${formatCurrency(detalleSeleccionado.monto)}
                    </span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Descripción</span>
                    <span className="text-muted">
                      {detalleSeleccionado.descripcion || "—"}
                    </span>
                  </div>
                  <div className="list-group-item px-0">
                    <span className="fw-semibold d-block">Estado</span>
                    <span className="text-muted">{detalleSeleccionado.estado}</span>
                  </div>
            </div>
          ) : (
                <p className="text-muted">No se pudo cargar el detalle.</p>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline-secondary"
                onClick={() => setShowDetalle(false)}
              >
              Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {(showModal || showModalEnviarChica || showDetalle) && (
        <div className="modal-backdrop fade show" style={{ display: "block" }}></div>
      )}

      <ConfirmDeleteDialog
        open={movimientoAEliminar != null}
        onOpenChange={(open) => {
          if (!open) setMovimientoAEliminar(null);
        }}
        itemLabel="este movimiento"
        description={
          movimientoAEliminar?.tipo_movimiento === "INGRESO" &&
          movimientoAEliminar?.origen === "Caja Diaria"
            ? "También se eliminará el egreso correspondiente en Caja Diaria."
            : null
        }
        onConfirm={confirmarEliminarMovimiento}
      />
    </div>
  );
}
