"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Download, Calendar, Filter, Plus, DollarSign, Minus, Search, BarChart3, Users, TrendingUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface CajaMovimiento {
  id: number;
  hora: string;
  origen: string;
  tipo: string;
  payment_method: string | null;
  categoria: string | null;
  monto: number;
  usuario_nombre: string;
}

interface CajaTotales {
  totales_por_metodo: { [key: string]: number };
  total_general: number;
}

interface BalanceFinanciero {
  fecha_desde: string;
  fecha_hasta: string;
  total_ingresos: number;
  total_egresos: number;
  balance: number;
  balance_porcentual: number;
  resumen_ingresos: { [key: string]: number };
  resumen_egresos: { [key: string]: number };
}

interface SaldoPendiente {
  presupuesto_id: number;
  cliente_id: number;
  cliente_nombre: string;
  cliente_dni: string;
  fecha_creacion: string;
  total_presupuesto: number;
  pagos_realizados: number;
  saldo_pendiente: number;
  sucursal_nombre: string;
  estado: string;
}

const metodosPago = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "DEBITO", label: "Débito" },
  { value: "CREDITO", label: "Crédito" },
  { value: "BILLETERA_VIRTUAL", label: "Billetera Virtual" },
];

export default function CajaPage() {
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([]);
  const [totales, setTotales] = useState<CajaTotales>({
    totales_por_metodo: {},
    total_general: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [metodoFiltro, setMetodoFiltro] = useState<string>("");
  const [sucursalId, setSucursalId] = useState(1); // TODO: Obtener del contexto
  
  // Estados para búsqueda por texto
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Estados para reportes
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split("T")[0]);
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const [balanceFinanciero, setBalanceFinanciero] = useState<BalanceFinanciero | null>(null);
  const [saldosPendientes, setSaldosPendientes] = useState<SaldoPendiente[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  
  // Estados para los modales de ingreso y egreso
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [showEgresoModal, setShowEgresoModal] = useState(false);
  const [nuevoIngreso, setNuevoIngreso] = useState({
    monto: "",
    concepto: "",
    metodoPago: "EFECTIVO", // Valor por defecto
    categoria: "OTROS_INGRESOS", // Valor por defecto
  });
  const [nuevoEgreso, setNuevoEgreso] = useState({
    monto: "",
    concepto: "",
    metodoPago: "EFECTIVO", // Valor por defecto
    categoria: "ADMINISTRATIVOS", // Valor por defecto
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para la conexión del backend
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  // Función de validación para formularios
  const isFormValid = (formData: { monto: string; concepto: string; metodoPago: string; categoria: string }) => {
    return (
      formData.monto.trim() !== "" &&
      formData.concepto.trim() !== "" &&
      formData.metodoPago.trim() !== "" &&
      formData.categoria.trim() !== "" &&
      parseFloat(formData.monto) > 0
    );
  };

  const API_URL = "http://127.0.0.1:8000/caja";

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/diaria?fecha=${new Date().toISOString().split("T")[0]}&sucursal_id=1`, {
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('error');
      }
    } catch (error) {
      setBackendStatus('error');
    }
  };

  const categoriasIngreso = [
    { value: "VENTAS", label: "Ventas" },
    { value: "SEÑAS", label: "Señas" },
    { value: "PAGOS_ADICIONALES", label: "Pagos Adicionales" },
    { value: "SERVICIOS", label: "Servicios" },
    { value: "OTROS_INGRESOS", label: "Otros Ingresos" },
  ];

  const categoriasEgreso = [
    { value: "ADMINISTRATIVOS", label: "Administrativos" },
    { value: "OPERATIVOS", label: "Operativos" },
    { value: "COMERCIALES", label: "Comerciales" },
    { value: "OTROS_EGRESOS", label: "Otros Egresos" },
  ];

  const fetchCajaDiaria = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        fecha: fecha,
        sucursal_id: sucursalId.toString(),
      });
      
      if (metodoFiltro) {
        params.append("payment_method", metodoFiltro);
      }

      const response = await fetch(`${API_URL}/diaria?${params}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.movimientos && data.totales) {
        setMovimientos(data.movimientos);
        setTotales(data.totales);
        toast.success(`Caja diaria cargada: ${data.movimientos.length} movimientos`);
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener caja diaria:", error);
      toast.error("Error al cargar caja diaria: " + error.message);
      // Mantener los datos anteriores en caso de error
    } finally {
      setIsLoading(false);
    }
  };

  const buscarMovimientos = async () => {
    if (!textoBusqueda.trim()) {
      toast.error("Por favor ingrese un texto para buscar");
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        texto: textoBusqueda,
        sucursal_id: sucursalId.toString(),
      });
      
      if (fechaDesde) {
        params.append("fecha_desde", fechaDesde);
      }
      if (fechaHasta) {
        params.append("fecha_hasta", fechaHasta);
      }

      const response = await fetch(`${API_URL}/buscar?${params}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setResultadosBusqueda(data.data.movimientos);
      toast.success(`Búsqueda completada: ${data.data.total_resultados} resultados`);
    } catch (error: any) {
      console.error("Error al buscar movimientos:", error.message);
      toast.error("Error al buscar movimientos: " + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const obtenerBalanceFinanciero = async () => {
    setIsLoadingReports(true);
    try {
      const response = await fetch(`${API_URL}/balance-financiero`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
          sucursal_id: sucursalId,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setBalanceFinanciero(data.data);
      toast.success("Balance financiero obtenido correctamente");
    } catch (error: any) {
      console.error("Error al obtener balance financiero:", error.message);
      toast.error("Error al obtener balance financiero: " + error.message);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const obtenerSaldosPendientes = async () => {
    setIsLoadingReports(true);
    try {
      const response = await fetch(`${API_URL}/saldos-pendientes`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
          sucursal_id: sucursalId,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSaldosPendientes(data.data.saldos);
      toast.success("Saldos pendientes obtenidos correctamente");
    } catch (error: any) {
      console.error("Error al obtener saldos pendientes:", error.message);
      toast.error("Error al obtener saldos pendientes: " + error.message);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const registrarIngreso = async () => {
    // Validar que todos los campos estén completos
    if (!nuevoIngreso.monto || !nuevoIngreso.concepto || !nuevoIngreso.metodoPago || !nuevoIngreso.categoria) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    // Validar que el monto sea un número válido y positivo
    const monto = parseFloat(nuevoIngreso.monto);
    if (isNaN(monto) || monto <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        monto: monto,
        origen: nuevoIngreso.concepto,
        tipo: "INGRESO",
        payment_method: nuevoIngreso.metodoPago,
        categoria: nuevoIngreso.categoria,
        sucursal_id: sucursalId,
      };

      const response = await fetch(`${API_URL}/registrar-movimiento`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        toast.success("Ingreso registrado correctamente");
        setShowIngresoModal(false);
        setNuevoIngreso({ monto: "", concepto: "", metodoPago: "", categoria: "" });
        await fetchCajaDiaria(); // Recargar datos
      } else {
        throw new Error(result.message || "Error al registrar ingreso");
      }
    } catch (error: any) {
      console.error("Error al registrar ingreso:", error);
      toast.error("Error al registrar ingreso: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const registrarEgreso = async () => {
    // Validar que todos los campos estén completos
    if (!nuevoEgreso.monto || !nuevoEgreso.concepto || !nuevoEgreso.metodoPago || !nuevoEgreso.categoria) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    // Validar que el monto sea un número válido y positivo
    const monto = parseFloat(nuevoEgreso.monto);
    if (isNaN(monto) || monto <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        monto: monto,
        origen: nuevoEgreso.concepto,
        tipo: "EGRESO",
        payment_method: nuevoEgreso.metodoPago,
        categoria: nuevoEgreso.categoria,
        sucursal_id: sucursalId,
      };

      const response = await fetch(`${API_URL}/registrar-movimiento`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        toast.success("Egreso registrado correctamente");
        setShowEgresoModal(false);
        setNuevoEgreso({ monto: "", concepto: "", metodoPago: "", categoria: "" });
        await fetchCajaDiaria(); // Recargar datos
      } else {
        throw new Error(result.message || "Error al registrar egreso");
      }
    } catch (error: any) {
      console.error("Error al registrar egreso:", error);
      toast.error("Error al registrar egreso: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const exportarCSV = async () => {
    try {
      const params = new URLSearchParams({
        fecha_desde: fecha,
        fecha_hasta: fecha,
        sucursal_id: sucursalId.toString(),
      });
      
      if (metodoFiltro) {
        params.append("payment_method", metodoFiltro);
      }

      const response = await fetch(`${API_URL}/exportar-csv?${params}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error("Error al exportar CSV");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `caja_${fecha}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("CSV exportado correctamente");
    } catch (error: any) {
      toast.error("Error al exportar CSV: " + error.message);
    }
  };

  const exportarExcel = async () => {
    try {
      const params = new URLSearchParams({
        fecha_desde: fecha,
        fecha_hasta: fecha,
        sucursal_id: sucursalId.toString(),
      });
      
      if (metodoFiltro) {
        params.append("payment_method", metodoFiltro);
      }

      const response = await fetch(`${API_URL}/exportar-excel?${params}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error("Error al exportar Excel");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `caja_${fecha}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Excel exportado correctamente");
    } catch (error: any) {
      toast.error("Error al exportar Excel: " + error.message);
    }
  };

  useEffect(() => {
    fetchCajaDiaria();
  }, [fecha, metodoFiltro]);

  // Cargar movimientos al montar el componente
  useEffect(() => {
    checkBackendConnection();
    fetchCajaDiaria();
  }, []);

  // Limpiar estado cuando se cierre el modal de egreso
  useEffect(() => {
    if (!showEgresoModal) {
      setNuevoEgreso({
        monto: "",
        concepto: "",
        metodoPago: "EFECTIVO", // Valor por defecto
        categoria: "ADMINISTRATIVOS", // Valor por defecto
      });
    }
  }, [showEgresoModal]);

  // Limpiar estado cuando se cierre el modal de ingreso
  useEffect(() => {
    if (!showIngresoModal) {
      setNuevoIngreso({
        monto: "",
        concepto: "",
        metodoPago: "EFECTIVO", // Valor por defecto
        categoria: "OTROS_INGRESOS", // Valor por defecto
      });
    }
  }, [showIngresoModal]);

  const getMetodoPagoLabel = (metodo: string | null) => {
    if (!metodo) return "N/A";
    const metodoObj = metodosPago.find(m => m.value === metodo);
    return metodoObj?.label || metodo;
  };

  const getMetodoPagoColor = (metodo: string | null) => {
    if (!metodo) return "bg-secondary";
    
    switch (metodo) {
      case "EFECTIVO":
        return "bg-success";
      case "DEBITO":
        return "bg-primary";
      case "CREDITO":
        return "bg-info";
      case "BILLETERA_VIRTUAL":
        return "bg-warning";
      default:
        return "bg-secondary";
    }
  };

  return (
    <div>
      {/* Header con título y botones principales */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Caja Diaria</h1>
          <p className="text-muted">Gestión de movimientos de caja y reportes</p>
          
          {/* Indicador de estado del backend */}
          <div className="d-flex align-items-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-circle ${
              backendStatus === 'connected' ? 'bg-success' : 
              backendStatus === 'error' ? 'bg-danger' : 'bg-warning'
            }`}></div>
            <span className={`text-sm ${
              backendStatus === 'connected' ? 'text-success' : 
              backendStatus === 'error' ? 'text-danger' : 'text-warning'
            }`}>
              {backendStatus === 'connected' ? 'Conectado al servidor' : 
               backendStatus === 'error' ? 'Error de conexión' : 'Verificando conexión...'}
            </span>
            {backendStatus === 'error' && (
              <button 
                onClick={checkBackendConnection} 
                className="btn btn-outline-secondary btn-sm ms-2"
              >
                Reintentar
              </button>
            )}
          </div>
        </div>
        <div className="d-flex gap-2">
          <button 
            onClick={() => setShowIngresoModal(true)}
            className="btn btn-success"
          >
            <i className="bi bi-plus me-2"></i>
            Nuevo Ingreso
          </button>
          <button 
            onClick={() => setShowEgresoModal(true)}
            className="btn btn-danger"
          >
            <i className="bi bi-dash me-2"></i>
            Nuevo Egreso
          </button>
          <button onClick={exportarCSV} className="btn btn-outline-secondary">
            <i className="bi bi-download me-2"></i>
            CSV
          </button>
          <button onClick={exportarExcel} className="btn btn-outline-secondary">
            <i className="bi bi-download me-2"></i>
            Excel
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <ul className="nav nav-tabs card-header-tabs" role="tablist">
            <li className="nav-item" role="presentation">
              <button className="nav-link active" data-bs-toggle="tab" data-bs-target="#caja-diaria" type="button" role="tab">
                Caja Diaria
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button className="nav-link" data-bs-toggle="tab" data-bs-target="#busqueda" type="button" role="tab">
                Búsqueda
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button className="nav-link" data-bs-toggle="tab" data-bs-target="#balance" type="button" role="tab">
                Balance
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button className="nav-link" data-bs-toggle="tab" data-bs-target="#saldos" type="button" role="tab">
                Saldos Pendientes
              </button>
            </li>
          </ul>
        </div>
        <div className="card-body">
          <div className="tab-content">
            {/* Tab: Caja Diaria */}
            <div className="tab-pane fade show active" id="caja-diaria" role="tabpanel">
              {/* Filtros */}
              <div className="row mb-4">
                <div className="col-md-3">
                  <label className="form-label">
                    <i className="bi bi-calendar me-2"></i>
                    Fecha:
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
                
                <div className="col-md-3">
                  <label className="form-label">
                    <i className="bi bi-funnel me-2"></i>
                    Método:
                  </label>
                  <select 
                    className="form-select" 
                    value={metodoFiltro} 
                    onChange={(e) => setMetodoFiltro(e.target.value)}
                  >
                    <option value="">Todos los métodos</option>
                    {metodosPago.map((metodo) => (
                      <option key={metodo.value} value={metodo.value}>
                        {metodo.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3 d-flex align-items-end">
                  <button 
                    onClick={fetchCajaDiaria} 
                    disabled={isLoading}
                    className="btn btn-outline-secondary"
                  >
                    {isLoading ? <i className="bi bi-arrow-clockwise spin me-2"></i> : <i className="bi bi-arrow-clockwise me-2"></i>}
                    Refrescar
                  </button>
                </div>
              </div>

              {/* Resumen de Totales */}
              <div className="row mb-4">
                {metodosPago.map((metodo) => {
                  const total = totales.totales_por_metodo[metodo.value] || 0;
                  return (
                    <div key={metodo.value} className="col-md-2">
                      <div className="card border-0 bg-light">
                        <div className="card-body text-center">
                          <div className="text-muted small mb-1">{metodo.label}</div>
                          <div className="h4 text-success mb-0">
                            ${total.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                <div className="col-md-2">
                  <div className="card border-0 bg-primary bg-opacity-10">
                    <div className="card-body text-center">
                      <div className="text-primary small mb-1 fw-bold">Total General</div>
                      <div className="h4 text-primary mb-0">
                        ${totales.total_general.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla de Movimientos */}
              <div className="card">
                <div className="card-header bg-light">
                  <h5 className="card-title mb-0">Movimientos del Día</h5>
                  <p className="text-muted small mb-0">
                    {movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''} encontrado{movimientos.length !== 1 ? 's' : ''}
                  </p>
                </div>
                
                {isLoading ? (
                  <div className="card-body text-center text-muted py-5">
                    <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                    Cargando movimientos...
                  </div>
                ) : movimientos.length === 0 ? (
                  <div className="card-body text-center text-muted py-5">
                    <i className="bi bi-bar-chart display-1 d-block mb-3"></i>
                    <h5 className="text-muted">No hay movimientos</h5>
                    <p className="text-muted">
                      No se encontraron movimientos para el {new Date(fecha).toLocaleDateString('es-ES', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                    {metodoFiltro && (
                      <p className="text-muted small">
                        Filtrado por método: {getMetodoPagoLabel(metodoFiltro)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Hora</th>
                          <th>Origen</th>
                          <th>Tipo</th>
                          <th>Categoría</th>
                          <th>Método de Pago</th>
                          <th className="text-end">Monto</th>
                          <th>Usuario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.map((movimiento) => (
                          <tr key={movimiento.id}>
                            <td className="fw-medium">
                              {movimiento.hora}
                            </td>
                            <td>
                              <span className="small">{movimiento.origen}</span>
                            </td>
                            <td>
                              <span className={`badge ${
                                movimiento.tipo === "INGRESO" 
                                  ? "bg-success" 
                                  : "bg-danger"
                              }`}>
                                {movimiento.tipo}
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-secondary">
                                {movimiento.categoria || "N/A"}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${getMetodoPagoColor(movimiento.payment_method)}`}>
                                {getMetodoPagoLabel(movimiento.payment_method)}
                              </span>
                            </td>
                            <td className="text-end fw-semibold">
                              <span className={movimiento.tipo === "INGRESO" ? "text-success" : "text-danger"}>
                                {movimiento.tipo === "INGRESO" ? "+" : "-"}${movimiento.monto.toLocaleString()}
                              </span>
                            </td>
                            <td>
                              <span className="small text-muted">
                                {movimiento.usuario_nombre}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Tab: Búsqueda por Texto */}
            <div className="tab-pane fade" id="busqueda" role="tabpanel">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title mb-3">
                    <i className="bi bi-search me-2"></i>
                    Búsqueda por Texto
                  </h5>
                  <p className="text-muted mb-4">
                    Busque movimientos por cualquier parte del texto en concepto o referencia.
                    Ejemplo: al escribir "LU", se listan todos los registros que contengan "LU".
                  </p>
                  
                  <div className="row mb-4">
                    <div className="col-md-4">
                      <label className="form-label">Texto a buscar</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej: LU, cliente, presupuesto..."
                        value={textoBusqueda}
                        onChange={(e) => setTextoBusqueda(e.target.value)}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Fecha desde</label>
                      <input
                        type="date"
                        className="form-control"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Fecha hasta</label>
                      <input
                        type="date"
                        className="form-control"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                      />
                    </div>
                    <div className="col-md-2 d-flex align-items-end">
                      <button 
                        onClick={buscarMovimientos} 
                        disabled={isSearching || !textoBusqueda.trim()}
                        className="btn btn-primary w-100"
                      >
                        {isSearching ? <i className="bi bi-arrow-clockwise spin me-2"></i> : <i className="bi bi-search me-2"></i>}
                        Buscar
                      </button>
                    </div>
                  </div>

                  {/* Resultados de búsqueda */}
                  {resultadosBusqueda.length > 0 && (
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="card-title mb-0">Resultados de la búsqueda: {resultadosBusqueda.length}</h6>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Fecha</th>
                              <th>Hora</th>
                              <th>Origen/Concepto</th>
                              <th>Tipo</th>
                              <th>Categoría</th>
                              <th>Método</th>
                              <th className="text-end">Monto</th>
                              <th>Usuario</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resultadosBusqueda.map((movimiento) => (
                              <tr key={movimiento.id}>
                                <td>{movimiento.fecha}</td>
                                <td>{movimiento.hora}</td>
                                <td>
                                  <div>
                                    <div className="fw-medium">{movimiento.origen}</div>
                                    {movimiento.descripcion && (
                                      <div className="small text-muted">{movimiento.descripcion}</div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span className={`badge ${
                                    movimiento.tipo === "INGRESO" 
                                      ? "bg-success" 
                                      : "bg-danger"
                                  }`}>
                                    {movimiento.tipo}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge bg-secondary">
                                    {movimiento.categoria || "N/A"}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${getMetodoPagoColor(movimiento.payment_method)}`}>
                                    {getMetodoPagoLabel(movimiento.payment_method)}
                                  </span>
                                </td>
                                <td className="text-end fw-semibold">
                                  <span className={movimiento.tipo === "INGRESO" ? "text-success" : "text-danger"}>
                                    {movimiento.tipo === "INGRESO" ? "+" : "-"}${movimiento.monto.toLocaleString()}
                                  </span>
                                </td>
                                <td className="small text-muted">
                                  {movimiento.usuario_nombre}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tab: Balance Financiero */}
            <div className="tab-pane fade" id="balance" role="tabpanel">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title mb-3">
                    <i className="bi bi-bar-chart me-2"></i>
                    Balance Financiero
                  </h5>
                  
                  <div className="row mb-4">
                    <div className="col-md-3">
                      <label className="form-label">Fecha desde</label>
                      <input
                        type="date"
                        className="form-control"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Fecha hasta</label>
                      <input
                        type="date"
                        className="form-control"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3 d-flex align-items-end">
                      <button 
                        onClick={obtenerBalanceFinanciero} 
                        disabled={isLoadingReports}
                        className="btn btn-primary w-100"
                      >
                        {isLoadingReports ? <i className="bi bi-arrow-clockwise spin me-2"></i> : <i className="bi bi-bar-chart me-2"></i>}
                        Obtener Balance
                      </button>
                    </div>
                  </div>

                  {balanceFinanciero && (
                    <div>
                      {/* Resumen general */}
                      <div className="row mb-4">
                        <div className="col-md-4">
                          <div className="card border-success">
                            <div className="card-body text-center">
                              <div className="text-success small mb-1">Total Ingresos</div>
                              <div className="h3 text-success fw-bold">
                                ${balanceFinanciero.total_ingresos.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="card border-danger">
                            <div className="card-body text-center">
                              <div className="text-danger small mb-1">Total Egresos</div>
                              <div className="h3 text-danger fw-bold">
                                ${balanceFinanciero.total_egresos.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className={`card ${
                            balanceFinanciero.balance >= 0 
                              ? "border-primary" 
                              : "border-warning"
                          }`}>
                            <div className="card-body text-center">
                              <div className={`small mb-1 ${
                                balanceFinanciero.balance >= 0 ? "text-primary" : "text-warning"
                              }`}>
                                Balance
                              </div>
                              <div className={`h3 fw-bold ${
                                balanceFinanciero.balance >= 0 ? "text-primary" : "text-warning"
                              }`}>
                                ${balanceFinanciero.balance.toLocaleString()}
                              </div>
                              <div className="small text-muted">
                                {balanceFinanciero.balance_porcentual.toFixed(1)}% de ingresos
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Detalle por método de pago y categoría */}
                      <div className="row">
                        <div className="col-md-6">
                          <h6 className="fw-medium mb-3">Ingresos por Método de Pago</h6>
                          <div className="list-group">
                            {Object.entries(balanceFinanciero.resumen_ingresos).map(([metodo, monto]) => (
                              <div key={metodo} className="list-group-item d-flex justify-content-between align-items-center">
                                <span className="small">{getMetodoPagoLabel(metodo)}</span>
                                <span className="fw-medium text-success">${monto.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="col-md-6">
                          <h6 className="fw-medium mb-3">Egresos por Categoría</h6>
                          <div className="list-group">
                            {Object.entries(balanceFinanciero.resumen_egresos).map(([categoria, monto]) => (
                              <div key={categoria} className="list-group-item d-flex justify-content-between align-items-center">
                                <span className="small">{categoria}</span>
                                <span className="fw-medium text-danger">${monto.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tab: Saldos Pendientes */}
            <div className="tab-pane fade" id="saldos" role="tabpanel">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title mb-3">
                    <i className="bi bi-people me-2"></i>
                    Saldos Pendientes de Clientes
                  </h5>
                  
                  <div className="row mb-4">
                    <div className="col-md-3">
                      <label className="form-label">Fecha desde</label>
                      <input
                        type="date"
                        className="form-control"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Fecha hasta</label>
                      <input
                        type="date"
                        className="form-control"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3 d-flex align-items-end">
                      <button 
                        onClick={obtenerSaldosPendientes} 
                        disabled={isLoadingReports}
                        className="btn btn-primary w-100"
                      >
                        {isLoadingReports ? <i className="bi bi-arrow-clockwise spin me-2"></i> : <i className="bi bi-people me-2"></i>}
                        Obtener Saldos
                      </button>
                    </div>
                  </div>

                  {saldosPendientes.length > 0 && (
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="card-title mb-0">
                          Saldos Pendientes: {saldosPendientes.length} clientes
                        </h6>
                        <p className="text-muted small mb-0">
                          Total pendiente: ${saldosPendientes.reduce((sum, s) => sum + s.saldo_pendiente, 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Cliente</th>
                              <th>DNI</th>
                              <th>Fecha Presupuesto</th>
                              <th>Total</th>
                              <th>Pagado</th>
                              <th className="text-end">Pendiente</th>
                              <th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {saldosPendientes.map((saldo) => (
                              <tr key={saldo.presupuesto_id}>
                                <td className="fw-medium">
                                  {saldo.cliente_nombre}
                                </td>
                                <td className="small text-muted">
                                  {saldo.cliente_dni}
                                </td>
                                <td className="small text-muted">
                                  {new Date(saldo.fecha_creacion).toLocaleDateString()}
                                </td>
                                <td className="fw-medium">
                                  ${saldo.total_presupuesto.toLocaleString()}
                                </td>
                                <td className="text-success">
                                  ${saldo.pagos_realizados.toLocaleString()}
                                </td>
                                <td className="text-end fw-semibold text-danger">
                                  ${saldo.saldo_pendiente.toLocaleString()}
                                </td>
                                <td>
                                  <span className={`badge ${
                                    saldo.estado === 'pendiente' ? 'bg-warning' :
                                    saldo.estado === 'lista' ? 'bg-success' :
                                    'bg-secondary'
                                  }`}>
                                    {saldo.estado}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Nuevo Ingreso */}
      <div className={`modal fade ${showIngresoModal ? 'show' : ''}`} style={{ display: showIngresoModal ? 'block' : 'none' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-cash-coin text-success me-2"></i>
                Nuevo Ingreso
              </h5>
              <button type="button" className="btn-close" onClick={() => setShowIngresoModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Monto *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0.00"
                  value={nuevoIngreso.monto}
                  onChange={(e) => setNuevoIngreso(prev => ({ ...prev, monto: e.target.value }))}
                  min="0.01"
                  step="0.01"
                />
                <div className="form-text">Ingrese un monto mayor a 0</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Concepto *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Descripción del ingreso"
                  value={nuevoIngreso.concepto}
                  onChange={(e) => setNuevoIngreso(prev => ({ ...prev, concepto: e.target.value }))}
                />
                <div className="form-text">Describa brevemente el motivo del ingreso</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Método de Pago *</label>
                <select 
                  className="form-select" 
                  value={nuevoIngreso.metodoPago} 
                  onChange={(e) => setNuevoIngreso(prev => ({ ...prev, metodoPago: e.target.value }))}
                >
                  {metodosPago.map((metodo) => (
                    <option key={metodo.value} value={metodo.value}>
                      {metodo.label}
                    </option>
                  ))}
                </select>
                <div className="form-text">Seleccione cómo se recibió el pago</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Categoría *</label>
                <select 
                  className="form-select" 
                  value={nuevoIngreso.categoria} 
                  onChange={(e) => setNuevoIngreso(prev => ({ ...prev, categoria: e.target.value }))}
                >
                  {categoriasIngreso.map((categoria) => (
                    <option key={categoria.value} value={categoria.value}>
                      {categoria.label}
                    </option>
                  ))}
                </select>
                <div className="form-text">Clasifique el tipo de ingreso</div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={registrarIngreso}
                disabled={isSaving || !isFormValid(nuevoIngreso)}
                className="btn btn-success"
              >
                {isSaving ? <i className="bi bi-arrow-clockwise spin me-2"></i> : null}
                Registrar Ingreso
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowIngresoModal(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Nuevo Egreso */}
      <div className={`modal fade ${showEgresoModal ? 'show' : ''}`} style={{ display: showEgresoModal ? 'block' : 'none' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-dash-circle text-danger me-2"></i>
                Nuevo Egreso
              </h5>
              <button type="button" className="btn-close" onClick={() => setShowEgresoModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Monto *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0.00"
                  value={nuevoEgreso.monto}
                  onChange={(e) => setNuevoEgreso(prev => ({ ...prev, monto: e.target.value }))}
                  min="0.01"
                  step="0.01"
                />
                <div className="form-text">Ingrese un monto mayor a 0</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Concepto *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Descripción del egreso"
                  value={nuevoEgreso.concepto}
                  onChange={(e) => setNuevoEgreso(prev => ({ ...prev, concepto: e.target.value }))}
                />
                <div className="form-text">Describa brevemente el motivo del egreso</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Método de Pago *</label>
                <select 
                  className="form-select" 
                  value={nuevoEgreso.metodoPago} 
                  onChange={(e) => setNuevoEgreso(prev => ({ ...prev, metodoPago: e.target.value }))}
                >
                  {metodosPago.map((metodo) => (
                    <option key={metodo.value} value={metodo.value}>
                      {metodo.label}
                    </option>
                  ))}
                </select>
                <div className="form-text">Seleccione cómo se realizó el pago</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Categoría *</label>
                <select 
                  className="form-select" 
                  value={nuevoEgreso.categoria} 
                  onChange={(e) => setNuevoEgreso(prev => ({ ...prev, categoria: e.target.value }))}
                >
                  {categoriasEgreso.map((categoria) => (
                    <option key={categoria.value} value={categoria.value}>
                      {categoria.label}
                    </option>
                  ))}
                </select>
                <div className="form-text">Clasifique el tipo de egreso</div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={registrarEgreso}
                disabled={isSaving || !isFormValid(nuevoEgreso)}
                className="btn btn-danger"
              >
                {isSaving ? <i className="bi bi-arrow-clockwise spin me-2"></i> : null}
                Registrar Egreso
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowEgresoModal(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay para modales */}
      {(showIngresoModal || showEgresoModal) && (
        <div className="modal-backdrop fade show" onClick={() => {
          setShowIngresoModal(false);
          setShowEgresoModal(false);
        }}></div>
      )}

      <style jsx>{`
        .modal.show {
          display: block !important;
        }
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 1040;
        }
        .modal {
          z-index: 1050;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

