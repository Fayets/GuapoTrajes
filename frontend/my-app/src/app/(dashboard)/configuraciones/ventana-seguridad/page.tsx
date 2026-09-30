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

const RETIRO_EJEMPLO = "2026-06-15";
const DEVOLUCION_EJEMPLO = "2026-07-05";

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
      desde: masDias(RETIRO_EJEMPLO, -n),
      hasta: formato(fechaLocal(DEVOLUCION_EJEMPLO)),
      retiro: formato(fechaLocal(RETIRO_EJEMPLO)),
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
            Margen global para lavandería o modista. Vale para todas las
            sucursales y para las reservas que ya existen.
          </p>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="card h-100">
              <div className="card-body">
                <h2 className="h5 mb-3">Días antes del retiro</h2>
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
                  0 deja la prenda libre hasta el día del retiro. El máximo es
                  30. Hoy el local usa {cargando ? "…" : diasGuardados}{" "}
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
                  Presupuesto con retiro el <strong>{ejemplo.retiro}</strong> y
                  devolución el <strong>{ejemplo.hasta}</strong>.
                </p>
                <p className="mb-0">
                  La prenda queda tomada desde el <strong>{ejemplo.desde}</strong>{" "}
                  hasta el <strong>{ejemplo.hasta}</strong>. El inicio resta los
                  días a la fecha de retiro. El fin es la fecha de devolución,
                  sin sumar días extra.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleGate>
  );
}
