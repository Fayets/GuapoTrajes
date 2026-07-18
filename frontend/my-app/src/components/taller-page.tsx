"use client"

import React, { useEffect, useState } from "react"
import ReactPaginate from "react-paginate"
import { Pencil, Trash2 } from "lucide-react"
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
import { useAuth } from "@/context/auth-context"
import type { TallerConfig } from "@/lib/taller-config"
import { imprimirEtiquetas50x25Lote } from "@/lib/imprimir-etiqueta-50x25"
import { toast } from "sonner"

type TallerEntity = {
  id: number
  nombre: string
  telefono?: string
  direccion?: string
}

type ProductoEnTaller = {
  id: number
  codigo_barra: string
  descripcion: string
  precio_alquiler_efectivo: number
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

function filaColaDesdeProducto(p: ProductoEnTaller, indice: number, colaKeyPrefix: string): ItemColaEtiquetaVisual {
  return {
    key: `${colaKeyPrefix}-${p.id}-${indice}`,
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

function abrirRemitoRecepcion(
  config: import("@/lib/taller-config").TallerConfig,
  entityNombre: string,
  entityId: number,
  items: ProductoEnTaller[]
) {
  const num = `${config.remitoPrefix}-${entityId}-${format(new Date(), "yyyyMMddHHmmss")}`
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
<h2 class="mb-2">${config.labels.remitoTitle}</h2>
<p class="mb-1"><strong>${escHtml(num)}</strong></p>
<p class="mb-1"><strong>${config.labels.remitoEntityLabel}:</strong> ${escHtml(entityNombre)}</p>
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

export function TallerPage({ config }: { config: import("@/lib/taller-config").TallerConfig }) {
  const [entities, setEntities] = useState<TallerEntity[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [entityActual, setEntityActual] = useState<TallerEntity | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [paginaActual, setPaginaActual] = useState(0)
  const ENTIDADES_POR_PAGINA = 18

  const [formData, setFormData] = useState({
    nombre: "",
    telefono: "",
    direccion: "",
  })

  const { token } = useAuth()
  const API_BASE = getApiBaseUrl()
  const L = config.labels

  const [recepcionId, setRecepcionId] = useState<string>("")
  const [productosEnTaller, setProductosEnTaller] = useState<ProductoEnTaller[]>([])
  const [cargandoPrendas, setCargandoPrendas] = useState(false)
  const [volvioPorId, setVolvioPorId] = useState<Record<number, boolean>>({})
  const [registrandoBolsa, setRegistrandoBolsa] = useState(false)
  const [imprimiendoEtiquetas, setImprimiendoEtiquetas] = useState(false)
  const [colaVisualEtiquetas, setColaVisualEtiquetas] = useState<ItemColaEtiquetaVisual[]>([])

  useEffect(() => {
    if (token) void fetchEntities()
  }, [token])

  const fetchEntities = async () => {
    try {
      const res = await fetch(`${API_BASE}${config.apiPrefix}/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        setEntities([])
        return
      }

      const data = await res.json()
      const raw = Array.isArray(data) ? data : []
      setEntities(
        raw.map((l: Record<string, unknown>) => ({
          id: Number(l.id),
          nombre: String(l.nombre ?? ""),
          telefono: String(l.telefono ?? ""),
          direccion: String(l.direccion ?? ""),
        }))
      )
    } catch (err) {
      setEntities([])
    }
  }

  useEffect(() => {
    if (!token || !recepcionId) {
      setProductosEnTaller([])
      setVolvioPorId({})
      setColaVisualEtiquetas([])
      return
    }
    const id = Number(recepcionId)
    if (Number.isNaN(id)) return

    let cancelled = false
    ;(async () => {
      setCargandoPrendas(true)
      try {
        const res = await fetch(
          `${API_BASE}${config.apiPrefix}/productos?${config.idQueryParam}=${id}`,
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
        const data = (json.data || []) as ProductoEnTaller[]
        if (!cancelled) {
          setProductosEnTaller(Array.isArray(data) ? data : [])
          setVolvioPorId({})
          setColaVisualEtiquetas([])
        }
      } catch (e) {
        if (!cancelled) {
          setProductosEnTaller([])
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
  }, [token, recepcionId, API_BASE])

  const productosMarcadosVolvieron = productosEnTaller.filter((p) => volvioPorId[p.id])

  const toggleVolvio = (productoId: number) => {
    setVolvioPorId((prev) => ({ ...prev, [productoId]: !prev[productoId] }))
  }

  const marcarTodosVolvieron = (valor: boolean) => {
    const next: Record<number, boolean> = {}
    productosEnTaller.forEach((p) => {
      next[p.id] = valor
    })
    setVolvioPorId(next)
  }

  const handleRemitoMarcados = () => {
    const sel = productosMarcadosVolvieron
    if (!recepcionId) {
      toast.error(L.chooseEntityError)
      return
    }
    if (sel.length === 0) {
      toast.error("Marcá las prendas que volvieron en la bolsa para armar el remito")
      return
    }
    const lav = entities.find((l) => String(l.id) === recepcionId)
    abrirRemitoRecepcion(config, lav?.nombre || L.entitySingular, Number(recepcionId), sel)
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
      const res = await fetch(`${API_BASE}${config.apiPrefix}/regresar-varios`, {
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
      setProductosEnTaller((prev) => prev.filter((p) => !regresados.includes(p.id)))
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
    const colaInicial = sel.map((p, i) => filaColaDesdeProducto(p, i, config.colaKeyPrefix))
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

  const handleImprimirEtiquetaUna = async (p: ProductoEnTaller) => {
    const fila = filaColaDesdeProducto(p, 0, config.colaKeyPrefix)
    setColaVisualEtiquetas([{ ...fila, estado: "imprimiendo" }])
    setImprimiendoEtiquetas(true)
    try {
      const { porIndice } = await imprimirEtiquetas50x25Lote([
        { codigoBarra: p.codigo_barra || "0", descripcion: p.descripcion || "" },
      ])
      const ok = porIndice[0] === "ok"
      setColaVisualEtiquetas([{ ...fila, estado: ok ? "ok" : "error" }])
      if (ok) {
        toast.success("Etiqueta enviada a impresión")
      } else {
        toast.error("No se pudo generar la etiqueta (código inválido)")
      }
    } finally {
      setImprimiendoEtiquetas(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const nuevoEntity = () => {
    setEntityActual(null)
    setFormData({
      nombre: "",
      telefono: "",
      direccion: "",
    })
    setShowModal(true)
  }

  const editarEntity = (entity: TallerEntity) => {
    setEntityActual(entity)
    setFormData({
      nombre: entity.nombre,
      telefono: entity.telefono ?? "",
      direccion: entity.direccion ?? "",
    })
    setShowModal(true)
  }

  const confirmarEliminar = (entity: TallerEntity) => {
    setEntityActual(entity)
    setShowDeleteModal(true)
  }

  const eliminarEntity = async () => {
    if (!entityActual) return
    try {
      await fetch(`${API_BASE}${config.apiPrefix}/delete/${entityActual.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setEntities(entities.filter((c) => c.id !== entityActual.id))
      setShowDeleteModal(false)
      setEntityActual(null)
    } catch (err) {
    }
  }

  const guardarEntity = async () => {
    const metodo = entityActual ? "PUT" : "POST"
    const url = entityActual
      ? `${API_BASE}${config.apiPrefix}/update/${entityActual.id}`
      : `${API_BASE}${config.apiPrefix}/register`

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
        alert(`Error al guardar: ${errorData.detail || 'Revise los datos ingresados'}`);
        return;
      }

      const saved = await res.json();

      if (entityActual) {
        setEntities(entities.map((c) => (c.id === entityActual.id ? saved : c)))
      } else {
        setEntities([...entities, saved])
      }

      setShowModal(false)
      setEntityActual(null)
      fetchEntities()
    } catch {
      alert("Error al guardar. Por favor, intente nuevamente.")
    }
  }

  const entitiesFiltrados = entities.filter((entity) =>
    `${entity.nombre} `.toLowerCase().includes(busqueda.toLowerCase())
  )
  const pageCount = Math.ceil(entitiesFiltrados.length / ENTIDADES_POR_PAGINA)
  const offsetPagina =
    Math.min(paginaActual, Math.max(0, pageCount - 1)) * ENTIDADES_POR_PAGINA
  const entitiesPaginados = entitiesFiltrados.slice(
    offsetPagina,
    offsetPagina + ENTIDADES_POR_PAGINA
  )

  useEffect(() => {
    setPaginaActual(0)
  }, [busqueda])

  return (
    <div className="container-fluid px-2 px-sm-3 px-md-4 py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
        <div>
          <h1 className="page-title mb-1">{L.title}</h1>
          <p className="text-muted mb-0">{L.subtitle}</p>
        </div>
        <Button className="btn-oxblood d-flex align-items-center gap-2" onClick={nuevoEntity}>
          <i className="bi bi-plus-lg"></i>
          {L.newEntity}
        </Button>
      </div>

      <div className="row g-3 align-items-center mb-4">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="input-group gt-search">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <Input
              type="search"
              placeholder={L.searchPlaceholder}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-line">
        <div className="table-responsive">
          <Table className="gt-table align-middle mb-0">
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Celular</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entitiesFiltrados.length > 0 ? (
                entitiesPaginados.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell className="fw-semibold">{entity.nombre}</TableCell>
                    <TableCell>{entity.direccion}</TableCell>
                    <TableCell className="text-nowrap">{entity.telefono}</TableCell>
                    <TableCell>
                      <div className="d-flex justify-content-center gap-2">
                        <button
                          className="btn-action btn-action--editar"
                          onClick={() => editarEntity(entity)}
                          title="Editar"
                        >
                          <Pencil size={16} strokeWidth={1.75} aria-hidden />
                        </button>
                        <button
                          className="btn-action btn-action--borrar"
                          onClick={() => confirmarEliminar(entity)}
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
                    {L.emptyList}
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
              {Math.min(offsetPagina + ENTIDADES_POR_PAGINA, entitiesFiltrados.length)} de{" "}
              {entitiesFiltrados.length}
            </span>
          </div>
        )}
      </div>

      <div className="card shadow-sm border-line mt-4">
        <div className="card-header bg-surface border-bottom border-line py-2">
          <h2 className="h6 mb-0 fw-semibold text-secondary">Bolsa: qué volvió</h2>
          <p className="small text-muted mb-0 mt-1">
            {L.entitySingular.charAt(0).toUpperCase() + L.entitySingular.slice(1)} → marcá lo de la bolsa → remito, salón o imprimir etiquetas. Mismo formato 50×25 mm que en Productos; las marcadas salen en un solo cuadro de impresión (una hoja por etiqueta).
          </p>
        </div>
        <div className="card-body">
          <div className="row g-2 align-items-end mb-3">
            <div className="col-12 col-md-4 col-lg-3">
              <label className="form-label small fw-semibold mb-1">{L.selectEntity}</label>
              <select
                className="form-select form-select-sm gt-select"
                value={recepcionId}
                onChange={(e) => setRecepcionId(e.target.value)}
              >
                <option value="">— Elegir —</option>
                {entities.map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-8 col-lg-9 d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline-ink btn-sm"
                disabled={
                  !recepcionId || productosEnTaller.length === 0
                }
                onClick={() => marcarTodosVolvieron(true)}
              >
                Marcar todas
              </button>
              <button
                type="button"
                className="btn btn-outline-ink btn-sm"
                disabled={
                  !recepcionId || productosEnTaller.length === 0
                }
                onClick={() => marcarTodosVolvieron(false)}
              >
                Desmarcar
              </button>
              <button
                type="button"
                className="btn btn-outline-ink btn-sm"
                disabled={!recepcionId}
                onClick={handleRemitoMarcados}
              >
                <i className="bi bi-printer me-1" aria-hidden />
                Remito
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                disabled={!recepcionId || registrandoBolsa}
                onClick={handleRegistrarSalonMarcados}
              >
                <i className="bi bi-house-door me-1" aria-hidden />
                Registrar en salón
              </button>
              <button
                type="button"
                className="btn btn-oxblood btn-sm"
                disabled={
                  !recepcionId ||
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
          {recepcionId &&
            productosEnTaller.length > 0 &&
            !cargandoPrendas && (
              <p className="small text-secondary mb-2">
                Prendas marcadas para cola:{" "}
                <strong>{productosMarcadosVolvieron.length}</strong>. Un solo “Imprimir”
                del navegador: cada etiqueta sigue siendo una hoja 50×25 mm.
              </p>
            )}
          {colaVisualEtiquetas.length > 0 && (
            <div className="border rounded mb-3 overflow-hidden bg-body">
              <div className="border-bottom px-3 py-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
                <h2 className="h6 mb-0">Cola de impresión</h2>
                {imprimiendoEtiquetas ? (
                  <span className="badge bg-oxblood">En curso</span>
                ) : (
                  <span className="badge bg-secondary">Finalizado</span>
                )}
              </div>
              <div className="p-3">
                <p className="text-muted small mb-3">
                  Misma idea que la <strong>Cola de escaneo</strong> del dashboard: una
                  fila por etiqueta. Al terminar el único envío a impresión, cada fila
                  pasa a listo o error (50×25&nbsp;mm por hoja).
                </p>
                <ul className="list-group list-group-flush border rounded">
                  {colaVisualEtiquetas.map((row) => (
                    <li
                      key={row.key}
                      className={`list-group-item d-flex flex-column flex-md-row align-items-md-center gap-2 ${
                        row.estado === "imprimiendo" ? "bg-oxblood-soft" : ""
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
                          <span className="text-oxblood small d-inline-flex align-items-center gap-2">
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
                  className="btn btn-outline-ink"
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
          {!recepcionId ? (
            <p className="text-muted small mb-0">
              {L.selectEntityHint}
            </p>
          ) : cargandoPrendas ? (
            <p className="text-muted small mb-0">Cargando…</p>
          ) : productosEnTaller.length === 0 ? (
            <p className="text-muted small mb-0">
              {L.noProducts}
            </p>
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm gt-table align-middle mb-0">
                <thead>
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
                  {productosEnTaller.map((p) => {
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
                            className="btn btn-sm btn-outline-ink"
                            title="Imprimir esta etiqueta (50×25 mm, mismo formato que Productos)"
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
        <DialogContent className="w-full border-0" dialogClassName="modal-dialog-centered modal-lg" dialogStyle={{ maxWidth: "600px", width: "95%" }}>
          <DialogHeader className="border-bottom pb-3">
            <DialogTitle className="fw-semibold">
              {entityActual ? L.editEntity : L.createEntity}
            </DialogTitle>
            <DialogDescription className="mb-0">
              {L.modalDescription}
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
            <Button variant="outline" className="btn-outline-ink" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button className="btn-oxblood" onClick={guardarEntity}>Guardar</Button>
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
              ¿Seguro querés eliminar a <strong>{entityActual?.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
          </div>
          <DialogFooter className="border-top pt-3 d-flex justify-content-end gap-2 px-3 px-md-4 pb-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={eliminarEntity}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}