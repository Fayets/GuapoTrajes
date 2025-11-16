"use client";
<<<<<<< HEAD
import { useEffect, useState, useRef, useCallback } from "react";
=======
import { useEffect, useState, useRef } from "react";
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
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
<<<<<<< HEAD
  const [isFormularioOpen, setIsFormularioOpen] = useState(false);
  const [isDetalleOpen, setIsDetalleOpen] = useState(false);
=======
  const [isModalOpen, setIsModalOpen] = useState(false);
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
  const [productoEtiqueta, setProductoEtiqueta] = useState<Producto | null>(
    null
  );
  const [isModalEtiquetaOpen, setIsModalEtiquetaOpen] = useState(false);
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

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

  const API_URL = "http://127.0.0.1:8000/productos"; // :contentReference[oaicite:3]{index=3}

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) setToken(t);
  }, []);

  // Carga de stats (chips)
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/stats/estado`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then((r) => r.json())
      .then((data) => setStats(data || {}))
      .catch(() => setStats({}));
  }, [token]);

<<<<<<< HEAD
  const computeStats = useCallback((items: Producto[]) => {
    const statsLocales: Record<string, number> = { Todos: items.length } as any;
    ESTADOS.forEach((estado) => {
      statsLocales[estado] = items.filter((p) => p.estado === estado).length;
    });
    setStats(statsLocales);
  }, []);

=======
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
  // Carga de productos con paginación y filtro remoto
  const loadProductos = () => {
    if (!token) return;
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(size));
    if (estadoFiltro) params.set("estado", estadoFiltro);

    fetch(`${API_URL}/all?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("No autorizado o error en el servidor");
        const xTotal = res.headers.get("X-Total-Count");
        const body = await res.json();
        setTotal(Number(xTotal ?? body?.length ?? 0));
        return body;
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setProductos(data);
<<<<<<< HEAD
          computeStats(data);
        } else {
          console.error("Formato de datos inesperado:", data);
          setProductos([]);
          computeStats([]);
=======
        } else {
          console.error("Formato de datos inesperado:", data);
          setProductos([]);
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
        }
      })
      .catch((error) => {
        console.error("Error al obtener productos:", error.message);
        setProductos([]);
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

<<<<<<< HEAD
      setIsFormularioOpen(false);
=======
      setIsModalOpen(false);
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
      toast.success(
        isEditing
          ? "Producto actualizado correctamente"
          : "Producto creado correctamente"
      );
      // recargar la página actual para coherencia con paginación
      loadProductos();
<<<<<<< HEAD
=======
      // refrescar stats
      fetch(`${API_URL}/stats/estado`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => setStats(d || {}))
        .catch(() => {});
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
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

<<<<<<< HEAD
=======
      // refrescar stats
      fetch(`${API_URL}/stats/estado`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => setStats(d || {}))
        .catch(() => {});
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
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
<<<<<<< HEAD
      className={`inline-flex align-items-center gap-2 px-4 py-2 rounded-pill border text-sm transition-all ${
        active
          ? "bg-dark text-white border-dark"
          : "bg-white text-secondary border-secondary"
=======
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm ${
        active ? "bg-black text-white" : "bg-white"
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
      }`}
      title={`Filtrar por ${label}`}
    >
      <span>{label}</span>
<<<<<<< HEAD
      <span className="badge rounded-pill bg-light text-dark border border-secondary px-2">
=======
      <span className="inline-flex items-center justify-center min-w-6 h-6 rounded-full border px-2 text-xs">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
        {value ?? 0}
      </span>
    </button>
  );

<<<<<<< HEAD
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
=======
  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-bold text-2xl">Productos</h1>
          <p className="text-muted-foreground">
            Gestión de productos de Guapo Trajes
          </p>
        </div>
        <RoleGate allow={["ADMIN"]}>
          <Button
            onClick={() => {
              setProductoActual({
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
              setIsModalOpen(true);
            }}
          >
            <i className="bi bi-plus me-2"></i>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
            Nuevo Producto
          </Button>
        </RoleGate>
      </div>

      {/* Chips de estados */}
<<<<<<< HEAD
      <div className="d-flex flex-wrap gap-2 mb-3">
=======
      <div className="flex flex-wrap gap-2">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
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
<<<<<<< HEAD
      <div className="row g-2 mb-4">
        <div className="col-12 col-md-6 col-lg-5 col-xl-4">
          <input
            type="search"
            className="form-control w-100"
=======
      <div className="mb-2">
        <div className="input-group flex gap-2">
          <input
            type="search"
            className="form-control flex-1 border rounded px-3 py-2"
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
            placeholder="Buscar por línea, código o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
<<<<<<< HEAD
        </div>
        <div className="col-12 col-md-3 col-lg-2">
          <select
            className="form-select"
=======
          <select
            className="border rounded px-2 py-2"
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
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
<<<<<<< HEAD
          <table className="table table-striped table-hover align-middle mb-0">
            <thead className="table-light">
=======
          <table className="table table-hover mb-0 w-full">
            <thead>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
              <tr>
                <th>Código de Barra</th>
                <th>Descripción</th>
                <th>Línea</th>
                <th>Talle</th>
                <th>Color</th>
                <th>Precio Alq. Lista</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Fecha Alta</th>
                <th>Inmovilizado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length > 0 ? (
                productosFiltrados.map((producto) => (
                  <tr key={producto.id}>
                    <td className="fw-medium">{producto.codigo_barra}</td>
                    <td>{producto.descripcion}</td>
                    <td>{producto.linea}</td>
                    <td>{producto.talle}</td>
                    <td>{producto.color}</td>
                    <td>{producto.precio_alquiler_lista}</td>
                    <td>{producto.stock}</td>
                    <td>
                      <select
                        value={producto.estado}
                        onChange={async (e) => {
<<<<<<< HEAD
                          if (!token) return;
                          const nuevoEstado = e.target.value;
                          const estadoAnterior = producto.estado;
                          const payload = { estado: nuevoEstado };
                          try {
                            const response = await fetch(
                              `${API_URL}/estado/${producto.id}`,
                              {
                                method: "PATCH",
=======
                          const nuevoEstado = e.target.value;
                          const payload = { estado: nuevoEstado };
                          try {
                            const response = await fetch(
                              `${API_URL}/update/${producto.id}`,
                              {
                                method: "PUT",
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify(payload),
                              }
                            );
<<<<<<< HEAD
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
=======
                            const result = await response.json();
                            if (!response.ok || result.success === false) {
                              throw new Error(
                                result.message ||
                                  "Error al actualizar el estado."
                              );
                            }
                            toast.success("Estado actualizado correctamente");
                            loadProductos();
                            // refrescar chips
                            fetch(`${API_URL}/stats/estado`, {
                              headers: { Authorization: `Bearer ${token}` },
                            })
                              .then((r) => r.json())
                              .then((d) => setStats(d || {}))
                              .catch(() => {});
                          } catch (error) {
                            console.error(error);
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                          }
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{producto.fecha_alta}</td>
                    <td>{producto.inmovilizado ? "Sí" : "No"}</td>
                    <td>
<<<<<<< HEAD
                      <div className="d-flex flex-wrap gap-2">
                        <Button
                          className="btn btn-sm btn-light border"
=======
                      <div className="flex gap-2">
                        <Button
                          className="btn btn-sm btn-outline-info bg-white"
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                          title="Ver"
                          onClick={() => {
                            setProductoEtiqueta(null);
                            setProductoActual(producto);
<<<<<<< HEAD
                            setIsDetalleOpen(true);
                          }}
                        >
                          <i className="bi bi-eye text-dark"></i>
=======
                            // abrimos el modal de ver detalle abajo
                            (
                              document.getElementById(
                                "btn-ver-detalle"
                              ) as HTMLButtonElement
                            )?.click();
                          }}
                        >
                          <i className="bi bi-eye"></i>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                        </Button>
                        <Button
                          onClick={() => generarEtiqueta(producto)}
                          title="Etiquetado"
<<<<<<< HEAD
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
=======
                          className="btn btn-sm btn-outline-secondary bg-white"
                        >
                          <i className="bi bi-code"></i>
                        </Button>
                        <RoleGate allow={["ADMIN"]}>
                          <Button
                            className="btn btn-sm btn-outline-secondary bg-white"
                            onClick={() => {
                              setProductoActual(producto);
                              setIsModalOpen(true);
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
                            }}
                            title="Editar"
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button
<<<<<<< HEAD
                            className="btn btn-sm btn-danger text-white"
=======
                            className="btn btn-sm btn-outline-danger bg-white"
                            variant="warning"
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
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
                  <td colSpan={11} className="text-center">
                    No se encontraron productos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
<<<<<<< HEAD
      <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 mt-4">
        <div className="text-muted small text-center text-md-start">
=======
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-gray-500">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
          Mostrando <b>{productos.length}</b> de <b>{total}</b> resultados
          {estadoFiltro ? (
            <>
              {" "}
              en <b>{estadoFiltro}</b>
            </>
          ) : null}
        </div>
<<<<<<< HEAD
        <div className="d-flex align-items-center gap-2">
=======
        <div className="flex items-center gap-2">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
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
<<<<<<< HEAD
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
=======
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
            <DialogTitle>
              {productoActual?.id ? "Editar Producto" : "Agregar Producto"}
            </DialogTitle>
          </DialogHeader>

<<<<<<< HEAD
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
=======
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label>Código de Barra</label>
              <Input
                value={productoActual?.codigo_barra || ""}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    codigo_barra: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label>Descripción</label>
              <Input
                value={productoActual?.descripcion || ""}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    descripcion: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label>Línea</label>
              <Input
                value={productoActual?.linea || ""}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    linea: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label>Talle</label>
              <Input
                value={productoActual?.talle || ""}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    talle: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label>Tela</label>
              <Input
                value={productoActual?.tela || ""}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    tela: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label>Color</label>
              <Input
                value={productoActual?.color || ""}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    color: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label>Costo</label>
              <Input
                type="number"
                value={productoActual?.costo ?? 0}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    costo: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label>Precio Alquiler Lista</label>
              <Input
                type="number"
                value={productoActual?.precio_alquiler_lista ?? 0}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    precio_alquiler_lista: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label>Precio Alquiler Efectivo</label>
              <Input
                type="number"
                value={productoActual?.precio_alquiler_efectivo ?? 0}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    precio_alquiler_efectivo: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label>Precio Venta Nuevo Lista</label>
              <Input
                type="number"
                value={productoActual?.precio_venta_nuevo_lista ?? 0}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    precio_venta_nuevo_lista: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label>Precio Venta Nuevo Efectivo</label>
              <Input
                type="number"
                value={productoActual?.precio_venta_nuevo_efectivo ?? 0}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    precio_venta_nuevo_efectivo: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label>Precio Medio Uso</label>
              <Input
                type="number"
                value={productoActual?.precio_de_venta_medio_uso ?? 0}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    precio_de_venta_medio_uso: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label>Precio Venta</label>
              <Input
                type="number"
                value={productoActual?.precio_venta ?? 0}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    precio_venta: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label>Precio Liquidación</label>
              <Input
                type="number"
                value={productoActual?.precio_liquidacion ?? 0}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    precio_liquidacion: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label>Stock</label>
              <Input
                type="number"
                value={productoActual?.stock ?? 0}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    stock: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label>Estado</label>
              <select
                className="border rounded px-2 py-2 w-full"
                value={productoActual?.estado || ""}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    estado: e.target.value,
                  })
                }
              >
                <option value="">Seleccione un estado</option>
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Fecha Alta</label>
              <Input
                type="date"
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
            <div>
              <label>¿Inmovilizado?</label>
              <input
                type="checkbox"
                checked={productoActual?.inmovilizado || false}
                onChange={(e) =>
                  setProductoActual({
                    ...productoActual!,
                    inmovilizado: e.target.checked,
                  })
                }
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
            >
              Cancelar
            </Button>
            <Button className="btn btn-primary" onClick={guardarProducto}>
              {productoActual?.id ? "Actualizar" : "Guardar"}
            </Button>
<<<<<<< HEAD
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal ver detalle */}
      <Dialog open={isDetalleOpen} onOpenChange={setIsDetalleOpen}>
        <DialogContent className="w-full max-w-3xl">
=======
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal ver detalle (reutilizo Dialog launcher oculto) */}
      <button
        id="btn-ver-detalle"
        className="hidden"
        onClick={() => setIsModalOpen(true)}
      />
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl">
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
          <DialogHeader>
            <DialogTitle>Detalle del Producto</DialogTitle>
          </DialogHeader>

          {productoActual && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
              {[
                ["Código de Barra", productoActual.codigo_barra],
                ["Descripción", productoActual.descripcion],
                ["Línea", productoActual.linea],
                ["Talle", productoActual.talle],
                ["Tela", productoActual.tela],
                ["Color", productoActual.color],
                ["Costo", `$${productoActual.costo}`],
                [
                  "Precio Alq. Lista",
                  `$${productoActual.precio_alquiler_lista}`,
                ],
                [
                  "Precio Alq. Efectivo",
                  `$${productoActual.precio_alquiler_efectivo}`,
                ],
                [
                  "Precio Venta Nuevo Lista",
                  `$${productoActual.precio_venta_nuevo_lista}`,
                ],
                [
                  "Precio Venta Nuevo Efectivo",
                  `$${productoActual.precio_venta_nuevo_efectivo}`,
                ],
                [
                  "Precio Medio Uso",
                  `$${productoActual.precio_de_venta_medio_uso}`,
                ],
                ["Precio Venta", `$${productoActual.precio_venta}`],
                ["Precio Liquidación", `$${productoActual.precio_liquidacion}`],
                ["Stock", String(productoActual.stock)],
                ["Estado", productoActual.estado],
                ["Fecha Alta", productoActual.fecha_alta],
                ["¿Inmovilizado?", productoActual.inmovilizado ? "Sí" : "No"],
              ].map(([label, value]) => (
                <div key={label} className="bg-muted border rounded p-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {label}
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="mt-6">
<<<<<<< HEAD
            <Button onClick={() => setIsDetalleOpen(false)}>Cerrar</Button>
=======
            <Button onClick={() => setIsModalOpen(false)}>Cerrar</Button>
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// helper
<<<<<<< HEAD
function imprimirEtiqueta(
  barcodeRef: React.RefObject<SVGSVGElement | null>
) {
=======
function imprimirEtiqueta(barcodeRef: React.RefObject<SVGSVGElement>) {
>>>>>>> 318d0fdc263c511777b700c984c840d345f502b8
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
