"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RoleGate } from "@/components/RoleGate";
import { useAuth } from "@/context/auth-context";
import { useSucursal } from "@/context/sucursal-context";
import { getApiBaseUrl } from "@/lib/api-config";

const API_BASE = getApiBaseUrl();

const CAMPOS_PRECIO: { key: string; label: string }[] = [
  { key: "precio_alquiler_lista", label: "Alquiler lista" },
  { key: "precio_alquiler_efectivo", label: "Alquiler efectivo" },
  { key: "precio_venta_nuevo_lista", label: "Venta nuevo lista" },
  { key: "precio_venta_nuevo_efectivo", label: "Venta nuevo efectivo" },
  { key: "precio_de_venta_medio_uso", label: "Venta medio uso" },
  { key: "precio_venta", label: "Precio venta" },
  { key: "precio_liquidacion", label: "Liquidación" },
  { key: "costo", label: "Costo" },
];

type Linea = { id: number; nombre: string };
type SucursalOpt = { id: number; nombre: string };

export default function AjustePreciosPage() {
  const { token, me, isAdmin } = useAuth();
  const { sucursalActual } = useSucursal();
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [sucursales, setSucursales] = useState<SucursalOpt[]>([]);
  const [lineaId, setLineaId] = useState<string>("");
  const [sucursalFiltro, setSucursalFiltro] = useState<string>("");
  const [modo, setModo] = useState<"porcentaje" | "monto_fijo">("porcentaje");
  const [direccion, setDireccion] = useState<"aumento" | "decremento">("aumento");
  const [valor, setValor] = useState("");
  const [campos, setCampos] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    CAMPOS_PRECIO.forEach((c) => {
      o[c.key] = c.key !== "costo";
    });
    return o;
  });
  const [busy, setBusy] = useState(false);

  const sucursalDefault = sucursalActual?.id ?? me?.sucursalId ?? "";

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/config/productos/lineas`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Linea[]) => setLineas(Array.isArray(d) ? d : []))
      .catch(() => setLineas([]));
  }, [token]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    fetch(`${API_BASE}/sucursales/all`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d: SucursalOpt[]) => setSucursales(Array.isArray(d) ? d : []))
      .catch(() => setSucursales([]));
  }, [token, isAdmin]);

  const camposSeleccionados = useMemo(
    () => Object.entries(campos).filter(([, v]) => v).map(([k]) => k),
    [campos]
  );

  const aplicar = async () => {
    if (!token) {
      toast.error("Sesión no válida.");
      return;
    }
    if (!lineaId) {
      toast.error("Elegí una línea de producto.");
      return;
    }
    if (!camposSeleccionados.length) {
      toast.error("Marcá al menos un precio a actualizar.");
      return;
    }
    const v = Number(valor.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Ingresá un valor numérico mayor a cero.");
      return;
    }
    if (
      !window.confirm(
        `Se aplicará el ajuste a todos los productos de la línea seleccionada (${camposSeleccionados.length} lista(s) de precio). ¿Continuar?`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const sucId =
        sucursalFiltro === "" ? null : Number(sucursalFiltro);
      const res = await fetch(`${API_BASE}/productos/ajuste-masivo-precios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          linea_id: Number(lineaId),
          sucursal_id: sucId,
          modo,
          direccion,
          valor: v,
          campos_precio: camposSeleccionados,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        toast.error(data.message || data.detail || "No se pudo aplicar el ajuste.");
        return;
      }
      toast.success(
        data.message ||
          `Actualizados: ${data.data?.actualizados ?? "?"} producto(s).`
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGate allow={["ADMIN", "SUPER_ADMIN"]}>
      <div className="container-fluid px-4 py-3">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
          <div>
            <nav className="small text-muted mb-1">
              <Link href="/configuraciones/productos">Configuración productos</Link>
              {" / "}
              <span>Ajuste de precios</span>
            </nav>
            <h1 className="fw-bold h3 mb-1">Ajuste masivo de precios</h1>
            <p className="text-muted mb-0 small">
              Por línea de producto. Los importes se redondean a <strong>centenas</strong> (múltiplos de 100).
            </p>
          </div>
        </div>

        <div className="card shadow-sm" style={{ maxWidth: "640px" }}>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label fw-semibold">Línea de producto</label>
              <select
                className="form-select"
                value={lineaId}
                onChange={(e) => setLineaId(e.target.value)}
              >
                <option value="">Seleccionar…</option>
                {lineas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">Sucursal (opcional)</label>
              <select
                className="form-select"
                value={sucursalFiltro}
                onChange={(e) => setSucursalFiltro(e.target.value)}
              >
                <option value="">Todas las sucursales</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              <div className="form-text">
                Por defecto podés filtrar por tu sucursal ({sucursalDefault || "—"}). Dejá
                &quot;Todas&quot; solo si corresponde a tu rol.
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Modo</label>
                <select
                  className="form-select"
                  value={modo}
                  onChange={(e) =>
                    setModo(e.target.value as "porcentaje" | "monto_fijo")
                  }
                >
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="monto_fijo">Monto fijo ($)</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Dirección</label>
                <select
                  className="form-select"
                  value={direccion}
                  onChange={(e) =>
                    setDireccion(e.target.value as "aumento" | "decremento")
                  }
                >
                  <option value="aumento">Aumento</option>
                  <option value="decremento">Decremento</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">
                {modo === "porcentaje" ? "Porcentaje" : "Monto"}
              </label>
              <input
                type="text"
                className="form-control"
                inputMode="decimal"
                placeholder={modo === "porcentaje" ? "Ej: 15" : "Ej: 500"}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <div className="fw-semibold mb-2">Listas de precio a afectar</div>
              <div className="row g-2">
                {CAMPOS_PRECIO.map((c) => (
                  <div key={c.key} className="col-12 col-sm-6">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`campo-${c.key}`}
                        checked={Boolean(campos[c.key])}
                        onChange={(e) =>
                          setCampos((prev) => ({
                            ...prev,
                            [c.key]: e.target.checked,
                          }))
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor={`campo-${c.key}`}
                      >
                        {c.label}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => void aplicar()}
            >
              {busy ? "Aplicando…" : "Aplicar ajuste"}
            </button>
          </div>
        </div>
      </div>
    </RoleGate>
  );
}
