"use client";
import { useEffect, useState, useRef, useCallback } from "react";
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

interface Producto {
  id: number;
  codigo_barra: string;
  descripcion: string;
  linea: string;
  tela: string;
  talle: string;
  color: string;
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

  // Filtro/paginación
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoKey | undefined>(
    undefined
  );
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / size));

  // Stats para chips
  const [stats, setStats] = useState<Record<string, number>>({});

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

  // Carga de stats (chips)
  const loadStats = useCallback(() => {
    if (!token) return;
    const apiUrl = `${getApiBaseUrl()}/productos/stats/estado`;
    fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then((r) => r.json())
      .then((data) => setStats(data || {}))
      .catch(() => setStats({}));
  }, [token]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Carga de productos con paginación y filtro remoto
  const loadProductos = () => {
    if (!token) {
      console.warn("⚠️ No hay token disponible para cargar productos");
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(size));
    if (estadoFiltro) params.set("estado", estadoFiltro);

    console.log(`📦 Cargando productos: página ${page}, tamaño ${size}, estado: ${estadoFiltro || "todos"}`);

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
  }, [token, page, size, estadoFiltro]);

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

    if (!productoSinId.codigo_barra || !productoSinId.descripcion) {
      toast.error("Código de barra y descripción son obligatorios.");
      return;
    }

    const payload = {
      codigo_barra: productoSinId.codigo_barra,
      descripcion: productoSinId.descripcion,
      linea: productoSinId.linea,
      tela: productoSinId.tela,
      talle: productoSinId.talle,
      color: productoSinId.color,
      costo: productoSinId.costo ?? 0,
      precio_alquiler_lista: productoSinId.precio_alquiler_lista ?? 0,
      precio_alquiler_efectivo: productoSinId.precio_alquiler_efectivo ?? 0,
      precio_venta_nuevo_lista: productoSinId.precio_venta_nuevo_lista ?? 0,
      precio_venta_nuevo_efectivo:
        productoSinId.precio_venta_nuevo_efectivo ?? 0,
      precio_de_venta_medio_uso: productoSinId.precio_de_venta_medio_uso ?? 0,
      precio_venta: productoSinId.precio_venta ?? 0,
      precio_liquidacion: productoSinId.precio_liquidacion ?? 0,
      stock: productoSinId.stock ?? 0,
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

      const updatedProduct: Producto = result.producto ?? result.data;
      if (!updatedProduct?.id) {
        throw new Error(
          "El backend no devolvió el producto actualizado correctamente."
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
              width: 2,
              height: 80,
              displayValue: true,
            }
          );
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isModalEtiquetaOpen, productoEtiqueta]);

  const productosFiltrados = productos.filter((producto) =>
    `${producto.linea} ${producto.codigo_barra} ${producto.descripcion}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

  // UI chips
  const Chip = ({
    label,
    value,
    active,
    onClick,
  }: {
    label: string;
    value: number | undefined;
    active?: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`btn d-flex align-items-center gap-2 ${
        active
          ? "btn-primary"
          : "btn-outline-secondary"
      }`}
      title={`Filtrar por ${label}`}
    >
      <span>{label}</span>
      <span className={`badge ${active ? "bg-light text-primary" : "bg-secondary text-white"}`}>
        {value ?? 0}
      </span>
    </button>
  );

  const productoBase = () => ({
    codigo_barra: "",
    descripcion: "",
    linea: "",
    tela: "",
    talle: "",
    color: "",
    costo: 0,
    precio_alquiler_lista: 0,
    precio_alquiler_efectivo: 0,
    precio_venta_nuevo_lista: 0,
    precio_venta_nuevo_efectivo: 0,
    precio_de_venta_medio_uso: 0,
    precio_venta: 0,
    precio_liquidacion: 0,
    stock: 0,
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

      {/* Chips de estados */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Chip
          label="Todos"
          value={total}
          active={!estadoFiltro}
          onClick={() => {
            setEstadoFiltro(undefined);
            setPage(1);
          }}
        />
        {ESTADOS.map((e) => (
          <Chip
            key={e}
            label={e}
            value={stats?.[e]}
            active={estadoFiltro === e}
            onClick={() => {
              setEstadoFiltro(e);
              setPage(1);
            }}
          />
        ))}
      </div>

      {/* Buscador */}
      <div className="row g-2 mb-4">
        <div className="col-12 col-md-6 col-lg-5 col-xl-4">
          <input
            type="search"
            className="form-control w-100"
            placeholder="Buscar por línea, código o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="col-12 col-md-3 col-lg-2">
          <select
            className="form-select"
            value={size}
            onChange={(e) => {
              setSize(parseInt(e.target.value));
              setPage(1);
            }}
            title="Tamaño de página"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / pág
              </option>
            ))}
          </select>
        </div>
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
                      <div className="mt-2 small">
                        {estadoFiltro ? `(Filtrado por estado: ${estadoFiltro})` : ""}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : productosFiltrados.length > 0 ? (
                productosFiltrados.map((producto) => (
                  <tr key={producto.id}>
                    <td className="fw-medium">{producto.codigo_barra}</td>
                    <td>{producto.descripcion}</td>
                    <td>{producto.linea}</td>
                    <td>{producto.talle}</td>
                    <td>{producto.color}</td>
                    <td>{producto.precio_alquiler_lista}</td>
                    <td>
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
                            loadStats();
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
                    <td>
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
          {estadoFiltro ? (
            <>
              {" "}
              en <b>{estadoFiltro}</b>
            </>
          ) : null}
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
            <DialogTitle>Etiqueta del Producto</DialogTitle>
          </DialogHeader>
          {productoEtiqueta && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold">Nombre del Producto:</p>
                <p>{productoEtiqueta.descripcion}</p>
              </div>
              <div>
                <p className="font-semibold">Código de Barra:</p>
                <p>{productoEtiqueta.codigo_barra}</p>
              </div>
              <div>
                <p className="font-semibold">Código de Barra:</p>
                <svg ref={barcodeRef} id="etiqueta-impresion"></svg>
              </div>
              <Button
                variant="secondary"
                onClick={() => imprimirEtiqueta(barcodeRef)}
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
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              codigo_barra: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-bold">Descripción</label>
                        <Input
                          className="form-control w-100"
                          value={productoActual?.descripcion || ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              descripcion: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Línea</label>
                        <Input
                          className="form-control w-100"
                          value={productoActual?.linea || ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              linea: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Talle</label>
                        <Input
                          className="form-control w-100"
                          value={productoActual?.talle || ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              talle: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Tela</label>
                        <Input
                          className="form-control w-100"
                          value={productoActual?.tela || ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              tela: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Color</label>
                        <Input
                          className="form-control w-100"
                          value={productoActual?.color || ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              color: e.target.value,
                            })
                          }
                        />
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
                      <div className="col-12 col-sm-6">
                        <label className="form-label fw-bold">Stock</label>
                        <Input
                          type="number"
                          className="form-control w-100"
                          value={Number.isFinite(productoActual?.stock as number) ? productoActual?.stock : ""}
                          onChange={(e) =>
                            setProductoActual({
                              ...productoActual!,
                              stock:
                                e.target.value === ""
                                  ? undefined
                                  : parseInt(e.target.value, 10),
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
                            {productoActual.linea || "N/A"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">Talle</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.talle || "N/A"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">Tela</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.tela || "N/A"}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">Color</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.color || "N/A"}
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
                          <label className="form-label fw-bold">Stock</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.stock || 0}
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label fw-bold">Stock Mínimo</label>
                          <div className="form-control bg-light border-0">
                            {productoActual.stock_minimo || 0}
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

// helper
function imprimirEtiqueta(
  barcodeRef: React.RefObject<SVGSVGElement | null>
) {
  const etiqueta = document.getElementById("etiqueta-impresion");
  const svg = (etiqueta ? etiqueta : barcodeRef.current) as HTMLElement | null;
  if (!svg) return;

  const ventana = window.open("", "_blank", "width=300,height=400");
  if (!ventana) return;

  const contenido = svg.cloneNode(true) as HTMLElement;
  const style = `
    <style>
      body { margin: 0; padding: 10px; font-family: sans-serif; text-align: center; }
      svg { display: block; margin: 0 auto; }
    </style>
  `;
  ventana.document.body.innerHTML = style;
  ventana.document.body.appendChild(contenido);

  setTimeout(() => {
    ventana.print();
    ventana.close();
  }, 300);
}
