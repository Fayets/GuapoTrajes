"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";
import { RoleGate } from "@/components/RoleGate";
import { toast } from "sonner";
import { formatDateTimeArgentina } from "@/lib/fecha-calendario";

type AuditoriaItem = {
  id: number;
  fecha_hora: string;
  usuario?: {
    id: number;
    nombre_completo?: string;
    nombre?: string;
    apellido?: string;
  } | null;
  accion: string;
  entidad_tipo: string;
  entidad_id: number;
  resumen: string;
  sucursal_nombre?: string | null;
};

const ACCION_LABEL: Record<string, string> = {
  PRESUPUESTO_CREADO: "Presupuesto creado",
  PRESUPUESTO_EDITADO: "Presupuesto editado",
  ORDEN_CREADA: "Orden creada",
  CONTRATO_GENERADO: "Contrato generado",
  COBRO: "Cobro",
  DEVOLUCION_COMPLETA: "Devolución completa",
  DEVOLUCION_PARCIAL: "Devolución parcial / revisión",
  REVISION_DEVOLUCION_RESUELTA: "Revisión de devolución resuelta",
  LAVANDERIA_ENVIO: "Envío lavandería",
  LAVANDERIA_RECEPCION: "Recepción lavandería",
  MODISTA_ENVIO: "Envío modista",
  MODISTA_RECEPCION: "Recepción modista",
  ORDEN_ELIMINADA: "Orden eliminada",
};

export default function AuditoriaPage() {
  const { token, isAdmin, isSuperAdmin } = useAuth();
  const [items, setItems] = useState<AuditoriaItem[]>([]);
  const [acciones, setAcciones] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [accion, setAccion] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);

  const puedeVer = isAdmin || isSuperAdmin;

  const cargar = useCallback(async () => {
    if (!token || !puedeVer) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (accion) qs.set("accion", accion);
      if (fechaDesde) qs.set("fecha_desde", fechaDesde);
      if (fechaHasta) qs.set("fecha_hasta", fechaHasta);
      qs.set("page", String(page));
      qs.set("page_size", "50");
      const res = await apiFetch(`/auditoria?${qs.toString()}`, { token });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      const json = await res.json();
      const data = json.data || {};
      setItems(data.items || []);
      setTotal(data.total || 0);
      if (Array.isArray(data.acciones) && data.acciones.length) {
        setAcciones(data.acciones);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al cargar auditoría";
      toast.error(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, puedeVer, accion, fechaDesde, fechaHasta, page]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <RoleGate allow={["ADMIN", "SUPER_ADMIN"]}>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
          <div>
            <h1 className="h3 mb-1">Auditoría por usuario</h1>
            <p className="text-muted mb-0 small">
              Quién ejecutó cada acción del sistema (presupuestos, contratos, cobros,
              devoluciones, taller).
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-ink"
            onClick={() => cargar()}
            disabled={loading}
          >
            Actualizar
          </button>
        </div>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-3">
                <label className="form-label small text-muted">Acción</label>
                <select
                  className="form-select"
                  value={accion}
                  onChange={(e) => {
                    setPage(1);
                    setAccion(e.target.value);
                  }}
                >
                  <option value="">Todas</option>
                  {acciones.map((a) => (
                    <option key={a} value={a}>
                      {ACCION_LABEL[a] || a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small text-muted">Desde</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaDesde}
                  onChange={(e) => {
                    setPage(1);
                    setFechaDesde(e.target.value);
                  }}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small text-muted">Hasta</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaHasta}
                  onChange={(e) => {
                    setPage(1);
                    setFechaHasta(e.target.value);
                  }}
                />
              </div>
              <div className="col-md-3 text-muted small">
                {total} evento(s)
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table gt-table align-middle mb-0">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Resumen</th>
                  <th>Entidad</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      Cargando…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      No hay eventos de auditoría para los filtros elegidos.
                    </td>
                  </tr>
                ) : (
                  items.map((ev) => (
                    <tr key={ev.id}>
                      <td className="small text-nowrap">
                        {ev.fecha_hora
                          ? formatDateTimeArgentina(ev.fecha_hora)
                          : "—"}
                      </td>
                      <td className="small">
                        {ev.usuario?.nombre_completo ||
                          `${ev.usuario?.nombre || ""} ${ev.usuario?.apellido || ""}`.trim() ||
                          "—"}
                      </td>
                      <td className="small">
                        {ACCION_LABEL[ev.accion] || ev.accion}
                      </td>
                      <td>{ev.resumen}</td>
                      <td className="small text-muted text-nowrap">
                        {ev.entidad_tipo} #{ev.entidad_id}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {total > 50 && (
            <div className="card-footer d-flex justify-content-between align-items-center">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span className="small text-muted">Página {page}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={page * 50 >= total || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>
    </RoleGate>
  );
}
