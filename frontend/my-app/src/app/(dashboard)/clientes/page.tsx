"use client"

import React, { useEffect, useState } from "react"
import ReactPaginate from 'react-paginate'
import ClienteModal from "@/components/clienteModal"

type Cliente = {
  id: string
  nombre: string
  apellido: string
  dni: string
  direccion: string
  celular: string
  notas: string
}

type Precliente = {
  nombre: string
  apellido: string
  celular: string
  
}


export default function ClientesPage({
  preclienteSeleccionado,
  onConversionCompleta
    }: {
    preclienteSeleccionado?: Precliente
    onConversionCompleta?: () => void
  })
 {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [clienteActual, setClienteActual] = useState<Cliente | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [preclienteSeleccionadoId, setPreclienteSeleccionadoId] = useState<string | null>(null)


  // PAGINACIÓN: Estados nuevos
  const [currentPage, setCurrentPage] = useState(0)
  const clientesPorPagina = 12
  const offset = currentPage * clientesPorPagina

  const handlePageChange = (selectedItem: { selected: number }) => {
    setCurrentPage(selectedItem.selected)
  }

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    direccion: "",
    celular: "",
    notas: "",
  })

  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (t) {
      setToken(t)
    }
  }, [])

  const convertirPreclienteACliente = (precliente: Precliente & { id?: string }) => {
        setClienteActual(null); // Queremos registrar un nuevo cliente
        setFormData({
          nombre: precliente.nombre,
          apellido: precliente.apellido,
          dni: "",
          direccion: "",
          celular: precliente.celular,
          notas: "",
        });
        if (precliente.id) {
          setPreclienteSeleccionadoId(precliente.id)
        }
        setShowModal(true)
      };
      
  useEffect(() => {
    if (preclienteSeleccionado) {
      convertirPreclienteACliente(preclienteSeleccionado);
    }
  }, [preclienteSeleccionado]);

  useEffect(() => {
    if (token) {
      console.log("Token disponible, obteniendo clientes...");
      fetchClientes();
    }
  }, [token])

  const fetchClientes = async () => {
    setCargando(true)
    try {
      const res = await fetch("http://localhost:8000/clientes/all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      if (!res.ok) {
        console.error("Error al obtener clientes:", res.status);
        return;
      }
      
      const data = await res.json()
      console.log("Datos recibidos del servidor:", data);
      
      // Asegurarse de que cada cliente tenga un ID único
      const clientesConId = data.map((cliente: Cliente, index: number) => {
        // Si el cliente no tiene un ID, asignarle uno temporal basado en el índice
        if (!cliente.id) {
          return { ...cliente, id: `temp-id-${index}` };
        }
        return cliente;
      });
      setClientes(clientesConId)
    } catch (err) {
      console.error("Error al obtener clientes", err)
    } finally {
    setCargando(false)
  }
    
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const nuevoCliente = () => {
    setClienteActual(null)
    setFormData({
      nombre: "",
      apellido: "",
      dni: "",
      direccion: "",
      celular: "",
      notas: "",
    })
    setShowModal(true)
  }

  const editarCliente = (cliente: Cliente) => {
    setClienteActual(cliente)
    setFormData({
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      dni: cliente.dni,
      direccion: cliente.direccion,
      celular: cliente.celular,
      notas: cliente.notas,
    })
    setShowModal(true)
  }

  const confirmarEliminar = (cliente: Cliente) => {
    setClienteActual(cliente)
    setShowDeleteModal(true)
  }

  const eliminarCliente = async () => {
    if (!clienteActual) return
    try {
      await fetch(`http://localhost:8000/clientes/delete/${clienteActual.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setClientes(clientes.filter((c) => c.id !== clienteActual.id))
      setShowDeleteModal(false)
      setClienteActual(null)
    } catch (err) {
      console.error("Error al eliminar cliente", err)
    }
  }

  const guardarCliente = async () => {
  if (!formData.nombre || !formData.apellido || !formData.dni) {
    alert("Por favor complete los campos obligatorios: Nombre, Apellido y DNI")
    return
  }

  const datosFormateados = {
    nombre: formData.nombre.trim(),
    apellido: formData.apellido.trim(),
    dni: formData.dni.trim(),
    direccion: formData.direccion.trim(),
    celular: formData.celular.trim(),
    notas: formData.notas.trim(),
  }

  try {
    console.log("Enviando datos:", datosFormateados)

    let url = ""
    let metodo = "POST"
    let body: string = "" 

    if (clienteActual) {
      // Edición de cliente ya existente
      url = `http://localhost:8000/clientes/update/${clienteActual.id}`
      metodo = "PUT"
      body = JSON.stringify(datosFormateados)
    } else if (preclienteSeleccionadoId) {
      // Conversión de precliente a cliente
      url = `http://localhost:8000/preclientes/convertir/${preclienteSeleccionadoId}`
      metodo = "POST"
      body = JSON.stringify({
        direccion: datosFormateados.direccion,
        dni: datosFormateados.dni
      })
    } else {
      // Alta normal de cliente
      url = `http://localhost:8000/clientes/register`
      metodo = "POST"
      body = JSON.stringify(datosFormateados)
    }

    const res = await fetch(url, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
    })

    if (!res.ok) {
      const errorData = await res.json()
      console.error("Error del servidor:", errorData)
      alert(`Error al guardar cliente: ${errorData.detail || 'Revise los datos ingresados'}`)
      return
    }

    const nuevoCliente = await res.json()
    setClientes([...clientes, nuevoCliente.data || nuevoCliente]) // según la estructura devuelta
    setShowModal(false)
    setClienteActual(null)
    setPreclienteSeleccionadoId(null)
    fetchClientes()
    if (onConversionCompleta) {
      onConversionCompleta()
    }
  } catch (err) {
    console.error("Error al guardar cliente", err)
    alert("Error al guardar cliente. Por favor, intente nuevamente.")
    }
  }


  const clientesFiltrados = clientes.filter((cliente) =>
    `${cliente.nombre} ${cliente.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
  )
  const clientesPaginados = clientesFiltrados.slice(offset, offset + clientesPorPagina)
  const pageCount = Math.ceil(clientesFiltrados.length / clientesPorPagina)

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold">Clientes</h1>
          <p className="text-muted">Gestión de clientes de Guapo Trajes</p>
        </div>
        <button className="btn btn-primary" onClick={nuevoCliente}>
          <i className="bi bi-plus me-2"></i>
          Nuevo Cliente
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
                  <th>DNI</th>
                  <th>Dirección</th>
                  <th>Celular</th>
                  <th>Notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientesPaginados.length > 0 ?  (
                  clientesPaginados.map((cliente, index) => (
                    <tr key={cliente.id || `cliente-${index}`}>
                      <td className="fw-medium">{cliente.nombre}</td>
                      <td>{cliente.apellido}</td>
                      <td>{cliente.celular}</td>
                      <td>{cliente.direccion}</td>
                      <td>{cliente.celular}</td>
                      <td>{cliente.notas}</td>
                      <td>
                        <div className="btn-group">
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
          
      </div> )}

      {/* Modal para crear/editar cliente */}
      <ClienteModal
        show={showModal}
        formData={formData}
        onChange={handleChange}
        onClose={() => setShowModal(false)}
        onSave={guardarCliente}
        modoEdicion={!!clienteActual}
      />


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
              <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
            </div>
            <div className="modal-body">
              <p>
                ¿Está seguro que desea eliminar al cliente {clienteActual?.nombre} {clienteActual?.apellido}? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={eliminarCliente}>
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
  )
}