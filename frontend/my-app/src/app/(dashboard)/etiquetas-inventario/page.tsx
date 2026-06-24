"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleGate } from "@/components/RoleGate";
import { useAuth } from "@/context/auth-context";
import { getApiBaseUrl } from "@/lib/api-config";
import {
  fetchAllProductos,
  fetchProductosPage,
  resetEtiquetasInventario,
} from "@/lib/fetch-productos";
import { formatDescripcionProducto } from "@/lib/descripcion-producto";
import { imprimirEtiquetas50x25Lote } from "@/lib/imprimir-etiqueta-50x25";
import { toast } from "sonner";

type ItemConfig = { id: number; nombre: string; codigo: string };

type FiltroEtiqueta = "pendientes" | "impresas" | "todas";

interface ProductoEtiqueta {
  id: number;
  codigo_barra: string;
  descripcion: string;
  descripcion_extra?: string | null;
  linea_nombre?: string | null;
  talle_nombre?: string | null;
  tela_nombre?: string | null;
  color_nombre?: string | null;
  etiqueta_inventario_impresa_at?: string | null;
}

interface StatsEtiquetas {
  total: number;
  impresos: number;
  pendientes: number;
}

type ColaEstado = "pendiente" | "imprimiendo" | "ok" | "error";

interface FilaCola {
  key: string;
  productoId: number;
  codigoBarra: string;
  descripcion: string;
  estado: ColaEstado;
}

const PAGE_SIZE = 25;
const CHUNK_IMPRESION = 50;

function etiquetaImpresaParam(filtro: FiltroEtiqueta): string | undefined {
  if (filtro === "pendientes") return "no";
  if (filtro === "impresas") return "si";
  return undefined;
}

