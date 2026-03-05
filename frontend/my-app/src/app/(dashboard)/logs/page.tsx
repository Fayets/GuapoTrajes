"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-config";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  details?: any;
  raw_line: string;
}

interface LogsResponse {
  message: string;
  total_logs: number;
  filtered_logs: number;
  logs: LogEntry[];
  categories: string[];
  date_range?: {
    desde?: string;
    hasta?: string;
  };
}

export default function LogsPage() {
  const { isSuperAdmin, loading, token } = useAuth();
  const router = useRouter();
  const [logsData, setLogsData] = useState<LogsResponse | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("TODAS");
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      toast.error("No tienes permisos para acceder a esta página");
      router.push("/dashboard");
      return;
    }
  }, [loading, isSuperAdmin, router]);

  const fetchLogs = async (category?: string, desde?: string, hasta?: string) => {
    if (!isSuperAdmin || !token) return;

    try {
      setLoadingLogs(true);
      const apiBase = getApiBaseUrl();
      
      const params = new URLSearchParams();
      if (category && category !== "TODAS") {
        params.append("categoria", category);
      }
      if (desde) {
        params.append("fecha_desde", desde);
      }
      if (hasta) {
        params.append("fecha_hasta", hasta);
      }
      params.append("limit", "2000");

      const url = `${apiBase}/logs/system?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error("No tienes permisos para ver los logs");
          router.push("/dashboard");
          return;
        }
        throw new Error("Error al obtener los logs");
      }

      const data: LogsResponse = await response.json();
      setLogsData(data);
      if (data.categories && data.categories.length > 0) {
        setAvailableCategories(data.categories);
      }
    } catch (error: any) {
      toast.error(error.message || "Error al cargar los logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && token) {
      fetchLogs(selectedCategory !== "TODAS" ? selectedCategory : undefined, fechaDesde || undefined, fechaHasta || undefined);
    }
  }, [isSuperAdmin, token]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    fetchLogs(category !== "TODAS" ? category : undefined, fechaDesde || undefined, fechaHasta || undefined);
  };

  const handleFilter = () => {
    fetchLogs(selectedCategory !== "TODAS" ? selectedCategory : undefined, fechaDesde || undefined, fechaHasta || undefined);
  };

  const clearFilters = () => {
    setSelectedCategory("TODAS");
    setFechaDesde("");
    setFechaHasta("");
    fetchLogs();
  };

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR":
        return "text-danger";
      case "WARNING":
        return "text-warning";
      case "INFO":
        return "text-info";
      case "DEBUG":
        return "text-muted";
      default:
        return "text-secondary";
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      USUARIOS: "bg-primary",
      SUCURSALES: "bg-success",
      VENTAS: "bg-info",
      CAJA: "bg-warning",
      PRODUCTOS: "bg-secondary",
      CLIENTES: "bg-primary",
      PRESUPUESTOS: "bg-info",
      ORDENES: "bg-success",
      SISTEMA: "bg-dark",
      AUTENTICACION: "bg-danger",
      OTROS: "bg-secondary",
    };
    return colors[category] || "bg-secondary";
  };

  if (loading || !isSuperAdmin) {
    return null;
  }

  const filteredLogs = logsData?.logs || [];
  const categoriesForTabs = ["TODAS", ...availableCategories];

  return (
    <div className="container-fluid px-4 py-3">
      <div className="mb-3">
        <h1 className="fw-bold mb-1">Logs del Sistema</h1>
        <p className="text-muted mb-0">
          Visualización de logs categorizados y filtrados por fecha. Solo visible para SUPER_ADMIN.
        </p>
      </div>

      {/* Filtros */}
      <Card className="shadow-sm mb-3">
        <div className="card-body p-3">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-3">
              <label className="form-label fw-bold small">Fecha Desde</label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label fw-bold small">Fecha Hasta</label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-4 d-flex gap-2">
              <Button onClick={handleFilter} size="sm">
                <i className="bi bi-funnel me-1"></i>
                Filtrar
              </Button>
              <Button onClick={clearFilters} variant="outline" size="sm">
                <i className="bi bi-x-circle me-1"></i>
                Limpiar
              </Button>
            </div>
            <div className="col-12 col-md-2 text-end">
              {logsData && (
                <small className="text-muted">
                  {logsData.filtered_logs} / {logsData.total_logs} logs
                </small>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs por categoría */}
      <Card className="shadow-sm">
        <div className="card-body p-0">
          <div className="border-bottom">
            <ul className="nav nav-tabs px-3 pt-2" role="tablist">
              {categoriesForTabs.map((cat) => (
                <li key={cat} className="nav-item" role="presentation">
                  <button
                    className={`nav-link ${selectedCategory === cat ? "active" : ""}`}
                    onClick={() => handleCategoryChange(cat)}
                    type="button"
                    role="tab"
                  >
                    {cat}
                    {cat !== "TODAS" && logsData && (
                      <span className="badge bg-secondary ms-2">
                        {logsData.logs.filter((log) => log.category === cat).length}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="tab-content" style={{ maxHeight: "65vh", overflowY: "auto" }}>
            {loadingLogs ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
              </div>
            ) : (
              <div className="p-3">
                {filteredLogs.filter((log) => selectedCategory === "TODAS" || log.category === selectedCategory).length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                    No hay logs disponibles para esta categoría
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th style={{ width: "180px" }}>Fecha/Hora</th>
                          <th style={{ width: "80px" }}>Nivel</th>
                          <th style={{ width: "120px" }}>Categoría</th>
                          <th>Mensaje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogs
                          .filter((log) => selectedCategory === "TODAS" || log.category === selectedCategory)
                          .map((log, index) => (
                            <tr key={index}>
                              <td className="text-muted small">{log.timestamp}</td>
                              <td>
                                <span className={`badge ${getLevelColor(log.level)}`}>
                                  {log.level}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${getCategoryColor(log.category)} text-white`}>
                                  {log.category}
                                </span>
                              </td>
                              <td>
                                <div className="d-flex flex-column">
                                  <span className="small">{log.message}</span>
                                  {log.details && (
                                    <details className="mt-1">
                                      <summary className="small text-muted" style={{ cursor: "pointer" }}>
                                        Ver detalles
                                      </summary>
                                      <pre className="small bg-light p-2 mt-2 rounded">
                                        {JSON.stringify(log.details, null, 2)}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
