"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ej. "la orden #12", "el cliente Ana Gomez" */
  itemLabel: string;
  /** Texto extra debajo (efectos colaterales, etc.) */
  description?: string | null;
  onConfirm: () => void;
  loading?: boolean;
  title?: string;
  confirmLabel?: string;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  itemLabel,
  description,
  onConfirm,
  loading = false,
  title = "Confirmar eliminación",
  confirmLabel = "Eliminar",
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next);
      }}
    >
      <DialogContent
        className="w-full border-0 p-0 gap-0 overflow-hidden rounded-3"
        dialogClassName="modal-dialog-centered"
        dialogStyle={{ maxWidth: "480px", width: "95%" }}
      >
        <DialogHeader className="px-4 pt-4 pb-3 border-bottom">
          <DialogTitle className="fw-semibold mb-0">{title}</DialogTitle>
        </DialogHeader>

        <div className="modal-body px-4 py-4">
          <p className="mb-0 fw-medium text-body lh-base">
            ¿Está seguro que desea eliminar {itemLabel}?
          </p>
          {description ? (
            <p className="text-muted small mb-0 mt-3 lh-base">{description}</p>
          ) : null}
        </div>

        <DialogFooter className="px-4 py-3 border-top bg-light gap-2 d-flex flex-wrap justify-content-end">
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
            className="btn btn-danger"
            onClick={() => onConfirm()}
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="bi bi-arrow-clockwise spin me-2" aria-hidden />
                Eliminando...
              </>
            ) : (
              <>
                <i className="bi bi-trash me-2" aria-hidden />
                {confirmLabel}
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