function formatearFecha(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EtiquetasInventarioPage() {
  const API_BASE = getApiBaseUrl();
  const { token, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState<ProductoEtiqueta[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<StatsEtiquetas>({
    total: 0,
    impresos: 0,
    pendientes: 0,
  });

  const [lineas, setLineas] = useState<ItemConfig[]>([]);
  const [talles, setTalles] = useState<ItemConfig[]>([]);
  const [telas, setTelas] = useState<ItemConfig[]>([]);
  const [colores, setColores] = useState<ItemConfig[]>([]);

  const [filtroLineaId, setFiltroLineaId] = useState<number | "">("");
  const [filtroTalleId, setFiltroTalleId] = useState<number | "">("");
  const [filtroTelaId, setFiltroTelaId] = useState<number | "">("");
  const [filtroColorId, setFiltroColorId] = useState<number | "">("");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<FiltroEtiqueta>("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");

  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [seleccionDetalle, setSeleccionDetalle] = useState<
    Map<number, ProductoEtiqueta>
  >(new Map());
  const [imprimiendo, setImprimiendo] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [colaVisual, setColaVisual] = useState<FilaCola[]>([]);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetModo, setResetModo] = useState<"seleccionados" | "filtro" | "todos">(
    "seleccionados"
  );
  const [reseteando, setReseteando] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtrosParams = useMemo(() => {
    const p: Record<string, string | number> = {};
    if (filtroLineaId) p.linea_id = filtroLineaId;
    if (filtroTalleId) p.talle_id = filtroTalleId;
    if (filtroTelaId) p.tela_id = filtroTelaId;
    if (filtroColorId) p.color_id = filtroColorId;
    const ei = etiquetaImpresaParam(filtroEtiqueta);
    if (ei) p.etiqueta_impresa = ei;
    const q = busquedaDebounced.trim();
    if (q) p.q = q;
    return p;
  }, [
    filtroLineaId,
    filtroTalleId,
    filtroTelaId,
    filtroColorId,
    filtroEtiqueta,
    busquedaDebounced,
  ]);

  const statsParams = useMemo(() => {
    const p: Record<string, string | number> = {};
    if (filtroLineaId) p.linea_id = filtroLineaId;
    if (filtroTalleId) p.talle_id = filtroTalleId;
    if (filtroTelaId) p.tela_id = filtroTelaId;
    if (filtroColorId) p.color_id = filtroColorId;
    const q = busquedaDebounced.trim();
    if (q) p.q = q;
    return p;
  }, [filtroLineaId, filtroTalleId, filtroTelaId, filtroColorId, busquedaDebounced]);

  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API_BASE}/config/productos/lineas`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_BASE}/config/productos/talles`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_BASE}/config/productos/telas`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_BASE}/config/productos/colores`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
      .then(async ([rL, rT, rTel, rC]) => {
        if (rL.ok) setLineas(await rL.json());
        if (rT.ok) setTalles(await rT.json());
        if (rTel.ok) setTelas(await rTel.json());
        if (rC.ok) setColores(await rC.json());
      })
      .catch(() => {});
  }, [token, API_BASE]);

  const cargarStats = useCallback(async () => {
    if (!token) return;
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(statsParams)) {
      search.set(k, String(v));
    }
    const qs = search.toString();
    try {
      const res = await fetch(
        `${API_BASE}/productos/stats/etiquetas-inventario${qs ? `?${qs}` : ""}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      setStats({
        total: Number(data.total ?? 0),
        impresos: Number(data.impresos ?? 0),
        pendientes: Number(data.pendientes ?? 0),
      });
    } catch {
      /* ignore */
    }
  }, [token, API_BASE, statsParams]);

  const cargarProductos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { items, total: t } = await fetchProductosPage(
        token,
        page,
        PAGE_SIZE,
        filtrosParams
      );
      setProductos(items as ProductoEtiqueta[]);
      setTotal(t);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al cargar productos"
      );
      setProductos([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, page, filtrosParams]);

  useEffect(() => {
    void cargarProductos();
  }, [cargarProductos]);

  useEffect(() => {
    void cargarStats();
  }, [cargarStats]);

  const limpiarFiltros = () => {
    setFiltroLineaId("");
    setFiltroTalleId("");
    setFiltroTelaId("");
    setFiltroColorId("");
    setFiltroEtiqueta("pendientes");
    setBusqueda("");
    setPage(1);
    limpiarSeleccion();
  };

  const toggleSeleccion = (p: ProductoEtiqueta) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      return next;
    });
    setSeleccionDetalle((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, p);
      return next;
    });
  };

  const agregarSeleccion = (items: ProductoEtiqueta[]) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      items.forEach((p) => next.add(p.id));
      return next;
    });
    setSeleccionDetalle((prev) => {
      const next = new Map(prev);
      items.forEach((p) => next.set(p.id, p));
      return next;
    });
  };

  const limpiarSeleccion = () => {
    setSeleccion(new Set());
    setSeleccionDetalle(new Map());
  };

  const seleccionarPaginaPendientes = () => {
    const pendientes = productos.filter((p) => !p.etiqueta_inventario_impresa_at);
    agregarSeleccion(pendientes);
    toast.success(`${pendientes.length} pendiente(s) de esta página seleccionado(s)`);
  };

  const seleccionarTodosPendientesFiltro = async () => {
    if (!token) return;
    try {
      const todos = (await fetchAllProductos(token, {
        ...filtrosParams,
        etiqueta_impresa: "no",
      })) as ProductoEtiqueta[];
      agregarSeleccion(todos);
      toast.success(`${todos.length} pendiente(s) del filtro seleccionado(s)`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo cargar los pendientes"
      );
    }
  };

  const itemsSeleccionados = useMemo(
    () =>
      Array.from(seleccion)
        .map((id) => seleccionDetalle.get(id))
        .filter((p): p is ProductoEtiqueta => !!p),
    [seleccion, seleccionDetalle]
  );

  const registrarImpresas = async (ids: number[]) => {
    if (!token || ids.length === 0) return;
    const res = await fetch(`${API_BASE}/productos/etiquetas-inventario/registrar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ producto_ids: ids }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(
        typeof json.message === "string"
          ? json.message
          : "Error al registrar etiquetas impresas"
      );
    }
  };

  const ejecutarImpresion = async (
    items: ProductoEtiqueta[],
    marcarSinImprimir = false
  ) => {
    if (!token || items.length === 0) {
      toast.error("Seleccioná al menos un producto");
      return;
    }

    if (marcarSinImprimir) {
      setMarcando(true);
      try {
        await registrarImpresas(items.map((p) => p.id));
        toast.success(`${items.length} producto(s) marcado(s) como impreso(s)`);
        limpiarSeleccion();
        await cargarProductos();
        await cargarStats();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al marcar");
      } finally {
        setMarcando(false);
      }
      return;
    }

    const colaInicial: FilaCola[] = items.map((p, i) => ({
      key: `etq-inv-${p.id}-${i}`,
      productoId: p.id,
      codigoBarra: p.codigo_barra || "",
      descripcion: formatDescripcionProducto(p.descripcion, p.descripcion_extra),
      estado: "imprimiendo" as const,
    }));
    setColaVisual(colaInicial);
    setImprimiendo(true);

    const exitosos: number[] = [];
    const estadosFinales: ColaEstado[] = items.map(() => "error");
    let metodoImpresion: "qz" | "navegador" | undefined;

    try {
      for (let offset = 0; offset < items.length; offset += CHUNK_IMPRESION) {
        const chunk = items.slice(offset, offset + CHUNK_IMPRESION);
        const payload = chunk.map((p) => ({
          codigoBarra: p.codigo_barra || "0",
          descripcion: formatDescripcionProducto(p.descripcion, p.descripcion_extra),
        }));
        const { porIndice, metodo } = await imprimirEtiquetas50x25Lote(payload);
        if (metodo) metodoImpresion = metodo;
        chunk.forEach((p, j) => {
          const globalIdx = offset + j;
          if (porIndice[j] === "ok") {
            estadosFinales[globalIdx] = "ok";
            exitosos.push(p.id);
          }
        });
        setColaVisual((prev) =>
          prev.map((row, idx) => ({
            ...row,
            estado: estadosFinales[idx] ?? row.estado,
          }))
        );
      }

      if (exitosos.length > 0) {
        await registrarImpresas(exitosos);
      }

      const ok = exitosos.length;
      const err = items.length - ok;
      if (err === 0) {
        toast.success(
          metodoImpresion === "navegador"
            ? `${ok} etiqueta(s) listas. En Chrome desactivá «Encabezados y pies de página» y poné márgenes en Ninguno.`
            : `${ok} etiqueta(s) enviada(s) a la Zebra (50×25 mm)`
        );
      } else if (ok === 0) {
        toast.error("No se pudo armar ninguna etiqueta. Revisá los códigos de barras.");
      } else {
        toast.warning(`Listo parcial: ${ok} impresa(s), ${err} con error`);
      }

      limpiarSeleccion();
      await cargarProductos();
      await cargarStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al imprimir");
    } finally {
      setImprimiendo(false);
    }
  };

  const handleReset = async () => {
    if (!token) return;
    if (resetModo === "todos") {
      if (resetConfirmText !== "RESETEAR_TODO_INVENTARIO") {
        toast.error('Escribí exactamente "RESETEAR_TODO_INVENTARIO" para confirmar');
        return;
      }
    }
    setReseteando(true);
    try {
      const body: Record<string, unknown> = {};
      if (resetModo === "todos") {
        body.todos = true;
        body.confirmacion_global = "RESETEAR_TODO_INVENTARIO";
      } else if (resetModo === "seleccionados") {
        if (seleccion.size === 0) {
          toast.error("Seleccioná al menos un producto para resetear");
          return;
        }
        body.producto_ids = Array.from(seleccion);
      } else {
        if (!filtroLineaId && !filtroTalleId && !filtroTelaId && !filtroColorId) {
          toast.error(
            "Para resetear por filtro, elegí al menos línea, talle, tela o color"
          );
          return;
        }
        if (filtroLineaId) body.linea_id = filtroLineaId;
        if (filtroTalleId) body.talle_id = filtroTalleId;
        if (filtroTelaId) body.tela_id = filtroTelaId;
        if (filtroColorId) body.color_id = filtroColorId;
      }

      const json = await resetEtiquetasInventario(token, body);
      toast.success(json.message || "Progreso reseteado");
      setResetOpen(false);
      setResetConfirmText("");
      limpiarSeleccion();
      await cargarProductos();
      await cargarStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al resetear");
    } finally {
      setReseteando(false);
    }
  };

  const seleccionCount = seleccion.size;
  const progresoPct =
    stats.total > 0 ? Math.round((stats.impresos / stats.total) * 100) : 0;

  return (
    <div className="container-fluid px-4 py-3">
      <div className="mb-4">
        <h1 className="fw-bold mb-1">Etiquetas de inventario</h1>
        <p className="text-muted mb-2">
          Sección temporal para etiquetar el inventario cargado. Filtrá por línea,
          talle, tela o color, seleccioná las prendas y seguí el progreso de lo
          impreso.
        </p>
        <div className="alert alert-info py-2 px-3 small mb-0">
          <i className="bi bi-info-circle me-1" aria-hidden />
          Mismo formato <strong>50×25 mm</strong> que en Productos. Una hoja por
          etiqueta en el cuadro de impresión del navegador.
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3">
              <p className="text-muted small mb-1">Total (filtro)</p>
              <p className="h4 mb-0 fw-bold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100 border-start border-warning border-3">
            <div className="card-body py-3">
              <p className="text-muted small mb-1">Pendientes</p>
              <p className="h4 mb-0 fw-bold text-warning">{stats.pendientes}</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100 border-start border-success border-3">
            <div className="card-body py-3">
              <p className="text-muted small mb-1">Impresas</p>
              <p className="h4 mb-0 fw-bold text-success">{stats.impresos}</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3">
              <p className="text-muted small mb-1">Progreso general</p>
              <p className="h4 mb-1 fw-bold">{progresoPct}%</p>
              <div className="progress" style={{ height: 6 }}>
                <div
                  className="progress-bar bg-success"
                  style={{ width: `${progresoPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <p className="small fw-semibold mb-2">Filtros</p>
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small">Línea</label>
              <select
                className="form-select form-select-sm"
                value={filtroLineaId}
                onChange={(e) => {
                  setFiltroLineaId(e.target.value ? Number(e.target.value) : "");
                  setPage(1);
                  limpiarSeleccion();
                }}
              >
                <option value="">Todas</option>
                {lineas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small">Talle</label>
              <select
                className="form-select form-select-sm"
                value={filtroTalleId}
                onChange={(e) => {
                  setFiltroTalleId(e.target.value ? Number(e.target.value) : "");
                  setPage(1);
                  limpiarSeleccion();
                }}
              >
                <option value="">Todos</option>
                {talles.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small">Tela</label>
              <select
                className="form-select form-select-sm"
                value={filtroTelaId}
                onChange={(e) => {
                  setFiltroTelaId(e.target.value ? Number(e.target.value) : "");
                  setPage(1);
                  limpiarSeleccion();
                }}
              >
                <option value="">Todas</option>
                {telas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label small">Color</label>
              <select
                className="form-select form-select-sm"
                value={filtroColorId}
                onChange={(e) => {
                  setFiltroColorId(e.target.value ? Number(e.target.value) : "");
                  setPage(1);
                  limpiarSeleccion();
                }}
              >
                <option value="">Todos</option>
                {colores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-lg-4">
              <label className="form-label small">Buscar</label>
              <Input
                type="search"
                placeholder="Código, descripción, atributos…"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPage(1);
                  limpiarSeleccion();
                }}
              />
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mt-3 align-items-center">
            <span className="small fw-semibold me-1">Estado etiqueta:</span>
            {(
              [
                ["pendientes", "Solo pendientes"],
                ["impresas", "Solo impresas"],
                ["todas", "Todas"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`btn btn-sm ${
                  filtroEtiqueta === val ? "btn-primary" : "btn-outline-secondary"
                }`}
                onClick={() => {
                  setFiltroEtiqueta(val);
                  setPage(1);
                  limpiarSeleccion();
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary ms-auto"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={loading || productos.length === 0}
            onClick={seleccionarPaginaPendientes}
          >
            Seleccionar pendientes (página)
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={loading}
            onClick={() => void seleccionarTodosPendientesFiltro()}
          >
            Seleccionar todos los pendientes del filtro
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={seleccionCount === 0}
            onClick={limpiarSeleccion}
          >
            Deseleccionar
          </button>
          <Button
            disabled={
              seleccionCount === 0 ||
              itemsSeleccionados.length === 0 ||
              imprimiendo ||
              marcando
            }
            onClick={() => void ejecutarImpresion(itemsSeleccionados)}
          >
            <i className="bi bi-printer me-1" aria-hidden />
            {imprimiendo
              ? "Imprimiendo…"
              : `Imprimir seleccionados (${seleccionCount})`}
          </Button>
          <button
            type="button"
            className="btn btn-outline-success btn-sm"
            disabled={
              seleccionCount === 0 ||
              itemsSeleccionados.length === 0 ||
              imprimiendo ||
              marcando
            }
            onClick={() => void ejecutarImpresion(itemsSeleccionados, true)}
          >
            {marcando ? "Marcando…" : "Marcar como impreso (sin imprimir)"}
          </button>
          <RoleGate allow={["ADMIN", "SUPER_ADMIN"]}>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={() => setResetOpen(true)}
            >
              Resetear progreso
            </button>
          </RoleGate>
        </div>
      </div>

      {colaVisual.length > 0 && (
        <div className="card shadow-sm mb-3">
          <div className="card-header py-2 d-flex justify-content-between align-items-center">
            <h2 className="h6 mb-0">Cola de impresión</h2>
            {imprimiendo ? (
              <span className="badge bg-primary">En curso</span>
            ) : (
              <span className="badge bg-secondary">Finalizado</span>
            )}
          </div>
          <div className="card-body p-0">
            <ul className="list-group list-group-flush">
              {colaVisual.map((row) => (
                <li
                  key={row.key}
                  className="list-group-item d-flex flex-column flex-md-row align-items-md-center gap-2"
                >
                  <div className="flex-grow-1">
                    <span className="fw-semibold">{row.descripcion}</span>
                    <span className="text-muted small ms-2">{row.codigoBarra}</span>
                  </div>
                  {row.estado === "imprimiendo" && (
                    <span className="badge bg-primary">Imprimiendo</span>
                  )}
                  {row.estado === "ok" && (
                    <span className="badge bg-success">Listo</span>
                  )}
                  {row.estado === "error" && (
                    <span className="badge bg-danger">Error</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <Table className="align-middle mb-0">
            <TableHeader className="table-light">
              <TableRow>
                <TableHead style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={
                      productos.length > 0 &&
                      productos.every((p) => seleccion.has(p.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        agregarSeleccion(productos);
                      } else {
                        setSeleccion((prev) => {
                          const next = new Set(prev);
                          productos.forEach((p) => next.delete(p.id));
                          return next;
                        });
                        setSeleccionDetalle((prev) => {
                          const next = new Map(prev);
                          productos.forEach((p) => next.delete(p.id));
                          return next;
                        });
                      }
                    }}
                    aria-label="Seleccionar página"
                  />
                </TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Línea</TableHead>
                <TableHead>Talle</TableHead>
                <TableHead>Tela</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4 text-muted">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : productos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4 text-muted">
                    No hay productos con estos filtros.
                  </TableCell>
                </TableRow>
              ) : (
                productos.map((p) => {
                  const impresa = !!p.etiqueta_inventario_impresa_at;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={seleccion.has(p.id)}
                          onChange={() => toggleSeleccion(p)}
                          aria-label={`Seleccionar ${p.descripcion}`}
                        />
                      </TableCell>
                      <TableCell className="fw-semibold">
                        {formatDescripcionProducto(
                          p.descripcion,
                          p.descripcion_extra
                        )}
                      </TableCell>
                      <TableCell>{p.linea_nombre || "—"}</TableCell>
                      <TableCell>{p.talle_nombre || "—"}</TableCell>
                      <TableCell>{p.tela_nombre || "—"}</TableCell>
                      <TableCell>{p.color_nombre || "—"}</TableCell>
                      <TableCell className="font-monospace small">
                        {p.codigo_barra}
                      </TableCell>
                      <TableCell>
                        {impresa ? (
                          <span className="badge bg-success">
                            Impresa
                            {p.etiqueta_inventario_impresa_at && (
                              <span className="ms-1 fw-normal opacity-75">
                                {formatearFecha(p.etiqueta_inventario_impresa_at)}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="badge bg-warning text-dark">Pendiente</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="card-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span className="small text-muted">
              Página {page} de {totalPages} ({total} productos)
            </span>
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resetear progreso de etiquetas</DialogTitle>
          </DialogHeader>
          <p className="small text-muted">
            Esto vuelve a marcar productos como <strong>pendientes</strong>. Solo
            para administradores. Confirmá qué querés resetear:
          </p>
          <div className="d-flex flex-column gap-2">
            <label className="form-check">
              <input
                type="radio"
                className="form-check-input"
                checked={resetModo === "seleccionados"}
                onChange={() => setResetModo("seleccionados")}
              />
              <span className="form-check-label">
                Seleccionados ({seleccionCount})
              </span>
            </label>
            <label className="form-check">
              <input
                type="radio"
                className="form-check-input"
                checked={resetModo === "filtro"}
                onChange={() => setResetModo("filtro")}
              />
              <span className="form-check-label">
                Todos los del filtro actual (línea/talle/tela/color)
              </span>
            </label>
            {isSuperAdmin && (
              <label className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  checked={resetModo === "todos"}
                  onChange={() => setResetModo("todos")}
                />
                <span className="form-check-label">
                  Todo el inventario (todas las sucursales) — solo SUPER_ADMIN
                </span>
              </label>
            )}
          </div>
          {resetModo === "todos" && isSuperAdmin && (
            <div className="alert alert-warning py-2 small mb-2">
              Esta acción resetea <strong>todo</strong> el inventario. Escribí{" "}
              <code>RESETEAR_TODO_INVENTARIO</code> para confirmar.
            </div>
          )}
          {resetModo === "todos" && isSuperAdmin && (
            <Input
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="RESETEAR_TODO_INVENTARIO"
              className="mb-2 font-monospace"
            />
          )}
          {resetModo === "todos" && !isSuperAdmin && (
            <div className="alert alert-info py-2 small mb-0">
              El reset global requiere rol SUPER_ADMIN.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={reseteando}
              onClick={() => void handleReset()}
            >
              {reseteando ? "Reseteando…" : "Confirmar reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
