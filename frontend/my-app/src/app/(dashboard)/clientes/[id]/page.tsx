"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { getApiBaseUrl } from "@/lib/api-config";
import { formatDdMmYyyyDesdeIso } from "@/lib/fecha-calendario";
import { formatMoneyAr, formatPesosAr } from "@/lib/money";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MovimientoCC = {
  id: number;
  fecha: string | null;
  concepto: string;
  tipo: string;
  monto: number;
  saldo_post: number;
  referencia_orden: number | null;
};

type ItemPresupuestoRow = {
  id: number;
  producto_id: number;
  producto_descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

type PresupuestoRow = {
  id: number;
  numero: string;
  cliente_id?: number | null;
  estado: string;
  total: number;
  fecha_creacion?: string | null;
  fecha_evento?: string;
  items?: ItemPresupuestoRow[];
};

/** Respuesta de GET /presupuestos/:id (campos flexibles por serialización). */
type PresupuestoDetalle = Record<string, unknown>;

type OrdenRow = {
  id: number;
  presupuesto_numero: string;
  cliente_id?: number | null;
  estado: string;
  saldo_pendiente: number;
  fecha_creacion?: string;
  fecha_evento?: string;
  contrato_generado_at?: string | null;
};

type ClienteDetalle = {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  direccion: string;
  celular: string;
  notas?: string;
  fecha_nacimiento?: string | null;
};

function esCreditoHistoricoErroneo(concepto: string): boolean {
  return /seña inicial|pago adicional para orden/i.test(concepto || "");
}

function clasificarMovimientoCC(m: MovimientoCC): {
  etiqueta: string;
  badgeClass: string;
  signo: "+" | "−";
  montoClass: string;
} {
  if (m.tipo === "debito") {
    return {
      etiqueta: "Uso de saldo",
      badgeClass: "bg-warning text-dark",
      signo: "−",
      montoClass: "text-danger",
    };
  }
  if (esCreditoHistoricoErroneo(m.concepto)) {
    return {
      etiqueta: "Registro antiguo",
      badgeClass: "bg-secondary",
      signo: "+",
      montoClass: "text-muted",
    };
  }
  return {
    etiqueta: "Carga de saldo",
    badgeClass: "bg-success",
    signo: "+",
    montoClass: "text-success",
  };
}

function formatearMontoCC(n: number): string {
  return formatMoneyAr(Math.abs(n) || 0);
}

export default function ClientePerfilPage() {
  const params = useParams();
  const idRaw = params?.id;
  const idParam = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  const clienteId =
    typeof idParam === "string"
      ? parseInt(idParam, 10)
      : typeof idParam === "number"
        ? idParam
        : NaN;

  const API_BASE = getApiBaseUrl();
  /** Cancela la carga anterior al cambiar de cliente o al desmontar (evita saldo/movs de otro perfil). */
  const loadAbortRef = useRef<AbortController | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [saldoActual, setSaldoActual] = useState(0);
  const [movimientos, setMovimientos] = useState<MovimientoCC[]>([]);
  const [tab, setTab] = useState<"cc" | "historial">("cc");
  const [presupuestos, setPresupuestos] = useState<PresupuestoRow[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenRow[]>([]);
  const [modalPresupuestoOpen, setModalPresupuestoOpen] = useState(false);
  const [modalPresupuestoCargando, setModalPresupuestoCargando] = useState(false);
  const [modalPresupuestoData, setModalPresupuestoData] = useState<PresupuestoDetalle | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  useEffect(() => {
    if (Number.isNaN(clienteId)) return;
    setSaldoActual(0);
    setMovimientos([]);
  }, [clienteId]);

  const cargar = useCallback(async () => {
    if (!token || Number.isNaN(clienteId)) return;
    const targetId = clienteId;

    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    const { signal } = ac;

    setCargando(true);
    try {
      const [rCliente, rSaldo, rMovs, rPres, rOrd] = await Promise.all([
        fetch(`${API_BASE}/clientes/get_by_id/${targetId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal,
        }),
        fetch(`${API_BASE}/pagos/saldo/${targetId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal,
        }),
        fetch(`${API_BASE}/pagos/movimientos/${targetId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal,
        }),
        fetch(`${API_BASE}/presupuestos/`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal,
        }),
        fetch(`${API_BASE}/ordenes/`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal,
        }),
      ]);

      if (signal.aborted) return;

      if (rCliente.ok) {
        const c = await rCliente.json();
        if (Number(c?.id) === targetId) {
          setCliente(c);
        } else {
          console.warn("[perfil] Respuesta de cliente con id distinto a la URL", c?.id, targetId);
          setCliente(null);
        }
      } else {
        setCliente(null);
      }

      if (rSaldo.ok) {
        const s = await rSaldo.json();
        const raw = s.saldo_actual;
        const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0"));
        setSaldoActual(Number.isFinite(n) ? Math.round(n) : 0);
        const sid = s.cliente_id != null ? Number(s.cliente_id) : null;
        if (sid != null && sid !== targetId) {
          console.warn("[perfil] saldo: cliente_id en JSON no coincide con la URL (se muestra igual el saldo de esta URL)", sid, targetId);
        }
      } else {
        setSaldoActual(0);
      }

      if (rMovs.ok) {
        setMovimientos(await rMovs.json());
      } else {
        setMovimientos([]);
      }

      if (rPres.ok) {
        const lista = await rPres.json();
        setPresupuestos(
          Array.isArray(lista)
            ? lista.filter((p: PresupuestoRow) => Number(p.cliente_id) === targetId)
            : []
        );
      } else setPresupuestos([]);

      if (rOrd.ok) {
        const listaO = await rOrd.json();
        setOrdenes(
          Array.isArray(listaO)
            ? listaO.filter((o: OrdenRow) => Number(o.cliente_id) === targetId)
            : []
        );
      } else setOrdenes([]);
    } catch {
      if (signal.aborted) return;
      setCliente(null);
      setSaldoActual(0);
      setMovimientos([]);
      setPresupuestos([]);
      setOrdenes([]);
    } finally {
      if (!signal.aborted) {
        setCargando(false);
      }
    }
  }, [API_BASE, token, clienteId]);

  useEffect(() => {
    return () => {
      loadAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const contratosCliente = useMemo(
    () => ordenes.filter((o) => !!o.contrato_generado_at),
    [ordenes]
  );

  const movimientosOrdenados = useMemo(
    () =>
      [...movimientos].sort((a, b) => {
        const ta = a.fecha ? new Date(a.fecha).getTime() : 0;
        const tb = b.fecha ? new Date(b.fecha).getTime() : 0;
        return tb - ta;
      }),
    [movimientos]
  );

  const resumenCC = useMemo(() => {
    let totalCargas = 0;
    let totalUsos = 0;
    for (const m of movimientos) {
      const monto = Number(m.monto) || 0;
      if (m.tipo === "debito") {
        totalUsos += monto;
      } else if (
        m.tipo === "credito" &&
        !esCreditoHistoricoErroneo(m.concepto)
      ) {
        totalCargas += monto;
      }
    }
    return { totalCargas, totalUsos };
  }, [movimientos]);

  const filasProductosCliente = useMemo(() => {
    const rows: Array<{
      key: string;
      presupuestoId: number;
      numero: string;
      estado: string;
      itemId: number;
      descripcion: string;
      precioUnitario: number;
      subtotal: number;
    }> = [];
    for (const p of presupuestos) {
      const items = Array.isArray(p.items) ? p.items : [];
      for (const it of items) {
        rows.push({
          key: `${p.id}-${it.id}`,
          presupuestoId: p.id,
          numero: p.numero,
          estado: p.estado,
          itemId: it.id,
          descripcion: it.producto_descripcion || "—",
          precioUnitario: it.precio_unitario,
          subtotal: it.subtotal,
        });
      }
    }
    rows.sort((a, b) => b.presupuestoId - a.presupuestoId);
    return rows;
  }, [presupuestos]);

  const abrirDetallePresupuesto = useCallback(
    async (presupuestoId: number) => {
      if (!token) return;
      setModalPresupuestoOpen(true);
      setModalPresupuestoCargando(true);
      setModalPresupuestoData(null);
      try {
        const r = await fetch(`${API_BASE}/presupuestos/${presupuestoId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (r.ok) {
          setModalPresupuestoData((await r.json()) as PresupuestoDetalle);
        } else {
          setModalPresupuestoData(null);
        }
      } catch {
        setModalPresupuestoData(null);
      } finally {
        setModalPresupuestoCargando(false);
      }
    },
    [API_BASE, token]
  );

  const cerrarModalPresupuesto = useCallback(() => {
    setModalPresupuestoOpen(false);
    setModalPresupuestoData(null);
  }, []);

  if (Number.isNaN(clienteId)) {
    return (
      <div className="container-fluid px-4 py-4">
        <p className="text-danger">ID de cliente inválido.</p>
        <Link href="/clientes" className="btn btn-outline-secondary btn-sm">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="container-fluid px-4 py-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <Link href="/clientes" className="btn btn-link btn-sm text-muted px-0 mb-1">
            ← Clientes
          </Link>
          <h1 className="fw-bold mb-0">
            {cliente ? (
              <>
                {cliente.apellido}, {cliente.nombre}
              </>
            ) : (
              "Cliente"
            )}
          </h1>
          {cliente && (
            <p className="text-muted small mb-0">
              DNI {cliente.dni} · {cliente.celular}
              {cliente.fecha_nacimiento
                ? ` · Nac. ${formatDdMmYyyyDesdeIso(cliente.fecha_nacimiento)}`
                : ""}
            </p>
          )}
        </div>
        <div className="text-end">
          <div className="small text-muted">Saldo a favor</div>
          <div className={`fs-4 fw-bold ${saldoActual > 0 ? "text-success" : "text-muted"}`}>
            $
            {formatPesosAr(saldoActual)}
          </div>
        </div>
      </div>

      {cliente?.notas?.trim() && (
        <div className="alert alert-warning d-flex align-items-start gap-2 mb-3" role="alert">
          <i className="bi bi-exclamation-triangle-fill mt-1" aria-hidden />
          <div>
            <div className="fw-bold">Observación interna del cliente</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{cliente.notas.trim()}</div>
          </div>
        </div>
      )}

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tab === "cc" ? "active" : ""}`}
            onClick={() => setTab("cc")}
          >
            Movimientos de cuenta
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tab === "historial" ? "active" : ""}`}
            onClick={() => setTab("historial")}
          >
            Alquileres
          </button>
        </li>
      </ul>

      {cargando ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando…</span>
          </div>
        </div>
      ) : !cliente ? (
        <div className="alert alert-warning">No se encontró el cliente.</div>
      ) : tab === "cc" ? (
        <div className="d-flex flex-column gap-3">
          <div className="row g-2">
            <div className="col-md-4">
              <div className="card shadow-sm border-success border-opacity-25 h-100">
                <div className="card-body py-3">
                  <div className="small text-muted">Saldo disponible</div>
                  <div className={`fs-5 fw-bold ${saldoActual > 0 ? "text-success" : "text-muted"}`}>
                    {formatearMontoCC(saldoActual)}
                  </div>
                  <div className="small text-muted mt-1">Para usar en señas u otros pagos</div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card shadow-sm h-100">
                <div className="card-body py-3">
                  <div className="small text-muted">Total cargado (histórico)</div>
                  <div className="fs-5 fw-bold text-success">
                    +{formatearMontoCC(resumenCC.totalCargas)}
                  </div>
                  <div className="small text-muted mt-1">Créditos manuales y cargas válidas</div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card shadow-sm h-100">
                <div className="card-body py-3">
                  <div className="small text-muted">Total usado (histórico)</div>
                  <div className="fs-5 fw-bold text-danger">
                    −{formatearMontoCC(resumenCC.totalUsos)}
                  </div>
                  <div className="small text-muted mt-1">Señas o pagos con saldo a favor</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-header bg-light py-2">
              <p className="small text-muted mb-0">
                <strong>Carga de saldo</strong> aumenta el saldo a favor (Clientes → Agregar crédito) y, si el cliente abona dinero, también ingresa en caja diaria.
                <strong> Uso de saldo</strong> lo descuenta al pagar una seña u otro importe con cuenta corriente sin volver a impactar caja.
                Las señas en efectivo o transferencia <strong>no</strong> aparecen acá (van a caja).
              </p>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="text-end">Monto</TableHead>
                      <TableHead className="text-end">Saldo después</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientosOrdenados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted py-4">
                          No hay movimientos en cuenta corriente.
                        </TableCell>
                      </TableRow>
                    ) : (
                      movimientosOrdenados.map((m) => {
                        const c = clasificarMovimientoCC(m);
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-nowrap small">
                              {m.fecha
                                ? format(parseISO(m.fecha), "dd/MM/yyyy HH:mm", {
                                    locale: es,
                                  })
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <span className={`badge ${c.badgeClass}`}>{c.etiqueta}</span>
                            </TableCell>
                            <TableCell>
                              <div>{m.concepto}</div>
                              {m.referencia_orden ? (
                                <Link
                                  href={`/ordenes?ver=${m.referencia_orden}`}
                                  className="small text-primary"
                                >
                                  Orden #{m.referencia_orden}
                                </Link>
                              ) : null}
                              {c.etiqueta === "Registro antiguo" && (
                                <div className="small text-muted">
                                  No suma al saldo; registro previo a la corrección del sistema.
                                </div>
                              )}
                            </TableCell>
                            <TableCell className={`text-end fw-semibold ${c.montoClass}`}>
                              {c.signo}
                              {formatearMontoCC(m.monto)}
                            </TableCell>
                            <TableCell className="text-end text-muted small">
                              {formatearMontoCC(m.saldo_post)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-4">
          <div className="row g-2">
            <div className="col-sm-4">
              <div className="card shadow-sm h-100">
                <div className="card-body py-3 text-center">
                  <div className="fs-4 fw-bold text-primary">{presupuestos.length}</div>
                  <div className="small text-muted">Presupuesto(s)</div>
                </div>
              </div>
            </div>
            <div className="col-sm-4">
              <div className="card shadow-sm h-100">
                <div className="card-body py-3 text-center">
                  <div className="fs-4 fw-bold text-primary">{ordenes.length}</div>
                  <div className="small text-muted">Orden(es) de trabajo</div>
                </div>
              </div>
            </div>
            <div className="col-sm-4">
              <div className="card shadow-sm h-100">
                <div className="card-body py-3 text-center">
                  <div className="fs-4 fw-bold text-primary">{contratosCliente.length}</div>
                  <div className="small text-muted">Contrato(s)</div>
                </div>
              </div>
            </div>
          </div>

          {ordenes.length > 0 && (
            <section>
              <h2 className="h6 fw-bold text-uppercase text-muted mb-2">Órdenes de trabajo</h2>
              <div className="table-responsive card shadow-sm">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Orden</th>
                      <th>Presupuesto</th>
                      <th>Estado</th>
                      <th className="text-end">Saldo pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link href={`/ordenes?ver=${o.id}`} className="text-primary fw-medium">
                            #{o.id}
                          </Link>
                        </td>
                        <td>{o.presupuesto_numero}</td>
                        <td>
                          <span className="badge bg-secondary">{o.estado}</span>
                        </td>
                        <td className="text-end">
                          {formatMoneyAr(o.saldo_pendiente)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section>
            <h2 className="h6 fw-bold text-uppercase text-muted mb-2">Prendas en presupuestos</h2>
            <p className="small text-muted mb-2">
              Cada fila es una prenda única. Tocá la fila para ver el presupuesto completo.
            </p>
            <div className="table-responsive card shadow-sm">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Prenda</th>
                    <th>Presupuesto</th>
                    <th>Estado</th>
                    <th className="text-end">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {filasProductosCliente.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        No hay prendas en presupuestos de este cliente.
                      </td>
                    </tr>
                  ) : (
                    filasProductosCliente.map((row) => (
                      <tr
                        key={row.key}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: "pointer" }}
                        onClick={() => void abrirDetallePresupuesto(row.presupuestoId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void abrirDetallePresupuesto(row.presupuestoId);
                          }
                        }}
                      >
                        <td className="fw-medium">{row.descripcion}</td>
                        <td className="text-nowrap">
                          <span className="text-primary text-decoration-underline">{row.numero}</span>
                        </td>
                        <td>
                          <span className="badge bg-secondary">{row.estado}</span>
                        </td>
                        <td className="text-end">
                          {formatMoneyAr(row.precioUnitario)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="d-flex flex-wrap gap-2">
            <Link href="/presupuestos" className="btn btn-sm btn-outline-secondary">
              Ir a presupuestos
            </Link>
            <Link href="/ordenes" className="btn btn-sm btn-outline-secondary">
              Ir a órdenes
            </Link>
          </section>
        </div>
      )}

      <Dialog
        open={modalPresupuestoOpen}
        onOpenChange={(o) => {
          if (!o) cerrarModalPresupuesto();
        }}
      >
        <DialogContent
          open={modalPresupuestoOpen}
          onOpenChange={(o) => {
            if (!o) cerrarModalPresupuesto();
          }}
          className="w-full border-0"
          dialogClassName="modal-dialog-scrollable modal-xl"
          dialogStyle={{ maxWidth: "960px", width: "95%" }}
        >
          <DialogHeader>
            <DialogTitle>Detalle del presupuesto</DialogTitle>
            <DialogDescription>
              {modalPresupuestoCargando
                ? "Cargando…"
                : modalPresupuestoData
                  ? `Presupuesto ${String(modalPresupuestoData.numero ?? "")}`
                  : "No se pudo cargar."}
            </DialogDescription>
          </DialogHeader>
          <div className="modal-body px-3 py-2" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {modalPresupuestoCargando ? (
              <div className="d-flex justify-content-center py-4">
                <div className="spinner-border text-primary" role="status" />
              </div>
            ) : modalPresupuestoData ? (
              <DetallePresupuestoBody data={modalPresupuestoData} />
            ) : (
              <p className="text-muted small mb-0">No hay datos para mostrar.</p>
            )}
          </div>
          <DialogFooter className="border-top">
            <button type="button" className="btn btn-light border" onClick={cerrarModalPresupuesto}>
              Cerrar
            </button>
            {modalPresupuestoData && typeof modalPresupuestoData.id === "number" ? (
              <Link
                href={`/presupuestos?editar=${modalPresupuestoData.id}`}
                className="btn btn-primary"
                onClick={() => cerrarModalPresupuesto()}
              >
                Abrir en Presupuestos
              </Link>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function strField(obj: PresupuestoDetalle, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "—";
}

function DetallePresupuestoBody({ data }: { data: PresupuestoDetalle }) {
  const itemsRaw = data.items;
  const items = Array.isArray(itemsRaw) ? itemsRaw : [];
  const fe = strField(data, "fecha_evento");
  const fechaEv =
    fe !== "—"
      ? (() => {
          try {
            return format(parseISO(`${fe}T12:00:00`), "dd/MM/yyyy", { locale: es });
          } catch {
            return fe;
          }
        })()
      : "—";

  return (
    <div className="small">
      <dl className="row mb-3">
        <dt className="col-sm-3 text-muted">Número</dt>
        <dd className="col-sm-9">{strField(data, "numero")}</dd>
        <dt className="col-sm-3 text-muted">Estado</dt>
        <dd className="col-sm-9">{strField(data, "estado")}</dd>
        <dt className="col-sm-3 text-muted">Cliente</dt>
        <dd className="col-sm-9">{strField(data, "cliente_nombre")}</dd>
        <dt className="col-sm-3 text-muted">Total</dt>
        <dd className="col-sm-9">
          $
          {formatPesosAr(Number(data.total) || 0)}
        </dd>
        <dt className="col-sm-3 text-muted">Fecha evento</dt>
        <dd className="col-sm-9">{fechaEv}</dd>
        <dt className="col-sm-3 text-muted">Categoría</dt>
        <dd className="col-sm-9">{strField(data, "categoria_evento")}</dd>
        <dt className="col-sm-3 text-muted">Agasajado</dt>
        <dd className="col-sm-9">{strField(data, "nombre_agasajado")}</dd>
        <dt className="col-sm-3 text-muted">Lugar</dt>
        <dd className="col-sm-9">{strField(data, "lugar_evento")}</dd>
        <dt className="col-sm-3 text-muted">Observaciones</dt>
        <dd className="col-sm-9">{strField(data, "observaciones")}</dd>
      </dl>
      <h3 className="h6 fw-bold border-bottom pb-2 mb-2">Ítems</h3>
      <div className="table-responsive">
        <table className="table table-sm table-bordered mb-0">
          <thead className="table-light">
            <tr>
              <th>Prenda</th>
              <th className="text-end">Precio</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center text-muted">
                  Sin ítems
                </td>
              </tr>
            ) : (
              items.map((it: unknown, idx: number) => {
                const row = it as Record<string, unknown>;
                const desc = String(row.producto_descripcion ?? row.descripcion ?? "—");
                const sub = Number(row.subtotal ?? row.precio_unitario ?? 0);
                return (
                  <tr key={String(row.id ?? idx)}>
                    <td>{desc}</td>
                    <td className="text-end">
                      {formatMoneyAr(sub)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
