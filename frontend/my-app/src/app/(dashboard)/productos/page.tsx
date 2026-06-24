"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import JsBarcode from "jsbarcode";
import {
  ETIQUETA_50X25_PREVIEW_CSS,
  imprimirEtiqueta50x25DesdeSvg,
  JSBARCODE_OPTS_50X25,
} from "@/lib/imprimir-etiqueta-50x25";
import { toast } from "sonner";
import { RoleGate } from "@/components/RoleGate";
import { getApiBaseUrl } from "@/lib/api-config";
import { fetchProductosPage } from "@/lib/fetch-productos";
import { formatDescripcionProducto } from "@/lib/descripcion-producto";

type ItemConfig = { id: number; nombre: string; codigo: string };

interface Producto {
  id: number;
  codigo_barra: string;
  descripcion: string;
  descripcion_extra?: string | null;
  linea_id?: number | null;
  tela_id?: number | null;
  talle_id?: number | null;
  color_id?: number | null;
  linea_nombre?: string | null;
  talle_nombre?: string | null;
  tela_nombre?: string | null;
  color_nombre?: string | null;
  costo: number;
  precio_alquiler_lista: number;
  precio_alquiler_efectivo: number;
  precio_venta_nuevo_lista: number;
  precio_venta_nuevo_efectivo: number;
  precio_de_venta_medio_uso: number;
  precio_venta: number;
  precio_liquidacion: number;
  stock: number;
  stock_minimo: number;
  fecha_alta: string;
  estado: string;
  sucursal_id: number;
  inmovilizado: boolean;
  veces_alquilado?: number;
  sucursal?: { nombre: string };
  destino_tipo?: string | null;
  destino_nombre?: string | null;
  destino_notas?: string | null;
  destino_cliente_nombre?: string | null;
  destino_cliente_celular?: string | null;
  /** true = en ventana de reserva (orden con seña, regla R−5…R según hoy) */
  en_ventana_reserva_hoy?: boolean | null;
}

type EstadoKey = "SALON" | "CLIENTE" | "LAVANDERIA" | "MODISTA" | "VENDIDO";

