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
      const res = await fetch(
        `${getApiBaseUrl()}/ordenes/`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

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
      const res = await fetch(`${getApiBaseUrl()}/ordenes/${ordenSeleccionada.id}/pagar-saldo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          monto_pagado: parseFloat(montoPago),
          payment_method: metodoPago,  // Cambiado a payment_method
        }),
      });

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
      alert(`Error al guardar el pago: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoadingPago(false);
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

  const ordenesFiltradas = ordenes.filter((orden) => {
    const matchesBusqueda = (
      orden.id.toString().includes(busqueda) ||
      orden.presupuesto_id.toString().includes(busqueda) ||
      orden.estado.toLowerCase().includes(busqueda.toLowerCase())
    );

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
                      <td className="text-muted text-uppercase">{orden.presupuesto_numero}</td>
                      <td>{orden.cliente_nombre}</td>
                      <td className="text-nowrap">
                        {format(new Date(orden.fecha_evento), "dd/MM/yyyy", {
                          locale: es,
                        })}
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
                        {metodosPago.find((m) => m.value === orden.payment_method)?.label ||
                          metodosPago.find((m) => m.value === orden.metodo_pago)?.label ||
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
                                    Authorization: `Bearer ${localStorage.getItem("token")}`,
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
                              console.error("Error al obtener orden completa:", error);
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
        <Dialog open={showPagoModal} onOpenChange={(open) => setShowPagoModal(open)}>
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
                        $
                        {ordenSeleccionada.saldo_pendiente.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card shadow-sm">
                <div className="card-body p-4">
                  <div className="mb-4">
                    <label className="form-label fw-bold">Monto a registrar</label>
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
        <Dialog open={showViewModal} onOpenChange={(open) => setShowViewModal(open)}>
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
                      <span className="text-muted small d-block">Presupuesto</span>
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
                      <span className="text-muted small d-block">Fecha del evento</span>
                      <span className="fw-semibold">
                        {format(new Date(ordenSeleccionada.fecha_evento), "dd/MM/yyyy", {
                          locale: es,
                        })}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">Fecha de creación</span>
                      <span className="fw-semibold">
                        {ordenSeleccionada.fecha_creacion
                          ? format(new Date(ordenSeleccionada.fecha_creacion), "dd/MM/yyyy", {
                              locale: es,
                            })
                          : "-"}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">Seña pagada</span>
                      <span className="fw-semibold text-success">
                        ${ordenSeleccionada.seña_pagada.toLocaleString()}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">Saldo pendiente</span>
                      <span className="fw-semibold text-danger">
                        ${ordenSeleccionada.saldo_pendiente.toLocaleString()}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">Estado</span>
                      <span className={`badge ${getEstadoClass(ordenSeleccionada.estado)}`}>
                        {ordenSeleccionada.estado}
                      </span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="text-muted small d-block">Método de pago</span>
                      <span className="fw-semibold">
                        {metodosPago.find((m) => m.value === (ordenSeleccionada.payment_method ?? ordenSeleccionada.metodo_pago))?.label ||
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
                    <div style={{ maxHeight: "260px", overflowY: "auto" }} className="d-flex flex-column gap-3">
                      {ordenSeleccionada.productos_reservados.map((prod, index) => (
                        <div
                          key={`${prod.producto_id}-${index}`}
                          className="border rounded-3 p-3 bg-light"
                        >
                          <div className="d-flex justify-content-between flex-wrap gap-2">
                            <span className="fw-semibold">{prod.producto_descripcion}</span>
                            <span
                              className={`badge ${
                                prod.estado === "no disponible" ? "bg-danger" : "bg-success"
                              }`}
                            >
                              {prod.estado}
                            </span>
                          </div>
                          <div className="text-muted small mt-2">
                            Bloqueo: {format(new Date(prod.fecha_bloqueo), "dd/MM/yyyy", { locale: es })}
                          </div>
                          {prod.observaciones && (
                            <div className="text-muted small mt-1">
                              Observaciones: {prod.observaciones}
                            </div>
                          )}
                        </div>
                      ))}
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
                      onClick={() => ordenSeleccionada && fetchHistorialSeñas(ordenSeleccionada.id)}
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
                      <i className="bi bi-arrow-clockwise spin d-block mb-2" style={{ fontSize: "1.5rem" }}></i>
                      Cargando historial...
                    </div>
                  ) : historialSeñas.length === 0 ? (
                    <div className="text-muted text-center py-3">
                      <i className="bi bi-inbox d-block mb-2" style={{ fontSize: "1.5rem" }}></i>
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
                                    ? format(new Date(seña.fecha_hora), "dd/MM/yyyy HH:mm", { locale: es })
                                    : seña.fecha
                                    ? format(new Date(seña.fecha), "dd/MM/yyyy HH:mm", { locale: es })
                                    : "N/A"}
                                </td>
                                <td>
                                  <span className={`badge ${
                                    seña.tipo === "Seña inicial" ? "bg-primary" : "bg-success"
                                  }`}>
                                    {seña.tipo}
                                  </span>
                                </td>
                                <td className="text-end fw-semibold text-success">
                                  ${seña.monto.toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="small">
                                  {metodosPago.find((m) => m.value === seña.metodo_pago)?.label ||
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
              {esAdmin && ordenSeleccionada.extra_discount_percentage && ordenSeleccionada.extra_discount_percentage > 15 && (
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
                          const totalConDescuento = ordenSeleccionada.total || (ordenSeleccionada.seña_pagada + ordenSeleccionada.saldo_pendiente);
                          const porcentaje = ordenSeleccionada.extra_discount_percentage || 0;
                          const montoDescontado = ordenSeleccionada.extra_discount_amount || 0;
                          // Calcular total original: total_original = total_final / (1 - porcentaje/100)
                          const totalOriginal = porcentaje < 100 
                            ? totalConDescuento / (1 - porcentaje / 100)
                            : totalConDescuento + montoDescontado;
                          
                          return (
                            <>
                              <div className="mb-1">
                                <strong>Total sin descuento:</strong>{" "}
                                <span style={{ textDecoration: "line-through" }}>
                                  ${totalOriginal.toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                              <div className="mb-1">
                                <strong>Total con descuento:</strong>{" "}
                                <span className="text-success fw-bold">
                                  ${totalConDescuento.toLocaleString("es-AR", {
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
                                  <strong>Monto descontado:</strong> ${montoDescontado.toLocaleString("es-AR", {
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
                            <strong>Motivo:</strong> {ordenSeleccionada.extra_discount_reason}
                          </div>
                        )}
                        {ordenSeleccionada.extra_discount_applied_by_nombre && (
                          <div className="mb-1">
                            <strong>Aplicado por:</strong> {ordenSeleccionada.extra_discount_applied_by_nombre}
                          </div>
                        )}
                        {ordenSeleccionada.extra_discount_created_at && (
                          <div className="mb-0">
                            <strong>Fecha:</strong> {format(new Date(ordenSeleccionada.extra_discount_created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
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
