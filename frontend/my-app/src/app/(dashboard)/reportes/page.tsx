"use client";
import { useMemo, useState, useEffect } from "react";
import {
  ClipboardList,
  Shirt,
  History,
  Users,
  FileText,
  Receipt,
  CircleDollarSign,
  Boxes,
  ListOrdered,
  CircleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api-config";
import { useAuth } from "@/context/auth-context";
import { format, startOfWeek, addDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  downloadExcelFromAoA,
  downloadExcelFromSheets,
} from "@/lib/export-excel";
import { imprimirEtiquetas100x50Lote } from "@/lib/imprimir-etiqueta-100x50";
import {
  construirEtiquetaResumenConjunto,
  imprimirEtiquetaResumenConjunto,
} from "@/lib/imprimir-etiqueta-conjunto-completo";
import { IconoPercha } from "@/components/icono-percha";
import { ConfigImpresionEtiquetas } from "@/components/config-impresion-etiquetas";
import type { ResultadoImpresionEtiqueta } from "@/lib/imprimir-etiqueta-routing";
import { resolverLocatarioContrato } from "@/lib/contrato-locatario";

interface AlquilerPorPrenda {
  producto_id: number;
  codigo_barra: string;
  descripcion: string;
  linea: string;
  talle: string;
  color: string;
  tela: string;
  sucursal_id: number;
  sucursal_nombre: string;
  cantidad_total_alquilada: number;
  cantidad_veces_alquilada: number;
  fechas_alquiler: string[];
}

interface RankingAlquileres extends AlquilerPorPrenda {
  posicion: number;
}

interface Contrato {
  tipo: "presupuesto" | "orden_trabajo";
  id: number;
  presupuesto_id: number;
  orden_trabajo_id?: number | null;
  numero: string;
  cliente_id: number;
  cliente_nombre: string;
  cliente_dni: string;
  fecha_creacion: string;
  fecha_evento: string | null;
  fecha_retiro: string | null;
  fecha_devolucion: string | null;
  categoria_evento: string;
  nombre_agasajado: string;
  lugar_evento: string;
  total: number;
  estado: string;
  cantidad_items: number;
  tiene_orden_trabajo: boolean;
  observaciones: string;
  seña_pagada?: number | null;
  saldo_pendiente?: number | null;
  metodo_pago?: string | null;
}

type EstadoColaEtiqueta = "pendiente" | "imprimiendo" | "ok" | "error";

interface PrendaAArmarProducto {
  producto_id: number;
  codigo_barra: string;
  descripcion: string;
  linea: string | null;
  talle: string | null;
  color: string | null;
  tela: string | null;
  descripcion_extra?: string;
  cantidad: number;
  es_critico_armado?: boolean;
  motivo_critico_armado?: string;
  ubicacion_critica?: string;
  requiere_modista?: boolean;
  notas_modista?: string;
  fecha_retiro?: string;
}

interface PrendaAArmarOrden {
  orden_id: number;
  presupuesto_numero: string;
  es_precliente?: boolean;
  cliente_nombre: string;
  cliente_dni: string;
  cliente_celular: string;
  cliente_direccion: string;
  fecha_evento: string;
  fecha_retiro: string;
  categoria_evento?: string;
  nombre_agasajado?: string;
  lugar_evento?: string;
  total: number;
  cantidad_total_items: number;
  etiquetas_impresas_en_orden?: boolean;
  etiquetas_armado_impresas_at?: string | null;
  conjunto_separado?: boolean;
  productos: PrendaAArmarProducto[];
}

interface ItemColaEtiquetaVisual {
  key: string;
  productoId: number;
  codigoBarra: string;
  descripcion: string;
  clienteNombre: string;
  estado: EstadoColaEtiqueta;
}

export default function ReportesPage() {
  const { token, me } = useAuth();
  const esEmpleado = me?.role === "EMPLEADO";

  // Función helper para formatear fechas de forma segura
  const formatearFecha = (fechaString: string | null | undefined): string => {
    if (!fechaString) return "N/A";
    try {
      const fecha = new Date(
        fechaString.includes("T") ? fechaString : fechaString + "T00:00:00"
      );
      if (isNaN(fecha.getTime())) return "N/A";
      return format(fecha, "dd/MM/yyyy", { locale: es });
    } catch {
      return "N/A";
    }
  };

  const [selectedReporte, setSelectedReporte] = useState<string>(
    esEmpleado ? "conjuntos_a_armar" : "alquileres_por_prenda"
  );

  // Estados para el reporte de alquileres por prenda
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [alquileres, setAlquileres] = useState<AlquilerPorPrenda[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Estados para el reporte de ranking de alquileres
  const [fechaDesdeRanking, setFechaDesdeRanking] = useState("");
  const [fechaHastaRanking, setFechaHastaRanking] = useState("");
  const [filtroVeces, setFiltroVeces] = useState<
    "todos" | "cero" | "menos_10" | "mas_10"
  >("todos");
  const [ranking, setRanking] = useState<RankingAlquileres[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const productosPorPagina = 10;

  // Estados para el reporte de contratos por fecha
  const [fechaDesdeContratos, setFechaDesdeContratos] = useState("");
  const [fechaHastaContratos, setFechaHastaContratos] = useState("");
  const [filtroFechaContratos, setFiltroFechaContratos] = useState<
    "fecha_creacion" | "fecha_evento"
  >("fecha_creacion");
  const [tipoContrato, setTipoContrato] = useState<
    "todos" | "presupuestos" | "ordenes_trabajo"
  >("todos");
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [filtroBusquedaContratos, setFiltroBusquedaContratos] = useState("");
  const [isLoadingContratos, setIsLoadingContratos] = useState(false);
  const [paginaActualContratos, setPaginaActualContratos] = useState(1);
  const contratosPorPagina = 10;

  // Estados para el reporte de recibos por fecha
  const [fechaDesdeRecibos, setFechaDesdeRecibos] = useState("");
  const [fechaHastaRecibos, setFechaHastaRecibos] = useState("");
  const [recibos, setRecibos] = useState<any[]>([]);
  const [isLoadingRecibos, setIsLoadingRecibos] = useState(false);

  // Estados para el reporte de ingresos por tipo
  const [fechaDesdeIngresos, setFechaDesdeIngresos] = useState("");
  const [fechaHastaIngresos, setFechaHastaIngresos] = useState("");
  const [ingresosPorTipo, setIngresosPorTipo] = useState<any>(null);
  const [isLoadingIngresos, setIsLoadingIngresos] = useState(false);
  const [filtroCuentaDestinoIngresos, setFiltroCuentaDestinoIngresos] = useState<number | null>(null);
  const [filtroCategoriaIngresos, setFiltroCategoriaIngresos] = useState<string>("");
  const [filtroMetodoPagoIngresos, setFiltroMetodoPagoIngresos] = useState<string>("");
  const [cuentasDestinoIngresos, setCuentasDestinoIngresos] = useState<Array<{ id: number; nombre_titular: string }>>([]);
  const [metodosPagoIngresos, setMetodosPagoIngresos] = useState<Array<{id: number, nombre: string, submétodos?: Array<{id: number, nombre: string}>}>>([]);
  const [showExportIngresosModal, setShowExportIngresosModal] = useState(false);
  const [exportIngresosFormato, setExportIngresosFormato] = useState<
    "excel" | "pdf"
  >("excel");
  const [exportandoIngresos, setExportandoIngresos] = useState(false);

  // Estados para el reporte de stock por estado
  const [stockPorEstado, setStockPorEstado] = useState<any>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [paginasPorEstado, setPaginasPorEstado] = useState<
    Record<string, number>
  >({});
  const productosPorPaginaStock = 10;

  // Estados para el reporte de stock por línea
  const [stockPorLinea, setStockPorLinea] = useState<any>(null);
  const [isLoadingStockLinea, setIsLoadingStockLinea] = useState(false);

  // Estados para el reporte de saldos a cobrar
  const [fechaDesdeSaldos, setFechaDesdeSaldos] = useState("");
  const [fechaHastaSaldos, setFechaHastaSaldos] = useState("");
  const [saldosACobrar, setSaldosACobrar] = useState<any[]>([]);
  const [isLoadingSaldos, setIsLoadingSaldos] = useState(false);

  // Estados para el reporte de prendas a armar
  const [fechaDesdePrendas, setFechaDesdePrendas] = useState("");
  const [fechaHastaPrendas, setFechaHastaPrendas] = useState("");
  const [prendasAArmar, setPrendasAArmar] = useState<PrendaAArmarOrden[]>([]);
  const [isLoadingPrendas, setIsLoadingPrendas] = useState(false);
  const [seleccionPrendasAArmar, setSeleccionPrendasAArmar] = useState<
    Record<string, boolean>
  >({});
  const [imprimiendoEtiquetasPrendas, setImprimiendoEtiquetasPrendas] =
    useState(false);
  const [colaVisualEtiquetasPrendas, setColaVisualEtiquetasPrendas] = useState<
    ItemColaEtiquetaVisual[]
  >([]);
  const [imprimiendoResumenOrdenId, setImprimiendoResumenOrdenId] = useState<
    number | null
  >(null);

  // Estados para el reporte de no devolvieron
  const [noDevolvieron, setNoDevolvieron] = useState<any[]>([]);
  const [noDevolvieronOriginal, setNoDevolvieronOriginal] = useState<any[]>([]);
  const [isLoadingNoDevolvieron, setIsLoadingNoDevolvieron] = useState(false);
  const [filtroNoDevolvieron, setFiltroNoDevolvieron] = useState("");

  // Estados para el reporte de productos críticos para armado
  const [fechaDesdeCriticosArmado, setFechaDesdeCriticosArmado] = useState("");
  const [fechaHastaCriticosArmado, setFechaHastaCriticosArmado] = useState("");
  const [productosCriticosArmado, setProductosCriticosArmado] = useState<any[]>(
    []
  );
  const [isLoadingCriticosArmado, setIsLoadingCriticosArmado] = useState(false);

  // Estados para el reporte de histórico de producto
  const [codigoBarraHistorico, setCodigoBarraHistorico] = useState("");
  const [fechaHastaHistorico, setFechaHastaHistorico] = useState("");
  const [historicoProducto, setHistoricoProducto] = useState<any>(null);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(false);
  const [historicoPagina, setHistoricoPagina] = useState(1);

  const reportTiles = useMemo(() => {
    const todosLosReportes = [
      {
        key: "alquileres_por_prenda",
        title: "Alquileres por prenda",
        desc: "Cantidad alquilada en una fecha",
        icon: Shirt,
      },
      {
        key: "ranking_alquileres",
        title: "Ranking de alquileres",
        desc: "De más a menos alquilado",
        icon: ListOrdered,
      },
      {
        key: "contratos_por_fecha",
        title: "Contratos por fecha",
        desc: "Listado de contratos",
        icon: FileText,
      },
      {
        key: "recibos_por_fecha",
        title: "Recibos por fecha",
        desc: "Comprobantes de señas, pagos adicionales, ventas y anticipos",
        icon: Receipt,
      },
      {
        key: "ingresos_por_tipo",
        title: "Ingresos por tipo",
        desc: "Efectivo, tarjetas y por fecha",
        icon: CircleDollarSign,
      },
      {
        key: "stock_estado",
        title: "Stock por estado",
        desc: "Salón, clientes, modista, lavandería",
        icon: Boxes,
      },
      {
        key: "stock_por_linea",
        title: "Stock por línea",
        desc: "Valorizado a costo y venta",
        icon: ClipboardList,
      },
      {
        key: "trazabilidad_producto",
        title: "Histórico producto",
        desc: "Trazabilidad por fechas",
        icon: History,
      },
      {
        key: "saldos_clientes",
        title: "Saldos a cobrar",
        desc: "Saldos pendientes por fecha del evento",
        icon: Users,
      },
      {
        key: "conjuntos_a_armar",
        title: "Conjuntos a armar",
        desc: "Listado por fecha",
        icon: ClipboardList,
      },
      {
        key: "no_devolvieron",
        title: "No devolvieron",
        desc: "Clientes pendientes por fecha",
        icon: CircleAlert,
      },
      {
        key: "productos_criticos_armado",
        title: "Productos críticos para armado",
        desc: "Productos no disponibles para el armado semanal",
        icon: CircleAlert,
      },
    ];

    // Si es empleado, solo mostrar "Conjuntos a armar"
    if (esEmpleado) {
      return todosLosReportes.filter(
        (reporte) => reporte.key === "conjuntos_a_armar"
      );
    }

    // Si es admin, mostrar todos
    return todosLosReportes;
  }, [esEmpleado]);

  const API_BASE = getApiBaseUrl();

  const getLocalDateString = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split("T")[0];
  };

  const getAuthHeaders = () => {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  // Función helper para exportar a Excel
  const exportarAExcel = async (
    datos: any[],
    headers: string[],
    nombreArchivo: string
  ) => {
    if (datos.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    try {
      // Crear un array con los datos
      const datosFormateados = datos.map((item) => {
        return headers.map((header) => {
          // Buscar el valor correspondiente en el objeto
          const keys = Object.keys(item);
          const key = keys.find((k) => {
            // Mapear nombres de headers a keys del objeto
            const headerLower = header.toLowerCase();
            if (
              headerLower.includes("código") ||
              headerLower.includes("codigo")
            ) {
              return k.includes("codigo") || k.includes("codigo_barra");
            }
            if (
              headerLower.includes("descripción") ||
              headerLower.includes("descripcion")
            ) {
              return k.includes("descripcion");
            }
            if (
              headerLower.includes("línea") ||
              headerLower.includes("linea")
            ) {
              return k.includes("linea");
            }
            if (headerLower.includes("talle")) {
              return k.includes("talle");
            }
            if (headerLower.includes("color")) {
              return k.includes("color");
            }
            if (headerLower.includes("tela")) {
              return k.includes("tela");
            }
            if (headerLower.includes("sucursal")) {
              return k.includes("sucursal");
            }
            if (headerLower.includes("cantidad total")) {
              return k.includes("cantidad_total");
            }
            if (
              headerLower.includes("cantidad de veces") ||
              headerLower.includes("veces")
            ) {
              return k.includes("veces") || k.includes("cantidad_veces");
            }
            if (
              headerLower.includes("posición") ||
              headerLower.includes("posicion")
            ) {
              return k.includes("posicion");
            }
            if (headerLower.includes("fecha")) {
              return k.includes("fecha");
            }
            if (headerLower.includes("presupuesto")) {
              return k.includes("presupuesto");
            }
            if (headerLower.includes("cliente")) {
              return k.includes("cliente");
            }
            if (headerLower.includes("dni")) {
              return k.includes("dni");
            }
            if (headerLower.includes("monto")) {
              return k.includes("monto");
            }
            if (headerLower.includes("concepto")) {
              return k.includes("concepto");
            }
            if (
              headerLower.includes("método") ||
              headerLower.includes("metodo")
            ) {
              return k.includes("metodo") || k.includes("payment_method");
            }
            if (headerLower.includes("usuario")) {
              return k.includes("usuario");
            }
            if (headerLower.includes("estado")) {
              return k.includes("estado");
            }
            if (headerLower.includes("valor")) {
              return k.includes("valor");
            }
            if (headerLower.includes("celular")) {
              return k.includes("celular");
            }
            if (
              headerLower.includes("teléfono") ||
              headerLower.includes("telefono")
            ) {
              return k.includes("telefono");
            }
            if (headerLower.includes("saldo")) {
              return k.includes("saldo");
            }
            if (
              headerLower.includes("órdenes") ||
              headerLower.includes("ordenes")
            ) {
              return k.includes("ordenes");
            }
            if (headerLower.includes("motivo")) {
              return k.includes("motivo");
            }
            if (
              headerLower.includes("ubicación") ||
              headerLower.includes("ubicacion")
            ) {
              return k.includes("ubicacion");
            }
            return (
              k.toLowerCase() === header.toLowerCase().replace(/\s+/g, "_")
            );
          });
          return key ? item[key] : "";
        });
      });

      const colW = Math.max(
        ...headers.map((h) => Math.max(String(h).length, 15)),
        15
      );
      await downloadExcelFromAoA(
        nombreArchivo,
        "Datos",
        [headers, ...datosFormateados],
        colW
      );

      toast.success("Excel exportado correctamente");
    } catch (error: any) {
      console.error("Error al exportar a Excel:", error);
      toast.error("Error al exportar a Excel: " + error.message);
    }
  };

  // Asegurar que empleados solo vean "Conjuntos a armar"
  useEffect(() => {
    if (esEmpleado && selectedReporte !== "conjuntos_a_armar") {
      setSelectedReporte("conjuntos_a_armar");
    }
  }, [esEmpleado, selectedReporte]);

  // Cargar cuentas destino cuando se selecciona el reporte de ingresos
  useEffect(() => {
    if (selectedReporte === "ingresos_por_tipo" && me?.sucursalId) {
      const cargarCuentasDestino = async () => {
        try {
          const res = await fetch(`${API_BASE}/cuentas-destino/sucursal/${me.sucursalId}?solo_activas=true`, {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            setCuentasDestinoIngresos(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error("Error al cargar cuentas destino:", error);
        }
      };
      
      const cargarMetodosPago = async () => {
        try {
          const res = await fetch(`${API_BASE}/metodos-pago/sucursal/${me.sucursalId}?solo_activos=true`, {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
              // Crear lista plana de métodos y submétodos
              const metodosLista: Array<{id: number, nombre: string, submétodos?: Array<{id: number, nombre: string}>}> = [];
              const metodosMap = new Map<string, {id: number, nombre: string, submétodos?: Array<{id: number, nombre: string}>}>();
              
              data.data.forEach((metodo: any) => {
                const metodoKey = `${metodo.id}-${metodo.nombre}`;
                if (!metodosMap.has(metodoKey)) {
                  metodosMap.set(metodoKey, {
                    id: metodo.id,
                    nombre: metodo.nombre,
                    submétodos: metodo.submétodos || []
                  });
                }
                
                // Agregar submétodos como métodos individuales
                if (metodo.submétodos && metodo.submétodos.length > 0) {
                  metodo.submétodos.forEach((sub: any) => {
                    const submetodoNombre = `${metodo.nombre} - ${sub.nombre}`;
                    const submetodoKey = `${metodo.id * 10000 + sub.id}-${submetodoNombre}`;
                    if (!metodosMap.has(submetodoKey)) {
                      metodosMap.set(submetodoKey, {
                        id: metodo.id * 10000 + sub.id,
                        nombre: submetodoNombre
                      });
                    }
                  });
                }
              });
              
              setMetodosPagoIngresos(Array.from(metodosMap.values()));
            }
          }
        } catch (error) {
          console.error("Error al cargar métodos de pago:", error);
        }
      };
      
      cargarCuentasDestino();
      cargarMetodosPago();
    }
  }, [selectedReporte, me?.sucursalId]);

  // Inicializar fechas
  useEffect(() => {
    const hoy = getLocalDateString();
    setFechaDesde(hoy);
    setFechaHasta(hoy);
    setFechaDesdeRanking(hoy);
    setFechaHastaRanking(hoy);
    setFechaDesdeContratos(hoy);
    setFechaHastaContratos(hoy);
    setFechaDesdeRecibos(hoy);
    setFechaHastaRecibos(hoy);
    setFechaDesdeIngresos(hoy);
    setFechaHastaIngresos(hoy);
    setFechaDesdeSaldos(hoy);
    setFechaHastaSaldos(hoy);
    setFechaDesdePrendas(hoy);
    setFechaHastaPrendas(hoy);
  }, []);

  // Cargar stock por estado automáticamente cuando se selecciona el reporte
  useEffect(() => {
    if (selectedReporte === "stock_estado" && token) {
      obtenerStockPorEstado();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReporte, token]);

  // Cargar stock por línea automáticamente cuando se selecciona el reporte
  useEffect(() => {
    if (selectedReporte === "stock_por_linea" && token) {
      obtenerStockPorLinea();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReporte, token]);

  const obtenerAlquileresPorPrenda = async () => {
    if (!fechaDesde || !fechaHasta) {
      toast.error("Por favor selecciona las fechas");
      return;
    }

    if (new Date(fechaDesde) > new Date(fechaHasta)) {
      toast.error("La fecha desde debe ser anterior a la fecha hasta");
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      });

      const response = await fetch(
        `${API_BASE}/reportes/alquileres-por-prenda?${params}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      if (data.success && data.data) {
        setAlquileres(data.data.alquileres || []);
        toast.success(
          `Reporte generado: ${data.data.total_alquileres} alquileres encontrados`
        );
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener reporte:", error);
      toast.error("Error al obtener reporte: " + error.message);
      setAlquileres([]);
    } finally {
      setIsLoading(false);
    }
  };

  const exportarAlquileresExcel = async () => {
    if (alquileres.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = [
      "Código de Barras",
      "Descripción",
      "Línea",
      "Talle",
      "Color",
      "Tela",
      "Sucursal",
      "Cantidad Total Alquilada",
      "Cantidad de Veces Alquilada",
    ];

    const rows = alquileres.map((item) => [
      item.codigo_barra,
      item.descripcion,
      item.linea,
      item.talle,
      item.color,
      item.tela,
      item.sucursal_nombre,
      item.cantidad_total_alquilada.toString(),
      item.cantidad_veces_alquilada.toString(),
    ]);

    try {
      await downloadExcelFromAoA(
        `alquileres_por_prenda_${fechaDesde}_${fechaHasta}`,
        "Alquileres",
        [headers, ...rows],
        20
      );
      toast.success("Excel exportado correctamente");
    } catch (error: any) {
      console.error("Error al exportar:", error);
      toast.error("Error al exportar: " + error.message);
    }
  };

  // Funciones para ranking de alquileres
  const obtenerRankingAlquileres = async () => {
    if (!fechaDesdeRanking || !fechaHastaRanking) {
      toast.error("Por favor selecciona las fechas");
      return;
    }

    if (new Date(fechaDesdeRanking) > new Date(fechaHastaRanking)) {
      toast.error("La fecha desde debe ser anterior a la fecha hasta");
      return;
    }

    setIsLoadingRanking(true);
    try {
      const params = new URLSearchParams({
        fecha_desde: fechaDesdeRanking,
        fecha_hasta: fechaHastaRanking,
        ordenar_por: "veces_alquilada", // Siempre ordenar por veces alquilada
      });

      const response = await fetch(
        `${API_BASE}/reportes/ranking-alquileres?${params}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("📊 Respuesta del ranking:", data);
      if (data.success && data.data) {
        const rankingData = data.data.ranking || [];
        console.log(`📊 Ranking recibido: ${rankingData.length} productos`);
        setRanking(rankingData);
        setPaginaActual(1); // Resetear a la primera página cuando se genera un nuevo ranking
        toast.success(
          `Ranking generado: ${data.data.total_productos} prendas encontradas`
        );
      } else {
        console.error("❌ Formato de respuesta inválido:", data);
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener ranking:", error);
      toast.error("Error al obtener ranking: " + error.message);
      setRanking([]);
    } finally {
      setIsLoadingRanking(false);
    }
  };

  const exportarRankingExcel = async () => {
    if (ranking.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = [
      "Posición",
      "Código de Barras",
      "Descripción",
      "Línea",
      "Talle",
      "Color",
      "Tela",
      "Sucursal",
      "Cantidad Total Alquilada",
      "Cantidad de Veces Alquilada",
    ];

    const rows = ranking.map((item) => [
      item.posicion,
      item.codigo_barra,
      item.descripcion,
      item.linea,
      item.talle,
      item.color,
      item.tela,
      item.sucursal_nombre,
      item.cantidad_total_alquilada.toString(),
      item.cantidad_veces_alquilada.toString(),
    ]);

    try {
      await downloadExcelFromAoA(
        `ranking_alquileres_${fechaDesdeRanking}_${fechaHastaRanking}`,
        "Ranking",
        [headers, ...rows],
        20
      );
      toast.success("Excel exportado correctamente");
    } catch (error: any) {
      console.error("Error al exportar:", error);
      toast.error("Error al exportar: " + error.message);
    }
  };

  // Funciones para contratos por fecha
  const obtenerContratosPorFecha = async () => {
    if (!fechaDesdeContratos || !fechaHastaContratos) {
      toast.error("Por favor selecciona las fechas");
      return;
    }

    if (new Date(fechaDesdeContratos) > new Date(fechaHastaContratos)) {
      toast.error("La fecha desde debe ser anterior a la fecha hasta");
      return;
    }

    setIsLoadingContratos(true);
    try {
      const params = new URLSearchParams({
        fecha_desde: fechaDesdeContratos,
        fecha_hasta: fechaHastaContratos,
        filtro_fecha: "fecha_creacion",
        // Solo órdenes: con tipo "todos" el backend sumaba presupuesto+orden y
        // el toast decía 10 mientras el listado (solo órdenes) mostraba 5.
        tipo: "ordenes_trabajo",
      });

      const response = await fetch(
        `${API_BASE}/reportes/contratos-por-fecha?${params}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("📊 Respuesta de contratos:", data);
      if (data.success && data.data) {
        const lista = data.data.contratos || [];
        setContratos(lista);
        setPaginaActualContratos(1);
        const esAdmin =
          me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";
        const visibles = lista.filter((c: Contrato) => {
          if (c.tipo !== "orden_trabajo") return false;
          if (esAdmin) return true;
          const saldo = Number(c.saldo_pendiente ?? 0);
          return !Number.isFinite(saldo) || Math.abs(saldo) < 0.5;
        });
        toast.success(
          `Reporte generado: ${visibles.length} contrato${visibles.length !== 1 ? "s" : ""} en el listado`
        );
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener contratos:", error);
      toast.error("Error al obtener contratos: " + error.message);
      setContratos([]);
    } finally {
      setIsLoadingContratos(false);
    }
  };

  const contratosFiltrados = useMemo(() => {
    const esAdmin = me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";
    let list = contratos.filter((c) => {
      if (c.tipo !== "orden_trabajo") return false;
      const saldo = Number(c.saldo_pendiente ?? 0);
      // Admin puede ver (e imprimir) contratos/órdenes con deuda
      if (esAdmin) return true;
      // Empleado: solo sin saldo (tolerancia por float)
      return !Number.isFinite(saldo) || Math.abs(saldo) < 0.5;
    });
    const termino = filtroBusquedaContratos.trim().toLowerCase();
    if (!termino) return list;
    return list.filter((contrato) => {
      const nombreCliente = (contrato.cliente_nombre || "").toLowerCase();
      const dniCliente = contrato.cliente_dni
        ? String(contrato.cliente_dni).toLowerCase().replace(/\s/g, "")
        : "";
      return nombreCliente.includes(termino) || dniCliente.includes(termino);
    });
  }, [contratos, filtroBusquedaContratos, me?.role]);

  const totalMontoContratos = useMemo(
    () => contratosFiltrados.reduce((sum, c) => sum + (c.total ?? 0), 0),
    [contratosFiltrados]
  );

  const exportarContratosExcel = async () => {
    if (contratosFiltrados.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = [
      "N° Contrato",
      "Fecha del contrato",
      "Cliente",
      "DNI",
      "Fecha evento",
      "Total",
    ];

    const rows = contratosFiltrados.map((c) => [
      c.numero,
      formatearFecha(c.fecha_creacion),
      c.cliente_nombre || "N/A",
      c.cliente_dni ? String(c.cliente_dni) : "N/A",
      formatearFecha(c.fecha_evento),
      c.total ?? 0,
    ]);

    const filaTotal: (string | number)[] = [
      "",
      "",
      "",
      "",
      "TOTAL",
      totalMontoContratos,
    ];

    try {
      await downloadExcelFromAoA(
        `contratos_por_fecha_${fechaDesdeContratos}_${fechaHastaContratos}`,
        "Contratos",
        [headers, ...rows, [], filaTotal],
        18
      );
      toast.success("Excel exportado correctamente");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Error al exportar contratos:", error);
      toast.error("Error al exportar: " + message);
    }
  };

  const generarPDFContrato = async (contrato: Contrato) => {
    const esAdmin = me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";
    const saldoPendiente = Number(contrato.saldo_pendiente ?? 0);
    if (
      contrato.tipo !== "orden_trabajo" ||
      (saldoPendiente > 0 && !esAdmin)
    ) {
      toast.error(
        "Solo se pueden generar contratos de órdenes con saldo pendiente cero"
      );
      return;
    }
    const ordenId = contrato.orden_trabajo_id || contrato.id;
    const avisoAdmin =
      saldoPendiente > 0 && esAdmin
        ? `\n\nATENCIÓN: esta orden tiene saldo pendiente de $${saldoPendiente.toLocaleString("es-AR")}. Solo podés generar el contrato porque sos administrador.`
        : "";
    if (
      !window.confirm(
        `¿Abrir el contrato #${ordenId} (${contrato.cliente_nombre || "cliente"}) para imprimir?${avisoAdmin}`
      )
    ) {
      return;
    }

    try {
      // Obtener detalles completos de la orden de trabajo
      const response = await fetch(`${API_BASE}/ordenes/${ordenId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Error al obtener detalles de la orden");
      }

      const data = await response.json();
      const ordenCompleta = data.data || data;

      if (ordenCompleta.es_precliente || !ordenCompleta.cliente_dni || !ordenCompleta.cliente_direccion) {
        toast.error(
          "Este presupuesto pertenece a un precliente. Para generar el contrato se requiere DNI y Dirección."
        );
        return;
      }

      // Preparar datos para el contrato (igual que en la página de órdenes)
      const numeroContrato = contrato.numero.padStart(6, "0");
      const locatario = resolverLocatarioContrato(ordenCompleta);
      const clienteNombre = locatario.nombre || contrato.cliente_nombre || "";
      const clienteDNI = locatario.dni;
      const clienteDireccion = locatario.direccion;
      const clienteCelular = locatario.celular;

      const fechaEvento =
        ordenCompleta.fecha_evento || contrato.fecha_evento
          ? format(
              new Date(
                (ordenCompleta.fecha_evento || contrato.fecha_evento) +
                  "T00:00:00"
              ),
              "dd/MM/yyyy",
              { locale: es }
            )
          : "";

      // Fecha del contrato: al momento de generar el contrato de forma manual
      const fechaContrato = new Date();
      const dia = fechaContrato.getDate();
      const meses = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre",
      ];
      const mes = meses[fechaContrato.getMonth()];
      const año = fechaContrato.getFullYear();

      const fechaCreacionOrden =
        ordenCompleta.fecha_creacion || contrato.fecha_creacion
          ? new Date(ordenCompleta.fecha_creacion || contrato.fecha_creacion)
          : new Date();

      // Calcular días de vigencia
      const fechaEventoDate =
        ordenCompleta.fecha_evento || contrato.fecha_evento
          ? new Date(
              (ordenCompleta.fecha_evento || contrato.fecha_evento) +
                "T00:00:00"
            )
          : new Date();
      const diasVigencia = Math.max(
        1,
        Math.ceil(
          (fechaEventoDate.getTime() - fechaCreacionOrden.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      // Precio total del alquiler (para la tercera vigencia)
      // Usar total_presupuesto que es el total original del presupuesto
      const precioTotal =
        ordenCompleta.total_presupuesto ||
        ordenCompleta.total ||
        ordenCompleta.seña_pagada + ordenCompleta.saldo_pendiente ||
        contrato.total ||
        0;
      const precioFormateado = precioTotal.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      // Lista de prendas (desde productos_reservados de la orden)
      const productosReservados = ordenCompleta.productos_reservados || [];
      const listaPrendas = productosReservados
        .map(
          (prod: any, index: number) =>
            `${index + 1}. ${prod.producto_descripcion || "Producto"}`
        )
        .join("<br>");

      // Segunda vigencia - debe quedar vacía
      const segundaVigencia = "";

      // Tercera vigencia - total alquiler para usar en el texto
      const terceraVigenciaTotal = precioFormateado;

      // Calcular valor del pagaré: precio del alquiler multiplicado por 5
      const valorPagare = precioTotal * 5;
      const valorPagareFormateado = valorPagare.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      // Fechas del pagaré: en blanco para rellenar manualmente (evitar vencimiento y ejecución)

      // Locatario del contrato = firmante del pagaré (titular o anexado)
      const firmante = locatario.nombre;
      const aclaracion = locatario.nombre;
      const celular = locatario.celular || clienteCelular;

      // Generar HTML del contrato
      const contenidoContrato = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrato de Alquiler - ${numeroContrato}</title>
    <style>
        @media print {
            @page {
                size: A4;
                margin: 0.8cm;
            }
            body { margin: 0; padding: 0; }
            .no-print { display: none; }
        }
        body {
            font-family: 'Times New Roman', serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 10px;
            line-height: 1.3;
            font-size: 9pt;
        }
        .header {
            text-align: center;
            margin-bottom: 8px;
        }
        .header h1 {
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 3px;
        }
        .numero-contrato {
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 6px;
        }
        .clausula {
            margin-bottom: 6px;
            text-align: justify;
        }
        .clausula strong {
            font-weight: bold;
        }
        .lista-prendas {
            margin: 3px 0;
            padding-left: 12px;
            font-size: 8.5pt;
        }
        .firma {
            margin-top: 10px;
            padding-top: 6px;
        }
        .pagare {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid #000;
        }
        .pagare .header {
            margin-bottom: 6px;
        }
        .pagare .header h1 {
            font-size: 10pt;
        }
        .botones {
            text-align: center;
            margin-top: 15px;
        }
        button {
            padding: 8px 16px;
            margin: 0 8px;
            font-size: 14px;
            cursor: pointer;
        }
        .underline {
            border-bottom: 1px solid #000;
            display: inline-block;
            min-width: 120px;
        }
        .pagare .underline.espacio-dia { min-width: 3.5em; }
        .pagare .underline.espacio-mes { min-width: 11em; }
        .pagare .underline.espacio-anio { min-width: 4.5em; }
        .pagare .underline.espacio-firma { min-width: 20em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Contrato Alquiler de Prendas de Vestir</h1>
        <div class="numero-contrato">N° ${numeroContrato}</div>
    </div>

    <div class="clausula">
        Entre <strong>Schmira Ariel Fernando</strong>, local <strong>Guapo</strong>, por una parte, en adelante <strong>EL LOCADOR</strong>,
        y <span class="underline">${clienteNombre}</span>, DNI <span class="underline">${clienteDNI}</span>, con domicilio en <span class="underline">${clienteDireccion}</span> de la Ciudad de La Rioja, por la otra parte, en adelante <strong>EL LOCATARIO</strong>, convienen de común acuerdo en celebrar el presente contrato, el que se regirá por las siguientes cláusulas, sin perjuicio de la de Ley, a saber:
    </div>

    <div class="clausula">
        <strong>PRIMERA: OBJETO</strong><br>
        EL LOCADOR da en locación al LOCATARIO las prendas que se detallan:
        <div class="lista-prendas">
            ${listaPrendas || "No hay prendas especificadas"}
        </div>
        Las cuales se reciben en perfecto estado de conservación y uso, a entera satisfacción del LOCATARIO, quien ha probado y verificado las prendas objeto del mismo, y ha constatado su excelente estado de conservación.
    </div>

    <div class="clausula">
        <strong>SEGUNDA: VIGENCIA</strong><br>
        El presente contrato tendrá una vigencia de <span class="underline">${diasVigencia}</span> días corridos a partir de la firma del mismo. <span class="underline">${segundaVigencia}</span> El plazo de la locación quedará automáticamente prorrogado a su vencimiento, hasta la real restitución de la totalidad de las prendas. Las mismas deberán ser devueltas en el local Guapo sito en Santiago del Estero 83 de la ciudad de La Rioja.
    </div>

    <div class="clausula">
        <strong>TERCERA: PRECIO</strong><br>
        El precio pactado de común acuerdo del presente contrato se fija en PESOS $ <span class="underline">${terceraVigenciaTotal}</span>. El pago deberá integrarse en un 100% antes del retiro de las prendas del local Guapo. La prórroga obliga al LOCATARIO a abonar una suma equivalente al CINCO POR CIENTO (5%) del precio total del alquiler por cada día de demora, hasta la restitución total de las prendas al LOCADOR. En garantía de la totalidad de las prendas alquiladas se firma un pagaré de aval, presente al pie, el cual integra y es parte del presente contrato.
    </div>

    <div class="clausula">
        <strong>CUARTA</strong><br>
        Las prendas han sido probadas por el LOCATARIO quien las recibe a su entera y total satisfacción. El LOCATARIO se obliga a devolverlas al LOCADOR en el mismo estado en que las recibe, prevaleciendo ante cualquier eventualidad el criterio del LOCADOR sobre el estado de las prendas devueltas. EL LOCADOR no asume ningún tipo de responsabilidad por el uso y destino de las mismas.
    </div>

    <div class="clausula">
        <strong>QUINTA: OBLIGACIONES DEL LOCATARIO</strong><br>
        EL LOCATARIO, además de las mencionadas precedentemente, asume las siguientes obligaciones: • No realizar modificaciones o arreglos de ninguna naturaleza a las prendas. • No realizar lavado de las prendas alquiladas. En caso de incumplimiento de alguna de las obligaciones a cargo del LOCATARIO, se producirá la mora en forma automática y el LOCADOR quedará facultado para declarar rescindida la locación, sin necesidad de interpelación extrajudicial o judicial previa.
    </div>

    <div class="clausula">
        <strong>SEXTA</strong><br>
        En caso de rotura, mancha, deterioro o extravío de las prendas alquiladas, el LOCADOR realizará la reparación, reposición o lo que estime necesario, según su absoluto y único criterio, para garantizar el buen estado de las mismas, debiendo soportar los cargos que la gestión demande enteramente el LOCATARIO.
    </div>

    <div class="clausula">
        <strong>SÉPTIMA: CANCELACIÓN</strong><br>
        De cancelarse el evento motivo del presente contrato, el LOCATARIO deberá abonar al LOCADOR: a) Si las prendas estuvieran en el local y no han sido retiradas para el evento, el cargo por seña que hubiera abonado; en tal caso el LOCATARIO no podrá pretender la devolución de lo ya abonado, quedando para el LOCADOR en concepto de indemnización. b) Si las prendas han sido retiradas rige el contrato en todas sus cláusulas.
    </div>

    <div class="clausula">
        <strong>OCTAVA: JURISDICCIÓN</strong><br>
        Para todos los efectos legales emergentes del presente, las partes se someten al fuero y jurisdicción ordinarios de los Tribunales Civiles de la Ciudad de La Rioja, con renuncia expresa a todo otro que pudiera corresponderles, constituyendo domicilios especiales y legales en los enunciados en este contrato.
    </div>

    <div class="clausula">
        <strong>NOVENA</strong><br>
        En conformidad del presente contrato se firma un ejemplar en la ciudad de La Rioja a los <span class="underline">${dia}</span> días del mes de <span class="underline">${mes}</span> de ${año}.
    </div>

    <div class="firma">
        <div style="margin-bottom: 8px;">
            <div style="margin-bottom: 2px;">Firma: <span class="underline"></span></div>
            <div>D.N.I.: <span class="underline"></span></div>
        </div>
    </div>

    <div class="pagare">
        <div class="header">
            <h1>PAGARÉ</h1>
        </div>
        <div class="clausula">
            La Rioja, <span class="underline espacio-dia">&nbsp;</span> de <span class="underline espacio-mes">&nbsp;</span> de <span class="underline espacio-anio">&nbsp;</span>. Vence el <span class="underline espacio-dia">&nbsp;</span> de <span class="underline espacio-mes">&nbsp;</span> de <span class="underline espacio-anio">&nbsp;</span>. Pagaré $ <span class="underline">${valorPagareFormateado}</span> Sin Protesto (Art. 50 D. Ley 5965/63). A señor Schmira Ariel Fernando o a su orden. La cantidad de pesos <span class="underline">${valorPagareFormateado}</span>. Por igual valor recibido en prendas de vestir a su entera satisfacción. Pagadero en Santiago del Estero 83 de la Ciudad de La Rioja.
            <div style="margin-top: 12px;">
                <div style="margin-bottom: 6px;">Firmante: <span class="underline espacio-firma">${firmante}</span></div>
                <div style="margin-bottom: 6px;">Aclaración: <span class="underline espacio-firma">${aclaracion}</span></div>
                <div>Celular: <span class="underline espacio-firma">${celular}</span></div>
            </div>
        </div>
    </div>

    <div class="botones no-print">
        <button onclick="window.print()" style="padding: 8px 15px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Imprimir</button>
        <button onclick="window.close()" style="padding: 8px 15px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Cerrar</button>
    </div>
</body>
</html>
      `;

      const ventanaContrato = window.open(
        "",
        "_blank",
        "width=900,height=1200"
      );
      if (ventanaContrato) {
        ventanaContrato.document.write(contenidoContrato);
        ventanaContrato.document.close();
      } else {
        toast.error(
          "Por favor, permite ventanas emergentes para generar el PDF"
        );
      }
    } catch (error: any) {
      console.error("Error al generar contrato:", error);
      toast.error("Error al generar el contrato: " + error.message);
    }
  };

  // Funciones para recibos por fecha
  const obtenerRecibosPorFecha = async () => {
    if (!fechaDesdeRecibos || !fechaHastaRecibos) {
      toast.error("Por favor selecciona las fechas");
      return;
    }

    if (new Date(fechaDesdeRecibos) > new Date(fechaHastaRecibos)) {
      toast.error("La fecha desde debe ser anterior a la fecha hasta");
      return;
    }

    setIsLoadingRecibos(true);
    try {
      const params = new URLSearchParams({
        fecha_desde: fechaDesdeRecibos,
        fecha_hasta: fechaHastaRecibos,
      });

      const response = await fetch(
        `${API_BASE}/reportes/recibos-por-fecha?${params}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("📊 Respuesta de recibos:", data);
      if (data.success && data.data) {
        setRecibos(data.data.recibos || []);
        toast.success(
          `Reporte generado: ${data.data.total_recibos} recibos encontrados`
        );
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener recibos:", error);
      toast.error("Error al obtener recibos: " + error.message);
      setRecibos([]);
    } finally {
      setIsLoadingRecibos(false);
    }
  };

  const exportarRecibosExcel = async () => {
    if (recibos.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = [
      "Fecha",
      "Presupuesto",
      "Cliente",
      "DNI",
      "Monto",
      "Concepto",
      "Método de Pago",
      "Usuario",
      "Sucursal",
      "Texto del Recibo",
    ];

    const rows = recibos.map((item) => [
      format(new Date(item.fecha_hora + "T00:00:00"), "dd/MM/yyyy HH:mm", {
        locale: es,
      }),
      item.presupuesto_numero,
      item.cliente_nombre,
      item.cliente_dni,
      item.monto.toString(),
      item.concepto,
      item.metodo_pago,
      item.usuario_nombre,
      item.sucursal_nombre,
      item.texto_recibo,
    ]);

    try {
      await downloadExcelFromAoA(
        `recibos_por_fecha_${fechaDesdeRecibos}_${fechaHastaRecibos}`,
        "Recibos",
        [headers, ...rows],
        20
      );
      toast.success("Excel exportado correctamente");
    } catch (error: any) {
      console.error("Error al exportar:", error);
      toast.error("Error al exportar: " + error.message);
    }
  };

  // Funciones para ingresos por tipo
  const obtenerIngresosPorTipo = async () => {
    if (!fechaDesdeIngresos || !fechaHastaIngresos) {
      toast.error("Por favor selecciona las fechas");
      return;
    }

    if (new Date(fechaDesdeIngresos) > new Date(fechaHastaIngresos)) {
      toast.error("La fecha desde debe ser anterior a la fecha hasta");
      return;
    }

    setIsLoadingIngresos(true);
    try {
      const params = new URLSearchParams({
        fecha_desde: fechaDesdeIngresos,
        fecha_hasta: fechaHastaIngresos,
      });
      
      if (filtroCuentaDestinoIngresos) {
        params.append("cuenta_destino_id", filtroCuentaDestinoIngresos.toString());
      }
      
      if (filtroCategoriaIngresos) {
        params.append("categoria", filtroCategoriaIngresos);
      }
      
      if (filtroMetodoPagoIngresos) {
        params.append("payment_method", filtroMetodoPagoIngresos);
      }

      const response = await fetch(
        `${API_BASE}/reportes/ingresos-por-tipo?${params}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}`);
      }

      const data = await response.json();
      console.log("📊 Respuesta de ingresos por tipo:", data);
      if (data.success && data.data) {
        setIngresosPorTipo(data.data);
        toast.success("Reporte generado exitosamente");
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener ingresos por tipo:", error);
      toast.error("Error al obtener ingresos por tipo: " + error.message);
      setIngresosPorTipo(null);
    } finally {
      setIsLoadingIngresos(false);
    }
  };

  const labelMetodoPagoIngreso = (metodo: string) => {
    if (metodo === "EFECTIVO") return "Efectivo";
    if (metodo === "DEBITO") return "Débito";
    if (metodo === "CREDITO") return "Crédito";
    if (metodo === "BILLETERA_VIRTUAL" || metodo === "TRANSFERENCIA") {
      return "Transferencia";
    }
    if (metodo === "SIN_METODO") return "Sin método";
    return metodo;
  };

  const abrirModalExportIngresos = () => {
    const detalles = ingresosPorTipo?.detalles ?? [];
    const resumen = ingresosPorTipo?.ingresos_por_tipo ?? [];
    if (!ingresosPorTipo || (detalles.length === 0 && resumen.length === 0)) {
      toast.error("No hay datos para exportar");
      return;
    }
    setExportIngresosFormato("excel");
    setShowExportIngresosModal(true);
  };

  const descargarArchivoIngresos = (blob: Blob, nombre: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const exportarIngresosExcel = async () => {
    const detalles = ingresosPorTipo?.detalles ?? [];
    const resumen = ingresosPorTipo?.ingresos_por_tipo ?? [];

    const detalleHeaders = [
      "Fecha",
      "Hora",
      "Origen / Concepto",
      "Categoría",
      "Método de pago",
      "Monto",
      "Cuenta destino",
      "Usuario",
    ];

    const detalleRows = detalles.map((detalle: any) => {
      const fechaHora = detalle.fecha_hora ? new Date(detalle.fecha_hora) : null;
      return [
        fechaHora ? format(fechaHora, "dd/MM/yyyy", { locale: es }) : "",
        fechaHora ? format(fechaHora, "HH:mm", { locale: es }) : "",
        detalle.origen || "",
        detalle.categoria || "",
        labelMetodoPagoIngreso(detalle.metodo_pago || ""),
        Number(detalle.monto ?? 0),
        detalle.cuenta_destino_nombre || "",
        detalle.usuario_nombre || "",
      ];
    });

    const resumenHeaders = ["Método de pago", "Cantidad", "Total"];
    const resumenRows = resumen.map((item: any) => [
      labelMetodoPagoIngreso(item.metodo),
      item.cantidad,
      Number(item.total ?? 0),
    ]);
    if (resumenRows.length > 0) {
      resumenRows.push([
        "TOTAL GENERAL",
        ingresosPorTipo.cantidad_total,
        Number(ingresosPorTipo.total_general ?? 0),
      ]);
    }

    try {
      await downloadExcelFromSheets(
        `ingresos_por_tipo_${fechaDesdeIngresos}_${fechaHastaIngresos}`,
        [
          {
            name: "Movimientos",
            rows: [detalleHeaders, ...detalleRows],
            columnWidth: 22,
          },
          ...(resumenRows.length > 0
            ? [
                {
                  name: "Resumen",
                  rows: [resumenHeaders, ...resumenRows],
                  columnWidth: 18,
                },
              ]
            : []),
        ]
      );
      toast.success("Excel exportado con detalle de movimientos");
    } catch (error: any) {
      console.error("Error al exportar:", error);
      toast.error("Error al exportar: " + error.message);
      throw error;
    }
  };

  const exportarIngresosPdf = async () => {
    const params = new URLSearchParams({
      fecha_desde: fechaDesdeIngresos,
      fecha_hasta: fechaHastaIngresos,
    });
    if (filtroCuentaDestinoIngresos) {
      params.append("cuenta_destino_id", filtroCuentaDestinoIngresos.toString());
    }
    if (filtroCategoriaIngresos) {
      params.append("categoria", filtroCategoriaIngresos);
    }
    if (filtroMetodoPagoIngresos) {
      params.append("payment_method", filtroMetodoPagoIngresos);
    }

    const response = await fetch(
      `${API_BASE}/reportes/ingresos-por-tipo/exportar-pdf?${params}`,
      { headers: getAuthHeaders() }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Error al exportar PDF");
    }

    const blob = await response.blob();
    descargarArchivoIngresos(
      blob,
      `ingresos_por_tipo_${fechaDesdeIngresos}_${fechaHastaIngresos}.pdf`
    );
    toast.success("PDF exportado con detalle de movimientos");
  };

  const ejecutarExportacionIngresos = async () => {
    setExportandoIngresos(true);
    try {
      if (exportIngresosFormato === "pdf") {
        await exportarIngresosPdf();
      } else {
        await exportarIngresosExcel();
      }
      setShowExportIngresosModal(false);
    } catch (error: any) {
      toast.error("Error al exportar: " + error.message);
    } finally {
      setExportandoIngresos(false);
    }
  };

  // Funciones para stock por estado
  const actualizarEstadoProducto = async (
    productoId: number,
    nuevoEstado: string
  ) => {
    try {
      const response = await fetch(
        `${API_BASE}/productos/estado/${productoId}`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ estado: nuevoEstado }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        toast.success("Estado actualizado correctamente");
        // Recargar el reporte
        await obtenerStockPorEstado();
      } else {
        throw new Error(data.message || "Error al actualizar el estado");
      }
    } catch (error: any) {
      console.error("Error al actualizar estado:", error);
      toast.error("Error al actualizar estado: " + error.message);
    }
  };

  const obtenerStockPorEstado = async () => {
    setIsLoadingStock(true);
    try {
      const response = await fetch(`${API_BASE}/reportes/stock-por-estado`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}`);
      }

      const data = await response.json();
      console.log("📊 Respuesta de stock por estado:", data);
      if (data.success && data.data) {
        setStockPorEstado(data.data);
        // Inicializar páginas en 1 para cada estado
        const paginasIniciales: Record<string, number> = {};
        if (data.data.stock_por_estado) {
          data.data.stock_por_estado.forEach((item: any) => {
            paginasIniciales[item.estado] = 1;
          });
        }
        setPaginasPorEstado(paginasIniciales);
        toast.success("Reporte generado exitosamente");
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener stock por estado:", error);
      toast.error("Error al obtener stock por estado: " + error.message);
      setStockPorEstado(null);
    } finally {
      setIsLoadingStock(false);
    }
  };

  const exportarStockExcel = async () => {
    if (
      !stockPorEstado ||
      !stockPorEstado.stock_por_estado ||
      stockPorEstado.stock_por_estado.length === 0
    ) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = [
      "Estado",
      "Cantidad de Productos",
      "Código",
      "Descripción",
      "Línea",
      "Talle",
      "Color",
      "Tela",
    ];

    const rows: any[] = [];
    stockPorEstado.stock_por_estado.forEach((item: any) => {
      if (item.productos && item.productos.length > 0) {
        item.productos.forEach((producto: any) => {
          rows.push([
            item.estado,
            item.cantidad_productos.toString(),
            producto.codigo_barra,
            producto.descripcion,
            producto.linea,
            producto.talle,
            producto.color,
            producto.tela,
          ]);
        });
      } else {
        rows.push([
          item.estado,
          item.cantidad_productos.toString(),
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
      }
    });

    try {
      await downloadExcelFromAoA(
        `stock_por_estado_${new Date().toISOString().split("T")[0]}`,
        "Stock por Estado",
        [headers, ...rows],
        20
      );
      toast.success("Excel exportado correctamente");
    } catch (error: any) {
      console.error("Error al exportar:", error);
      toast.error("Error al exportar: " + error.message);
    }
  };

  // Funciones para stock por línea
  const obtenerStockPorLinea = async () => {
    setIsLoadingStockLinea(true);
    try {
      const response = await fetch(`${API_BASE}/reportes/stock-por-linea`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error ${response.status}`);
      }

      const data = await response.json();
      console.log("📊 Respuesta de stock por línea:", data);
      if (data.success && data.data) {
        setStockPorLinea(data.data);
        toast.success("Reporte generado exitosamente");
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener stock por línea:", error);
      toast.error("Error al obtener stock por línea: " + error.message);
      setStockPorLinea(null);
    } finally {
      setIsLoadingStockLinea(false);
    }
  };

  const exportarStockLineaExcel = async () => {
    if (
      !stockPorLinea ||
      !stockPorLinea.stock_por_linea ||
      stockPorLinea.stock_por_linea.length === 0
    ) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = [
      "Línea",
      "Cantidad de Productos",
      "Valor a Costo",
      "Valor a Venta",
    ];

    const rows = stockPorLinea.stock_por_linea.map((item: any) => [
      item.linea || "SIN LÍNEA",
      item.cantidad_productos,
      item.valor_costo,
      item.valor_venta,
    ]);

    // Agregar fila de total
    rows.push([
      "TOTAL GENERAL",
      stockPorLinea.total_productos,
      stockPorLinea.total_valor_costo,
      stockPorLinea.total_valor_venta,
    ]);

    try {
      await downloadExcelFromAoA(
        `stock_por_linea_${new Date().toISOString().split("T")[0]}`,
        "Stock por Linea",
        [headers, ...rows],
        20
      );
      toast.success("Excel exportado correctamente");
    } catch (error: any) {
      console.error("Error al exportar:", error);
      toast.error("Error al exportar: " + error.message);
    }
  };

  // Funciones para saldos a cobrar
  const obtenerSaldosACobrar = async () => {
    if (!fechaDesdeSaldos || !fechaHastaSaldos) {
      toast.error("Por favor selecciona las fechas");
      return;
    }

    if (new Date(fechaDesdeSaldos) > new Date(fechaHastaSaldos)) {
      toast.error("La fecha desde debe ser anterior a la fecha hasta");
      return;
    }

    setIsLoadingSaldos(true);
    try {
      const params = new URLSearchParams({
        fecha_desde: fechaDesdeSaldos,
        fecha_hasta: fechaHastaSaldos,
      });

      const response = await fetch(
        `${API_BASE}/reportes/saldos-a-cobrar?${params}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("📊 Respuesta de saldos a cobrar:", data);
      if (data.success && data.data) {
        setSaldosACobrar(data.data.saldos || []);
        toast.success(
          `Reporte generado: ${data.data.total_clientes} clientes con saldo pendiente`
        );
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener saldos a cobrar:", error);
      toast.error("Error al obtener saldos a cobrar: " + error.message);
      setSaldosACobrar([]);
    } finally {
      setIsLoadingSaldos(false);
    }
  };

  const exportarSaldosExcel = async () => {
    if (saldosACobrar.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = [
      "Cliente",
      "DNI",
      "Celular",
      "Teléfono",
      "Cantidad de Órdenes",
      "Total Saldo Pendiente",
      "Órdenes",
    ];

    const rows = saldosACobrar.map((item: any) => [
      item.cliente_nombre,
      item.cliente_dni,
      item.cliente_celular || "",
      item.cliente_telefono || "",
      item.cantidad_ordenes,
      item.total_saldo_pendiente,
      item.ordenes
        .map(
          (o: any) => `#${o.orden_id} (Presupuesto: ${o.presupuesto_numero})`
        )
        .join("; "),
    ]);

    // Agregar fila de total
    const totalSaldo = saldosACobrar.reduce(
      (sum, item) => sum + item.total_saldo_pendiente,
      0
    );
    rows.push([
      "TOTAL GENERAL",
      "",
      "",
      "",
      saldosACobrar.reduce((sum, item) => sum + item.cantidad_ordenes, 0),
      totalSaldo,
      "",
    ]);

    try {
      await downloadExcelFromAoA(
        `saldos_a_cobrar_${fechaDesdeSaldos}_${fechaHastaSaldos}`,
        "Saldos a Cobrar",
        [headers, ...rows],
        20
      );
      toast.success("Excel exportado correctamente");
    } catch (error: any) {
      console.error("Error al exportar:", error);
      toast.error("Error al exportar: " + error.message);
    }
  };

  // Funciones para prendas a armar
  const obtenerPrendasAArmar = async (
    fechaDesde?: string,
    fechaHasta?: string
  ) => {
    const fechaDesdeUsar = fechaDesde || fechaDesdePrendas;
    const fechaHastaUsar = fechaHasta || fechaHastaPrendas;

    if (!fechaDesdeUsar || !fechaHastaUsar) {
      toast.error("Por favor selecciona las fechas");
      return;
    }

    if (new Date(fechaDesdeUsar) > new Date(fechaHastaUsar)) {
      toast.error("La fecha desde debe ser anterior a la fecha hasta");
      return;
    }

    setIsLoadingPrendas(true);
    try {
      const params = new URLSearchParams({
        fecha_desde: fechaDesdeUsar,
        fecha_hasta: fechaHastaUsar,
      });

      const response = await fetch(
        `${API_BASE}/reportes/prendas-a-armar?${params}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("📊 Respuesta de prendas a armar:", data);
      if (data.success && data.data) {
        setPrendasAArmar(data.data.ordenes || []);
        setSeleccionPrendasAArmar({});
        setColaVisualEtiquetasPrendas([]);
        toast.success(
          `Reporte generado: ${data.data.total_ordenes} órdenes encontradas`
        );
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener prendas a armar:", error);
      toast.error("Error al obtener prendas a armar: " + error.message);
      setPrendasAArmar([]);
      setSeleccionPrendasAArmar({});
      setColaVisualEtiquetasPrendas([]);
    } finally {
      setIsLoadingPrendas(false);
    }
  };

  // Función para generar reporte de la semana actual (lunes a sábado)
  const generarReporteSemanaActual = async () => {
    const hoy = new Date();
    // Obtener el lunes de la semana actual (weekStartsOn: 1 = lunes)
    const lunes = startOfWeek(hoy, { weekStartsOn: 1 });
    // Agregar 5 días al lunes para obtener el sábado
    const sabado = addDays(lunes, 5);

    // Formatear fechas como YYYY-MM-DD
    const fechaLunes = format(lunes, "yyyy-MM-dd");
    const fechaSabado = format(sabado, "yyyy-MM-dd");

    // Actualizar los estados
    setFechaDesdePrendas(fechaLunes);
    setFechaHastaPrendas(fechaSabado);

    // Generar el reporte inmediatamente con las fechas calculadas
    await obtenerPrendasAArmar(fechaLunes, fechaSabado);

    toast.success(
      `Reporte de semana actual generado (${format(lunes, "dd/MM/yyyy", {
        locale: es,
      })} - ${format(sabado, "dd/MM/yyyy", { locale: es })})`
    );
  };

  const buildPrendaSelectionKey = (ordenId: number, productoId: number) =>
    `${ordenId}-${productoId}`;

  const toggleSeleccionPrenda = (ordenId: number, productoId: number) => {
    const key = buildPrendaSelectionKey(ordenId, productoId);
    setSeleccionPrendasAArmar((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const prendaBloqueadaPorImpresionEnOrden = (orden: PrendaAArmarOrden) =>
    Boolean(orden.etiquetas_impresas_en_orden);

  const marcarTodasPrendasAArmar = (valor: boolean) => {
    const next: Record<string, boolean> = {};
    prendasAArmar.forEach((orden) => {
      if (prendaBloqueadaPorImpresionEnOrden(orden)) return;
      orden.productos.forEach((producto) => {
        next[buildPrendaSelectionKey(orden.orden_id, producto.producto_id)] = valor;
      });
    });
    setSeleccionPrendasAArmar(next);
  };

  const prendasSeleccionadas = useMemo(() => {
    const seleccionadas: Array<{
      ordenId: number;
      clienteNombre: string;
      producto: PrendaAArmarProducto;
    }> = [];
    prendasAArmar.forEach((orden) => {
      if (prendaBloqueadaPorImpresionEnOrden(orden)) return;
      orden.productos.forEach((producto) => {
        const key = buildPrendaSelectionKey(orden.orden_id, producto.producto_id);
        if (seleccionPrendasAArmar[key]) {
          seleccionadas.push({
            ordenId: orden.orden_id,
            clienteNombre: orden.cliente_nombre,
            producto,
          });
        }
      });
    });
    return seleccionadas;
  }, [prendasAArmar, seleccionPrendasAArmar]);

  const mensajeToastImpresion = (
    exito: string,
    impresion: Pick<
      ResultadoImpresionEtiqueta,
      "impresora" | "mensajeAyuda"
    > & {
      metodo?: ResultadoImpresionEtiqueta["metodo"];
    }
  ) => {
    if (impresion.metodo === "qz" && impresion.impresora) {
      return `${exito} Impresora: ${impresion.impresora}.`;
    }
    if (impresion.mensajeAyuda) return impresion.mensajeAyuda;
    return exito;
  };

  const handleImprimirEtiquetasPrendasSeleccionadas = async () => {
    if (prendasSeleccionadas.length === 0) {
      toast.error("Marcá al menos una prenda para imprimir");
      return;
    }

    const colaInicial: ItemColaEtiquetaVisual[] = prendasSeleccionadas.map(
      (sel, idx) => ({
        key: `etq-prendas-${sel.ordenId}-${sel.producto.producto_id}-${idx}`,
        productoId: sel.producto.producto_id,
        codigoBarra: sel.producto.codigo_barra || "",
        descripcion: sel.producto.descripcion || "",
        clienteNombre: sel.clienteNombre || "",
        estado: "pendiente",
      })
    );
    setColaVisualEtiquetasPrendas(
      colaInicial.map((item) => ({ ...item, estado: "imprimiendo" }))
    );
    setImprimiendoEtiquetasPrendas(true);

    try {
      const payload = prendasSeleccionadas.map((sel) => ({
        codigoBarra: sel.producto.codigo_barra || "0",
        clienteNombre: sel.clienteNombre || "Cliente",
        prendaDescripcion: sel.producto.descripcion || "Prenda para armar",
      }));
      const impresion = await imprimirEtiquetas100x50Lote(payload);
      const { porIndice } = impresion;
      const ok = porIndice.filter((s) => s === "ok").length;
      const err = porIndice.filter((s) => s === "error").length;
      setColaVisualEtiquetasPrendas((prev) =>
        prev.map((row, idx) => ({
          ...row,
          estado: porIndice[idx] === "ok" ? "ok" : "error",
        }))
      );
      if (err === 0 && impresion.porIndice.some((s) => s === "ok")) {
        toast.success(
          mensajeToastImpresion(
            `${ok} etiqueta(s) por prenda enviadas a impresión.`,
            impresion
          )
        );
      } else if (ok === 0) {
        toast.error("No se pudo generar ninguna etiqueta. Revisá códigos de barras.");
      } else {
        toast.warning(`Listo parcial: ${ok} impresas, ${err} con error`);
      }
    } finally {
      setImprimiendoEtiquetasPrendas(false);
    }
  };

  const formatearFechaEtiqueta = (iso: string) => {
    if (!iso) return "—";
    try {
      return format(new Date(iso), "dd/MM/yyyy", { locale: es });
    } catch {
      return "—";
    }
  };

  const handleImprimirEtiquetaResumenConjunto = async (orden: PrendaAArmarOrden) => {
    setImprimiendoResumenOrdenId(orden.orden_id);
    try {
      const payload = construirEtiquetaResumenConjunto({
        ordenId: orden.orden_id,
        clienteNombre: orden.cliente_nombre,
        fechaRetiro: formatearFechaEtiqueta(orden.fecha_retiro),
        fechaEvento: formatearFechaEtiqueta(orden.fecha_evento),
        categoriaEvento: orden.categoria_evento || "",
        lugarEvento: orden.lugar_evento || "",
        productos: orden.productos.map((p) => ({
          linea: p.linea,
          talle: p.talle,
          color: p.color,
          descripcion: p.descripcion,
          cantidad: p.cantidad,
        })),
      });
      const resultado = await imprimirEtiquetaResumenConjunto(payload);
      if (resultado.resultado === "ok") {
        toast.success(
          mensajeToastImpresion(
            `Etiqueta resumen de la orden #${orden.orden_id} enviada a impresión.`,
            resultado
          )
        );
      } else {
        toast.error("No se pudo abrir la impresión de la etiqueta resumen.");
      }
    } finally {
      setImprimiendoResumenOrdenId(null);
    }
  };

  // Funciones para no devolvieron
  const obtenerNoDevolvieron = async () => {
    setIsLoadingNoDevolvieron(true);
    try {
      const response = await fetch(`${API_BASE}/reportes/no-devolvieron`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("📊 Respuesta de no devolvieron:", data);
      if (data.success && data.data) {
        setNoDevolvieronOriginal(data.data.ordenes || []);
        setNoDevolvieron(data.data.ordenes || []);
        toast.success(
          `Reporte generado: ${data.data.total_ordenes} órdenes con productos no devueltos`
        );
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener no devolvieron:", error);
      toast.error("Error al obtener reporte: " + error.message);
      setNoDevolvieron([]);
      setNoDevolvieronOriginal([]);
    } finally {
      setIsLoadingNoDevolvieron(false);
    }
  };

  // Filtrar no devolvieron según el filtro de búsqueda
  const noDevolvieronFiltrado = useMemo(() => {
    if (!filtroNoDevolvieron.trim()) {
      return noDevolvieron;
    }
    const filtro = filtroNoDevolvieron.trim().toLowerCase();
    return noDevolvieron.filter((orden) => {
      const nombreCliente = (orden.cliente_nombre || "").toLowerCase();
      // Convertir DNI a string y normalizar
      const dniCliente = orden.cliente_dni
        ? String(orden.cliente_dni).toLowerCase().replace(/\s/g, "")
        : "";
      // Convertir ID de contrato a string
      const idContrato = String(orden.orden_id || "").toLowerCase();
      return (
        nombreCliente.includes(filtro) ||
        dniCliente.includes(filtro) ||
        idContrato.includes(filtro)
      );
    });
  }, [noDevolvieron, filtroNoDevolvieron]);

  const exportarNoDevolvieronExcel = async () => {
    if (noDevolvieron.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    try {
      const headers = [
        "ID Contrato",
        "Cliente",
        "DNI",
        "Celular",
        "Dirección",
        "Fecha Evento",
        "Fecha Devolución",
        "Días de Retraso",
        "Categoría Evento",
        "Nombre Agasajado",
        "Lugar Evento",
        "Código Producto",
        "Descripción Producto",
        "Línea",
        "Talle",
        "Color",
        "Tela",
        "Cantidad",
        "Total Orden",
        "Saldo Pendiente",
        "Cantidad Total Items",
      ];

      const rows: any[] = [];
      noDevolvieron.forEach((orden) => {
        const fechaEventoFormateada = orden.fecha_evento
          ? format(new Date(orden.fecha_evento), "dd/MM/yyyy", { locale: es })
          : "N/A";
        const fechaDevolucionFormateada = orden.fecha_devolucion
          ? format(new Date(orden.fecha_devolucion), "dd/MM/yyyy", {
              locale: es,
            })
          : "N/A";

        if (orden.productos && orden.productos.length > 0) {
          orden.productos.forEach((producto: any) => {
            rows.push([
              orden.orden_id,
              orden.cliente_nombre,
              orden.cliente_dni || "",
              orden.cliente_celular || "",
              orden.cliente_direccion || "",
              fechaEventoFormateada,
              fechaDevolucionFormateada,
              orden.dias_retraso || 0,
              orden.categoria_evento || "",
              orden.nombre_agasajado || "",
              orden.lugar_evento || "",
              producto.codigo_barra,
              producto.descripcion,
              producto.linea,
              producto.talle,
              producto.color,
              producto.tela,
              producto.cantidad,
              orden.total,
              orden.saldo_pendiente,
              orden.cantidad_total_items,
            ]);
          });
        } else {
          rows.push([
            orden.orden_id,
            orden.cliente_nombre,
            orden.cliente_dni || "",
            orden.cliente_celular || "",
            orden.cliente_direccion || "",
            fechaEventoFormateada,
            fechaDevolucionFormateada,
            orden.dias_retraso || 0,
            orden.categoria_evento || "",
            orden.nombre_agasajado || "",
            orden.lugar_evento || "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            orden.total,
            orden.saldo_pendiente,
            orden.cantidad_total_items,
          ]);
        }
      });

      await downloadExcelFromAoA(
        `no_devolvieron_${format(new Date(), "yyyy-MM-dd")}`,
        "No Devolvieron",
        [headers, ...rows],
        18
      );
      toast.success("Excel exportado correctamente");
    } catch (error: any) {
      console.error("Error al exportar:", error);
      toast.error("Error al exportar: " + error.message);
    }
  };

  // Funciones para productos críticos para armado
  const obtenerProductosCriticosArmado = async () => {
    if (!fechaDesdeCriticosArmado || !fechaHastaCriticosArmado) {
      toast.error("Por favor, selecciona ambas fechas");
      return;
    }

    setIsLoadingCriticosArmado(true);
    try {
      const response = await fetch(
        `${API_BASE}/reportes/productos-criticos-armado?fecha_desde=${fechaDesdeCriticosArmado}&fecha_hasta=${fechaHastaCriticosArmado}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("📊 Respuesta de productos críticos para armado:", data);
      if (data.success && data.data) {
        setProductosCriticosArmado(data.data.productos || []);
        toast.success(
          `Reporte generado: ${data.data.total_productos} productos críticos encontrados`
        );
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener productos críticos para armado:", error);
      toast.error(
        "Error al obtener productos críticos para armado: " + error.message
      );
      setProductosCriticosArmado([]);
    } finally {
      setIsLoadingCriticosArmado(false);
    }
  };

  const exportarProductosCriticosArmadoExcel = async () => {
    if (productosCriticosArmado.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    try {
      const headers = [
        "Código",
        "Descripción",
        "Línea",
        "Talle",
        "Color",
        "Estado",
        "Motivo Crítico",
        "Ubicación",
        "Cliente",
        "ID Contrato",
        "Fecha Evento",
      ];

      const rows = productosCriticosArmado.map((producto) => [
        producto.codigo_barra,
        producto.descripcion,
        producto.linea,
        producto.talle,
        producto.color,
        producto.estado,
        producto.motivo_critico,
        producto.ubicacion_actual,
        producto.cliente_nombre,
        producto.presupuesto_numero,
        format(new Date(producto.fecha_evento), "dd/MM/yyyy", { locale: es }),
      ]);

      await downloadExcelFromAoA(
        `productos_criticos_armado_${fechaDesdeCriticosArmado}_${fechaHastaCriticosArmado}`,
        "Productos Criticos",
        [headers, ...rows],
        20
      );
      toast.success("Excel exportado correctamente");
    } catch (error: any) {
      console.error("Error al exportar:", error);
      toast.error("Error al exportar: " + error.message);
    }
  };

  // Funciones para histórico de producto
  const obtenerHistoricoProducto = async (page: number = 1) => {
    if (!codigoBarraHistorico) {
      toast.error("Por favor, ingresa el código de barras del producto");
      return;
    }

    const pageSafe = Math.max(1, Math.floor(page));
    setHistoricoPagina(pageSafe);
    setIsLoadingHistorico(true);
    try {
      let url = `${API_BASE}/reportes/historico-producto?codigo_barra=${encodeURIComponent(
        codigoBarraHistorico.trim()
      )}&page=${pageSafe}&page_size=10`;
      if (fechaHastaHistorico) {
        url += `&fecha_hasta=${encodeURIComponent(fechaHastaHistorico)}`;
      }

      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("📊 Respuesta de histórico de producto:", data);
      if (data.success && data.data) {
        setHistoricoProducto(data.data);
        const p = data.data.paginacion?.page;
        if (typeof p === "number" && p >= 1) {
          setHistoricoPagina(p);
        }
        if (pageSafe === 1) {
          toast.success("Histórico de producto obtenido exitosamente");
        }
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener histórico de producto:", error);
      toast.error("Error al obtener histórico de producto: " + error.message);
      setHistoricoProducto(null);
    } finally {
      setIsLoadingHistorico(false);
    }
  };

  // Función para generar e imprimir recibo
  const generarReciboImprimir = (recibo: any) => {
    const fechaFormateada = (() => {
      try {
        const fecha = recibo.fecha_hora.includes("T")
          ? new Date(recibo.fecha_hora)
          : new Date(recibo.fecha_hora + "T00:00:00");
        return format(fecha, "dd/MM/yyyy HH:mm", { locale: es });
      } catch (e) {
        return recibo.fecha_hora;
      }
    })();

    const contenidoRecibo = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recibo - ${recibo.presupuesto_numero}</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            border: 1px solid #ddd;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .recibo-body {
            margin: 20px 0;
            line-height: 1.8;
            font-size: 14px;
        }
        .fecha {
            text-align: right;
            margin-bottom: 20px;
            color: #666;
        }
        .texto-recibo {
            font-size: 16px;
            margin: 30px 0;
            padding: 15px;
            border: 1px solid #ddd;
            background-color: #f9f9f9;
        }
        .detalles {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        }
        .firma {
            margin-top: 60px;
            border-top: 1px solid #000;
            padding-top: 10px;
            text-align: center;
        }
        .botones {
            text-align: center;
            margin-top: 20px;
        }
        button {
            padding: 10px 20px;
            margin: 0 10px;
            font-size: 16px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>RECIBO</h1>
    </div>
    
    <div class="fecha">
        <strong>Fecha:</strong> ${fechaFormateada}
    </div>
    
    <div class="recibo-body">
        <div class="texto-recibo">
            ${recibo.texto_recibo}
        </div>
        
        <div class="detalles">
            <p><strong>Presupuesto:</strong> ${recibo.presupuesto_numero}</p>
            <p><strong>Cliente:</strong> ${recibo.cliente_nombre} (DNI: ${
      recibo.cliente_dni
    })</p>
            <p><strong>Concepto:</strong> ${
              recibo.concepto === "seña"
                ? "Seña"
                : recibo.concepto === "venta"
                ? "Venta"
                : recibo.concepto === "anticipo"
                ? "Anticipo"
                : "Pago adicional"
            }</p>
            <p><strong>Método de pago:</strong> ${recibo.metodo_pago}</p>
            <p><strong>Monto:</strong> $${recibo.monto.toLocaleString("es-AR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}</p>
            <p><strong>Registrado por:</strong> ${recibo.usuario_nombre}</p>
            <p><strong>Sucursal:</strong> ${recibo.sucursal_nombre}</p>
        </div>
        
        <div class="firma">
            <p>_________________________</p>
            <p>Firma</p>
        </div>
    </div>
    
    <div class="botones no-print">
        <button onclick="window.print()">Imprimir</button>
        <button onclick="window.close()">Cerrar</button>
    </div>
</body>
</html>`;

    const ventana = window.open("", "_blank", "width=800,height=600");
    if (ventana) {
      ventana.document.write(contenidoRecibo);
      ventana.document.close();
    } else {
      toast.error(
        "Por favor, permite ventanas emergentes para imprimir el recibo"
      );
    }
  };

  return (
    <div className="px-2 px-sm-3 px-md-4 py-3">
      <div className="mb-4">
        <h1 className="page-title mb-1">Reportes</h1>
        <p className="text-muted mb-0">Elegí un reporte para ver o exportar.</p>
      </div>
      <div className="row g-2 g-md-3 align-items-stretch mb-4">
        {reportTiles.map(({ key, title, desc, icon: Icon }) => (
          <div key={key} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
            <button
              type="button"
              onClick={() => setSelectedReporte(key)}
              className={`reporte-tile ${
                selectedReporte === key ? "reporte-tile--active" : ""
              }`}
            >
              <div className="d-flex align-items-start gap-2 p-3">
                <div className="reporte-tile__icon">
                  <Icon size={18} strokeWidth={1.75} aria-hidden />
                </div>
                <div
                  className="d-flex flex-column justify-content-between flex-grow-1"
                  style={{ minHeight: 52 }}
                >
                  <div className="fw-semibold lh-sm text-ink">{title}</div>
                  <div className="small text-muted lh-sm">{desc}</div>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Contenido del reporte seleccionado */}
      {selectedReporte === "alquileres_por_prenda" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-graph-up me-2"></i>
              Alquileres por Prenda
            </h5>
            <p className="text-muted small mb-0">
              Cantidad de veces que cada prenda fue alquilada en un rango de
              fechas
            </p>
          </div>
          <div className="card-body">
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
              <div className="col-md-4 d-flex align-items-end gap-2">
                <button
                  onClick={obtenerAlquileresPorPrenda}
                  disabled={isLoading || !fechaDesde || !fechaHasta}
                  className="btn btn-oxblood"
                >
                  {isLoading ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Generar Reporte
                    </>
                  )}
                </button>
                {alquileres.length > 0 && (
                  <button
                    onClick={exportarAlquileresExcel}
                    className="btn btn-outline-ink"
                  >
                    <i className="bi bi-download me-2"></i>
                    Excel
                  </button>
                )}
              </div>
            </div>

            {/* Resultados */}
            {isLoading ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando reporte...
              </div>
            ) : alquileres.length > 0 ? (
              <div>
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="card border-success">
                        <div className="card-body text-center">
                          <div className="text-success small mb-1">
                            Total Alquileres
                          </div>
                          <div className="h3 text-success fw-bold">
                            {alquileres.reduce(
                              (sum, item) =>
                                sum + item.cantidad_total_alquilada,
                              0
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table gt-table align-middle">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th>Línea</th>
                        <th>Talle</th>
                        <th>Color</th>
                        <th>Tela</th>
                        <th>Sucursal</th>
                        <th className="text-center">Cant. Total</th>
                        <th className="text-center">Veces Alquilada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alquileres.map((item) => (
                        <tr key={item.producto_id}>
                          <td className="fw-medium">{item.codigo_barra}</td>
                          <td>{item.descripcion}</td>
                          <td className="small text-muted">{item.linea}</td>
                          <td className="small text-muted">{item.talle}</td>
                          <td className="small text-muted">{item.color}</td>
                          <td className="small text-muted">{item.tela}</td>
                          <td className="small text-muted">
                            {item.sucursal_nombre}
                          </td>
                          <td className="text-center fw-semibold text-success">
                            {item.cantidad_total_alquilada}
                          </td>
                          <td className="text-center fw-semibold text-oxblood">
                            {item.cantidad_veces_alquilada}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox display-1 d-block mb-3"></i>
                <h5 className="text-muted">No hay datos</h5>
                <p className="text-muted">
                  Selecciona un rango de fechas y genera el reporte
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reporte: Ranking de Alquileres */}
      {selectedReporte === "ranking_alquileres" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-trophy me-2"></i>
              Ranking de Alquileres
            </h5>
            <p className="text-muted small mb-0">
              Prendas ordenadas de más a menos alquiladas en un rango de fechas
            </p>
          </div>
          <div className="card-body">
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-3">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaDesdeRanking}
                  onChange={(e) => setFechaDesdeRanking(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaHastaRanking}
                  onChange={(e) => setFechaHastaRanking(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Filtrar por veces</label>
                <select
                  className="form-select gt-select"
                  value={filtroVeces}
                  onChange={(e) =>
                    setFiltroVeces(
                      e.target.value as "todos" | "cero" | "menos_10" | "mas_10"
                    )
                  }
                >
                  <option value="todos">Todos</option>
                  <option value="cero">Cero veces</option>
                  <option value="menos_10">Menos de 10 veces</option>
                  <option value="mas_10">Más de 10 veces</option>
                </select>
              </div>
              <div className="col-md-3 d-flex align-items-end gap-2">
                <button
                  onClick={obtenerRankingAlquileres}
                  disabled={
                    isLoadingRanking || !fechaDesdeRanking || !fechaHastaRanking
                  }
                  className="btn btn-oxblood"
                >
                  {isLoadingRanking ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Generar Ranking
                    </>
                  )}
                </button>
                {ranking.length > 0 && (
                  <button
                    onClick={exportarRankingExcel}
                    className="btn btn-outline-ink"
                  >
                    <i className="bi bi-download me-2"></i>
                    Excel
                  </button>
                )}
              </div>
            </div>

            {/* Resultados */}
            {isLoadingRanking ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando ranking...
              </div>
            ) : (
              (() => {
                // Calcular productos filtrados
                const productosFiltrados = ranking.filter((item) => {
                  const veces = item.cantidad_veces_alquilada;
                  if (filtroVeces === "todos") return true;
                  if (filtroVeces === "cero") return veces === 0;
                  if (filtroVeces === "menos_10")
                    return veces > 0 && veces < 10;
                  if (filtroVeces === "mas_10") return veces >= 10;
                  return true;
                });

                if (ranking.length === 0) {
                  return (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-inbox display-1 d-block mb-3"></i>
                      <h5 className="text-muted">No hay datos</h5>
                      <p className="text-muted">
                        No se encontraron productos para el rango de fechas
                        seleccionado.
                        <br />
                        <small>
                          Verifica que haya productos en tu sucursal y que las
                          fechas sean correctas.
                        </small>
                      </p>
                    </div>
                  );
                }

                if (productosFiltrados.length === 0) {
                  return (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-filter display-1 d-block mb-3"></i>
                      <h5 className="text-muted">
                        No hay resultados con el filtro seleccionado
                      </h5>
                      <p className="text-muted">
                        Hay {ranking.length} productos en total, pero ninguno
                        cumple con el filtro "
                        {filtroVeces === "cero"
                          ? "Cero veces"
                          : filtroVeces === "menos_10"
                          ? "Menos de 10 veces"
                          : "Más de 10 veces"}
                        ".
                        <br />
                        <small>
                          Intenta cambiar el filtro o verifica las fechas
                          seleccionadas.
                        </small>
                      </p>
                    </div>
                  );
                }

                // Calcular paginación
                const totalPaginas = Math.ceil(
                  productosFiltrados.length / productosPorPagina
                );
                const indiceInicio = (paginaActual - 1) * productosPorPagina;
                const indiceFin = indiceInicio + productosPorPagina;
                const productosPaginados = productosFiltrados.slice(
                  indiceInicio,
                  indiceFin
                );

                return (
                  <div>
                    <div className="mb-3">
                      <div className="row">
                        <div className="col-md-12">
                          <div className="card border-oxblood">
                            <div className="card-body text-center">
                              <div className="text-oxblood small mb-1">
                                Total Prendas en Ranking
                                {filtroVeces !== "todos" && (
                                  <span className="text-muted ms-2">
                                    (Filtrado:{" "}
                                    {filtroVeces === "cero"
                                      ? "Cero veces"
                                      : filtroVeces === "menos_10"
                                      ? "Menos de 10 veces"
                                      : "Más de 10 veces"}
                                    )
                                  </span>
                                )}
                              </div>
                              <div className="h3 text-oxblood fw-bold">
                                {productosFiltrados.length}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table gt-table align-middle">
                        <thead>
                          <tr>
                            <th style={{ width: "60px" }}>Pos.</th>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Línea</th>
                            <th>Talle</th>
                            <th>Color</th>
                            <th>Tela</th>
                            <th>Sucursal</th>
                            <th className="text-center">Cant. Total</th>
                            <th className="text-center">Veces Alquilada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productosPaginados.map((item) => {
                            const nuncaAlquilado =
                              item.cantidad_veces_alquilada === 0 &&
                              item.cantidad_total_alquilada === 0;
                            return (
                              <tr
                                key={item.producto_id}
                                className={
                                  nuncaAlquilado
                                    ? "table-secondary opacity-75"
                                    : ""
                                }
                              >
                                <td className="text-center">
                                  <span
                                    className="badge bg-light text-dark border"
                                    style={{
                                      fontSize: "0.75rem",
                                      padding: "0.25rem 0.5rem",
                                    }}
                                  >
                                    {nuncaAlquilado ? "N/A" : item.posicion}
                                  </span>
                                </td>
                                <td className="fw-medium">
                                  {item.codigo_barra}
                                </td>
                                <td>
                                  {item.descripcion}
                                  {nuncaAlquilado && (
                                    <span
                                      className="badge bg-danger ms-2"
                                      style={{ fontSize: "0.7rem" }}
                                    >
                                      Sin alquileres
                                    </span>
                                  )}
                                </td>
                                <td className="small text-muted">
                                  {item.linea}
                                </td>
                                <td className="small text-muted">
                                  {item.talle}
                                </td>
                                <td className="small text-muted">
                                  {item.color}
                                </td>
                                <td className="small text-muted">
                                  {item.tela}
                                </td>
                                <td className="small text-muted">
                                  {item.sucursal_nombre}
                                </td>
                                <td
                                  className={`text-center fw-semibold ${
                                    nuncaAlquilado
                                      ? "text-muted"
                                      : "text-success"
                                  }`}
                                >
                                  {item.cantidad_total_alquilada}
                                </td>
                                <td
                                  className={`text-center fw-semibold ${
                                    nuncaAlquilado
                                      ? "text-muted"
                                      : "text-oxblood"
                                  }`}
                                >
                                  {item.cantidad_veces_alquilada}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Paginación */}
                    {totalPaginas > 1 && (
                      <div className="d-flex justify-content-between align-items-center mt-3">
                        <div className="text-muted small">
                          Mostrando {indiceInicio + 1} -{" "}
                          {Math.min(indiceFin, productosFiltrados.length)} de{" "}
                          {productosFiltrados.length} productos
                        </div>
                        <nav>
                          <ul className="pagination pagination-sm mb-0">
                            <li
                              className={`page-item ${
                                paginaActual === 1 ? "disabled" : ""
                              }`}
                            >
                              <button
                                className="page-link"
                                onClick={() =>
                                  setPaginaActual(paginaActual - 1)
                                }
                                disabled={paginaActual === 1}
                              >
                                Anterior
                              </button>
                            </li>
                            {Array.from(
                              { length: totalPaginas },
                              (_, i) => i + 1
                            ).map((pagina) => {
                              // Mostrar solo algunas páginas alrededor de la actual
                              if (
                                pagina === 1 ||
                                pagina === totalPaginas ||
                                (pagina >= paginaActual - 1 &&
                                  pagina <= paginaActual + 1)
                              ) {
                                return (
                                  <li
                                    key={pagina}
                                    className={`page-item ${
                                      paginaActual === pagina ? "active" : ""
                                    }`}
                                  >
                                    <button
                                      className="page-link"
                                      onClick={() => setPaginaActual(pagina)}
                                    >
                                      {pagina}
                                    </button>
                                  </li>
                                );
                              } else if (
                                pagina === paginaActual - 2 ||
                                pagina === paginaActual + 2
                              ) {
                                return (
                                  <li
                                    key={pagina}
                                    className="page-item disabled"
                                  >
                                    <span className="page-link">...</span>
                                  </li>
                                );
                              }
                              return null;
                            })}
                            <li
                              className={`page-item ${
                                paginaActual === totalPaginas ? "disabled" : ""
                              }`}
                            >
                              <button
                                className="page-link"
                                onClick={() =>
                                  setPaginaActual(paginaActual + 1)
                                }
                                disabled={paginaActual === totalPaginas}
                              >
                                Siguiente
                              </button>
                            </li>
                          </ul>
                        </nav>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* Reporte: Contratos por Fecha */}
      {selectedReporte === "contratos_por_fecha" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-file-text me-2"></i>
              Contratos por Fecha
            </h5>
            <p className="text-muted small mb-0">
              Listado de órdenes de trabajo (contratos) en un rango de fechas
            </p>
          </div>
          <div className="card-body">
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaDesdeContratos}
                  onChange={(e) => setFechaDesdeContratos(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaHastaContratos}
                  onChange={(e) => setFechaHastaContratos(e.target.value)}
                />
              </div>
              <div className="col-md-4 d-flex align-items-end gap-2">
                <button
                  onClick={obtenerContratosPorFecha}
                  disabled={
                    isLoadingContratos ||
                    !fechaDesdeContratos ||
                    !fechaHastaContratos
                  }
                  className="btn btn-oxblood"
                >
                  {isLoadingContratos ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Generar Reporte
                    </>
                  )}
                </button>
                {contratos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void exportarContratosExcel()}
                    disabled={contratosFiltrados.length === 0}
                    className="btn btn-outline-ink"
                    title="Exportar listado filtrado a Excel"
                  >
                    <i className="bi bi-download me-2"></i>
                    Excel
                  </button>
                )}
              </div>
            </div>

            {/* Resultados */}
            {isLoadingContratos ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando reporte...
              </div>
            ) : contratos.length > 0 ? (
              <div>
                {/* Buscador */}
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-6">
                      <input
                        type="text"
                        className="form-control gt-select"
                        placeholder="Buscar por nombre del cliente o DNI..."
                        value={filtroBusquedaContratos}
                        onChange={(e) => {
                          setFiltroBusquedaContratos(e.target.value);
                          setPaginaActualContratos(1);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {contratosFiltrados.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-inbox display-1 d-block mb-3"></i>
                    <h5 className="text-muted">No hay contratos disponibles</h5>
                    <p className="text-muted">
                      {filtroBusquedaContratos.trim()
                        ? "No se encontraron contratos que coincidan con la búsqueda."
                        : me?.role === "ADMIN" || me?.role === "SUPER_ADMIN"
                          ? "No hay órdenes de trabajo en el rango de fechas."
                          : "Solo se pueden ver contratos de órdenes de trabajo con saldo pendiente cero."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3">
                      <div className="row g-3">
                        <div className="col-md-4">
                          <div className="card border-oxblood h-100">
                            <div className="card-body text-center">
                              <div className="text-oxblood small mb-1">
                                Contratos en el listado
                              </div>
                              <div className="h3 text-oxblood fw-bold mb-0">
                                {contratosFiltrados.length}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="card border-success h-100">
                            <div className="card-body text-center">
                              <div className="text-success small mb-1">
                                Suma de totales
                              </div>
                              <div className="h3 text-success fw-bold mb-0">
                                $
                                {totalMontoContratos.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4 d-flex align-items-stretch">
                          <div className="alert alert-info mb-0 w-100 d-flex align-items-center">
                            <i className="bi bi-info-circle me-2"></i>
                            <span className="small">
                              {me?.role === "ADMIN" || me?.role === "SUPER_ADMIN"
                                ? "Órdenes de trabajo del período (incluye con saldo pendiente)"
                                : "Órdenes de trabajo con saldo pendiente cero"}
                              {filtroBusquedaContratos.trim()
                                ? ` (filtrado de ${contratos.filter((c) => c.tipo === "orden_trabajo").length})`
                                : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const totalPaginas = Math.ceil(
                        contratosFiltrados.length / contratosPorPagina
                      );
                      const indiceInicio =
                        (paginaActualContratos - 1) * contratosPorPagina;
                      const indiceFin = indiceInicio + contratosPorPagina;
                      const contratosPaginados = contratosFiltrados.slice(
                        indiceInicio,
                        indiceFin
                      );

                      return (
                        <>
                          <div className="table-responsive">
                            <table className="table gt-table align-middle">
                              <thead>
                                <tr>
                                  <th>N° Contrato</th>
                                  <th>Fecha del contrato</th>
                                  <th>Cliente</th>
                                  <th>DNI</th>
                                  <th className="text-end">Total</th>
                                  <th className="text-center">Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {contratosPaginados.map((contrato) => (
                                  <tr key={`${contrato.tipo}-${contrato.id}`}>
                                    <td className="fw-medium">
                                      {contrato.numero}
                                    </td>
                                    <td>
                                      {formatearFecha(contrato.fecha_creacion)}
                                    </td>
                                    <td>{contrato.cliente_nombre || "N/A"}</td>
                                    <td>
                                      {contrato.cliente_dni
                                        ? String(contrato.cliente_dni)
                                        : "N/A"}
                                    </td>
                                    <td className="text-end fw-medium">
                                      $
                                      {(contrato.total ?? 0).toLocaleString(
                                        "es-AR",
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        }
                                      )}
                                    </td>
                                    <td className="text-center">
                                      <button
                                        className="btn btn-sm btn-oxblood"
                                        onClick={() =>
                                          generarPDFContrato(contrato)
                                        }
                                        title="Ver contrato"
                                      >
                                        <i className="bi bi-eye me-1"></i>
                                        Ver
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td
                                    colSpan={4}
                                    className="text-end fw-bold"
                                  >
                                    Total ({contratosFiltrados.length}{" "}
                                    contrato
                                    {contratosFiltrados.length !== 1
                                      ? "s"
                                      : ""}
                                    )
                                  </td>
                                  <td className="text-end fw-bold text-success">
                                    $
                                    {totalMontoContratos.toLocaleString(
                                      "es-AR",
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )}
                                  </td>
                                  <td />
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          {totalPaginas > 1 && (
                            <div className="d-flex justify-content-between align-items-center mt-3">
                              <div className="text-muted small">
                                Mostrando {indiceInicio + 1} -{" "}
                                {Math.min(
                                  indiceFin,
                                  contratosFiltrados.length
                                )}{" "}
                                de {contratosFiltrados.length} contratos
                              </div>
                              <ul className="pagination pagination-sm mb-0">
                                <li
                                  className={`page-item ${
                                    paginaActualContratos === 1
                                      ? "disabled"
                                      : ""
                                  }`}
                                >
                                  <button
                                    className="page-link"
                                    onClick={() =>
                                      setPaginaActualContratos(
                                        paginaActualContratos - 1
                                      )
                                    }
                                    disabled={paginaActualContratos === 1}
                                  >
                                    <i className="bi bi-chevron-left"></i>
                                  </button>
                                </li>
                                {Array.from(
                                  { length: totalPaginas },
                                  (_, i) => i + 1
                                ).map((pagina) => {
                                  if (
                                    pagina === 1 ||
                                    pagina === totalPaginas ||
                                    (pagina >= paginaActualContratos - 1 &&
                                      pagina <= paginaActualContratos + 1)
                                  ) {
                                    return (
                                      <li
                                        key={pagina}
                                        className={`page-item ${
                                          paginaActualContratos === pagina
                                            ? "active"
                                            : ""
                                        }`}
                                      >
                                        <button
                                          className="page-link"
                                          onClick={() =>
                                            setPaginaActualContratos(pagina)
                                          }
                                        >
                                          {pagina}
                                        </button>
                                      </li>
                                    );
                                  }
                                  if (
                                    pagina === paginaActualContratos - 2 ||
                                    pagina === paginaActualContratos + 2
                                  ) {
                                    return (
                                      <li
                                        key={pagina}
                                        className="page-item disabled"
                                      >
                                        <span className="page-link">...</span>
                                      </li>
                                    );
                                  }
                                  return null;
                                })}
                                <li
                                  className={`page-item ${
                                    paginaActualContratos === totalPaginas
                                      ? "disabled"
                                      : ""
                                  }`}
                                >
                                  <button
                                    className="page-link"
                                    onClick={() =>
                                      setPaginaActualContratos(
                                        paginaActualContratos + 1
                                      )
                                    }
                                    disabled={
                                      paginaActualContratos === totalPaginas
                                    }
                                  >
                                    <i className="bi bi-chevron-right"></i>
                                  </button>
                                </li>
                              </ul>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox display-1 d-block mb-3"></i>
                <h5 className="text-muted">No hay datos</h5>
                <p className="text-muted">
                  No se encontraron contratos para el rango de fechas
                  seleccionado.
                  <br />
                  <small>Verifica las fechas y el filtro seleccionado.</small>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reporte: Recibos por Fecha */}
      {selectedReporte === "recibos_por_fecha" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-receipt me-2"></i>
              Recibos por Fecha
            </h5>
            <p className="text-muted small mb-0">
              Comprobantes de ingresos: señas, pagos adicionales, ventas y anticipos
            </p>
          </div>
          <div className="card-body">
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaDesdeRecibos}
                  onChange={(e) => setFechaDesdeRecibos(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaHastaRecibos}
                  onChange={(e) => setFechaHastaRecibos(e.target.value)}
                />
              </div>
              <div className="col-md-4 d-flex align-items-end gap-2">
                <button
                  onClick={obtenerRecibosPorFecha}
                  disabled={
                    isLoadingRecibos || !fechaDesdeRecibos || !fechaHastaRecibos
                  }
                  className="btn btn-oxblood"
                >
                  {isLoadingRecibos ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Generar Reporte
                    </>
                  )}
                </button>
                {recibos.length > 0 && (
                  <button
                    onClick={exportarRecibosExcel}
                    className="btn btn-outline-ink"
                  >
                    <i className="bi bi-download me-2"></i>
                    Excel
                  </button>
                )}
              </div>
            </div>

            {/* Resultados */}
            {isLoadingRecibos ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando reporte...
              </div>
            ) : recibos.length > 0 ? (
              <div>
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="card border-oxblood">
                        <div className="card-body text-center">
                          <div className="text-oxblood small mb-1">
                            Total Recibos
                          </div>
                          <div className="h3 text-oxblood fw-bold">
                            {recibos.length}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card border-success">
                        <div className="card-body text-center">
                          <div className="text-success small mb-1">
                            Total Monto
                          </div>
                          <div className="h3 text-success fw-bold">
                            $
                            {recibos
                              .reduce((sum, r) => sum + r.monto, 0)
                              .toLocaleString("es-AR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table gt-table align-middle">
                    <thead>
                      <tr>
                        <th>Fecha y Hora</th>
                        <th>Presupuesto</th>
                        <th>Cliente</th>
                        <th>DNI</th>
                        <th className="text-end">Monto</th>
                        <th>Concepto</th>
                        <th>Método de Pago</th>
                        <th>Usuario</th>
                        <th className="text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recibos.map((recibo) => (
                        <tr key={recibo.movimiento_id}>
                          <td className="small">
                            {(() => {
                              try {
                                // fecha_hora ya viene como ISO string completo, solo parsear directamente
                                const fecha = recibo.fecha_hora.includes("T")
                                  ? new Date(recibo.fecha_hora)
                                  : new Date(recibo.fecha_hora + "T00:00:00");
                                return format(fecha, "dd/MM/yyyy HH:mm", {
                                  locale: es,
                                });
                              } catch (e) {
                                console.error(
                                  "Error al formatear fecha:",
                                  recibo.fecha_hora,
                                  e
                                );
                                return recibo.fecha_hora;
                              }
                            })()}
                          </td>
                          <td className="fw-medium">
                            {recibo.presupuesto_numero}
                          </td>
                          <td>{recibo.cliente_nombre}</td>
                          <td className="small text-muted">
                            {recibo.cliente_dni}
                          </td>
                          <td className="text-end fw-semibold text-success">
                            $
                            {recibo.monto.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                recibo.concepto === "seña"
                                  ? "bg-info"
                                  : recibo.concepto === "venta"
                                  ? "bg-success"
                                  : recibo.concepto === "anticipo"
                                  ? "bg-warning text-dark"
                                  : "bg-oxblood"
                              }`}
                            >
                              {recibo.concepto}
                            </span>
                          </td>
                          <td className="small text-muted">
                            {recibo.metodo_pago}
                          </td>
                          <td className="small text-muted">
                            {recibo.usuario_nombre}
                          </td>
                          <td className="text-center">
                            <button
                              className="btn btn-sm btn-outline-ink"
                              onClick={() => generarReciboImprimir(recibo)}
                              title="Imprimir recibo"
                            >
                              <i className="bi bi-printer me-1"></i>
                              Imprimir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox display-1 d-block mb-3"></i>
                <h5 className="text-muted">No hay datos</h5>
                <p className="text-muted">
                  No se encontraron recibos para el rango de fechas
                  seleccionado.
                  <br />
                  <small>Verifica las fechas seleccionadas.</small>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reporte: Ingresos por Tipo */}
      {selectedReporte === "ingresos_por_tipo" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-cash-coin me-2"></i>
              Ingresos por Tipo
            </h5>
            <p className="text-muted small mb-0">
              Ingresos agrupados por método de pago (Efectivo, Tarjetas, etc.)
            </p>
          </div>
          <div className="card-body">
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-3">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaDesdeIngresos}
                  onChange={(e) => setFechaDesdeIngresos(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaHastaIngresos}
                  onChange={(e) => setFechaHastaIngresos(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Cuenta Destino</label>
                <select
                  className="form-select gt-select"
                  value={filtroCuentaDestinoIngresos || ""}
                  onChange={(e) => setFiltroCuentaDestinoIngresos(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Todas las cuentas</option>
                  {cuentasDestinoIngresos.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre_titular}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Categoría</label>
                <select
                  className="form-select gt-select"
                  value={filtroCategoriaIngresos}
                  onChange={(e) => setFiltroCategoriaIngresos(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  <option value="VENTAS">Ventas</option>
                  <option value="SEÑAS">Señas</option>
                  <option value="PAGOS_ADICIONALES">Pagos Adicionales</option>
                  <option value="SERVICIOS">Servicios</option>
                  <option value="OTROS_INGRESOS">Otros Ingresos</option>
                </select>
              </div>
            </div>
            <div className="row mb-4">
              <div className="col-md-3">
                <label className="form-label">Método de Pago</label>
                <select
                  className="form-select gt-select"
                  value={filtroMetodoPagoIngresos}
                  onChange={(e) => setFiltroMetodoPagoIngresos(e.target.value)}
                >
                  <option value="">Todos los métodos</option>
                  {metodosPagoIngresos.map((metodo) => (
                    <option key={metodo.id} value={metodo.nombre}>
                      {metodo.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row mb-4">
              <div className="col-md-12 d-flex align-items-end gap-2">
                <button
                  onClick={obtenerIngresosPorTipo}
                  disabled={
                    isLoadingIngresos ||
                    !fechaDesdeIngresos ||
                    !fechaHastaIngresos
                  }
                  className="btn btn-oxblood"
                >
                  {isLoadingIngresos ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Generar Reporte
                    </>
                  )}
                </button>
                {ingresosPorTipo &&
                  ((ingresosPorTipo.detalles?.length ?? 0) > 0 ||
                    (ingresosPorTipo.ingresos_por_tipo?.length ?? 0) > 0) && (
                    <button
                      onClick={abrirModalExportIngresos}
                      className="btn btn-outline-ink"
                    >
                      <i className="bi bi-download me-2"></i>
                      Exportar detalle
                    </button>
                  )}
              </div>
            </div>

            {/* Resultados */}
            {isLoadingIngresos ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando reporte...
              </div>
            ) : ingresosPorTipo &&
              ingresosPorTipo.ingresos_por_tipo &&
              ingresosPorTipo.ingresos_por_tipo.length > 0 ? (
              <div>
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-4">
                      <div className="card border-oxblood">
                        <div className="card-body text-center">
                          <div className="text-oxblood small mb-1">
                            Total General
                          </div>
                          <div className="h3 text-oxblood fw-bold">
                            $
                            {ingresosPorTipo.total_general.toLocaleString(
                              "es-AR",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border-success">
                        <div className="card-body text-center">
                          <div className="text-success small mb-1">
                            Cantidad de Movimientos
                          </div>
                          <div className="h3 text-success fw-bold">
                            {ingresosPorTipo.cantidad_total}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border-info">
                        <div className="card-body text-center">
                          <div className="text-info small mb-1">
                            Tipos de Pago
                          </div>
                          <div className="h3 text-info fw-bold">
                            {ingresosPorTipo.ingresos_por_tipo.length}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table gt-table align-middle">
                    <thead>
                      <tr>
                        <th>Método de Pago</th>
                        <th className="text-center">Cantidad</th>
                        <th className="text-end">Total</th>
                        <th className="text-end">Porcentaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingresosPorTipo.ingresos_por_tipo.map(
                        (item: any, index: number) => {
                          const porcentaje =
                            ingresosPorTipo.total_general > 0
                              ? (
                                  (item.total / ingresosPorTipo.total_general) *
                                  100
                                ).toFixed(2)
                              : "0.00";
                          return (
                            <tr key={index}>
                              <td className="fw-medium">
                                <span className="badge bg-secondary me-2">
                                  {item.metodo === "EFECTIVO"
                                    ? "💵"
                                    : item.metodo === "DEBITO"
                                    ? "💳"
                                    : item.metodo === "CREDITO"
                                    ? "💳"
                                    : item.metodo === "BILLETERA_VIRTUAL"
                                    ? "📱"
                                    : item.metodo === "TRANSFERENCIA"
                                    ? "🏦"
                                    : "💰"}
                                </span>
                                {item.metodo === "EFECTIVO"
                                  ? "Efectivo"
                                  : item.metodo === "DEBITO"
                                  ? "Débito"
                                  : item.metodo === "CREDITO"
                                  ? "Crédito"
                                  : item.metodo === "BILLETERA_VIRTUAL" || item.metodo === "TRANSFERENCIA"
                                  ? "Transferencia"
                                  : item.metodo === "SIN_METODO"
                                  ? "Sin Método"
                                  : item.metodo}
                              </td>
                              <td className="text-center">
                                <span className="badge bg-info">
                                  {item.cantidad}
                                </span>
                              </td>
                              <td className="text-end fw-semibold text-success">
                                $
                                {item.total.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="text-end">
                                <span className="badge bg-light text-dark">
                                  {porcentaje}%
                                </span>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                    <tfoot className="table-secondary">
                      <tr>
                        <td className="fw-bold">TOTAL GENERAL</td>
                        <td className="text-center fw-bold">
                          {ingresosPorTipo.cantidad_total}
                        </td>
                        <td className="text-end fw-bold text-success">
                          $
                          {ingresosPorTipo.total_general.toLocaleString(
                            "es-AR",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td className="text-end fw-bold">100.00%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Tabla detallada de movimientos */}
                {ingresosPorTipo.detalles && ingresosPorTipo.detalles.length > 0 && (
                  <div className="mt-4">
                    <h6 className="mb-3">
                      <i className="bi bi-list-ul me-2"></i>
                      Detalle de Movimientos ({ingresosPorTipo.detalles.length})
                    </h6>
                    <div className="table-responsive">
                      <table className="table table-sm gt-table align-middle">
                        <thead>
                          <tr>
                            <th>Fecha/Hora</th>
                            <th>Origen/Concepto</th>
                            <th>Categoría</th>
                            <th>Método de Pago</th>
                            <th className="text-end">Monto</th>
                            <th>Destino</th>
                            <th>Usuario</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ingresosPorTipo.detalles.map((detalle: any, index: number) => (
                            <tr key={detalle.id || index}>
                              <td className="small">
                                {detalle.fecha_hora
                                  ? format(new Date(detalle.fecha_hora), "dd/MM/yyyy HH:mm", { locale: es })
                                  : "N/A"}
                              </td>
                              <td className="small">
                                <span className="text-muted">{detalle.origen || "N/A"}</span>
                              </td>
                              <td>
                                <span className="badge bg-secondary small">
                                  {detalle.categoria || "N/A"}
                                </span>
                              </td>
                              <td>
                                <span className="badge bg-info small">
                                  {detalle.metodo_pago === "EFECTIVO"
                                    ? "Efectivo"
                                    : detalle.metodo_pago === "DEBITO"
                                    ? "Débito"
                                    : detalle.metodo_pago === "CREDITO"
                                    ? "Crédito"
                                    : detalle.metodo_pago === "BILLETERA_VIRTUAL" || detalle.metodo_pago === "TRANSFERENCIA"
                                    ? "Transferencia"
                                    : detalle.metodo_pago || "N/A"}
                                </span>
                              </td>
                              <td className="text-end fw-semibold text-success small">
                                ${detalle.monto.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="small text-muted">
                                {detalle.cuenta_destino_nombre || "N/A"}
                              </td>
                              <td className="small text-muted">
                                {detalle.usuario_nombre || "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : ingresosPorTipo &&
              ingresosPorTipo.ingresos_por_tipo &&
              ingresosPorTipo.ingresos_por_tipo.length === 0 ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox display-1 d-block mb-3"></i>
                <h5 className="text-muted">No hay datos</h5>
                <p className="text-muted">
                  No se encontraron ingresos para el rango de fechas
                  seleccionado.
                  <br />
                  <small>Verifica las fechas seleccionadas.</small>
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Reporte: Stock por Estado */}
      {selectedReporte === "stock_estado" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-boxes me-2"></i>
              Stock por Estado
            </h5>
            <p className="text-muted small mb-0">
              Inventario agrupado por estado: Salón, Clientes, Modista,
              Lavandería, Vendido
            </p>
          </div>
          <div className="card-body">
            {/* Botones de acción */}
            <div className="mb-4 d-flex justify-content-between align-items-center">
              <div>
                <button
                  onClick={obtenerStockPorEstado}
                  disabled={isLoadingStock}
                  className="btn btn-oxblood"
                >
                  {isLoadingStock ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Cargando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise me-2"></i>
                      Actualizar
                    </>
                  )}
                </button>
              </div>
              {stockPorEstado &&
                stockPorEstado.stock_por_estado &&
                stockPorEstado.stock_por_estado.length > 0 && (
                  <button
                    onClick={exportarStockExcel}
                    className="btn btn-outline-ink"
                  >
                    <i className="bi bi-download me-2"></i>
                    Exportar Excel
                  </button>
                )}
            </div>

            {/* Resultados */}
            {isLoadingStock ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Cargando reporte...
              </div>
            ) : stockPorEstado &&
              stockPorEstado.stock_por_estado &&
              stockPorEstado.stock_por_estado.length > 0 ? (
              <div>
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="card border-oxblood">
                        <div className="card-body text-center">
                          <div className="text-oxblood small mb-1">
                            Total Productos
                          </div>
                          <div className="h3 text-oxblood fw-bold">
                            {stockPorEstado.total_productos}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {stockPorEstado.stock_por_estado.map(
                  (item: any, index: number) => {
                    const porcentajeProductos =
                      stockPorEstado.total_productos > 0
                        ? (
                            (item.cantidad_productos /
                              stockPorEstado.total_productos) *
                            100
                          ).toFixed(2)
                        : "0.00";

                    const getEstadoBadge = (estado: string) => {
                      switch (estado) {
                        case "SALON":
                          return "bg-oxblood";
                        case "CLIENTE":
                          return "bg-info";
                        case "LAVANDERIA":
                          return "bg-warning";
                        case "MODISTA":
                          return "bg-secondary";
                        case "VENDIDO":
                          return "bg-success";
                        default:
                          return "bg-dark";
                      }
                    };

                    const getEstadoNombre = (estado: string) => {
                      switch (estado) {
                        case "SALON":
                          return "Salón";
                        case "CLIENTE":
                          return "Cliente";
                        case "LAVANDERIA":
                          return "Lavandería";
                        case "MODISTA":
                          return "Modista";
                        case "VENDIDO":
                          return "Vendido";
                        default:
                          return estado;
                      }
                    };

                    const estadosDisponibles = [
                      "SALON",
                      "CLIENTE",
                      "LAVANDERIA",
                      "MODISTA",
                      "VENDIDO",
                    ];

                    // Paginación
                    const paginaActual = paginasPorEstado[item.estado] || 1;
                    const productos = item.productos || [];
                    const totalPaginas = Math.ceil(
                      productos.length / productosPorPaginaStock
                    );
                    const indiceInicio =
                      (paginaActual - 1) * productosPorPaginaStock;
                    const indiceFin = indiceInicio + productosPorPaginaStock;
                    const productosPaginados = productos.slice(
                      indiceInicio,
                      indiceFin
                    );

                    const cambiarPagina = (nuevaPagina: number) => {
                      setPaginasPorEstado((prev) => ({
                        ...prev,
                        [item.estado]: nuevaPagina,
                      }));
                    };

                    return (
                      <div key={index} className="card mb-3">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <div>
                            <span
                              className={`badge ${getEstadoBadge(
                                item.estado
                              )} me-2`}
                            >
                              {getEstadoNombre(item.estado)}
                            </span>
                            <span className="badge bg-light text-dark">
                              {item.cantidad_productos} productos
                            </span>
                            <span className="badge bg-light text-dark ms-2">
                              {porcentajeProductos}%
                            </span>
                          </div>
                        </div>
                        <div className="card-body">
                          <div className="table-responsive">
                            <table className="table table-sm table-hover mb-0">
                              <thead>
                                <tr>
                                  <th>Código</th>
                                  <th>Descripción</th>
                                  <th>Línea</th>
                                  <th>Talle</th>
                                  <th>Color</th>
                                  <th>Tela</th>
                                  <th>Estado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {productosPaginados.length > 0 ? (
                                  productosPaginados.map((producto: any) => (
                                    <tr key={producto.id}>
                                      <td className="fw-medium">
                                        {producto.codigo_barra}
                                      </td>
                                      <td>{producto.descripcion}</td>
                                      <td className="small text-muted">
                                        {producto.linea}
                                      </td>
                                      <td className="small text-muted">
                                        {producto.talle}
                                      </td>
                                      <td className="small text-muted">
                                        {producto.color}
                                      </td>
                                      <td className="small text-muted">
                                        {producto.tela}
                                      </td>
                                      <td>
                                        <span
                                          className={`badge ${getEstadoBadge(
                                            item.estado
                                          )}`}
                                        >
                                          {getEstadoNombre(item.estado)}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td
                                      colSpan={7}
                                      className="text-center text-muted py-3"
                                    >
                                      No hay productos en este estado
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Paginación */}
                          {totalPaginas > 1 && (
                            <div className="d-flex justify-content-between align-items-center mt-3">
                              <div className="text-muted small">
                                Mostrando {indiceInicio + 1} -{" "}
                                {Math.min(indiceFin, productos.length)} de{" "}
                                {productos.length} productos
                              </div>
                              <nav>
                                <ul className="pagination pagination-sm mb-0">
                                  <li
                                    className={`page-item ${
                                      paginaActual === 1 ? "disabled" : ""
                                    }`}
                                  >
                                    <button
                                      className="page-link"
                                      onClick={() =>
                                        cambiarPagina(paginaActual - 1)
                                      }
                                      disabled={paginaActual === 1}
                                    >
                                      Anterior
                                    </button>
                                  </li>
                                  {Array.from(
                                    { length: totalPaginas },
                                    (_, i) => i + 1
                                  ).map((pagina) => {
                                    // Mostrar solo algunas páginas alrededor de la actual
                                    if (
                                      pagina === 1 ||
                                      pagina === totalPaginas ||
                                      (pagina >= paginaActual - 1 &&
                                        pagina <= paginaActual + 1)
                                    ) {
                                      return (
                                        <li
                                          key={pagina}
                                          className={`page-item ${
                                            paginaActual === pagina
                                              ? "active"
                                              : ""
                                          }`}
                                        >
                                          <button
                                            className="page-link"
                                            onClick={() =>
                                              cambiarPagina(pagina)
                                            }
                                          >
                                            {pagina}
                                          </button>
                                        </li>
                                      );
                                    } else if (
                                      pagina === paginaActual - 2 ||
                                      pagina === paginaActual + 2
                                    ) {
                                      return (
                                        <li
                                          key={pagina}
                                          className="page-item disabled"
                                        >
                                          <span className="page-link">...</span>
                                        </li>
                                      );
                                    }
                                    return null;
                                  })}
                                  <li
                                    className={`page-item ${
                                      paginaActual === totalPaginas
                                        ? "disabled"
                                        : ""
                                    }`}
                                  >
                                    <button
                                      className="page-link"
                                      onClick={() =>
                                        cambiarPagina(paginaActual + 1)
                                      }
                                      disabled={paginaActual === totalPaginas}
                                    >
                                      Siguiente
                                    </button>
                                  </li>
                                </ul>
                              </nav>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            ) : stockPorEstado &&
              stockPorEstado.stock_por_estado &&
              stockPorEstado.stock_por_estado.length === 0 ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox display-1 d-block mb-3"></i>
                <h5 className="text-muted">No hay datos</h5>
                <p className="text-muted">
                  No se encontraron productos en la sucursal.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Reporte: Stock por Línea */}
      {selectedReporte === "stock_por_linea" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-clipboard-list me-2"></i>
              Stock por Línea
            </h5>
            <p className="text-muted small mb-0">
              Inventario agrupado por línea, valorizado a costo y precio de
              venta
            </p>
          </div>
          <div className="card-body">
            {/* Botones de acción */}
            <div className="mb-4 d-flex justify-content-between align-items-center">
              <div>
                <button
                  onClick={obtenerStockPorLinea}
                  disabled={isLoadingStockLinea}
                  className="btn btn-oxblood"
                >
                  {isLoadingStockLinea ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Cargando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise me-2"></i>
                      Actualizar
                    </>
                  )}
                </button>
              </div>
              {stockPorLinea &&
                stockPorLinea.stock_por_linea &&
                stockPorLinea.stock_por_linea.length > 0 && (
                  <button
                    onClick={exportarStockLineaExcel}
                    className="btn btn-outline-ink"
                  >
                    <i className="bi bi-download me-2"></i>
                    Exportar Excel
                  </button>
                )}
            </div>

            {/* Resultados */}
            {isLoadingStockLinea ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Cargando reporte...
              </div>
            ) : stockPorLinea &&
              stockPorLinea.stock_por_linea &&
              stockPorLinea.stock_por_linea.length > 0 ? (
              <div>
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-3">
                      <div className="card border-oxblood">
                        <div className="card-body text-center">
                          <div className="text-oxblood small mb-1">
                            Total Productos
                          </div>
                          <div className="h3 text-oxblood fw-bold">
                            {stockPorLinea.total_productos}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card border-warning">
                        <div className="card-body text-center">
                          <div className="text-warning small mb-1">
                            Valor Total a Costo
                          </div>
                          <div className="h3 text-warning fw-bold">
                            $
                            {stockPorLinea.total_valor_costo.toLocaleString(
                              "es-AR",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card border-info">
                        <div className="card-body text-center">
                          <div className="text-info small mb-1">
                            Valor Total a Venta
                          </div>
                          <div className="h3 text-info fw-bold">
                            $
                            {stockPorLinea.total_valor_venta.toLocaleString(
                              "es-AR",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card border-success">
                        <div className="card-body text-center">
                          <div className="text-success small mb-1">
                            Diferencia
                          </div>
                          <div className="h3 text-success fw-bold">
                            $
                            {(
                              stockPorLinea.total_valor_venta -
                              stockPorLinea.total_valor_costo
                            ).toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table gt-table align-middle">
                    <thead>
                      <tr>
                        <th>Línea</th>
                        <th className="text-center">Cantidad de Productos</th>
                        <th className="text-end">Valor a Costo</th>
                        <th className="text-end">Valor a Venta</th>
                        <th className="text-end">Diferencia</th>
                        <th className="text-center">% Productos</th>
                        <th className="text-end">% Valor Venta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockPorLinea.stock_por_linea.map(
                        (item: any, index: number) => {
                          const porcentajeProductos =
                            stockPorLinea.total_productos > 0
                              ? (
                                  (item.cantidad_productos /
                                    stockPorLinea.total_productos) *
                                  100
                                ).toFixed(2)
                              : "0.00";
                          const porcentajeValor =
                            stockPorLinea.total_valor_venta > 0
                              ? (
                                  (item.valor_venta /
                                    stockPorLinea.total_valor_venta) *
                                  100
                                ).toFixed(2)
                              : "0.00";
                          const diferencia =
                            item.valor_venta - item.valor_costo;

                          return (
                            <tr key={index}>
                              <td className="fw-medium">
                                <span className="badge bg-secondary me-2">
                                  {item.linea || "SIN LÍNEA"}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className="badge bg-light text-dark">
                                  {item.cantidad_productos}
                                </span>
                              </td>
                              <td className="text-end fw-semibold text-warning">
                                $
                                {item.valor_costo.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="text-end fw-semibold text-info">
                                $
                                {item.valor_venta.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td
                                className={`text-end fw-semibold ${
                                  diferencia >= 0
                                    ? "text-success"
                                    : "text-danger"
                                }`}
                              >
                                $
                                {diferencia.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="text-center">
                                <span className="badge bg-light text-dark">
                                  {porcentajeProductos}%
                                </span>
                              </td>
                              <td className="text-end">
                                <span className="badge bg-light text-dark">
                                  {porcentajeValor}%
                                </span>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                    <tfoot className="table-secondary">
                      <tr>
                        <td className="fw-bold">TOTAL GENERAL</td>
                        <td className="text-center fw-bold">
                          {stockPorLinea.total_productos}
                        </td>
                        <td className="text-end fw-bold text-warning">
                          $
                          {stockPorLinea.total_valor_costo.toLocaleString(
                            "es-AR",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td className="text-end fw-bold text-info">
                          $
                          {stockPorLinea.total_valor_venta.toLocaleString(
                            "es-AR",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>
                        <td
                          className={`text-end fw-bold ${
                            stockPorLinea.total_valor_venta -
                              stockPorLinea.total_valor_costo >=
                            0
                              ? "text-success"
                              : "text-danger"
                          }`}
                        >
                          $
                          {(
                            stockPorLinea.total_valor_venta -
                            stockPorLinea.total_valor_costo
                          ).toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="text-center fw-bold">100.00%</td>
                        <td className="text-end fw-bold">100.00%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : stockPorLinea &&
              stockPorLinea.stock_por_linea &&
              stockPorLinea.stock_por_linea.length === 0 ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox display-1 d-block mb-3"></i>
                <h5 className="text-muted">No hay datos</h5>
                <p className="text-muted">
                  No se encontraron productos en la sucursal.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Reporte: Saldos a Cobrar */}
      {selectedReporte === "saldos_clientes" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-people me-2"></i>
              Saldos a Cobrar
            </h5>
            <p className="text-muted small mb-0">
              Clientes con saldos pendientes cuyo evento cae en el rango de fechas
            </p>
          </div>
          <div className="card-body">
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaDesdeSaldos}
                  onChange={(e) => setFechaDesdeSaldos(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaHastaSaldos}
                  onChange={(e) => setFechaHastaSaldos(e.target.value)}
                />
              </div>
              <div className="col-md-4 d-flex align-items-end gap-2">
                <button
                  onClick={obtenerSaldosACobrar}
                  disabled={
                    isLoadingSaldos || !fechaDesdeSaldos || !fechaHastaSaldos
                  }
                  className="btn btn-oxblood"
                >
                  {isLoadingSaldos ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Generar Reporte
                    </>
                  )}
                </button>
                {saldosACobrar.length > 0 && (
                  <button
                    onClick={exportarSaldosExcel}
                    className="btn btn-outline-ink"
                  >
                    <i className="bi bi-download me-2"></i>
                    Excel
                  </button>
                )}
              </div>
            </div>

            {/* Resultados */}
            {isLoadingSaldos ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando reporte...
              </div>
            ) : saldosACobrar.length > 0 ? (
              <div>
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="card border-oxblood">
                        <div className="card-body text-center">
                          <div className="text-oxblood small mb-1">
                            Total Clientes con Saldo
                          </div>
                          <div className="h3 text-oxblood fw-bold">
                            {saldosACobrar.length}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card border-danger">
                        <div className="card-body text-center">
                          <div className="text-danger small mb-1">
                            Total Saldo Pendiente
                          </div>
                          <div className="h3 text-danger fw-bold">
                            $
                            {saldosACobrar
                              .reduce(
                                (sum, item) => sum + item.total_saldo_pendiente,
                                0
                              )
                              .toLocaleString("es-AR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table gt-table align-middle">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>DNI</th>
                        <th>Celular</th>
                        <th>Teléfono</th>
                        <th className="text-center">Órdenes</th>
                        <th className="text-end">Saldo Pendiente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saldosACobrar.map((item: any) => (
                        <tr
                          key={
                            item.cliente_id ??
                            `precliente-${item.precliente_id}`
                          }
                        >
                          <td className="fw-medium">{item.cliente_nombre}</td>
                          <td className="small text-muted">
                            {item.cliente_dni}
                          </td>
                          <td className="small text-muted">
                            {item.cliente_celular || "-"}
                          </td>
                          <td className="small text-muted">
                            {item.cliente_telefono || "-"}
                          </td>
                          <td className="text-center">
                            <span className="badge bg-info">
                              {item.cantidad_ordenes}
                            </span>
                          </td>
                          <td className="text-end fw-bold text-danger">
                            $
                            {item.total_saldo_pendiente.toLocaleString(
                              "es-AR",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-secondary">
                      <tr>
                        <td colSpan={4} className="fw-bold">
                          TOTAL GENERAL
                        </td>
                        <td className="text-center fw-bold">
                          {saldosACobrar.reduce(
                            (sum, item) => sum + item.cantidad_ordenes,
                            0
                          )}
                        </td>
                        <td className="text-end fw-bold text-danger">
                          $
                          {saldosACobrar
                            .reduce(
                              (sum, item) => sum + item.total_saldo_pendiente,
                              0
                            )
                            .toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox display-1 d-block mb-3"></i>
                <h5 className="text-muted">No hay datos</h5>
                <p className="text-muted">
                  No se encontraron clientes con saldo pendiente para el rango
                  de fechas seleccionado.
                  <br />
                  <small>Verifica las fechas seleccionadas.</small>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reporte: Prendas a Armar */}
      {selectedReporte === "conjuntos_a_armar" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-clipboard-check me-2"></i>
              Prendas a Armar
            </h5>
            <p className="text-muted small mb-0">
              Órdenes sin contrato generado, a entregar entre las fechas seleccionadas.
              Lista de conjuntos a separar para cada cliente o precliente.
            </p>
          </div>
          <div className="card-body">
            <ConfigImpresionEtiquetas />
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaDesdePrendas}
                  onChange={(e) => setFechaDesdePrendas(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaHastaPrendas}
                  onChange={(e) => setFechaHastaPrendas(e.target.value)}
                />
              </div>
              <div className="col-md-4 d-flex align-items-end gap-2 flex-wrap">
                <button
                  onClick={generarReporteSemanaActual}
                  disabled={isLoadingPrendas}
                  className="btn btn-success"
                  title="Generar reporte de la semana actual (lunes a sábado)"
                >
                  {isLoadingPrendas ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-calendar-week me-2"></i>
                      Semana Actual
                    </>
                  )}
                </button>
                <button
                  onClick={() => obtenerPrendasAArmar()}
                  disabled={
                    isLoadingPrendas || !fechaDesdePrendas || !fechaHastaPrendas
                  }
                  className="btn btn-oxblood"
                >
                  {isLoadingPrendas ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Generar Reporte
                    </>
                  )}
                </button>
                {prendasAArmar.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline-ink"
                      onClick={() => marcarTodasPrendasAArmar(true)}
                    >
                      Marcar todas
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-ink"
                      onClick={() => marcarTodasPrendasAArmar(false)}
                    >
                      Desmarcar
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-ink"
                      disabled={
                        prendasSeleccionadas.length === 0 ||
                        imprimiendoEtiquetasPrendas
                      }
                      onClick={() => void handleImprimirEtiquetasPrendasSeleccionadas()}
                      title="Impresora anterior: una etiqueta con código de barras por cada prenda marcada"
                    >
                      <i className="bi bi-printer me-2"></i>
                      {imprimiendoEtiquetasPrendas
                        ? "Imprimiendo..."
                        : `Etiquetas por prenda (${prendasSeleccionadas.length})`}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Resultados */}
            {isLoadingPrendas ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando reporte...
              </div>
            ) : prendasAArmar.length > 0 ? (
              <div>
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="card border-oxblood">
                        <div className="card-body text-center">
                          <div className="text-oxblood small mb-1">
                            Total Órdenes
                          </div>
                          <div className="h3 text-oxblood fw-bold">
                            {prendasAArmar.length}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card border-success">
                        <div className="card-body text-center">
                          <div className="text-success small mb-1">
                            Total Productos a Armar
                          </div>
                          <div className="h3 text-success fw-bold">
                            {prendasAArmar.reduce(
                              (sum, orden) => sum + orden.cantidad_total_items,
                              0
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {colaVisualEtiquetasPrendas.length > 0 && (
                  <div className="border rounded mb-3 overflow-hidden bg-body">
                    <div className="border-bottom px-3 py-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
                      <h2 className="h6 mb-0">Cola: etiquetas por prenda</h2>
                      {imprimiendoEtiquetasPrendas ? (
                        <span className="badge bg-oxblood">En curso</span>
                      ) : (
                        <span className="badge bg-secondary">Finalizado</span>
                      )}
                    </div>
                    <ul className="list-group list-group-flush">
                      {colaVisualEtiquetasPrendas.map((row) => (
                        <li
                          key={row.key}
                          className={`list-group-item d-flex flex-column flex-md-row align-items-md-center gap-2 ${
                            row.estado === "imprimiendo" ? "list-group-item-primary" : ""
                          }`}
                        >
                          <div className="flex-grow-1 min-w-0">
                            <div className="fw-medium text-truncate" title={row.descripcion}>
                              {row.clienteNombre} - {row.descripcion}
                            </div>
                            <div className="small text-muted font-monospace">
                              {row.codigoBarra || `ID ${row.productoId}`}
                            </div>
                          </div>
                          <div className="align-self-md-center flex-shrink-0">
                            {row.estado === "imprimiendo" && (
                              <span className="text-oxblood small d-inline-flex align-items-center gap-2">
                                <span
                                  className="spinner-border spinner-border-sm"
                                  role="status"
                                  aria-hidden
                                />
                                Imprimiendo…
                              </span>
                            )}
                            {row.estado === "ok" && (
                              <span className="badge bg-success">Listo</span>
                            )}
                            {row.estado === "error" && (
                              <span className="badge bg-danger">Error</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="accordion" id="accordionPrendas">
                  {prendasAArmar.map((orden, index) => {
                    const fechaEventoFormateada = orden.fecha_evento
                      ? format(new Date(orden.fecha_evento), "dd/MM/yyyy", {
                          locale: es,
                        })
                      : "N/A";
                    const fechaRetiroFormateada = orden.fecha_retiro
                      ? format(new Date(orden.fecha_retiro), "dd/MM/yyyy", {
                          locale: es,
                        })
                      : "N/A";
                    const impresasEnOrden = prendaBloqueadaPorImpresionEnOrden(
                      orden
                    );

                    return (
                      <div key={orden.orden_id} className="accordion-item mb-2">
                        <h2
                          className="accordion-header"
                          id={`heading${orden.orden_id}`}
                        >
                          <button
                            className={`accordion-button ${
                              index !== 0 ? "collapsed" : ""
                            }`}
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target={`#collapse${orden.orden_id}`}
                            aria-expanded={index === 0 ? "true" : "false"}
                            aria-controls={`collapse${orden.orden_id}`}
                          >
                            <div className="d-flex justify-content-between align-items-center w-100 me-3">
                              <div className="text-start">
                                <strong>
                                  Orden #{orden.orden_id} - Presupuesto:{" "}
                                  {orden.presupuesto_numero}
                                </strong>
                                <br />
                                <small className="text-muted">
                                  {orden.cliente_nombre}
                                  {orden.es_precliente ? " (Precliente)" : ""} - Evento:{" "}
                                  {fechaEventoFormateada}
                                </small>
                              </div>
                              <span className="badge bg-info ms-2">
                                {orden.cantidad_total_items} items
                              </span>
                              {impresasEnOrden && (
                                <span
                                  className="badge bg-secondary ms-2"
                                  title="Etiquetas ya impresas al crear la orden"
                                >
                                  Impreso en orden
                                </span>
                              )}
                              {orden.conjunto_separado && (
                                <span
                                  className="badge bg-success ms-2 d-inline-flex align-items-center gap-1"
                                  title="Conjunto ya separado en perchero al crear la orden"
                                >
                                  <IconoPercha size={14} />
                                  Ya separado
                                </span>
                              )}
                            </div>
                          </button>
                        </h2>
                        <div
                          id={`collapse${orden.orden_id}`}
                          className={`accordion-collapse collapse ${
                            index === 0 ? "show" : ""
                          }`}
                          aria-labelledby={`heading${orden.orden_id}`}
                          data-bs-parent="#accordionPrendas"
                        >
                          <div className="accordion-body">
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 pb-3 border-bottom">
                              <div>
                                <div className="fw-semibold small">
                                  Etiqueta resumen del conjunto
                                </div>
                                <div className="text-muted small">
                                  XP-470B · 50×100 mm vertical · Márgenes mínimos ·
                                  Cliente, fechas, evento, lugar, prendas y nº de orden
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-success"
                                disabled={imprimiendoResumenOrdenId === orden.orden_id}
                                onClick={() =>
                                  void handleImprimirEtiquetaResumenConjunto(orden)
                                }
                                title="Una etiqueta con el resumen completo del conjunto para la Xprinter XP-470B"
                              >
                                <i className="bi bi-printer-fill me-2"></i>
                                {imprimiendoResumenOrdenId === orden.orden_id
                                  ? "Imprimiendo..."
                                  : "Imprimir etiqueta resumen (XP-470B)"}
                              </button>
                            </div>
                            {impresasEnOrden && (
                              <div className="alert alert-secondary py-2 small mb-3">
                                <i className="bi bi-printer-fill me-2"></i>
                                Las etiquetas por prenda de esta orden ya se
                                imprimieron al crearla. La reimpresión individual
                                desde este reporte está deshabilitada.
                              </div>
                            )}
                            {orden.conjunto_separado && (
                              <div className="alert alert-success py-2 small mb-3 d-flex align-items-start gap-2">
                                <IconoPercha size={20} className="flex-shrink-0 mt-1" />
                                <div>
                                  <strong>Conjunto ya separado</strong>
                                  <div className="mt-1">
                                    Las prendas quedaron separadas en perchero al
                                    confirmar la seña. Revisá etiquetas o detalle de
                                    modista si aplica; no hace falta volver a
                                    separar el conjunto.
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="row mb-3">
                              <div className="col-md-6">
                                <p className="mb-1">
                                  <strong>Cliente:</strong>{" "}
                                  {orden.cliente_nombre}
                                  {orden.es_precliente && (
                                    <span className="badge bg-warning text-dark ms-2">
                                      Precliente
                                    </span>
                                  )}
                                </p>
                                <p className="mb-1">
                                  <strong>DNI:</strong>{" "}
                                  {orden.cliente_dni || (orden.es_precliente ? "Pendiente" : "—")}
                                </p>
                                <p className="mb-1">
                                  <strong>Celular:</strong>{" "}
                                  {orden.cliente_celular || "N/A"}
                                </p>
                                <p className="mb-1">
                                  <strong>Dirección:</strong>{" "}
                                  {orden.cliente_direccion || (orden.es_precliente ? "Pendiente" : "N/A")}
                                </p>
                              </div>
                              <div className="col-md-6">
                                <p className="mb-1">
                                  <strong>Fecha Evento:</strong>{" "}
                                  {fechaEventoFormateada}
                                </p>
                                <p className="mb-1">
                                  <strong>Fecha Retiro:</strong>{" "}
                                  {fechaRetiroFormateada}
                                </p>
                                {orden.categoria_evento && (
                                  <p className="mb-1">
                                    <strong>Categoría:</strong>{" "}
                                    {orden.categoria_evento}
                                  </p>
                                )}
                                {orden.nombre_agasajado && (
                                  <p className="mb-1">
                                    <strong>Agasajado:</strong>{" "}
                                    {orden.nombre_agasajado}
                                  </p>
                                )}
                                {orden.lugar_evento && (
                                  <p className="mb-1">
                                    <strong>Lugar:</strong> {orden.lugar_evento}
                                  </p>
                                )}
                                <p className="mb-1">
                                  <strong>Total:</strong> $
                                  {orden.total.toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </p>
                              </div>
                            </div>

                            <div className="table-responsive">
                              <table className="table table-sm table-hover">
                                <thead>
                                  <tr>
                                    <th className="text-center" style={{ width: 44 }} />
                                    <th>Línea</th>
                                    <th>Talle</th>
                                    <th>Color</th>
                                    <th>Tela</th>
                                    <th>Descripción</th>
                                    <th>Estado crítico</th>
                                    <th>Modista</th>
                                    <th className="text-center">Cantidad</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orden.productos.map((producto: PrendaAArmarProducto) => (
                                    <tr
                                      key={`${orden.orden_id}-${producto.producto_id}`}
                                      className={
                                        impresasEnOrden ? "table-secondary opacity-75" : ""
                                      }
                                    >
                                      <td className="text-center">
                                        <input
                                          type="checkbox"
                                          className="form-check-input"
                                          checked={
                                            !impresasEnOrden &&
                                            !!seleccionPrendasAArmar[
                                              buildPrendaSelectionKey(
                                                orden.orden_id,
                                                producto.producto_id
                                              )
                                            ]
                                          }
                                          disabled={impresasEnOrden}
                                          onChange={() =>
                                            toggleSeleccionPrenda(
                                              orden.orden_id,
                                              producto.producto_id
                                            )
                                          }
                                          aria-label={`Seleccionar ${producto.descripcion}`}
                                          title={
                                            impresasEnOrden
                                              ? "Ya impreso al crear la orden"
                                              : undefined
                                          }
                                        />
                                      </td>
                                      <td className="small">
                                        {producto.linea || "—"}
                                      </td>
                                      <td className="small">
                                        {producto.talle || "—"}
                                      </td>
                                      <td className="small">
                                        {producto.color || "—"}
                                      </td>
                                      <td className="small">
                                        {producto.tela || "—"}
                                      </td>
                                      <td className="small">
                                        {producto.descripcion?.trim() || "—"}
                                      </td>
                                      <td>
                                        {producto.es_critico_armado ? (
                                          <span
                                            className="badge bg-danger"
                                            title={producto.ubicacion_critica || ""}
                                          >
                                            {producto.motivo_critico_armado || "Crítico"}
                                          </span>
                                        ) : (
                                          <span className="badge bg-success">Disponible</span>
                                        )}
                                      </td>
                                      <td className="small">
                                        {producto.requiere_modista ? (
                                          <div>
                                            <span className="badge bg-warning text-dark mb-1">
                                              <i className="bi bi-scissors me-1" />
                                              A modista
                                            </span>
                                            {producto.notas_modista && (
                                              <div className="text-muted">
                                                {producto.notas_modista}
                                              </div>
                                            )}
                                            {(producto.fecha_retiro ||
                                              orden.fecha_retiro) && (
                                              <div className="fw-semibold mt-1">
                                                Listo:{" "}
                                                {format(
                                                  new Date(
                                                    (producto.fecha_retiro ||
                                                      orden.fecha_retiro) +
                                                      "T00:00:00"
                                                  ),
                                                  "dd/MM/yyyy",
                                                  { locale: es }
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-muted">—</span>
                                        )}
                                      </td>
                                      <td className="text-center">
                                        <span className="badge bg-oxblood">
                                          {producto.cantidad}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox display-1 d-block mb-3"></i>
                <h5 className="text-muted">No hay datos</h5>
                <p className="text-muted">
                  No se encontraron órdenes de trabajo para el rango de fechas
                  seleccionado.
                  <br />
                  <small>Verifica las fechas seleccionadas.</small>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reporte: No Devolvieron */}
      {selectedReporte === "no_devolvieron" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-exclamation-triangle me-2"></i>
              No Devolvieron
            </h5>
            <p className="text-muted small mb-0">
              Órdenes de trabajo que superaron la fecha de devolución y aún no
              han devuelto los productos
            </p>
          </div>
          <div className="card-body">
            {/* Botones */}
            <div className="row mb-4">
              <div className="col-md-12 d-flex gap-2">
                <button
                  onClick={obtenerNoDevolvieron}
                  disabled={isLoadingNoDevolvieron}
                  className="btn btn-oxblood"
                >
                  {isLoadingNoDevolvieron ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Generar Reporte
                    </>
                  )}
                </button>
                {noDevolvieron.length > 0 && (
                  <button
                    onClick={exportarNoDevolvieronExcel}
                    className="btn btn-outline-danger"
                  >
                    <i className="bi bi-download me-2"></i>
                    Excel
                  </button>
                )}
              </div>
            </div>

            {/* Buscador */}
            {noDevolvieron.length > 0 && (
              <div className="row mb-3">
                <div className="col-md-6">
                  <input
                    type="text"
                    className="form-control gt-select"
                    placeholder="Buscar por DNI del cliente o ID de contrato..."
                    value={filtroNoDevolvieron}
                    onChange={(e) => setFiltroNoDevolvieron(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Resultados */}
            {isLoadingNoDevolvieron ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando reporte...
              </div>
            ) : noDevolvieronFiltrado.length > 0 ? (
              <div>
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-4">
                      <div className="card border-danger">
                        <div className="card-body text-center">
                          <div className="text-danger small mb-1">
                            Total Órdenes
                          </div>
                          <div className="h3 text-danger fw-bold">
                            {noDevolvieronFiltrado.length}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border-warning">
                        <div className="card-body text-center">
                          <div className="text-warning small mb-1">
                            Total Productos
                          </div>
                          <div className="h3 text-warning fw-bold">
                            {noDevolvieronFiltrado.reduce(
                              (sum, orden) => sum + orden.cantidad_total_items,
                              0
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border-danger">
                        <div className="card-body text-center">
                          <div className="text-danger small mb-1">
                            Saldo Pendiente
                          </div>
                          <div className="h3 text-danger fw-bold">
                            $
                            {noDevolvieronFiltrado
                              .reduce(
                                (sum, orden) => sum + orden.saldo_pendiente,
                                0
                              )
                              .toLocaleString("es-AR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="accordion" id="accordionNoDevolvieron">
                  {noDevolvieronFiltrado.map((orden, index) => {
                    const fechaEventoFormateada = orden.fecha_evento
                      ? format(new Date(orden.fecha_evento), "dd/MM/yyyy", {
                          locale: es,
                        })
                      : "N/A";
                    const fechaDevolucionFormateada = orden.fecha_devolucion
                      ? format(new Date(orden.fecha_devolucion), "dd/MM/yyyy", {
                          locale: es,
                        })
                      : "N/A";

                    return (
                      <div
                        key={orden.orden_id}
                        className="accordion-item mb-2 border-danger"
                      >
                        <h2
                          className="accordion-header"
                          id={`headingNoDev${orden.orden_id}`}
                        >
                          <button
                            className={`accordion-button ${
                              index !== 0 ? "collapsed" : ""
                            }`}
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target={`#collapseNoDev${orden.orden_id}`}
                            aria-expanded={index === 0 ? "true" : "false"}
                            aria-controls={`collapseNoDev${orden.orden_id}`}
                          >
                            <div className="d-flex justify-content-between align-items-center w-100 me-3">
                              <div className="text-start">
                                <strong>
                                  ID Contrato: {orden.orden_id}
                                </strong>
                                <br />
                                <small className="text-muted">
                                  {orden.cliente_nombre} - Devolución:{" "}
                                  {fechaDevolucionFormateada}
                                </small>
                                <br />
                                <small className="text-danger fw-bold">
                                  {orden.dias_retraso} días de retraso
                                </small>
                              </div>
                              <span className="badge bg-danger ms-2">
                                {orden.cantidad_total_items} items
                              </span>
                            </div>
                          </button>
                        </h2>
                        <div
                          id={`collapseNoDev${orden.orden_id}`}
                          className={`accordion-collapse collapse ${
                            index === 0 ? "show" : ""
                          }`}
                          aria-labelledby={`headingNoDev${orden.orden_id}`}
                          data-bs-parent="#accordionNoDevolvieron"
                        >
                          <div className="accordion-body">
                            <div className="row mb-3">
                              <div className="col-md-6">
                                <p className="mb-1">
                                  <strong>Cliente:</strong>{" "}
                                  {orden.cliente_nombre}
                                </p>
                                <p className="mb-1">
                                  <strong>DNI:</strong> {orden.cliente_dni}
                                </p>
                                <p className="mb-1">
                                  <strong>Celular:</strong>{" "}
                                  {orden.cliente_celular || "N/A"}
                                </p>
                                <p className="mb-1">
                                  <strong>Dirección:</strong>{" "}
                                  {orden.cliente_direccion || "N/A"}
                                </p>
                              </div>
                              <div className="col-md-6">
                                <p className="mb-1">
                                  <strong>Fecha Evento:</strong>{" "}
                                  {fechaEventoFormateada}
                                </p>
                                <p className="mb-1">
                                  <strong>Fecha Devolución:</strong>{" "}
                                  {fechaDevolucionFormateada}
                                </p>
                                <p className="mb-1">
                                  <strong className="text-danger">
                                    Días de Retraso:
                                  </strong>{" "}
                                  <span className="text-danger fw-bold">
                                    {orden.dias_retraso} días
                                  </span>
                                </p>
                                {orden.categoria_evento && (
                                  <p className="mb-1">
                                    <strong>Categoría:</strong>{" "}
                                    {orden.categoria_evento}
                                  </p>
                                )}
                                {orden.nombre_agasajado && (
                                  <p className="mb-1">
                                    <strong>Agasajado:</strong>{" "}
                                    {orden.nombre_agasajado}
                                  </p>
                                )}
                                {orden.lugar_evento && (
                                  <p className="mb-1">
                                    <strong>Lugar:</strong> {orden.lugar_evento}
                                  </p>
                                )}
                                <p className="mb-1">
                                  <strong>Total:</strong> $
                                  {orden.total.toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </p>
                                <p className="mb-1">
                                  <strong>Saldo Pendiente:</strong>{" "}
                                  <span className="text-danger fw-bold">
                                    $
                                    {orden.saldo_pendiente.toLocaleString(
                                      "es-AR",
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="table-responsive">
                              <table className="table table-sm table-hover">
                                <thead>
                                  <tr>
                                    <th>Código</th>
                                    <th>Descripción</th>
                                    <th>Línea</th>
                                    <th>Talle</th>
                                    <th>Color</th>
                                    <th>Tela</th>
                                    <th className="text-center">Cantidad</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orden.productos.map((producto: any) => (
                                    <tr key={producto.producto_id}>
                                      <td className="fw-medium">
                                        {producto.codigo_barra}
                                      </td>
                                      <td>{producto.descripcion}</td>
                                      <td className="small text-muted">
                                        {producto.linea}
                                      </td>
                                      <td className="small text-muted">
                                        {producto.talle}
                                      </td>
                                      <td className="small text-muted">
                                        {producto.color}
                                      </td>
                                      <td className="small text-muted">
                                        {producto.tela}
                                      </td>
                                      <td className="text-center">
                                        <span className="badge bg-danger">
                                          {producto.cantidad}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox display-1 d-block mb-3"></i>
                <h5 className="text-muted">No hay datos</h5>
                <p className="text-muted">
                  No se encontraron órdenes con productos no devueltos.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reporte: Productos Críticos */}
      {/* Reporte: Productos Críticos para Armado */}
      {selectedReporte === "productos_criticos_armado" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-exclamation-triangle me-2"></i>
              Productos Críticos para Armado Semanal
            </h5>
            <p className="text-muted small mb-0">
              Listado de productos críticos entre fechas, para ver productos que
              no están disponibles para el armado semanal. Ej: productos en
              lavandería, modista, etc, que se necesitan en la semana.
            </p>
          </div>
          <div className="card-body">
            {/* Filtros de fecha */}
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Fecha Desde</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaDesdeCriticosArmado}
                  onChange={(e) => setFechaDesdeCriticosArmado(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha Hasta</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaHastaCriticosArmado}
                  onChange={(e) => setFechaHastaCriticosArmado(e.target.value)}
                />
              </div>
            </div>

            {/* Botones */}
            <div className="row mb-4">
              <div className="col-md-12 d-flex gap-2">
                <button
                  onClick={obtenerProductosCriticosArmado}
                  disabled={isLoadingCriticosArmado}
                  className="btn btn-oxblood"
                >
                  {isLoadingCriticosArmado ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Generar Reporte
                    </>
                  )}
                </button>
                {productosCriticosArmado.length > 0 && (
                  <button
                    onClick={exportarProductosCriticosArmadoExcel}
                    className="btn btn-outline-danger"
                  >
                    <i className="bi bi-download me-2"></i>
                    Excel
                  </button>
                )}
              </div>
            </div>

            {/* Resultados */}
            {isLoadingCriticosArmado ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando reporte...
              </div>
            ) : productosCriticosArmado.length > 0 ? (
              <div>
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-3">
                      <div className="card border-danger">
                        <div className="card-body text-center">
                          <div className="text-danger small mb-1">
                            Total Productos
                          </div>
                          <div className="h3 text-danger fw-bold">
                            {productosCriticosArmado.length}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card border-warning">
                        <div className="card-body text-center">
                          <div className="text-warning small mb-1">
                            En Lavandería
                          </div>
                          <div className="h3 text-warning fw-bold">
                            {
                              productosCriticosArmado.filter(
                                (p) => p.motivo_critico === "En lavandería"
                              ).length
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card border-info">
                        <div className="card-body text-center">
                          <div className="text-info small mb-1">En Modista</div>
                          <div className="h3 text-info fw-bold">
                            {
                              productosCriticosArmado.filter(
                                (p) => p.motivo_critico === "En modista"
                              ).length
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card border-secondary">
                        <div className="card-body text-center">
                          <div className="text-secondary small mb-1">
                            En Cliente
                          </div>
                          <div className="h3 text-secondary fw-bold">
                            {
                              productosCriticosArmado.filter(
                                (p) =>
                                  p.motivo_critico === "En poder del cliente"
                              ).length
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th>Línea</th>
                        <th>Talle</th>
                        <th>Color</th>
                        <th>Estado</th>
                        <th>Motivo Crítico</th>
                        <th>Ubicación</th>
                        <th>Cliente</th>
                        <th>Presupuesto</th>
                        <th>Fecha Evento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosCriticosArmado.map((producto, index) => (
                        <tr
                          key={`${producto.producto_id}_${producto.orden_id}_${index}`}
                        >
                          <td className="fw-medium">{producto.codigo_barra}</td>
                          <td>{producto.descripcion}</td>
                          <td className="small text-muted">{producto.linea}</td>
                          <td className="small text-muted">{producto.talle}</td>
                          <td className="small text-muted">{producto.color}</td>
                          <td>
                            <span className="badge bg-secondary">
                              {producto.estado}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                producto.motivo_critico === "En lavandería"
                                  ? "bg-warning"
                                  : producto.motivo_critico === "En modista"
                                  ? "bg-info"
                                  : "bg-secondary"
                              }`}
                            >
                              {producto.motivo_critico}
                            </span>
                          </td>
                          <td className="small text-muted">
                            {producto.ubicacion_actual}
                          </td>
                          <td className="small">{producto.cliente_nombre}</td>
                          <td className="small fw-medium">
                            {producto.presupuesto_numero}
                          </td>
                          <td className="small">
                            {format(
                              new Date(producto.fecha_evento),
                              "dd/MM/yyyy",
                              { locale: es }
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted py-5">
                <i className="bi bi-inbox display-1 d-block mb-3"></i>
                <h5 className="text-muted">No hay datos</h5>
                <p className="text-muted">
                  No se encontraron productos críticos para el armado semanal en
                  el período seleccionado.
                  <br />
                  <small>
                    Selecciona un rango de fechas y genera el reporte para ver
                    los productos no disponibles.
                  </small>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reporte: Histórico de Producto */}
      {selectedReporte === "trazabilidad_producto" && (
        <div className="card">
          <div className="card-header bg-surface border-bottom border-line">
            <h5 className="card-title mb-0">
              <i className="bi bi-clock-history me-2"></i>
              Histórico de Producto
            </h5>
            <p className="text-muted small mb-0">
              Trazabilidad del producto hasta la fecha indicada (ingreso,
              alquileres, lavandería, modista, ventas). La línea de tiempo va del
              evento más reciente hacia atrás, hasta 10 eventos por página.
            </p>
          </div>
          <div className="card-body">
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Código de Barras</label>
                <input
                  type="text"
                  className="form-control gt-select"
                  placeholder="Ingresa el código de barras"
                  value={codigoBarraHistorico}
                  onChange={(e) => setCodigoBarraHistorico(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      void obtenerHistoricoProducto(1);
                    }
                  }}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha Hasta (Opcional)</label>
                <input
                  type="date"
                  className="form-control gt-select"
                  value={fechaHastaHistorico}
                  onChange={(e) => setFechaHastaHistorico(e.target.value)}
                />
                <small className="text-muted">
                  Si no se especifica, se usa la fecha actual
                </small>
              </div>
            </div>

            {/* Botones */}
            <div className="row mb-4">
              <div className="col-md-12 d-flex gap-2">
                <button
                  type="button"
                  onClick={() => void obtenerHistoricoProducto(1)}
                  disabled={isLoadingHistorico}
                  className="btn btn-oxblood"
                >
                  {isLoadingHistorico ? (
                    <>
                      <i className="bi bi-arrow-clockwise spin me-2"></i>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i>
                      Generar Histórico
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Resultados */}
            {isLoadingHistorico ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando histórico...
              </div>
            ) : historicoProducto ? (
              <div>
                {/* Información del Producto */}
                <div className="card border-oxblood mb-4">
                  <div className="card-header bg-oxblood text-white">
                    <h6 className="mb-0">Información del Producto</h6>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-3">
                        <strong>Código:</strong>{" "}
                        {historicoProducto.producto.codigo_barra}
                      </div>
                      <div className="col-md-6">
                        <strong>Descripción:</strong>{" "}
                        {historicoProducto.producto.descripcion}
                      </div>
                      <div className="col-md-3">
                        <strong>Estado Actual:</strong>{" "}
                        <span className="badge bg-secondary">
                          {historicoProducto.producto.estado_actual}
                        </span>
                      </div>
                      <div className="col-md-3">
                        <strong>Línea:</strong>{" "}
                        {historicoProducto.producto.linea}
                      </div>
                      <div className="col-md-3">
                        <strong>Talle:</strong>{" "}
                        {historicoProducto.producto.talle}
                      </div>
                      <div className="col-md-3">
                        <strong>Color:</strong>{" "}
                        {historicoProducto.producto.color}
                      </div>
                      <div className="col-md-3">
                        <strong>Veces Alquilado:</strong>{" "}
                        <span className="badge bg-danger">
                          {historicoProducto.producto.veces_alquilado}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen */}
                <div className="row mb-4">
                  <div className="col-md-3">
                    <div className="card border-success">
                      <div className="card-body text-center">
                        <div className="text-success small mb-1">
                          Alquileres
                        </div>
                        <div className="h4 text-success fw-bold">
                          {historicoProducto.resumen.total_alquileres}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-warning">
                      <div className="card-body text-center">
                        <div className="text-warning small mb-1">Ventas</div>
                        <div className="h4 text-warning fw-bold">
                          {historicoProducto.resumen.total_ventas}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-oxblood">
                      <div className="card-body text-center">
                        <div className="text-oxblood small mb-1">
                          Ingresos lavandería
                        </div>
                        <div className="h4 text-oxblood fw-bold">
                          {historicoProducto.resumen.total_lavanderia}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-secondary">
                      <div className="card-body text-center">
                        <div className="text-secondary small mb-1">
                          Ingresos modista
                        </div>
                        <div className="h4 text-secondary fw-bold">
                          {historicoProducto.resumen.total_modista}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline de Eventos */}
                <div className="timeline-container">
                  <h5 className="mb-3">Línea de Tiempo</h5>
                  {historicoProducto.paginacion && (
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                      <p className="text-muted small mb-0">
                        Mostrando{" "}
                        {historicoProducto.eventos.length === 0
                          ? 0
                          : (historicoProducto.paginacion.page - 1) *
                              historicoProducto.paginacion.page_size +
                            1}
                        –
                        {(historicoProducto.paginacion.page - 1) *
                          historicoProducto.paginacion.page_size +
                          historicoProducto.eventos.length}{" "}
                        de {historicoProducto.paginacion.total} eventos · Página{" "}
                        {historicoProducto.paginacion.page} de{" "}
                        {historicoProducto.paginacion.total_pages}
                      </p>
                      <div className="btn-group" role="group" aria-label="Paginación histórico">
                        <button
                          type="button"
                          className="btn btn-outline-ink btn-sm"
                          disabled={
                            isLoadingHistorico ||
                            !historicoProducto.paginacion.has_prev
                          }
                          onClick={() =>
                            void obtenerHistoricoProducto(
                              historicoProducto.paginacion.page - 1
                            )
                          }
                        >
                          <i className="bi bi-chevron-left me-1"></i>
                          Anterior
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-ink btn-sm"
                          disabled={
                            isLoadingHistorico ||
                            !historicoProducto.paginacion.has_next
                          }
                          onClick={() =>
                            void obtenerHistoricoProducto(
                              historicoProducto.paginacion.page + 1
                            )
                          }
                        >
                          Siguiente
                          <i className="bi bi-chevron-right ms-1"></i>
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="timeline">
                    {historicoProducto.eventos.map(
                      (evento: any, index: number) => {
                        const getIcon = () => {
                          switch (evento.tipo) {
                            case "ingreso":
                              return "bi-box-arrow-in-down";
                            case "alquiler":
                              return "bi-calendar-check";
                            case "venta":
                              return "bi-cash-coin";
                            case "lavanderia_ingreso":
                              return "bi-droplet";
                            case "lavanderia_salida":
                              return "bi-droplet-fill";
                            case "modista_ingreso":
                              return "bi-scissors";
                            case "modista_salida":
                              return "bi-scissors";
                            default:
                              return "bi-circle";
                          }
                        };

                        const getColor = () => {
                          switch (evento.tipo) {
                            case "ingreso":
                              return "primary";
                            case "alquiler":
                              return "success";
                            case "venta":
                              return "warning";
                            case "lavanderia_ingreso":
                            case "lavanderia_salida":
                              return "info";
                            case "modista_ingreso":
                            case "modista_salida":
                              return "secondary";
                            default:
                              return "dark";
                          }
                        };

                        const color = getColor();
                        const icon = getIcon();

                        return (
                          <div
                            key={`${historicoProducto.paginacion?.page ?? historicoPagina}-${evento.tipo}-${evento.fecha}-${index}`}
                            className="timeline-item"
                          >
                            <div className={`timeline-marker bg-${color}`}>
                              <i className={`bi ${icon}`}></i>
                            </div>
                            <div className="timeline-content">
                              <div className="card">
                                <div className="card-body">
                                  <div className="d-flex justify-content-between align-items-start mb-2">
                                    <h6 className="mb-0">
                                      {evento.descripcion}
                                    </h6>
                                    <span className={`badge bg-${color}`}>
                                      {format(
                                        new Date(evento.fecha),
                                        "dd/MM/yyyy",
                                        { locale: es }
                                      )}
                                    </span>
                                  </div>
                                  <p className="text-muted small mb-0">
                                    {evento.detalle}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {historicoProducto.eventos.length === 0 && (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-inbox display-1 d-block mb-3"></i>
                    <h5 className="text-muted">No hay eventos</h5>
                    <p className="text-muted">
                      No se encontraron eventos para este producto en el período
                      seleccionado.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted py-5">
                <i className="bi bi-search display-1 d-block mb-3"></i>
                <h5 className="text-muted">Buscar Histórico</h5>
                <p className="text-muted">
                  Ingresa el código de barras del producto para ver su
                  trazabilidad completa.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .card {
          transition: box-shadow 0.15s ease;
        }
        .card:hover {
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.05);
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .timeline-container {
          margin-top: 2rem;
        }
        .timeline {
          position: relative;
          padding-left: 2rem;
        }
        .timeline-item {
          position: relative;
          padding-bottom: 2rem;
        }
        .timeline-item:not(:last-child)::before {
          content: "";
          position: absolute;
          left: -1.5rem;
          top: 2rem;
          width: 2px;
          height: calc(100% - 1rem);
          background-color: #dee2e6;
        }
        .timeline-marker {
          position: absolute;
          left: -2rem;
          top: 0;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1rem;
          z-index: 1;
        }
        .timeline-content {
          margin-left: 1rem;
        }
      `}</style>

      {/* Modal exportar ingresos por tipo */}
      <div
        className={`modal fade ${showExportIngresosModal ? "show" : ""}`}
        style={{ display: showExportIngresosModal ? "block" : "none" }}
      >
        <div className="modal-dialog modal-dialog-centered modal-sm">
          <div className="modal-content">
            <div className="modal-header py-2">
              <h5 className="modal-title fs-6">
                <i className="bi bi-download me-2"></i>
                Exportar detalle
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowExportIngresosModal(false)}
                disabled={exportandoIngresos}
                aria-label="Cerrar"
              />
            </div>
            <div className="modal-body pt-2">
              <p className="small text-muted mb-3">
                Período:{" "}
                <strong>
                  {fechaDesdeIngresos === fechaHastaIngresos
                    ? fechaDesdeIngresos
                    : `${fechaDesdeIngresos} — ${fechaHastaIngresos}`}
                </strong>
              </p>
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
                    name="export-ingresos-formato"
                    id="export-ingresos-excel"
                    checked={exportIngresosFormato === "excel"}
                    onChange={() => setExportIngresosFormato("excel")}
                  />
                  <label
                    className="btn btn-outline-ink btn-sm"
                    htmlFor="export-ingresos-excel"
                  >
                    <i className="bi bi-file-earmark-spreadsheet me-1"></i>
                    Excel
                  </label>
                  <input
                    type="radio"
                    className="btn-check"
                    name="export-ingresos-formato"
                    id="export-ingresos-pdf"
                    checked={exportIngresosFormato === "pdf"}
                    onChange={() => setExportIngresosFormato("pdf")}
                  />
                  <label
                    className="btn btn-outline-ink btn-sm"
                    htmlFor="export-ingresos-pdf"
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
                className="btn btn-outline-ink btn-sm"
                onClick={() => setShowExportIngresosModal(false)}
                disabled={exportandoIngresos}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={ejecutarExportacionIngresos}
                disabled={exportandoIngresos}
              >
                {exportandoIngresos ? (
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
      {showExportIngresosModal && (
        <div
          className="modal-backdrop fade show"
          style={{ display: "block" }}
        />
      )}
    </div>
  );
}