const ESTADOS: EstadoKey[] = [
  "SALON",
  "CLIENTE",
  "LAVANDERIA",
  "MODISTA",
  "VENDIDO",
];

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productoActual, setProductoActual] =
    useState<Partial<Producto> | null>(null);
  const [isFormularioOpen, setIsFormularioOpen] = useState(false);
  const [isDetalleOpen, setIsDetalleOpen] = useState(false);
  const [productoEtiqueta, setProductoEtiqueta] = useState<Producto | null>(
    null
  );
  const [isModalEtiquetaOpen, setIsModalEtiquetaOpen] = useState(false);
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const [loading, setLoading] = useState(false);

  // Paginación (20 ítems fijos por página)
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Atributos para selects y filtros
  const [lineas, setLineas] = useState<ItemConfig[]>([]);
  const [talles, setTalles] = useState<ItemConfig[]>([]);
  const [telas, setTelas] = useState<ItemConfig[]>([]);
  const [colores, setColores] = useState<ItemConfig[]>([]);
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [filtroLineaId, setFiltroLineaId] = useState<number | "">("");
  const [filtroTalleId, setFiltroTalleId] = useState<number | "">("");
  const [filtroTelaId, setFiltroTelaId] = useState<number | "">("");
  const [filtroColorId, setFiltroColorId] = useState<number | "">("");
  /** Listar solo productos en ventana de reserva (misma regla que columna RESERVADO) */
  const [filtroSoloReservados, setFiltroSoloReservados] = useState(false);
  const [productoExpandidoId, setProductoExpandidoId] = useState<number | null>(null);
  const [isBulkPreciosOpen, setIsBulkPreciosOpen] = useState(false);
  const [bulkModo, setBulkModo] = useState<"porcentaje" | "monto_fijo">("porcentaje");
  const [bulkValor, setBulkValor] = useState<number | "">("");
  const [bulkCampos, setBulkCampos] = useState<string[]>(["precio_alquiler_lista"]);
  const [bulkLineaIds, setBulkLineaIds] = useState<number[]>([]);
  const [bulkEjecutando, setBulkEjecutando] = useState(false);

  /** Envío a lavandería desde el selector de estado (misma idea que devoluciones completas). */
  const [productoEnvioLavanderia, setProductoEnvioLavanderia] =
    useState<Producto | null>(null);
  const [lavanderiasList, setLavanderiasList] = useState<
    Array<{ id: number; nombre: string }>
  >([]);
  const [lavEnvioId, setLavEnvioId] = useState<number | "">("");
  const [lavEnvioNotas, setLavEnvioNotas] = useState("");
  const [guardandoLavanderia, setGuardandoLavanderia] = useState(false);

  const [productoEnvioModista, setProductoEnvioModista] = useState<Producto | null>(null);
  const [modistasList, setModistasList] = useState<Array<{ id: number; nombre: string }>>([]);
  const [modEnvioId, setModEnvioId] = useState<number | "">("");
  const [modEnvioNotas, setModEnvioNotas] = useState("");
  const [guardandoModista, setGuardandoModista] = useState(false);

  const API_BASE = getApiBaseUrl();
  const API_URL = `${API_BASE}/productos`;

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setToken(t);
      console.log("🔑 Token cargado desde localStorage");
    } else {
      console.warn("⚠️ No se encontró token en localStorage");
    }
  }, []);

  // Cargar atributos (líneas, talles, telas, colores) para selects y filtros
  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API_BASE}/config/productos/lineas`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE}/config/productos/talles`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE}/config/productos/telas`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE}/config/productos/colores`, { headers: { Authorization: `Bearer ${token}` } }),
    ])
      .then(async ([rL, rT, rTel, rC]) => {
        if (rL.ok) setLineas(await rL.json());
        if (rT.ok) setTalles(await rT.json());
        if (rTel.ok) setTelas(await rTel.json());
        if (rC.ok) setColores(await rC.json());
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const loadLav = async () => {
      try {
        const res = await fetch(`${API_BASE}/lavanderia/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setLavanderiasList([]);
          return;
        }
        const data = await res.json();
        setLavanderiasList(
          Array.isArray(data)
            ? data.map((l: { id: number; nombre?: string }) => ({
                id: Number(l.id),
                nombre: String(l.nombre ?? l.id),
              }))
            : []
        );
      } catch {
        setLavanderiasList([]);
      }
    };
    void loadLav();
  }, [token, API_BASE]);

  useEffect(() => {
    if (!token) return;
    const loadMod = async () => {
      try {
        const res = await fetch(`${API_BASE}/modistas/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setModistasList([]);
          return;
        }
        const data = await res.json();
        setModistasList(
          Array.isArray(data)
            ? data.map((m: { id: number; nombre?: string }) => ({
                id: Number(m.id),
                nombre: String(m.nombre ?? m.id),
              }))
            : []
        );
      } catch {
        setModistasList([]);
      }
    };
    void loadMod();
  }, [token, API_BASE]);

  const cerrarModalEnvioLavanderia = () => {
    setProductoEnvioLavanderia(null);
    setLavEnvioId("");
    setLavEnvioNotas("");
    setGuardandoLavanderia(false);
  };

  const confirmarEnvioLavanderia = async () => {
    if (!token || !productoEnvioLavanderia) return;
    const lid = lavEnvioId === "" ? 0 : Number(lavEnvioId);
    if (!lid) {
      toast.error("Seleccioná una lavandería");
      return;
    }
    setGuardandoLavanderia(true);
    try {
      const res = await fetch(`${API_BASE}/lavanderia/asignar-producto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lavanderia_id: lid,
          producto_id: productoEnvioLavanderia.id,
          notas: lavEnvioNotas.trim() || null,
        }),
      });
      const result = (await res.json().catch(() => ({}))) as {
        message?: string;
        success?: boolean;
      };
      if (!res.ok || result?.success === false) {
        toast.error(result?.message || "No se pudo enviar a lavandería");
        return;
      }
      toast.success(result?.message || "Producto enviado a lavandería");
      const enviadoId = productoEnvioLavanderia.id;
      cerrarModalEnvioLavanderia();
      loadProductos();
      setProductoActual((prev) =>
        prev && prev.id === enviadoId ? { ...prev, estado: "LAVANDERIA" } : prev
      );
    } finally {
      setGuardandoLavanderia(false);
    }
  };

  const cerrarModalEnvioModista = () => {
    setProductoEnvioModista(null);
    setModEnvioId("");
    setModEnvioNotas("");
    setGuardandoModista(false);
  };

  const confirmarEnvioModista = async () => {
    if (!token || !productoEnvioModista) return;
    const mid = modEnvioId === "" ? 0 : Number(modEnvioId);
    if (!mid) {
      toast.error("Seleccioná una modista");
      return;
    }
    setGuardandoModista(true);
    try {
      const res = await fetch(`${API_BASE}/modistas/asignar-producto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          modista_id: mid,
          producto_id: productoEnvioModista.id,
          notas: modEnvioNotas.trim() || null,
        }),
      });
      const result = (await res.json().catch(() => ({}))) as {
        message?: string;
        success?: boolean;
      };
      if (!res.ok || result?.success === false) {
        toast.error(result?.message || "No se pudo enviar a modista");
        return;
      }
      toast.success(result?.message || "Producto enviado a modista");
      const enviadoId = productoEnvioModista.id;
      cerrarModalEnvioModista();
      loadProductos();
      setProductoActual((prev) =>
        prev && prev.id === enviadoId ? { ...prev, estado: "MODISTA" } : prev
      );
    } finally {
      setGuardandoModista(false);
    }
  };

  // Carga de productos con paginación y filtro remoto
  const loadProductos = async () => {
    if (!token) {
      console.warn("⚠️ No hay token disponible para cargar productos");
      return;
    }
    setLoading(true);
    const extraParams: Record<string, string | number | boolean> = {
      incluir_ventana_reserva: true,
    };
    if (filtroLineaId) extraParams.linea_id = filtroLineaId;
    if (filtroTalleId) extraParams.talle_id = filtroTalleId;
    if (filtroTelaId) extraParams.tela_id = filtroTelaId;
    if (filtroColorId) extraParams.color_id = filtroColorId;
    if (filtroSoloReservados) extraParams.ventana_reserva = "si";
    const termino = busquedaDebounced.trim();
    if (termino) extraParams.q = termino;

    try {
      const { items, total: totalCount } = await fetchProductosPage(
        token,
        page,
        PAGE_SIZE,
        extraParams
      );
      setTotal(totalCount);
      setProductos(items as Producto[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error("❌ Error al obtener productos:", message);
      toast.error(`Error al cargar productos: ${message}`);
      setProductos([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setBusquedaDebounced(busqueda), 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  useEffect(() => {
    if (!token) return;
    loadProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    page,
    filtroLineaId,
    filtroTalleId,
    filtroTelaId,
    filtroColorId,
    filtroSoloReservados,
    busquedaDebounced,
  ]);

  const guardarProducto = async () => {
    if (!productoActual || !token) {
      toast.error("No hay producto o token disponible.");
      return;
    }

    const isEditing = !!productoActual.id;
    const url = isEditing
      ? `${API_URL}/update/${productoActual.id}`
      : `${API_URL}/register`;
    const method = isEditing ? "PUT" : "POST";

    const { id, ...productoSinId } = productoActual;

    const payload: any = {
      linea_id: productoSinId.linea_id ?? null,
      tela_id: productoSinId.tela_id ?? null,
      talle_id: productoSinId.talle_id ?? null,
      color_id: productoSinId.color_id ?? null,
      descripcion_extra: (productoSinId.descripcion_extra || "").trim() || null,
      costo: productoSinId.costo ?? 0,
      precio_alquiler_lista: productoSinId.precio_alquiler_lista ?? 0,
      precio_alquiler_efectivo: productoSinId.precio_alquiler_efectivo ?? 0,
      precio_venta_nuevo_lista: productoSinId.precio_venta_nuevo_lista ?? 0,
      precio_venta_nuevo_efectivo:
        productoSinId.precio_venta_nuevo_efectivo ?? 0,
      precio_de_venta_medio_uso: productoSinId.precio_de_venta_medio_uso ?? 0,
      precio_venta: productoSinId.precio_venta ?? 0,
      precio_liquidacion: productoSinId.precio_liquidacion ?? 0,
      stock: productoSinId.stock ?? 1,
      stock_minimo: productoSinId.stock_minimo ?? 0,
      fecha_alta:
        productoSinId.fecha_alta &&
        !isNaN(Date.parse(productoSinId.fecha_alta as any))
          ? productoSinId.fecha_alta
          : new Date().toISOString().split("T")[0],
      estado: (productoSinId.estado as string) ?? "SALON",
      sucursal_id: productoSinId.sucursal_id ?? 1,
      inmovilizado: productoSinId.inmovilizado ?? false,
    };

    // En creación, el código de barras se genera en backend; en edición mantenemos el existente.
    if (isEditing && productoSinId.codigo_barra) {
      payload.codigo_barra = productoSinId.codigo_barra;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message || "Error al crear o actualizar el producto."
        );
      }

      setIsFormularioOpen(false);
      toast.success(
        isEditing
          ? "Producto actualizado correctamente"
          : "Producto creado correctamente"
      );
      // En alta, forzamos página 1 (orden DESC por id) para que aparezca inmediatamente.
      if (!isEditing) {
        if (page !== 1) setPage(1);
        else loadProductos();
      } else {
        loadProductos();
      }
    } catch (error: any) {
      console.error("❌ Error al guardar el producto", error);
      toast.error(error.message || "Error desconocido al guardar el producto.");
    }
  };

  const eliminarProducto = async (codigo_barra: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/${codigo_barra}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Error al eliminar el producto");

      toast.success("Producto eliminado");
      // Si borramos el último de una página, retrocedemos de página si corresponde
      const quedaUno = productos.length === 1 && page > 1;
      if (quedaUno) setPage((p) => p - 1);
      else loadProductos();

    } catch (error) {
      toast.error("Error al eliminar el producto");
      console.error(error);
    }
  };

  const generarEtiqueta = (producto: Producto) => {
    setProductoEtiqueta(producto);
    setIsModalEtiquetaOpen(true);
    toast.success(
      `Etiqueta generada para ${formatDescripcionProducto(producto.descripcion, producto.descripcion_extra)}`
    );
  };

  useEffect(() => {
    if (isModalEtiquetaOpen && productoEtiqueta) {
      const timer = setTimeout(() => {
        if (barcodeRef.current) {
          JsBarcode(
            barcodeRef.current,
            productoEtiqueta.codigo_barra || "000000000000",
            JSBARCODE_OPTS_50X25
          );
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isModalEtiquetaOpen, productoEtiqueta]);

  const buildDescripcionFromIds = (
    lineaId: number | null,
    talleId: number | null,
    telaId: number | null,
    colorId: number | null
  ): string => {
    const findNombre = (lista: { id: number; nombre: string }[], id: number | null) =>
      id ? lista.find((x) => x.id === id)?.nombre ?? "" : "";

    const partes = [
      findNombre(lineas, lineaId),
      findNombre(talles, talleId),
      findNombre(telas, telaId),
      findNombre(colores, colorId),
    ]
      .filter(Boolean)
      .map((p) => p.toUpperCase());

    return partes.join(" ");
  };

  const buildCodigoPreview = (
    lineaId: number | null,
    talleId: number | null,
    telaId: number | null,
    colorId: number | null
  ): string => {
    const findCodigo = (lista: ItemConfig[], id: number | null) =>
      id ? lista.find((x) => x.id === id)?.codigo ?? "" : "";

    const lineaCod = findCodigo(lineas, lineaId);
    const talleCod = findCodigo(talles, talleId);
    const telaCod = findCodigo(telas, telaId);
    const colorCod = findCodigo(colores, colorId);

    return `${lineaCod}${talleCod}${telaCod}${colorCod}`;
  };

  const toggleBulkCampo = (campo: string) => {
    setBulkCampos((prev) =>
      prev.includes(campo) ? prev.filter((c) => c !== campo) : [...prev, campo]
    );
  };

  const toggleBulkLinea = (lineaId: number) => {
    setBulkLineaIds((prev) =>
      prev.includes(lineaId) ? prev.filter((id) => id !== lineaId) : [...prev, lineaId]
    );
  };

  const aplicarAjusteMasivo = async () => {
    if (!token) return;
    if (bulkCampos.length === 0) {
      toast.error("Seleccioná al menos un tipo de precio.");
      return;
    }
    if (bulkValor === "" || Number.isNaN(Number(bulkValor))) {
      toast.error("Ingresá un valor válido.");
      return;
    }
    setBulkEjecutando(true);
    try {
      const body = {
        modo: bulkModo,
        valor: Number(bulkValor),
        campos: bulkCampos,
        linea_ids: bulkLineaIds.length > 0 ? bulkLineaIds : undefined,
      };
      const res = await fetch(`${API_URL}/precios/masivo`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.success === false) {
        throw new Error(result?.message || "No se pudo aplicar el ajuste masivo.");
      }
      const data = result?.data || {};
      toast.success(
        `Ajuste aplicado: ${data.total_actualizados ?? 0} de ${data.total_encontrados ?? 0} productos`
      );
      setIsBulkPreciosOpen(false);
      loadProductos();
    } catch (error: any) {
      toast.error(error?.message || "Error al aplicar ajuste masivo");
    } finally {
      setBulkEjecutando(false);
    }
  };

  const productoBase = () => ({
    codigo_barra: "",
    descripcion: "",
    descripcion_extra: "",
    linea_id: null as number | null,
    tela_id: null as number | null,
    talle_id: null as number | null,
    color_id: null as number | null,
    costo: 0,
    precio_alquiler_lista: 0,
    precio_alquiler_efectivo: 0,
    precio_venta_nuevo_lista: 0,
    precio_venta_nuevo_efectivo: 0,
    precio_de_venta_medio_uso: 0,
    precio_venta: 0,
    precio_liquidacion: 0,
    stock: 1,
    stock_minimo: 0,
    fecha_alta: new Date().toISOString().split("T")[0],
    estado: "SALON",
    sucursal_id: 1,
    inmovilizado: false,
  });

  return (
    <div className="container-fluid px-4 py-3">
      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-3">
        <div>
          <h1 className="fw-bold fs-3 mb-1">Productos</h1>
          <p className="text-muted mb-0">Gestión de productos de Guapo Trajes</p>
        </div>
        <RoleGate allow={["ADMIN"]}>
          <div className="d-flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              className="d-flex align-items-center gap-2"
              onClick={() => setIsBulkPreciosOpen(true)}
            >
              <i className="bi bi-currency-dollar"></i>
              Ajuste masivo de precios
            </Button>
            <Button
              className="btn btn-primary d-flex align-items-center gap-2"
              onClick={() => {
                setProductoActual(productoBase());
                setIsDetalleOpen(false);
                setIsFormularioOpen(true);
              }}
            >
              <i className="bi bi-plus"></i>
              Nuevo Producto
            </Button>
          </div>
        </RoleGate>
      </div>

      {/* Buscador y filtros */}
      <div className="row g-2 mb-4 align-items-end">
        <div className="col-12 col-md-5 col-lg-4">
          <input
            type="search"
            className="form-control w-100"
            placeholder="Buscar por línea, código o descripción..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="col-auto d-flex align-items-center gap-3 flex-wrap">
          <div className="form-check mb-0 user-select-none">
            <input
              className="form-check-input"
              type="checkbox"
              id="filtro-solo-reservados"
              checked={filtroSoloReservados}
              onChange={(e) => {
                setFiltroSoloReservados(e.target.checked);
                setPage(1);
              }}
            />
            <label className="form-check-label small fw-semibold" htmlFor="filtro-solo-reservados">
              Solo reservados
            </label>
          </div>
          <Button
            type="button"
            variant={
              filtroOpen ||
              filtroLineaId ||
              filtroTalleId ||
              filtroTelaId ||
              filtroColorId
                ? "primary"
                : "outline"
            }
            onClick={() => setFiltroOpen(!filtroOpen)}
          >
            <i className="bi bi-funnel me-1"></i>
            Filtrar
          </Button>
        </div>
        {filtroOpen && (
          <div className="col-12 mt-2 p-3 border rounded bg-light">
            <p className="small fw-semibold mb-2">Filtros por atributos</p>
            <div className="row g-2">
              <div className="col-6 col-md-3">
                <label className="form-label small">Línea</label>
                <select
                  className="form-select form-select-sm"
                  value={filtroLineaId}
                  onChange={(e) => {
                    setFiltroLineaId(e.target.value ? Number(e.target.value) : "");
                    setPage(1);
                  }}
                >
                  <option value="">Todas</option>
                  {lineas.map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small">Talle</label>
                <select
                  className="form-select form-select-sm"
                  value={filtroTalleId}
                  onChange={(e) => {
                    setFiltroTalleId(e.target.value ? Number(e.target.value) : "");
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  {talles.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small">Tela</label>
                <select
                  className="form-select form-select-sm"
                  value={filtroTelaId}
                  onChange={(e) => {
                    setFiltroTelaId(e.target.value ? Number(e.target.value) : "");
                    setPage(1);
                  }}
                >
                  <option value="">Todas</option>
                  {telas.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small">Color</label>
                <select
                  className="form-select form-select-sm"
                  value={filtroColorId}
                  onChange={(e) => {
                    setFiltroColorId(e.target.value ? Number(e.target.value) : "");
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  {colores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setFiltroLineaId("");
                setFiltroTalleId("");
                setFiltroTelaId("");
                setFiltroColorId("");
                setFiltroSoloReservados(false);
                setPage(1);
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-striped table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Línea</th>
                <th>Talle</th>
                <th>Color</th>
                <th>Descripción extra</th>
                <th>Precio Alq. Lista</th>
                <th>RESERVADO</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!token ? (
                <tr>
                  <td colSpan={8} className="text-center py-4">
                    <div className="text-muted">
                      <i className="bi bi-lock me-2"></i>
                      Por favor, inicia sesión para ver los productos
                    </div>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-4">
                    <div className="text-muted">
                      <i className="bi bi-arrow-repeat me-2"></i>
                      Cargando productos...
                    </div>
                  </td>
                </tr>
              ) : productos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-4">
                    <div className="text-muted">
                      {busquedaDebounced.trim() ? (
                        <>
                          <i className="bi bi-search me-2"></i>
                          No se encontraron productos que coincidan con la búsqueda
                          <div className="mt-2 small">
                            Buscando: <strong>&quot;{busquedaDebounced}&quot;</strong>
                          </div>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-inbox me-2"></i>
                          No hay productos disponibles en tu sucursal
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                productos.map((producto) => (
                  <React.Fragment key={producto.id}>
                    <tr
                      onClick={() => setProductoExpandidoId((prev) => (prev === producto.id ? null : producto.id))}
                      className={productoExpandidoId === producto.id ? "table-active" : ""}
                      style={{ cursor: "pointer" }}
                    >
                    <td>{producto.linea_nombre ?? "-"}</td>
                    <td>{producto.talle_nombre ?? "-"}</td>
                    <td>{producto.color_nombre ?? "-"}</td>
                    <td>{(producto.descripcion_extra ?? "").trim() || "—"}</td>
                    <td>{producto.precio_alquiler_lista}</td>
                    <td className="text-center">
                      {producto.en_ventana_reserva_hoy === true ? (
                        <span className="text-success" title="Reservado">
                          <i className="bi bi-check-lg fs-5" aria-hidden />
                          <span className="visually-hidden">Reservado</span>
                        </span>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        value={producto.estado}
                        onChange={async (e) => {
                          if (!token) return;
                          const nuevoEstado = e.target.value;
                          const estadoAnterior = producto.estado;
                          if (
                            nuevoEstado === "LAVANDERIA" &&
                            estadoAnterior !== "LAVANDERIA"
                          ) {
                            setProductoEnvioLavanderia(producto);
                            setLavEnvioId("");
                            setLavEnvioNotas("");
                            return;
                          }
                          if (
                            nuevoEstado === "MODISTA" &&
                            estadoAnterior !== "MODISTA"
                          ) {
                            setProductoEnvioModista(producto);
                            setModEnvioId("");
                            setModEnvioNotas("");
                            return;
                          }
                          const payload = { estado: nuevoEstado };
                          try {
                            const response = await fetch(
                              `${API_URL}/estado/${producto.id}`,
                              {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify(payload),
                              }
                            );
                            const result = await response.json().catch(() => ({}));
                            if (!response.ok || result?.success === false) {
                              const message =
                                result?.message ||
                                result?.detail ||
                                "Error al actualizar el estado.";
                              toast.error(message);
                              e.target.value = estadoAnterior;
                              return;
                            }
                            toast.success(result?.message || "Estado actualizado correctamente");
                            loadProductos();
                          } catch (error: any) {
                            console.error(error);
                            toast.error(error?.message || "Error al actualizar el estado.");
                            e.target.value = estadoAnterior;
                          }
                        }}
                        className="form-select form-select-sm"
                        style={{ minWidth: "140px" }}
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="d-flex flex-wrap gap-2">
                        <Button
                          className="btn btn-sm btn-light border"
                          title="Ver"
                          onClick={() => {
                            setProductoEtiqueta(null);
                            setProductoActual(producto);
                            setIsDetalleOpen(true);
                          }}
                        >
                          <i className="bi bi-eye text-dark"></i>
                        </Button>
                        <Button
                          onClick={() => generarEtiqueta(producto)}
                          title="Etiquetado"
                          className="btn btn-sm btn-light border"
                        >
                          <i className="bi bi-code text-dark"></i>
                        </Button>
                        <RoleGate allow={["ADMIN"]}>
                          <Button
                            className="btn btn-sm btn-warning text-dark"
                            onClick={() => {
                              setProductoActual(producto);
                              setIsDetalleOpen(false);
                              setIsFormularioOpen(true);
                            }}
                            title="Editar"
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button
                            className="btn btn-sm btn-danger text-white"
                            onClick={() =>
                              eliminarProducto(producto.codigo_barra)
                            }
                            title="Eliminar"
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </RoleGate>
                      </div>
                    </td>
                  </tr>
                  {productoExpandidoId === producto.id && (
                    <tr key={`${producto.id}-destino`}>
                      <td colSpan={8} className="bg-light py-2 px-3 small">
                        <div className="d-flex flex-column gap-1">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="text-muted">Información de devolución:</span>
                            {producto.estado === "LAVANDERIA" && (
                              <span>
                                <i className="bi bi-droplet-half text-primary me-1"></i>
                                <strong>Lavandería:</strong> {producto.destino_nombre ?? "—"}
                              </span>
                            )}
                            {producto.estado === "MODISTA" && (
                              <span>
                                <i className="bi bi-scissors text-secondary me-1"></i>
                                <strong>Modista:</strong> {producto.destino_nombre ?? "—"}
                              </span>
                            )}
                            {(producto.estado !== "LAVANDERIA" && producto.estado !== "MODISTA") && (
                              <span className="text-muted">Este producto no está en lavandería ni en modista.</span>
                            )}
                          </div>
                          {(producto.estado === "LAVANDERIA" || producto.estado === "MODISTA") && (
                            <>
                              <div className="mt-1">
                                <strong>Motivo:</strong>{" "}
                                <span className="text-dark">{(producto.destino_notas ?? "").trim() || "—"}</span>
                              </div>
                              {((producto.destino_cliente_nombre ?? "").trim() || (producto.destino_cliente_celular ?? "").trim()) ? (
                                <div className="mt-1 d-flex flex-wrap gap-3">
                                  {(producto.destino_cliente_nombre ?? "").trim() ? (
                                    <span><strong>Cliente:</strong> <span className="text-dark">{producto.destino_cliente_nombre}</span></span>
                                  ) : null}
                                  {(producto.destino_cliente_celular ?? "").trim() ? (
                                    <span><strong>Teléfono:</strong> <span className="text-dark">{producto.destino_cliente_celular}</span></span>
                                  ) : null}
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 mt-4">
        <div className="text-muted small text-center text-md-start">
          Mostrando <b>{productos.length}</b> de <b>{total}</b> resultados
        </div>
        <div className="d-flex align-items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ◀ Anterior
          </Button>
          <span className="text-sm">
            Página <b>{page}</b> / {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Siguiente ▶
          </Button>
        </div>
      </div>

      <Dialog
        open={!!productoEnvioLavanderia}
        onOpenChange={(open) => {
          if (!open) cerrarModalEnvioLavanderia();
        }}
      >
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-lg"
          dialogStyle={{ maxWidth: "560px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
            <DialogTitle className="fw-semibold mb-0">Enviar a lavandería</DialogTitle>
          </DialogHeader>
          <div className="modal-body px-3 px-md-4 py-3">
            {productoEnvioLavanderia ? (
              <>
                <div className="mb-3 small">
                  <p className="mb-1 fw-semibold text-dark">
                    {formatDescripcionProducto(
                      productoEnvioLavanderia.descripcion,
                      productoEnvioLavanderia.descripcion_extra
                    )}
                  </p>
                  <p className="mb-0 text-muted font-monospace">
                    {productoEnvioLavanderia.codigo_barra || `ID ${productoEnvioLavanderia.id}`}
                  </p>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="lav-envio-select">
                    Lavandería
                  </label>
                  <select
                    id="lav-envio-select"
                    className="form-select"
                    value={lavEnvioId === "" ? "" : String(lavEnvioId)}
                    onChange={(e) =>
                      setLavEnvioId(e.target.value ? Number(e.target.value) : "")
                    }
                  >
                    <option value="">Seleccionar lavandería…</option>
                    {lavanderiasList.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-0">
                  <label className="form-label fw-semibold" htmlFor="lav-envio-notas">
                    Notas <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <textarea
                    id="lav-envio-notas"
                    className="form-control"
                    rows={3}
                    value={lavEnvioNotas}
                    onChange={(e) => setLavEnvioNotas(e.target.value)}
                    placeholder="Ej. manchas leves, retiro urgente…"
                  />
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter className="border-top pt-3 d-flex flex-wrap justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={guardandoLavanderia}
              onClick={cerrarModalEnvioLavanderia}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={guardandoLavanderia || lavanderiasList.length === 0}
              onClick={() => void confirmarEnvioLavanderia()}
            >
              {guardandoLavanderia ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden
                  />
                  Guardando…
                </>
              ) : (
                <>
                  <i className="bi bi-droplet-half me-2" aria-hidden />
                  Confirmar envío
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!productoEnvioModista}
        onOpenChange={(open) => {
          if (!open) cerrarModalEnvioModista();
        }}
      >
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-lg"
          dialogStyle={{ maxWidth: "560px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3 px-3 px-md-4">
            <DialogTitle className="fw-semibold mb-0">Enviar a modista</DialogTitle>
          </DialogHeader>
          <div className="modal-body px-3 px-md-4 py-3">
            {productoEnvioModista ? (
              <>
                <div className="mb-3 small">
                  <p className="mb-1 fw-semibold text-dark">
                    {formatDescripcionProducto(
                      productoEnvioModista.descripcion,
                      productoEnvioModista.descripcion_extra
                    )}
                  </p>
                  <p className="mb-0 text-muted font-monospace">
                    {productoEnvioModista.codigo_barra || `ID ${productoEnvioModista.id}`}
                  </p>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="mod-envio-select">
                    Modista
                  </label>
                  <select
                    id="mod-envio-select"
                    className="form-select"
                    value={modEnvioId === "" ? "" : String(modEnvioId)}
                    onChange={(e) =>
                      setModEnvioId(e.target.value ? Number(e.target.value) : "")
                    }
                  >
                    <option value="">Seleccionar modista…</option>
                    {modistasList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-0">
                  <label className="form-label fw-semibold" htmlFor="mod-envio-notas">
                    Notas <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <textarea
                    id="mod-envio-notas"
                    className="form-control"
                    rows={3}
                    value={modEnvioNotas}
                    onChange={(e) => setModEnvioNotas(e.target.value)}
                    placeholder="Ej. ajuste de manga, fecha límite…"
                  />
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter className="border-top pt-3 d-flex flex-wrap justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={guardandoModista}
              onClick={cerrarModalEnvioModista}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={guardandoModista || modistasList.length === 0}
              onClick={() => void confirmarEnvioModista()}
            >
              {guardandoModista ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden
                  />
                  Guardando…
                </>
              ) : (
                <>
                  <i className="bi bi-scissors me-2" aria-hidden />
                  Confirmar envío
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal etiqueta */}
      <Dialog open={isModalEtiquetaOpen} onOpenChange={setIsModalEtiquetaOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle>Etiqueta (50×25 mm)</DialogTitle>
          </DialogHeader>
          {productoEtiqueta && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded border bg-white p-2 text-center">
                <style>{ETIQUETA_50X25_PREVIEW_CSS}</style>
                <div className="etiqueta-50x25-preview">
                  <div className="wrap">
                    <div className="inner">
                      <p className="product-name">
                        {formatDescripcionProducto(
                          productoEtiqueta.descripcion,
                          productoEtiqueta.descripcion_extra
                        )}
                      </p>
                      <div className="barcode-slot">
                        <svg ref={barcodeRef} id="etiqueta-impresion" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  const etiqueta = document.getElementById("etiqueta-impresion");
                  const svg = (etiqueta ? etiqueta : barcodeRef.current) as SVGSVGElement | null;
                  if (!svg) return;
                  void imprimirEtiqueta50x25DesdeSvg(
                    svg,
                    formatDescripcionProducto(
                      productoEtiqueta.descripcion,
                      productoEtiqueta.descripcion_extra
                    )
                  );
                }}
              >
                Imprimir
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsModalEtiquetaOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkPreciosOpen} onOpenChange={setIsBulkPreciosOpen}>
        <DialogContent dialogClassName="modal-lg" dialogStyle={{ maxWidth: "760px", width: "92%" }}>
          <DialogHeader className="px-3 px-md-4 pt-3 pb-2 border-bottom">
            <DialogTitle>Ajuste masivo de precios</DialogTitle>
          </DialogHeader>
          <div className="px-3 px-md-4 py-3">
            <div className="card border-0 bg-light mb-3">
              <div className="card-body p-3 p-md-4">
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-bold">Modo</label>
                    <select
                      className="form-select"
                      value={bulkModo}
                      onChange={(e) => setBulkModo(e.target.value as "porcentaje" | "monto_fijo")}
                    >
                      <option value="porcentaje">Porcentaje</option>
                      <option value="monto_fijo">Monto fijo</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-bold">
                      Valor {bulkModo === "porcentaje" ? "(%)" : "($)"}
                    </label>
                    <Input
                      type="number"
                      value={bulkValor}
                      onChange={(e) =>
                        setBulkValor(e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold mb-2">Tipos de precio a modificar</label>
              <div className="row g-2">
                {[
                  ["precio_alquiler_lista", "Alquiler lista"],
                  ["precio_alquiler_efectivo", "Alquiler efectivo"],
                  ["precio_venta_nuevo_lista", "Venta nuevo lista"],
                  ["precio_venta_nuevo_efectivo", "Venta nuevo efectivo"],
                  ["precio_de_venta_medio_uso", "Medio uso"],
                  ["precio_venta", "Venta final"],
                  ["precio_liquidacion", "Liquidación"],
                ].map(([campo, label]) => (
                  <div className="col-12 col-md-6" key={campo}>
                    <label className="form-check-label d-flex align-items-center gap-2 border rounded px-2 py-2 bg-white w-100">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={bulkCampos.includes(campo)}
                        onChange={() => toggleBulkCampo(campo)}
                      />
                      <span>{label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-1">
              <div className="d-flex justify-content-between align-items-center mb-2 gap-2 flex-wrap">
                <label className="form-label fw-bold mb-0">Líneas incluidas en el ajuste</label>
                <div className="d-flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkLineaIds(lineas.map((l) => l.id))}
                  >
                    Marcar todas
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkLineaIds([])}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
              <div className="row g-2">
                {lineas.map((linea) => (
                  <div className="col-12 col-md-6" key={linea.id}>
                    <label className="form-check-label d-flex align-items-center gap-2 border rounded px-2 py-2 bg-white w-100">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={bulkLineaIds.includes(linea.id)}
                        onChange={() => toggleBulkLinea(linea.id)}
                      />
                      <span>{linea.nombre}</span>
                    </label>
                  </div>
                ))}
              </div>
              <p className="small text-muted mt-2 mb-0">
                Si no seleccionás líneas, el ajuste aplica a todas.
              </p>
            </div>
          </div>
          <DialogFooter className="px-3 px-md-4 pb-3 pt-2 border-top">
            <Button variant="outline" onClick={() => setIsBulkPreciosOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void aplicarAjusteMasivo()} disabled={bulkEjecutando}>
              {bulkEjecutando ? "Aplicando..." : "Aplicar ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Crear/Editar */}
      <Dialog
        open={isFormularioOpen}
        onOpenChange={(open) => {
          if (!open) setIsFormularioOpen(false)
        }}
      >
        <DialogContent
          dialogClassName="modal-xl"
          dialogStyle={{ maxWidth: "900px", width: "90%" }}
        >
          <DialogHeader className="pb-3 px-3 px-md-4">
            <DialogTitle>
              {productoActual?.id ? "Editar Producto" : "Agregar Producto"}
            </DialogTitle>
          </DialogHeader>

          <div className="px-3 px-md-4 pb-1">
            <div className="row g-4">
              <div className="col-12 col-md-6">
                <div className="card shadow-sm h-100">
                  <div className="card-header bg-light">
                    <h6 className="mb-0">
                      <i className="bi bi-info-circle me-2"></i>Datos generales
                    </h6>
                  </div>
                  <div className="card-body p-4">
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label fw-bold">Código de Barra</label>
                        <Input
                          className="form-control w-100"
                          value={productoActual?.codigo_barra || ""}
                          readOnly
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-bold">Descripción (auto)</label>
                        <Input
                          className="form-control w-100"
                          value={productoActual?.descripcion || ""}
                          readOnly
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-bold">Descripción extra</label>
                        <Input
                          className="form-control w-100"
                          value={productoActual?.descripcion_extra || ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              descripcion_extra: e.target.value,
                            })
                          }
                          placeholder="Opcional"
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Línea</label>
                        <select
                          className="form-select w-100"
                          value={productoActual?.linea_id ?? ""}
                          onChange={(e) => {
                            const newLineaId = e.target.value
                              ? Number(e.target.value)
                              : null;
                            const newDesc = buildDescripcionFromIds(
                              newLineaId,
                              productoActual?.talle_id ?? null,
                              productoActual?.tela_id ?? null,
                              productoActual?.color_id ?? null
                            );
                            const newCodigo = buildCodigoPreview(
                              newLineaId,
                              productoActual?.talle_id ?? null,
                              productoActual?.tela_id ?? null,
                              productoActual?.color_id ?? null
                            );
                            setProductoActual({
                              ...productoActual!,
                              linea_id: newLineaId,
                              descripcion: newDesc,
                              codigo_barra: newCodigo || productoActual?.codigo_barra,
                            });
                          }}
                        >
                          <option value="">Ninguna</option>
                          {lineas.map((l) => (
                            <option key={l.id} value={l.id}>{l.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Talle</label>
                        <select
                          className="form-select w-100"
                          value={productoActual?.talle_id ?? ""}
                          onChange={(e) => {
                            const newTalleId = e.target.value
                              ? Number(e.target.value)
                              : null;
                            const newDesc = buildDescripcionFromIds(
                              productoActual?.linea_id ?? null,
                              newTalleId,
                              productoActual?.tela_id ?? null,
                              productoActual?.color_id ?? null
                            );
                            const newCodigo = buildCodigoPreview(
                              productoActual?.linea_id ?? null,
                              newTalleId,
                              productoActual?.tela_id ?? null,
                              productoActual?.color_id ?? null
                            );
                            setProductoActual({
                              ...productoActual!,
                              talle_id: newTalleId,
                              descripcion: newDesc,
                              codigo_barra: newCodigo || productoActual?.codigo_barra,
                            });
                          }}
                        >
                          <option value="">Ninguno</option>
                          {talles.map((t) => (
                            <option key={t.id} value={t.id}>{t.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Tela</label>
                        <select
                          className="form-select w-100"
                          value={productoActual?.tela_id ?? ""}
                          onChange={(e) => {
                            const newTelaId = e.target.value
                              ? Number(e.target.value)
                              : null;
                            const newDesc = buildDescripcionFromIds(
                              productoActual?.linea_id ?? null,
                              productoActual?.talle_id ?? null,
                              newTelaId,
                              productoActual?.color_id ?? null
                            );
                            const newCodigo = buildCodigoPreview(
                              productoActual?.linea_id ?? null,
                              productoActual?.talle_id ?? null,
                              newTelaId,
                              productoActual?.color_id ?? null
                            );
                            setProductoActual({
                              ...productoActual!,
                              tela_id: newTelaId,
                              descripcion: newDesc,
                              codigo_barra: newCodigo || productoActual?.codigo_barra,
                            });
                          }}
                        >
                          <option value="">Ninguna</option>
                          {telas.map((t) => (
                            <option key={t.id} value={t.id}>{t.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Color</label>
                        <select
                          className="form-select w-100"
                          value={productoActual?.color_id ?? ""}
                          onChange={(e) => {
                            const newColorId = e.target.value
                              ? Number(e.target.value)
                              : null;
                            const newDesc = buildDescripcionFromIds(
                              productoActual?.linea_id ?? null,
                              productoActual?.talle_id ?? null,
                              productoActual?.tela_id ?? null,
                              newColorId
                            );
                            const newCodigo = buildCodigoPreview(
                              productoActual?.linea_id ?? null,
                              productoActual?.talle_id ?? null,
                              productoActual?.tela_id ?? null,
                              newColorId
                            );
                            setProductoActual({
                              ...productoActual!,
                              color_id: newColorId,
                              descripcion: newDesc,
                              codigo_barra: newCodigo || productoActual?.codigo_barra,
                            });
                          }}
                        >
                          <option value="">Ninguno</option>
                          {colores.map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Estado</label>
                        <select
                          className="form-select w-100"
                          value={productoActual?.estado || ""}
                          onChange={(e) => {
                            const nuevo = e.target.value as EstadoKey;
                            const prev = productoActual?.estado;
                            if (
                              nuevo === "LAVANDERIA" &&
                              prev !== "LAVANDERIA" &&
                              productoActual?.id
                            ) {
                              setProductoEnvioLavanderia(productoActual as Producto);
                              setLavEnvioId("");
                              setLavEnvioNotas("");
                              return;
                            }
                            if (
                              nuevo === "MODISTA" &&
                              prev !== "MODISTA" &&
                              productoActual?.id
                            ) {
                              setProductoEnvioModista(productoActual as Producto);
                              setModEnvioId("");
                              setModEnvioNotas("");
                              return;
                            }
                            setProductoActual({
                              ...productoActual!,
                              estado: nuevo,
                            });
                          }}
                        >
                          <option value="">Seleccione un estado</option>
                          {ESTADOS.map((estado) => (
                            <option key={estado} value={estado}>
                              {estado}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Fecha de Alta</label>
                        <Input
                          type="date"
                          className="form-control w-100"
                          value={
                            productoActual?.fecha_alta ||
                            new Date().toISOString().slice(0, 10)
                          }
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              fecha_alta: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12">
                        <div className="form-check mt-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="producto-inmovilizado"
                            checked={productoActual?.inmovilizado || false}
                            onChange={(e) =>
                              setProductoActual({
                                ...productoActual!,
                                inmovilizado: e.target.checked,
                              })
                            }
                          />
                          <label
                            className="form-check-label fw-bold ms-2"
                            htmlFor="producto-inmovilizado"
                          >
                            Inmovilizado
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="card shadow-sm h-100">
                  <div className="card-header bg-light">
                    <h6 className="mb-0">
                      <i className="bi bi-cash-stack me-2"></i>Precios y stock
                    </h6>
                  </div>
                  <div className="card-body p-4">
                    <div className="row g-3">
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Costo</label>
                        <Input
                          type="number"
                          className="form-control w-100"
                          value={Number.isFinite(productoActual?.costo as number) ? productoActual?.costo : ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              costo: e.target.value === "" ? undefined : parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">
                          Precio Alquiler (Lista)
                        </label>
                        <Input
                          type="number"
                          className="form-control w-100"
                          value={Number.isFinite(productoActual?.precio_alquiler_lista as number) ? productoActual?.precio_alquiler_lista : ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              precio_alquiler_lista:
                                e.target.value === ""
                                  ? undefined
                                  : parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">
                          Precio Alquiler (Efectivo)
                        </label>
                        <Input
                          type="number"
                          className="form-control w-100"
                          value={Number.isFinite(productoActual?.precio_alquiler_efectivo as number) ? productoActual?.precio_alquiler_efectivo : ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              precio_alquiler_efectivo:
                                e.target.value === ""
                                  ? undefined
                                  : parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">
                          Precio Venta Nuevo (Lista)
                        </label>
                        <Input
                          type="number"
                          className="form-control w-100"
                          value={Number.isFinite(productoActual?.precio_venta_nuevo_lista as number) ? productoActual?.precio_venta_nuevo_lista : ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              precio_venta_nuevo_lista:
                                e.target.value === ""
                                  ? undefined
                                  : parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">
                          Precio Venta Nuevo (Efectivo)
                        </label>
                        <Input
                          type="number"
                          className="form-control w-100"
                          value={Number.isFinite(productoActual?.precio_venta_nuevo_efectivo as number) ? productoActual?.precio_venta_nuevo_efectivo : ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              precio_venta_nuevo_efectivo:
                                e.target.value === ""
                                  ? undefined
                                  : parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">
                          Precio Medio Uso
                        </label>
                        <Input
                          type="number"
                          className="form-control w-100"
                          value={Number.isFinite(productoActual?.precio_de_venta_medio_uso as number) ? productoActual?.precio_de_venta_medio_uso : ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              precio_de_venta_medio_uso:
                                e.target.value === ""
                                  ? undefined
                                  : parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">
                          Precio Venta Final
                        </label>
                        <Input
                          type="number"
                          className="form-control w-100"
                          value={Number.isFinite(productoActual?.precio_venta as number) ? productoActual?.precio_venta : ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              precio_venta:
                                e.target.value === ""
                                  ? undefined
                                  : parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">
                          Precio Liquidación
                        </label>
                        <Input
                          type="number"
                          className="form-control w-100"
                          value={Number.isFinite(productoActual?.precio_liquidacion as number) ? productoActual?.precio_liquidacion : ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              precio_liquidacion:
                                e.target.value === ""
                                  ? undefined
                                  : parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 pt-4 border-top d-flex justify-content-end gap-3 px-3 px-md-4 pb-1">
            <Button
              className="btn btn-secondary"
              onClick={() => setIsFormularioOpen(false)}
            >
              Cancelar
            </Button>
            <Button className="btn btn-primary" onClick={guardarProducto}>
              {productoActual?.id ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal ver detalle */}
      <Dialog open={isDetalleOpen} onOpenChange={setIsDetalleOpen}>
        <DialogContent
          dialogClassName="modal-xl"
          dialogStyle={{ maxWidth: "900px", width: "90%" }}
        >
          <DialogHeader className="pb-3 px-3 px-md-4">
            <DialogTitle>Detalle del Producto</DialogTitle>
          </DialogHeader>

          {productoActual && (
            <div className="px-3 px-md-4 pb-1">
              <div className="row g-4">
                <div className="col-12 col-md-6">
                  <div className="card shadow-sm h-100">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">
                        <i className="bi bi-info-circle me-2"></i>Datos generales
                      </h6>
                    </div>
                    <div className="card-body p-4">
                      <div className="row g-3">
                        <div className="col-12">
                          <label className="form-label fw-bold">Código de Barra</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.codigo_barra || "N/A"}
                          </div>
                        </div>
                        <div className="col-12">
                          <label className="form-label fw-bold">Descripción</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.descripcion || "N/A"}
                          </div>
                        </div>
                        <div className="col-12">
                          <label className="form-label fw-bold">Descripción extra</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.descripcion_extra || "N/A"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">Línea</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.linea_nombre ?? "N/A"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">Talle</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.talle_nombre ?? "N/A"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">Tela</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.tela_nombre ?? "N/A"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">Color</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.color_nombre ?? "N/A"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">Estado</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.estado || "N/A"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">Fecha de Alta</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.fecha_alta || "N/A"}
                          </div>
                        </div>
                        <div className="col-12">
                          <div className="form-check mt-2">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="producto-inmovilizado-view"
                              checked={productoActual.inmovilizado || false}
                              disabled
                            />
                            <label
                              className="form-check-label fw-bold ms-2"
                              htmlFor="producto-inmovilizado-view"
                            >
                              Inmovilizado
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="card shadow-sm h-100">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">
                        <i className="bi bi-cash-stack me-2"></i>Precios y stock
                      </h6>
                    </div>
                    <div className="card-body p-4">
                      <div className="row g-3">
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">Costo</label>
                          <div className="form-control bg-light border-0">
                            ${productoActual.costo?.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) || "0.00"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">
                            Precio Alquiler (Lista)
                          </label>
                          <div className="form-control bg-light border-0">
                            ${productoActual.precio_alquiler_lista?.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) || "0.00"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">
                            Precio Alquiler (Efectivo)
                          </label>
                          <div className="form-control bg-light border-0">
                            ${productoActual.precio_alquiler_efectivo?.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) || "0.00"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">
                            Precio Venta Nuevo (Lista)
                          </label>
                          <div className="form-control bg-light border-0">
                            ${productoActual.precio_venta_nuevo_lista?.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) || "0.00"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">
                            Precio Venta Nuevo (Efectivo)
                          </label>
                          <div className="form-control bg-light border-0">
                            ${productoActual.precio_venta_nuevo_efectivo?.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) || "0.00"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">
                            Precio Medio Uso
                          </label>
                          <div className="form-control bg-light border-0">
                            ${productoActual.precio_de_venta_medio_uso?.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) || "0.00"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">
                            Precio Venta Final
                          </label>
                          <div className="form-control bg-light border-0">
                            ${productoActual.precio_venta?.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) || "0.00"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">
                            Precio Liquidación
                          </label>
                          <div className="form-control bg-light border-0">
                            ${productoActual.precio_liquidacion?.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) || "0.00"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">
                            Cantidad de Usos o Veces Alquiladas
                          </label>
                          <div className="form-control bg-light border-0 fw-bold">
                            {productoActual.veces_alquilado || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 pt-4 border-top d-flex justify-content-end gap-3 px-3 px-md-4 pb-1">
            <Button
              className="btn btn-secondary"
              onClick={() => setIsDetalleOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
