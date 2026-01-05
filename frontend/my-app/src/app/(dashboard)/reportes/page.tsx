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

export default function ReportesPage() {
  const { token, me } = useAuth();
  const esEmpleado = me?.role === "EMPLEADO";

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
  const [isLoadingContratos, setIsLoadingContratos] = useState(false);

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
  const [prendasAArmar, setPrendasAArmar] = useState<any[]>([]);
  const [isLoadingPrendas, setIsLoadingPrendas] = useState(false);

  // Estados para el reporte de no devolvieron
  const [noDevolvieron, setNoDevolvieron] = useState<any[]>([]);
  const [isLoadingNoDevolvieron, setIsLoadingNoDevolvieron] = useState(false);

  // Estados para el reporte de productos críticos
  const [productosCriticos, setProductosCriticos] = useState<any[]>([]);
  const [isLoadingProductosCriticos, setIsLoadingProductosCriticos] = useState(false);

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
        desc: "Comprobantes de señas y pagos adicionales",
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
        desc: "Saldos de clientes por fecha",
        icon: Users,
      },
      {
        key: "conjuntos_a_armar",
        title: "Conjuntos a armar",
        desc: "Listado por fecha",
        icon: ClipboardList,
      },
      {
        key: "ordenes_produccion",
        title: "Órdenes de producción",
        desc: "Entre fechas",
        icon: ClipboardList,
      },
      {
        key: "no_devolvieron",
        title: "No devolvieron",
        desc: "Clientes pendientes por fecha",
        icon: CircleAlert,
      },
      {
        key: "productos_criticos",
        title: "Productos críticos",
        desc: "Productos con nivel alto de desgaste o uso",
        icon: Boxes,
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

  // Asegurar que empleados solo vean "Conjuntos a armar"
  useEffect(() => {
    if (esEmpleado && selectedReporte !== "conjuntos_a_armar") {
      setSelectedReporte("conjuntos_a_armar");
    }
  }, [esEmpleado, selectedReporte]);

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

  const exportarCSV = () => {
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

    const csvContent = [
      headers.join(","),
      ...rows.map((row: (string | number)[]) =>
        row.map((cell: string | number) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alquileres_por_prenda_${fechaDesde}_${fechaHasta}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("CSV exportado correctamente");
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

  const exportarRankingCSV = () => {
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

    const csvContent = [
      headers.join(","),
      ...rows.map((row: (string | number)[]) =>
        row.map((cell: string | number) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ranking_alquileres_${fechaDesdeRanking}_${fechaHastaRanking}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("CSV exportado correctamente");
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
        filtro_fecha: filtroFechaContratos,
        tipo: tipoContrato,
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
        setContratos(data.data.contratos || []);
        toast.success(
          `Reporte generado: ${data.data.total_contratos} contratos encontrados`
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

  const exportarContratosCSV = () => {
    if (contratos.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = [
      "Tipo",
      "Número",
      "Cliente",
      "DNI",
      "Fecha Creación",
      "Fecha Evento",
      "Fecha Retiro",
      "Fecha Devolución",
      "Categoría",
      "Agasajado",
      "Lugar",
      "Total",
      "Estado",
      "Items",
      "Seña Pagada",
      "Saldo Pendiente",
      "Método Pago",
    ];

    const rows = contratos.map((item) => [
      item.tipo === "orden_trabajo" ? "Orden de Trabajo" : "Presupuesto",
      item.numero,
      item.cliente_nombre,
      item.cliente_dni,
      item.fecha_creacion,
      item.fecha_evento || "N/A",
      item.fecha_retiro || "N/A",
      item.fecha_devolucion || "N/A",
      item.categoria_evento,
      item.nombre_agasajado,
      item.lugar_evento,
      item.total.toString(),
      item.estado,
      item.cantidad_items.toString(),
      item.seña_pagada?.toString() || "N/A",
      item.saldo_pendiente?.toString() || "N/A",
      item.metodo_pago || "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: (string | number)[]) =>
        row.map((cell: string | number) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contratos_por_fecha_${fechaDesdeContratos}_${fechaHastaContratos}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("CSV exportado correctamente");
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

  const exportarRecibosCSV = () => {
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

    const csvContent = [
      headers.join(","),
      ...rows.map((row: (string | number)[]) =>
        row.map((cell: string | number) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recibos_por_fecha_${fechaDesdeRecibos}_${fechaHastaRecibos}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("CSV exportado correctamente");
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

  const exportarIngresosCSV = () => {
    if (
      !ingresosPorTipo ||
      !ingresosPorTipo.ingresos_por_tipo ||
      ingresosPorTipo.ingresos_por_tipo.length === 0
    ) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = ["Método de Pago", "Cantidad", "Total"];

    const rows = ingresosPorTipo.ingresos_por_tipo.map((item: any) => [
      item.metodo,
      item.cantidad.toString(),
      item.total.toFixed(2).replace(".", ","),
    ]);

    // Agregar fila de total
    rows.push([
      "TOTAL GENERAL",
      ingresosPorTipo.cantidad_total.toString(),
      ingresosPorTipo.total_general.toFixed(2).replace(".", ","),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: (string | number)[]) =>
        row.map((cell: string | number) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ingresos_por_tipo_${fechaDesdeIngresos}_${fechaHastaIngresos}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("CSV exportado correctamente");
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

  const exportarStockCSV = () => {
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

    const csvContent = [
      headers.join(","),
      ...rows.map((row: (string | number)[]) =>
        row.map((cell: string | number) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock_por_estado_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("CSV exportado correctamente");
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

  const exportarStockLineaCSV = () => {
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
      item.linea,
      item.cantidad_productos.toString(),
      item.valor_costo.toFixed(2).replace(".", ","),
      item.valor_venta.toFixed(2).replace(".", ","),
    ]);

    // Agregar fila de total
    rows.push([
      "TOTAL GENERAL",
      stockPorLinea.total_productos.toString(),
      stockPorLinea.total_valor_costo.toFixed(2).replace(".", ","),
      stockPorLinea.total_valor_venta.toFixed(2).replace(".", ","),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: (string | number)[]) =>
        row.map((cell: string | number) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock_por_linea_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("CSV exportado correctamente");
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

  const exportarSaldosCSV = () => {
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
      item.cantidad_ordenes.toString(),
      item.total_saldo_pendiente.toFixed(2).replace(".", ","),
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
      saldosACobrar
        .reduce((sum, item) => sum + item.cantidad_ordenes, 0)
        .toString(),
      totalSaldo.toFixed(2).replace(".", ","),
      "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: (string | number)[]) =>
        row.map((cell: string | number) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `saldos_a_cobrar_${fechaDesdeSaldos}_${fechaHastaSaldos}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("CSV exportado correctamente");
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

  const exportarPrendasPDF = () => {
    if (prendasAArmar.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const fechaDesdeFormateada = format(
      new Date(fechaDesdePrendas),
      "dd/MM/yyyy",
      { locale: es }
    );
    const fechaHastaFormateada = format(
      new Date(fechaHastaPrendas),
      "dd/MM/yyyy",
      { locale: es }
    );

    let htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prendas a Armar - ${fechaDesdeFormateada} al ${fechaHastaFormateada}</title>
    <style>
        @media print {
            @page {
                size: A4;
                margin: 1cm;
            }
            body { 
                margin: 0;
                padding: 0;
            }
            .no-print { display: none; }
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 10pt;
            margin: 0;
            padding: 10px;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
        }
        .header h1 {
            margin: 0;
            font-size: 18pt;
            font-weight: bold;
        }
        .header p {
            margin: 5px 0;
            font-size: 10pt;
        }
        .orden {
            page-break-inside: avoid;
            margin-bottom: 20px;
            border: 1px solid #ddd;
            padding: 10px;
            background-color: #f9f9f9;
        }
        .orden-header {
            font-weight: bold;
            font-size: 11pt;
            margin-bottom: 10px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
        }
        .orden-info {
            font-size: 9pt;
            margin-bottom: 8px;
        }
        .orden-info strong {
            font-weight: bold;
        }
        .productos-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 9pt;
        }
        .productos-table th {
            background-color: #333;
            color: white;
            padding: 6px;
            text-align: left;
            border: 1px solid #000;
        }
        .productos-table td {
            padding: 5px;
            border: 1px solid #ccc;
        }
        .productos-table tr:nth-child(even) {
            background-color: #f5f5f5;
        }
        .total-orden {
            text-align: right;
            font-weight: bold;
            margin-top: 10px;
            font-size: 10pt;
        }
        .resumen {
            margin-top: 30px;
            padding: 10px;
            background-color: #e9ecef;
            border: 1px solid #ccc;
            font-size: 10pt;
        }
        .resumen h2 {
            margin-top: 0;
            font-size: 14pt;
        }
        .botones {
            text-align: center;
            margin-top: 20px;
        }
        button {
            padding: 10px 20px;
            margin: 0 10px;
            font-size: 14px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>PRENDAS A ARMAR</h1>
        <p>Período: ${fechaDesdeFormateada} al ${fechaHastaFormateada}</p>
        <p>Fecha de generación: ${format(new Date(), "dd/MM/yyyy HH:mm", {
          locale: es,
        })}</p>
    </div>
`;

    prendasAArmar.forEach((orden, index) => {
      const fechaEventoFormateada = orden.fecha_evento
        ? format(new Date(orden.fecha_evento), "dd/MM/yyyy", { locale: es })
        : "N/A";
      const fechaRetiroFormateada = orden.fecha_retiro
        ? format(new Date(orden.fecha_retiro), "dd/MM/yyyy", { locale: es })
        : "N/A";

      htmlContent += `
    <div class="orden">
        <div class="orden-header">
            Orden #${orden.orden_id} - Presupuesto: ${orden.presupuesto_numero}
        </div>
        <div class="orden-info">
            <strong>Cliente:</strong> ${orden.cliente_nombre} (DNI: ${
        orden.cliente_dni
      })<br>
            <strong>Celular:</strong> ${orden.cliente_celular || "N/A"}<br>
            <strong>Dirección:</strong> ${orden.cliente_direccion || "N/A"}<br>
            <strong>Fecha Evento:</strong> ${fechaEventoFormateada}<br>
            <strong>Fecha Retiro:</strong> ${fechaRetiroFormateada}<br>
            ${
              orden.categoria_evento
                ? `<strong>Categoría:</strong> ${orden.categoria_evento}<br>`
                : ""
            }
            ${
              orden.nombre_agasajado
                ? `<strong>Agasajado:</strong> ${orden.nombre_agasajado}<br>`
                : ""
            }
            ${
              orden.lugar_evento
                ? `<strong>Lugar:</strong> ${orden.lugar_evento}<br>`
                : ""
            }
        </div>
        <table class="productos-table">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Línea</th>
                    <th>Talle</th>
                    <th>Color</th>
                    <th>Tela</th>
                    <th style="text-align: center;">Cant.</th>
                </tr>
            </thead>
            <tbody>`;

      orden.productos.forEach((producto: any) => {
        htmlContent += `
                <tr>
                    <td>${producto.codigo_barra}</td>
                    <td>${producto.descripcion}</td>
                    <td>${producto.linea}</td>
                    <td>${producto.talle}</td>
                    <td>${producto.color}</td>
                    <td>${producto.tela}</td>
                    <td style="text-align: center;">${producto.cantidad}</td>
                </tr>`;
      });

      htmlContent += `
            </tbody>
        </table>
        <div class="total-orden">
            Total de items: ${
              orden.cantidad_total_items
            } | Total: $${orden.total.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
        </div>
    </div>`;
    });

    htmlContent += `
    <div class="resumen">
        <h2>Resumen</h2>
        <p><strong>Total de órdenes:</strong> ${prendasAArmar.length}</p>
        <p><strong>Total de productos a armar:</strong> ${prendasAArmar.reduce(
          (sum, orden) => sum + orden.cantidad_total_items,
          0
        )}</p>
    </div>

    <div class="botones no-print">
        <button onclick="window.print()">Imprimir / Guardar PDF</button>
        <button onclick="window.close()">Cerrar</button>
    </div>
</body>
</html>`;

    const ventana = window.open("", "_blank", "width=900,height=700");
    if (ventana) {
      ventana.document.write(htmlContent);
      ventana.document.close();
      toast.success(
        "Vista previa generada. Usa el botón de imprimir para guardar como PDF."
      );
    } else {
      toast.error("Por favor, permite ventanas emergentes para generar el PDF");
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
    } finally {
      setIsLoadingNoDevolvieron(false);
    }
  };

  const exportarNoDevolvieronPDF = () => {
    if (noDevolvieron.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    let htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>No Devolvieron</title>
    <style>
        @media print {
            @page {
                size: A4;
                margin: 1cm;
            }
            body { 
                margin: 0;
                padding: 0;
            }
            .no-print { display: none; }
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 10pt;
            margin: 0;
            padding: 10px;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
        }
        .header h1 {
            margin: 0;
            font-size: 18pt;
            font-weight: bold;
            color: #dc3545;
        }
        .header p {
            margin: 5px 0;
            font-size: 10pt;
        }
        .orden {
            page-break-inside: avoid;
            margin-bottom: 20px;
            border: 2px solid #dc3545;
            padding: 10px;
            background-color: #fff5f5;
        }
        .orden-header {
            font-weight: bold;
            font-size: 11pt;
            margin-bottom: 10px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
            color: #dc3545;
        }
        .orden-info {
            font-size: 9pt;
            margin-bottom: 8px;
        }
        .orden-info strong {
            font-weight: bold;
        }
        .retraso {
            color: #dc3545;
            font-weight: bold;
            font-size: 10pt;
        }
        .productos-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 9pt;
        }
        .productos-table th {
            background-color: #dc3545;
            color: white;
            padding: 6px;
            text-align: left;
            border: 1px solid #000;
        }
        .productos-table td {
            padding: 5px;
            border: 1px solid #ccc;
        }
        .productos-table tr:nth-child(even) {
            background-color: #f5f5f5;
        }
        .total-orden {
            text-align: right;
            font-weight: bold;
            margin-top: 10px;
            font-size: 10pt;
        }
        .resumen {
            margin-top: 30px;
            padding: 10px;
            background-color: #fff5f5;
            border: 2px solid #dc3545;
            font-size: 10pt;
        }
        .resumen h2 {
            margin-top: 0;
            font-size: 14pt;
            color: #dc3545;
        }
        .botones {
            text-align: center;
            margin-top: 20px;
        }
        button {
            padding: 10px 20px;
            margin: 0 10px;
            font-size: 14px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>NO DEVOLVIERON</h1>
        <p>Órdenes con productos no devueltos</p>
        <p>Fecha de generación: ${format(new Date(), "dd/MM/yyyy HH:mm", {
          locale: es,
        })}</p>
    </div>
`;

    noDevolvieron.forEach((orden) => {
      const fechaEventoFormateada = orden.fecha_evento
        ? format(new Date(orden.fecha_evento), "dd/MM/yyyy", { locale: es })
        : "N/A";
      const fechaDevolucionFormateada = orden.fecha_devolucion
        ? format(new Date(orden.fecha_devolucion), "dd/MM/yyyy", { locale: es })
        : "N/A";

      htmlContent += `
    <div class="orden">
        <div class="orden-header">
            Orden #${orden.orden_id} - Presupuesto: ${orden.presupuesto_numero}
            <span class="retraso">(${orden.dias_retraso} días de retraso)</span>
        </div>
        <div class="orden-info">
            <strong>Cliente:</strong> ${orden.cliente_nombre} (DNI: ${
        orden.cliente_dni
      })<br>
            <strong>Celular:</strong> ${orden.cliente_celular || "N/A"}<br>
            <strong>Dirección:</strong> ${orden.cliente_direccion || "N/A"}<br>
            <strong>Fecha Evento:</strong> ${fechaEventoFormateada}<br>
            <strong>Fecha Devolución:</strong> ${fechaDevolucionFormateada}<br>
            <strong class="retraso">Días de Retraso:</strong> <span class="retraso">${
              orden.dias_retraso
            } días</span><br>
            ${
              orden.categoria_evento
                ? `<strong>Categoría:</strong> ${orden.categoria_evento}<br>`
                : ""
            }
            ${
              orden.nombre_agasajado
                ? `<strong>Agasajado:</strong> ${orden.nombre_agasajado}<br>`
                : ""
            }
            ${
              orden.lugar_evento
                ? `<strong>Lugar:</strong> ${orden.lugar_evento}<br>`
                : ""
            }
        </div>
        <table class="productos-table">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Línea</th>
                    <th>Talle</th>
                    <th>Color</th>
                    <th>Tela</th>
                    <th style="text-align: center;">Cant.</th>
                </tr>
            </thead>
            <tbody>`;

      orden.productos.forEach((producto: any) => {
        htmlContent += `
                <tr>
                    <td>${producto.codigo_barra}</td>
                    <td>${producto.descripcion}</td>
                    <td>${producto.linea}</td>
                    <td>${producto.talle}</td>
                    <td>${producto.color}</td>
                    <td>${producto.tela}</td>
                    <td style="text-align: center;">${producto.cantidad}</td>
                </tr>`;
      });

      htmlContent += `
            </tbody>
        </table>
        <div class="total-orden">
            Total de items: ${
              orden.cantidad_total_items
            } | Total: $${orden.total.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} | Saldo Pendiente: $${orden.saldo_pendiente.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
        </div>
    </div>`;
    });

    htmlContent += `
    <div class="resumen">
        <h2>Resumen</h2>
        <p><strong>Total de órdenes:</strong> ${noDevolvieron.length}</p>
        <p><strong>Total de productos no devueltos:</strong> ${noDevolvieron.reduce(
          (sum, orden) => sum + orden.cantidad_total_items,
          0
        )}</p>
        <p><strong>Total saldo pendiente:</strong> $${noDevolvieron
          .reduce((sum, orden) => sum + orden.saldo_pendiente, 0)
          .toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}</p>
    </div>

    <div class="botones no-print">
        <button onclick="window.print()">Imprimir / Guardar PDF</button>
        <button onclick="window.close()">Cerrar</button>
    </div>
</body>
</html>`;

    const ventana = window.open("", "_blank", "width=900,height=700");
    if (ventana) {
      ventana.document.write(htmlContent);
      ventana.document.close();
      toast.success(
        "Vista previa generada. Usa el botón de imprimir para guardar como PDF."
      );
    } else {
      toast.error("Por favor, permite ventanas emergentes para generar el PDF");
    }
  };

  // Funciones para productos críticos
  const obtenerProductosCriticos = async () => {
    setIsLoadingProductosCriticos(true);
    try {
      const response = await fetch(`${API_BASE}/reportes/productos-criticos`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("📊 Respuesta de productos críticos:", data);
      if (data.success && data.data) {
        setProductosCriticos(data.data.productos || []);
        toast.success(
          `Reporte generado: ${data.data.total_productos} productos críticos encontrados`
        );
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (error: any) {
      console.error("Error al obtener productos críticos:", error);
      toast.error("Error al obtener productos críticos: " + error.message);
      setProductosCriticos([]);
    } finally {
      setIsLoadingProductosCriticos(false);
    }
  };

  const exportarProductosCriticosPDF = () => {
    if (productosCriticos.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    let htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Productos Críticos</title>
    <style>
        @media print {
            @page {
                size: A4;
                margin: 1cm;
            }
            body { 
                margin: 0;
                padding: 0;
            }
            .no-print { display: none; }
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 10pt;
            margin: 0;
            padding: 10px;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
        }
        .header h1 {
            margin: 0;
            font-size: 18pt;
            font-weight: bold;
            color: #dc3545;
        }
        .header p {
            margin: 5px 0;
            font-size: 10pt;
        }
        .productos-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 9pt;
        }
        .productos-table th {
            background-color: #dc3545;
            color: white;
            padding: 8px;
            text-align: left;
            border: 1px solid #000;
            font-weight: bold;
        }
        .productos-table td {
            padding: 6px;
            border: 1px solid #ccc;
        }
        .productos-table tr:nth-child(even) {
            background-color: #f5f5f5;
        }
        .veces-alquilado {
            color: #dc3545;
            font-weight: bold;
            font-size: 11pt;
        }
        .resumen {
            margin-top: 30px;
            padding: 10px;
            background-color: #fff5f5;
            border: 2px solid #dc3545;
            font-size: 10pt;
        }
        .resumen h2 {
            margin-top: 0;
            font-size: 14pt;
            color: #dc3545;
        }
        .botones {
            text-align: center;
            margin-top: 20px;
        }
        button {
            padding: 10px 20px;
            margin: 0 10px;
            font-size: 14px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>PRODUCTOS CRÍTICOS</h1>
        <p>Productos con nivel alto de desgaste o uso (más de 10 alquileres)</p>
        <p>Fecha de generación: ${format(new Date(), "dd/MM/yyyy HH:mm", {
          locale: es,
        })}</p>
    </div>

    <table class="productos-table">
        <thead>
            <tr>
                <th>Código de Barras</th>
                <th>Descripción</th>
                <th>Línea</th>
                <th>Talle</th>
                <th>Color</th>
                <th>Tela</th>
                <th>Estado</th>
                <th>Veces Alquilado</th>
                <th>Stock</th>
            </tr>
        </thead>
        <tbody>`;

    productosCriticos.forEach((producto) => {
      htmlContent += `
            <tr>
                <td>${producto.codigo_barra}</td>
                <td>${producto.descripcion}</td>
                <td>${producto.linea}</td>
                <td>${producto.talle}</td>
                <td>${producto.color}</td>
                <td>${producto.tela}</td>
                <td>${producto.estado}</td>
                <td class="veces-alquilado">${producto.veces_alquilado}</td>
                <td>${producto.stock}</td>
            </tr>`;
    });

    htmlContent += `
        </tbody>
    </table>

    <div class="resumen">
        <h2>Resumen</h2>
        <p><strong>Total de productos críticos:</strong> ${productosCriticos.length}</p>
        <p><strong>Promedio de veces alquilado:</strong> ${(
          productosCriticos.reduce((sum, p) => sum + p.veces_alquilado, 0) /
          productosCriticos.length
        ).toFixed(2)}</p>
        <p><strong>Máximo de veces alquilado:</strong> ${Math.max(
          ...productosCriticos.map((p) => p.veces_alquilado)
        )}</p>
    </div>

    <div class="botones no-print">
        <button onclick="window.print()">Imprimir / Guardar PDF</button>
        <button onclick="window.close()">Cerrar</button>
    </div>
</body>
</html>`;

    const ventana = window.open("", "_blank", "width=900,height=700");
    if (ventana) {
      ventana.document.write(htmlContent);
      ventana.document.close();
      toast.success(
        "Vista previa generada. Usa el botón de imprimir para guardar como PDF."
      );
    } else {
      toast.error("Por favor, permite ventanas emergentes para generar el PDF");
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
    <div className="p-3 p-md-4">
      <div className="mb-4">
        <h1 className="fw-bold">Reportes</h1>
        <p className="text-muted">Elegí un reporte para ver o exportar.</p>
      </div>
      <div className="row g-2 align-items-stretch mb-4">
        {reportTiles.map(({ key, title, desc, icon: Icon }) => (
          <div key={key} className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex">
            <button
              onClick={() => setSelectedReporte(key)}
              className={`card text-start h-100 w-100 border ${
                selectedReporte === key ? "border-primary" : ""
              }`}
              style={{ background: "none", border: "1px solid #dee2e6" }}
            >
              <div className="card-body d-flex align-items-start gap-2">
                <div
                  className="p-2 rounded bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center"
                  style={{ width: 36, height: 36 }}
                >
                  <Icon size={20} />
                </div>
                <div
                  className="d-flex flex-column justify-content-between flex-grow-1"
                  style={{ minHeight: 52 }}
                >
                  <div className="fw-semibold lh-sm">{title}</div>
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
          <div className="card-header">
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
                  className="form-control"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
              <div className="col-md-4 d-flex align-items-end gap-2">
                <button
                  onClick={obtenerAlquileresPorPrenda}
                  disabled={isLoading || !fechaDesde || !fechaHasta}
                  className="btn btn-primary"
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
                    onClick={exportarCSV}
                    className="btn btn-outline-success"
                  >
                    <i className="bi bi-download me-2"></i>
                    CSV
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
                  <table className="table table-hover table-striped">
                    <thead className="table-light">
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
                          <td className="text-center fw-semibold text-primary">
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
          <div className="card-header">
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
                  className="form-control"
                  value={fechaDesdeRanking}
                  onChange={(e) => setFechaDesdeRanking(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaHastaRanking}
                  onChange={(e) => setFechaHastaRanking(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Filtrar por veces</label>
                <select
                  className="form-select"
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
                  className="btn btn-primary"
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
                    onClick={exportarRankingCSV}
                    className="btn btn-outline-success"
                  >
                    <i className="bi bi-download me-2"></i>
                    CSV
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
                          <div className="card border-primary">
                            <div className="card-body text-center">
                              <div className="text-primary small mb-1">
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
                              <div className="h3 text-primary fw-bold">
                                {productosFiltrados.length}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-hover table-striped">
                        <thead className="table-light">
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
                                      : "text-primary"
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
          <div className="card-header">
            <h5 className="card-title mb-0">
              <i className="bi bi-file-text me-2"></i>
              Contratos por Fecha
            </h5>
            <p className="text-muted small mb-0">
              Listado de contratos (presupuestos) en un rango de fechas
            </p>
          </div>
          <div className="card-body">
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-3">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaDesdeContratos}
                  onChange={(e) => setFechaDesdeContratos(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaHastaContratos}
                  onChange={(e) => setFechaHastaContratos(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Filtrar por fecha</label>
                <select
                  className="form-select"
                  value={filtroFechaContratos}
                  onChange={(e) =>
                    setFiltroFechaContratos(
                      e.target.value as "fecha_creacion" | "fecha_evento"
                    )
                  }
                >
                  <option value="fecha_creacion">Fecha de Creación</option>
                  <option value="fecha_evento">Fecha del Evento</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Tipo</label>
                <select
                  className="form-select"
                  value={tipoContrato}
                  onChange={(e) =>
                    setTipoContrato(
                      e.target.value as
                        | "todos"
                        | "presupuestos"
                        | "ordenes_trabajo"
                    )
                  }
                >
                  <option value="todos">Todos</option>
                  <option value="presupuestos">Presupuestos</option>
                  <option value="ordenes_trabajo">Órdenes de Trabajo</option>
                </select>
              </div>
              <div className="col-md-2 d-flex align-items-end gap-2">
                <button
                  onClick={obtenerContratosPorFecha}
                  disabled={
                    isLoadingContratos ||
                    !fechaDesdeContratos ||
                    !fechaHastaContratos
                  }
                  className="btn btn-primary"
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
                    onClick={exportarContratosCSV}
                    className="btn btn-outline-success"
                  >
                    <i className="bi bi-download me-2"></i>
                    CSV
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
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="card border-primary">
                        <div className="card-body text-center">
                          <div className="text-primary small mb-1">
                            Total Contratos
                          </div>
                          <div className="h3 text-primary fw-bold">
                            {contratos.length}
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
                            {contratos
                              .reduce((sum, c) => sum + c.total, 0)
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
                  <table className="table table-hover table-striped">
                    <thead className="table-light">
                      <tr>
                        <th>Tipo</th>
                        <th>Número</th>
                        <th>Cliente</th>
                        <th>DNI</th>
                        <th>Fecha Creación</th>
                        <th>Fecha Evento</th>
                        <th>Categoría</th>
                        <th className="text-end">Total</th>
                        <th>Estado</th>
                        <th>Items</th>
                        <th>Seña</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contratos.map((contrato) => (
                        <tr key={`${contrato.tipo}-${contrato.id}`}>
                          <td>
                            <span
                              className={`badge ${
                                contrato.tipo === "orden_trabajo"
                                  ? "bg-success"
                                  : "bg-info"
                              }`}
                            >
                              {contrato.tipo === "orden_trabajo"
                                ? "Orden"
                                : "Presupuesto"}
                            </span>
                          </td>
                          <td className="fw-medium">{contrato.numero}</td>
                          <td>{contrato.cliente_nombre}</td>
                          <td className="small text-muted">
                            {contrato.cliente_dni}
                          </td>
                          <td className="small">
                            {format(
                              new Date(contrato.fecha_creacion + "T00:00:00"),
                              "dd/MM/yyyy",
                              { locale: es }
                            )}
                          </td>
                          <td className="small">
                            {contrato.fecha_evento
                              ? format(
                                  new Date(contrato.fecha_evento + "T00:00:00"),
                                  "dd/MM/yyyy",
                                  { locale: es }
                                )
                              : "N/A"}
                          </td>
                          <td className="small text-muted">
                            {contrato.categoria_evento}
                          </td>
                          <td className="text-end fw-semibold">
                            $
                            {contrato.total.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                contrato.estado === "convertido_orden" ||
                                contrato.estado === "completada"
                                  ? "bg-success"
                                  : contrato.estado === "aprobado" ||
                                    contrato.estado === "lista"
                                  ? "bg-primary"
                                  : contrato.estado === "rechazado" ||
                                    contrato.estado === "cancelada"
                                  ? "bg-danger"
                                  : contrato.estado === "vencido"
                                  ? "bg-warning"
                                  : "bg-secondary"
                              }`}
                            >
                              {contrato.estado}
                            </span>
                          </td>
                          <td className="text-center">
                            {contrato.cantidad_items}
                          </td>
                          <td className="text-center">
                            {contrato.seña_pagada !== null &&
                            contrato.seña_pagada !== undefined ? (
                              <span className="text-success fw-semibold">
                                $
                                {contrato.seña_pagada.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td className="text-center">
                            {contrato.saldo_pendiente !== null &&
                            contrato.saldo_pendiente !== undefined ? (
                              <span
                                className={`fw-semibold ${
                                  contrato.saldo_pendiente > 0
                                    ? "text-danger"
                                    : "text-success"
                                }`}
                              >
                                $
                                {contrato.saldo_pendiente.toLocaleString(
                                  "es-AR",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
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
          <div className="card-header">
            <h5 className="card-title mb-0">
              <i className="bi bi-receipt me-2"></i>
              Recibos por Fecha
            </h5>
            <p className="text-muted small mb-0">
              Comprobantes de ingresos: señas, pagos adicionales y ventas
            </p>
          </div>
          <div className="card-body">
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaDesdeRecibos}
                  onChange={(e) => setFechaDesdeRecibos(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control"
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
                  className="btn btn-primary"
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
                    onClick={exportarRecibosCSV}
                    className="btn btn-outline-success"
                  >
                    <i className="bi bi-download me-2"></i>
                    CSV
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
                      <div className="card border-primary">
                        <div className="card-body text-center">
                          <div className="text-primary small mb-1">
                            Total Recibos
                          </div>
                          <div className="h3 text-primary fw-bold">
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
                  <table className="table table-hover table-striped">
                    <thead className="table-light">
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
                                  : "bg-primary"
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
                              className="btn btn-sm btn-outline-primary"
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
          <div className="card-header">
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
              <div className="col-md-4">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaDesdeIngresos}
                  onChange={(e) => setFechaDesdeIngresos(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaHastaIngresos}
                  onChange={(e) => setFechaHastaIngresos(e.target.value)}
                />
              </div>
              <div className="col-md-4 d-flex align-items-end gap-2">
                <button
                  onClick={obtenerIngresosPorTipo}
                  disabled={
                    isLoadingIngresos ||
                    !fechaDesdeIngresos ||
                    !fechaHastaIngresos
                  }
                  className="btn btn-primary"
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
                  ingresosPorTipo.ingresos_por_tipo &&
                  ingresosPorTipo.ingresos_por_tipo.length > 0 && (
                    <button
                      onClick={exportarIngresosCSV}
                      className="btn btn-outline-success"
                    >
                      <i className="bi bi-download me-2"></i>
                      CSV
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
                      <div className="card border-primary">
                        <div className="card-body text-center">
                          <div className="text-primary small mb-1">
                            Total General
                          </div>
                          <div className="h3 text-primary fw-bold">
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
                  <table className="table table-hover table-striped">
                    <thead className="table-light">
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
                                  : item.metodo === "BILLETERA_VIRTUAL"
                                  ? "Billetera Virtual"
                                  : item.metodo === "TRANSFERENCIA"
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
          <div className="card-header">
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
                  className="btn btn-primary"
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
                    onClick={exportarStockCSV}
                    className="btn btn-outline-success"
                  >
                    <i className="bi bi-download me-2"></i>
                    Exportar CSV
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
                      <div className="card border-primary">
                        <div className="card-body text-center">
                          <div className="text-primary small mb-1">
                            Total Productos
                          </div>
                          <div className="h3 text-primary fw-bold">
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
                          return "bg-primary";
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
                              <thead className="table-light">
                                <tr>
                                  <th>Código</th>
                                  <th>Descripción</th>
                                  <th>Línea</th>
                                  <th>Talle</th>
                                  <th>Color</th>
                                  <th>Tela</th>
                                  <th>Estado</th>
                                  <th className="text-center">Acción</th>
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
                                      <td className="text-center">
                                        <select
                                          className="form-select form-select-sm"
                                          value={producto.estado || item.estado}
                                          onChange={(e) =>
                                            actualizarEstadoProducto(
                                              producto.id,
                                              e.target.value
                                            )
                                          }
                                          style={{ minWidth: "120px" }}
                                        >
                                          {estadosDisponibles.map((estado) => (
                                            <option key={estado} value={estado}>
                                              {getEstadoNombre(estado)}
                                            </option>
                                          ))}
                                        </select>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td
                                      colSpan={8}
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
          <div className="card-header">
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
                  className="btn btn-primary"
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
                    onClick={exportarStockLineaCSV}
                    className="btn btn-outline-success"
                  >
                    <i className="bi bi-download me-2"></i>
                    Exportar CSV
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
                      <div className="card border-primary">
                        <div className="card-body text-center">
                          <div className="text-primary small mb-1">
                            Total Productos
                          </div>
                          <div className="h3 text-primary fw-bold">
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
                  <table className="table table-hover table-striped">
                    <thead className="table-light">
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
          <div className="card-header">
            <h5 className="card-title mb-0">
              <i className="bi bi-people me-2"></i>
              Saldos a Cobrar
            </h5>
            <p className="text-muted small mb-0">
              Clientes con saldos pendientes a cobrar en un rango de fechas
            </p>
          </div>
          <div className="card-body">
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaDesdeSaldos}
                  onChange={(e) => setFechaDesdeSaldos(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control"
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
                  className="btn btn-primary"
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
                    onClick={exportarSaldosCSV}
                    className="btn btn-outline-success"
                  >
                    <i className="bi bi-download me-2"></i>
                    CSV
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
                      <div className="card border-primary">
                        <div className="card-body text-center">
                          <div className="text-primary small mb-1">
                            Total Clientes con Saldo
                          </div>
                          <div className="h3 text-primary fw-bold">
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
                  <table className="table table-hover table-striped">
                    <thead className="table-light">
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
                        <tr key={item.cliente_id}>
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
          <div className="card-header">
            <h5 className="card-title mb-0">
              <i className="bi bi-clipboard-check me-2"></i>
              Prendas a Armar
            </h5>
            <p className="text-muted small mb-0">
              Órdenes de trabajo a entregar entre las fechas seleccionadas.
              Lista de conjuntos a separar para cada cliente.
            </p>
          </div>
          <div className="card-body">
            {/* Filtros */}
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Fecha desde</label>
                <input
                  type="date"
                  className="form-control"
                  value={fechaDesdePrendas}
                  onChange={(e) => setFechaDesdePrendas(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha hasta</label>
                <input
                  type="date"
                  className="form-control"
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
                  onClick={obtenerPrendasAArmar}
                  disabled={
                    isLoadingPrendas || !fechaDesdePrendas || !fechaHastaPrendas
                  }
                  className="btn btn-primary"
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
                  <button
                    onClick={exportarPrendasPDF}
                    className="btn btn-outline-danger"
                  >
                    <i className="bi bi-file-pdf me-2"></i>
                    PDF
                  </button>
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
                      <div className="card border-primary">
                        <div className="card-body text-center">
                          <div className="text-primary small mb-1">
                            Total Órdenes
                          </div>
                          <div className="h3 text-primary fw-bold">
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
                                  {orden.cliente_nombre} - Evento:{" "}
                                  {fechaEventoFormateada}
                                </small>
                              </div>
                              <span className="badge bg-info ms-2">
                                {orden.cantidad_total_items} items
                              </span>
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
                                <thead className="table-light">
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
                                        <span className="badge bg-primary">
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
          <div className="card-header">
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
                  className="btn btn-primary"
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
                    onClick={exportarNoDevolvieronPDF}
                    className="btn btn-outline-danger"
                  >
                    <i className="bi bi-file-pdf me-2"></i>
                    PDF
                  </button>
                )}
              </div>
            </div>

            {/* Resultados */}
            {isLoadingNoDevolvieron ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando reporte...
              </div>
            ) : noDevolvieron.length > 0 ? (
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
                            {noDevolvieron.length}
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
                            {noDevolvieron.reduce(
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
                            {noDevolvieron
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
                  {noDevolvieron.map((orden, index) => {
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
                                  Orden #{orden.orden_id} - Presupuesto:{" "}
                                  {orden.presupuesto_numero}
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
                                <thead className="table-light">
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
      {selectedReporte === "productos_criticos" && (
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">
              <i className="bi bi-exclamation-triangle me-2"></i>
              Productos Críticos
            </h5>
            <p className="text-muted small mb-0">
              Productos con nivel alto de desgaste o uso (más de 10 alquileres).
              Estos productos están para cambio o venta por desgaste.
            </p>
          </div>
          <div className="card-body">
            {/* Botones */}
            <div className="row mb-4">
              <div className="col-md-12 d-flex gap-2">
                <button
                  onClick={obtenerProductosCriticos}
                  disabled={isLoadingProductosCriticos}
                  className="btn btn-primary"
                >
                  {isLoadingProductosCriticos ? (
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
                {productosCriticos.length > 0 && (
                  <button
                    onClick={exportarProductosCriticosPDF}
                    className="btn btn-outline-danger"
                  >
                    <i className="bi bi-file-pdf me-2"></i>
                    PDF
                  </button>
                )}
              </div>
            </div>

            {/* Resultados */}
            {isLoadingProductosCriticos ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-arrow-clockwise spin display-4 d-block mb-3"></i>
                Generando reporte...
              </div>
            ) : productosCriticos.length > 0 ? (
              <div>
                <div className="mb-3">
                  <div className="row">
                    <div className="col-md-4">
                      <div className="card border-danger">
                        <div className="card-body text-center">
                          <div className="text-danger small mb-1">
                            Total Productos
                          </div>
                          <div className="h3 text-danger fw-bold">
                            {productosCriticos.length}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border-warning">
                        <div className="card-body text-center">
                          <div className="text-warning small mb-1">
                            Promedio de Alquileres
                          </div>
                          <div className="h3 text-warning fw-bold">
                            {(
                              productosCriticos.reduce(
                                (sum, p) => sum + p.veces_alquilado,
                                0
                              ) / productosCriticos.length
                            ).toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border-danger">
                        <div className="card-body text-center">
                          <div className="text-danger small mb-1">
                            Máximo de Alquileres
                          </div>
                          <div className="h3 text-danger fw-bold">
                            {Math.max(
                              ...productosCriticos.map((p) => p.veces_alquilado)
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead className="table-light">
                      <tr>
                        <th>Código de Barras</th>
                        <th>Descripción</th>
                        <th>Línea</th>
                        <th>Talle</th>
                        <th>Color</th>
                        <th>Tela</th>
                        <th>Estado</th>
                        <th className="text-center">Veces Alquilado</th>
                        <th className="text-center">Stock</th>
                        <th>Sucursal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosCriticos.map((producto) => (
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
                          <td>
                            <span className="badge bg-secondary">
                              {producto.estado}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-danger">
                              {producto.veces_alquilado}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-info">
                              {producto.stock}
                            </span>
                          </td>
                          <td className="small text-muted">
                            {producto.sucursal_nombre}
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
                  No se encontraron productos críticos (con más de 10 alquileres).
                  <br />
                  <small>Genera el reporte para ver los productos con nivel alto de desgaste o uso.</small>
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
      `}</style>
    </div>
  );
}
