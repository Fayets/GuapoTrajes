"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Tipos

type ProductoReservado = {
  producto_id: number;
  estado: string;
  fecha_bloqueo: string;
  observaciones?: string;
};

type OrdenTrabajo = {
  id: number;
  presupuesto_id: number;
  fecha_evento: string;
  fecha_creacion: string;
  seña_pagada: number;
  saldo_pendiente: number;
  estado: string;
  productos_reservados: ProductoReservado[];
};

export default function OrdenesTrabajoPage() {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [ordenSeleccionada, setOrdenSeleccionada] =
    useState<OrdenTrabajo | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [loadingPago, setLoadingPago] = useState(false);

  useEffect(() => {
    fetchOrdenes();
  }, []);

  const fetchOrdenes = async () => {
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/ordenes-trabajo/ordenes/ordenes-trabajo",
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
    }
  };

  const registrarPago = async () => {
    if (!ordenSeleccionada || !montoPago || !metodoPago) return;
    setLoadingPago(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/pagos/adicional", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          presupuesto_id: ordenSeleccionada.presupuesto_id,
          monto: parseFloat(montoPago),
          metodo_pago: metodoPago,
        }),
      });

      if (!res.ok) throw new Error("Error al registrar el pago");

      await fetchOrdenes();
      setShowPagoModal(false);
      setMontoPago("");
      setMetodoPago("");
    } catch (err) {
      alert("Error al guardar el pago");
    } finally {
      setLoadingPago(false);
    }
  };

  const ordenesFiltradas = ordenes.filter((orden) => {
    return (
      orden.id.toString().includes(busqueda) ||
      orden.presupuesto_id.toString().includes(busqueda) ||
      orden.estado.toLowerCase().includes(busqueda.toLowerCase())
    );
  });

  const getEstadoClass = (estado: string) => {
    switch (estado) {
      case "completada":
        return "bg-success";
      case "en_progreso":
        return "bg-primary";
      case "pendiente":
        return "bg-warning";
      case "cancelada":
        return "bg-danger";
      default:
        return "bg-secondary";
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="fw-bold">Órdenes de Trabajo</h1>
        <input
          type="search"
          className="form-control w-auto"
          placeholder="Buscar..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Orden N°</th>
                <th>Presupuesto</th>
                <th>Fecha Evento</th>
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
                    <td>{orden.presupuesto_id}</td>
                    <td>
                      {format(new Date(orden.fecha_evento), "dd/MM/yyyy", {
                        locale: es,
                      })}
                    </td>
                    <td>${orden.saldo_pendiente.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${getEstadoClass(orden.estado)}`}>
                        {orden.estado}
                      </span>
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
                  <td colSpan={6} className="text-center text-muted py-4">
                    No se encontraron órdenes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Método de pago</label>
                  <input
                    type="text"
                    className="form-control"
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                  />
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
                  disabled={loadingPago}
                  onClick={registrarPago}
                >
                  Guardar Pago
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
                  {ordenSeleccionada.presupuesto_id}
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
                      Producto #{prod.producto_id} - Estado: {prod.estado} -
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
