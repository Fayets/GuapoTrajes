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
import { toast } from "sonner";
import { RoleGate } from "@/components/RoleGate";
import { getApiBaseUrl } from "@/lib/api-config";

type ItemConfig = { id: number; nombre: string; codigo: string };

interface Producto {
  id: number;
  codigo_barra: string;
  descripcion: string;
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
  const [productoExpandidoId, setProductoExpandidoId] = useState<number | null>(null);

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

  // Carga de productos con paginación y filtro remoto
  const loadProductos = () => {
    if (!token) {
      console.warn("⚠️ No hay token disponible para cargar productos");
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(PAGE_SIZE));
    if (filtroLineaId) params.set("linea_id", String(filtroLineaId));
    if (filtroTalleId) params.set("talle_id", String(filtroTalleId));
    if (filtroTelaId) params.set("tela_id", String(filtroTelaId));
    if (filtroColorId) params.set("color_id", String(filtroColorId));

    console.log(`📦 Cargando productos: página ${page}`);

    fetch(`${API_URL}/all?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`❌ Error HTTP ${res.status}:`, errorText);
          let errorMessage = `Error ${res.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.detail || errorJson.message || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        const xTotal = res.headers.get("X-Total-Count");
        const body = await res.json();
        console.log(`✅ Productos recibidos:`, body.length, "Total:", xTotal);
        setTotal(Number(xTotal ?? body?.length ?? 0));
        return body;
      })
      .then((data) => {
        if (Array.isArray(data)) {
          console.log(`✅ ${data.length} productos cargados correctamente`);
          setProductos(data);
        } else {
          console.error("❌ Formato de datos inesperado:", data);
          setProductos([]);
        }
      })
      .catch((error) => {
        console.error("❌ Error al obtener productos:", error.message);
        toast.error(`Error al cargar productos: ${error.message}`);
        setProductos([]);
        setTotal(0);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!token) return;
    loadProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, filtroLineaId, filtroTalleId, filtroTelaId, filtroColorId]);

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
      // recargar la página actual para coherencia con paginación
      loadProductos();
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
    toast.success(`Etiqueta generada para ${producto.descripcion}`);
  };

  useEffect(() => {
    if (isModalEtiquetaOpen && productoEtiqueta) {
      const timer = setTimeout(() => {
        if (barcodeRef.current) {
          JsBarcode(
            barcodeRef.current,
            productoEtiqueta.codigo_barra || "000000000000",
            {
              format: "CODE128",
              lineColor: "#000",
              background: "#ffffff",
              width: 1.15,
              height: 30,
              margin: 0,
              displayValue: true,
              fontSize: 7,
              textMargin: 1,
            }
          );
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isModalEtiquetaOpen, productoEtiqueta]);

  const productosFiltrados = productos.filter((producto) =>
    `${producto.linea_nombre ?? ""} ${producto.codigo_barra} ${producto.descripcion}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

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

  const productoBase = () => ({
    codigo_barra: "",
    descripcion: "",
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
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="col-auto">
          <Button
            type="button"
            variant={filtroOpen || filtroLineaId || filtroTalleId || filtroTelaId || filtroColorId ? "primary" : "outline"}
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
                <th>Código de Barra</th>
                <th>Descripción</th>
                <th>Línea</th>
                <th>Talle</th>
                <th>Color</th>
                <th>Precio Alq. Lista</th>
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
                      <i className="bi bi-inbox me-2"></i>
                      No hay productos disponibles en tu sucursal
                    </div>
                  </td>
                </tr>
              ) : productosFiltrados.length > 0 ? (
                productosFiltrados.map((producto) => (
                  <React.Fragment key={producto.id}>
                    <tr
                      onClick={() => setProductoExpandidoId((prev) => (prev === producto.id ? null : producto.id))}
                      className={productoExpandidoId === producto.id ? "table-active" : ""}
                      style={{ cursor: "pointer" }}
                    >
                    <td className="fw-medium">{producto.codigo_barra}</td>
                    <td>{producto.descripcion}</td>
                    <td>{producto.linea_nombre ?? "-"}</td>
                    <td>{producto.talle_nombre ?? "-"}</td>
                    <td>{producto.color_nombre ?? "-"}</td>
                    <td>{producto.precio_alquiler_lista}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        value={producto.estado}
                        onChange={async (e) => {
                          if (!token) return;
                          const nuevoEstado = e.target.value;
                          const estadoAnterior = producto.estado;
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
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-4">
                    <div className="text-muted">
                      <i className="bi bi-search me-2"></i>
                      No se encontraron productos que coincidan con la búsqueda
                      {busqueda && (
                        <div className="mt-2 small">
                          Buscando: <strong>"{busqueda}"</strong>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
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

      {/* Modal etiqueta */}
      <Dialog open={isModalEtiquetaOpen} onOpenChange={setIsModalEtiquetaOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle>Etiqueta (50×25 mm)</DialogTitle>
          </DialogHeader>
          {productoEtiqueta && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded border bg-white p-2 text-center">
                <p className="mb-1.5 px-0.5 text-xs font-semibold leading-tight">
                  {productoEtiqueta.descripcion}
                </p>
                <div className="flex justify-center">
                  <svg
                    ref={barcodeRef}
                    id="etiqueta-impresion"
                    className="max-h-[100px] w-full max-w-[280px]"
                  />
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  imprimirEtiqueta(barcodeRef, productoEtiqueta.descripcion ?? "")
                }
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
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              estado: e.target.value as EstadoKey,
                            })
                          }
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

function imprimirEtiqueta(
  barcodeRef: React.RefObject<SVGSVGElement | null>,
  nombreProducto: string
) {
  const etiqueta = document.getElementById("etiqueta-impresion");
  const svg = (etiqueta ? etiqueta : barcodeRef.current) as SVGSVGElement | null;
  if (!svg) return;

  const contenido = svg.cloneNode(true) as SVGSVGElement;
  contenido.style.display = "block";
  contenido.style.marginInline = "auto";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page {
      size: 50mm 25mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 50mm;
      height: 25mm;
      background: #fff;
      overflow: hidden;
      direction: ltr;
    }
    body {
      display: block;
    }
    /* text-align:center + inline-flex centra bien en vista previa / impresión térmica */
    .wrap {
      width: 50mm;
      height: 25mm;
      margin: 0;
      padding: 0.4mm 1mm 0.3mm;
      text-align: center;
      overflow: hidden;
    }
    .inner {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      vertical-align: top;
      max-width: 48mm;
      gap: 0.35mm;
      text-align: center;
    }
    .product-name {
      margin: 0;
      padding: 0;
      width: 100%;
      max-width: 48mm;
      text-align: center;
      font: 600 5.5pt/1.15 system-ui, sans-serif;
      color: #000;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      word-break: break-word;
      hyphens: auto;
    }
    .barcode-slot {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      width: 100%;
    }
    .barcode-slot svg {
      display: block;
      margin-inline: auto;
      max-width: 47mm;
      max-height: 17mm;
      width: auto;
      height: auto;
    }
  </style>
</head>
<body>
  <div class="wrap"><div class="inner"></div></div>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "50mm",
    height: "25mm",
    border: "none",
    opacity: "0",
    pointerEvents: "none",
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const inner = doc.querySelector(".inner");
  if (inner) {
    const titulo = doc.createElement("p");
    titulo.className = "product-name";
    titulo.textContent = nombreProducto.trim() || "\u00A0";
    const slot = doc.createElement("div");
    slot.className = "barcode-slot";
    slot.appendChild(contenido);
    inner.appendChild(titulo);
    inner.appendChild(slot);
  }

  setTimeout(() => {
    win.focus();
    win.print();
    iframe.remove();
  }, 250);
}
