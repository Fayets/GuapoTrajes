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
import { imprimirEtiquetas50x25Lote } from "@/lib/imprimir-etiqueta-50x25"
import { toast } from "sonner"

type Modista = {
  id: number
  nombre: string
  telefono: string
  direccion: string
}

type ProductoEnModista = {
  id: number
  codigo_barra: string
  descripcion: string
  precio_alquiler_efectivo: number
  modista: { id: number; nombre: string; telefono?: string; direccion?: string }
  fecha_ingreso: string | null
  notas?: string
  cliente_nombre?: string
  cliente_celular?: string
}

type EstadoColaEtiqueta = "pendiente" | "imprimiendo" | "ok" | "error"

type ItemColaEtiquetaVisual = {
  key: string
  productoId: number
  codigo_barra: string
  descripcion: string
  estado: EstadoColaEtiqueta
}

function filaColaDesdeProducto(p: ProductoEnModista, indice: number): ItemColaEtiquetaVisual {
  return {
    key: `etq-mod-${p.id}-${indice}`,
    productoId: p.id,
    codigo_barra: p.codigo_barra || "",
    descripcion: p.descripcion || "",
    estado: "pendiente",
  }
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function abrirRemitoRecepcionModista(
  modNombre: string,
  modId: number,
  items: ProductoEnModista[]
) {
  const num = `REM-REC-MOD-${modId}-${format(new Date(), "yyyyMMddHHmmss")}`
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
<h2 class="mb-2">Recepción desde modista</h2>
<p class="mb-1"><strong>${escHtml(num)}</strong></p>
<p class="mb-1"><strong>Modista:</strong> ${escHtml(modNombre)}</p>
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

export default function ModistaPage() {
  const [modista, setModista] = useState<Modista[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [modistaActual, setModistaActual] = useState<Modista | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    telefono: "",
    direccion: "",
  })

  const [token, setToken] = useState<string | null>(null)
  const API_BASE = getApiBaseUrl()

  const [modistaRecepcionId, setModistaRecepcionId] = useState<string>("")
  const [productosEnModista, setProductosEnModista] = useState<ProductoEnModista[]>([])
  const [cargandoPrendas, setCargandoPrendas] = useState(false)
  const [volvioPorId, setVolvioPorId] = useState<Record<number, boolean>>({})
  const [registrandoBolsa, setRegistrandoBolsa] = useState(false)
  const [imprimiendoEtiquetas, setImprimiendoEtiquetas] = useState(false)
  const [colaVisualEtiquetas, setColaVisualEtiquetas] = useState<ItemColaEtiquetaVisual[]>([])

  useEffect(() => {
    const t = localStorage.getItem("token")
    if (t) setToken(t)
  }, [])

  useEffect(() => {
    if (token) void fetchModista()
  }, [token])

  useEffect(() => {
    if (!token || !modistaRecepcionId) {
      setProductosEnModista([])
      setVolvioPorId({})
      setColaVisualEtiquetas([])
      return
    }
    const id = Number(modistaRecepcionId)
    if (Number.isNaN(id)) return

    let cancelled = false
    ;(async () => {
      setCargandoPrendas(true)
      try {
        const res = await fetch(`${API_BASE}/modistas/productos?modista_id=${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(
            typeof json.detail === "string"
              ? json.detail
              : json.message || "Error al cargar prendas"
          )
        }
        const data = (json.data || []) as ProductoEnModista[]
        if (!cancelled) {
          setProductosEnModista(Array.isArray(data) ? data : [])
          setVolvioPorId({})
          setColaVisualEtiquetas([])
        }
      } catch (e) {
        if (!cancelled) {
          setProductosEnModista([])
          setColaVisualEtiquetas([])
          toast.error(e instanceof Error ? e.message : "Error al cargar prendas")
        }
      } finally {
        if (!cancelled) setCargandoPrendas(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, modistaRecepcionId, API_BASE])

  const fetchModista = async () => {
    try {
      const res = await fetch(`${API_BASE}/modistas/all`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        setModista([])
        return
      }
      const data = await res.json()
      const raw = Array.isArray(data) ? data : []
      setModista(
        raw.map((m: Record<string, unknown>) => ({
          id: Number(m.id),
          nombre: String(m.nombre ?? ""),
          telefono: String(m.telefono ?? ""),
          direccion: String(m.direccion ?? ""),
        }))
      )
    } catch {
      setModista([])
    }
  }

  const productosMarcadosVolvieron = productosEnModista.filter((p) => volvioPorId[p.id])

  const toggleVolvio = (productoId: number) => {
    setVolvioPorId((prev) => ({ ...prev, [productoId]: !prev[productoId] }))
  }

  const marcarTodosVolvieron = (valor: boolean) => {
    const next: Record<number, boolean> = {}
    productosEnModista.forEach((p) => {
      next[p.id] = valor
    })
    setVolvioPorId(next)
  }

  const handleRemitoMarcados = () => {
    const sel = productosMarcadosVolvieron
    if (!modistaRecepcionId) {
      toast.error("Elegí una modista")
      return
    }
    if (sel.length === 0) {
      toast.error("Marcá las prendas que volvieron para armar el remito")
      return
    }
    const mod = modista.find((m) => String(m.id) === modistaRecepcionId)
    abrirRemitoRecepcionModista(mod?.nombre || "Modista", Number(modistaRecepcionId), sel)
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
      const res = await fetch(`${API_BASE}/modistas/regresar-varios`, {
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
      setProductosEnModista((prev) => prev.filter((p) => !regresados.includes(p.id)))
      setVolvioPorId({})
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar")
    } finally {
      setRegistrandoBolsa(false)
    }
  }

  const handleImprimirEtiquetasMarcados = async () => {
    const sel = productosMarcadosVolvieron
    if (sel.length === 0) {
      toast.error("Marcá las prendas cuyas etiquetas querés imprimir")
      return
    }
    const colaInicial = sel.map((p, i) => filaColaDesdeProducto(p, i))
    setColaVisualEtiquetas(colaInicial.map((r) => ({ ...r, estado: "imprimiendo" as const })))
    setImprimiendoEtiquetas(true)
    try {
      const payload = sel.map((p) => ({
        codigoBarra: p.codigo_barra || "0",
        descripcion: p.descripcion || "",
      }))
      const { porIndice } = await imprimirEtiquetas50x25Lote(payload)
      const ok = porIndice.filter((s) => s === "ok").length
      const err = porIndice.filter((s) => s === "error").length
      setColaVisualEtiquetas((prev) =>
        prev.map((row, j) => ({
          ...row,
          estado: porIndice[j] === "ok" ? "ok" : "error",
        }))
      )
      if (err === 0) {
        toast.success(
          `${ok} etiqueta(s) en un solo envío a impresión (50×25 mm, una hoja por etiqueta)`
        )
      } else if (ok === 0) {
        toast.error("No se pudo armar ninguna etiqueta. Revisá los códigos de barras.")
      } else {
        toast.warning(
          `Listo parcial: ${ok} en el mismo trabajo de impresión, ${err} con error al generar el código`
        )
      }
    } finally {
      setImprimiendoEtiquetas(false)
    }
  }

  const handleImprimirEtiquetaUna = async (p: ProductoEnModista) => {
    const fila = filaColaDesdeProducto(p, 0)
    setColaVisualEtiquetas([{ ...fila, estado: "imprimiendo" }])
    setImprimiendoEtiquetas(true)
    try {
      const { porIndice } = await imprimirEtiquetas50x25Lote([
        { codigoBarra: p.codigo_barra || "0", descripcion: p.descripcion || "" },
      ])
      const ok = porIndice[0] === "ok"
      setColaVisualEtiquetas([{ ...fila, estado: ok ? "ok" : "error" }])
      if (ok) toast.success("Etiqueta enviada a impresión")
      else toast.error("No se pudo generar la etiqueta (código inválido)")
    } finally {
      setImprimiendoEtiquetas(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const nuevoModista = () => {
    setModistaActual(null)
    setFormData({ nombre: "", telefono: "", direccion: "" })
    setShowModal(true)
  }

  const editarModista = (m: Modista) => {
    setModistaActual(m)
    setFormData({
      nombre: m.nombre,
      telefono: m.telefono,
      direccion: m.direccion,
    })
    setShowModal(true)
  }

  const confirmarEliminar = (m: Modista) => {
    setModistaActual(m)
    setShowDeleteModal(true)
  }

  const eliminarModista = async () => {
    if (!modistaActual || !token) return
    try {
      const res = await fetch(`${API_BASE}/modistas/delete/${modistaActual.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        toast.error("No se pudo eliminar la modista")
        return
      }
      setModista((prev) => prev.filter((c) => c.id !== modistaActual.id))
      setShowDeleteModal(false)
      setModistaActual(null)
      toast.success("Modista eliminada")
      void fetchModista()
    } catch {
      toast.error("Error al eliminar modista")
    }
  }

  const guardarModista = async () => {
    if (!token) return
    const metodo = modistaActual ? "PUT" : "POST"
    const url = modistaActual
      ? `${API_BASE}/modistas/update/${modistaActual.id}`
      : `${API_BASE}/modistas/register`

    if (!formData.nombre || !formData.telefono || !formData.direccion) {
      toast.error("Completá nombre, teléfono y dirección")
      return
    }

    const datosFormateados = {
      nombre: formData.nombre.trim(),
      telefono: formData.telefono.trim(),
      direccion: formData.direccion.trim(),
    }

    try {
      const res = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(datosFormateados),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.success === false) {
        toast.error(
          typeof body.detail === "string"
            ? body.detail
            : body.message || "Error al guardar modista"
        )
        return
      }
      setShowModal(false)
      setModistaActual(null)
      toast.success(modistaActual ? "Modista actualizada" : "Modista creada")
      void fetchModista()
    } catch {
      toast.error("Error al guardar modista")
    }
  }

  const modistasFiltrados = modista.filter((m) =>
    `${m.nombre} `.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="container-fluid px-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="fw-bold mb-1">Modistas</h1>
          <p className="text-muted mb-0">Gestión de modistas de Guapo Trajes.</p>
        </div>
        <Button className="d-flex align-items-center gap-2" onClick={nuevoModista}>
          <i className="bi bi-plus-lg"></i>
          Nuevo modista
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
              placeholder="Buscar modistas..."
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
              {modistasFiltrados.length > 0 ? (
                modistasFiltrados.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="fw-semibold">{m.nombre}</TableCell>
                    <TableCell>{m.direccion}</TableCell>
                    <TableCell className="text-nowrap">{m.telefono}</TableCell>
                    <TableCell>
                      <div className="d-flex justify-content-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => editarModista(m)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => confirmarEliminar(m)}>
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted py-4">
                    No se encontraron modistas.
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
            Modista → marcá lo devuelto → remito, salón o imprimir etiquetas. Mismo formato 50×25 mm
            que en Productos; las marcadas salen en un solo cuadro de impresión.
          </p>
        </div>
        <div className="card-body">
          <div className="row g-2 align-items-end mb-3">
            <div className="col-12 col-md-4 col-lg-3">
              <label className="form-label small fw-semibold mb-1">Modista</label>
              <select
                className="form-select form-select-sm"
                value={modistaRecepcionId}
                onChange={(e) => setModistaRecepcionId(e.target.value)}
              >
                <option value="">— Elegir —</option>
                {modista.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-8 col-lg-9 d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={!modistaRecepcionId || productosEnModista.length === 0}
                onClick={() => marcarTodosVolvieron(true)}
              >
                Marcar todas
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={!modistaRecepcionId || productosEnModista.length === 0}
                onClick={() => marcarTodosVolvieron(false)}
              >
                Desmarcar
              </button>
              <button
                type="button"
                className="btn btn-outline-dark btn-sm"
                disabled={!modistaRecepcionId}
                onClick={handleRemitoMarcados}
              >
                <i className="bi bi-printer me-1" aria-hidden />
                Remito
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                disabled={!modistaRecepcionId || registrandoBolsa}
                onClick={() => void handleRegistrarSalonMarcados()}
              >
                <i className="bi bi-house-door me-1" aria-hidden />
                Registrar en salón
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={
                  !modistaRecepcionId ||
                  imprimiendoEtiquetas ||
                  productosMarcadosVolvieron.length === 0
                }
                onClick={() => void handleImprimirEtiquetasMarcados()}
              >
                <i className="bi bi-printer me-1" aria-hidden />
                {imprimiendoEtiquetas ? "Imprimiendo cola…" : "Imprimir cola (marcadas)"}
              </button>
            </div>
          </div>
          {modistaRecepcionId &&
            productosEnModista.length > 0 &&
            !cargandoPrendas && (
              <p className="small text-secondary mb-2">
                Prendas marcadas para cola:{" "}
                <strong>{productosMarcadosVolvieron.length}</strong>. Un solo “Imprimir” del
                navegador: cada etiqueta sigue siendo una hoja 50×25 mm.
              </p>
            )}
          {colaVisualEtiquetas.length > 0 && (
            <div className="border rounded mb-3 overflow-hidden bg-body">
              <div className="border-bottom px-3 py-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
                <h2 className="h6 mb-0">Cola de impresión</h2>
                {imprimiendoEtiquetas ? (
                  <span className="badge bg-primary">En curso</span>
                ) : (
                  <span className="badge bg-secondary">Finalizado</span>
                )}
              </div>
              <div className="p-3">
                <p className="text-muted small mb-3">
                  Una fila por etiqueta. Al terminar el único envío a impresión, cada fila pasa a
                  listo o error (50×25&nbsp;mm por hoja).
                </p>
                <ul className="list-group list-group-flush border rounded">
                  {colaVisualEtiquetas.map((row) => (
                    <li
                      key={row.key}
                      className={`list-group-item d-flex flex-column flex-md-row align-items-md-center gap-2 ${
                        row.estado === "imprimiendo" ? "list-group-item-primary" : ""
                      }`}
                    >
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-medium text-truncate" title={row.descripcion}>
                          {row.descripcion || "—"}
                        </div>
                        <div className="small text-muted font-monospace">
                          {row.codigo_barra || `ID ${row.productoId}`}
                        </div>
                      </div>
                      <div className="align-self-md-center flex-shrink-0">
                        {row.estado === "pendiente" && (
                          <span className="badge bg-light text-dark border">Pendiente</span>
                        )}
                        {row.estado === "imprimiendo" && (
                          <span className="text-primary small d-inline-flex align-items-center gap-2">
                            <span
                              className="spinner-border spinner-border-sm"
                              role="status"
                              aria-hidden
                            />
                            Imprimiendo…
                          </span>
                        )}
                        {row.estado === "ok" && (
                          <span className="badge bg-success">
                            <i className="bi bi-check-lg me-1" aria-hidden />
                            Listo
                          </span>
                        )}
                        {row.estado === "error" && (
                          <span className="badge bg-danger">
                            <i className="bi bi-exclamation-lg me-1" aria-hidden />
                            Error
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-top px-3 py-2 d-flex flex-wrap gap-2 align-items-center">
                <span className="me-auto text-muted small">
                  {(() => {
                    const n = colaVisualEtiquetas.length
                    const hechas = colaVisualEtiquetas.filter(
                      (r) => r.estado === "ok" || r.estado === "error"
                    ).length
                    return `${hechas} / ${n} · ${n === 1 ? "1 etiqueta" : `${n} etiquetas`}`
                  })()}
                </span>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={imprimiendoEtiquetas}
                  onClick={() => {
                    if (imprimiendoEtiquetas) return
                    if (
                      typeof window !== "undefined" &&
                      !window.confirm("¿Vaciar toda la cola?")
                    ) {
                      return
                    }
                    setColaVisualEtiquetas([])
                    toast.success("Cola vaciada.")
                  }}
                >
                  Vaciar cola
                </button>
              </div>
            </div>
          )}
          {!modistaRecepcionId ? (
            <p className="text-muted small mb-0">
              Seleccioná una modista para ver las prendas que están allá.
            </p>
          ) : cargandoPrendas ? (
            <p className="text-muted small mb-0">Cargando…</p>
          ) : productosEnModista.length === 0 ? (
            <p className="text-muted small mb-0">No hay prendas en esta modista en este momento.</p>
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th
                      className="text-center"
                      style={{ width: 44 }}
                      title="Marcá cuando la prenda volvió"
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
                  {productosEnModista.map((p) => {
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
                        <td className="text-nowrap small font-monospace">{p.codigo_barra}</td>
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
                            title="Imprimir esta etiqueta (50×25 mm)"
                            disabled={imprimiendoEtiquetas}
                            onClick={() => void handleImprimirEtiquetaUna(p)}
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
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered modal-lg"
          dialogStyle={{ maxWidth: "600px", width: "95%" }}
        >
          <DialogHeader className="border-bottom pb-3">
            <DialogTitle className="fw-semibold">
              {modistaActual ? "Editar modista" : "Nuevo modista"}
            </DialogTitle>
            <DialogDescription className="mb-0">Completá los datos del modista.</DialogDescription>
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
            <Button onClick={() => void guardarModista()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteModal} onOpenChange={(open) => !open && setShowDeleteModal(false)}>
        <DialogContent
          className="w-full border-0"
          dialogClassName="modal-dialog-centered"
          dialogStyle={{ maxWidth: "420px", width: "90%" }}
        >
          <DialogHeader className="border-bottom pb-2">
            <DialogTitle className="fw-semibold">Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <div className="modal-body px-3 px-md-4">
            <p className="mb-0">
              ¿Seguro querés eliminar a <strong>{modistaActual?.nombre}</strong>? Esta acción no se
              puede deshacer.
            </p>
          </div>
          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void eliminarModista()}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
