"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleGate } from "@/components/RoleGate";
import { getApiBaseUrl } from "@/lib/api-config";
import { useAuth } from "@/context/auth-context";

type Explicacion = {
  dias: number;
  inicio: string;
  fin: string;
  reservado_hoy: string;
};

const RETIRO_EJEMPLO = "2026-10-10";
const DEVOLUCION_EJEMPLO = "2026-10-12";

function fechaLocal(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function formato(fecha: Date): string {
  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function masDias(iso: string, dias: number): string {
  const fecha = fechaLocal(iso);
  fecha.setDate(fecha.getDate() + dias);
  return formato(fecha);
}

export default function VentanaSeguridadPage() {
  const { token } = useAuth();
  const [diasGuardados, setDiasGuardados] = useState(2);
  const [dias, setDias] = useState("2");
  const [explicacion, setExplicacion] = useState<Explicacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    if (!token) return;
    setCargando(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/config/ventana-seguridad`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error("No se pudo leer la ventana de bloqueo.");
        return;
      }
      const data = (await res.json()) as Explicacion;
      setExplicacion(data);
      setDiasGuardados(data.dias);
      setDias(String(data.dias));
    } catch {
      toast.error("Error de conexión al leer la ventana de bloqueo.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [token]);

  const diasNumero = Number(dias);
  const diasValidos =
    Number.isInteger(diasNumero) && diasNumero >= 0 && diasNumero <= 30;

  const ejemplo = useMemo(() => {
    const n = diasValidos ? diasNumero : diasGuardados;
    return {
      n,
      retiro: formato(fechaLocal(RETIRO_EJEMPLO)),
      devolucion: formato(fechaLocal(DEVOLUCION_EJEMPLO)),
      bloqueadoHasta: masDias(DEVOLUCION_EJEMPLO, n),
      disponibleDesde: masDias(DEVOLUCION_EJEMPLO, n + 1),
    };
  }, [diasNumero, diasValidos, diasGuardados]);

  const guardar = async () => {
    if (!token || !diasValidos) {
      toast.error("Ingresá un número entero entre 0 y 30.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/config/ventana-seguridad`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dias: diasNumero }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail =
          data && typeof data.detail === "string"
            ? data.detail
            : "No se pudo guardar la ventana.";
        toast.error(detail);
        return;
      }
      setExplicacion(data as Explicacion);
      setDiasGuardados(diasNumero);
      toast.success("Ventana de bloqueo actualizada para todo el local.");
    } catch {
      toast.error("Error de conexión al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <RoleGate allow={["ADMIN", "SUPER_ADMIN"]}>
      <div className="container-fluid px-2 px-sm-3 px-md-4 py-3">
        <div className="mb-4">
          <h1 className="page-title mb-1">Ventana de bloqueo</h1>
          <p className="text-muted mb-0">
            Días de limpieza después de la devolución. Entre que un cliente
            devuelve y el próximo retira, la prenda no puede salir. Vale para
            todas las sucursales y para las reservas que ya existen.
          </p>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="card h-100">
              <div className="card-body">
                <h2 className="h5 mb-3">Días después de la devolución</h2>
                <label className="form-label" htmlFor="dias-ventana">
                  Cantidad de días
                </label>
                <Input
                  id="dias-ventana"
                  type="number"
                  min={0}
                  max={30}
                  value={dias}
                  disabled={cargando || guardando}
                  onChange={(e) => setDias(e.target.value)}
                />
                <p className="text-muted small mt-2 mb-3">
                  Se cuentan desde el día de devolución, sin incluirlo. Con 2,
                  si devuelven el 12 no sale el 13 ni el 14, y el próximo
                  retiro puede ser el 15. 0 deja la prenda libre al día
                  siguiente de la devolución. El máximo es 30. Hoy el local
                  usa {cargando ? "…" : diasGuardados}{" "}
                  {diasGuardados === 1 ? "día" : "días"}.
                </p>
                <Button onClick={() => void guardar()} disabled={cargando || guardando}>
                  {guardando ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-7">
            <div className="card h-100">
              <div className="card-body">
                <h2 className="h5 mb-3">De dónde sale cada fecha</h2>
                {explicacion ? (
                  <ul className="mb-0 ps-3">
                    <li className="mb-2">
                      <strong>Inicio del bloqueo.</strong> {explicacion.inicio}
                    </li>
                    <li className="mb-2">
                      <strong>Fin del bloqueo.</strong> {explicacion.fin}
                    </li>
                    <li>
                      <strong>Marca de reservado en productos.</strong>{" "}
                      {explicacion.reservado_hoy}
                    </li>
                  </ul>
                ) : (
                  <p className="text-muted mb-0">
                    {cargando ? "Cargando…" : "No hay explicación disponible."}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <h2 className="h5 mb-2">Ejemplo con {ejemplo.n} {ejemplo.n === 1 ? "día" : "días"}</h2>
                <p className="mb-2">
                  El cliente retira el <strong>{ejemplo.retiro}</strong> y
                  devuelve el <strong>{ejemplo.devolucion}</strong>.
                </p>
                <p className="mb-0">
                  {ejemplo.n === 0 ? (
                    <>
                      Sin días de limpieza, el próximo retiro puede ser el{" "}
                      <strong>{ejemplo.disponibleDesde}</strong>.
                    </>
                  ) : (
                    <>
                      A la devolución se le suman {ejemplo.n}{" "}
                      {ejemplo.n === 1 ? "día" : "días"}: la prenda queda
                      bloqueada hasta el <strong>{ejemplo.bloqueadoHasta}</strong>{" "}
                      inclusive. El próximo alquiler se puede retirar desde el{" "}
                      <strong>{ejemplo.disponibleDesde}</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleGate>
  );
}
