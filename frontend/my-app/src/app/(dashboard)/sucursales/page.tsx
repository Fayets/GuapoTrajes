// Componente de gestión de sucursales (frontend React)
"use client"
import { useEffect, useState } from "react"
import ReactPaginate from "react-paginate"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { getApiBaseUrl } from "@/lib/api-config"
import { useAuth } from "@/context/auth-context"

interface Sucursal {
  id: number
  nombre: string
  direccion: string
  provincia: string
}

export default function SucursalesPage() {
  const { isSuperAdmin } = useAuth()
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalActual, setSucursalActual] = useState<Partial<Sucursal> | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [paginaActual, setPaginaActual] = useState(0)
  const SUCURSALES_POR_PAGINA = 18
  
  // Solo SUPER_ADMIN puede administrar sucursales (crear, editar y eliminar)
  const canManageSucursales = isSuperAdmin

  const API_BASE = getApiBaseUrl()
  const API_URL = `${API_BASE}/sucursales`

  // Función para obtener headers con token desde localStorage
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  }

  useEffect(() => {
    fetch(`${API_URL}/all`, { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("No autorizado o error en el servidor");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setSucursales(data);
        } else {
          console.error("Formato de datos inesperado:", data);
          setSucursales([]);
        }
      })
      .catch((error) => {
        console.error("Error al obtener sucursales:", error.message);
        setSucursales([]);
      });
  }, []);

  const guardarSucursal = async () => {
    if (!sucursalActual?.nombre || !sucursalActual.direccion) {
      toast.error("Nombre y dirección obligatorios")
      return
    }

    const isEditing = !!sucursalActual.id
    
    // Solo SUPER_ADMIN puede crear nuevas sucursales
    if (!isEditing && !isSuperAdmin) {
      toast.error("No tienes permisos para crear sucursales")
      return
    }
    
    // Solo SUPER_ADMIN puede editar
    if (isEditing && !isSuperAdmin) {
      toast.error("No tienes permisos para editar sucursales")
      return
    }

    const url = isEditing
      ? `${API_URL}/update/${sucursalActual.id}`
      : `${API_URL}/register`
    const method = isEditing ? "PUT" : "POST"

    const { id, ...sucursalSinId } = sucursalActual

    const payload = {
      nombre: sucursalSinId.nombre,
      provincia: sucursalSinId.provincia,
      direccion: sucursalSinId.direccion,
    }

    try {
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Error al crear o actualizar sucursal.")
      }

      const updatedSucursal = result.data

      setSucursales((prev) =>
        isEditing
          ? prev.map((p) => (p.id === updatedSucursal.id ? updatedSucursal : p))
          : [...prev, updatedSucursal]
      )

      setIsModalOpen(false)
      toast.success(isEditing ? "Sucursal actualizada" : "Sucursal creada")
    } catch (error: any) {
      toast.error(error.message || "Error al guardar la sucursal")
    }
  }

  const eliminarSucursal = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/delete/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error("Error al eliminar")
      setSucursales((prev) => prev.filter((s) => s.id !== id))
      toast.success("Sucursal eliminada")
    } catch (err) {
      toast.error("No se pudo eliminar la sucursal")
    }
  }

  const sucursalesVisibles = sucursales.filter((s) => !!s?.nombre)
  const pageCount = Math.ceil(sucursalesVisibles.length / SUCURSALES_POR_PAGINA)
  const offsetPagina =
    Math.min(paginaActual, Math.max(0, pageCount - 1)) * SUCURSALES_POR_PAGINA
  const sucursalesPaginadas = sucursalesVisibles.slice(
    offsetPagina,
    offsetPagina + SUCURSALES_POR_PAGINA
  )

  return (
    <div className="container-fluid px-2 px-sm-3 px-md-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="page-title mb-1">Sucursales</h1>
          <p className="text-muted mb-0">
            Gestión de las sucursales registradas en Guapo Trajes.
          </p>
        </div>
        {isSuperAdmin && (
          <Button
            className="btn-oxblood d-flex align-items-center gap-2"
            onClick={() => {
              setSucursalActual({ nombre: "", direccion: "", provincia: "" })
              setIsModalOpen(true)
            }}
          >
            <i className="bi bi-plus-lg"></i>
            Agregar sucursal
          </Button>
        )}
      </div>

      <div className="card shadow-sm border-line">
        <div className="table-responsive">
          <Table className="gt-table align-middle mb-0">
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Provincia</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sucursalesPaginadas.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="fw-semibold">{s.nombre}</TableCell>
                  <TableCell>{s.direccion}</TableCell>
                  <TableCell>{s.provincia}</TableCell>
                  <TableCell>
                    {canManageSucursales && (
                      <div className="d-flex justify-content-center gap-2">
                        <button
                          className="btn-action btn-action--editar"
                          onClick={() => {
                            setSucursalActual(s)
                            setIsModalOpen(true)
                          }}
                          title="Editar"
                        >
                          <Pencil size={16} strokeWidth={1.75} aria-hidden />
                        </button>
                        <button
                          className="btn-action btn-action--borrar"
                          onClick={() => eliminarSucursal(s.id)}
                          title="Eliminar"
                        >
                          <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                        </button>
                      </div>
                    )}
                    {!canManageSucursales && (
                      <div className="text-center text-muted">
                        Sin permisos
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!sucursales || sucursales.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted py-4">
                    No hay sucursales registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {pageCount > 1 && (
          <div className="d-flex flex-column align-items-center gap-1 px-3 py-2 border-top">
            <ReactPaginate
              previousLabel="←"
              nextLabel="→"
              breakLabel="..."
              pageCount={pageCount}
              pageRangeDisplayed={3}
              marginPagesDisplayed={1}
              onPageChange={({ selected }) => setPaginaActual(selected)}
              containerClassName="pagination"
              pageClassName="page-item"
              pageLinkClassName="page-link"
              previousClassName="page-item"
              previousLinkClassName="page-link"
              nextClassName="page-item"
              nextLinkClassName="page-link"
              breakClassName="page-item"
              breakLinkClassName="page-link"
              activeClassName="active"
              forcePage={Math.min(paginaActual, Math.max(0, pageCount - 1))}
            />
            <span className="text-muted small text-center">
              Mostrando {offsetPagina + 1}–
              {Math.min(offsetPagina + SUCURSALES_POR_PAGINA, sucursalesVisibles.length)} de{" "}
              {sucursalesVisibles.length} sucursales
            </span>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full border-0" dialogClassName="modal-dialog-centered modal-lg" dialogStyle={{ maxWidth: "600px", width: "95%" }}>
          <DialogHeader className="border-bottom pb-3">
            <DialogTitle className="fw-semibold">
              {sucursalActual?.id ? "Editar sucursal" : "Nueva sucursal"}
            </DialogTitle>
            <DialogDescription className="mb-0">
              Completá los datos básicos de la sucursal.
            </DialogDescription>
          </DialogHeader>

          <div className="modal-body px-3 px-md-4">
            <div className="card shadow-sm">
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-bold">Nombre</label>
                    <Input value={sucursalActual?.nombre || ""} onChange={(e) => setSucursalActual({ ...sucursalActual!, nombre: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">Dirección</label>
                    <Input value={sucursalActual?.direccion || ""} onChange={(e) => setSucursalActual({ ...sucursalActual!, direccion: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">Provincia</label>
                    <Input value={sucursalActual?.provincia || ""} onChange={(e) => setSucursalActual({ ...sucursalActual!, provincia: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <Button variant="outline" className="btn-outline-ink" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="btn-oxblood" onClick={() => guardarSucursal()}>
              {sucursalActual?.id ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}