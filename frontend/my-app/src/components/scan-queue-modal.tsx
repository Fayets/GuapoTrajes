"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  GUAPO_PRESUPUESTO_IMPORT_PAYLOAD,
  GUAPO_VENTA_IMPORT_PAYLOAD,
  type ScanQueueRow,
} from "@/lib/scan-queue";
import type { RemitoImpresionRow } from "@/lib/imprimir-remito-envio";

export type ModistaOption = { id: string; nombre: string };
export type LavanderiaOption = { id: string; nombre: string };

type ScanQueueModalProps = {
  open: boolean;
  onClose: () => void;
  items: ScanQueueRow[];
  onClearAll: () => void;
  onRemoveLine: (productoId: number) => void;
  modistas: ModistaOption[];
  lavanderias: LavanderiaOption[];
  onLoteCambiarEstado: (
    estado: "LAVANDERIA" | "MODISTA",
    opts: { lavanderiaId?: number; modistaId?: number }
  ) => Promise<{ ok: boolean; message?: string; remitos?: RemitoImpresionRow[] }>;
};

type Paso = "lista" | "destino";

export function ScanQueueModal({
  open,
  onClose,
  items,
  onClearAll,
  onRemoveLine,
  modistas,
  lavanderias,
  onLoteCambiarEstado,
}: ScanQueueModalProps) {
  const router = useRouter();
  const [busyEstado, setBusyEstado] = useState(false);
  const [paso, setPaso] = useState<Paso>("lista");
  const [destinoTipo, setDestinoTipo] = useState<"LAVANDERIA" | "MODISTA" | null>(
    null
  );
  const [destinoSeleccionId, setDestinoSeleccionId] = useState("");

  const n = items.length;

  const resetPasoDestino = () => {
    setPaso("lista");
    setDestinoTipo(null);
    setDestinoSeleccionId("");
  };

  useEffect(() => {
    if (!open) {
      setPaso("lista");
      setDestinoTipo(null);
      setDestinoSeleccionId("");
      setBusyEstado(false);
    }
  }, [open]);

  const irAPasoDestino = (tipo: "LAVANDERIA" | "MODISTA") => {
    if (items.length === 0) return;
    if (tipo === "LAVANDERIA") {
      if (!lavanderias.length) {
        toast.error("No hay lavanderías cargadas. Revisá la sección Lavandería.");
        return;
      }
      setDestinoSeleccionId(lavanderias[0]?.id ?? "");
    } else {
      if (!modistas.length) {
        toast.error("No hay modistas cargadas. Revisá la sección Modistas.");
        return;
      }
      setDestinoSeleccionId(modistas[0]?.id ?? "");
    }
    setDestinoTipo(tipo);
    setPaso("destino");
  };

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
    resetPasoDestino();
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
    resetPasoDestino();
    onClose();
    router.push("/ventas");
  };

  const confirmarEnvioExterno = async () => {
    if (!destinoTipo || items.length === 0 || busyEstado) return;
    const idNum = Number(destinoSeleccionId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      toast.error("Elegí un destino válido.");
      return;
    }
    setBusyEstado(true);
    try {
      const r = await onLoteCambiarEstado(
        destinoTipo,
        destinoTipo === "LAVANDERIA"
          ? { lavanderiaId: idNum }
          : { modistaId: idNum }
      );
      if (!r.ok) {
        toast.error(r.message || "No se pudo actualizar el estado.");
        return;
      }
      toast.success(
        destinoTipo === "LAVANDERIA"
          ? "Prendas enviadas a lavandería."
          : "Prendas enviadas a modista."
      );
      resetPasoDestino();
      onClose();
    } finally {
      setBusyEstado(false);
    }
  };

  if (!open) return null;

  const tituloPaso =
    paso === "destino" && destinoTipo === "LAVANDERIA"
      ? "Paso 2 — Lavandería"
      : paso === "destino" && destinoTipo === "MODISTA"
        ? "Paso 2 — Modista"
        : "Cola de escaneo";

  return (
    <div
      className="modal fade show d-block scan-queue-modal"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-queue-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busyEstado) onClose();
      }}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h5" id="scan-queue-modal-title">
              {tituloPaso}
            </h2>
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar"
              disabled={busyEstado}
              onClick={() => {
                if (!busyEstado) {
                  resetPasoDestino();
                  onClose();
                }
              }}
            />
          </div>
          <div className="modal-body">
            {paso === "lista" ? (
              <>
                <p className="text-muted small mb-3">
                  En el <strong>Dashboard</strong>, cada escaneo agrega una prenda
                  única a la cola; volver a escanear el mismo código la quita.
                  Elegí qué hacer con la lista. Para <strong>lavandería</strong> o{" "}
                  <strong>modista</strong>, el siguiente paso permite elegir el
                  destino; al confirmar se abrirá el remito para imprimir o guardar
                  como PDF.
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
              </>
            ) : (
              <>
                <p className="text-muted small mb-3">
                  Confirmá el destino para las <strong>{n}</strong> prenda
                  {n === 1 ? "" : "s"} de la cola. Luego se actualizará el estado y
                  se abrirá el remito administrativo para imprimir.
                </p>
                <div className="mb-3">
                  <label className="form-label fw-bold" htmlFor="sq-destino-select">
                    {destinoTipo === "LAVANDERIA" ? "Lavandería" : "Modista"}
                  </label>
                  <select
                    id="sq-destino-select"
                    className="form-select"
                    value={destinoSeleccionId}
                    onChange={(e) => setDestinoSeleccionId(e.target.value)}
                    disabled={busyEstado}
                  >
                    {(destinoTipo === "LAVANDERIA" ? lavanderias : modistas).map(
                      (x) => (
                        <option key={x.id} value={x.id}>
                          {x.nombre}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer flex-wrap gap-2">
            {paso === "lista" ? (
              <>
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
                  onClick={() => irAPasoDestino("LAVANDERIA")}
                >
                  Lavandería…
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={items.length === 0 || busyEstado}
                  onClick={() => irAPasoDestino("MODISTA")}
                >
                  Modista…
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
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-outline-secondary me-auto"
                  disabled={busyEstado}
                  onClick={() => resetPasoDestino()}
                >
                  ← Volver
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    busyEstado ||
                    !destinoSeleccionId ||
                    !Number.isFinite(Number(destinoSeleccionId)) ||
                    Number(destinoSeleccionId) <= 0
                  }
                  onClick={() => void confirmarEnvioExterno()}
                >
                  {busyEstado ? "Procesando…" : "Confirmar y generar remito"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
