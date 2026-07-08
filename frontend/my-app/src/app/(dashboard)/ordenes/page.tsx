"use client";

import type React from "react";
import { useState, useEffect, useRef, Suspense } from "react";
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
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { RoleGate } from "@/components/RoleGate";
import {
  MetodoPagoSelector,
  METODO_PAGO_CUENTA_CORRIENTE_ID,
  type MetodoPagoComplemento,
} from "@/components/metodo-pago-selector";
import { ConfirmarGenerarContratoModal } from "@/components/modales/confirmar-generar-contrato-modal";
import { imprimirEtiquetas100x50Lote } from "@/lib/imprimir-etiqueta-100x50";

// Tipos

type ProductoReservado = {
  producto_reservado_id?: number;
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
  requiere_modista?: boolean;
  notas_modista?: string;
  es_historico?: boolean;
};

function productoOrdenEsHistorico(
  prod: ProductoReservado,
  ordenEstado?: string
): boolean {
  if (prod.es_historico) return true;
  const est = (prod.estado || "").toLowerCase();
  if (est === "devuelto" || est === "cancelada") return true;
  return (ordenEstado || "").toLowerCase() === "completada";
}

type OrdenTrabajo = {
  id: number;
  presupuesto_id: number;
  presupuesto_numero: string;
  cliente_nombre: string;
  cliente_dni?: string | null;
  cliente_direccion?: string | null;
  cliente_celular?: string | null;
  es_precliente?: boolean;
  fecha_evento: string;
  fecha_creacion: string;
  seña_pagada: number;
  saldo_pendiente: number;
  estado: string;
  payment_method?: string | null;
  metodo_pago?: string | null;
  productos_reservados: ProductoReservado[];
  // Campos de descuento extra
  extra_discount_percentage?: number | null;
  extra_discount_amount?: number | null;
  extra_discount_reason?: string | null;
  extra_discount_applied_by_id?: number | null;
  extra_discount_applied_by_nombre?: string | null;
  extra_discount_created_at?: string | null;
  // Totales
  total?: number;
  total_presupuesto?: number;
  contrato_generado_at?: string | null;
  etiquetas_armado_impresas_at?: string | null;
  precliente_id?: number | null;
  cliente_id?: number | null;
};

