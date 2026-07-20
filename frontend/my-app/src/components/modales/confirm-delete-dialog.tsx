"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
        dialogStyle={{ maxWidth: "440px", width: "95%" }}
      >
        <DialogHeader className="px-4 pt-4 pb-2 border-bottom">
          <DialogTitle className="fw-semibold mb-2">{title}</DialogTitle>
          <DialogDescription className="text-muted small mb-0 lh-base">
            <span className="d-block mb-2 fw-medium text-body">
              ¿Está seguro que desea eliminar {itemLabel}?
            </span>
            {description ? (
              <span className="d-block text-muted">{description}</span>
            ) : null}
          </DialogDescription>
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
