"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
  payment_method: string;  // Cambiado de metodo_pago
  productos_reservados: ProductoReservado[];
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
        "http://127.0.0.1:8000/ordenes/",
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!res.ok) throw new Error("Error al obtener órdenes");

      const data = await res.json();
      setOrdenes(data);
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
      const res = await fetch(`http://127.0.0.1:8000/ordenes/${ordenSeleccionada.id}/pagar-saldo`, {
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
    } catch (err) {
      alert(`Error al guardar el pago: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoadingPago(false);
    }
  };

  const ordenesFiltradas = ordenes.filter((orden) => {
    const matchesBusqueda = (
      orden.id.toString().includes(busqueda) ||
      orden.presupuesto_id.toString().includes(busqueda) ||
      orden.estado.toLowerCase().includes(busqueda.toLowerCase())
    );

    const matchesFiltroMetodoPago =
      filtroMetodoPago === "" || orden.payment_method === filtroMetodoPago;

    return matchesBusqueda && matchesFiltroMetodoPago;
  });

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-0">Órdenes de Trabajo</h1>
        </div>
        <div className="d-flex gap-2">
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por orden, presupuesto o estado..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
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
      <p className="text-muted">Gestión y seguimiento de Ordenes de Trabajo de Guapo Trajes</p>
      {/* Tabla */}
      {cargando ? (
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Orden N°</th>
                  <th>Presupuesto</th>
                  <th>Cliente</th>
                  <th>Fecha Evento</th>
                  <th>Seña Pagada</th>
                  <th>Saldo Pendiente</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesFiltradas.length > 0 ? (
                  ordenesFiltradas.map((orden) => (
                    <tr key={orden.id}>
                      <td>{orden.id}</td>
                      <td>{orden.presupuesto_numero}</td>
                      <td>{orden.cliente_nombre}</td>
                      <td>
                        {format(new Date(orden.fecha_evento), "dd/MM/yyyy", {
                          locale: es,
                        })}
                      </td>
                      <td>${orden.seña_pagada.toLocaleString()}</td>
                      <td>${orden.saldo_pendiente.toLocaleString()}</td>
                      <td>
                        <span
                          className={`badge ${getEstadoClass(orden.estado)}`}
                        >
                          {orden.estado}
                        </span>
                      </td>
                      <td className="text-center">
                        {metodosPago.find(m => m.value === orden.payment_method)?.label || orden.payment_method}
                      </td>
                      <td className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => {
                            setOrdenSeleccionada(orden);
                            setShowViewModal(true);
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

      {showPagoModal && ordenSeleccionada && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Registrar Pago Adicional</h5>
                <button
                  className="btn-close"
                  onClick={() => setShowPagoModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p>
                  <strong>Orden:</strong> #{ordenSeleccionada.id}
                </p>
                <p>
                  <strong>Saldo pendiente actual:</strong> $
                  {ordenSeleccionada.saldo_pendiente.toLocaleString()}
                </p>
                <div className="mb-3">
                  <label className="form-label">Monto</label>
                  <input
                    type="number"
                    className="form-control"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value)}
                    min="0.01"
                    max={ordenSeleccionada.saldo_pendiente}
                    step="0.01"
                    placeholder={`Máximo: $${ordenSeleccionada.saldo_pendiente.toLocaleString()}`}
                  />
                  {montoPago && parseFloat(montoPago) > ordenSeleccionada.saldo_pendiente && (
                    <div className="text-sm text-red-500 mt-1">
                      El monto no puede exceder el saldo pendiente
                    </div>
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label">Método de pago</label>
                  <div className="space-y-2">
                    {metodosPago.map((metodo) => (
                      <div
                        key={metodo.value}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          metodoPago === metodo.value
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setMetodoPago(metodo.value)}
                      >
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="metodoPago"
                            value={metodo.value}
                            checked={metodoPago === metodo.value}
                            onChange={() => setMetodoPago(metodo.value)}
                            className="mr-3"
                          />
                          <span className="font-medium">{metodo.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!metodoPago && (
                    <div className="text-sm text-red-500 mt-2">
                      Debes seleccionar un método de pago
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowPagoModal(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  disabled={loadingPago || !montoPago || !metodoPago || parseFloat(montoPago) <= 0}
                  onClick={registrarPago}
                >
                  {loadingPago ? "Guardando..." : "Guardar Pago"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showViewModal && ordenSeleccionada && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Detalle Orden #{ordenSeleccionada.id}
                </h5>
                <button
                  className="btn-close"
                  onClick={() => setShowViewModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p>
                  <strong>Presupuesto:</strong>{" "}
                  {ordenSeleccionada.presupuesto_numero}
                </p>
                <p>
                  <strong>Cliente:</strong>{" "}
                  {ordenSeleccionada.cliente_nombre}
                </p>
                <p>
                  <strong>Evento:</strong>{" "}
                  {format(
                    new Date(ordenSeleccionada.fecha_evento),
                    "dd/MM/yyyy",
                    { locale: es }
                  )}
                </p>
                <p>
                  <strong>Seña pagada:</strong> $
                  {ordenSeleccionada.seña_pagada.toLocaleString()}
                </p>
                <p>
                  <strong>Saldo pendiente:</strong> $
                  {ordenSeleccionada.saldo_pendiente.toLocaleString()}
                </p>
                <hr />
                <h6>Productos reservados:</h6>
                <ul>
                  {ordenSeleccionada.productos_reservados.map((prod, index) => (
                    <li
                      key={index}
                      className={
                        prod.estado === "no disponible" ? "text-danger" : ""
                      }
                    >
                      {prod.producto_descripcion} - Estado: {prod.estado} -
                      Bloqueo:{" "}
                      {format(new Date(prod.fecha_bloqueo), "dd/MM/yyyy", {
                        locale: es,
                      })}{" "}
                      {prod.observaciones && ` - Obs: ${prod.observaciones}`}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowViewModal(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
