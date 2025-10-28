"use client";
import { useEffect, useState, useRef } from "react";
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
  const [isModalOpen, setIsModalOpen] = useState(false);
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
        } else {
          console.error("Formato de datos inesperado:", data);
          setProductos([]);
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

      setIsModalOpen(false);
      toast.success(
        isEditing
          ? "Producto actualizado correctamente"
          : "Producto creado correctamente"
      );
      // recargar la página actual para coherencia con paginación
      loadProductos();
      // refrescar stats
      fetch(`${API_URL}/stats/estado`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => setStats(d || {}))
        .catch(() => {});
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

      // refrescar stats
      fetch(`${API_URL}/stats/estado`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => setStats(d || {}))
        .catch(() => {});
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
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm ${
        active ? "bg-black text-white" : "bg-white"
      }`}
      title={`Filtrar por ${label}`}
    >
      <span>{label}</span>
      <span className="inline-flex items-center justify-center min-w-6 h-6 rounded-full border px-2 text-xs">
        {value ?? 0}
      </span>
    </button>
  );

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
            Nuevo Producto
          </Button>
        </RoleGate>
      </div>

      {/* Chips de estados */}
      <div className="flex flex-wrap gap-2">
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
      <div className="mb-2">
        <div className="input-group flex gap-2">
          <input
            type="search"
            className="form-control flex-1 border rounded px-3 py-2"
            placeholder="Buscar por línea, código o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <select
            className="border rounded px-2 py-2"
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
          <table className="table table-hover mb-0 w-full">
            <thead>
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
                          const nuevoEstado = e.target.value;
                          const payload = { estado: nuevoEstado };
                          try {
                            const response = await fetch(
                              `${API_URL}/update/${producto.id}`,
                              {
                                method: "PUT",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify(payload),
                              }
                            );
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
                      <div className="flex gap-2">
                        <Button
                          className="btn btn-sm btn-outline-info bg-white"
                          title="Ver"
                          onClick={() => {
                            setProductoEtiqueta(null);
                            setProductoActual(producto);
                            // abrimos el modal de ver detalle abajo
                            (
                              document.getElementById(
                                "btn-ver-detalle"
                              ) as HTMLButtonElement
                            )?.click();
                          }}
                        >
                          <i className="bi bi-eye"></i>
                        </Button>
                        <Button
                          onClick={() => generarEtiqueta(producto)}
                          title="Etiquetado"
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
                            }}
                            title="Editar"
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button
                            className="btn btn-sm btn-outline-danger bg-white"
                            variant="warning"
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
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-gray-500">
          Mostrando <b>{productos.length}</b> de <b>{total}</b> resultados
          {estadoFiltro ? (
            <>
              {" "}
              en <b>{estadoFiltro}</b>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
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
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {productoActual?.id ? "Editar Producto" : "Agregar Producto"}
            </DialogTitle>
          </DialogHeader>

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
            >
              Cancelar
            </Button>
            <Button className="btn btn-primary" onClick={guardarProducto}>
              {productoActual?.id ? "Actualizar" : "Guardar"}
            </Button>
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
            <Button onClick={() => setIsModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// helper
function imprimirEtiqueta(barcodeRef: React.RefObject<SVGSVGElement>) {
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
