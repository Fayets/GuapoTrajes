"use client";

import type React from "react";
import { useState, useEffect, useMemo } from "react";
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

// Tipos
type ProductoReservado = {
  producto_id: number;
  producto_descripcion: string;
  estado: string;
  fecha_bloqueo: string;
  observaciones?: string;
};

type OrdenTrabajo = {
  id: number;
  presupuesto_id: number;
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

  const { token } = useAuth();

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

  // Filtrar órdenes abiertas por DNI o ID de contrato
  const ordenesAbiertasFiltradas = useMemo(() => {
    if (!filtroBusqueda.trim()) {
      return ordenesAbiertas;
    }
    const filtro = filtroBusqueda.trim().toLowerCase();
    return ordenesAbiertas.filter((orden) => {
      // Convertir DNI a string y normalizar
      const dniCliente = orden.cliente_dni 
        ? String(orden.cliente_dni).toLowerCase().replace(/\s/g, "")
        : "";
      // Convertir ID de contrato a string
      const idContrato = String(orden.id || "").toLowerCase();
      // Buscar coincidencias
      return dniCliente.includes(filtro) || idContrato.includes(filtro);
    });
  }, [ordenesAbiertas, filtroBusqueda]);

  const generarContrato = async (orden: OrdenTrabajo) => {
    if (!orden || orden.saldo_pendiente !== 0) {
      toast.error("Solo se pueden generar contratos de órdenes con saldo pendiente cero");
      return;
    }

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

      // Obtener día y mes de la fecha de creación
      const fechaCreacionDate = orden.fecha_creacion
        ? new Date(orden.fecha_creacion)
        : new Date();
      const dia = fechaCreacionDate.getDate();
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
      const mes = meses[fechaCreacionDate.getMonth()];
      const año = fechaCreacionDate.getFullYear();

      // Calcular días de vigencia
      const fechaEventoDate = orden.fecha_evento
        ? new Date(orden.fecha_evento + "T00:00:00")
        : new Date();
      const diasVigencia = Math.max(
        1,
        Math.ceil(
          (fechaEventoDate.getTime() - fechaCreacionDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      // Precio total del alquiler (para la tercera vigencia)
      // Usar total_presupuesto que es el total original del presupuesto
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
      const listaPrendas = orden.productos_reservados
        .map((prod, index) => `${index + 1}. ${prod.producto_descripcion}`)
        .join("<br>");

      // Fecha de vencimiento del pagaré
      const fechaVencimiento = new Date(fechaCreacionDate);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
      const diaVencimiento = fechaVencimiento.getDate();
      const mesVencimiento = meses[fechaVencimiento.getMonth()];
      const añoVencimiento = fechaVencimiento.getFullYear();

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
            vertical-align: baseline;
            word-break: keep-all;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Contrato Alquiler de Prendas de Vestir</h1>
        <div class="numero-contrato">ID Contrato: ${idContrato}</div>
    </div>

    <div class="clausula">
        <span class="texto-continuo">Entre <strong>Schmira Ariel Fernando</strong>, local Guapo Trajes, por una parte, en adelante <strong>EL LOCADOR</strong>, y <span class="underline">${clienteNombre}</span>, DNI <span class="underline">${clienteDNI}</span>, con domicilio en <span class="underline">${clienteDireccion}</span> de la Ciudad de La Rioja, por la otra parte, en adelante <strong>EL LOCATARIO</strong>, convienen de común acuerdo en celebrar el presente contrato, el que se regirá por las siguientes cláusulas, sin perjuicio de la de Ley, a saber:</span>
    </div>

    <div class="clausula">
        <strong>PRIMERA: OBJETO</strong><br>
        EL LOCADOR da en locación al LOCATARIO las prendas que se detallan:
        <div class="lista-prendas">
            ${listaPrendas || "No hay prendas especificadas"}
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
        <div style="margin-bottom: 8px;">
            <div style="margin-bottom: 2px;">Firma: <span class="underline"></span></div>
            <div>D.N.I.: <span class="underline"></span></div>
        </div>
    </div>

    <div class="pagare">
        <div class="header">
            <h1>PAGARÉ</h1>
        </div>
        <div class="clausula">
            La Rioja, <span class="underline">${dia}</span> de ${mes} de ${año}. Vence el <span class="underline">${diaVencimiento}</span> de <span class="underline">${mesVencimiento}</span> de ${añoVencimiento}. Pagaré $ <span class="underline">${valorPagareFormateado}</span> Sin Protesto (Art. 50 D. Ley 5965/63). A señor Schmira Ariel Fernando o a su orden. La cantidad de pesos <span class="underline">${valorPagareFormateado}</span>. Por igual valor recibido en prendas de vestir a su entera satisfacción. Pagadero en Santiago del Estero 83 de la Ciudad de La Rioja.
            <div style="margin-top: 8px;">
                <div style="margin-bottom: 3px;">Firmante: <span class="underline">${firmante}</span></div>
                <div style="margin-bottom: 3px;">Aclaración: <span class="underline">${aclaracion}</span></div>
                <div>Celular: <span class="underline">${celular}</span></div>
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

      const ventanaContrato = window.open("", "_blank", "width=900,height=1200");
      if (ventanaContrato) {
        ventanaContrato.document.write(contenidoContrato);
        ventanaContrato.document.close();
      } else {
        toast.error("Por favor, permite ventanas emergentes para generar el contrato");
      }
    } catch (error) {
      console.error("Error al generar contrato:", error);
      toast.error("Error al generar el contrato. Por favor, intenta nuevamente.");
    }
  };

  const handleCompletada = async () => {
    if (!ordenSeleccionada) return;
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
        `${getApiBaseUrl()}/ordenes/${ordenSeleccionada.id}/completar-devolucion`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            destino: destinoEstado,
            lavanderia_id: destinoEstado === "LAVANDERIA" ? lavanderiaId : null,
            modista_id: destinoEstado === "MODISTA" ? modistaId : null,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          error.detail || error.message || "Error al completar devolución"
        );
      }

      const result = await res.json();
      if (result.success) {
        toast.success("Devolución completada correctamente");
        setShowCompletadaModal(false);
        setOrdenSeleccionada(null);
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
    setOrdenSeleccionada(orden);
    setShowCompletadaModal(true);
  };

  const abrirModalParcial = (orden: OrdenTrabajo) => {
    setOrdenSeleccionada(orden);
    setPrendasSeleccionadas([]);
    setDescripcionParcial("");
    setShowParcialModal(true);
  };

  return (
    <div className="p-3 p-md-4">
      <div className="mb-4">
        <h1 className="fw-bold">Devoluciones</h1>
        <p className="text-muted">
          Gestiona las devoluciones de órdenes de trabajo abiertas
        </p>
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
        <div className="card">
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
              <div className="row">
                <div className="col-md-6">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar por DNI del cliente o ID de contrato..."
                    value={filtroBusqueda}
                    onChange={(e) => setFiltroBusqueda(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover">
                <thead className="table-light">
                  <tr>
                    <th>Orden ID</th>
                    <th>Presupuesto</th>
                    <th>Cliente</th>
                    <th>Fecha Evento</th>
                    <th>Fecha Devolución</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesAbiertasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        <i className="bi bi-search me-2"></i>
                        No se encontraron órdenes que coincidan con la búsqueda
                      </td>
                    </tr>
                  ) : (
                    ordenesAbiertasFiltradas.map((orden) => {
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

                    return (
                      <tr key={orden.id}>
                        <td className="fw-semibold">{orden.id}</td>
                        <td className="text-uppercase">
                          {orden.presupuesto_numero}
                        </td>
                        <td>{orden.cliente_nombre}</td>
                        <td>{fechaEventoFormateada}</td>
                        <td>{fechaDevolucionFormateada}</td>
                        <td className="text-center">
                          <div className="btn-group" role="group">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                setOrdenSeleccionada(orden);
                                generarContrato(orden);
                              }}
                              title="Ver contrato"
                            >
                              <i className="bi bi-file-text me-1"></i>
                              Contrato
                            </button>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => abrirModalCompletada(orden)}
                              title="Marcar como completada"
                            >
                              <i className="bi bi-check-circle me-1"></i>
                              Completada
                            </button>
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => abrirModalParcial(orden)}
                              title="Devolución parcial"
                            >
                              <i className="bi bi-clipboard-check me-1"></i>
                              Parcial
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Completada */}
      <Dialog open={showCompletadaModal} onOpenChange={setShowCompletadaModal}>
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-lg"
          dialogStyle={{ maxWidth: "520px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
            <DialogTitle className="fw-semibold">Confirmar Devolución Completa</DialogTitle>
            <DialogDescription className="mb-0">
              ¿Estás seguro de que deseas marcar esta orden como devolución
              completada?
            </DialogDescription>
          </DialogHeader>
          <div className="modal-body px-3 px-md-4">
            {ordenSeleccionada && (
              <>
                <div className="mb-3">
                  <p>
                    <strong>Orden:</strong> #{ordenSeleccionada.id}
                  </p>
                  <p>
                    <strong>Presupuesto:</strong> {ordenSeleccionada.presupuesto_numero}
                  </p>
                  <p>
                    <strong>Cliente:</strong> {ordenSeleccionada.cliente_nombre}
                  </p>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Destino de las prendas</label>
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
                  <div className="mb-3">
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
                  <div className="mb-3">
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
              </>
            )}
          </div>
          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowCompletadaModal(false);
                setOrdenSeleccionada(null);
                setDestinoEstado("SALON");
                setLavanderiaId(null);
                setModistaId(null);
              }}
              disabled={procesando}
            >
              Cancelar
            </button>
            <button
              className="btn btn-success"
              onClick={handleCompletada}
              disabled={procesando}
            >
              {procesando ? (
                <>
                  <i className="bi bi-arrow-clockwise spin me-2"></i>
                  Procesando...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  Confirmar
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
            <DialogTitle className="fw-semibold">Devolución Parcial</DialogTitle>
            <DialogDescription className="mb-0">
              Selecciona las prendas que se devuelven y describe el motivo
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
                    Descripción del motivo (por qué está incompleta o en revisión):
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={descripcionParcial}
                    onChange={(e) => setDescripcionParcial(e.target.value)}
                    placeholder="Ej: La camisa tiene una mancha que requiere revisión y posible lavado..."
                  />
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

