"use client"

import React, { useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getApiBaseUrl } from "@/lib/api-config"
import { toast } from "sonner"

type Lavanderia = {
  id: number
  nombre: string
  telefono?: string
  direccion?: string
}

type ProductoEnLavanderia = {
  id: number
  codigo_barra: string
  descripcion: string
  precio_alquiler_efectivo: number
  lavanderia: { id: number; nombre: string; telefono?: string; direccion?: string }
  fecha_ingreso: string | null
  notas?: string
  cliente_nombre?: string
  cliente_celular?: string
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escJsStr(s: string): string {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ")
}

/** Ventana nueva: etiquetas con código de barras (sin cola de escaneo). */
function abrirVentanaEtiquetasProductos(items: ProductoEnLavanderia[]) {
  if (items.length === 0) {
    toast.error("No hay prendas para etiquetar")
    return
  }
  const bloques: string[] = []
  const scripts: string[] = []
  items.forEach((p, k) => {
    const id = `bc-lav-${k}`
    const code = (p.codigo_barra || "").trim() || "0"
    bloques.push(
      `<div class="etiq"><svg id="${id}"></svg><div class="desc">${escHtml(p.descripcion || "")}</div><div class="cod text-muted small">${escHtml(code)}</div></div>`
    )
    scripts.push(
      `try{JsBarcode('#${id}','${escJsStr(code)}',{format:'CODE128',width:1.15,height:38,margin:2,displayValue:true,fontSize:9});}catch(e){console.warn(e);}`
    )
  })
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Etiquetas</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>
body{font-family:system-ui,sans-serif;padding:12px;}
.etiq{display:inline-block;vertical-align:top;border:1px dashed #444;border-radius:8px;padding:10px 12px;margin:8px;min-width:220px;page-break-inside:avoid;}
.etiq .desc{font-size:12px;font-weight:600;margin-top:6px;max-width:280px;}
@media print{.no-print{display:none!important}}
</style></head><body>
<h2 class="h5 mb-2">Etiquetas (${items.length})</h2>
<div class="no-print mb-2"><button type="button" class="btn btn-primary btn-sm" onclick="window.print()">Imprimir</button>
<button type="button" class="btn btn-outline-secondary btn-sm" onclick="window.close()">Cerrar</button></div>
<div>${bloques.join("")}</div>
<script>
window.addEventListener('load',function(){
${scripts.join("\n")}
});
</script>
</body></html>`
  const w = window.open("", "_blank", "width=900,height=700")
  if (!w) {
    toast.error("Permití ventanas emergentes para imprimir etiquetas")
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

function abrirRemitoRecepcionLavanderia(
  lavNombre: string,
  lavId: number,
  items: ProductoEnLavanderia[]
) {
  const num = `REM-REC-LAV-${lavId}-${format(new Date(), "yyyyMMddHHmmss")}`
  const hoy = format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })
  const filas = items
    .map(
      (p) =>
        `<tr><td>${escHtml(String(p.id))}</td><td>${escHtml(p.codigo_barra || "—")}</td><td>${escHtml(p.descripcion || "")}</td><td>${escHtml((p.cliente_nombre || "").trim() || "—")}</td><td>${escHtml((p.notas || "").trim() || "—")}</td></tr>`
    )
    .join("")
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Remito ${num}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"/>
<style>body{padding:20px;font-family:system-ui,sans-serif;} @media print{.no-print{display:none!important}}</style></head><body>
<h2 class="mb-2">Recepción desde lavandería</h2>
<p class="mb-1"><strong>${escHtml(num)}</strong></p>
<p class="mb-1"><strong>Lavandería:</strong> ${escHtml(lavNombre)}</p>
<p class="mb-3 text-muted small">${escHtml(hoy)} · ${items.length} ítem(es)</p>
<table class="table table-bordered table-sm"><thead><tr><th>ID</th><th>Código</th><th>Descripción</th><th>Cliente (envío)</th><th>Notas</th></tr></thead><tbody>${filas}</tbody></table>
<p class="small text-muted mt-3">Documento de control interno. Firmas: __________________</p>
<div class="no-print mt-3"><button type="button" class="btn btn-primary" onclick="window.print()">Imprimir</button>
<button type="button" class="btn btn-outline-secondary" onclick="window.close()">Cerrar</button></div>
</body></html>`
  const w = window.open("", "_blank", "width=820,height=900")
  if (!w) {
    toast.error("Permití ventanas emergentes para ver el remito")
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

export default function LavanderiaPage() {
  const [lavanderia, setLavanderia] = useState<Lavanderia[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [lavanderiaActual, setLavanderiaActual] = useState<Lavanderia | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    telefono: "",
    direccion: "",
  })

  const [token, setToken] = useState<string | null>(null)
  const API_BASE = getApiBaseUrl()

  const [lavanderiaRecepcionId, setLavanderiaRecepcionId] = useState<string>("")
  const [productosEnLavanderia, setProductosEnLavanderia] = useState<ProductoEnLavanderia[]>([])
  const [cargandoPrendas, setCargandoPrendas] = useState(false)
  const [volvioPorId, setVolvioPorId] = useState<Record<number, boolean>>({})
  const [registrandoBolsa, setRegistrandoBolsa] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (t) {
      setToken(t)
    }
  }, [])

  useEffect(() => {
    if (token) {
      console.log("Token disponible, obteniendo lavanderias...");
      fetchLavanderia();
    }
  }, [token])

  const fetchLavanderia = async () => {
    try {
      const res = await fetch(`${API_BASE}/lavanderia/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        setLavanderia([])
        return
      }

      const data = await res.json()
      const raw = Array.isArray(data) ? data : []
      setLavanderia(
        raw.map((l: Record<string, unknown>) => ({
          id: Number(l.id),
          nombre: String(l.nombre ?? ""),
          telefono: String(l.telefono ?? ""),
          direccion: String(l.direccion ?? ""),
        }))
      )
    } catch (err) {
      console.error("Error al obtener lavanderia.", err)
      setLavanderia([])
    }
  }

  useEffect(() => {
    if (!token || !lavanderiaRecepcionId) {
      setProductosEnLavanderia([])
      setVolvioPorId({})
      return
    }
    const id = Number(lavanderiaRecepcionId)
    if (Number.isNaN(id)) return

    let cancelled = false
    ;(async () => {
      setCargandoPrendas(true)
      try {
        const res = await fetch(
          `${API_BASE}/lavanderia/productos?lavanderia_id=${id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(
            typeof json.detail === "string"
              ? json.detail
              : json.message || "Error al cargar prendas"
          )
        }
        const data = (json.data || []) as ProductoEnLavanderia[]
        if (!cancelled) {
          setProductosEnLavanderia(Array.isArray(data) ? data : [])
          setVolvioPorId({})
        }
      } catch (e) {
        if (!cancelled) {
          setProductosEnLavanderia([])
          toast.error(e instanceof Error ? e.message : "Error al cargar prendas")
        }
      } finally {
        if (!cancelled) setCargandoPrendas(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, lavanderiaRecepcionId, API_BASE])

  const productosMarcadosVolvieron = productosEnLavanderia.filter((p) => volvioPorId[p.id])

  const toggleVolvio = (productoId: number) => {
    setVolvioPorId((prev) => ({ ...prev, [productoId]: !prev[productoId] }))
  }

  const marcarTodosVolvieron = (valor: boolean) => {
    const next: Record<number, boolean> = {}
    productosEnLavanderia.forEach((p) => {
      next[p.id] = valor
    })
    setVolvioPorId(next)
  }

  const handleRemitoMarcados = () => {
    const sel = productosMarcadosVolvieron
    if (!lavanderiaRecepcionId) {
      toast.error("Elegí una lavandería")
      return
    }
    if (sel.length === 0) {
      toast.error("Marcá las prendas que volvieron en la bolsa para armar el remito")
      return
    }
    const lav = lavanderia.find((l) => String(l.id) === lavanderiaRecepcionId)
    abrirRemitoRecepcionLavanderia(lav?.nombre || "Lavandería", Number(lavanderiaRecepcionId), sel)
  }

  const handleRegistrarSalonMarcados = async () => {
    const ids = productosMarcadosVolvieron.map((p) => p.id)
    if (ids.length === 0) {
      toast.error("Marcá al menos una prenda que haya vuelto")
      return
    }
    if (!token) return
    setRegistrandoBolsa(true)
    try {
      const res = await fetch(`${API_BASE}/lavanderia/regresar-varios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productos_ids: ids }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof json.detail === "string" ? json.detail : json.message || "Error al registrar"
        )
      }
      const errList = json.data?.errores as { producto_id: number; detail: string }[] | undefined
      const regresados = (json.data?.regresados as number[] | undefined) ?? []
      if (errList?.length) {
        toast.warning(`${json.message || "Listo"} (${errList.length} con aviso)`)
      } else {
        toast.success(json.message || "Prendas registradas en salón")
      }
      setProductosEnLavanderia((prev) => prev.filter((p) => !regresados.includes(p.id)))
      setVolvioPorId({})
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar")
    } finally {
      setRegistrandoBolsa(false)
    }
  }

  const handleImprimirEtiquetasMarcados = () => {
    const sel = productosMarcadosVolvieron
    if (sel.length === 0) {
      toast.error("Marcá las prendas cuyas etiquetas querés imprimir")
      return
    }
    abrirVentanaEtiquetasProductos(sel)
  }

  const handleImprimirEtiquetaUna = (p: ProductoEnLavanderia) => {
    abrirVentanaEtiquetasProductos([p])
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const nuevoLavanderia = () => {
    setLavanderiaActual(null)
    setFormData({
      nombre: "",
      telefono: "",
      direccion: "",
    })
    setShowModal(true)
  }

  const editarLavanderia = (lavanderia: Lavanderia) => {
    setLavanderiaActual(lavanderia)
    setFormData({
      nombre: lavanderia.nombre,
      telefono: lavanderia.telefono ?? "",
      direccion: lavanderia.direccion ?? "",
    })
    setShowModal(true)
  }

  const confirmarEliminar = (lavanderia: Lavanderia) => {
    setLavanderiaActual(lavanderia)
    setShowDeleteModal(true)
  }

  const eliminarLavanderia = async () => {
    if (!lavanderiaActual) return
    try {
      await fetch(`${API_BASE}/lavanderia/delete/${lavanderiaActual.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setLavanderia(lavanderia.filter((c) => c.id !== lavanderiaActual.id))
      setShowDeleteModal(false)
      setLavanderiaActual(null)
    } catch (err) {
      console.error("Error al eliminar lavanderia.", err)
    }
  }

  const guardarLavanderia = async () => {
    const metodo = lavanderiaActual ? "PUT" : "POST"
    const url = lavanderiaActual
      ? `${API_BASE}/lavanderia/update/${lavanderiaActual.id}`
      : `${API_BASE}/lavanderia/register`

    // Validar datos antes de enviar
    if (!formData.nombre || !formData.telefono || !formData.direccion) {
      alert("Por favor complete los campos obligatorios: Nombre, Telefono y Direccion");
      return;
    }

    // Asegurarse de que todos los campos sean strings
    const datosFormateados = {
      nombre: formData.nombre.trim(),
      telefono: formData.telefono.trim(),
      direccion: formData.direccion.trim(),
    }

    try {
      console.log("Enviando datos:", datosFormateados);
      
      const res = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(datosFormateados),
      })

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Error del servidor:", errorData);
        alert(`Error al guardar lavanderia: ${errorData.detail || 'Revise los datos ingresados'}`);
        return;
      }

      const nuevoLavanderia = await res.json();

      if (lavanderiaActual) {
        setLavanderia(lavanderia.map((c) => (c.id === lavanderiaActual.id ? nuevoLavanderia : c)))
      } else {
        setLavanderia([...lavanderia, nuevoLavanderia])
      }

      setShowModal(false)
      setLavanderiaActual(null)
      fetchLavanderia() // Recargar los lavanderias después de guardar para asegurar datos actualizados
    } catch (err) {
      console.error("Error al guardar lavanderia", err)
      alert("Error al guardar lavanderia. Por favor, intente nuevamente.")
    }
  }

  const lavanderiaFiltrados = lavanderia.filter((lavanderia) =>
    `${lavanderia.nombre} `.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="container-fluid px-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="fw-bold mb-1">Lavandería</h1>
          <p className="text-muted mb-0">Gestión de lavanderías de Guapo Trajes.</p>
        </div>
        <Button className="d-flex align-items-center gap-2" onClick={nuevoLavanderia}>
          <i className="bi bi-plus-lg"></i>
          Nueva lavandería
        </Button>
      </div>

      <div className="row g-3 align-items-center mb-4">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <Input
              type="search"
              placeholder="Buscar lavanderías..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <Table className="align-middle mb-0">
            <TableHeader className="table-light">
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Celular</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lavanderiaFiltrados.length > 0 ? (
                lavanderiaFiltrados.map((lavanderia) => (
                  <TableRow key={lavanderia.id}>
                    <TableCell className="fw-semibold">{lavanderia.nombre}</TableCell>
                    <TableCell>{lavanderia.direccion}</TableCell>
                    <TableCell className="text-nowrap">{lavanderia.telefono}</TableCell>
                    <TableCell>
                      <div className="d-flex justify-content-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => editarLavanderia(lavanderia)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => confirmarEliminar(lavanderia)}>
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted py-4">
                    No se encontraron lavanderías.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="card shadow-sm mt-4">
        <div className="card-header py-2">
          <h2 className="h6 mb-0 fw-semibold text-secondary">Bolsa: qué volvió</h2>
          <p className="small text-muted mb-0 mt-1">
            Lavandería → marcá lo de la bolsa → remito, salón o imprimir etiquetas.
          </p>
        </div>
        <div className="card-body">
          <div className="row g-2 align-items-end mb-3">
            <div className="col-12 col-md-4 col-lg-3">
              <label className="form-label small fw-semibold mb-1">Lavandería</label>
              <select
                className="form-select form-select-sm"
                value={lavanderiaRecepcionId}
                onChange={(e) => setLavanderiaRecepcionId(e.target.value)}
              >
                <option value="">— Elegir —</option>
                {lavanderia.map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-8 col-lg-9 d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={
                  !lavanderiaRecepcionId || productosEnLavanderia.length === 0
                }
                onClick={() => marcarTodosVolvieron(true)}
              >
                Marcar todas
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={
                  !lavanderiaRecepcionId || productosEnLavanderia.length === 0
                }
                onClick={() => marcarTodosVolvieron(false)}
              >
                Desmarcar
              </button>
              <button
                type="button"
                className="btn btn-outline-dark btn-sm"
                disabled={!lavanderiaRecepcionId}
                onClick={handleRemitoMarcados}
              >
                <i className="bi bi-printer me-1" aria-hidden />
                Remito
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                disabled={!lavanderiaRecepcionId || registrandoBolsa}
                onClick={handleRegistrarSalonMarcados}
              >
                <i className="bi bi-house-door me-1" aria-hidden />
                Registrar en salón
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!lavanderiaRecepcionId}
                onClick={handleImprimirEtiquetasMarcados}
              >
                <i className="bi bi-printer me-1" aria-hidden />
                Etiquetas (marcadas)
              </button>
            </div>
          </div>
          {!lavanderiaRecepcionId ? (
            <p className="text-muted small mb-0">
              Seleccioná una lavandería para ver las prendas que están allá.
            </p>
          ) : cargandoPrendas ? (
            <p className="text-muted small mb-0">Cargando…</p>
          ) : productosEnLavanderia.length === 0 ? (
            <p className="text-muted small mb-0">
              No hay prendas en esta lavandería en este momento.
            </p>
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th
                      className="text-center"
                      style={{ width: 44 }}
                      title="Marcá cuando la prenda volvió en la bolsa"
                    />
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Cliente (envío)</th>
                    <th>Ingreso</th>
                    <th>Notas</th>
                    <th className="text-end">Etiquetas</th>
                  </tr>
                </thead>
                <tbody>
                  {productosEnLavanderia.map((p) => {
                    const notas = (p.notas || "").trim()
                    return (
                      <tr key={p.id}>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={!!volvioPorId[p.id]}
                            onChange={() => toggleVolvio(p.id)}
                            aria-label={`Volvió: ${p.descripcion}`}
                          />
                        </td>
                        <td className="text-nowrap small font-monospace">
                          {p.codigo_barra}
                        </td>
                        <td>{p.descripcion}</td>
                        <td className="small">
                          {(p.cliente_nombre || "").trim() || "—"}
                        </td>
                        <td className="small text-nowrap">
                          {p.fecha_ingreso
                            ? format(
                                new Date(`${p.fecha_ingreso}T12:00:00`),
                                "dd/MM/yyyy",
                                { locale: es }
                              )
                            : "—"}
                        </td>
                        <td className="small text-muted">
                          {notas.length > 80 ? `${notas.slice(0, 80)}…` : notas || "—"}
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            title="Abrir ventana para imprimir esta etiqueta"
                            onClick={() => handleImprimirEtiquetaUna(p)}
                          >
                            <i className="bi bi-printer" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={(open) => !open && setShowModal(false)}>
        <DialogContent className="w-full border-0" dialogClassName="modal-dialog-centered modal-lg" dialogStyle={{ maxWidth: "600px", width: "95%" }}>
          <DialogHeader className="border-bottom pb-3">
            <DialogTitle className="fw-semibold">
              {lavanderiaActual ? "Editar lavandería" : "Nueva lavandería"}
            </DialogTitle>
            <DialogDescription className="mb-0">
              Completá los datos de la lavandería asociada.
            </DialogDescription>
          </DialogHeader>

          <div className="modal-body px-3 px-md-4">
            <div className="card shadow-sm">
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-bold">Nombre</label>
                    <Input name="nombre" value={formData.nombre} onChange={handleChange} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">Teléfono</label>
                    <Input name="telefono" value={formData.telefono} onChange={handleChange} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">Dirección</label>
                    <Input name="direccion" value={formData.direccion} onChange={handleChange} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarLavanderia}>Guardar</Button>
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
              ¿Seguro querés eliminar a <strong>{lavanderiaActual?.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
          </div>
          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={eliminarLavanderia}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}