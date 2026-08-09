"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  asignarProductoAModistaStock,
  descripcionProductoModista,
  enviarProductoModistaDesdeOrden,
  fetchModistas,
  imprimirStickerModista,
  itemEtiquetaModistaOrden,
  itemEtiquetaModistaStock,
  type ModistaOption,
  type ProductoModistaStock,
} from "@/lib/enviar-modista-utils";

export type EnviarModistaOrdenContext = {
  tipo: "orden";
  ordenId: number;
  producto: {
    producto_id: number;
    producto_descripcion: string;
    codigo_barra?: string;
    notas_modista?: string;
  };
  clienteNombre: string;
  clienteDni?: string | null;
  clienteCelular?: string | null;
  fechaRetiro?: string | null;
};

export type EnviarModistaStockContext = {
  tipo: "stock";
  productos: ProductoModistaStock[];
};

export type EnviarModistaContext =
  | EnviarModistaOrdenContext
  | EnviarModistaStockContext;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contexto: EnviarModistaContext | null;
  token: string | null;
  onSuccess?: (info?: { notas?: string }) => void;
};

export function EnviarModistaDialog({
  open,
  onOpenChange,
  contexto,
  token,
  onSuccess,
}: Props) {
  const [modistas, setModistas] = useState<ModistaOption[]>([]);
  const [modistaId, setModistaId] = useState<number | "">("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    void fetchModistas(token).then(setModistas);
  }, [open, token]);

  useEffect(() => {
    if (!open || !contexto) return;
    setModistaId("");
    if (contexto.tipo === "orden") {
      setNotas(contexto.producto.notas_modista || "");
    } else {
      setNotas("");
    }
  }, [open, contexto]);

  const cerrar = () => {
    if (guardando) return;
    onOpenChange(false);
  };

  const confirmar = async () => {
    if (!token || !contexto) return;
    const mid = modistaId === "" ? 0 : Number(modistaId);
    const notasTrim = notas.trim();
    if (!mid) {
      toast.error("Seleccioná una modista");
      return;
    }
    if (!notasTrim) {
      toast.error("Indicá qué trabajo debe realizarse en la prenda");
      return;
    }

    setGuardando(true);
    try {
      if (contexto.tipo === "stock") {
        const etiquetas = [];
        for (const p of contexto.productos) {
          const r = await asignarProductoAModistaStock(token, mid, p.id, notasTrim);
          if (!r.ok) {
            toast.error(r.message || `Error con ${descripcionProductoModista(p)}`);
            return;
          }
          etiquetas.push(itemEtiquetaModistaStock(p, notasTrim));
        }
        const imp = await imprimirStickerModista(etiquetas);
        if (!imp.ok) {
          toast.error(imp.message || "Enviado, pero falló la impresión del sticker");
        } else {
          toast.success(
            contexto.productos.length === 1
              ? "Enviado a modista e impreso sticker"
              : `${contexto.productos.length} prendas enviadas e impresas`
          );
        }
      } else {
        const prod = contexto.producto;
        const r = await enviarProductoModistaDesdeOrden(
          token,
          contexto.ordenId,
          prod.producto_id,
          mid,
          notasTrim
        );
        if (!r.ok) {
          toast.error(r.message || "No se pudo enviar a modista");
          return;
        }
        const imp = await imprimirStickerModista([
          itemEtiquetaModistaOrden({
            codigoBarra: prod.codigo_barra || String(prod.producto_id),
            prendaDescripcion: prod.producto_descripcion,
            notas: notasTrim,
            clienteNombre: contexto.clienteNombre,
            clienteDni: contexto.clienteDni,
            clienteCelular: contexto.clienteCelular,
            fechaRetiro: contexto.fechaRetiro,
          }),
        ]);
        if (!imp.ok) {
          toast.error(imp.message || "Enviado, pero falló la impresión del sticker");
        } else {
          toast.success("Enviado a modista e impreso sticker");
        }
      }
      onOpenChange(false);
      onSuccess?.({ notas: notasTrim });
    } finally {
      setGuardando(false);
    }
  };

  const tituloExtra =
    contexto?.tipo === "stock" && contexto.productos.length > 1
      ? ` (${contexto.productos.length} prendas)`
      : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !guardando && onOpenChange(v)}>
      <DialogContent
        className="w-full border-0"
        dialogClassName="modal-dialog-centered modal-lg"
        dialogStyle={{ maxWidth: "560px", width: "95%" }}
      >
        <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
          <DialogTitle className="fw-semibold mb-0">
            Enviar a modista{tituloExtra}
          </DialogTitle>
        </DialogHeader>
        <div className="modal-body px-3 px-md-4 py-3">
          {contexto?.tipo === "stock" && (
            <div className="mb-3 small">
              {contexto.productos.length === 1 ? (
                <>
                  <p className="mb-1 fw-semibold text-dark">
                    {descripcionProductoModista(contexto.productos[0])}
                  </p>
                  <p className="mb-0 text-muted font-monospace">
                    {contexto.productos[0].codigo_barra ||
                      `ID ${contexto.productos[0].id}`}
                  </p>
                </>
              ) : (
                <ul className="mb-0 ps-3">
                  {contexto.productos.map((p) => (
                    <li key={p.id}>{descripcionProductoModista(p)}</li>
                  ))}
                </ul>
              )}
              <span className="badge bg-secondary mt-2">STOCK</span>
            </div>
          )}

          {contexto?.tipo === "orden" && (
            <div className="mb-3 small border rounded p-2 bg-light">
              <p className="mb-1 fw-semibold">{contexto.clienteNombre}</p>
              {contexto.clienteDni ? (
                <p className="mb-1 text-muted">DNI: {contexto.clienteDni}</p>
              ) : null}
              {contexto.clienteCelular ? (
                <p className="mb-1 text-muted">Cel: {contexto.clienteCelular}</p>
              ) : null}
              <p className="mb-1">{contexto.producto.producto_descripcion}</p>
              <p className="mb-0 text-muted font-monospace">
                {contexto.producto.codigo_barra ||
                  `ID ${contexto.producto.producto_id}`}
              </p>
            </div>
          )}

          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="env-mod-modista">
              Modista
            </label>
            <select
              id="env-mod-modista"
              className="form-select"
              value={modistaId === "" ? "" : String(modistaId)}
              onChange={(e) =>
                setModistaId(e.target.value ? Number(e.target.value) : "")
              }
              disabled={guardando}
            >
              <option value="">Seleccionar modista…</option>
              {modistas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-0">
            <label className="form-label fw-semibold" htmlFor="env-mod-notas">
              Trabajo a realizar <span className="text-danger">*</span>
            </label>
            <textarea
              id="env-mod-notas"
              className="form-control"
              rows={4}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              disabled={guardando}
              placeholder="Ej.: achicar manga, subir cintura, arreglar cierre…"
            />
          </div>
        </div>
        <DialogFooter className="border-top pt-3 d-flex flex-wrap justify-content-end gap-2 px-3 px-md-4 pb-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={guardando}
            onClick={cerrar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={guardando || modistas.length === 0}
            onClick={() => void confirmar()}
          >
            {guardando ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden
                />
                Enviando…
              </>
            ) : (
              <>
                <i className="bi bi-printer me-2" aria-hidden />
                Enviar e imprimir sticker
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
