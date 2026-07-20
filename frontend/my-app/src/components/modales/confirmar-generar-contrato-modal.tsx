"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoneyAr } from "@/lib/money";
import type { FirmanteContratoPayload } from "@/lib/contrato-locatario";

type ConfirmarGenerarContratoModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordenId?: number | null;
  clienteNombre?: string | null;
  /** Snapshot previo si la orden ya tenía firmante anexado */
  firmanteInicial?: FirmanteContratoPayload | null;
  esReimpresion?: boolean;
  saldoPendiente?: number;
  esAdmin?: boolean;
  onConfirm: (firmante: FirmanteContratoPayload | null) => void | Promise<void>;
  loading?: boolean;
};

const FIRMANTE_VACIO = {
  nombre: "",
  dni: "",
  direccion: "",
  celular: "",
};

export function ConfirmarGenerarContratoModal({
  open,
  onOpenChange,
  ordenId,
  clienteNombre,
  firmanteInicial = null,
  esReimpresion = false,
  saldoPendiente = 0,
  esAdmin = false,
  onConfirm,
  loading = false,
}: ConfirmarGenerarContratoModalProps) {
  const [anexarFirmante, setAnexarFirmante] = useState(false);
  const [firmante, setFirmante] = useState(FIRMANTE_VACIO);
  const [errorFirmante, setErrorFirmante] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const tieneInicial = Boolean((firmanteInicial?.nombre || "").trim());
    setAnexarFirmante(tieneInicial);
    setFirmante(
      tieneInicial
        ? {
            nombre: firmanteInicial?.nombre || "",
            dni: firmanteInicial?.dni || "",
            direccion: firmanteInicial?.direccion || "",
            celular: firmanteInicial?.celular || "",
          }
        : { ...FIRMANTE_VACIO }
    );
    setErrorFirmante(null);
  }, [open, firmanteInicial]);

  const handleConfirm = () => {
    if (!anexarFirmante) {
      void onConfirm(null);
      return;
    }
    const nombre = firmante.nombre.trim();
    const dni = firmante.dni.trim();
    const direccion = firmante.direccion.trim();
    const celular = firmante.celular.trim();
    if (!nombre || !dni || !direccion) {
      setErrorFirmante("Completá nombre, DNI y domicilio del firmante.");
      return;
    }
    setErrorFirmante(null);
    void onConfirm({
      nombre,
      dni,
      direccion,
      celular: celular || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full border-0 p-0 gap-0 overflow-hidden rounded-3"
        dialogStyle={{ maxWidth: "480px", width: "95%" }}
      >
        <DialogHeader className="px-4 pt-4 pb-2 border-bottom">
          <DialogTitle className="fw-semibold mb-2">Generar contrato</DialogTitle>
          <DialogDescription className="text-muted small mb-0 lh-base">
            <span className="d-block mb-2 fw-medium text-body">
              ¿Estás seguro que deseas generar el contrato?
            </span>
            {ordenId != null && (
              <span className="d-block mb-2">
                Orden #{ordenId}
                {clienteNombre ? ` · ${clienteNombre}` : ""}
              </span>
            )}
            {esReimpresion
              ? "Este contrato ya fue generado. Al confirmar solo se abrirá nuevamente para imprimir."
              : "Al confirmar dejará de aparecer en Prendas a armar y quedará registrado en Contratos."}
          </DialogDescription>
          {saldoPendiente > 0 && esAdmin && (
            <div
              className="alert alert-warning border-warning py-2 px-3 mx-4 mb-0 mt-2 small d-flex align-items-start gap-2"
              role="alert"
              style={{ backgroundColor: "#fff8e1", color: "#7a5c00" }}
            >
              <i
                className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"
                aria-hidden
              />
              <span>
                Esta orden tiene un saldo pendiente de{" "}
                <strong>{formatMoneyAr(saldoPendiente)}</strong>. Solo podés
                generar el contrato porque sos administrador.
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="px-4 py-3 border-bottom">
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="anexar-firmante-contrato"
              checked={anexarFirmante}
              disabled={loading}
              onChange={(e) => {
                setAnexarFirmante(e.target.checked);
                setErrorFirmante(null);
              }}
            />
            <label
              className="form-check-label small"
              htmlFor="anexar-firmante-contrato"
            >
              Anexar firmante distinto (quien retira / responde por el
              alquiler)
            </label>
          </div>
          <p className="small text-muted mb-0">
            Por defecto firma el cliente de la orden. Marcá esta opción solo
            cuando otra persona retira o firma el pagaré.
          </p>

          {anexarFirmante && (
            <div className="mt-3">
              <div className="mb-2">
                <label className="form-label small fw-semibold mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={firmante.nombre}
                  disabled={loading}
                  onChange={(e) =>
                    setFirmante((f) => ({ ...f, nombre: e.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold mb-1">DNI</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={firmante.dni}
                  disabled={loading}
                  onChange={(e) =>
                    setFirmante((f) => ({ ...f, dni: e.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-semibold mb-1">
                  Domicilio
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={firmante.direccion}
                  disabled={loading}
                  onChange={(e) =>
                    setFirmante((f) => ({ ...f, direccion: e.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
              <div className="mb-0">
                <label className="form-label small fw-semibold mb-1">
                  Celular{" "}
                  <span className="fw-normal text-muted">(pagaré)</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={firmante.celular}
                  disabled={loading}
                  onChange={(e) =>
                    setFirmante((f) => ({ ...f, celular: e.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
              {errorFirmante && (
                <p className="text-danger small mb-0 mt-2">{errorFirmante}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-4 py-4 border-top bg-light gap-3 d-flex justify-content-end">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="bi bi-arrow-clockwise spin me-2"></i>
                Generando...
              </>
            ) : (
              <>
                <i className="bi bi-file-earmark-text me-2"></i>
                Sí, generar contrato
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