function OrdenesTrabajoContent() {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [ordenSeleccionada, setOrdenSeleccionada] =
    useState<OrdenTrabajo | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState(""); // Compatibilidad
  const [metodoPagoId, setMetodoPagoId] = useState<number | null>(null);
  const [submetodoPagoId, setSubmetodoPagoId] = useState<number | null>(null);
  const [cuentaDestinoId, setCuentaDestinoId] = useState<number | null>(null);
  const [cuentasDestino, setCuentasDestino] = useState<Array<{ id: number; nombre_titular: string; sucursal_id: number }>>([]);
  const [loadingPago, setLoadingPago] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [historialSeñas, setHistorialSeñas] = useState<any[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [mostrarModalRecibo, setMostrarModalRecibo] = useState(false);
  const [ordenParaRecibo, setOrdenParaRecibo] =
    useState<OrdenTrabajo | null>(null);
  const [motivoRecibo, setMotivoRecibo] = useState("");
  const [saldoClienteCC, setSaldoClienteCC] = useState(0);
  const [metodoPagoComplemento, setMetodoPagoComplemento] =
    useState<MetodoPagoComplemento | null>(null);
  const [reciboRecienGenerado, setReciboRecienGenerado] = useState<{
    recibo: { orden_id: number; fecha_hora: string; monto: number; motivo: string; cliente_nombre: string; presupuesto_numero: string };
    orden: OrdenTrabajo;
  } | null>(null);
  const [historialRecibos, setHistorialRecibos] = useState<any[]>([]);
  const [cargandoRecibos, setCargandoRecibos] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const [showModalCompletarContrato, setShowModalCompletarContrato] = useState(false);
  const [ordenParaContrato, setOrdenParaContrato] = useState<OrdenTrabajo | null>(null);
  const [dniCompletar, setDniCompletar] = useState("");
  const [direccionCompletar, setDireccionCompletar] = useState("");
  const [procesandoContrato, setProcesandoContrato] = useState(false);
  const [showConfirmGenerarContrato, setShowConfirmGenerarContrato] =
    useState(false);
  const [ordenConfirmarContrato, setOrdenConfirmarContrato] =
    useState<OrdenTrabajo | null>(null);
  const [reimpresionContrato, setReimpresionContrato] = useState(false);
  const [generandoContrato, setGenerandoContrato] = useState(false);
  const [modalEtiquetasArmadoAbierto, setModalEtiquetasArmadoAbierto] =
    useState(false);
  const [ordenEtiquetasArmado, setOrdenEtiquetasArmado] =
    useState<OrdenTrabajo | null>(null);
  const [imprimiendoEtiquetasArmado, setImprimiendoEtiquetasArmado] =
    useState(false);
  const [modistaProductoId, setModistaProductoId] = useState<number | null>(
    null
  );
  const [modistaNotasDraft, setModistaNotasDraft] = useState("");
  const [guardandoModista, setGuardandoModista] = useState(false);

  const ORDENES_POR_PAGINA = 20;
  const verContratoAbiertoRef = useRef<number | null>(null);

  const { me } = useAuth();
  const searchParams = useSearchParams();
  const esAdmin =
    me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";

  // Métodos de pago (etiquetas en historial de señas)
  const metodosPago = [
    { value: "EFECTIVO", label: "Efectivo" },
    { value: "DEBITO", label: "Débito" },
    { value: "CREDITO", label: "Crédito" },
    { value: "BILLETERA_VIRTUAL", label: "Transferencia" },
    { value: "TRANSFERENCIA", label: "Transferencia" },
  ];
  const labelMetodoPago = (value: string) =>
    value === "BILLETERA_VIRTUAL" || value === "TRANSFERENCIA"
      ? "Transferencia"
      : metodosPago.find((m) => m.value === value)?.label ?? value;

  const getEstadoClass = (estado: string) => {
    switch (estado.toLowerCase()) {
      case "en proceso":
        return "bg-primary";
      case "completada":
        return "bg-success";
      case "cancelada":
        return "bg-danger";
      case "entregada":
        return "bg-info";
      case "pagada":
      case "pagado": // legado (algunos pagos viejos guardaban "Pagado")
        return "bg-warning";
      default:
        return "bg-secondary";
    }
  };

  useEffect(() => {
    fetchOrdenes();

    const cargarCuentasDestino = async () => {
      try {
        const sucursalId = me?.sucursalId || 1;
        const res = await fetch(`${getApiBaseUrl()}/cuentas-destino/sucursal/${sucursalId}?solo_activas=true`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (!res.ok) throw new Error("Error al obtener cuentas destino");
        const data = await res.json();
        setCuentasDestino(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error al cargar cuentas destino:", error);
      }
    };
    
    cargarCuentasDestino();
  }, [me]);

  useEffect(() => {
    const verContratoId = searchParams.get("verContrato");
    if (!verContratoId) return;
    const ordenId = parseInt(verContratoId, 10);
    if (isNaN(ordenId)) return;
    if (verContratoAbiertoRef.current === ordenId) return;
    verContratoAbiertoRef.current = ordenId;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/ordenes/${ordenId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (!res.ok) return;
        const ordenCompleta = await res.json();
        abrirVentanaContrato(ordenCompleta);
        window.history.replaceState({}, "", "/ordenes");
      } catch (e) {
        console.error("Error al abrir contrato desde URL:", e);
      }
    })();
  }, [searchParams]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);

  useEffect(() => {
    if (!showPagoModal || ordenSeleccionada?.cliente_id == null) {
      setSaldoClienteCC(0);
      return;
    }
    const t = localStorage.getItem("token");
    if (!t) return;
    const cid = Number(ordenSeleccionada.cliente_id);
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(`${getApiBaseUrl()}/pagos/saldo/${cid}`, {
          headers: { Authorization: `Bearer ${t}` },
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        if (r.ok) {
          const j = await r.json();
          if (j.cliente_id != null && Number(j.cliente_id) !== cid) {
            console.warn("[pago orden] saldo: cliente_id en respuesta distinto al pedido", j.cliente_id, cid);
          }
          const s = Number(j.saldo_actual);
          setSaldoClienteCC(Number.isFinite(s) ? Math.round(s) : 0);
        } else {
          setSaldoClienteCC(0);
        }
      } catch {
        if (ac.signal.aborted) return;
        setSaldoClienteCC(0);
      }
    })();
    return () => ac.abort();
  }, [showPagoModal, ordenSeleccionada?.cliente_id]);

  const fetchOrdenes = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/ordenes/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) throw new Error("Error al obtener órdenes");

      const data = await res.json();
      const normalizado = Array.isArray(data)
        ? data.map((orden: any) => {
            // El backend ya devuelve metodo_pago formateado correctamente
            // Priorizar metodo_pago del backend (ya formateado) sobre payment_method antiguo
            const metodoPagoDisplay = orden.metodo_pago || orden.payment_method || null;
            return {
              ...orden,
              payment_method: metodoPagoDisplay,
              metodo_pago: metodoPagoDisplay,
            };
          })
        : [];
      setOrdenes(normalizado);
    } catch (error) {
      console.error("Error al cargar órdenes:", error);
      toast.error("No se pudieron cargar las órdenes de trabajo.");
      setOrdenes([]);
    } finally {
      setCargando(false);
    }
  };

  const registrarPago = async () => {
    if (!ordenSeleccionada) return;
    if (ordenSeleccionada.saldo_pendiente <= 0) {
      toast.error("No hay saldo pendiente; no se pueden registrar más pagos.");
      setShowPagoModal(false);
      return;
    }
    const montoTotal = parseFloat(montoPago);
    if (!montoPago || Number.isNaN(montoTotal) || montoTotal <= 0) {
      toast.error("Ingresá un monto válido.");
      return;
    }
    if (metodoPagoId == null) {
      toast.error("Debes seleccionar un método de pago.");
      return;
    }
    if (
      metodoPagoId === METODO_PAGO_CUENTA_CORRIENTE_ID &&
      (ordenSeleccionada.cliente_id == null || saldoClienteCC <= 0)
    ) {
      toast.error("No hay saldo en cuenta corriente para usar como método de pago.");
      return;
    }
    const esMetodoCC =
      metodoPagoId === METODO_PAGO_CUENTA_CORRIENTE_ID &&
      ordenSeleccionada.cliente_id != null &&
      saldoClienteCC > 0;
    const creditoAplicado = esMetodoCC ? Math.min(saldoClienteCC, montoTotal) : 0;
    const montoCaja = Math.max(montoTotal - creditoAplicado, 0);
    if (esMetodoCC && montoTotal > saldoClienteCC + 1e-9 && !metodoPagoComplemento?.metodoId) {
      toast.error("Indicá el método de pago para el importe que ingresa en caja.");
      return;
    }
    if (montoCaja > 1e-6) {
      const cajaMetodoId = esMetodoCC
        ? metodoPagoComplemento?.metodoId ?? null
        : metodoPagoId;
      if (!cajaMetodoId || !cuentaDestinoId) {
        if (!cuentaDestinoId) toast.error("Debes seleccionar una cuenta destino");
        else toast.error("Debes seleccionar un método de pago para el importe en caja");
        return;
      }
    }

    setLoadingPago(true);

    try {
      const body: Record<string, unknown> = {
        monto_pagado: montoTotal,
        credito_aplicado: creditoAplicado,
        motivo_recibo: motivoRecibo.trim() || undefined,
      };
      if (montoCaja > 1e-6) {
        body.metodo_pago_id = esMetodoCC
          ? metodoPagoComplemento?.metodoId
          : metodoPagoId;
        body.submetodo_pago_id = esMetodoCC
          ? metodoPagoComplemento?.submetodoId ?? null
          : submetodoPagoId || null;
        body.payment_method = null;
        body.cuenta_destino_id = cuentaDestinoId;
      } else {
        body.metodo_pago_id = null;
        body.submetodo_pago_id = null;
        body.payment_method = null;
        body.cuenta_destino_id = null;
      }

      const res = await fetch(
        `${getApiBaseUrl()}/ordenes/${ordenSeleccionada.id}/pagar-saldo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Error al registrar el pago");
      }

      const resultado = await res.json();
      await fetchOrdenes();
      setShowPagoModal(false);
      setMontoPago("");
      setMetodoPago("");
      setMetodoPagoId(null);
      setSubmetodoPagoId(null);
      setCuentaDestinoId(null);
      setMotivoRecibo("");
      setMetodoPagoComplemento(null);

      if (ordenSeleccionada && resultado?.data?.recibo) {
        setReciboRecienGenerado({
          recibo: resultado.data.recibo,
          orden: ordenSeleccionada,
        });
      } else {
        toast.success("Pago registrado correctamente.");
      }

      if (ordenSeleccionada && showViewModal) {
        await fetchHistorialSeñas(ordenSeleccionada.id);
        fetchRecibosOrden(ordenSeleccionada.id);
      }
    } catch (err) {
      alert(
        `Error al guardar el pago: ${
          err instanceof Error ? err.message : "Error desconocido"
        }`
      );
    } finally {
      setLoadingPago(false);
    }
  };

  const eliminarOrden = async (orden: OrdenTrabajo) => {
    const confirmacion = window.confirm(
      `¿Estás seguro de que querés eliminar la orden #${orden.id}?\n\nEsta acción liberará los productos reservados y no se puede deshacer.`
    );
    if (!confirmacion) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("No se pudo obtener el token de autenticación");
        return;
      }

      const res = await fetch(`${getApiBaseUrl()}/ordenes/${orden.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          error.detail || error.message || "Error al eliminar la orden"
        );
      }

      const result = await res.json();
      if (result.success) {
        toast.success(result.message || "Orden eliminada correctamente");
        fetchOrdenes();
      } else {
        throw new Error(result.message || "Error al eliminar la orden");
      }
    } catch (error: any) {
      console.error("Error al eliminar orden:", error);
      toast.error(error.message || "Error al eliminar la orden");
    }
  };

  const fetchHistorialSeñas = async (ordenId: number) => {
    setCargandoHistorial(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/ordenes/${ordenId}/historial-pagos`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data && data.data.pagos) {
          setHistorialSeñas(data.data.pagos);
        } else {
          setHistorialSeñas([]);
        }
      } else {
        setHistorialSeñas([]);
      }
    } catch (error) {
      console.error("Error al obtener historial de señas:", error);
      setHistorialSeñas([]);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const fetchRecibosOrden = async (ordenId: number) => {
    setCargandoRecibos(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/ordenes/${ordenId}/recibos`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistorialRecibos(data?.data?.recibos ?? []);
      } else {
        setHistorialRecibos([]);
      }
    } catch {
      setHistorialRecibos([]);
    } finally {
      setCargandoRecibos(false);
    }
  };

  const normalizarTelefonoRecibo = (telefono?: string | null): string | null => {
    if (!telefono) return null;
    let limpio = String(telefono).replace(/\D/g, "");
    if (!limpio) return null;
    limpio = limpio.replace(/^0+/, "");
    if (limpio.startsWith("54")) {
      if (!limpio.startsWith("549")) limpio = `549${limpio.slice(2)}`;
    } else {
      if (limpio.startsWith("9")) limpio = limpio.slice(1);
      limpio = `549${limpio}`;
    }
    return limpio;
  };

  const textoReciboParaWhatsApp = (recibo: { orden_id: number; presupuesto_numero: string; cliente_nombre: string; fecha_hora: string; monto: number; motivo: string }) => {
    const fecha = recibo.fecha_hora ? format(new Date(recibo.fecha_hora), "dd/MM/yyyy HH:mm", { locale: es }) : format(new Date(), "dd/MM/yyyy", { locale: es });
    return `*GUAPO TRAJES - Recibo*\n\nOrden N°: ${recibo.orden_id}\nPresupuesto: ${recibo.presupuesto_numero}\nCliente: ${recibo.cliente_nombre}\nFecha: ${fecha}\nMonto: $${Number(recibo.monto).toLocaleString("es-AR")}\nConcepto: ${recibo.motivo}`;
  };

  const imprimirReciboPago = (recibo: { orden_id: number; fecha_hora: string; monto: number; motivo: string; cliente_nombre: string; presupuesto_numero: string }) => {
    const fechaRecibo = recibo.fecha_hora ? format(new Date(recibo.fecha_hora), "dd/MM/yyyy HH:mm", { locale: es }) : format(new Date(), "dd/MM/yyyy HH:mm", { locale: es });
    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Recibo - ${recibo.orden_id}</title>
<style>@media print{body{margin:0}.no-print{display:none}} body{font-family:'Courier New',monospace;width:80mm;margin:0 auto;padding:8px;font-size:10px;}
.info-row{display:flex;justify-content:space-between;margin-bottom:4px;}.header{text-align:center;border-bottom:1px dashed #000;padding-bottom:5px;margin-bottom:8px;}
</style></head>
<body>
<div class="header"><h1>RECIBO</h1><div>GUAPO TRAJES</div></div>
<div class="info-row"><span>Orden N°:</span><span>${recibo.orden_id}</span></div>
<div class="info-row"><span>Presupuesto:</span><span>${recibo.presupuesto_numero}</span></div>
<div class="info-row"><span>Cliente:</span><span>${recibo.cliente_nombre}</span></div>
<div class="info-row"><span>Fecha:</span><span>${fechaRecibo}</span></div>
<div class="info-row"><span>Monto:</span><span>$${Number(recibo.monto).toLocaleString("es-AR")}</span></div>
<div class="info-row"><span>Concepto:</span><span>${recibo.motivo}</span></div>
<div class="no-print" style="margin-top:15px;text-align:center;">
<button onclick="window.print()">Imprimir</button><button onclick="window.close()">Cerrar</button>
</div>
</body></html>`;
    const ventana = window.open("", "_blank", "width=320,height=420");
    if (ventana) {
      ventana.document.write(html);
      ventana.document.close();
      setTimeout(() => ventana.print(), 400);
    } else {
      toast.error("Permití ventanas emergentes para imprimir.");
    }
  };

  const compartirReciboWhatsApp = (recibo: { orden_id: number; presupuesto_numero: string; cliente_nombre: string; fecha_hora: string; monto: number; motivo: string }, telefono: string | null) => {
    const tel = normalizarTelefonoRecibo(telefono);
    if (!tel) {
      toast.error("No hay número de teléfono del cliente para enviar por WhatsApp.");
      return;
    }
    const texto = textoReciboParaWhatsApp(recibo);
    window.open(`https://api.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(texto)}`, "_blank");
  };

  const abrirVentanaContrato = (orden: OrdenTrabajo) => {
    try {
      // Obtener información de la orden
      const idContrato = orden.id.toString().padStart(6, "0");
      const clienteNombre = orden.cliente_nombre || "";
      const clienteDNI = orden.cliente_dni || "____________________";
      const clienteDireccion =
        orden.cliente_direccion || "__________________________";
      const fechaEvento = orden.fecha_evento
        ? format(
            new Date(orden.fecha_evento + "T00:00:00"),
            "dd/MM/yyyy",
            { locale: es }
          )
        : "";
      const fechaCreacion = orden.fecha_creacion
        ? format(new Date(orden.fecha_creacion), "dd/MM/yyyy", {
            locale: es,
          })
        : format(new Date(), "dd/MM/yyyy", { locale: es });

      // Fecha del contrato: al momento de generar el contrato de forma manual (no la de la orden)
      const fechaContrato = new Date();
      const dia = fechaContrato.getDate();
      const meses = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre",
      ];
      const mes = meses[fechaContrato.getMonth()];
      const año = fechaContrato.getFullYear();

      // Calcular días de vigencia (diferencia entre fecha evento y fecha de creación de la orden)
      const fechaCreacionOrden = orden.fecha_creacion ? new Date(orden.fecha_creacion) : new Date();
      const fechaEventoDate = orden.fecha_evento
        ? new Date(orden.fecha_evento + "T00:00:00")
        : new Date();
      const diasVigencia = Math.max(
        1,
        Math.ceil(
          (fechaEventoDate.getTime() - fechaCreacionOrden.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      // Precio total del alquiler (para la tercera vigencia)
      const precioTotal =
        orden.total_presupuesto ||
        orden.total ||
        orden.seña_pagada + orden.saldo_pendiente;
      const precioFormateado = precioTotal.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      // Segunda vigencia - debe quedar vacía
      const segundaVigencia = "";

      // Tercera vigencia - total alquiler para usar en el texto
      const terceraVigenciaTotal = precioFormateado;

      // Calcular valor del pagaré: precio del alquiler multiplicado por 5
      const valorPagare = precioTotal * 5;
      const valorPagareFormateado = valorPagare.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      // Lista de prendas
      const listaPrendas = (orden.productos_reservados || [])
        .map((prod: any, index: number) => `${index + 1}. ${prod.producto_descripcion || prod.producto_nombre || "Producto"}`)
        .join("<br>");

      // Fechas del pagaré: en blanco para rellenar manualmente (evitar vencimiento y ejecución)
      // No se calculan diaVencimiento/mesVencimiento/añoVencimiento; se dejan vacíos en el HTML.

      // Datos del firmante - deben quedar vacíos
      const firmante = "";
      const aclaracion = "";
      const celular = "";

    const contenidoContrato = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrato de Alquiler - ID ${idContrato}</title>
    <style>
        @media print {
            @page {
                size: legal;
                margin: 0.8cm 1.5cm;
            }
            body { 
                margin: 0;
                padding: 0;
            }
            .no-print { display: none; }
        }
        body {
            font-family: 'Times New Roman', serif;
            max-width: 100%;
            margin: 0 auto;
            padding: 15px 20px;
            line-height: 1.5;
            font-size: 11pt;
        }
        .header {
            text-align: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
        }
        .header h1 {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 6px;
        }
        .numero-contrato {
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .clausula {
            margin-bottom: 10px;
            text-align: justify;
            padding: 4px 0;
            line-height: 1.5;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: normal;
            orphans: 3;
            widows: 3;
            text-indent: 0;
        }
        .clausula:first-of-type {
            text-align: left;
            word-spacing: normal;
            letter-spacing: normal;
            text-indent: 0;
            margin-top: 0;
            padding-top: 0;
            line-break: auto;
            overflow-wrap: normal;
            word-break: normal;
            display: block;
        }
        .clausula:first-of-type::first-line {
            text-indent: 0;
        }
        .clausula:first-of-type::first-letter {
            float: none;
            margin: 0;
            padding: 0;
        }
        .clausula:first-of-type strong,
        .clausula:first-of-type span {
            display: inline !important;
            white-space: normal !important;
            word-break: keep-all !important;
        }
        .clausula:first-of-type::before {
            content: "";
            display: none;
        }
        .clausula:first-of-type > *:first-child {
            display: inline !important;
        }
        .texto-continuo {
            display: inline;
            white-space: normal;
            word-break: normal;
            overflow-wrap: normal;
        }
        .texto-continuo * {
            display: inline !important;
            white-space: normal !important;
        }
        .clausula strong {
            font-weight: bold;
            font-size: 11.5pt;
            display: inline;
            white-space: normal;
            word-break: normal;
            line-height: inherit;
        }
        .clausula > strong:first-child {
            display: block;
            margin-bottom: 0;
            margin-top: 2px;
            white-space: normal;
        }
        .clausula br {
            margin-bottom: 0;
            display: block;
            line-height: 0;
        }
        .lista-prendas {
            margin: 6px 0;
            padding-left: 20px;
            padding-top: 4px;
            padding-bottom: 4px;
            font-size: 10.5pt;
            line-height: 1.6;
        }
        .firma {
            margin-top: 18px;
            padding-top: 14px;
        }
        .firma div {
            margin-bottom: 10px;
            line-height: 1.8;
        }
        .firma div div {
            margin-bottom: 6px;
            font-size: 11pt;
        }
        .pagare {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid #000;
        }
        .pagare .header {
            margin-bottom: 8px;
        }
        .pagare .header h1 {
            font-size: 12pt;
            font-weight: bold;
        }
        .pagare .clausula {
            padding: 6px 0;
        }
        .pagare div[style*="margin-top"] {
            margin-top: 8px !important;
        }
        .pagare div[style*="margin-bottom"] {
            margin-bottom: 4px !important;
            line-height: 1.6;
            font-size: 11pt;
        }
        .botones {
            text-align: center;
            margin-top: 15px;
        }
        button {
            padding: 10px 20px;
            margin: 0 10px;
            font-size: 14px;
            cursor: pointer;
        }
        .underline {
            border-bottom: 1px solid #000;
            display: inline;
            padding-bottom: 2px;
            text-decoration: none;
            white-space: normal;
            word-break: normal;
            line-height: inherit;
        }
        .pagare .underline.espacio-dia { display: inline-block; min-width: 3.5em; }
        .pagare .underline.espacio-mes { display: inline-block; min-width: 11em; }
        .pagare .underline.espacio-anio { display: inline-block; min-width: 4.5em; }
        .pagare .underline.espacio-firma { display: inline-block; min-width: 20em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Contrato Alquiler de Prendas de Vestir</h1>
        <div class="numero-contrato">ID Contrato: ${idContrato}</div>
    </div>

    <div class="clausula"><span class="texto-continuo">Entre <strong>Schmira Ariel Fernando</strong>, local Guapo Trajes, por una parte, en adelante <strong>EL LOCADOR</strong>, y <span class="underline">${clienteNombre}</span>, DNI <span class="underline">${clienteDNI}</span>, con domicilio en <span class="underline">${clienteDireccion}</span> de la Ciudad de La Rioja, por la otra parte, en adelante <strong>EL LOCATARIO</strong>, convienen de común acuerdo en celebrar el presente contrato, el que se regirá por las siguientes cláusulas, sin perjuicio de la de Ley, a saber:</span></div>

    <div class="clausula">
        <strong>PRIMERA: OBJETO</strong><br>
        EL LOCADOR da en locación al LOCATARIO las prendas que se detallan:
        <div class="lista-prendas">
            ${listaPrendas}
        </div>
        Las cuales se reciben en perfecto estado de conservación y uso, a entera satisfacción del LOCATARIO, quien ha probado y verificado las prendas objeto del mismo, y ha constatado su excelente estado de conservación.
    </div>

    <div class="clausula">
        <strong>SEGUNDA: VIGENCIA</strong><br>
        El presente contrato tendrá una vigencia de <span class="underline">${diasVigencia}</span> días corridos a partir de la firma del mismo. <span class="underline">${segundaVigencia}</span> El plazo de la locación quedará automáticamente prorrogado a su vencimiento, hasta la real restitución de la totalidad de las prendas. Las mismas deberán ser devueltas en el local Guapo sito en Santiago del Estero 83 de la ciudad de La Rioja.
    </div>

    <div class="clausula">
        <strong>TERCERA: PRECIO</strong><br>
        El precio pactado de común acuerdo del presente contrato se fija en PESOS $ <span class="underline">${terceraVigenciaTotal}</span>. El pago deberá integrarse en un 100% antes del retiro de las prendas del local Guapo. La prórroga obliga al LOCATARIO a abonar una suma equivalente al CINCO POR CIENTO (5%) del precio total del alquiler por cada día de demora, hasta la restitución total de las prendas al LOCADOR. En garantía de la totalidad de las prendas alquiladas se firma un pagaré de aval, presente al pie, el cual integra y es parte del presente contrato.
    </div>

    <div class="clausula">
        <strong>CUARTA</strong><br>
        Las prendas han sido probadas por el LOCATARIO quien las recibe a su entera y total satisfacción. El LOCATARIO se obliga a devolverlas al LOCADOR en el mismo estado en que las recibe, prevaleciendo ante cualquier eventualidad el criterio del LOCADOR sobre el estado de las prendas devueltas. EL LOCADOR no asume ningún tipo de responsabilidad por el uso y destino de las mismas.
    </div>

    <div class="clausula">
        <strong>QUINTA: OBLIGACIONES DEL LOCATARIO</strong><br>
        EL LOCATARIO, además de las mencionadas precedentemente, asume las siguientes obligaciones: • No realizar modificaciones o arreglos de ninguna naturaleza a las prendas. • No realizar lavado de las prendas alquiladas. En caso de incumplimiento de alguna de las obligaciones a cargo del LOCATARIO, se producirá la mora en forma automática y el LOCADOR quedará facultado para declarar rescindida la locación, sin necesidad de interpelación extrajudicial o judicial previa.
    </div>

    <div class="clausula">
        <strong>SEXTA</strong><br>
        En caso de rotura, mancha, deterioro o extravío de las prendas alquiladas, el LOCADOR realizará la reparación, reposición o lo que estime necesario, según su absoluto y único criterio, para garantizar el buen estado de las mismas, debiendo soportar los cargos que la gestión demande enteramente el LOCATARIO.
    </div>

    <div class="clausula">
        <strong>SÉPTIMA: CANCELACIÓN</strong><br>
        De cancelarse el evento motivo del presente contrato, el LOCATARIO deberá abonar al LOCADOR: a) Si las prendas estuvieran en el local y no han sido retiradas para el evento, el cargo por seña que hubiera abonado; en tal caso el LOCATARIO no podrá pretender la devolución de lo ya abonado, quedando para el LOCADOR en concepto de indemnización. b) Si las prendas han sido retiradas rige el contrato en todas sus cláusulas.
    </div>

    <div class="clausula">
        <strong>OCTAVA: JURISDICCIÓN</strong><br>
        Para todos los efectos legales emergentes del presente, las partes se someten al fuero y jurisdicción ordinarios de los Tribunales Civiles de la Ciudad de La Rioja, con renuncia expresa a todo otro que pudiera corresponderles, constituyendo domicilios especiales y legales en los enunciados en este contrato.
    </div>

    <div class="clausula">
        <strong>NOVENA</strong><br>
        En conformidad del presente contrato se firma un ejemplar en la ciudad de La Rioja a los <span class="underline">${dia}</span> días del mes de <span class="underline">${mes}</span> de ${año}.
    </div>

    <div class="firma">
        <div>
            <div>Firma: <span class="underline"></span></div>
            <div>D.N.I.: <span class="underline"></span></div>
        </div>
    </div>

    <div class="pagare">
        <div class="header">
            <h1>PAGARÉ</h1>
        </div>
        <div class="clausula">
            La Rioja, <span class="underline espacio-dia">&nbsp;</span> de <span class="underline espacio-mes">&nbsp;</span> de <span class="underline espacio-anio">&nbsp;</span>. Vence el <span class="underline espacio-dia">&nbsp;</span> de <span class="underline espacio-mes">&nbsp;</span> de <span class="underline espacio-anio">&nbsp;</span>. Pagaré $ <span class="underline">${valorPagareFormateado}</span> Sin Protesto (Art. 50 D. Ley 5965/63). A señor Schmira Ariel Fernando o a su orden. La cantidad de pesos <span class="underline">${valorPagareFormateado}</span>. Por igual valor recibido en prendas de vestir a su entera satisfacción. Pagadero en Santiago del Estero 83 de la Ciudad de La Rioja.
            <div style="margin-top: 12px;">
                <div style="margin-bottom: 6px;">Firmante: <span class="underline espacio-firma">${firmante}</span></div>
                <div style="margin-bottom: 6px;">Aclaración: <span class="underline espacio-firma">${aclaracion}</span></div>
                <div>Celular: <span class="underline espacio-firma">${celular}</span></div>
            </div>
        </div>
    </div>

    <div class="botones no-print">
        <button onclick="window.print()" style="padding: 8px 15px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Imprimir</button>
        <button onclick="window.close()" style="padding: 8px 15px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Cerrar</button>
    </div>
</body>
</html>
    `;

      const ventanaContrato = window.open("", "_blank", "width=1000,height=1400");
      if (ventanaContrato) {
        ventanaContrato.document.write(contenidoContrato);
        ventanaContrato.document.close();
      } else {
        toast.error("No se pudo abrir la ventana de contrato. Permití ventanas emergentes.");
      }
    } catch (error) {
      console.error("Error al generar contrato:", error);
      toast.error("Error al generar el contrato. Por favor, intenta nuevamente.");
    }
  };

  const solicitarConfirmacionGenerarContrato = (orden: OrdenTrabajo) => {
    setOrdenConfirmarContrato(orden);
    setReimpresionContrato(Boolean(orden.contrato_generado_at));
    setShowConfirmGenerarContrato(true);
  };

  const ejecutarGeneracionContrato = async () => {
    const orden = ordenConfirmarContrato;
    if (!orden) return;

    const yaGenerado = reimpresionContrato;
    setGenerandoContrato(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/ordenes/${orden.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) {
        toast.error("No se pudo cargar la orden.");
        return;
      }
      const ordenCompleta = await res.json();
      abrirVentanaContrato(ordenCompleta);
      if (yaGenerado) {
        toast.success("Contrato abierto para imprimir.");
        setShowConfirmGenerarContrato(false);
        setOrdenConfirmarContrato(null);
        return;
      }
      const reg = await fetch(
        `${getApiBaseUrl()}/ordenes/${orden.id}/registrar-contrato`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (reg.ok) {
        toast.success(
          "Contrato generado. Ya está disponible en la vista Contratos."
        );
        fetchOrdenes();
        setShowConfirmGenerarContrato(false);
        setOrdenConfirmarContrato(null);
      } else {
        const err = await reg.json().catch(() => ({}));
        toast.error(err.detail || "No se pudo registrar el contrato.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al generar el contrato.");
    } finally {
      setGenerandoContrato(false);
    }
  };

  const abrirModalEtiquetasArmado = async (orden: OrdenTrabajo) => {
    if (orden.etiquetas_armado_impresas_at) {
      toast.info("Las etiquetas de esta orden ya se imprimieron al crearla.");
      return;
    }
    let ordenCompleta = orden;
    if (!orden.productos_reservados?.length) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/ordenes/${orden.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (res.ok) ordenCompleta = await res.json();
      } catch {
        toast.error("No se pudo cargar la orden.");
        return;
      }
    }
    if (!ordenCompleta.productos_reservados?.length) {
      toast.error("La orden no tiene prendas para imprimir etiquetas.");
      return;
    }
    setOrdenEtiquetasArmado(ordenCompleta);
    setModalEtiquetasArmadoAbierto(true);
  };

  const imprimirEtiquetasArmadoOrden = async () => {
    if (!ordenEtiquetasArmado) return;
    setImprimiendoEtiquetasArmado(true);
    try {
      const payload = ordenEtiquetasArmado.productos_reservados.map((pr) => ({
        codigoBarra: pr.codigo_barra || "0",
        clienteNombre: ordenEtiquetasArmado.cliente_nombre || "Cliente",
        prendaDescripcion: pr.producto_descripcion || "Prenda para armar",
      }));
      const { porIndice } = await imprimirEtiquetas100x50Lote(payload);
      const ok = porIndice.filter((s) => s === "ok").length;
      if (ok === 0) {
        toast.error("No se pudo generar ninguna etiqueta.");
        return;
      }
      const reg = await fetch(
        `${getApiBaseUrl()}/ordenes/${ordenEtiquetasArmado.id}/registrar-etiquetas-armado`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (!reg.ok) {
        const err = await reg.json().catch(() => ({}));
        throw new Error(err.detail || "No se pudo registrar la impresión");
      }
      toast.success(`${ok} etiqueta(s) enviadas a impresión.`);
      setModalEtiquetasArmadoAbierto(false);
      setOrdenEtiquetasArmado(null);
      fetchOrdenes();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Error al imprimir etiquetas"
      );
    } finally {
      setImprimiendoEtiquetasArmado(false);
    }
  };

  const abrirPanelModista = (prod: ProductoReservado) => {
    if (modistaProductoId === prod.producto_id) {
      setModistaProductoId(null);
      setModistaNotasDraft("");
      return;
    }
    setModistaProductoId(prod.producto_id);
    setModistaNotasDraft(prod.notas_modista || "");
  };

  const actualizarProductoModistaEnOrden = (
    productoId: number,
    patch: Partial<ProductoReservado>
  ) => {
    const merge = (lista: ProductoReservado[]) =>
      lista.map((p) =>
        p.producto_id === productoId ? { ...p, ...patch } : p
      );
    setOrdenSeleccionada((prev) =>
      prev
        ? { ...prev, productos_reservados: merge(prev.productos_reservados) }
        : prev
    );
    setOrdenes((prev) =>
      prev.map((o) =>
        o.id === ordenSeleccionada?.id
          ? { ...o, productos_reservados: merge(o.productos_reservados) }
          : o
      )
    );
  };

  const guardarIndicacionModista = async (
    prod: ProductoReservado,
    requiere: boolean
  ) => {
    if (!ordenSeleccionada) return;
    const notas = modistaNotasDraft.trim();
    if (requiere && !notas) {
      toast.error("Indicá qué debe hacerse en modista");
      return;
    }
    setGuardandoModista(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/ordenes/${ordenSeleccionada.id}/productos-reservados/${prod.producto_id}/modista`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            requiere_modista: requiere,
            notas_modista: requiere ? notas : null,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : body.message || "No se pudo guardar"
        );
      }
      const data = body.data || {};
      actualizarProductoModistaEnOrden(prod.producto_id, {
        requiere_modista: data.requiere_modista ?? requiere,
        notas_modista: data.notas_modista ?? (requiere ? notas : ""),
      });
      toast.success(
        requiere ? "Prenda marcada para modista" : "Indicación de modista quitada"
      );
      if (!requiere) {
        setModistaProductoId(null);
        setModistaNotasDraft("");
      }
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Error al guardar indicación de modista"
      );
    } finally {
      setGuardandoModista(false);
    }
  };

  const generarContratoDesdeFila = (orden: OrdenTrabajo) => {
    if (orden.saldo_pendiente !== 0 && !esAdmin) {
      toast.error("El saldo pendiente debe ser cero para generar el contrato.");
      return;
    }
    if (orden.es_precliente || !orden.cliente_dni || !orden.cliente_direccion) {
      setOrdenParaContrato(orden);
      setDniCompletar(orden.cliente_dni ?? "");
      setDireccionCompletar(orden.cliente_direccion ?? "");
      setShowModalCompletarContrato(true);
      return;
    }
    solicitarConfirmacionGenerarContrato(orden);
  };

  const generarContrato = () => {
    if (!ordenSeleccionada) return;
    if (
      (ordenSeleccionada.saldo_pendiente !== 0 && !esAdmin) ||
      ordenSeleccionada.es_precliente ||
      !ordenSeleccionada.cliente_dni ||
      !ordenSeleccionada.cliente_direccion
    )
      return;
    abrirVentanaContrato(ordenSeleccionada);
  };

  const completarDatosYGenerarContrato = async () => {
    if (!ordenParaContrato) return;
    const dni = dniCompletar.trim();
    const direccion = direccionCompletar.trim();
    if (!dni || !direccion) {
      toast.error("Completá DNI y dirección.");
      return;
    }
    setProcesandoContrato(true);
    try {
      if (ordenParaContrato.precliente_id) {
        const resConvert = await fetch(
          `${getApiBaseUrl()}/preclientes/convertir/${ordenParaContrato.precliente_id}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ dni, direccion }),
          }
        );
        const dataConvert = await resConvert.json().catch(() => ({}));
        if (!resConvert.ok || !dataConvert.success) {
          toast.error(dataConvert.message || "Error al convertir precliente a cliente.");
          return;
        }
      } else if (ordenParaContrato.cliente_id) {
        const resCliente = await fetch(
          `${getApiBaseUrl()}/clientes/get_by_id/${ordenParaContrato.cliente_id}`,
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );
        if (!resCliente.ok) {
          toast.error("No se pudo cargar el cliente.");
          return;
        }
        const cliente = await resCliente.json();
        const resUpdate = await fetch(
          `${getApiBaseUrl()}/clientes/update/${ordenParaContrato.cliente_id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              nombre: cliente.nombre,
              apellido: cliente.apellido,
              dni,
              direccion,
              celular: cliente.celular ?? "",
              notas: cliente.notas ?? "",
            }),
          }
        );
        const dataUpdate = await resUpdate.json().catch(() => ({}));
        if (!resUpdate.ok || !dataUpdate.success) {
          toast.error(dataUpdate.message || "Error al actualizar cliente.");
          return;
        }
      } else {
        toast.error("No se puede completar: falta precliente o cliente.");
        return;
      }
      await fetchOrdenes();
      const resOrden = await fetch(`${getApiBaseUrl()}/ordenes/${ordenParaContrato.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!resOrden.ok) {
        toast.error("No se pudo cargar la orden.");
        return;
      }
      const ordenCompleta = await resOrden.json();
      setShowModalCompletarContrato(false);
      setDniCompletar("");
      setDireccionCompletar("");
      const ordenId = ordenParaContrato.id;
      setOrdenParaContrato(null);
      solicitarConfirmacionGenerarContrato({
        ...ordenCompleta,
        id: ordenCompleta.id ?? ordenId,
      });
    } catch (e) {
      console.error(e);
      toast.error("Error al completar datos o generar contrato.");
    } finally {
      setProcesandoContrato(false);
    }
  };

  const abrirModalRecibo = async (orden: OrdenTrabajo) => {
    try {
      // Obtener los datos completos de la orden desde el backend para tener los productos
      const res = await fetch(`${getApiBaseUrl()}/ordenes/${orden.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (res.ok) {
        const ordenCompleta = await res.json();
        setOrdenParaRecibo(ordenCompleta);
      } else {
        // Si falla, usar los datos de la lista como fallback
        setOrdenParaRecibo(orden);
      }
      setMostrarModalRecibo(true);
    } catch (error) {
      console.error("Error al obtener orden completa:", error);
      // Si falla, usar los datos de la lista como fallback
      setOrdenParaRecibo(orden);
      setMostrarModalRecibo(true);
    }
  };

  const imprimirRecibo = async () => {
    if (!ordenParaRecibo) return;

    try {
      // Obtener los datos completos de la orden desde el backend para tener los productos
      const res = await fetch(
        `${getApiBaseUrl()}/ordenes/${ordenParaRecibo.id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!res.ok) throw new Error("Error al obtener orden completa");

      const ordenCompleta = await res.json();
      const productos = ordenCompleta.productos_reservados || [];

      const fechaHoy = format(new Date(), "dd/MM/yyyy", { locale: es });

      const contenidoRecibo = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recibo - ${ordenParaRecibo.id}</title>
    <style>
        @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none; }
            @page {
                size: 80mm auto;
                margin: 5mm;
            }
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            max-width: 80mm;
            margin: 0 auto;
            padding: 8mm 5mm;
            font-size: 10px;
            line-height: 1.3;
        }
        .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 5px;
            margin-bottom: 8px;
        }
        .header h1 {
            font-size: 14px;
            font-weight: bold;
            margin: 0;
            letter-spacing: 1px;
        }
        .empresa {
            font-size: 9px;
            margin-top: 2px;
        }
        .fecha {
            text-align: right;
            font-size: 9px;
            margin-bottom: 8px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 9px;
        }
        .info-label {
            font-weight: bold;
        }
        .info-value {
            text-align: right;
            flex: 1;
            margin-left: 5px;
        }
        .separator {
            border-top: 1px dashed #000;
            margin: 8px 0;
        }
        .productos {
            margin-top: 8px;
        }
        .productos-title {
            font-weight: bold;
            font-size: 10px;
            margin-bottom: 5px;
            text-align: center;
        }
        .producto-item {
            font-size: 9px;
            margin-bottom: 4px;
            padding: 3px 0;
            border-bottom: 1px dotted #ccc;
        }
        .producto-item:last-child {
            border-bottom: none;
        }
        .botones {
            text-align: center;
            margin-top: 15px;
        }
        .botones button {
            padding: 8px 15px;
            margin: 0 5px;
            font-size: 10px;
            cursor: pointer;
            border: 1px solid #ccc;
            background: #f5f5f5;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>RECIBO</h1>
        <div class="empresa">GUAPO TRAJES</div>
    </div>
    
    <div class="fecha">
        Fecha: ${fechaHoy}
    </div>
    
    <div class="info-row">
        <span class="info-label">Orden N°:</span>
        <span class="info-value">${ordenParaRecibo.id}</span>
    </div>
    
    <div class="info-row">
        <span class="info-label">Presupuesto:</span>
        <span class="info-value">${ordenParaRecibo.presupuesto_numero}</span>
    </div>
    
    <div class="separator"></div>
    
    <div style="margin-bottom: 8px;">
        <div class="info-label" style="margin-bottom: 3px;">Cliente:</div>
        <div style="font-size: 9px; word-wrap: break-word;">
            ${ordenParaRecibo.cliente_nombre}
        </div>
        ${ordenParaRecibo.cliente_dni ? `<div style="font-size: 8px; color: #666; margin-top: 2px;">DNI: ${ordenParaRecibo.cliente_dni}</div>` : ''}
    </div>
    
    <div class="separator"></div>
    
    <div class="info-row">
        <span class="info-label">Fecha Evento:</span>
        <span class="info-value">${format(new Date(ordenParaRecibo.fecha_evento + "T00:00:00"), "dd/MM/yyyy", { locale: es })}</span>
    </div>
    
    <div class="separator"></div>
    
    <div class="productos">
        <div class="productos-title">PRODUCTOS:</div>
        ${productos.length > 0 
          ? productos.map((prod: any, index: number) => `
            <div class="producto-item">
                ${index + 1}. ${prod.producto_descripcion || 'Producto sin descripción'}
            </div>
          `).join('')
          : '<div class="producto-item" style="color: #666; font-style: italic;">Sin productos</div>'
        }
    </div>
    
    <div class="botones no-print">
        <button onclick="window.print()">Imprimir</button>
        <button onclick="window.close()">Cerrar</button>
    </div>
</body>
</html>`;

      const ventana = window.open("", "_blank", "width=300,height=600");
      if (ventana) {
        ventana.document.write(contenidoRecibo);
        ventana.document.close();
        setTimeout(() => {
          ventana.print();
        }, 500);
      } else {
        toast.error(
          "Por favor, permite ventanas emergentes para imprimir el recibo"
        );
      }
    } catch (error) {
      console.error("Error al generar recibo:", error);
      toast.error("Error al generar el recibo. Por favor, intenta nuevamente.");
    }
  };

  const ordenesFiltradas = ordenes.filter((orden) => {
    if (!busqueda.trim()) return true;
    const filtro = busqueda.trim().toLowerCase();
    const nombreCliente = (orden.cliente_nombre || "").toLowerCase();
    const dniCliente = orden.cliente_dni
      ? String(orden.cliente_dni).toLowerCase().replace(/\s/g, "")
      : "";
    return nombreCliente.includes(filtro) || dniCliente.includes(filtro);
  });

  const totalPaginas = Math.max(1, Math.ceil(ordenesFiltradas.length / ORDENES_POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const indiceInicio = (paginaSegura - 1) * ORDENES_POR_PAGINA;
  const ordenesEnPagina = ordenesFiltradas.slice(indiceInicio, indiceInicio + ORDENES_POR_PAGINA);

  useEffect(() => {
    if (paginaActual > totalPaginas && totalPaginas >= 1) {
      setPaginaActual(totalPaginas);
    }
  }, [totalPaginas, paginaActual]);

  return (
    <div className="container-fluid px-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="fw-bold mb-1">Órdenes de Trabajo</h1>
          <p className="text-muted mb-0">
            Gestión y seguimiento de órdenes de trabajo de Guapo Trajes.
          </p>
        </div>
        <button
          className="btn btn-primary d-flex align-items-center gap-2"
          type="button"
          onClick={fetchOrdenes}
        >
          <i className="bi bi-arrow-repeat"></i>
          Actualizar
        </button>
      </div>

      <div className="row g-3 align-items-center mb-4">
        <div className="col-12 col-md-8 col-lg-6">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre del cliente o DNI..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>
      {/* Tabla */}
      {cargando ? (
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-striped table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="text-nowrap">Orden N°</th>
                  <th className="text-nowrap">Presupuesto</th>
                  <th>Cliente</th>
                  <th className="text-nowrap">Fecha Evento</th>
                  <th className="text-end">Saldo Pendiente</th>
                  <th className="text-nowrap">Estado</th>
                  <th className="text-center text-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesEnPagina.length > 0 ? (
                  ordenesEnPagina.map((orden) => (
                    <tr key={orden.id}>
                      <td className="fw-semibold text-nowrap">{orden.id}</td>
                      <td className="text-muted text-uppercase">
                        {orden.presupuesto_numero}
                      </td>
                      <td>{orden.cliente_nombre}</td>
                      <td className="text-nowrap">
                        {format(
                          new Date(orden.fecha_evento + "T00:00:00"),
                          "dd/MM/yyyy",
                          {
                            locale: es,
                          }
                        )}
                      </td>
                      <td className="text-end fw-semibold">
                        ${orden.saldo_pendiente.toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`badge ${getEstadoClass(orden.estado)}`}
                        >
                          {orden.estado}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={async () => {
                              try {
                                // Obtener los datos completos de la orden desde el backend
                                const res = await fetch(
                                  `${getApiBaseUrl()}/ordenes/${orden.id}`,
                                  {
                                    headers: {
                                      Authorization: `Bearer ${localStorage.getItem(
                                        "token"
                                      )}`,
                                    },
                                  }
                                );
                                if (res.ok) {
                                  const ordenCompleta = await res.json();
                                  setOrdenSeleccionada(ordenCompleta);
                                  setShowViewModal(true);
                                  fetchHistorialSeñas(orden.id);
                                  fetchRecibosOrden(orden.id);
                                } else {
                                  setOrdenSeleccionada(orden);
                                  setShowViewModal(true);
                                  fetchHistorialSeñas(orden.id);
                                  fetchRecibosOrden(orden.id);
                                }
                              } catch (error) {
                                console.error(
                                  "Error al obtener orden completa:",
                                  error
                                );
                                setOrdenSeleccionada(orden);
                                setShowViewModal(true);
                                fetchHistorialSeñas(orden.id);
                                fetchRecibosOrden(orden.id);
                              }
                            }}
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            disabled={orden.saldo_pendiente <= 0}
                            title={
                              orden.saldo_pendiente <= 0
                                ? "No hay saldo pendiente; no se pueden agregar más pagos."
                                : "Registrar pago adicional"
                            }
                            onClick={() => {
                              if (orden.saldo_pendiente <= 0) return;
                              setMetodoPagoComplemento(null);
                              setOrdenSeleccionada(orden);
                              setShowPagoModal(true);
                            }}
                          >
                            Pago
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${
                              orden.etiquetas_armado_impresas_at
                                ? "btn-secondary"
                                : "btn-outline-primary"
                            }`}
                            onClick={() => void abrirModalEtiquetasArmado(orden)}
                            disabled={!!orden.etiquetas_armado_impresas_at}
                            title={
                              orden.etiquetas_armado_impresas_at
                                ? "Etiquetas ya impresas al crear la orden"
                                : "Imprimir etiquetas 100×50 para armar"
                            }
                          >
                            <i className="bi bi-printer"></i>
                          </button>
                          <button
                            className={`btn btn-sm ${orden.contrato_generado_at ? "btn-success" : "btn-outline-secondary"}`}
                            onClick={() => generarContratoDesdeFila(orden)}
                            title={
                              orden.contrato_generado_at
                                ? "Contrato generado - Ver en Contratos"
                                : orden.saldo_pendiente !== 0 && esAdmin
                                  ? "Generar contrato (saldo pendiente — solo administrador)"
                                  : "Generar contrato (solo cliente con saldo cero)"
                            }
                          >
                            <i className="bi bi-file-earmark-text"></i>
                          </button>
                          <RoleGate allow={["ADMIN"]}>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => eliminarOrden(orden)}
                              title="Eliminar orden"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </RoleGate>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      No se encontraron órdenes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {ordenesFiltradas.length > ORDENES_POR_PAGINA && (
            <div className="card-footer d-flex flex-wrap align-items-center justify-content-between gap-2 py-3">
              <span className="text-muted small">
                Mostrando {indiceInicio + 1}–{Math.min(indiceInicio + ORDENES_POR_PAGINA, ordenesFiltradas.length)} de {ordenesFiltradas.length} órdenes
              </span>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaSegura <= 1}
                >
                  Anterior
                </button>
                <span className="small text-muted">
                  Página {paginaSegura} de {totalPaginas}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaSegura >= totalPaginas}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {ordenSeleccionada && (
        <Dialog
          open={showPagoModal}
          onOpenChange={(open) => setShowPagoModal(open)}
        >
          <DialogContent
            className="w-full border-0"
            dialogClassName="modal-dialog-centered modal-lg"
            dialogStyle={{ maxWidth: "640px", width: "95%" }}
          >
            <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
              <DialogTitle className="fw-semibold">
                Registrar Pago Adicional
              </DialogTitle>
              <DialogDescription className="mb-0">
                Completa los datos para registrar un pago adicional de la orden.
              </DialogDescription>
            </DialogHeader>

            <div className="modal-body px-3 px-md-4">
              <div className="card shadow-sm mb-4">
                <div className="card-body p-4">
                  <div className="d-flex flex-column gap-2">
                    <div className="d-flex justify-content-between flex-wrap gap-2">
                      <span className="text-muted">Orden seleccionada</span>
                      <strong>#{ordenSeleccionada.id}</strong>
                    </div>
                    <div className="d-flex justify-content-between flex-wrap gap-2">
                      <span className="text-muted">Saldo pendiente actual</span>
                      <strong>
                        ${ordenSeleccionada.saldo_pendiente.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card shadow-sm">
                <div className="card-body p-4">
                  <div className="mb-4">
                    <label className="form-label fw-bold">
                      Monto a registrar
                    </label>
                    <Input
                      type="number"
                      value={montoPago}
                      onChange={(e) => setMontoPago(e.target.value)}
                      min="0.01"
                      max={ordenSeleccionada.saldo_pendiente}
                      step="0.01"
                      placeholder={`Máximo: $${ordenSeleccionada.saldo_pendiente.toLocaleString()}`}
                    />
                    {montoPago &&
                      parseFloat(montoPago) >
                        ordenSeleccionada.saldo_pendiente && (
                        <div className="text-danger small mt-2">
                          El monto no puede exceder el saldo pendiente
                        </div>
                      )}
                  </div>

                  {montoPago && parseFloat(montoPago) > 0 && (
                    <div className="small text-muted mb-3">
                      {(() => {
                        const mt = parseFloat(montoPago);
                        const esCC =
                          metodoPagoId === METODO_PAGO_CUENTA_CORRIENTE_ID &&
                          !!ordenSeleccionada.cliente_id &&
                          saldoClienteCC > 0;
                        const cred = esCC ? Math.min(saldoClienteCC, mt) : 0;
                        const caja = Math.max(mt - cred, 0);
                        return (
                          <ul className="mb-0 ps-3">
                            <li>
                              Desde cuenta corriente:{" "}
                              <strong>
                                ${cred.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </strong>
                            </li>
                            <li>
                              Ingreso en caja:{" "}
                              <strong>
                                ${caja.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </strong>
                            </li>
                          </ul>
                        );
                      })()}
                    </div>
                  )}

                  <MetodoPagoSelector
                    sucursalId={me?.sucursalId}
                    metodoPagoId={metodoPagoId}
                    submetodoPagoId={submetodoPagoId}
                    saldoCuentaCorriente={
                      ordenSeleccionada.cliente_id != null
                        ? saldoClienteCC
                        : null
                    }
                    montoReferencia={
                      montoPago ? parseFloat(montoPago) || null : null
                    }
                    onMetodoChange={(metodoId, submetodoId, metodoDisplay, complemento) => {
                      setMetodoPagoId(metodoId);
                      setSubmetodoPagoId(submetodoId);
                      setMetodoPago(metodoDisplay);
                      setMetodoPagoComplemento(complemento ?? null);
                      if (metodoDisplay && /efectivo/i.test(metodoDisplay.trim())) {
                        const cuentaEfectivo = cuentasDestino.find((c) =>
                          /efectivo/i.test((c.nombre_titular || "").trim())
                        );
                        if (cuentaEfectivo) setCuentaDestinoId(cuentaEfectivo.id);
                      }
                    }}
                    required={true}
                    showError={metodoPagoId == null}
                  />

                  {(() => {
                    const mt = parseFloat(montoPago || "0") || 0;
                    const esCC =
                      metodoPagoId === METODO_PAGO_CUENTA_CORRIENTE_ID &&
                      !!ordenSeleccionada.cliente_id &&
                      saldoClienteCC > 0;
                    const cred = esCC ? Math.min(saldoClienteCC, mt) : 0;
                    const montoCajaUi = Math.max(mt - cred, 0);
                    return montoCajaUi > 1e-6 ? (
                      <div className="mb-4">
                        <label className="form-label fw-bold">
                          Cuenta Destino <span className="text-danger">*</span>
                        </label>
                        <select
                          className="form-select"
                          value={cuentaDestinoId || ""}
                          onChange={(e) =>
                            setCuentaDestinoId(Number(e.target.value) || null)
                          }
                        >
                          <option value="">Seleccionar cuenta destino</option>
                          {cuentasDestino.map((cuenta) => (
                            <option key={cuenta.id} value={cuenta.id}>
                              {cuenta.nombre_titular}
                            </option>
                          ))}
                        </select>
                        {!cuentaDestinoId && (
                          <div className="text-danger small mt-2">
                            Debes seleccionar una cuenta destino
                          </div>
                        )}
                        {cuentasDestino.length === 0 && (
                          <div className="text-warning small mt-2">
                            No hay cuentas destino activas disponibles. Contactá a un administrador.
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="small text-muted mb-4">
                        Si el total se cubre solo con cuenta corriente, no se registra movimiento de
                        caja en esta operación.
                      </p>
                    );
                  })()}

                  <div className="mb-4">
                    <label className="form-label fw-bold">Motivo del recibo</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: Seña, Alquilado, Cancelación..."
                      value={motivoRecibo}
                      onChange={(e) => setMotivoRecibo(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
              <button
                className="btn btn-light border"
                onClick={() => setShowPagoModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={(() => {
                  const mt = parseFloat(montoPago || "0") || 0;
                  const esCC =
                    metodoPagoId === METODO_PAGO_CUENTA_CORRIENTE_ID &&
                    !!ordenSeleccionada.cliente_id &&
                    saldoClienteCC > 0;
                  const cred = esCC ? Math.min(saldoClienteCC, mt) : 0;
                  const montoCajaUi = Math.max(mt - cred, 0);
                  const requiereCaja = montoCajaUi > 1e-6;
                  const faltaComplemento =
                    esCC &&
                    mt > saldoClienteCC + 1e-9 &&
                    !metodoPagoComplemento?.metodoId;
                  return (
                    loadingPago ||
                    !montoPago ||
                    metodoPagoId == null ||
                    mt <= 0 ||
                    mt > ordenSeleccionada.saldo_pendiente ||
                    faltaComplemento ||
                    (requiereCaja && !cuentaDestinoId)
                  );
                })()}
                onClick={registrarPago}
              >
                {loadingPago ? "Guardando..." : "Guardar Pago"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: ¿Imprimir o compartir el recibo? (después de registrar pago) */}
      <Dialog open={!!reciboRecienGenerado} onOpenChange={(open) => !open && setReciboRecienGenerado(null)}>
        <DialogContent className="max-w-md rounded-3">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="mb-2">Recibo generado</DialogTitle>
            <DialogDescription className="mb-0 pe-2">
              ¿Desea imprimir o compartir el recibo por WhatsApp?
            </DialogDescription>
          </DialogHeader>
          {reciboRecienGenerado && (
            <div className="px-4 py-4 space-y-3 small text-muted border-top border-bottom">
              <p className="mb-0 ps-0">Orden N° {reciboRecienGenerado.recibo.orden_id} · {reciboRecienGenerado.recibo.presupuesto_numero}</p>
              <p className="mb-0">{reciboRecienGenerado.recibo.cliente_nombre} · ${reciboRecienGenerado.recibo.monto.toLocaleString("es-AR")} · {reciboRecienGenerado.recibo.motivo}</p>
            </div>
          )}
          <DialogFooter className="gap-3 px-4 py-4">
            <button
              type="button"
              className="btn btn-light border px-4 py-2"
              onClick={() => setReciboRecienGenerado(null)}
            >
              Cerrar
            </button>
            {reciboRecienGenerado && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-secondary px-4 py-2"
                  onClick={() => {
                    imprimirReciboPago(reciboRecienGenerado.recibo);
                  }}
                >
                  Imprimir
                </button>
                <button
                  type="button"
                  className="btn btn-success px-4 py-2"
                  onClick={() => {
                    compartirReciboWhatsApp(
                      reciboRecienGenerado.recibo,
                      reciboRecienGenerado.orden.cliente_celular ?? null
                    );
                  }}
                >
                  <i className="bi bi-whatsapp me-2"></i>
                  Compartir por WhatsApp
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalEtiquetasArmadoAbierto}
        onOpenChange={(open) => {
          if (!open && !imprimiendoEtiquetasArmado) {
            setModalEtiquetasArmadoAbierto(false);
            setOrdenEtiquetasArmado(null);
          }
        }}
      >
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered"
          dialogStyle={{ maxWidth: "480px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3">
            <DialogTitle>Etiquetas para armar (100×50)</DialogTitle>
            <DialogDescription className="mb-0">
              Orden #{ordenEtiquetasArmado?.id} · {ordenEtiquetasArmado?.cliente_nombre}
              <br />
              <span className="small">
                Si imprimís ahora, no podrás reimprimir desde Reportes → Prendas a
                armar.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="modal-body py-3">
            <p className="mb-0 small text-muted">
              {ordenEtiquetasArmado?.productos_reservados?.length ?? 0} prenda(s).
            </p>
          </div>
          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-light border"
              onClick={() => {
                setModalEtiquetasArmadoAbierto(false);
                setOrdenEtiquetasArmado(null);
              }}
              disabled={imprimiendoEtiquetasArmado}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void imprimirEtiquetasArmadoOrden()}
              disabled={imprimiendoEtiquetasArmado}
            >
              {imprimiendoEtiquetasArmado ? (
                <>
                  <i className="bi bi-arrow-clockwise spin me-2"></i>
                  Imprimiendo...
                </>
              ) : (
                <>
                  <i className="bi bi-printer me-2"></i>
                  Imprimir etiquetas
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmarGenerarContratoModal
        open={showConfirmGenerarContrato}
        onOpenChange={(open) => {
          if (!open && !generandoContrato) {
            setShowConfirmGenerarContrato(false);
            setOrdenConfirmarContrato(null);
          }
        }}
        ordenId={ordenConfirmarContrato?.id}
        clienteNombre={ordenConfirmarContrato?.cliente_nombre}
        esReimpresion={reimpresionContrato}
        saldoPendiente={ordenConfirmarContrato?.saldo_pendiente ?? 0}
        esAdmin={esAdmin}
        onConfirm={ejecutarGeneracionContrato}
        loading={generandoContrato}
      />

      {/* Modal: Completar DNI y dirección para generar contrato (precliente o cliente sin datos) */}
      <Dialog open={showModalCompletarContrato} onOpenChange={setShowModalCompletarContrato}>
        <DialogContent className="w-full border-0 p-0 gap-0 overflow-hidden rounded-3" dialogStyle={{ maxWidth: "460px", width: "95%" }}>
          <DialogHeader className="px-4 pt-4 pb-2 border-bottom">
            <DialogTitle className="fw-semibold mb-2">Completar datos para el contrato</DialogTitle>
            <DialogDescription className="text-muted small mb-0 lh-base">
              {ordenParaContrato?.es_precliente
                ? "El contrato requiere cliente con DNI y dirección. Completá los datos para convertir a cliente y generar el contrato."
                : "Completá DNI y dirección del cliente para poder generar el contrato."}
            </DialogDescription>
          </DialogHeader>
          {ordenParaContrato && (
            <div className="px-4 py-4">
              <p className="small text-muted mb-4">
                Orden #{ordenParaContrato.id} · {ordenParaContrato.presupuesto_numero} · {ordenParaContrato.cliente_nombre}
              </p>
              <div className="mb-3">
                <label className="form-label fw-semibold">DNI</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: 12345678"
                  value={dniCompletar}
                  onChange={(e) => setDniCompletar(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label fw-semibold">Dirección</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Calle, número, localidad"
                  value={direccionCompletar}
                  onChange={(e) => setDireccionCompletar(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="px-4 py-4 border-top bg-light gap-3 d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowModalCompletarContrato(false);
                setOrdenParaContrato(null);
                setDniCompletar("");
                setDireccionCompletar("");
              }}
              disabled={procesandoContrato}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={completarDatosYGenerarContrato}
              disabled={procesandoContrato || !dniCompletar.trim() || !direccionCompletar.trim()}
            >
              {procesandoContrato ? (
                <>
                  <i className="bi bi-arrow-clockwise spin me-2"></i>
                  Procesando...
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-text me-2"></i>
                  Completar y generar contrato
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ordenSeleccionada && (
        <Dialog
          open={showViewModal}
          onOpenChange={(open) => {
            setShowViewModal(open);
            if (!open) {
              setModistaProductoId(null);
              setModistaNotasDraft("");
            }
          }}
        >
          <DialogContent
            className="w-full border-0"
            dialogClassName="modal-dialog-centered modal-xl"
            dialogStyle={{ maxWidth: "780px", width: "95%" }}
          >
            <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
              <DialogTitle className="fw-semibold">
                Detalle de Orden #{ordenSeleccionada.id}
              </DialogTitle>
              <DialogDescription className="mb-0">
                Información general de la orden y los productos reservados.
              </DialogDescription>
            </DialogHeader>

            <div className="modal-body px-3 px-md-4">
              <div className="card shadow-sm mb-4">
                <div className="card-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">
                        Presupuesto
                      </span>
                      <span className="fw-semibold text-uppercase">
                        {ordenSeleccionada.presupuesto_numero}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">Cliente</span>
                      <span className="fw-semibold">
                        {ordenSeleccionada.cliente_nombre}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">
                        Fecha del evento
                      </span>
                      <span className="fw-semibold">
                        {format(
                          new Date(
                            ordenSeleccionada.fecha_evento + "T00:00:00"
                          ),
                          "dd/MM/yyyy",
                          {
                            locale: es,
                          }
                        )}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">
                        Fecha de creación
                      </span>
                      <span className="fw-semibold">
                        {ordenSeleccionada.fecha_creacion
                          ? format(
                              new Date(ordenSeleccionada.fecha_creacion),
                              "dd/MM/yyyy",
                              {
                                locale: es,
                              }
                            )
                          : "-"}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">
                        Total del presupuesto
                      </span>
                      <span className="fw-semibold text-success">
                        ${(
                          ordenSeleccionada.total_presupuesto ??
                          ordenSeleccionada.total ??
                          ordenSeleccionada.seña_pagada + ordenSeleccionada.saldo_pendiente
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">
                        Saldo pendiente
                      </span>
                      <span className="fw-semibold text-danger">
                        ${ordenSeleccionada.saldo_pendiente.toLocaleString()}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">Estado</span>
                      <span
                        className={`badge ${getEstadoClass(
                          ordenSeleccionada.estado
                        )}`}
                      >
                        {ordenSeleccionada.estado}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">
                        Método de pago
                      </span>
                      <span className="fw-semibold">
                        {ordenSeleccionada.payment_method ||
                          ordenSeleccionada.metodo_pago ||
                          "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card shadow-sm">
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-semibold mb-0">
                      <i className="bi bi-box-seam me-2 text-primary"></i>
                      Productos de la orden
                    </h6>
                    <span className="badge bg-secondary bg-opacity-25 text-secondary">
                      {ordenSeleccionada.productos_reservados.length} ítem(s)
                    </span>
                  </div>
                  {ordenSeleccionada.productos_reservados.length === 0 ? (
                    <div className="text-muted text-center py-3">
                      No hay productos registrados en esta orden.
                    </div>
                  ) : (
                    <div
                      style={{ maxHeight: "260px", overflowY: "auto" }}
                      className="d-flex flex-column gap-3"
                    >
                      {ordenSeleccionada.productos_reservados.map(
                        (prod, index) => {
                          const esHistorico = productoOrdenEsHistorico(
                            prod,
                            ordenSeleccionada.estado
                          );
                          const badgeClass =
                            prod.estado === "no disponible"
                              ? "bg-danger"
                              : prod.estado === "devuelto"
                                ? "bg-secondary"
                                : prod.estado === "cancelada"
                                  ? "bg-dark"
                                  : "bg-success";
                          return (
                          <div
                            key={`${prod.producto_id}-${index}`}
                            className="border rounded-3 p-3 bg-light"
                          >
                            <div className="d-flex justify-content-between flex-wrap gap-2">
                              <span
                                className={`fw-semibold text-break${
                                  (prod.producto_descripcion?.length ?? 0) > 55
                                    ? " small"
                                    : ""
                                }`}
                              >
                                {prod.producto_descripcion}
                              </span>
                              <span className={`badge ${badgeClass}`}>
                                {prod.estado}
                              </span>
                            </div>
                            <div className="text-muted small mt-2">
                              Bloqueo:{" "}
                              {format(
                                new Date(prod.fecha_bloqueo + "T00:00:00"),
                                "dd/MM/yyyy",
                                { locale: es }
                              )}
                            </div>
                            {prod.observaciones && (
                              <div className="text-muted small mt-1">
                                Observaciones: {prod.observaciones}
                              </div>
                            )}
                            {prod.requiere_modista && (
                              <div className="mt-2 p-2 rounded bg-warning bg-opacity-10 border border-warning border-opacity-25">
                                <span className="badge bg-warning text-dark me-2">
                                  <i className="bi bi-scissors me-1" />
                                  Modista
                                </span>
                                <span className="small">{prod.notas_modista}</span>
                              </div>
                            )}
                            {!esHistorico && (
                            <div className="mt-2 d-flex flex-wrap gap-2 align-items-start">
                              <button
                                type="button"
                                className={`btn btn-sm ${
                                  prod.requiere_modista || modistaProductoId === prod.producto_id
                                    ? "btn-warning"
                                    : "btn-outline-warning"
                                }`}
                                onClick={() => abrirPanelModista(prod)}
                                disabled={guardandoModista}
                              >
                                <i className="bi bi-scissors me-1" />
                                {prod.requiere_modista ? "Editar modista" : "Ir a modista"}
                              </button>
                            </div>
                            )}
                            {!esHistorico && modistaProductoId === prod.producto_id && (
                              <div className="mt-2 border rounded-3 p-3 bg-white">
                                <label className="form-label small fw-semibold mb-1">
                                  Trabajo en modista
                                </label>
                                <textarea
                                  className="form-control form-control-sm"
                                  rows={3}
                                  placeholder="Ej.: achicar mangas, subir cintura..."
                                  value={modistaNotasDraft}
                                  onChange={(e) =>
                                    setModistaNotasDraft(e.target.value)
                                  }
                                  disabled={guardandoModista}
                                />
                                <div className="d-flex flex-wrap gap-2 mt-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-warning"
                                    disabled={guardandoModista}
                                    onClick={() =>
                                      void guardarIndicacionModista(prod, true)
                                    }
                                  >
                                    {guardandoModista ? (
                                      <>
                                        <i className="bi bi-arrow-clockwise spin me-1" />
                                        Guardando...
                                      </>
                                    ) : (
                                      "Guardar"
                                    )}
                                  </button>
                                  {prod.requiere_modista && (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-secondary"
                                      disabled={guardandoModista}
                                      onClick={() =>
                                        void guardarIndicacionModista(prod, false)
                                      }
                                    >
                                      Quitar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-light border"
                                    disabled={guardandoModista}
                                    onClick={() => {
                                      setModistaProductoId(null);
                                      setModistaNotasDraft("");
                                    }}
                                  >
                                    Cerrar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sección de historial de señas */}
              <div className="card shadow-sm mb-4">
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-semibold mb-0">
                      <i className="bi bi-clock-history me-2 text-primary"></i>
                      Historial de Señas
                    </h6>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() =>
                        ordenSeleccionada &&
                        fetchHistorialSeñas(ordenSeleccionada.id)
                      }
                      disabled={cargandoHistorial}
                    >
                      {cargandoHistorial ? (
                        <>
                          <i className="bi bi-arrow-clockwise spin me-1"></i>
                          Cargando...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-arrow-clockwise me-1"></i>
                          Actualizar
                        </>
                      )}
                    </button>
                  </div>
                  {cargandoHistorial ? (
                    <div className="text-center text-muted py-3">
                      <i
                        className="bi bi-arrow-clockwise spin d-block mb-2"
                        style={{ fontSize: "1.5rem" }}
                      ></i>
                      Cargando historial...
                    </div>
                  ) : historialSeñas.length === 0 ? (
                    <div className="text-muted text-center py-3">
                      <i
                        className="bi bi-inbox d-block mb-2"
                        style={{ fontSize: "1.5rem" }}
                      ></i>
                      No hay señas registradas
                    </div>
                  ) : (
                    <div style={{ maxHeight: "300px", overflowY: "auto", fontSize: "0.8rem" }} className="rounded">
                      <div className="table-responsive">
                        <table className="table table-hover mb-0 align-middle">
                          <thead className="table-light sticky-top">
                            <tr>
                              <th className="px-2 py-1 text-nowrap">Fecha</th>
                              <th className="px-2 py-1 text-nowrap">Tipo</th>
                              <th className="px-2 py-1 text-end text-nowrap">Monto</th>
                              <th className="px-2 py-1 text-nowrap" style={{ minWidth: "100px" }}>Método de Pago</th>
                              <th className="px-2 py-1 text-nowrap text-center" style={{ minWidth: "40px" }} title="Usuario">Usuario</th>
                              <th className="px-2 py-1 text-nowrap pe-2" style={{ minWidth: "80px" }}>Destino</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historialSeñas.map((seña, index) => (
                              <tr key={index}>
                                <td className="px-2 py-1 text-nowrap">
                                  {seña.fecha_hora
                                    ? format(
                                        new Date(seña.fecha_hora),
                                        "dd/MM/yyyy HH:mm",
                                        { locale: es }
                                      )
                                    : seña.fecha
                                    ? format(
                                        new Date(seña.fecha),
                                        "dd/MM/yyyy HH:mm",
                                        { locale: es }
                                      )
                                    : "N/A"}
                                </td>
                                <td className="px-2 py-1">
                                  <span
                                    className={`badge ${
                                      seña.tipo === "Seña inicial"
                                        ? "bg-primary"
                                        : "bg-success"
                                    }`}
                                    style={{ fontSize: "0.75rem" }}
                                  >
                                    {seña.tipo}
                                  </span>
                                </td>
                                <td className="text-end fw-semibold text-success px-2 py-1 text-nowrap">
                                  $
                                  {seña.monto.toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-2 py-1">
                                  {labelMetodoPago(seña.metodo_pago || "") || seña.metodo_pago || "N/A"}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className="d-inline-flex align-items-center justify-content-center rounded-circle bg-light text-secondary border"
                                    style={{ width: "26px", height: "26px", cursor: "pointer", fontSize: "0.75rem" }}
                                    title={seña.usuario_nombre ? `Usuario: ${seña.usuario_nombre}` : "Usuario no registrado"}
                                    onClick={() => toast.info(seña.usuario_nombre ? `Usuario: ${seña.usuario_nombre}` : "Usuario no registrado", { duration: 2000 })}
                                    onKeyDown={(e) => e.key === "Enter" && toast.info(seña.usuario_nombre ? `Usuario: ${seña.usuario_nombre}` : "Usuario no registrado", { duration: 2000 })}
                                  >
                                    <i className="bi bi-person-fill" aria-hidden></i>
                                  </span>
                                </td>
                                <td className="text-muted px-2 py-1 pe-2">
                                  {seña.cuenta_destino_nombre || "N/A"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="table-light">
                            <tr>
                              <td colSpan={2} className="fw-bold px-2 py-1 pt-2">
                                Total:
                              </td>
                              <td className="text-end fw-bold text-success px-2 py-1 pt-2">
                                $
                                {historialSeñas
                                  .reduce((sum, seña) => sum + seña.monto, 0)
                                  .toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                              </td>
                              <td colSpan={3} className="px-2 py-1 pt-2"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Historial de recibos (siempre generados por el sistema) */}
              <div className="card shadow-sm mb-4">
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-semibold mb-0">
                      <i className="bi bi-receipt me-2 text-primary"></i>
                      Historial de recibos
                    </h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => ordenSeleccionada && fetchRecibosOrden(ordenSeleccionada.id)}
                      disabled={cargandoRecibos}
                    >
                      {cargandoRecibos ? (
                        <><i className="bi bi-arrow-clockwise spin me-1"></i> Cargando...</>
                      ) : (
                        <><i className="bi bi-arrow-clockwise me-1"></i> Actualizar</>
                      )}
                    </button>
                  </div>
                  {cargandoRecibos ? (
                    <div className="text-center text-muted py-3 small">Cargando recibos...</div>
                  ) : historialRecibos.length === 0 ? (
                    <div className="text-muted text-center py-3 small">No hay recibos registrados</div>
                  ) : (
                    <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                      <ul className="list-group list-group-flush">
                        {historialRecibos.map((recibo: any, index: number) => (
                          <li key={recibo.id ?? `recibo-${index}`} className="list-group-item d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 px-0 border-0 border-bottom">
                            <div className="small">
                              <span className="text-muted">
                                {recibo.fecha_hora ? format(new Date(recibo.fecha_hora), "dd/MM/yyyy HH:mm", { locale: es }) : "N/A"}
                              </span>
                              {" · "}
                              <strong>${Number(recibo.monto).toLocaleString("es-AR")}</strong>
                              {" · "}
                              <span>{recibo.motivo || "Pago"}</span>
                            </div>
                            <div className="d-flex gap-1">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => imprimirReciboPago({
                                  orden_id: ordenSeleccionada!.id,
                                  fecha_hora: recibo.fecha_hora,
                                  monto: recibo.monto,
                                  motivo: recibo.motivo || "Pago",
                                  cliente_nombre: recibo.cliente_nombre,
                                  presupuesto_numero: recibo.presupuesto_numero,
                                })}
                              >
                                Imprimir
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                onClick={() => compartirReciboWhatsApp(
                                  {
                                    orden_id: ordenSeleccionada!.id,
                                    presupuesto_numero: recibo.presupuesto_numero,
                                    cliente_nombre: recibo.cliente_nombre,
                                    fecha_hora: recibo.fecha_hora,
                                    monto: recibo.monto,
                                    motivo: recibo.motivo || "Pago",
                                  },
                                  ordenSeleccionada?.cliente_celular ?? null
                                )}
                              >
                                <i className="bi bi-whatsapp"></i>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Sección de descuento extra para ADMIN */}
              {esAdmin &&
                ordenSeleccionada.extra_discount_percentage &&
                ordenSeleccionada.extra_discount_percentage > 15 && (
                  <div className="card shadow-sm mb-4">
                    <div className="card-body p-4">
                      <div className="alert alert-info mb-0">
                        <h6 className="fw-bold mb-2">
                          <i className="bi bi-info-circle me-2"></i>
                          Descuento Extra Aplicado
                        </h6>
                        <div className="small">
                          {(() => {
                            // Calcular total original antes del descuento
                            const totalConDescuento =
                              ordenSeleccionada.total ||
                              ordenSeleccionada.seña_pagada +
                                ordenSeleccionada.saldo_pendiente;
                            const porcentaje =
                              ordenSeleccionada.extra_discount_percentage || 0;
                            const montoDescontado =
                              ordenSeleccionada.extra_discount_amount || 0;
                            // Calcular total original: total_original = total_final / (1 - porcentaje/100)
                            const totalOriginal =
                              porcentaje < 100
                                ? totalConDescuento / (1 - porcentaje / 100)
                                : totalConDescuento + montoDescontado;

                            return (
                              <>
                                <div className="mb-1">
                                  <strong>Total sin descuento:</strong>{" "}
                                  <span
                                    style={{ textDecoration: "line-through" }}
                                  >
                                    $
                                    {totalOriginal.toLocaleString("es-AR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                <div className="mb-1">
                                  <strong>Total con descuento:</strong>{" "}
                                  <span className="text-success fw-bold">
                                    $
                                    {totalConDescuento.toLocaleString("es-AR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                <div className="mb-1">
                                  <strong>Porcentaje:</strong> {porcentaje}%
                                </div>
                                {montoDescontado > 0 && (
                                  <div className="mb-1">
                                    <strong>Monto descontado:</strong> $
                                    {montoDescontado.toLocaleString("es-AR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          {ordenSeleccionada.extra_discount_reason && (
                            <div className="mb-1">
                              <strong>Motivo:</strong>{" "}
                              {ordenSeleccionada.extra_discount_reason}
                            </div>
                          )}
                          {ordenSeleccionada.extra_discount_applied_by_nombre && (
                            <div className="mb-1">
                              <strong>Aplicado por:</strong>{" "}
                              {
                                ordenSeleccionada.extra_discount_applied_by_nombre
                              }
                            </div>
                          )}
                          {ordenSeleccionada.extra_discount_created_at && (
                            <div className="mb-0">
                              <strong>Fecha:</strong>{" "}
                              {format(
                                new Date(
                                  ordenSeleccionada.extra_discount_created_at
                                ),
                                "dd/MM/yyyy HH:mm",
                                { locale: es }
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
              {(() => {
                const e = (ordenSeleccionada.estado || "").toLowerCase();
                const bloqueada =
                  e === "completada" ||
                  e === "cancelada" ||
                  Boolean(ordenSeleccionada.contrato_generado_at);
                if (bloqueada) return null;
                return (
                  <Link
                    className="btn btn-primary"
                    href={`/presupuestos?editar=${ordenSeleccionada.presupuesto_id}`}
                    onClick={() => {
                      setShowViewModal(false);
                      setHistorialSeñas([]);
                    }}
                  >
                    Editar presupuesto e ítems
                  </Link>
                );
              })()}
              <button
                className="btn btn-light border"
                onClick={() => {
                  setShowViewModal(false);
                  setHistorialSeñas([]);
                }}
              >
                Cerrar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Recibo */}
      <Dialog
        open={mostrarModalRecibo && !!ordenParaRecibo}
        onOpenChange={(open) => !open && setMostrarModalRecibo(false)}
      >
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-sm"
          dialogStyle={{ maxWidth: "400px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-2">
            <DialogTitle className="fw-semibold">
              Recibo de Orden
            </DialogTitle>
          </DialogHeader>

          <div className="modal-body px-3 px-md-4 py-3">
            {ordenParaRecibo && (
              <div className="d-flex flex-column gap-2 text-body">
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Orden N°</span>
                  <strong>#{ordenParaRecibo.id}</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Presupuesto</span>
                  <strong>{ordenParaRecibo.presupuesto_numero}</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Cliente</span>
                  <strong className="text-end" style={{ maxWidth: "60%" }}>
                    {ordenParaRecibo.cliente_nombre}
                  </strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Fecha Evento</span>
                  <strong>
                    {format(
                      new Date(ordenParaRecibo.fecha_evento + "T00:00:00"),
                      "dd/MM/yyyy",
                      { locale: es }
                    )}
                  </strong>
                </div>
                <div className="separator my-3"></div>
                <div className="mt-3">
                  <div className="fw-bold mb-2">Productos:</div>
                  {ordenParaRecibo.productos_reservados &&
                  ordenParaRecibo.productos_reservados.length > 0 ? (
                    <div className="d-flex flex-column gap-1">
                      {ordenParaRecibo.productos_reservados.map(
                        (prod, index) => (
                          <div
                            key={index}
                            className="text-muted small"
                            style={{ fontSize: "0.9rem" }}
                          >
                            {index + 1}. {prod.producto_descripcion}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="text-muted small">Sin productos</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button
              className="btn btn-light border"
              onClick={() => setMostrarModalRecibo(false)}
            >
              Cerrar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => imprimirRecibo()}
            >
              <i className="bi bi-printer me-1"></i>
              Imprimir Recibo
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

export default function OrdenesTrabajoPage() {
  return (
    <Suspense
      fallback={
        <div className="container py-4 d-flex justify-content-center align-items-center min-vh-50">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      }
    >
      <OrdenesTrabajoContent />
    </Suspense>
  );
}
