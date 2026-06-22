"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_CONFIG_IMPRESION_ETIQUETAS,
  guardarConfigImpresionEtiquetas,
  leerConfigImpresionEtiquetas,
  type ConfigImpresionEtiquetas,
} from "@/lib/impresion-etiquetas-config";
import {
  listarImpresorasQz,
  probarConexionQz,
  qzTrayDisponible,
} from "@/lib/impresion-qz-tray";

export function ConfigImpresionEtiquetas() {
  const [config, setConfig] = useState<ConfigImpresionEtiquetas>(
    DEFAULT_CONFIG_IMPRESION_ETIQUETAS
  );
  const [qzActivo, setQzActivo] = useState<boolean | null>(null);
  const [probandoQz, setProbandoQz] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    setConfig(leerConfigImpresionEtiquetas());
  }, []);

  const persistir = useCallback((next: ConfigImpresionEtiquetas) => {
    setConfig(next);
    guardarConfigImpresionEtiquetas(next);
  }, []);

  const probarQz = async () => {
    setProbandoQz(true);
    try {
      const ok = await qzTrayDisponible();
      setQzActivo(ok);
      if (!ok) {
        toast.error(
          "QZ Tray no está disponible. Instalalo en la Mac del local y permití la conexión."
        );
        return;
      }
      const impresoras = await listarImpresorasQz();
      toast.success(
        impresoras.length > 0
          ? `QZ Tray conectado. Impresoras: ${impresoras.join(", ")}`
          : "QZ Tray conectado, pero no se detectaron impresoras."
      );
    } finally {
      setProbandoQz(false);
    }
  };

  useEffect(() => {
    if (!abierto || !config.usarQzTray) return;
    void probarConexionQz().then(setQzActivo);
  }, [abierto, config.usarQzTray]);

  return (
    <div className="border rounded mb-4 overflow-hidden">
      <button
        type="button"
        className="w-100 btn btn-light text-start d-flex justify-content-between align-items-center px-3 py-2"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span>
          <i className="bi bi-gear me-2" aria-hidden />
          Configuración de impresoras (armado)
        </span>
        <i className={`bi bi-chevron-${abierto ? "up" : "down"}`} aria-hidden />
      </button>
      {abierto && (
        <div className="p-3 border-top bg-body-tertiary">
          <p className="small text-muted mb-3">
            Con <strong>QZ Tray</strong> instalado en la Mac, cada tipo de etiqueta
            sale por su impresora sin elegirla en el diálogo. Sin QZ Tray, el
            navegador abre el diálogo y hay que elegir la impresora indicada.
          </p>
          <div className="form-check form-switch mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="usar-qz-tray"
              checked={config.usarQzTray}
              onChange={(e) =>
                persistir({ ...config, usarQzTray: e.target.checked })
              }
            />
            <label className="form-check-label" htmlFor="usar-qz-tray">
              Usar QZ Tray (impresión directa por impresora)
            </label>
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="imp-resumen">
                Etiqueta resumen del conjunto
              </label>
              <input
                id="imp-resumen"
                className="form-control form-control-sm"
                value={config.impresoraResumenConjunto}
                onChange={(e) =>
                  persistir({
                    ...config,
                    impresoraResumenConjunto: e.target.value,
                  })
                }
                placeholder="XP-470B"
              />
              <div className="form-text">Coincide con parte del nombre en el sistema.</div>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold" htmlFor="imp-prenda">
                Etiquetas por prenda (código de barras)
              </label>
              <input
                id="imp-prenda"
                className="form-control form-control-sm"
                value={config.impresoraEtiquetaPrenda}
                onChange={(e) =>
                  persistir({
                    ...config,
                    impresoraEtiquetaPrenda: e.target.value,
                  })
                }
                placeholder="Zebra"
              />
              <div className="form-text">Ej. Zebra, GK420, ZD420, etc.</div>
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={probandoQz}
              onClick={() => void probarQz()}
            >
              {probandoQz ? "Probando…" : "Probar QZ Tray"}
            </button>
            {qzActivo === true && (
              <span className="badge bg-success">QZ Tray conectado</span>
            )}
            {qzActivo === false && config.usarQzTray && (
              <span className="badge bg-warning text-dark">
                QZ Tray no detectado — se usará el diálogo del navegador
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
