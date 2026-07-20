"use client";

import React, { useEffect, useState } from "react";
import ReactPaginate from "react-paginate";
import { UserCog, Pencil, Trash2 } from "lucide-react";
import ClienteModal from "@/components/modales/clienteModal";
import { Input } from "@/components/ui/input";
import { getApiBaseUrl } from "@/lib/api-config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { scheduleUndoableDelete } from "@/lib/undoable-delete";
import { useFlushUndoableDeletesOnLeave } from "@/hooks/use-flush-undoable-deletes";

type Precliente = {
  id: string;
  nombre: string;
  apellido: string;
  celular: string;
};

export default function PreclientesPage() {
  const [preclientes, setPreclientes] = useState<Precliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [clienteActual, setClienteActual] = useState<Precliente | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [preclienteSeleccionado, setPreclienteSeleccionado] =
    useState<Precliente | null>(null);
  const [cargando, setCargando] = useState(true);

  useFlushUndoableDeletesOnLeave();
  // PAGINACIÓN: Estados nuevos
  const [currentPage, setCurrentPage] = useState(0);
  const clientesPorPagina = 18;
  const offset = currentPage * clientesPorPagina;
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [preclienteIdConvertir, setPreclienteIdConvertir] = useState<
    string | null
  >(null);
  const [formDataCliente, setFormDataCliente] = useState({
    nombre: "",
    apellido: "",
    celular: "",
    dni: "",
    direccion: "",
    fecha_nacimiento: "",
    notas: "",
  });

  const handlePageChange = (selectedItem: { selected: number }) => {
    setCurrentPage(selectedItem.selected);
  };

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    celular: "",
  });

  const [token, setToken] = useState<string | null>(null);
  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setToken(t);
    }
  }, []);

  useEffect(() => {
    if (token) {
      console.log("Token disponible, obteniendo clientes...");
      fetchClientes();
    }
  }, [token]);

  const fetchClientes = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/preclientes/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.error("Error al obtener clientes:", res.status);
        return;
      }

      const data = await res.json();
      console.log("Datos recibidos del servidor:", data);

      // Asegurarse de que cada cliente tenga un ID único
      const clientesConId = data.map((cliente: Precliente, index: number) => {
        // Si el cliente no tiene un ID, asignarle uno temporal basado en el índice
        if (!cliente.id) {
          return { ...cliente, id: `temp-id-${index}` };
        }
        return cliente;
      });
      setPreclientes(clientesConId);
    } catch (err) {
      console.error("Error al obtener clientes", err);
    } finally {
      setCargando(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const nuevoCliente = () => {
    setClienteActual(null);
    setFormData({
      nombre: "",
      apellido: "",
      celular: "",
    });
    setShowModal(true);
  };

  const editarCliente = (cliente: Precliente) => {
    setClienteActual(cliente);
    setFormData({
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      celular: cliente.celular,
    });
    setShowModal(true);
  };

  const confirmarEliminar = (cliente: Precliente) => {
    setClienteActual(cliente);
    setShowDeleteModal(true);
  };

  const eliminarCliente = () => {
    const cliente = clienteActual;
    if (!cliente) return;
    setShowDeleteModal(false);
    setClienteActual(null);
    const snapshot = cliente;
    scheduleUndoableDelete({
      id: `precliente-${snapshot.id}`,
      message: `Precliente «${snapshot.apellido}, ${snapshot.nombre}» eliminado`,
      description: "Podés deshacer durante 10 segundos",
      onOptimisticRemove: () => {
        setPreclientes((prev) => prev.filter((c) => c.id !== snapshot.id));
      },
      onRestore: () => {
        setPreclientes((prev) => {
          if (prev.some((c) => c.id === snapshot.id)) return prev;
          return [...prev, snapshot];
        });
      },
      executeDelete: async () => {
        const res = await fetch(
          `${API_BASE}/preclientes/delete/${snapshot.id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : data.message || "No se pudo eliminar el precliente."
          );
        }
        toast.success("Precliente eliminado");
      },
    });
  };
  const iniciarConversionPrecliente = (precliente: Precliente) => {
    setFormDataCliente({
      nombre: precliente.nombre,
      apellido: precliente.apellido,
      celular: precliente.celular,
      dni: "",
      direccion: "",
      fecha_nacimiento: "",
      notas: "",
    });
    setPreclienteIdConvertir(precliente.id || null);
    setShowClienteModal(true);
  };

  const guardarCliente = async () => {
    const metodo = clienteActual ? "PUT" : "POST";
    const url = clienteActual
      ? `${API_BASE}/preclientes/update/${clienteActual.id}`
      : `${API_BASE}/preclientes/register`;

    // Validar datos antes de enviar
    if (!formData.nombre || !formData.apellido || !formData.celular) {
      alert(
        "Por favor complete los campos obligatorios: Nombre, Apellido y Celular"
      );
      return;
    }

    // Asegurarse de que todos los campos sean strings
    const datosFormateados = {
      nombre: formData.nombre.trim(),
      apellido: formData.apellido.trim(),
      celular: formData.celular.trim(),
    };

    try {
      console.log("Enviando datos:", datosFormateados);

      const res = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(datosFormateados),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Error del servidor:", errorData);
        alert(
          `Error al guardar cliente: ${
            errorData.detail || "Revise los datos ingresados"
          }`
        );
        return;
      }

      const nuevoCliente = await res.json();

      if (clienteActual) {
        setPreclientes(
          preclientes.map((c) => (c.id === clienteActual.id ? nuevoCliente : c))
        );
      } else {
        setPreclientes([...preclientes, nuevoCliente]);
      }

      setShowModal(false);
      setClienteActual(null);
      fetchClientes(); // Recargar los clientes después de guardar para asegurar datos actualizados
    } catch (err) {
      console.error("Error al guardar cliente", err);
      alert("Error al guardar cliente. Por favor, intente nuevamente.");
    }
  };

  const clientesFiltrados = preclientes.filter((cliente) =>
    `${cliente.apellido} ${cliente.nombre}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

  const clientesPaginados = clientesFiltrados.slice(
    offset,
    offset + clientesPorPagina
  );
  const pageCount = Math.ceil(clientesFiltrados.length / clientesPorPagina);

  const guardarClienteDesdePrecliente = async () => {
    if (!preclienteIdConvertir) return;

    if (!formDataCliente.dni || !formDataCliente.direccion) {
      alert("DNI y Dirección son obligatorios para convertir a cliente");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/preclientes/convertir/${preclienteIdConvertir}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            dni: formDataCliente.dni.trim(),
            direccion: formDataCliente.direccion.trim(),
            fecha_nacimiento: formDataCliente.fecha_nacimiento?.trim() || null,
          }),
        }
      );

      const result = await res.json();
      console.log("Respuesta del servidor:", result);

      if (!res.ok || !result.success) {
        let errorMessage = result.detail || result.message || "No se pudo convertir el precliente";
        
        // Mensajes más específicos para diferentes tipos de error
        if (errorMessage.includes("celular")) {
          errorMessage = "Ya existe un cliente con el mismo celular. El precliente no puede ser convertido.";
        } else if (errorMessage.includes("DNI")) {
          errorMessage = "Ya existe un cliente con el mismo DNI. Por favor, use un DNI diferente.";
        }
        
        alert(`Error: ${errorMessage}`);
        return;
      }

      setShowClienteModal(false);
      setPreclienteIdConvertir(null);
      fetchClientes(); // 🔁 recarga preclientes
      alert("Precliente convertido exitosamente");
    } catch (err) {
      console.error("Error al convertir precliente", err);
      alert("Error inesperado al convertir precliente");
    }
  };

  return (
    <div className="container-fluid px-2 px-sm-3 px-md-4 py-3">
      <div className="gt-page-header d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="page-title mb-1">Preclientes</h1>
          <p className="text-muted mb-0">Gestión de preclientes de Guapo Trajes.</p>
        </div>
        <button className="btn btn-oxblood d-flex align-items-center gap-2" onClick={nuevoCliente}>
          <i className="bi bi-plus-lg"></i>
          Nuevo precliente
        </button>
      </div>

      <div className="row g-3 align-items-center mb-4">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="input-group gt-search">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <Input
              type="search"
              placeholder="Buscar preclientes..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

      {cargando ? (
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <Table className="align-middle mb-0 gt-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Apellido</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Celular</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesPaginados.length > 0 ? (
                  clientesPaginados.map((cliente, index) => (
                    <TableRow key={cliente.id || `cliente-${index}`} className="align-middle">
                      <TableCell className="fw-semibold">{cliente.apellido}</TableCell>
                      <TableCell>{cliente.nombre}</TableCell>
                      <TableCell className="text-nowrap">{cliente.celular}</TableCell>
                      <TableCell>
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            className="btn-action btn-action--ver"
                            onClick={() => iniciarConversionPrecliente(cliente)}
                            title="Convertir en cliente"
                          >
                            <UserCog size={16} strokeWidth={1.75} aria-hidden />
                          </button>
                          <button
                            className="btn-action btn-action--editar"
                            onClick={() => editarCliente(cliente)}
                            title="Editar"
                          >
                            <Pencil size={16} strokeWidth={1.75} aria-hidden />
                          </button>
                          <button
                            className="btn-action btn-action--borrar"
                            onClick={() => confirmarEliminar(cliente)}
                            title="Eliminar"
                          >
                            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted py-4">
                      No se encontraron preclientes
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="d-flex justify-content-center mt-3">
                <ReactPaginate
                  previousLabel={"←"}
                  nextLabel={"→"}
                  breakLabel={"..."}
                  pageCount={pageCount}
                  onPageChange={handlePageChange}
                  containerClassName={"pagination"}
                  pageClassName={"page-item"}
                  pageLinkClassName={"page-link"}
                  previousClassName={"page-item"}
                  previousLinkClassName={"page-link"}
                  nextClassName={"page-item"}
                  nextLinkClassName={"page-link"}
                  breakClassName={"page-item"}
                  breakLinkClassName={"page-link"}
                  activeClassName={"active"}
                  forcePage={currentPage}
                />
              </div>
          </div>
        </div>
      )}
      <br />

      <ClienteModal
        show={showClienteModal}
        formData={formDataCliente}
        onChange={(e) => {
          const { name, value } = e.target;
          setFormDataCliente((prev) => ({ ...prev, [name]: value }));
        }}
        onClose={() => setShowClienteModal(false)}
        onSave={guardarClienteDesdePrecliente}
        modoEdicion={false}
      />

      <Dialog open={showModal} onOpenChange={(open) => !open && setShowModal(false)}>
        <DialogContent className="w-full border-0" dialogClassName="modal-dialog-centered modal-lg" dialogStyle={{ maxWidth: "540px", width: "95%" }}>
          <DialogHeader className="border-bottom pb-3">
            <DialogTitle className="fw-semibold">
              {clienteActual ? "Editar precliente" : "Nuevo precliente"}
            </DialogTitle>
            <DialogDescription className="mb-0">
              Completá los datos básicos del precliente.
            </DialogDescription>
          </DialogHeader>

          <div className="modal-body px-3 px-md-4">
            <div className="card shadow-sm">
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-bold">Apellido</label>
                    <Input name="apellido" value={formData.apellido} onChange={handleChange} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">Nombre</label>
                    <Input name="nombre" value={formData.nombre} onChange={handleChange} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">Celular</label>
                    <Input name="celular" value={formData.celular} onChange={handleChange} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button className="btn btn-light border" onClick={() => setShowModal(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={guardarCliente}>
              Guardar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteModal} onOpenChange={(open) => !open && setShowDeleteModal(false)}>
        <DialogContent className="w-full border-0" dialogClassName="modal-dialog-centered" dialogStyle={{ maxWidth: "420px", width: "90%" }}>
          <DialogHeader className="border-bottom pb-2">
            <DialogTitle className="fw-semibold">Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <div className="modal-body px-3 px-md-4">
            <p className="mb-0">
              ¿Está seguro que desea eliminar a
              {" "}
              <strong>
                {clienteActual?.apellido} {clienteActual?.nombre}
              </strong>
              ? Esta acción no se puede deshacer.
            </p>
          </div>
          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <button className="btn btn-light border" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={eliminarCliente}>
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
