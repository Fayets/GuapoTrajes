"use client";

import { useState, useEffect, useMemo } from "react";
import ReactPaginate from "react-paginate";
import { FileText } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-config";
import { formatDateTimeArgentina } from "@/lib/fecha-calendario";

type Contrato = {
  orden_id: number;
  presupuesto_numero: string;
  cliente_nombre: string;
  cliente_dni?: string | null;
  contrato_generado_at: string;
  contrato_generado_por_nombre?: string | null;
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
  const [paginaActual, setPaginaActual] = useState(0);
  const CONTRATOS_POR_PAGINA = 18;

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

  useEffect(() => {
    setPaginaActual(0);
  }, [busqueda]);

  const pageCount = Math.ceil(contratosFiltrados.length / CONTRATOS_POR_PAGINA);
  const offset = Math.min(paginaActual, Math.max(0, pageCount - 1)) * CONTRATOS_POR_PAGINA;
  const contratosPaginados = contratosFiltrados.slice(
    offset,
    offset + CONTRATOS_POR_PAGINA
  );

  return (
    <div className="container-fluid px-2 px-sm-3 px-md-4 py-3">
      <div className="gt-page-header d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="page-title mb-1">Contratos</h1>
          <p className="text-muted mb-0">
            Contratos de alquiler generados desde órdenes de trabajo.
          </p>
        </div>
        <button
          className="btn btn-outline-ink d-flex align-items-center gap-2"
          onClick={fetchContratos}
        >
          <i className="bi bi-arrow-clockwise"></i>
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
          <div className="card-body border-bottom">
            <div className="input-group gt-search">
              <span className="input-group-text">
                <i className="bi bi-search"></i>
              </span>
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
            <table className="table gt-table align-middle mb-0">
              <thead>
                <tr>
                  <th>Orden N°</th>
                  <th>Presupuesto</th>
                  <th>Cliente</th>
                  <th>Fecha del contrato</th>
                  <th>Generado por</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {contratosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      {contratos.length === 0
                        ? "No hay contratos generados."
                        : "Ningún contrato coincide con la búsqueda."}
                    </td>
                  </tr>
                ) : (
                  contratosPaginados.map((c) => (
                    <tr key={c.orden_id}>
                      <td className="fw-semibold">{c.orden_id}</td>
                      <td className="text-uppercase text-muted">
                        {c.presupuesto_numero}
                      </td>
                      <td>{c.cliente_nombre}</td>
                      <td>
                        {c.contrato_generado_at
                          ? formatDateTimeArgentina(c.contrato_generado_at)
                          : "-"}
                      </td>
                      <td className="text-muted small">
                        {c.contrato_generado_por_nombre || "—"}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn-action btn-action--wide btn-action--ver mx-auto"
                          onClick={() => verContrato(c.orden_id)}
                          title="Ver contrato"
                        >
                          <FileText size={16} strokeWidth={1.75} aria-hidden />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="d-flex flex-column align-items-center gap-1 px-3 py-2">
              <ReactPaginate
                previousLabel={"←"}
                nextLabel={"→"}
                breakLabel={"..."}
                pageCount={pageCount}
                pageRangeDisplayed={3}
                marginPagesDisplayed={1}
                onPageChange={({ selected }) => setPaginaActual(selected)}
                containerClassName={"pagination"}
                pageClassName={"page-item"}
                pageLinkClassName={"page-link"}
                previousClassName={"page-item"}
                previousLinkClassName={"page-link"}
                nextClassName={"page-item"}
                nextLinkClassName={"page-link"}
                breakClassName={"page-item"}
                breakLinkClassName={"page-link"}
                activeClassName={"active"}
                forcePage={Math.min(paginaActual, pageCount - 1)}
              />
              <span className="text-muted small text-center">
                Mostrando {offset + 1}–
                {Math.min(offset + CONTRATOS_POR_PAGINA, contratosFiltrados.length)} de{" "}
                {contratosFiltrados.length} contratos
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
