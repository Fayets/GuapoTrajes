"use client";

import type React from "react";
import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { RoleGate } from "@/components/RoleGate";

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
};

export default function OrdenesTrabajoPage() {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroMetodoPago, setFiltroMetodoPago] = useState("");
  const [ordenSeleccionada, setOrdenSeleccionada] =
    useState<OrdenTrabajo | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [loadingPago, setLoadingPago] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [historialSeñas, setHistorialSeñas] = useState<any[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const { me } = useAuth();
  const esAdmin = me?.role === "ADMIN";

  // Métodos de pago consistentes con ventas
  const metodosPago = [
    { value: "EFECTIVO", label: "Efectivo" },
    { value: "DEBITO", label: "Débito" },
    { value: "CREDITO", label: "Crédito" },
    { value: "BILLETERA_VIRTUAL", label: "Billetera Virtual" },
    { value: "TRANSFERENCIA", label: "Transferencia" },
  ];

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
        return "bg-warning";
      default:
        return "bg-secondary";
    }
  };

  useEffect(() => {
    fetchOrdenes();
  }, []);

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
    } finally {
      setCargando(false);
    }
  };

  const registrarPago = async () => {
    if (!ordenSeleccionada || !montoPago || !metodoPago) return;
    setLoadingPago(true);

    try {
      const res = await fetch(
        `${getApiBaseUrl()}/ordenes/${ordenSeleccionada.id}/pagar-saldo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            monto_pagado: parseFloat(montoPago),
            payment_method: metodoPago, // Cambiado a payment_method
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Error al registrar el pago");
      }

      const resultado = await res.json();
      alert("Pago registrado exitosamente");

      await fetchOrdenes();
      setShowPagoModal(false);
      setMontoPago("");
      setMetodoPago("");

      // Actualizar historial si el modal de detalle está abierto
      if (ordenSeleccionada && showViewModal) {
        await fetchHistorialSeñas(ordenSeleccionada.id);
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

  const generarContrato = () => {
    if (!ordenSeleccionada || ordenSeleccionada.saldo_pendiente !== 0) {
      return;
    }

    // Obtener información de la orden
    const numeroContrato = ordenSeleccionada.presupuesto_numero.padStart(
      6,
      "0"
    );
    const clienteNombre = ordenSeleccionada.cliente_nombre || "";
    const clienteDNI = ordenSeleccionada.cliente_dni || "____________________";
    const clienteDireccion =
      ordenSeleccionada.cliente_direccion || "__________________________";
    const fechaEvento = ordenSeleccionada.fecha_evento
      ? format(
          new Date(ordenSeleccionada.fecha_evento + "T00:00:00"),
          "dd/MM/yyyy",
          { locale: es }
        )
      : "";
    const fechaCreacion = ordenSeleccionada.fecha_creacion
      ? format(new Date(ordenSeleccionada.fecha_creacion), "dd/MM/yyyy", {
          locale: es,
        })
      : format(new Date(), "dd/MM/yyyy", { locale: es });

    // Obtener día y mes de la fecha de creación
    const fechaCreacionDate = ordenSeleccionada.fecha_creacion
      ? new Date(ordenSeleccionada.fecha_creacion)
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

    // Calcular días de vigencia (diferencia entre fecha evento y fecha creación)
    const fechaEventoDate = ordenSeleccionada.fecha_evento
      ? new Date(ordenSeleccionada.fecha_evento + "T00:00:00")
      : new Date();
    const diasVigencia = Math.max(
      1,
      Math.ceil(
        (fechaEventoDate.getTime() - fechaCreacionDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    // Precio total
    const precioTotal =
      ordenSeleccionada.total ||
      ordenSeleccionada.seña_pagada + ordenSeleccionada.saldo_pendiente;
    const precioFormateado = precioTotal.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Precio por día de prórroga (aproximadamente 10% del total por día)
    const precioPorDia = Math.ceil(precioTotal * 0.1);
    const precioPorDiaFormateado = precioPorDia.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Lista de prendas
    const listaPrendas = ordenSeleccionada.productos_reservados
      .map((prod, index) => `${index + 1}. ${prod.producto_descripcion}`)
      .join("<br>");

    // Fecha de vencimiento del pagaré (30 días después de la fecha de creación)
    const fechaVencimiento = new Date(fechaCreacionDate);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
    const diaVencimiento = fechaVencimiento.getDate();
    const mesVencimiento = meses[fechaVencimiento.getMonth()];
    const añoVencimiento = fechaVencimiento.getFullYear();

    const celular =
      ordenSeleccionada.cliente_celular || "___________________________";

    const contenidoContrato = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrato de Alquiler - ${numeroContrato}</title>
    <style>
        @media print {
            @page {
                size: A4;
                margin: 0.8cm;
            }
            body { 
                margin: 0;
                padding: 0;
            }
            .no-print { display: none; }
        }
        body {
            font-family: 'Times New Roman', serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 10px;
            line-height: 1.3;
            font-size: 9pt;
        }
        .header {
            text-align: center;
            margin-bottom: 8px;
        }
        .header h1 {
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 3px;
        }
        .numero-contrato {
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 6px;
        }
        .clausula {
            margin-bottom: 6px;
            text-align: justify;
        }
        .clausula strong {
            font-weight: bold;
        }
        .lista-prendas {
            margin: 3px 0;
            padding-left: 12px;
            font-size: 8.5pt;
        }
        .firma {
            margin-top: 10px;
            border-top: 1px solid #000;
            padding-top: 6px;
        }
        .pagare {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid #000;
        }
        .pagare .header {
            margin-bottom: 6px;
        }
        .pagare .header h1 {
            font-size: 10pt;
        }
        .botones {
            text-align: center;
            margin-top: 15px;
        }
        button {
            padding: 8px 16px;
            margin: 0 8px;
            font-size: 14px;
            cursor: pointer;
        }
        .underline {
            border-bottom: 1px solid #000;
            display: inline-block;
            min-width: 120px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Contrato Alquiler de Prendas de Vestir</h1>
        <div class="numero-contrato">N° ${numeroContrato}</div>
    </div>

    <div class="clausula">
        Entre <strong>Schmira Ariel Fernando</strong>, local <strong>Guapo</strong>, por una parte, en adelante <strong>EL LOCADOR</strong>,
        y <span class="underline">${clienteNombre}</span>, DNI <span class="underline">${clienteDNI}</span>, con domicilio en <span class="underline">${clienteDireccion}</span> de la Ciudad de La Rioja, por la otra parte, en adelante <strong>EL LOCATARIO</strong>, convienen de común acuerdo en celebrar el presente contrato, el que se regirá por las siguientes cláusulas, sin perjuicio de la de Ley, a saber:
    </div>

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
        El presente contrato tendrá una vigencia de <span class="underline">${diasVigencia}</span> días corridos a partir de la firma del mismo. El plazo de la locación quedará automáticamente prorrogado a su vencimiento, hasta la real restitución de la totalidad de las prendas. Las mismas deberán ser devueltas en el local Guapo sito en Santiago del Estero 83 de la ciudad de La Rioja.
    </div>

    <div class="clausula">
        <strong>TERCERA: PRECIO</strong><br>
        El precio pactado de común acuerdo del presente contrato se fija en PESOS $ <span class="underline">${precioFormateado}</span>. El pago deberá integrarse en un 100% antes del retiro de las prendas del local Guapo. La prórroga obliga al LOCATARIO a abonar la suma de pesos $ <span class="underline">${precioPorDiaFormateado}</span> por día, hasta la restitución del total de las prendas al LOCADOR. En garantía de la totalidad de las prendas alquiladas se firma un pagaré de aval, presente al pie, el cual integra y es parte del presente contrato.
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
            <div>D.N.I.: <span class="underline">${clienteDNI}</span></div>
        </div>
    </div>

    <div class="pagare">
        <div class="header">
            <h1>PAGARÉ</h1>
        </div>
        <div class="clausula">
            La Rioja, <span class="underline">${dia}</span> de ${mes} de ${año}. Vence el <span class="underline">${diaVencimiento}</span> de <span class="underline">${mesVencimiento}</span> de ${añoVencimiento}. Pagaré $ <span class="underline">${precioFormateado}</span> Sin Protesto (Art. 50 D. Ley 5965/63). A señor Schmira Ariel Fernando o a su orden. La cantidad de pesos <span class="underline">${precioFormateado}</span>. Por igual valor recibido en prendas de vestir a su entera satisfacción. Pagadero en Santiago del Estero 83 de la Ciudad de La Rioja.
            <div style="margin-top: 8px;">
                <div style="margin-bottom: 3px;">Firmante: <span class="underline"></span></div>
                <div style="margin-bottom: 3px;">Aclaración: <span class="underline">${clienteNombre}</span></div>
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
      alert(
        "No se pudo abrir la ventana de contrato. Asegúrate de no tener bloqueadores de pop-ups."
      );
    }
  };

  const ordenesFiltradas = ordenes.filter((orden) => {
    const matchesBusqueda =
      orden.id.toString().includes(busqueda) ||
      orden.presupuesto_id.toString().includes(busqueda) ||
      orden.estado.toLowerCase().includes(busqueda.toLowerCase());

    const metodoOrden = orden.payment_method ?? orden.metodo_pago ?? "";
    const matchesFiltroMetodoPago =
      filtroMetodoPago === "" || metodoOrden === filtroMetodoPago;

    return matchesBusqueda && matchesFiltroMetodoPago;
  });

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
        <div className="col-12 col-md-6 col-lg-4">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por orden, presupuesto o estado..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="col-12 col-md-4 col-lg-3 ms-md-auto">
          <select
            className="form-select"
            value={filtroMetodoPago}
            onChange={(e) => setFiltroMetodoPago(e.target.value)}
          >
            <option value="">Todos los métodos</option>
            {metodosPago.map((metodo) => (
              <option key={metodo.value} value={metodo.value}>
                {metodo.label}
              </option>
            ))}
          </select>
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
                  <th className="text-end">Seña Pagada</th>
                  <th className="text-end">Saldo Pendiente</th>
                  <th className="text-nowrap">Estado</th>
                  <th className="text-center text-nowrap">Método de Pago</th>
                  <th className="text-center text-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesFiltradas.length > 0 ? (
                  ordenesFiltradas.map((orden) => (
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
                      <td className="text-end">
                        ${orden.seña_pagada.toLocaleString()}
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
                      <td className="text-center text-muted">
                        {metodosPago.find(
                          (m) => m.value === orden.payment_method
                        )?.label ||
                          metodosPago.find((m) => m.value === orden.metodo_pago)
                            ?.label ||
                          orden.payment_method ||
                          orden.metodo_pago ||
                          "-"}
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
                                  // Cargar historial de señas
                                  fetchHistorialSeñas(orden.id);
                                } else {
                                  // Si falla, usar los datos de la lista como fallback
                                  setOrdenSeleccionada(orden);
                                  setShowViewModal(true);
                                  fetchHistorialSeñas(orden.id);
                                }
                              } catch (error) {
                                console.error(
                                  "Error al obtener orden completa:",
                                  error
                                );
                                // Si falla, usar los datos de la lista como fallback
                                setOrdenSeleccionada(orden);
                                setShowViewModal(true);
                                fetchHistorialSeñas(orden.id);
                              }
                            }}
                          >
                            Ver
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => {
                              setOrdenSeleccionada(orden);
                              setShowPagoModal(true);
                            }}
                          >
                            Pago
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
                    <td colSpan={9} className="text-center text-muted py-4">
                      No se encontraron órdenes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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

                  <div>
                    <label className="form-label fw-bold">Método de pago</label>
                    <div className="row g-3 mt-1">
                      {metodosPago.map((metodo) => {
                        const activo = metodoPago === metodo.value;
                        return (
                          <div className="col-12 col-md-6" key={metodo.value}>
                            <div
                              className={`border rounded-3 p-3 h-100 d-flex align-items-center gap-3 transition ${
                                activo
                                  ? "border-primary bg-primary bg-opacity-10"
                                  : "border-light bg-white"
                              }`}
                              role="button"
                              onClick={() => setMetodoPago(metodo.value)}
                              style={{ cursor: "pointer" }}
                            >
                              <div className="form-check m-0">
                                <input
                                  type="radio"
                                  name="metodoPago"
                                  value={metodo.value}
                                  checked={activo}
                                  onChange={() => setMetodoPago(metodo.value)}
                                  className="form-check-input"
                                />
                              </div>
                              <div>
                                <span className="fw-semibold d-block">
                                  {metodo.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!metodoPago && (
                      <div className="text-danger small mt-3">
                        Debes seleccionar un método de pago
                      </div>
                    )}
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
                disabled={
                  loadingPago ||
                  !montoPago ||
                  !metodoPago ||
                  parseFloat(montoPago) <= 0
                }
                onClick={registrarPago}
              >
                {loadingPago ? "Guardando..." : "Guardar Pago"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {ordenSeleccionada && (
        <Dialog
          open={showViewModal}
          onOpenChange={(open) => setShowViewModal(open)}
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
                        Seña pagada
                      </span>
                      <span className="fw-semibold text-success">
                        ${ordenSeleccionada.seña_pagada.toLocaleString()}
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
                        {metodosPago.find(
                          (m) =>
                            m.value ===
                            (ordenSeleccionada.payment_method ??
                              ordenSeleccionada.metodo_pago)
                        )?.label ||
                          ordenSeleccionada.payment_method ||
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
                      Productos reservados
                    </h6>
                    <span className="badge bg-secondary bg-opacity-25 text-secondary">
                      {ordenSeleccionada.productos_reservados.length} ítem(s)
                    </span>
                  </div>
                  {ordenSeleccionada.productos_reservados.length === 0 ? (
                    <div className="text-muted text-center py-3">
                      No hay productos reservados.
                    </div>
                  ) : (
                    <div
                      style={{ maxHeight: "260px", overflowY: "auto" }}
                      className="d-flex flex-column gap-3"
                    >
                      {ordenSeleccionada.productos_reservados.map(
                        (prod, index) => (
                          <div
                            key={`${prod.producto_id}-${index}`}
                            className="border rounded-3 p-3 bg-light"
                          >
                            <div className="d-flex justify-content-between flex-wrap gap-2">
                              <span className="fw-semibold">
                                {prod.producto_descripcion}
                              </span>
                              <span
                                className={`badge ${
                                  prod.estado === "no disponible"
                                    ? "bg-danger"
                                    : "bg-success"
                                }`}
                              >
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
                          </div>
                        )
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
                    <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                      <div className="table-responsive">
                        <table className="table table-sm table-hover mb-0">
                          <thead className="table-light sticky-top">
                            <tr>
                              <th>Fecha</th>
                              <th>Tipo</th>
                              <th className="text-end">Monto</th>
                              <th>Método de Pago</th>
                              <th>Usuario</th>
                              <th>Sucursal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historialSeñas.map((seña, index) => (
                              <tr key={index}>
                                <td className="small">
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
                                <td>
                                  <span
                                    className={`badge ${
                                      seña.tipo === "Seña inicial"
                                        ? "bg-primary"
                                        : "bg-success"
                                    }`}
                                  >
                                    {seña.tipo}
                                  </span>
                                </td>
                                <td className="text-end fw-semibold text-success">
                                  $
                                  {seña.monto.toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="small">
                                  {metodosPago.find(
                                    (m) => m.value === seña.metodo_pago
                                  )?.label ||
                                    seña.metodo_pago ||
                                    "N/A"}
                                </td>
                                <td className="small text-muted">
                                  {seña.usuario_nombre || "N/A"}
                                </td>
                                <td className="small text-muted">
                                  {seña.sucursal_nombre || "N/A"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="table-light">
                            <tr>
                              <td colSpan={2} className="fw-bold">
                                Total:
                              </td>
                              <td className="text-end fw-bold text-success">
                                $
                                {historialSeñas
                                  .reduce((sum, seña) => sum + seña.monto, 0)
                                  .toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                              </td>
                              <td colSpan={3}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
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

            <DialogFooter className="border-top pt-3 d-flex justify-content-between gap-2 px-3 px-md-4 pb-2">
              <button
                className="btn btn-outline-primary"
                onClick={generarContrato}
                disabled={ordenSeleccionada.saldo_pendiente !== 0}
                title={
                  ordenSeleccionada.saldo_pendiente !== 0
                    ? "El saldo pendiente debe ser cero para generar el contrato"
                    : "Generar contrato de alquiler"
                }
              >
                <i className="bi bi-file-earmark-text me-2"></i>
                Contrato
              </button>
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
