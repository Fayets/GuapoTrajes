"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { getApiBaseUrl } from "@/lib/api-config";
import { MetodoPagoSelector } from "@/components/metodo-pago-selector";

interface CajaMovimiento {
  id: number;
  hora: string;
  origen: string;
  tipo: string;
  payment_method: string | null;
  categoria: string | null;
  monto: number;
  usuario_nombre: string;
  cuenta_destino_nombre: string | null;
}

interface CajaTotales {
  totales_por_metodo: { [key: string]: number };
  total_general: number;
}


const metodosPago = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "DEBITO", label: "Débito" },
  { value: "CREDITO", label: "Crédito" },
  { value: "BILLETERA_VIRTUAL", label: "Transferencia" },
];

export default function CajaPage() {
  const { me } = useAuth();

  const getLocalDateString = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split("T")[0];
  };

  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([]);
  const [totales, setTotales] = useState<CajaTotales>({
    totales_por_metodo: {},
    total_general: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [fecha, setFecha] = useState(getLocalDateString());
  const [metodoFiltro, setMetodoFiltro] = useState<string>("");
  const [cuentaDestinoFiltro, setCuentaDestinoFiltro] = useState<number | null>(null);
  const [sucursalId, setSucursalId] = useState<number>(1);
  
  // Estados para búsqueda por texto
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Estados para búsqueda
  const [fechaDesde, setFechaDesde] = useState(getLocalDateString());
  const [fechaHasta, setFechaHasta] = useState(getLocalDateString());
  
  // Estados para los modales de ingreso y egreso
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTransferConcentradoraModal, setShowTransferConcentradoraModal] = useState(false);
  const [nuevoIngreso, setNuevoIngreso] = useState({
    monto: "",
    concepto: "",
    metodoPago: "EFECTIVO", // Compatibilidad
    metodoPagoId: null as number | null,
    submetodoPagoId: null as number | null,
    categoria: "OTROS_INGRESOS", // Valor por defecto
    cuentaDestinoId: null as number | null,
  });
  const [cuentasDestino, setCuentasDestino] = useState<Array<{ id: number; nombre_titular: string; sucursal_id: number }>>([]);
  const [nuevaTransferencia, setNuevaTransferencia] = useState({
    monto: "",
    descripcion: "",
  });
  const [nuevaTransferenciaConcentradora, setNuevaTransferenciaConcentradora] = useState({
    monto: "",
    descripcion: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para la conexión del backend
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  // Función de validación para formularios
  const isIngresoValid = (formData: { monto: string; concepto: string; metodoPagoId: number | null; categoria: string; cuentaDestinoId: number | null }) => {
    return (
      formData.monto.trim() !== "" &&
      formData.concepto.trim() !== "" &&
      formData.metodoPagoId !== null &&
      formData.categoria.trim() !== "" &&
      formData.cuentaDestinoId !== null &&
      parseFloat(formData.monto) > 0
    );
  };

  const isTransferValid = (formData: { monto: string; descripcion: string }) => {
    return (
      formData.monto.trim() !== "" &&
      parseFloat(formData.monto) > 0
    );
  };

  const API_BASE = getApiBaseUrl();

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const checkBackendConnection = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/caja/diaria?fecha=${new Date()
          .toISOString()
          .split("T")[0]}&sucursal_id=1`,
        {
          headers: getAuthHeaders(),
        }
      );
      
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

  const fetchCajaDiaria = async () => {
    if (!sucursalId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        fecha: fecha,
        sucursal_id: sucursalId.toString(),
      });
      
      if (metodoFiltro) {
        params.append("payment_method", metodoFiltro);
      }
      
      if (cuentaDestinoFiltro) {
        params.append("cuenta_destino_id", cuentaDestinoFiltro.toString());
      }

      const response = await fetch(
        `${API_BASE}/caja/diaria?${params}`,
        {
          headers: getAuthHeaders(),
        }
      );
      
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
      if (!sucursalId) return;

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

      const response = await fetch(
        `${API_BASE}/caja/buscar?${params}`,
        {
          headers: getAuthHeaders(),
        }
      );
      
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


  const registrarIngreso = async () => {
    // Validar que todos los campos estén completos
    if (!nuevoIngreso.monto || !nuevoIngreso.concepto || !nuevoIngreso.metodoPagoId || !nuevoIngreso.categoria || !nuevoIngreso.cuentaDestinoId) {
      if (!nuevoIngreso.cuentaDestinoId) {
        toast.error("Debes seleccionar una cuenta destino");
      } else if (!nuevoIngreso.metodoPagoId) {
        toast.error("Debes seleccionar un método de pago");
      } else {
        toast.error("Por favor complete todos los campos");
      }
      return;
    }

    // Validar que el monto sea un número válido y positivo
    const montoNumber = parseFloat(nuevoIngreso.monto);
    if (isNaN(montoNumber) || montoNumber <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }

    setIsSaving(true);
    try {
      if (!sucursalId) {
        toast.error("Seleccioná una sucursal antes de registrar el movimiento");
        setIsSaving(false);
        return;
      }
      const payload = {
        tipo: "INGRESO",
        monto: montoNumber,
        origen: nuevoIngreso.concepto,
        metodo_pago_id: nuevoIngreso.metodoPagoId,
        submetodo_pago_id: nuevoIngreso.submetodoPagoId || null,
        payment_method: null, // Ya no se usa, pero mantenido para compatibilidad
        categoria: nuevoIngreso.categoria,
        sucursal_id: sucursalId,
        cuenta_destino_id: nuevoIngreso.cuentaDestinoId,
      };

      const response = await fetch(`${API_BASE}/caja/registrar-movimiento`, {
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
        setNuevoIngreso({ 
          monto: "", 
          concepto: "", 
          metodoPago: "EFECTIVO",
          metodoPagoId: null,
          submetodoPagoId: null,
          categoria: "OTROS_INGRESOS",
          cuentaDestinoId: null
        });
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
    if (!isTransferValid(nuevaTransferencia)) {
      toast.error("Ingresá un monto válido para transferir a Caja Chica");
      return;
    }

    const monto = parseFloat(nuevaTransferencia.monto);
    if (isNaN(monto) || monto <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }

    setIsSaving(true);
    try {
      if (!sucursalId) {
        toast.error("Seleccioná una sucursal antes de registrar el movimiento");
        return;
      }

      const payload = {
        sucursal_id: sucursalId,
        monto,
        descripcion: nuevaTransferencia.descripcion || null,
      };

      const response = await fetch(`${API_BASE}/caja/diaria/transferir-caja-chica`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) {
        const message = result?.message || result?.detail || `Error ${response.status}: ${response.statusText}`;
        throw new Error(message);
      }

      toast.success(
        `$${monto.toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} transferido a Caja Chica exitosamente.`
      );

      setShowTransferModal(false);
      setNuevaTransferencia({ monto: "", descripcion: "" });
      await fetchCajaDiaria();
    } catch (error: any) {
      console.error("Error al transferir a caja chica:", error);
      toast.error(error.message || "No se pudo transferir a Caja Chica");
    } finally {
      setIsSaving(false);
    }
  };

  const registrarEgresoConcentradora = async () => {
    if (!isTransferValid(nuevaTransferenciaConcentradora)) {
      toast.error("Ingresá un monto válido para enviar a Caja Concentradora");
      return;
    }

    const monto = parseFloat(nuevaTransferenciaConcentradora.monto);
    if (isNaN(monto) || monto <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }

    setIsSaving(true);
    try {
      if (!sucursalId) {
        toast.error("Seleccioná una sucursal antes de registrar el movimiento");
        return;
      }

      const payload = {
        sucursal_id: sucursalId,
        monto,
        descripcion: nuevaTransferenciaConcentradora.descripcion || null,
      };

      const response = await fetch(`${API_BASE}/caja/diaria/enviar-caja-concentradora`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) {
        const message = result?.message || result?.detail || `Error ${response.status}: ${response.statusText}`;
        throw new Error(message);
      }

      toast.success(
        `$${monto.toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} enviados correctamente a la Caja Concentradora.`
      );

      setShowTransferConcentradoraModal(false);
      setNuevaTransferenciaConcentradora({ monto: "", descripcion: "" });
      await fetchCajaDiaria();
    } catch (error: any) {
      console.error("Error al enviar a caja concentradora:", error);
      toast.error(error.message || "No se pudo enviar a Caja Concentradora");
    } finally {
      setIsSaving(false);
    }
  };

  const exportarCSV = async () => {
    try {
      const params = new URLSearchParams({
        fecha_desde: fecha,
        fecha_hasta: fecha,
        sucursal_id: sucursalId?.toString() || "1",
      });
      
      if (metodoFiltro) {
        params.append("payment_method", metodoFiltro);
      }

      const response = await fetch(`${API_BASE}/caja/exportar-csv?${params}`, {
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
        sucursal_id: sucursalId?.toString() || "1",
      });
      
      if (metodoFiltro) {
        params.append("payment_method", metodoFiltro);
      }

      const response = await fetch(`${API_BASE}/caja/exportar-excel?${params}`, {
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
    
    // Cargar cuentas destino activas de la sucursal
    const cargarCuentasDestino = async () => {
      try {
        const res = await fetch(`${API_BASE}/cuentas-destino/sucursal/${sucursalId}?solo_activas=true`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Error al obtener cuentas destino");
        const data = await res.json();
        setCuentasDestino(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error al cargar cuentas destino:", error);
      }
    };
    
    cargarCuentasDestino();
    fetchCajaDiaria();
  }, [fecha, sucursalId, metodoFiltro, cuentaDestinoFiltro]);

  // Cargar movimientos al montar el componente
  useEffect(() => {
    checkBackendConnection();
    fetchCajaDiaria();
  }, []);

  useEffect(() => {
    if (me?.sucursalId) {
      setSucursalId(me.sucursalId);
    }
  }, [me?.sucursalId]);

  // Limpiar estado cuando se cierre el modal de egreso
  useEffect(() => {
    if (!showTransferModal) {
      setNuevaTransferencia({
        monto: "",
        descripcion: "",
      });
    }
  }, [showTransferModal]);

  // Limpiar estado cuando se cierre el modal de concentradora
  useEffect(() => {
    if (!showTransferConcentradoraModal) {
      setNuevaTransferenciaConcentradora({
        monto: "",
        descripcion: "",
      });
    }
  }, [showTransferConcentradoraModal]);

  // Limpiar estado cuando se cierre el modal de ingreso
  useEffect(() => {
    if (!showIngresoModal) {
      setNuevoIngreso({
        monto: "",
        concepto: "",
        metodoPago: "EFECTIVO", // Valor por defecto
        metodoPagoId: null,
        submetodoPagoId: null,
        categoria: "OTROS_INGRESOS", // Valor por defecto
        cuentaDestinoId: null,
      });
    }
  }, [showIngresoModal]);

  // Función para mapear métodos configurables / nombres libres a métodos antiguos
  const mapearMetodoConfigurableAEnum = (metodo: string): string => {
    if (!metodo) return "";
    // Normalizar el nombre del método
    const metodoLower = metodo.toLowerCase();
    
    // IMPORTANTE: Verificar "crédito" ANTES de "tarjeta" o "master" para evitar mapeos incorrectos
    // Mapear métodos configurables a valores del enum
    if (metodoLower.includes("efectivo")) return "EFECTIVO";
    if (metodoLower.includes("crédito") || metodoLower.includes("credito")) return "CREDITO";
    if (metodoLower.includes("débito") || metodoLower.includes("debito")) return "DEBITO";
    if (metodoLower.includes("tarjeta") || metodoLower.includes("visa") || metodoLower.includes("master")) {
      // Si contiene "crédito" en el nombre, mapear a CREDITO, sino a DEBITO
      if (metodoLower.includes("crédito") || metodoLower.includes("credito")) {
        return "CREDITO";
      }
      return "DEBITO";
    }
    if (metodoLower.includes("billetera") || metodoLower.includes("mercado pago") || metodoLower.includes("naranja") || metodoLower.includes("uala")) {
      return "BILLETERA_VIRTUAL";
    }
    if (metodoLower.includes("transferencia")) return "TRANSFERENCIA";
    
    // Si no coincide, retornar el método original
    return metodo;
  };

  // Función para calcular totales agrupados por método antiguo
  // IMPORTANTE: se calcula en base a los movimientos visibles (ya filtrados por backend),
  // para que el resumen coincida siempre con la tabla actual.
  const calcularTotalesAgrupados = () => {
    const totalesAgrupados: { [key: string]: number } = {};

    // Inicializar todos los métodos en cero
    metodosPago.forEach(m => {
      totalesAgrupados[m.value] = 0;
    });

    // Agrupar totales a partir de los movimientos actualmente mostrados
    movimientos.forEach((mov) => {
      const metodoEnum = mapearMetodoConfigurableAEnum(mov.payment_method || "");
      if (!metodosPago.find((m) => m.value === metodoEnum)) return;

      const factor = mov.tipo === "EGRESO" ? -1 : 1;
      totalesAgrupados[metodoEnum] += mov.monto * factor;
    });

    return totalesAgrupados;
  };

  const getMetodoPagoLabel = (metodo: string | null) => {
    if (!metodo) return "N/A";
    const metodoObj = metodosPago.find(m => m.value === metodo);
    return metodoObj?.label || metodo;
  };

  const totalesAgrupados = calcularTotalesAgrupados();
  const totalGeneralCalculado = Object.values(totalesAgrupados).reduce(
    (acc, val) => acc + val,
    0
  );

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
            onClick={() => setShowTransferModal(true)}
            className="btn btn-primary"
          >
            <i className="bi bi-arrow-left-right me-2"></i>
            Transferir a Caja Chica
          </button>
          <button 
            onClick={() => setShowTransferConcentradoraModal(true)}
            className="btn btn-info text-white"
          >
            <i className="bi bi-bank me-2"></i>
            Enviar a Caja Concentradora
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

                <div className="col-md-3">
                  <label className="form-label">
                    <i className="bi bi-bank me-2"></i>
                    Cuenta Destino:
                  </label>
                  <select 
                    className="form-select" 
                    value={cuentaDestinoFiltro || ""} 
                    onChange={(e) => setCuentaDestinoFiltro(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Todas las cuentas</option>
                    {cuentasDestino.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre_titular}
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

              {/* Resumen de Totales (Filtros clicables) */}
              <div className="row mb-4">
                {metodosPago.map((metodo) => {
                  const total = totalesAgrupados[metodo.value] || 0;
                  const estaActivo = metodoFiltro === metodo.value;
                  return (
                    <div key={metodo.value} className="col-md-2">
                      <div 
                        className={`card border-0 ${estaActivo ? 'bg-primary bg-opacity-25 border-primary border' : 'bg-light'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setMetodoFiltro(estaActivo ? "" : metodo.value)}
                        title={estaActivo ? "Click para quitar filtro" : "Click para filtrar por este método"}
                      >
                        <div className="card-body text-center">
                          <div className={`small mb-1 ${estaActivo ? 'text-primary fw-bold' : 'text-muted'}`}>
                            {metodo.label}
                            {estaActivo && <i className="bi bi-funnel-fill ms-1"></i>}
                          </div>
                          <div className={`h4 mb-0 ${estaActivo ? 'text-primary' : 'text-success'}`}>
                            ${total.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                <div 
                  className="col-md-2"
                  onClick={() => setMetodoFiltro("")}
                  style={{ cursor: 'pointer' }}
                  title={metodoFiltro ? "Click para quitar filtros" : "Total General"}
                >
                  <div className={`card border-0 ${metodoFiltro ? 'bg-light border border-secondary' : 'bg-primary bg-opacity-10'}`}>
                    <div className="card-body text-center">
                      <div className={`small mb-1 fw-bold ${metodoFiltro ? 'text-secondary' : 'text-primary'}`}>
                        Total General
                        {metodoFiltro && <i className="bi bi-funnel-fill ms-1"></i>}
                      </div>
                      <div className={`h4 mb-0 ${metodoFiltro ? 'text-secondary' : 'text-primary'}`}>
                        ${totalGeneralCalculado.toLocaleString()}
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
                    {(metodoFiltro || cuentaDestinoFiltro) && (
                      <p className="text-muted small">
                        {metodoFiltro && `Filtrado por método: ${getMetodoPagoLabel(metodoFiltro)}`}
                        {metodoFiltro && cuentaDestinoFiltro && " | "}
                        {cuentaDestinoFiltro && `Cuenta destino: ${cuentasDestino.find(c => c.id === cuentaDestinoFiltro)?.nombre_titular || "N/A"}`}
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
                          <th>Destino</th>
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
                            <td>
                              <span className="small text-muted">
                                {movimiento.cuenta_destino_nombre || "N/A"}
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
              <MetodoPagoSelector
                sucursalId={sucursalId}
                metodoPagoId={nuevoIngreso.metodoPagoId}
                submetodoPagoId={nuevoIngreso.submetodoPagoId}
                onMetodoChange={(metodoId, submetodoId, metodoDisplay) => {
                  setNuevoIngreso(prev => ({
                    ...prev,
                    metodoPagoId: metodoId,
                    submetodoPagoId: submetodoId,
                    metodoPago: metodoDisplay
                  }))
                }}
                required={true}
                showError={!nuevoIngreso.metodoPagoId}
                className="mb-3"
              />
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
              <div className="mb-3">
                <label className="form-label">Cuenta Destino *</label>
                <select 
                  className="form-select" 
                  value={nuevoIngreso.cuentaDestinoId || ""} 
                  onChange={(e) => setNuevoIngreso(prev => ({ ...prev, cuentaDestinoId: Number(e.target.value) || null }))}
                >
                  <option value="">Seleccionar cuenta destino</option>
                  {cuentasDestino.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre_titular}
                    </option>
                  ))}
                </select>
                {!nuevoIngreso.cuentaDestinoId && (
                  <div className="text-danger small mt-2">
                    Debes seleccionar una cuenta destino
                  </div>
                )}
                {cuentasDestino.length === 0 && (
                  <div className="text-warning small mt-2">
                    No hay cuentas destino activas disponibles. Contactá a un administrador.
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={registrarIngreso}
                disabled={isSaving || !isIngresoValid(nuevoIngreso)}
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

      {/* Modal Transferir a Caja Chica */}
      <div className={`modal fade ${showTransferModal ? 'show' : ''}`} style={{ display: showTransferModal ? 'block' : 'none' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-arrow-left-right text-primary me-2"></i>
                Transferir a Caja Chica
              </h5>
              <button type="button" className="btn-close" onClick={() => setShowTransferModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Monto *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0.00"
                  value={nuevaTransferencia.monto}
                  onChange={(e) => setNuevaTransferencia(prev => ({ ...prev, monto: e.target.value }))}
                  min="0.01"
                  step="0.01"
                />
                <div className="form-text">Ingrese un monto mayor a 0</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Método de Pago</label>
                <input
                  type="text"
                  className="form-control"
                  value="Efectivo"
                  disabled
                  readOnly
                />
                <div className="form-text">Los egresos se registran exclusivamente en efectivo para transferir a Caja Chica.</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Destino</label>
                <input
                  type="text"
                  className="form-control"
                  value="Caja Chica"
                  disabled
                  readOnly
                />
                <div className="form-text">El efectivo quedará disponible inmediatamente en la Caja Chica de la sucursal.</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Detalle de la transferencia (opcional)"
                  value={nuevaTransferencia.descripcion}
                  onChange={(e) => setNuevaTransferencia(prev => ({ ...prev, descripcion: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={registrarEgreso}
                disabled={isSaving || !isTransferValid(nuevaTransferencia)}
                className="btn btn-primary"
              >
                {isSaving ? <i className="bi bi-arrow-clockwise spin me-2"></i> : null}
                Transferir
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowTransferModal(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Transferir a Caja Concentradora */}
      <div className={`modal fade ${showTransferConcentradoraModal ? 'show' : ''}`} style={{ display: showTransferConcentradoraModal ? 'block' : 'none' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-bank text-info me-2"></i>
                Enviar a Caja Concentradora
              </h5>
              <button type="button" className="btn-close" onClick={() => setShowTransferConcentradoraModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Monto *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0.00"
                  value={nuevaTransferenciaConcentradora.monto}
                  onChange={(e) => setNuevaTransferenciaConcentradora(prev => ({ ...prev, monto: e.target.value }))}
                  min="0.01"
                  step="0.01"
                />
                <div className="form-text">Ingrese un monto mayor a 0</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Método de Pago</label>
                <input
                  type="text"
                  className="form-control"
                  value="Efectivo"
                  disabled
                  readOnly
                />
                <div className="form-text">Los envíos a Caja Concentradora se registran exclusivamente en efectivo.</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Destino</label>
                <input
                  type="text"
                  className="form-control"
                  value="Caja Concentradora"
                  disabled
                  readOnly
                />
                <div className="form-text">El efectivo quedará disponible en la Caja Concentradora de la sucursal.</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Detalle de la transferencia (opcional)"
                  value={nuevaTransferenciaConcentradora.descripcion}
                  onChange={(e) => setNuevaTransferenciaConcentradora(prev => ({ ...prev, descripcion: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={registrarEgresoConcentradora}
                disabled={isSaving || !isTransferValid(nuevaTransferenciaConcentradora)}
                className="btn btn-info text-white"
              >
                {isSaving ? <i className="bi bi-arrow-clockwise spin me-2"></i> : null}
                Enviar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowTransferConcentradoraModal(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay para modales */}
      {(showIngresoModal || showTransferModal || showTransferConcentradoraModal) && (
        <div className="modal-backdrop fade show" style={{ display: "block" }}></div>
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

