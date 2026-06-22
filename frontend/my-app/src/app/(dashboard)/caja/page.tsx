"use client";
import { useEffect, useRef, useState } from "react";
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
  /** Tipo normalizado del backend (EFECTIVO, DEBITO, CREDITO, etc.) para las cajas */
  payment_method_type?: string | null;
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
  const { me, isAdmin } = useAuth();
  const esAdmin = isAdmin || me?.role === "SUPER_ADMIN";

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
  const [exportando, setExportando] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTipo, setExportTipo] = useState<"dia" | "periodo">("dia");
  const [exportFechaDia, setExportFechaDia] = useState(getLocalDateString());
  const [exportFechaDesde, setExportFechaDesde] = useState(getLocalDateString());
  const [exportFechaHasta, setExportFechaHasta] = useState(getLocalDateString());
  const [exportFormato, setExportFormato] = useState<"excel" | "pdf">("excel");
  
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
  const [saldoEfectivo, setSaldoEfectivo] = useState(0);
  const [cierreRegistrado, setCierreRegistrado] = useState(false);
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [isCerrando, setIsCerrando] = useState(false);
  const [cierresPendientes, setCierresPendientes] = useState<Array<{ sucursal_id: number; sucursal_nombre: string; fecha: string }>>([]);
  const [cuentaRegresiva2359, setCuentaRegresiva2359] = useState<string>("");

  // Estado para la conexión del backend
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  // Para mostrar el toast de carga solo una vez al entrar a la página
  const loadToastShownRef = useRef(false);

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
    { value: "CUENTA_CORRIENTE", label: "Cuenta corriente" },
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
        setSaldoEfectivo(typeof data.saldo_efectivo === "number" ? data.saldo_efectivo : 0);
        setCierreRegistrado(Boolean(data.cierre_registrado));
        if (!loadToastShownRef.current) {
          loadToastShownRef.current = true;
          toast.success(`Caja diaria cargada: ${data.movimientos.length} movimientos`);
        }
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

  const confirmarCierreCaja = async () => {
    if (Math.abs(saldoParaCierre) > 0.01) {
      toast.error("El saldo en efectivo debe ser $0 para cerrar. Usá los botones de arriba para enviar dinero a Caja Chica o Caja Concentradora.");
      return;
    }
    if (!sucursalId) {
      toast.error("No hay sucursal seleccionada");
      return;
    }
    setIsCerrando(true);
    try {
      const response = await fetch(`${API_BASE}/caja/diaria/cierre`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ fecha, sucursal_id: sucursalId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || result.message || "Error al registrar cierre");
      }
      toast.success("Cierre de caja registrado correctamente");
      setShowCierreModal(false);
      await fetchCajaDiaria();
    } catch (error: any) {
      toast.error(error.message || "No se pudo registrar el cierre");
    } finally {
      setIsCerrando(false);
    }
  };

  const abrirModalExportacion = () => {
    setExportTipo("dia");
    setExportFechaDia(fecha);
    setExportFechaDesde(fecha);
    setExportFechaHasta(fecha);
    setExportFormato("excel");
    setShowExportModal(true);
  };

  const resolverRangoExportacion = (): { desde: string; hasta: string } | null => {
    if (exportTipo === "dia") {
      if (!exportFechaDia) {
        toast.error("Seleccioná un día para exportar");
        return null;
      }
      return { desde: exportFechaDia, hasta: exportFechaDia };
    }
    if (!exportFechaDesde || !exportFechaHasta) {
      toast.error("Indicá fecha desde y fecha hasta");
      return null;
    }
    if (exportFechaDesde > exportFechaHasta) {
      toast.error("La fecha desde no puede ser posterior a la fecha hasta");
      return null;
    }
    return { desde: exportFechaDesde, hasta: exportFechaHasta };
  };

  const descargarArchivoExport = (blob: Blob, nombre: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const ejecutarExportacion = async () => {
    const rango = resolverRangoExportacion();
    if (!rango) return;

    setExportando(true);
    try {
      const params = new URLSearchParams({
        fecha_desde: rango.desde,
        fecha_hasta: rango.hasta,
        sucursal_id: sucursalId?.toString() || "1",
      });

      if (metodoFiltro) {
        params.append("payment_method", metodoFiltro);
      }
      if (cuentaDestinoFiltro) {
        params.append("cuenta_destino_id", cuentaDestinoFiltro.toString());
      }

      const endpoint =
        exportFormato === "pdf"
          ? `${API_BASE}/caja/exportar-pdf?${params}`
          : `${API_BASE}/caja/exportar-excel?${params}`;

      const response = await fetch(endpoint, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Error al exportar");
      }

      const blob = await response.blob();
      const extension = exportFormato === "pdf" ? "pdf" : "xlsx";
      descargarArchivoExport(
        blob,
        `caja_diaria_${rango.desde}_${rango.hasta}.${extension}`
      );
      toast.success(
        exportFormato === "pdf"
          ? "PDF exportado correctamente"
          : "Excel exportado correctamente"
      );
      setShowExportModal(false);
    } catch (error: any) {
      toast.error("Error al exportar: " + error.message);
    } finally {
      setExportando(false);
    }
  };

  useEffect(() => {
    if (!sucursalId) return;
    fetchCajaDiaria();

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
  }, [fecha, sucursalId, metodoFiltro, cuentaDestinoFiltro]);

  useEffect(() => {
    checkBackendConnection();
  }, []);

  useEffect(() => {
    if (!esAdmin) return;
    const fetchPendientes = async () => {
      try {
        const res = await fetch(`${API_BASE}/caja/cierres-pendientes`, { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        setCierresPendientes(data.pendientes || []);
      } catch {
        setCierresPendientes([]);
      }
    };
    fetchPendientes();
  }, [esAdmin, fecha]);

  // Contador en tiempo real hasta las 23:59
  useEffect(() => {
    const actualizar = () => {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      const ms = endOfDay.getTime() - now.getTime();
      if (ms <= 0) {
        setCuentaRegresiva2359("Hoy ya pasó las 23:59");
        return;
      }
      const s = Math.floor((ms / 1000) % 60);
      const m = Math.floor((ms / (1000 * 60)) % 60);
      const h = Math.floor(ms / (1000 * 60 * 60));
      if (h > 0) {
        setCuentaRegresiva2359(`Faltan ${h}h ${m}m ${s}s para las 23:59`);
      } else if (m > 0) {
        setCuentaRegresiva2359(`Faltan ${m}m ${s}s para las 23:59`);
      } else {
        setCuentaRegresiva2359(`Faltan ${s}s para las 23:59`);
      }
    };
    actualizar();
    const id = setInterval(actualizar, 1000);
    return () => clearInterval(id);
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

  // Función para calcular totales agrupados por método antiguo.
  // El panel superior solo suma INGRESOS; los egresos no se restan (no se descuentan del total).
  const calcularTotalesAgrupados = () => {
    const totalesAgrupados: { [key: string]: number } = {};

    metodosPago.forEach(m => {
      totalesAgrupados[m.value] = 0;
    });

    movimientos.forEach((mov) => {
      if (mov.tipo !== "INGRESO") return;

      let metodoEnum =
        (mov.payment_method_type && metodosPago.some((m) => m.value === mov.payment_method_type))
          ? mov.payment_method_type!
          : mapearMetodoConfigurableAEnum(mov.payment_method || "");
      if (metodoEnum === "TRANSFERENCIA") metodoEnum = "BILLETERA_VIRTUAL";

      if (!metodosPago.find((m) => m.value === metodoEnum)) return;

      totalesAgrupados[metodoEnum] += mov.monto;
    });

    return totalesAgrupados;
  };

  const getMetodoPagoLabel = (metodo: string | null) => {
    if (!metodo) return "N/A";
    // Mostrar "Transferencia" cuando el backend envía TRANSFERENCIA
    if (metodo === "TRANSFERENCIA") return "Transferencia";
    const metodoObj = metodosPago.find(m => m.value === metodo);
    return metodoObj?.label || metodo;
  };

  const totalesAgrupados = calcularTotalesAgrupados();
  const totalGeneralCalculado = Object.values(totalesAgrupados).reduce(
    (acc, val) => acc + val,
    0
  );

  // Saldo efectivo calculado desde los movimientos actuales (dinámico: se actualiza al transferir sin esperar refetch)
  const saldoEfectivoCalculado = movimientos.reduce((acc, mov) => {
    const esEfectivo =
      mov.payment_method_type === "EFECTIVO" ||
      (typeof mov.payment_method === "string" && /efectivo/i.test(mov.payment_method));
    if (!esEfectivo) return acc;
    return acc + (mov.tipo === "INGRESO" ? mov.monto : -mov.monto);
  }, 0);
  const saldoParaCierre = Math.round(saldoEfectivoCalculado * 100) / 100;

  const getMetodoPagoColor = (metodo: string | null) => {
    if (!metodo) return "bg-secondary";
    if (metodo === "TRANSFERENCIA") return "bg-warning"; // misma caja que Transferencia
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
    <div className="container-fluid px-3 px-md-4 py-3">
      {/* Header */}
      <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-2 gap-lg-3 mb-3">
        <div>
          <h1 className="fw-bold fs-3 mb-1">Caja Diaria</h1>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <p className="text-muted small mb-0">
              Gestión de movimientos de caja y reportes
            </p>
            <span className="text-muted small d-none d-sm-inline">·</span>
            <div className="d-flex align-items-center gap-1">
              <div
                className={`rounded-circle ${
                  backendStatus === "connected"
                    ? "bg-success"
                    : backendStatus === "error"
                      ? "bg-danger"
                      : "bg-warning"
                }`}
                style={{ width: "0.45rem", height: "0.45rem" }}
              />
              <span
                className={`small ${
                  backendStatus === "connected"
                    ? "text-success"
                    : backendStatus === "error"
                      ? "text-danger"
                      : "text-warning"
                }`}
              >
                {backendStatus === "connected"
                  ? "Conectado"
                  : backendStatus === "error"
                    ? "Sin conexión"
                    : "Verificando..."}
              </span>
              {backendStatus === "error" && (
                <button
                  onClick={checkBackendConnection}
                  className="btn btn-link btn-sm p-0 ms-1"
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <button
            onClick={() => setShowIngresoModal(true)}
            className="btn btn-success btn-sm"
          >
            <i className="bi bi-plus-lg me-1"></i>
            Nuevo ingreso
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            className="btn btn-primary btn-sm"
            title="Transferir a Caja Chica"
          >
            <i className="bi bi-arrow-left-right me-1"></i>
            Caja chica
          </button>
          <button
            onClick={() => setShowTransferConcentradoraModal(true)}
            className="btn btn-info btn-sm text-white"
            title="Enviar a Caja Concentradora"
          >
            <i className="bi bi-bank me-1"></i>
            Concentradora
          </button>
          <button
            type="button"
            onClick={abrirModalExportacion}
            disabled={exportando}
            className="btn btn-outline-secondary btn-sm"
          >
            <i className="bi bi-download me-1"></i>
            Exportar
          </button>
        </div>
      </div>

      {/* Alerta administrador: cajas sin cerrar */}
      {esAdmin && cierresPendientes.length > 0 && (
        <div
          className="alert alert-warning py-2 px-3 d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 small"
          role="alert"
        >
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <div>
              <strong>
                {cierresPendientes.length} sucursal
                {cierresPendientes.length !== 1 ? "es" : ""} con caja sin cerrar
              </strong>
              <span className="d-block text-muted">
                {cierresPendientes
                  .map((p) => `${p.sucursal_nombre} (${p.fecha})`)
                  .join(", ")}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-body p-3">
              {/* Filtros */}
              <div className="row g-2 align-items-end mb-3">
                <div className="col-6 col-md-3">
                  <label className="form-label small text-muted mb-1">Fecha</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>

                <div className="col-6 col-md-3">
                  <label className="form-label small text-muted mb-1">Método</label>
                  <select
                    className="form-select form-select-sm"
                    value={metodoFiltro}
                    onChange={(e) => setMetodoFiltro(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {metodosPago.map((metodo) => (
                      <option key={metodo.value} value={metodo.value}>
                        {metodo.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-8 col-md-4">
                  <label className="form-label small text-muted mb-1">
                    Cuenta destino
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={cuentaDestinoFiltro || ""}
                    onChange={(e) =>
                      setCuentaDestinoFiltro(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                  >
                    <option value="">Todas</option>
                    {cuentasDestino.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre_titular}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-4 col-md-2">
                  <button
                    onClick={fetchCajaDiaria}
                    disabled={isLoading}
                    className="btn btn-outline-secondary btn-sm w-100"
                  >
                    {isLoading ? (
                      <i className="bi bi-arrow-clockwise spin"></i>
                    ) : (
                      <i className="bi bi-arrow-clockwise"></i>
                    )}
                    <span className="ms-1 d-none d-xl-inline">Refrescar</span>
                  </button>
                </div>
              </div>

              {/* Cierre de caja */}
              <div
                className={`rounded border px-3 py-2 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2 ${
                  saldoParaCierre > 0 && !cierreRegistrado
                    ? "border-warning bg-warning bg-opacity-10"
                    : "border-light bg-light"
                }`}
              >
                <div className="d-flex align-items-center gap-2 min-w-0">
                  <i
                    className={`bi bi-cash-stack fs-5 flex-shrink-0 ${
                      cierreRegistrado
                        ? "text-success"
                        : saldoParaCierre > 0
                          ? "text-warning"
                          : "text-secondary"
                    }`}
                  />
                  <div className="small">
                    {cierreRegistrado ? (
                      <span className="text-success fw-semibold">
                        Caja cerrada para este día
                      </span>
                    ) : saldoParaCierre > 0 ? (
                      <>
                        <span className="text-warning fw-semibold">
                          Falta para cierre: $
                          {saldoParaCierre.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-muted ms-2">
                          <i className="bi bi-clock me-1"></i>
                          {cuentaRegresiva2359}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-muted">
                          Saldo efectivo: $0 — Podés cerrar caja
                        </span>
                        <span className="text-muted ms-2">
                          <i className="bi bi-clock me-1"></i>
                          {cuentaRegresiva2359}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {!cierreRegistrado && (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm flex-shrink-0"
                    onClick={() => setShowCierreModal(true)}
                  >
                    <i className="bi bi-lock me-1"></i>
                    Cierre de caja
                  </button>
                )}
              </div>

              {/* Resumen de totales */}
              <div className="d-flex flex-wrap gap-2 mb-3">
                {metodosPago.map((metodo) => {
                  const total = totalesAgrupados[metodo.value] || 0;
                  const estaActivo = metodoFiltro === metodo.value;
                  return (
                    <button
                      key={metodo.value}
                      type="button"
                      className={`btn btn-sm text-start border ${
                        estaActivo
                          ? "border-primary bg-primary bg-opacity-10"
                          : "border-light bg-white"
                      }`}
                      style={{ minWidth: "6.5rem" }}
                      onClick={() =>
                        setMetodoFiltro(estaActivo ? "" : metodo.value)
                      }
                      title={
                        estaActivo
                          ? "Quitar filtro"
                          : `Filtrar por ${metodo.label}`
                      }
                    >
                      <div
                        className={`small lh-1 mb-1 ${
                          estaActivo ? "text-primary fw-semibold" : "text-muted"
                        }`}
                      >
                        {metodo.label}
                        {estaActivo && (
                          <i className="bi bi-funnel-fill ms-1"></i>
                        )}
                      </div>
                      <div
                        className={`fw-semibold ${
                          estaActivo ? "text-primary" : "text-success"
                        }`}
                      >
                        ${total.toLocaleString("es-AR")}
                      </div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`btn btn-sm text-start border ${
                    metodoFiltro
                      ? "border-secondary bg-light"
                      : "border-primary bg-primary bg-opacity-10"
                  }`}
                  style={{ minWidth: "6.5rem" }}
                  onClick={() => setMetodoFiltro("")}
                  title={metodoFiltro ? "Quitar filtros" : "Total general"}
                >
                  <div
                    className={`small lh-1 mb-1 fw-semibold ${
                      metodoFiltro ? "text-secondary" : "text-primary"
                    }`}
                  >
                    Total
                    {metodoFiltro && (
                      <i className="bi bi-funnel-fill ms-1"></i>
                    )}
                  </div>
                  <div
                    className={`fw-semibold ${
                      metodoFiltro ? "text-secondary" : "text-primary"
                    }`}
                  >
                    ${totalGeneralCalculado.toLocaleString("es-AR")}
                  </div>
                </button>
              </div>

              {/* Movimientos */}
              <div className="border rounded">
                <div className="px-3 py-2 border-bottom bg-light d-flex align-items-center justify-content-between">
                  <span className="fw-semibold small">Movimientos del día</span>
                  <span className="text-muted small">
                    {movimientos.length} encontrado
                    {movimientos.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {isLoading ? (
                  <div className="text-center text-muted py-4 small">
                    <i className="bi bi-arrow-clockwise spin fs-4 d-block mb-2"></i>
                    Cargando movimientos...
                  </div>
                ) : movimientos.length === 0 ? (
                  <div className="text-center text-muted py-4 px-3">
                    <i className="bi bi-inbox fs-2 d-block mb-2 opacity-50"></i>
                    <p className="small mb-1 fw-medium">No hay movimientos</p>
                    <p className="small mb-0 text-muted">
                      {new Date(fecha).toLocaleDateString("es-AR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {(metodoFiltro || cuentaDestinoFiltro) && (
                      <p className="text-muted small mt-2 mb-0">
                        {metodoFiltro &&
                          `Método: ${getMetodoPagoLabel(metodoFiltro)}`}
                        {metodoFiltro && cuentaDestinoFiltro && " · "}
                        {cuentaDestinoFiltro &&
                          `Cuenta: ${
                            cuentasDestino.find(
                              (c) => c.id === cuentaDestinoFiltro
                            )?.nombre_titular || "N/A"
                          }`}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0 align-middle small">
                      <thead className="table-light">
                        <tr>
                          <th>Hora</th>
                          <th>Origen</th>
                          <th>Tipo</th>
                          <th>Categoría</th>
                          <th>Método</th>
                          <th className="text-end">Monto</th>
                          <th>Usuario</th>
                          <th>Destino</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.map((movimiento) => (
                          <tr key={movimiento.id}>
                            <td className="fw-medium text-nowrap">
                              {movimiento.hora}
                            </td>
                            <td>{movimiento.origen}</td>
                            <td>
                              <span
                                className={`badge ${
                                  movimiento.tipo === "INGRESO"
                                    ? "bg-success"
                                    : "bg-danger"
                                }`}
                              >
                                {movimiento.tipo}
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-secondary bg-opacity-75">
                                {movimiento.categoria || "N/A"}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge ${getMetodoPagoColor(
                                  movimiento.payment_method_type ||
                                    movimiento.payment_method
                                )}`}
                              >
                                {movimiento.payment_method || "N/A"}
                              </span>
                            </td>
                            <td className="text-end fw-semibold text-nowrap">
                              <span
                                className={
                                  movimiento.tipo === "INGRESO"
                                    ? "text-success"
                                    : "text-danger"
                                }
                              >
                                {movimiento.tipo === "INGRESO" ? "+" : "-"}$
                                {movimiento.monto.toLocaleString("es-AR")}
                              </span>
                            </td>
                            <td className="text-muted">
                              {movimiento.usuario_nombre}
                            </td>
                            <td className="text-muted">
                              {movimiento.cuenta_destino_nombre || "N/A"}
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

      {/* Modal de Nuevo Ingreso */}
      <div className={`modal fade ${showIngresoModal ? 'show' : ''}`} style={{ display: showIngresoModal ? 'block' : 'none' }}>
        <div className="modal-dialog modal-dialog-centered">
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
                  setNuevoIngreso(prev => {
                    const next = {
                      ...prev,
                      metodoPagoId: metodoId,
                      submetodoPagoId: submetodoId,
                      metodoPago: metodoDisplay
                    };
                    if (metodoDisplay && /efectivo/i.test(metodoDisplay.trim())) {
                      const cuentaEfectivo = cuentasDestino.find(c => /efectivo/i.test((c.nombre_titular || "").trim()));
                      if (cuentaEfectivo) next.cuentaDestinoId = cuentaEfectivo.id;
                    }
                    return next;
                  });
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
            <div className="modal-footer py-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowIngresoModal(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                onClick={registrarIngreso}
                disabled={isSaving || !isIngresoValid(nuevoIngreso)}
                className="btn btn-success btn-sm"
              >
                {isSaving ? <i className="bi bi-arrow-clockwise spin me-1"></i> : null}
                Registrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Transferir a Caja Chica */}
      <div className={`modal fade ${showTransferModal ? 'show' : ''}`} style={{ display: showTransferModal ? 'block' : 'none' }}>
        <div className="modal-dialog modal-dialog-centered modal-sm">
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
            <div className="modal-footer py-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowTransferModal(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                onClick={registrarEgreso}
                disabled={isSaving || !isTransferValid(nuevaTransferencia)}
                className="btn btn-primary btn-sm"
              >
                {isSaving ? <i className="bi bi-arrow-clockwise spin me-1"></i> : null}
                Transferir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Transferir a Caja Concentradora */}
      <div className={`modal fade ${showTransferConcentradoraModal ? 'show' : ''}`} style={{ display: showTransferConcentradoraModal ? 'block' : 'none' }}>
        <div className="modal-dialog modal-dialog-centered modal-sm">
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
            <div className="modal-footer py-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowTransferConcentradoraModal(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                onClick={registrarEgresoConcentradora}
                disabled={isSaving || !isTransferValid(nuevaTransferenciaConcentradora)}
                className="btn btn-info btn-sm text-white"
              >
                {isSaving ? <i className="bi bi-arrow-clockwise spin me-1"></i> : null}
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Exportar movimientos */}
      <div
        className={`modal fade ${showExportModal ? "show" : ""}`}
        style={{ display: showExportModal ? "block" : "none" }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header py-2">
              <h5 className="modal-title fs-6">
                <i className="bi bi-download me-2"></i>
                Exportar movimientos
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowExportModal(false)}
                disabled={exportando}
                aria-label="Cerrar"
              />
            </div>
            <div className="modal-body pt-2">
              <p className="small text-muted mb-3">
                Se exporta el detalle de movimientos (ingresos y egresos) del
                rango elegido.
              </p>

              <fieldset className="mb-3">
                <legend className="form-label small fw-semibold mb-2">
                  Rango de fechas
                </legend>
                <div className="border rounded p-3 bg-light">
                  <div className="mb-0">
                    <div className="form-check">
                      <input
                        type="radio"
                        className="form-check-input"
                        id="export-tipo-dia"
                        name="export-tipo"
                        checked={exportTipo === "dia"}
                        onChange={() => setExportTipo("dia")}
                      />
                      <label
                        className="form-check-label"
                        htmlFor="export-tipo-dia"
                      >
                        Un día en específico
                      </label>
                    </div>
                    {exportTipo === "dia" && (
                      <div className="mt-2 ps-4">
                        <label
                          htmlFor="export-fecha-dia"
                          className="form-label small text-muted mb-1"
                        >
                          Fecha
                        </label>
                        <input
                          id="export-fecha-dia"
                          type="date"
                          className="form-control form-control-sm"
                          style={{ maxWidth: "11rem" }}
                          value={exportFechaDia}
                          onChange={(e) => setExportFechaDia(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <hr className="my-3 opacity-25" />

                  <div className="mb-0">
                    <div className="form-check">
                      <input
                        type="radio"
                        className="form-check-input"
                        id="export-tipo-periodo"
                        name="export-tipo"
                        checked={exportTipo === "periodo"}
                        onChange={() => setExportTipo("periodo")}
                      />
                      <label
                        className="form-check-label"
                        htmlFor="export-tipo-periodo"
                      >
                        Período de fechas
                      </label>
                    </div>
                    {exportTipo === "periodo" && (
                      <div className="mt-2 ps-4">
                        <div className="row g-2 align-items-end">
                          <div className="col-6">
                            <label
                              htmlFor="export-fecha-desde"
                              className="form-label small text-muted mb-1"
                            >
                              Desde
                            </label>
                            <input
                              id="export-fecha-desde"
                              type="date"
                              className="form-control form-control-sm"
                              value={exportFechaDesde}
                              onChange={(e) =>
                                setExportFechaDesde(e.target.value)
                              }
                            />
                          </div>
                          <div className="col-6">
                            <label
                              htmlFor="export-fecha-hasta"
                              className="form-label small text-muted mb-1"
                            >
                              Hasta
                            </label>
                            <input
                              id="export-fecha-hasta"
                              type="date"
                              className="form-control form-control-sm"
                              value={exportFechaHasta}
                              onChange={(e) =>
                                setExportFechaHasta(e.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="form-label small fw-semibold mb-2">
                  Formato
                </legend>
                <div
                  className="btn-group w-100"
                  role="group"
                  aria-label="Formato de exportación"
                >
                  <input
                    type="radio"
                    className="btn-check"
                    name="export-formato"
                    id="export-formato-excel"
                    checked={exportFormato === "excel"}
                    onChange={() => setExportFormato("excel")}
                  />
                  <label
                    className="btn btn-outline-secondary btn-sm"
                    htmlFor="export-formato-excel"
                  >
                    <i className="bi bi-file-earmark-spreadsheet me-1"></i>
                    Excel
                  </label>
                  <input
                    type="radio"
                    className="btn-check"
                    name="export-formato"
                    id="export-formato-pdf"
                    checked={exportFormato === "pdf"}
                    onChange={() => setExportFormato("pdf")}
                  />
                  <label
                    className="btn btn-outline-secondary btn-sm"
                    htmlFor="export-formato-pdf"
                  >
                    <i className="bi bi-filetype-pdf me-1"></i>
                    PDF
                  </label>
                </div>
              </fieldset>
            </div>
            <div className="modal-footer py-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowExportModal(false)}
                disabled={exportando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={ejecutarExportacion}
                disabled={exportando}
              >
                {exportando ? (
                  <i className="bi bi-arrow-clockwise spin me-1"></i>
                ) : (
                  <i className="bi bi-download me-1"></i>
                )}
                Exportar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Cierre de caja */}
      <div className={`modal fade ${showCierreModal ? "show" : ""}`} style={{ display: showCierreModal ? "block" : "none" }}>
        <div className="modal-dialog modal-dialog-centered modal-sm">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-lock me-2"></i>
                Cierre de caja
              </h5>
              <button type="button" className="btn-close" onClick={() => setShowCierreModal(false)} disabled={isCerrando} aria-label="Cerrar"></button>
            </div>
            <div className="modal-body">
              <p className="text-muted">
                La caja debe quedar en <strong>cero</strong> (efectivo) antes del próximo día. Distribuí el dinero con los botones <strong>Transferir a Caja Chica</strong> y <strong>Enviar a Caja Concentradora</strong>.
              </p>
              <div className="alert alert-light border py-2 px-3 mb-2 d-flex align-items-center justify-content-between small">
                <span className="text-muted">Saldo efectivo</span>
                <span className={`fw-bold ${Math.abs(saldoParaCierre) < 0.01 ? "text-success" : "text-warning"}`}>
                  ${saldoParaCierre.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {Math.abs(saldoParaCierre) >= 0.01 && (
                <p className="small text-warning mb-0">
                  No se puede confirmar el cierre hasta que el saldo sea $0.
                </p>
              )}
            </div>
            <div className="modal-footer py-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowCierreModal(false)}
                disabled={isCerrando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={confirmarCierreCaja}
                disabled={isCerrando || Math.abs(saldoParaCierre) >= 0.01}
              >
                {isCerrando ? <i className="bi bi-arrow-clockwise spin me-1"></i> : null}
                Confirmar cierre
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay para modales */}
      {(showIngresoModal || showTransferModal || showTransferConcentradoraModal || showCierreModal || showExportModal) && (
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

