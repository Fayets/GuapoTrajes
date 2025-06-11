"use client";

import React, { useEffect, useState } from "react";
import ClientesPage from "../clientes/page";
import ReactPaginate from "react-paginate";
import ClienteModal from "@/components/modales/clienteModal";

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
  // PAGINACIÓN: Estados nuevos
  const [currentPage, setCurrentPage] = useState(0);
  const clientesPorPagina = 12;
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
      const res = await fetch("http://localhost:8000/preclientes/all", {
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

  const eliminarCliente = async () => {
    if (!clienteActual) return;
    try {
      await fetch(
        `http://localhost:8000/preclientes/delete/${clienteActual.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setPreclientes(preclientes.filter((c) => c.id !== clienteActual.id));
      setShowDeleteModal(false);
      setClienteActual(null);
    } catch (err) {
      console.error("Error al eliminar cliente", err);
    }
  };
  const iniciarConversionPrecliente = (precliente: Precliente) => {
    setFormDataCliente({
      nombre: precliente.nombre,
      apellido: precliente.apellido,
      celular: precliente.celular,
      dni: "",
      direccion: "",
      notas: "",
    });
    setPreclienteIdConvertir(precliente.id || null);
    setShowClienteModal(true);
  };

  const guardarCliente = async () => {
    const metodo = clienteActual ? "PUT" : "POST";
    const url = clienteActual
      ? `http://localhost:8000/preclientes/update/${clienteActual.id}`
      : `http://localhost:8000/preclientes/register`;

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
    `${cliente.nombre} ${cliente.apellido}`
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
      alert("DNI y Dirección son obligatorios");
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:8000/preclientes/convertir/${preclienteIdConvertir}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            dni: formDataCliente.dni.trim(),
            direccion: formDataCliente.direccion.trim(),
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        alert(`Error: ${error.detail || "No se pudo convertir el precliente"}`);
        return;
      }

      setShowClienteModal(false);
      setPreclienteIdConvertir(null);
      fetchClientes(); // 🔁 recarga preclientes
    } catch (err) {
      console.error("Error al convertir precliente", err);
      alert("Error inesperado");
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Preclientes</h1>
          <p className="text-muted">Gestión de clientes de Guapo Trajes</p>
        </div>
        <button className="btn btn-primary" onClick={nuevoCliente}>
          <i className="bi bi-plus me-2"></i>
          Nuevo Precliente
        </button>
      </div>

      <div className="mb-4">
        <div className="input-group">
          <span className="input-group-text">
            <i className="bi bi-search"></i>
          </span>
          <input
            type="search"
            className="form-control"
            placeholder="Buscar clientes..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>
      {cargando ? (
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Apellido</th>
                  <th>Celular</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientesPaginados.length > 0 ? (
                  clientesPaginados.map((cliente, index) => (
                    <tr key={cliente.id || `cliente-${index}`}>
                      <td className="fw-medium">{cliente.nombre}</td>
                      <td>{cliente.apellido}</td>
                      <td>{cliente.celular}</td>
                      <td>
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => iniciarConversionPrecliente(cliente)}
                            title="Convertir"
                          >
                            <i className="bi bi-person"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => editarCliente(cliente)}
                            title="Editar"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => confirmarEliminar(cliente)}
                            title="Eliminar"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No se encontraron clientes
                    </td>
                  </tr>
                )}
              </tbody>
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
            </table>
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

      {/* Modal para crear/editar cliente */}
      <div
        className={`modal fade ${showModal ? "show" : ""}`}
        style={{ display: showModal ? "block" : "none" }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {clienteActual ? "Editar Cliente" : "Nuevo Cliente"}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowModal(false)}
              ></button>
            </div>
            <div className="modal-body">
              <form>
                <div className="mb-3">
                  <label htmlFor="nombre" className="form-label">
                    Nombre
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="apellido" className="form-label">
                    Apellido
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="apellido"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label htmlFor="celular" className="form-label">
                    Celular
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="celular"
                    name="celular"
                    value={formData.celular}
                    onChange={handleChange}
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={guardarCliente}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className={`modal-backdrop fade ${showModal ? "show" : ""}`}
        style={{ display: showModal ? "block" : "none" }}
      ></div>

      {/* Modal para confirmar eliminación */}
      <div
        className={`modal fade ${showDeleteModal ? "show" : ""}`}
        style={{ display: showDeleteModal ? "block" : "none" }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Confirmar eliminación</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowDeleteModal(false)}
              ></button>
            </div>
            <div className="modal-body">
              <p>
                ¿Está seguro que desea eliminar al cliente{" "}
                {clienteActual?.nombre} {clienteActual?.apellido}? Esta acción
                no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={eliminarCliente}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className={`modal-backdrop fade ${showDeleteModal ? "show" : ""}`}
        style={{ display: showDeleteModal ? "block" : "none" }}
      ></div>
    </div>
  );
}
