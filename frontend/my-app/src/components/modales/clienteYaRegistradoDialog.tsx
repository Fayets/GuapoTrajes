"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  etiquetaClienteExistente,
  type ClienteExistenteInfo,
} from "@/lib/cliente-existente";

type Props = {
  open: boolean;
  cliente: ClienteExistenteInfo | null;
  mensaje?: string | null;
  confianza?: string | null;
  procesando?: boolean;
  onCancel: () => void;
  onContinuar: () => void;
};

export function ClienteYaRegistradoDialog({
  open,
  cliente,
  mensaje,
  confianza,
  procesando,
  onCancel,
  onContinuar,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="w-full border-0" dialogClassName="modal-dialog-centered">
        <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
          <DialogTitle className="fw-semibold mb-0">Cliente ya registrado</DialogTitle>
          <DialogDescription className="mb-0">
            {mensaje ||
              "Esta persona ya está cargada como cliente. Podés continuar con ese registro para no duplicar."}
          </DialogDescription>
        </DialogHeader>
        <div className="modal-body px-3 px-md-4">
          {cliente && (
            <p className="mb-1">
              <strong>{etiquetaClienteExistente(cliente)}</strong>
            </p>
          )}
          {confianza === "solo_celular" && (
            <p className="text-warning small mb-0">
              El celular coincide, pero el nombre no es exactamente el mismo. Confirmá que
              sea la misma persona.
            </p>
          )}
        </div>
        <DialogFooter className="border-top pt-3 d-flex flex-wrap justify-content-end gap-2 px-3 px-md-4 pb-2">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={procesando}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={onContinuar} disabled={procesando}>
            Continuar con este cliente
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
