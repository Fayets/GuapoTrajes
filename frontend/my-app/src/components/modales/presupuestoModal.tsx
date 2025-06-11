import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Cliente = { id: number; nombre: string; apellido: string };
type Producto = {
  id: number;
  descripcion: string;
  codigo_barra: string;
  precio_alquiler_efectivo: number;
};
type Item = {
  id?: number;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  subtotal: number;
};

type Props = {
  show: boolean;
  verModoLectura: boolean;
  presupuestoSeleccionado?: any;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  clientes: Cliente[];
  clienteFiltro: string;
  setClienteFiltro: (value: string) => void;
  handleClienteChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  productos: Producto[];
  productoFiltro: string;
  setProductoFiltro: (value: string) => void;
  nuevoItem: { productoId: string; cantidad: number };
  handleItemChange: (campo: string, valor: any) => void;
  verificarDisponibilidad: () => Promise<boolean>;
  agregarItem: () => void;
  eliminarItem: (id: number) => void;
  items: Item[];
  calcularTotal: () => number;
  guardarPresupuesto: () => void;
  onClose: () => void;
};

export default function PresupuestoModal({
  show,
  verModoLectura,
  presupuestoSeleccionado,
  formData,
  setFormData,
  clientes,
  clienteFiltro,
  setClienteFiltro,
  handleClienteChange,
  productos,
  productoFiltro,
  setProductoFiltro,
  nuevoItem,
  handleItemChange,
  verificarDisponibilidad,
  agregarItem,
  eliminarItem,
  items,
  calcularTotal,
  guardarPresupuesto,
  onClose,
}: Props) {
  {
    console.log(items);
  }

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="modal-dialog modal-lg">
        <DialogHeader>
          <DialogTitle>
            {verModoLectura ? "Ver Presupuesto" : "Nuevo Presupuesto"}
          </DialogTitle>
          <DialogDescription>
            {verModoLectura
              ? "Visualización de presupuesto existente"
              : "Completá los datos del evento y seleccioná los productos"}
          </DialogDescription>
        </DialogHeader>

        {/* Cliente */}
        <div className="mb-3">
          <label className="form-label">Cliente</label>
          {verModoLectura ? (
            <div className="form-control-plaintext">
              {presupuestoSeleccionado?.cliente_nombre || "No disponible"}
            </div>
          ) : (
            <>
              <input
                type="text"
                className="form-control mb-2"
                placeholder="Buscar por nombre o apellido"
                value={clienteFiltro}
                onChange={(e) => setClienteFiltro(e.target.value)}
              />
              <select
                className="form-select"
                value={formData.clienteId}
                onChange={handleClienteChange}
              >
                <option value="">Seleccionar cliente</option>
                {clientes
                  .filter((c) =>
                    `${c.nombre} ${c.apellido}`
                      .toLowerCase()
                      .includes(clienteFiltro.toLowerCase())
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.apellido}
                    </option>
                  ))}
              </select>
            </>
          )}
        </div>

        {/* Fechas */}
        <div className="row g-2">
          {[
            { label: "Fecha del evento", key: "fechaEvento" },
            { label: "Fecha de retiro", key: "fechaRetiro" },
            { label: "Fecha de devolución", key: "fechaDevolucion" },
          ].map(({ label, key }) => (
            <div className="col-md-4" key={key}>
              <label className="form-label">{label}</label>
              {verModoLectura ? (
                <div className="form-control-plaintext">{formData[key]}</div>
              ) : (
                <input
                  type="date"
                  className="form-control"
                  value={formData[key]}
                  onChange={(e) =>
                    setFormData((prev: any) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                />
              )}
            </div>
          ))}
        </div>

        {/* Categoría + Agasajado */}
        <div className="row mt-3 g-2">
          <div className="col-md-6">
            <label className="form-label">Categoría</label>
            {verModoLectura ? (
              <div className="form-control-plaintext">{formData.categoria}</div>
            ) : (
              <select
                className="form-select"
                value={formData.categoria}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    categoria: e.target.value,
                  }))
                }
              >
                <option value="">Seleccionar</option>
                <option value="casamiento">Casamiento</option>
                <option value="15">Fiesta de 15</option>
                <option value="cumpleaños">Cumpleaños</option>
                <option value="egreso">Egreso</option>
              </select>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label">Nombre del agasajado</label>
            {verModoLectura ? (
              <div className="form-control-plaintext">{formData.agasajado}</div>
            ) : (
              <input
                type="text"
                className="form-control"
                value={formData.agasajado}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    agasajado: e.target.value,
                  }))
                }
              />
            )}
          </div>
        </div>

        {/* Lugar y Observaciones */}
        <div className="mt-3">
          <label className="form-label">Lugar del evento</label>
          {verModoLectura ? (
            <div className="form-control-plaintext">{formData.lugar}</div>
          ) : (
            <input
              type="text"
              className="form-control"
              value={formData.lugar}
              onChange={(e) =>
                setFormData((prev: any) => ({ ...prev, lugar: e.target.value }))
              }
            />
          )}
        </div>
        <div className="mt-3">
          <label className="form-label">Observaciones</label>
          {verModoLectura ? (
            <div className="form-control-plaintext">
              {formData.observaciones}
            </div>
          ) : (
            <textarea
              className="form-control"
              value={formData.observaciones}
              onChange={(e) =>
                setFormData((prev: any) => ({
                  ...prev,
                  observaciones: e.target.value,
                }))
              }
            />
          )}
        </div>

        {/* Productos */}
        <div className="mt-4">
          <h5>Productos</h5>
          {verModoLectura ? (
            <ul className="list-group mt-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="list-group-item d-flex justify-content-between"
                >
                  {item.productoNombre} x{item.cantidad}
                  <span>${item.subtotal}</span>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div className="row align-items-end g-2 mb-2">
                <div className="col-md-4">
                  <label className="form-label">Buscar producto</label>
                  <input
                    type="text"
                    className="form-control"
                    value={productoFiltro}
                    onChange={(e) => setProductoFiltro(e.target.value)}
                    placeholder="Buscar por código o descripción"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Producto</label>
                  <select
                    className="form-select"
                    value={nuevoItem.productoId}
                    onChange={(e) =>
                      handleItemChange("productoId", e.target.value)
                    }
                  >
                    <option value="">Seleccionar producto</option>
                    {productos
                      .filter((p) =>
                        `${p.descripcion}${p.codigo_barra}`
                          .toLowerCase()
                          .includes(productoFiltro.toLowerCase())
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.descripcion} ({p.codigo_barra}) - $
                          {p.precio_alquiler_efectivo.toLocaleString()}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">Cantidad</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    value={nuevoItem.cantidad}
                    onChange={(e) =>
                      handleItemChange("cantidad", parseInt(e.target.value))
                    }
                  />
                </div>
                <div className="col-md-2">
                  <button
                    onClick={async () => {
                      const disponible = await verificarDisponibilidad();
                      if (!disponible) {
                        alert(
                          "El producto no está disponible en las fechas seleccionadas."
                        );
                        return;
                      }
                      agregarItem();
                    }}
                    className="btn btn-success w-100"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              <ul className="list-group">
                {items.map((item) => (
                  <li
                    key={item.productoId}
                    className="list-group-item d-flex justify-content-between"
                  >
                    {item.productoNombre} x{item.cantidad}
                    <div>
                      ${item.subtotal}
                      <button
                        className="btn btn-sm btn-outline-danger ms-2"
                        onClick={() => eliminarItem(item.productoId)}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="d-flex justify-content-end mt-3">
                <strong>Total: ${calcularTotal()}</strong>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4 d-flex justify-content-end gap-2">
          <button className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          {!verModoLectura && (
            <button className="btn btn-primary" onClick={guardarPresupuesto}>
              Guardar
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
