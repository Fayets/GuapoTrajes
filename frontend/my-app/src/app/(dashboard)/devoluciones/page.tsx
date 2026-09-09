"use client";

import type React from "react";
import { useState, useEffect, useMemo } from "react";
import ReactPaginate from "react-paginate";
import { FileText, CheckCircle2, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getApiBaseUrl } from "@/lib/api-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import { abrirImpresionContratoDesdeOrden } from "@/lib/generar-html-contrato";

// Tipos
type ProductoReservado = {
  producto_id: number;
  producto_descripcion: string;
  codigo_barra?: string;
  linea?: string;
  talle?: string;
  tela?: string;
  color?: string;
  descripcion_extra?: string;
  estado: string;
  fecha_bloqueo: string;
  observaciones?: string;
};

function normalizarParaBusqueda(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function ordenCoincideBusquedaDevoluciones(
  orden: OrdenTrabajo,
  terminoRaw: string
): boolean {
  const termino = normalizarParaBusqueda(terminoRaw.replace(/\s+/g, " "));
  if (!termino) return true;

  const dniSinEspacios = normalizarParaBusqueda(
    (orden.cliente_dni ?? "").toString().replace(/\s/g, "")
  );
  const terminoSinEspacios = termino.replace(/\s/g, "");

  const firmanteDniSinEspacios = normalizarParaBusqueda(
    (orden.firmante_dni ?? "").toString().replace(/\s/g, "")
  );

  const camposOrden = [
    orden.cliente_nombre,
    orden.cliente_dni,
    dniSinEspacios,
    orden.cliente_direccion,
    orden.cliente_celular,
    orden.firmante_nombre,
    orden.firmante_dni,
    firmanteDniSinEspacios,
    orden.presupuesto_numero,
    String(orden.id ?? ""),
    String(orden.presupuesto_id ?? ""),
  ];

  const camposPrendas = (orden.productos_reservados ?? []).flatMap((p) => [
    p.producto_descripcion,
    p.codigo_barra,
    p.linea,
    p.talle,
    p.tela,
    p.color,
    p.descripcion_extra,
    p.observaciones,
    String(p.producto_id ?? ""),
  ]);

  const haystack = normalizarParaBusqueda(
    [...camposOrden, ...camposPrendas].filter(Boolean).join(" ")
  );
  const haystackSinEspacios = haystack.replace(/\s/g, "");

  if (haystack.includes(termino)) return true;
  if (
    terminoSinEspacios.length > 0 &&
    haystackSinEspacios.includes(terminoSinEspacios)
  ) {
    return true;
  }

  const palabras = termino.split(/\s+/).filter(Boolean);
  if (palabras.length > 1) {
    return palabras.every(
      (palabra) =>
        haystack.includes(palabra) ||
        haystackSinEspacios.includes(palabra.replace(/\s/g, ""))
    );
  }

  return false;
}

type AsignacionDevolucionCompleta = {
  incluido: boolean;
  destino: "SALON" | "LAVANDERIA" | "MODISTA";
  lavanderiaId: number | null;
  modistaId: number | null;
};

type RevisionAbierta = {
  id: number;
  producto_id: number;
  producto_descripcion: string;
  motivo: string;
  destino: string;
  creada_at?: string | null;
};

type OrdenTrabajo = {
  id: number;
  presupuesto_id?: number;
  presupuesto_numero: string;
  cliente_nombre: string;
  cliente_dni?: string;
  cliente_direccion?: string;
  cliente_celular?: string;
  fecha_evento: string;
  fecha_creacion: string;
  fecha_retiro?: string | null;
  fecha_devolucion?: string | null;
  seña_pagada: number;
  saldo_pendiente: number;
  estado: string;
  payment_method?: string | null;
  metodo_pago?: string | null;
  productos_reservados: ProductoReservado[];
  total?: number;
  total_presupuesto?: number;
  contrato_generado_at?: string | null;
  devolucion_recibida_por_nombre?: string | null;
  devolucion_recibida_at?: string | null;
  revisiones_abiertas?: RevisionAbierta[];
  tiene_revisiones_abiertas?: boolean;
  firmante_nombre?: string | null;
  firmante_dni?: string | null;
  firmante_direccion?: string | null;
  firmante_celular?: string | null;
  tiene_firmante_anexo?: boolean;
};

export default function DevolucionesPage() {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [ordenesAbiertas, setOrdenesAbiertas] = useState<OrdenTrabajo[]>([]);
  const [ordenSeleccionada, setOrdenSeleccionada] =
    useState<OrdenTrabajo | null>(null);
  const [showContratoModal, setShowContratoModal] = useState(false);
  const [showCompletadaModal, setShowCompletadaModal] = useState(false);
  const [showParcialModal, setShowParcialModal] = useState(false);
  const [prendasSeleccionadas, setPrendasSeleccionadas] = useState<number[]>(
    []
  );
  const [descripcionParcial, setDescripcionParcial] = useState("");
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [destinoEstado, setDestinoEstado] = useState<"SALON" | "LAVANDERIA" | "MODISTA">("SALON");
  const [lavanderiaId, setLavanderiaId] = useState<number | null>(null);
  const [modistaId, setModistaId] = useState<number | null>(null);
  const [lavanderias, setLavanderias] = useState<Array<{ id: number; nombre: string }>>([]);
  const [modistas, setModistas] = useState<Array<{ id: number; nombre: string }>>([]);
  const [asignacionesCompletada, setAsignacionesCompletada] = useState<
    Record<number, AsignacionDevolucionCompleta>
  >({});

  const { token, me } = useAuth();

  useEffect(() => {
    fetchOrdenes();
  }, []);

  useEffect(() => {
    const fetchLavanderias = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/lavanderia/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLavanderias(Array.isArray(data) ? data.map((l: any) => ({ id: l.id, nombre: l.nombre || String(l.id) })) : []);
        }
      } catch {
        setLavanderias([]);
      }
    };
    const fetchModistas = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/modistas/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setModistas(Array.isArray(data) ? data.map((m: any) => ({ id: m.id, nombre: m.nombre || String(m.id) })) : []);
        }
      } catch {
        setModistas([]);
      }
    };
    if (token) {
      fetchLavanderias();
      fetchModistas();
    }
  }, [token]);

  useEffect(() => {
    filtrarOrdenesAbiertas();
  }, [ordenes]);

  const fetchOrdenes = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/ordenes/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Error al obtener órdenes");

      const data = await res.json();
      const normalizado = Array.isArray(data)
        ? data.map((orden: any) => ({
            ...orden,
            payment_method:
              orden.payment_method ??
              orden.metodo_pago ??
              orden.paymentMethod ??
              orden.metodoPago ??
              null,
          }))
        : [];
      setOrdenes(normalizado);
    } catch (error) {
      console.error("Error al cargar órdenes:", error);
      toast.error("Error al cargar órdenes");
    } finally {
      setCargando(false);
    }
  };

  const filtrarOrdenesAbiertas = () => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const abiertas = ordenes.filter((orden) => {
      // Solo órdenes con contrato generado (devoluciones son sobre contratos)
      if (!orden.contrato_generado_at) {
        return false;
      }

      // Excluir órdenes canceladas o completadas
      if (
        orden.estado?.toLowerCase() === "cancelada" ||
        orden.estado?.toLowerCase() === "completada"
      ) {
        return false;
      }

      const tieneRevisiones =
        orden.tiene_revisiones_abiertas ||
        (orden.revisiones_abiertas && orden.revisiones_abiertas.length > 0);

      // Órdenes solo con revisión (sin prendas en cliente) siguen visibles
      if (tieneRevisiones) {
        return true;
      }

      // Verificar que tenga productos reservados (aún no devolvió)
      if (!orden.productos_reservados || orden.productos_reservados.length === 0) {
        return false;
      }

      // Si no tiene fecha_devolucion, no es una orden abierta para devolución
      if (!orden.fecha_devolucion) {
        return false;
      }

      const fechaDevolucion = new Date(orden.fecha_devolucion + "T00:00:00");
      fechaDevolucion.setHours(0, 0, 0, 0);

      // Incluir órdenes donde la fecha_devolucion ya pasó (no devolvieron)
      // O si hoy está en el período de devolución (entre fecha_bloqueo y fecha_devolucion)
      
      // Si la fecha_devolucion ya pasó, la orden está abierta (no devolvió)
      if (fechaDevolucion < hoy) {
        return true;
      }

      // Si aún no pasó la fecha_devolucion, verificar si hoy está en el período de devolución
      const tieneProductosBloqueados = orden.productos_reservados.some(
        (prod) => {
          if (!prod.fecha_bloqueo) return false;
          const fechaBloqueo = new Date(prod.fecha_bloqueo + "T00:00:00");
          fechaBloqueo.setHours(0, 0, 0, 0);
          // La orden está abierta si hoy está entre fecha_bloqueo y fecha_devolucion
          return fechaBloqueo <= hoy && hoy <= fechaDevolucion;
        }
      );

      // Si no tiene productos con fecha_bloqueo, usar fecha_evento - 5 días como fecha_bloqueo
      if (!tieneProductosBloqueados && orden.fecha_evento) {
        const fechaEvento = new Date(orden.fecha_evento + "T00:00:00");
        fechaEvento.setHours(0, 0, 0, 0);
        const fechaBloqueoEstimada = new Date(fechaEvento);
        fechaBloqueoEstimada.setDate(fechaBloqueoEstimada.getDate() - 5);
        fechaBloqueoEstimada.setHours(0, 0, 0, 0);

        return fechaBloqueoEstimada <= hoy && hoy <= fechaDevolucion;
      }

      return tieneProductosBloqueados;
    });

    setOrdenesAbiertas(abiertas);
  };

  const [paginaActual, setPaginaActual] = useState(0);
  const ORDENES_POR_PAGINA = 18;

  useEffect(() => {
    setPaginaActual(0);
  }, [filtroBusqueda]);

  const ordenesAbiertasFiltradas = useMemo(() => {
    if (!filtroBusqueda.trim()) {
      return ordenesAbiertas;
    }
    return ordenesAbiertas.filter((orden) =>
      ordenCoincideBusquedaDevoluciones(orden, filtroBusqueda)
    );
  }, [ordenesAbiertas, filtroBusqueda]);

  const pageCount = Math.ceil(ordenesAbiertasFiltradas.length / ORDENES_POR_PAGINA);
  const offsetPagina =
    Math.min(paginaActual, Math.max(0, pageCount - 1)) * ORDENES_POR_PAGINA;
  const ordenesAbiertasEnPagina = ordenesAbiertasFiltradas.slice(
    offsetPagina,
    offsetPagina + ORDENES_POR_PAGINA
  );

  const generarContrato = async (orden: OrdenTrabajo) => {
    const esAdmin =
      me?.role === "ADMIN" ||
      me?.role === "SUPER_ADMIN";
    const saldoPendiente = Number(orden.saldo_pendiente ?? 0);
    if (!orden || (saldoPendiente > 0 && !esAdmin)) {
      toast.error("Solo se pueden generar contratos de órdenes con saldo pendiente cero");
      return;
    }
    const avisoAdmin =
      saldoPendiente > 0 && esAdmin
        ? `\n\nATENCIÓN: esta orden tiene saldo pendiente de $${saldoPendiente.toLocaleString("es-AR")}. Solo podés generar el contrato porque sos administrador.`
        : "";
    if (
      !window.confirm(
        `¿Abrir el contrato de la orden #${orden.id} (${orden.cliente_nombre}) para imprimir?${avisoAdmin}`
      )
    ) {
      return;
    }

    try {
      const ok = abrirImpresionContratoDesdeOrden(orden);
      if (!ok) {
        toast.error("Por favor, permite ventanas emergentes para generar el contrato");
      }
    } catch (error) {
      console.error("Error al generar contrato:", error);
      toast.error("Error al generar el contrato. Por favor, intenta nuevamente.");
    }
  };

  const handleCompletada = async () => {
    if (!ordenSeleccionada) return;
    const filas = ordenSeleccionada.productos_reservados || [];
    const tieneRevisiones =
      ordenSeleccionada.tiene_revisiones_abiertas ||
      (ordenSeleccionada.revisiones_abiertas?.length ?? 0) > 0;

    // Sin prendas en cliente: finalizar contrato (solo si no hay revisiones)
    if (filas.length === 0) {
      if (tieneRevisiones) {
        toast.error(
          "Hay prendas en revisión. Resolvé la revisión antes de cerrar el contrato. No romper el pagaré."
        );
        return;
      }
      setProcesando(true);
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/ordenes/${ordenSeleccionada.id}/completar-devolucion`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ destino: "SALON" }),
          }
        );
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(
            typeof error.detail === "string"
              ? error.detail
              : error.message || "Error al finalizar devolución"
          );
        }
        const result = await res.json();
        if (result.success) {
          toast.success(result.message || "Devolución finalizada");
          setShowCompletadaModal(false);
          setOrdenSeleccionada(null);
          fetchOrdenes();
        } else {
          throw new Error(result.message || "Error al finalizar devolución");
        }
      } catch (error: any) {
        toast.error(error.message || "Error al finalizar devolución");
      } finally {
        setProcesando(false);
      }
      return;
    }

    const incluidos = filas.filter((p) => asignacionesCompletada[p.producto_id]?.incluido);
    if (incluidos.length === 0) {
      toast.error("Marcá al menos un producto (casillero a la izquierda), o cancelá.");
      return;
    }
    for (const pr of incluidos) {
      const a = asignacionesCompletada[pr.producto_id];
      if (!a) continue;
      if (a.destino === "LAVANDERIA" && !a.lavanderiaId) {
        toast.error(`Seleccioná lavandería para: ${pr.producto_descripcion}`);
        return;
      }
      if (a.destino === "MODISTA" && !a.modistaId) {
        toast.error(`Seleccioná modista para: ${pr.producto_descripcion}`);
        return;
      }
    }

    type EnvioPayload = {
      productos_ids: number[];
      destino: "SALON" | "LAVANDERIA" | "MODISTA";
      lavanderia_id: number | null;
      modista_id: number | null;
    };
    const envios: EnvioPayload[] = [];
    const seen = new Map<string, EnvioPayload>();
    for (const pr of incluidos) {
      const a = asignacionesCompletada[pr.producto_id]!;
      const key = `${a.destino}|${a.lavanderiaId ?? ""}|${a.modistaId ?? ""}`;
      let row = seen.get(key);
      if (!row) {
        row = {
          productos_ids: [],
          destino: a.destino,
          lavanderia_id: a.lavanderiaId,
          modista_id: a.modistaId,
        };
        seen.set(key, row);
        envios.push(row);
      }
      row.productos_ids.push(pr.producto_id);
    }

    setProcesando(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/ordenes/${ordenSeleccionada.id}/completar-devolucion`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ envios }),
        }
      );

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          typeof error.detail === "string"
            ? error.detail
            : Array.isArray(error.detail)
              ? error.detail.map((x: any) => x.msg || x).join(", ")
              : error.message || "Error al completar devolución"
        );
      }

      const result = await res.json();
      if (result.success) {
        const quien = result.data?.devolucion_recibida_por_nombre;
        if (result.data?.bloqueo_por_revision) {
          toast.warning(
            result.message ||
              "Devolución registrada, pero hay revisión pendiente. No romper el pagaré."
          );
        } else {
          toast.success(
            quien
              ? `${result.message || "Devolución registrada"} (recibido por ${quien})`
              : result.message || "Devolución registrada"
          );
        }
        setShowCompletadaModal(false);
        setOrdenSeleccionada(null);
        setAsignacionesCompletada({});
        setDestinoEstado("SALON");
        setLavanderiaId(null);
        setModistaId(null);
        fetchOrdenes();
      } else {
        throw new Error(result.message || "Error al completar devolución");
      }
    } catch (error: any) {
      console.error("Error al completar devolución:", error);
      toast.error(error.message || "Error al completar devolución");
    } finally {
      setProcesando(false);
    }
  };

  const handleResolverRevision = async (revision: RevisionAbierta) => {
    if (!ordenSeleccionada) return;
    setProcesando(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/ordenes/${ordenSeleccionada.id}/resolver-revision`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ revision_id: revision.id }),
        }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          typeof error.detail === "string"
            ? error.detail
            : error.message || "Error al resolver revisión"
        );
      }
      const result = await res.json();
      toast.success(result.message || "Revisión resuelta");
      await fetchOrdenes();
      // Actualizar orden seleccionada con datos frescos
      const refreshed = await fetch(`${getApiBaseUrl()}/ordenes/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (refreshed.ok) {
        const data = await refreshed.json();
        const found = Array.isArray(data)
          ? data.find((o: any) => o.id === ordenSeleccionada.id)
          : null;
        if (found) {
          setOrdenSeleccionada({
            ...found,
            payment_method:
              found.payment_method ?? found.metodo_pago ?? null,
          });
        } else {
          setShowCompletadaModal(false);
          setShowParcialModal(false);
          setOrdenSeleccionada(null);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Error al resolver revisión");
    } finally {
      setProcesando(false);
    }
  };

  const handleParcial = async () => {
    if (!ordenSeleccionada || prendasSeleccionadas.length === 0) {
      toast.error("Debes seleccionar al menos una prenda");
      return;
    }

    if (!descripcionParcial.trim()) {
      toast.error("Debes describir el motivo de la devolución parcial");
      return;
    }
    if (destinoEstado === "LAVANDERIA" && !lavanderiaId) {
      toast.error("Seleccioná una lavandería");
      return;
    }
    if (destinoEstado === "MODISTA" && !modistaId) {
      toast.error("Seleccioná una modista");
      return;
    }

    setProcesando(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/ordenes/${ordenSeleccionada.id}/devolucion-parcial`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productos_ids: prendasSeleccionadas,
            descripcion: descripcionParcial,
            destino: destinoEstado,
            lavanderia_id: destinoEstado === "LAVANDERIA" ? lavanderiaId : null,
            modista_id: destinoEstado === "MODISTA" ? modistaId : null,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          error.detail || error.message || "Error al procesar devolución parcial"
        );
      }

      const result = await res.json();
      if (result.success) {
        toast.success("Devolución parcial registrada correctamente");
        setShowParcialModal(false);
        setOrdenSeleccionada(null);
        setPrendasSeleccionadas([]);
        setDescripcionParcial("");
        setDestinoEstado("SALON");
        setLavanderiaId(null);
        setModistaId(null);
        fetchOrdenes();
      } else {
        throw new Error(result.message || "Error al procesar devolución parcial");
      }
    } catch (error: any) {
      console.error("Error al procesar devolución parcial:", error);
      toast.error(error.message || "Error al procesar devolución parcial");
    } finally {
      setProcesando(false);
    }
  };

  const togglePrenda = (productoId: number) => {
    setPrendasSeleccionadas((prev) =>
      prev.includes(productoId)
        ? prev.filter((id) => id !== productoId)
        : [...prev, productoId]
    );
  };

  const abrirModalCompletada = (orden: OrdenTrabajo) => {
    const init: Record<number, AsignacionDevolucionCompleta> = {};
    const prendasPendientes = (orden.productos_reservados || []).filter(
      (p) => !(p as { es_historico?: boolean }).es_historico
    );
    prendasPendientes.forEach((p) => {
      init[p.producto_id] = {
        incluido: true,
        destino: "LAVANDERIA",
        lavanderiaId: null,
        modistaId: null,
      };
    });
    setAsignacionesCompletada(init);
    setOrdenSeleccionada({
      ...orden,
      productos_reservados: prendasPendientes,
    });
    setShowCompletadaModal(true);
  };

  const abrirModalParcial = (orden: OrdenTrabajo) => {
    const prendasPendientes = (orden.productos_reservados || []).filter(
      (p) => !(p as { es_historico?: boolean }).es_historico
    );
    setOrdenSeleccionada({
      ...orden,
      productos_reservados: prendasPendientes,
    });
    setPrendasSeleccionadas([]);
    setDescripcionParcial("");
    setShowParcialModal(true);
  };

  return (
    <div className="p-2 p-sm-3 p-md-4">
      <div className="mb-4">
        <h1 className="page-title">Devoluciones</h1>
      </div>

      {cargando ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
          Cargando órdenes...
        </div>
      ) : ordenesAbiertas.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-inbox display-1 d-block mb-3"></i>
          <h5 className="text-muted">No hay órdenes abiertas</h5>
          <p className="text-muted">
            No se encontraron órdenes en período de devolución
          </p>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="card-header">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">
                <i className="bi bi-clipboard-check me-2"></i>
                Órdenes Abiertas ({ordenesAbiertasFiltradas.length})
              </h5>
            </div>
          </div>
          <div className="card-body">
            {/* Buscador */}
            <div className="mb-3">
              <div className="input-group gt-search">
                <span className="input-group-text">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Buscar cliente, firmante, orden o prenda..."
                  value={filtroBusqueda}
                  onChange={(e) => setFiltroBusqueda(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                    }
                  }}
                />
              </div>
              <p className="text-muted small mb-0 mt-2">
                Podés buscar por cliente, por quien retiró (firmante), DNI, código de
                barra o descripción de la prenda.
              </p>
            </div>
            <div className="table-responsive">
              <table className="table gt-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Orden ID</th>
                    <th>Presupuesto</th>
                    <th>Cliente</th>
                    <th>Firmante</th>
                    <th>Fecha Evento</th>
                    <th>Fecha Devolución</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesAbiertasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        <i className="bi bi-search me-2"></i>
                        No se encontraron órdenes que coincidan con la búsqueda
                      </td>
                    </tr>
                  ) : (
                    ordenesAbiertasEnPagina.map((orden) => {
                    const fechaEventoFormateada = orden.fecha_evento
                      ? format(
                          new Date(orden.fecha_evento + "T00:00:00"),
                          "dd/MM/yyyy",
                          { locale: es }
                        )
                      : "N/A";
                    const fechaDevolucionFormateada = orden.fecha_devolucion
                      ? format(
                          new Date(orden.fecha_devolucion + "T00:00:00"),
                          "dd/MM/yyyy",
                          { locale: es }
                        )
                      : "N/A";
                    const firmanteVisible = (orden.firmante_nombre || "").trim();

                    return (
                      <tr key={orden.id}>
                        <td className="fw-semibold">{orden.id}</td>
                        <td className="text-uppercase">
                          {orden.presupuesto_numero}
                          {(orden.tiene_revisiones_abiertas ||
                            (orden.revisiones_abiertas?.length ?? 0) > 0) && (
                            <span className="badge bg-warning text-dark ms-2">
                              En revisión
                            </span>
                          )}
                        </td>
                        <td>{orden.cliente_nombre}</td>
                        <td>{firmanteVisible || "—"}</td>
                        <td>{fechaEventoFormateada}</td>
                        <td>{fechaDevolucionFormateada}</td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-2 flex-wrap">
                            <button
                              className="btn-action btn-action--wide btn-action--ver"
                              onClick={() => {
                                setOrdenSeleccionada(orden);
                                generarContrato(orden);
                              }}
                              title="Ver contrato"
                            >
                              <FileText size={16} strokeWidth={1.75} aria-hidden />
                              Contrato
                            </button>
                            {(orden.productos_reservados?.length ?? 0) > 0 ? (
                              <button
                                className="btn-action btn-action--wide btn-action--credito"
                                onClick={() => abrirModalCompletada(orden)}
                                title="Devolución normal (prendas OK)"
                              >
                                <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />
                                Normal (OK)
                              </button>
                            ) : (
                              <button
                                className="btn-action btn-action--wide btn-action--credito"
                                onClick={() => abrirModalCompletada(orden)}
                                title="Finalizar devolución / cerrar contrato"
                                disabled={
                                  orden.tiene_revisiones_abiertas ||
                                  (orden.revisiones_abiertas?.length ?? 0) > 0
                                }
                              >
                                <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />
                                Finalizar
                              </button>
                            )}
                            {(orden.productos_reservados?.length ?? 0) > 0 && (
                              <button
                                className="btn-action btn-action--wide btn-action--brass"
                                onClick={() => abrirModalParcial(orden)}
                                title="Devolución con revisión (detalle obligatorio)"
                              >
                                <ClipboardCheck size={16} strokeWidth={1.75} aria-hidden />
                                Con revisión
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="d-flex flex-column align-items-center gap-1 pt-3">
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
                  forcePage={Math.min(paginaActual, pageCount - 1)}
                />
                <span className="text-muted small text-center">
                  Mostrando {offsetPagina + 1}–
                  {Math.min(offsetPagina + ORDENES_POR_PAGINA, ordenesAbiertasFiltradas.length)} de{" "}
                  {ordenesAbiertasFiltradas.length} órdenes
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Confirmar Completada (varios envíos / remitos por lavandería u otro destino) */}
      <Dialog
        open={showCompletadaModal}
        onOpenChange={(open) => {
          setShowCompletadaModal(open);
          if (!open) {
            setOrdenSeleccionada(null);
            setAsignacionesCompletada({});
            setDestinoEstado("SALON");
            setLavanderiaId(null);
            setModistaId(null);
          }
        }}
      >
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-lg"
          dialogStyle={{ maxWidth: "880px", width: "98%" }}
        >
          <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
            <DialogTitle className="fw-semibold mb-0">
              {(ordenSeleccionada?.productos_reservados?.length ?? 0) === 0
                ? "Finalizar devolución"
                : "Devolución normal (OK)"}
            </DialogTitle>
          </DialogHeader>
          <div className="modal-body px-3 px-md-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {ordenSeleccionada && (
              <>
                <div className="mb-3 small">
                  <p className="mb-1">
                    <strong>Orden:</strong> #{ordenSeleccionada.id} ·{" "}
                    <strong>Presupuesto:</strong> {ordenSeleccionada.presupuesto_numero}
                  </p>
                  <p className="mb-0">
                    <strong>Cliente:</strong> {ordenSeleccionada.cliente_nombre}
                  </p>
                </div>
                {(ordenSeleccionada.revisiones_abiertas?.length ?? 0) > 0 && (
                  <div className="alert alert-warning py-2 small">
                    <strong>En revisión.</strong> No romper el pagaré hasta finalizar la
                    revisión.
                    <ul className="mb-2 mt-2 ps-3">
                      {ordenSeleccionada.revisiones_abiertas!.map((r) => (
                        <li key={r.id} className="mb-2">
                          <div>
                            <strong>{r.producto_descripcion}</strong> — {r.motivo}
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-dark mt-1"
                            disabled={procesando}
                            onClick={() => handleResolverRevision(r)}
                          >
                            Marcar revisión resuelta
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(ordenSeleccionada.productos_reservados?.length ?? 0) === 0 ? (
                  <p className="text-muted small mb-0">
                    {(ordenSeleccionada.revisiones_abiertas?.length ?? 0) > 0
                      ? "No quedan prendas en el cliente. Resolvé las revisiones para poder cerrar el contrato."
                      : "No quedan prendas ni revisiones. Podés finalizar la devolución y cerrar el contrato."}
                  </p>
                ) : (
                <div className="table-responsive border rounded">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th
                          className="text-center p-1"
                          style={{ width: "44px" }}
                          title="Desmarcá si no va en esta tanda (queda en la orden)"
                          aria-label="Incluir en esta tanda"
                        />
                        <th>Producto</th>
                        <th style={{ minWidth: "110px" }}>Destino</th>
                        <th style={{ minWidth: "130px" }}>Lavandería</th>
                        <th style={{ minWidth: "130px" }}>Modista</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ordenSeleccionada.productos_reservados || []).map((pr) => {
                        const a =
                          asignacionesCompletada[pr.producto_id] ?? {
                            incluido: true,
                            destino: "LAVANDERIA" as const,
                            lavanderiaId: null,
                            modistaId: null,
                          };
                        return (
                          <tr key={pr.producto_id}>
                            <td className="text-center">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={a.incluido}
                                onChange={(e) =>
                                  setAsignacionesCompletada((prev) => ({
                                    ...prev,
                                    [pr.producto_id]: {
                                      ...a,
                                      incluido: e.target.checked,
                                    },
                                  }))
                                }
                                aria-label={`A enviar en esta operación: ${pr.producto_descripcion}`}
                              />
                            </td>
                            <td>
                              <div className="small fw-semibold">{pr.producto_descripcion}</div>
                              {pr.codigo_barra ? (
                                <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                  {pr.codigo_barra}
                                </div>
                              ) : null}
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                disabled={!a.incluido}
                                value={a.destino}
                                onChange={(e) => {
                                  const destino = e.target.value as
                                    | "SALON"
                                    | "LAVANDERIA"
                                    | "MODISTA";
                                  setAsignacionesCompletada((prev) => ({
                                    ...prev,
                                    [pr.producto_id]: {
                                      ...a,
                                      destino,
                                      lavanderiaId: null,
                                      modistaId: null,
                                    },
                                  }));
                                }}
                              >
                                <option value="SALON">Salón</option>
                                <option value="LAVANDERIA">Lavandería</option>
                                <option value="MODISTA">Modista</option>
                              </select>
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                disabled={!a.incluido || a.destino !== "LAVANDERIA"}
                                value={a.lavanderiaId ?? ""}
                                onChange={(e) =>
                                  setAsignacionesCompletada((prev) => ({
                                    ...prev,
                                    [pr.producto_id]: {
                                      ...a,
                                      lavanderiaId: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                    },
                                  }))
                                }
                              >
                                <option value="">—</option>
                                {lavanderias.map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.nombre}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                disabled={!a.incluido || a.destino !== "MODISTA"}
                                value={a.modistaId ?? ""}
                                onChange={(e) =>
                                  setAsignacionesCompletada((prev) => ({
                                    ...prev,
                                    [pr.producto_id]: {
                                      ...a,
                                      modistaId: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                    },
                                  }))
                                }
                              >
                                <option value="">—</option>
                                {modistas.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.nombre}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="border-top pt-3 d-flex flex-wrap justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowCompletadaModal(false);
                setOrdenSeleccionada(null);
                setAsignacionesCompletada({});
                setDestinoEstado("SALON");
                setLavanderiaId(null);
                setModistaId(null);
              }}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleCompletada}
              disabled={
                procesando ||
                ((ordenSeleccionada?.productos_reservados?.length ?? 0) === 0 &&
                  (ordenSeleccionada?.revisiones_abiertas?.length ?? 0) > 0)
              }
            >
              {procesando ? (
                <>
                  <i className="bi bi-arrow-clockwise spin me-2"></i>
                  Procesando...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  {(ordenSeleccionada?.productos_reservados?.length ?? 0) === 0
                    ? "Finalizar contrato"
                    : "Confirmar"}
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Devolución Parcial */}
      <Dialog open={showParcialModal} onOpenChange={setShowParcialModal}>
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-lg"
          dialogStyle={{ maxWidth: "700px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
            <DialogTitle className="fw-semibold">Devolución con revisión</DialogTitle>
            <DialogDescription className="mb-0">
              Prendas con detalle (mancha, daño, etc.). Quedan en revisión: no se cierra el
              contrato ni se debe romper el pagaré hasta resolverlas.
            </DialogDescription>
          </DialogHeader>
          <div className="modal-body px-3 px-md-4">
            {ordenSeleccionada && (
              <div className="mb-4">
                <p>
                  <strong>Orden:</strong> #{ordenSeleccionada.id} -{" "}
                  {ordenSeleccionada.presupuesto_numero}
                </p>
                <p>
                  <strong>Cliente:</strong> {ordenSeleccionada.cliente_nombre}
                </p>
                <div className="mt-3">
                  <label className="form-label fw-semibold">
                    Seleccionar prendas:
                  </label>
                  <div className="border rounded p-3" style={{ maxHeight: "300px", overflowY: "auto" }}>
                    {ordenSeleccionada.productos_reservados.map((producto) => (
                      <div key={producto.producto_id} className="form-check mb-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={prendasSeleccionadas.includes(
                            producto.producto_id
                          )}
                          onChange={() => togglePrenda(producto.producto_id)}
                          id={`prenda-${producto.producto_id}`}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`prenda-${producto.producto_id}`}
                        >
                          {producto.producto_descripcion}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <label className="form-label fw-semibold">
                    Descripción del motivo (detalle de la revisión):
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={descripcionParcial}
                    onChange={(e) => setDescripcionParcial(e.target.value)}
                    placeholder="Ej: La camisa tiene una mancha que requiere revisión y posible lavado..."
                  />
                  <p className="small text-muted mt-2 mb-0">
                    No romper el pagaré hasta finalizar esta revisión.
                  </p>
                </div>
                <div className="mt-3">
                  <label className="form-label fw-semibold">Destino de las prendas devueltas</label>
                  <select
                    className="form-select"
                    value={destinoEstado}
                    onChange={(e) => {
                      setDestinoEstado(e.target.value as "SALON" | "LAVANDERIA" | "MODISTA");
                      setLavanderiaId(null);
                      setModistaId(null);
                    }}
                  >
                    <option value="SALON">Salón</option>
                    <option value="LAVANDERIA">Lavandería</option>
                    <option value="MODISTA">Modista</option>
                  </select>
                </div>
                {destinoEstado === "LAVANDERIA" && (
                  <div className="mt-3">
                    <label className="form-label fw-semibold">Lavandería</label>
                    <select
                      className="form-select"
                      value={lavanderiaId ?? ""}
                      onChange={(e) => setLavanderiaId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Seleccionar lavandería...</option>
                      {lavanderias.map((l) => (
                        <option key={l.id} value={l.id}>{l.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
                {destinoEstado === "MODISTA" && (
                  <div className="mt-3">
                    <label className="form-label fw-semibold">Modista</label>
                    <select
                      className="form-select"
                      value={modistaId ?? ""}
                      onChange={(e) => setModistaId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Seleccionar modista...</option>
                      {modistas.map((m) => (
                        <option key={m.id} value={m.id}>{m.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowParcialModal(false);
                setOrdenSeleccionada(null);
                setPrendasSeleccionadas([]);
                setDescripcionParcial("");
                setDestinoEstado("SALON");
                setLavanderiaId(null);
                setModistaId(null);
              }}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button
              className="btn btn-warning"
              onClick={handleParcial}
              disabled={procesando || prendasSeleccionadas.length === 0}
            >
              {procesando ? (
                <>
                  <i className="bi bi-arrow-clockwise spin me-2"></i>
                  Procesando...
                </>
              ) : (
                <>
                  <i className="bi bi-clipboard-check me-2"></i>
                  Registrar Devolución Parcial
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

