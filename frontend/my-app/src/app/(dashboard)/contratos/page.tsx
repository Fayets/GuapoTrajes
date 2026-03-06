"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getApiBaseUrl } from "@/lib/api-config";

type Contrato = {
  orden_id: number;
  presupuesto_numero: string;
  cliente_nombre: string;
  cliente_dni?: string | null;
  contrato_generado_at: string;
  fecha_evento: string;
  total: number;
};

function normalizarParaBusqueda(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    fetchContratos();
  }, []);

  const fetchContratos = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/ordenes/contratos`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = typeof data?.detail === "string" ? data.detail : "Error al obtener contratos";
        console.error("Contratos:", res.status, msg);
        setContratos([]);
        return;
      }
      setContratos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar contratos:", error);
      setContratos([]);
    } finally {
      setCargando(false);
    }
  };

  const verContrato = (ordenId: number) => {
    window.open(`/ordenes?verContrato=${ordenId}`, "_blank", "noopener,noreferrer");
  };

  const contratosFiltrados = useMemo(() => {
    const termino = normalizarParaBusqueda(busqueda);
    if (!termino) return contratos;
    return contratos.filter((c) => {
      const nombreCompleto = (c.cliente_nombre ?? "").trim();
      const dni = (c.cliente_dni ?? "").toString().trim();
      if (normalizarParaBusqueda(dni).includes(termino)) return true;
      if (normalizarParaBusqueda(nombreCompleto).includes(termino)) return true;
      const partes = nombreCompleto.split(/\s+/).filter(Boolean);
      const apellido = partes[0] ?? "";
      const nombre = partes.slice(1).join(" ") ?? "";
      if (normalizarParaBusqueda(apellido).includes(termino)) return true;
      if (normalizarParaBusqueda(nombre).includes(termino)) return true;
      return false;
    });
  }, [contratos, busqueda]);

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Contratos</h1>
          <p className="text-muted mb-0">
            Contratos de alquiler generados desde órdenes de trabajo.
          </p>
        </div>
        <button className="btn btn-outline-primary" onClick={fetchContratos}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          Actualizar
        </button>
      </div>

      {cargando ? (
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nombre completo, nombre, apellido o DNI..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              />
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Orden N°</th>
                  <th>Presupuesto</th>
                  <th>Cliente</th>
                  <th>Fecha del contrato</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {contratosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      {contratos.length === 0
                        ? "No hay contratos generados."
                        : "Ningún contrato coincide con la búsqueda."}
                    </td>
                  </tr>
                ) : (
                  contratosFiltrados.map((c) => (
                    <tr key={c.orden_id}>
                      <td className="fw-semibold">{c.orden_id}</td>
                      <td className="text-uppercase text-muted">
                        {c.presupuesto_numero}
                      </td>
                      <td>{c.cliente_nombre}</td>
                      <td>
                        {c.contrato_generado_at
                          ? format(
                              new Date(c.contrato_generado_at),
                              "dd/MM/yyyy HH:mm",
                              { locale: es }
                            )
                          : "-"}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => verContrato(c.orden_id)}
                          title="Ver contrato"
                        >
                          <i className="bi bi-file-earmark-text me-1"></i>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
