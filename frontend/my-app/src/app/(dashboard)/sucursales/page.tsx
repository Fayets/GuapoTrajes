// Componente de gestión de sucursales (frontend React)
"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface Sucursal {
  id: number
  nombre: string
  direccion: string
  provincia: string
}

export default function SucursalesPage() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalActual, setSucursalActual] = useState<Partial<Sucursal> | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const API_URL = "http://127.0.0.1:8000/sucursales"

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

  console.log("Sucursales renderizadas:", sucursales)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gestión de Sucursales</h1>
      <Button
        onClick={() => {
          setSucursalActual({ 
            nombre: "", 
            direccion: "", 
            provincia: "" })
          setIsModalOpen(true)
        }}
      >Agregar Sucursal
      </Button>

      {/* Tabla de sucursales */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Dirección</TableHead>
            <TableHead>Provincia</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sucursales
            ?.filter(s => s && s.nombre) // asegura que s no sea null/undefined
            ?.filter(s => s !== undefined && s !== null)
            .map(s => (
              <TableRow key={s.id}>
                <TableCell>{s.nombre}</TableCell>
                <TableCell>{s.direccion}</TableCell>
                <TableCell>{s.provincia}</TableCell>
                <TableCell>
                <Button
                  size="sm"
                  onClick={() => {
                    console.log("Editando sucursal:", s)
                    setSucursalActual(s)  // ← Cargamos los datos en el formulario
                    setIsModalOpen(true)        // ← Abrimos el modal
                  }}
                  >Editar
                </Button>
                  <Button onClick={() => eliminarSucursal(s.id)} className="ml-2" variant="warning">Eliminar</Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {isModalOpen && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{sucursalActual?.id ? "Editar Sucursal" : "Nueva Sucursal"} Sucursal</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <label>Nombre</label>
                <Input value={sucursalActual?.nombre || ""} onChange={(e) => setSucursalActual({ ...sucursalActual!, nombre: e.target.value })} />
              </div>
              <div>
                <label>Direccion</label>
                <Input value={sucursalActual?.direccion || ""} onChange={(e) => setSucursalActual({ ...sucursalActual!, direccion: e.target.value })} />
              </div>
              <div>
                <label>Provincia</label>
                <Input value={sucursalActual?.provincia || ""} onChange={(e) => setSucursalActual({ ...sucursalActual!, provincia: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={(e)=>guardarSucursal()}>
                {sucursalActual?.id ? "Actualizar" : "Guardar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}