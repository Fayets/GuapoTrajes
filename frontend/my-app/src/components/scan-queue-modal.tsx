"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  GUAPO_PRESUPUESTO_IMPORT_PAYLOAD,
  GUAPO_VENTA_IMPORT_PAYLOAD,
  type ScanQueueRow,
} from "@/lib/scan-queue";

type ScanQueueModalProps = {
  open: boolean;
  onClose: () => void;
  items: ScanQueueRow[];
  onClearAll: () => void;
  onRemoveLine: (productoId: number) => void;
  onLoteCambiarEstado: (
    estado: "LAVANDERIA" | "MODISTA"
  ) => Promise<{ ok: boolean; message?: string }>;
};

export function ScanQueueModal({
  open,
  onClose,
  items,
  onClearAll,
  onRemoveLine,
  onLoteCambiarEstado,
}: ScanQueueModalProps) {
  const router = useRouter();
  const [busyEstado, setBusyEstado] = useState(false);

  const n = items.length;

  const irAPresupuesto = () => {
    if (items.length === 0) {
      toast.error("La cola está vacía.");
      return;
    }
    try {
      sessionStorage.setItem(
        GUAPO_PRESUPUESTO_IMPORT_PAYLOAD,
        JSON.stringify({ items })
      );
    } catch {
      toast.error("No se pudo preparar el envío a Presupuestos.");
      return;
    }
    onClose();
    router.push("/presupuestos");
  };

  const irAVenta = () => {
    if (items.length === 0) {
      toast.error("La cola está vacía.");
      return;
    }
    try {
      sessionStorage.setItem(
        GUAPO_VENTA_IMPORT_PAYLOAD,
        JSON.stringify({ items })
      );
    } catch {
      toast.error("No se pudo preparar el envío a Ventas.");
      return;
    }
    onClose();
    router.push("/ventas");
  };

  const ejecutarEstado = async (estado: "LAVANDERIA" | "MODISTA") => {
    if (items.length === 0 || busyEstado) return;
    setBusyEstado(true);
    try {
      const r = await onLoteCambiarEstado(estado);
      if (!r.ok) {
        toast.error(r.message || "No se pudo actualizar el estado.");
        return;
      }
      toast.success(
        estado === "LAVANDERIA"
          ? "Estado actualizado a lavandería."
          : "Estado actualizado a modista."
      );
      onClose();
    } finally {
      setBusyEstado(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal fade show d-block scan-queue-modal"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-queue-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h5" id="scan-queue-modal-title">
              Cola de escaneo
            </h2>
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar"
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            <p className="text-muted small mb-3">
              En el <strong>Dashboard</strong>, cada escaneo agrega una prenda
              única a la cola; volver a escanear el mismo código la quita.
              Elegí qué hacer con la lista.
            </p>
            {items.length === 0 ? (
              <p className="text-muted mb-0">No hay prendas en la cola.</p>
            ) : (
              <ul className="list-group list-group-flush border rounded">
                {items.map((row) => (
                  <li
                    key={row.productoId}
                    className="list-group-item d-flex flex-column flex-md-row align-items-md-center gap-2"
                  >
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-medium text-truncate">
                        {row.descripcion}
                      </div>
                      <div className="small text-muted font-monospace">
                        {row.codigoBarra || `ID ${row.productoId}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger align-self-md-center"
                      onClick={() => onRemoveLine(row.productoId)}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="modal-footer flex-wrap gap-2">
            <span className="me-auto text-muted small">
              {n === 0
                ? "Sin prendas"
                : `${n} prenda${n === 1 ? "" : "s"}`}
            </span>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                if (items.length === 0) return;
                if (
                  typeof window !== "undefined" &&
                  !window.confirm("¿Vaciar toda la cola?")
                ) {
                  return;
                }
                onClearAll();
                toast.success("Cola vaciada.");
              }}
              disabled={items.length === 0}
            >
              Vaciar cola
            </button>
            <button
              type="button"
              className="btn btn-info text-white"
              disabled={items.length === 0 || busyEstado}
              onClick={() => void ejecutarEstado("LAVANDERIA")}
            >
              Lavandería
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={items.length === 0 || busyEstado}
              onClick={() => void ejecutarEstado("MODISTA")}
            >
              Modista
            </button>
            <button
              type="button"
              className="btn btn-warning"
              disabled={items.length === 0}
              onClick={irAVenta}
            >
              Venta
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={irAPresupuesto}
              disabled={items.length === 0}
            >
              Ir a Presupuesto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
