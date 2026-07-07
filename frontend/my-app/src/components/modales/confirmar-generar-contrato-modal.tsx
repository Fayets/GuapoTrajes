"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmarGenerarContratoModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordenId?: number | null;
  clienteNombre?: string | null;
  esReimpresion?: boolean;
  saldoPendiente?: number;
  esAdmin?: boolean;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
};

export function ConfirmarGenerarContratoModal({
  open,
  onOpenChange,
  ordenId,
  clienteNombre,
  esReimpresion = false,
  saldoPendiente = 0,
  esAdmin = false,
  onConfirm,
  loading = false,
}: ConfirmarGenerarContratoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full border-0 p-0 gap-0 overflow-hidden rounded-3"
        dialogStyle={{ maxWidth: "440px", width: "95%" }}
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
                <strong>
                  ${saldoPendiente.toLocaleString("es-AR")}
                </strong>
                . Solo podés generar el contrato porque sos administrador.
              </span>
            </div>
          )}
        </DialogHeader>
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
            onClick={() => void onConfirm()}
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
