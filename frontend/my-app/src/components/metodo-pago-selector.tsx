"use client"

import { useEffect, useState, useCallback } from "react"
import { getApiBaseUrl } from "@/lib/api-config"
import { useAuth } from "@/context/auth-context"
import { toast } from "sonner"
import { formatPesosAr } from "@/lib/money"

/** ID sintético para “pago con saldo a favor” (no existe en BD de métodos configurables). */
export const METODO_PAGO_CUENTA_CORRIENTE_ID = -9000001

export type MetodoPagoComplemento = {
  metodoId: number | null
  submetodoId: number | null
  display: string
}

interface MetodoPago {
  id: number
  nombre: string
  activo: boolean
  tiene_submetodos: boolean
  orden: number
  submétodos: SubmetodoPago[]
}

interface SubmetodoPago {
  id: number
  nombre: string
  activo: boolean
  orden: number
}

interface MetodoPagoSelectorProps {
  sucursalId?: number | null
  metodoPagoId?: number | null
  submetodoPagoId?: number | null
  onMetodoChange: (
    metodoId: number | null,
    submetodoId: number | null,
    metodoDisplay: string,
    complemento?: MetodoPagoComplemento | null
  ) => void
  required?: boolean
  className?: string
  label?: string
  showError?: boolean
  /**
   * null = no ofrecer cuenta corriente (ej. precliente).
   * number (incluye 0) = cliente con CC: se muestra la opción junto al resto; con saldo 0 queda visible pero no seleccionable.
   */
  saldoCuentaCorriente?: number | null
  /** Monto del pago/seña (para saber si hace falta un método complementario al usar saldo). */
  montoReferencia?: number | null
}

export function MetodoPagoSelector({
  sucursalId,
  metodoPagoId: controlledMetodoPagoId,
  submetodoPagoId: controlledSubmetodoPagoId,
  onMetodoChange,
  required = false,
  className = "",
  label = "Método de pago",
  showError = false,
  saldoCuentaCorriente = null,
  montoReferencia = null,
}: MetodoPagoSelectorProps) {
  const { me } = useAuth()
  const [metodos, setMetodos] = useState<MetodoPago[]>([])
  const [loading, setLoading] = useState(true)
  const [metodoPagoId, setMetodoPagoId] = useState<number | null>(controlledMetodoPagoId ?? null)
  const [submetodoPagoId, setSubmetodoPagoId] = useState<number | null>(controlledSubmetodoPagoId ?? null)
  const [complementoMetodoId, setComplementoMetodoId] = useState<number | null>(null)
  const [complementoSubmetodoId, setComplementoSubmetodoId] = useState<number | null>(null)

  const API_BASE = getApiBaseUrl()

  const saldoNumero =
    typeof saldoCuentaCorriente === "number" && !Number.isNaN(saldoCuentaCorriente)
      ? saldoCuentaCorriente
      : null
  const mostrarOpcionCC = saldoNumero !== null
  const saldoCC = saldoNumero !== null ? Math.max(0, saldoNumero) : 0
  const puedeUsarSaldoCC = saldoCC > 1e-9
  const montoRef = typeof montoReferencia === "number" && !Number.isNaN(montoReferencia) ? montoReferencia : 0
  const necesitaComplemento =
    metodoPagoId === METODO_PAGO_CUENTA_CORRIENTE_ID && saldoCC > 0 && montoRef > saldoCC + 1e-9

  const emitirCambio = useCallback(
    (
      mid: number | null,
      sid: number | null,
      display: string,
      compMid?: number | null,
      compSid?: number | null,
      compDisplay?: string
    ) => {
      let complemento: MetodoPagoComplemento | null = null
      if (
        mid === METODO_PAGO_CUENTA_CORRIENTE_ID &&
        montoRef > saldoCC + 1e-9 &&
        compMid != null &&
        compDisplay
      ) {
        complemento = {
          metodoId: compMid,
          submetodoId: compSid ?? null,
          display: compDisplay,
        }
      }
      onMetodoChange(mid, sid, display, complemento)
    },
    [onMetodoChange, montoRef, saldoCC]
  )

  useEffect(() => {
    if (controlledMetodoPagoId !== undefined) {
      setMetodoPagoId(controlledMetodoPagoId)
    }
  }, [controlledMetodoPagoId])

  useEffect(() => {
    if (controlledSubmetodoPagoId !== undefined) {
      setSubmetodoPagoId(controlledSubmetodoPagoId)
    }
  }, [controlledSubmetodoPagoId])

  useEffect(() => {
    if (metodoPagoId !== METODO_PAGO_CUENTA_CORRIENTE_ID) {
      setComplementoMetodoId(null)
      setComplementoSubmetodoId(null)
    }
  }, [metodoPagoId])

  useEffect(() => {
    const cargarMetodos = async () => {
      setLoading(true)
      try {
        const targetSucursalId = sucursalId || me?.sucursalId

        if (!targetSucursalId) {
          console.warn("⚠️ No se pudo determinar la sucursal para cargar métodos de pago")
          setMetodos([])
          return
        }

        const token = localStorage.getItem("token")
        const response = await fetch(`${API_BASE}/metodos-pago/sucursal/${targetSucursalId}?solo_activos=true`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        if (data.success && data.data) {
          setMetodos(data.data)
        } else {
          throw new Error("Formato de respuesta inválido")
        }
      } catch (error: unknown) {
        console.error("Error al cargar métodos de pago:", error)
        toast.error("Error al cargar métodos de pago")
        setMetodos([])
      } finally {
        setLoading(false)
      }
    }

    if (me) {
      cargarMetodos()
    }
  }, [me, sucursalId, API_BASE])

  const handleMetodoSelect = (metodoId: number) => {
    const metodo = metodos.find((m) => m.id === metodoId)
    if (!metodo) return

    setMetodoPagoId(metodoId)
    setComplementoMetodoId(null)
    setComplementoSubmetodoId(null)

    if (!metodo.tiene_submetodos) {
      setSubmetodoPagoId(null)
      const metodoDisplay = metodo.nombre
      emitirCambio(metodoId, null, metodoDisplay)
    } else {
      const submetodosIds = metodo.submétodos.map((s) => s.id)
      const currentSubmetodoValid = submetodoPagoId && submetodosIds.includes(submetodoPagoId)

      if (!currentSubmetodoValid) {
        setSubmetodoPagoId(null)
      }

      emitirCambio(metodoId, null, metodo.nombre)
    }
  }

  const handleSubmetodoSelect = (submetodoId: number) => {
    setSubmetodoPagoId(submetodoId)
    const metodo = metodos.find((m) => m.id === metodoPagoId)
    const submetodo = metodo?.submétodos.find((s) => s.id === submetodoId)

    if (metodo && submetodo) {
      const metodoDisplay = `${metodo.nombre} - ${submetodo.nombre}`
      emitirCambio(metodoPagoId!, submetodoId, metodoDisplay)
    }
  }

  const handleCuentaCorrienteSelect = () => {
    if (!mostrarOpcionCC) return
    if (!puedeUsarSaldoCC) {
      toast.error("No hay saldo a favor en cuenta corriente. Elegí otro método o cargá crédito en Clientes.")
      return
    }
    setMetodoPagoId(METODO_PAGO_CUENTA_CORRIENTE_ID)
    setSubmetodoPagoId(null)
    setComplementoMetodoId(null)
    setComplementoSubmetodoId(null)
    const labelCC = "Saldo a favor (cuenta corriente)"
    emitirCambio(METODO_PAGO_CUENTA_CORRIENTE_ID, null, labelCC)
  }

  const handleComplementoMetodoSelect = (metodoId: number) => {
    const metodo = metodos.find((m) => m.id === metodoId)
    if (!metodo) return
    setComplementoMetodoId(metodoId)
    setComplementoSubmetodoId(null)
    if (!metodo.tiene_submetodos) {
      emitirCambio(
        METODO_PAGO_CUENTA_CORRIENTE_ID,
        null,
        "Saldo a favor (cuenta corriente)",
        metodoId,
        null,
        metodo.nombre
      )
    }
    /* Si tiene submétodos, el padre recibe el complemento al elegir el submétodo */
  }

  const handleComplementoSubmetodoSelect = (submetodoId: number) => {
    setComplementoSubmetodoId(submetodoId)
    const metodo = metodos.find((m) => m.id === complementoMetodoId)
    const submetodo = metodo?.submétodos.find((s) => s.id === submetodoId)
    if (metodo && submetodo) {
      emitirCambio(
        METODO_PAGO_CUENTA_CORRIENTE_ID,
        null,
        "Saldo a favor (cuenta corriente)",
        metodo.id,
        submetodoId,
        `${metodo.nombre} - ${submetodo.nombre}`
      )
    }
  }

  const displayMetodoNombre = (nombre: string) =>
    nombre === "Billetera Virtual" ? "Transferencia" : nombre

  const metodosParaMostrar = metodos.filter((m) => {
    if (m.nombre === "Billetera Virtual") {
      const hayTransferencia = metodos.some((x) => x.nombre === "Transferencia")
      return !hayTransferencia
    }
    return true
  })

  const esCC = metodoPagoId === METODO_PAGO_CUENTA_CORRIENTE_ID
  const metodoSeleccionado = esCC ? null : metodos.find((m) => m.id === metodoPagoId)
  const submetodosDisponibles = metodoSeleccionado?.tiene_submetodos
    ? metodoSeleccionado.submétodos.filter((s) => s.activo)
    : []

  const metodoComplementoSel = metodos.find((m) => m.id === complementoMetodoId)
  const subComplementoDisponibles =
    metodoComplementoSel?.tiene_submetodos && necesitaComplemento
      ? metodoComplementoSel.submétodos.filter((s) => s.activo)
      : []

  if (loading) {
    return (
      <div className={className}>
        <label className="form-label fw-bold">
          {label}
          {required && " *"}
        </label>
        <div className="text-muted">Cargando métodos de pago...</div>
      </div>
    )
  }

  if (metodos.length === 0 && !mostrarOpcionCC) {
    return (
      <div className={className}>
        <label className="form-label fw-bold">
          {label}
          {required && " *"}
        </label>
        <div className="text-warning">No hay métodos de pago disponibles</div>
      </div>
    )
  }

  return (
    <div className={className}>
      <label className="form-label fw-bold">
        {label}
        {required && " *"}
      </label>

      <div className="row g-3 mt-1">
        {mostrarOpcionCC && (
          <div className="col-12 col-md-6">
            <div
              className={`border rounded-3 p-3 h-100 d-flex align-items-center gap-3 transition ${
                esCC && puedeUsarSaldoCC
                  ? "border-success bg-success bg-opacity-10"
                  : puedeUsarSaldoCC
                    ? "border-light bg-white"
                    : "border-secondary bg-light bg-opacity-50"
              }`}
              role="button"
              onClick={handleCuentaCorrienteSelect}
              style={{ cursor: "pointer" }}
            >
              <div className="form-check m-0">
                <input
                  type="radio"
                  name="metodoPago"
                  value={METODO_PAGO_CUENTA_CORRIENTE_ID}
                  checked={esCC && puedeUsarSaldoCC}
                  disabled={!puedeUsarSaldoCC}
                  onChange={handleCuentaCorrienteSelect}
                  className="form-check-input"
                />
              </div>
              <div>
                <span className="fw-semibold d-block">Cuenta corriente</span>
                <span className="small text-muted">
                  Saldo disponible: ${formatPesosAr(saldoCC)}
                </span>
              </div>
            </div>
          </div>
        )}

        {metodosParaMostrar
          .filter((m) => m.activo)
          .sort((a, b) => a.orden - b.orden)
          .map((metodo) => {
            const activo = !esCC && metodoPagoId === metodo.id
            return (
              <div className="col-12 col-md-6" key={metodo.id}>
                <div
                  className={`border rounded-3 p-3 h-100 d-flex align-items-center gap-3 transition ${
                    activo ? "border-primary bg-primary bg-opacity-10" : "border-light bg-white"
                  }`}
                  role="button"
                  onClick={() => handleMetodoSelect(metodo.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="form-check m-0">
                    <input
                      type="radio"
                      name="metodoPago"
                      value={metodo.id}
                      checked={activo}
                      onChange={() => handleMetodoSelect(metodo.id)}
                      className="form-check-input"
                    />
                  </div>
                  <div>
                    <span className="fw-semibold d-block">{displayMetodoNombre(metodo.nombre)}</span>
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {metodoSeleccionado && metodoSeleccionado.tiene_submetodos && submetodosDisponibles.length > 0 && (
        <div className="mt-3">
          <label className="form-label fw-semibold">
            Submétodo de {displayMetodoNombre(metodoSeleccionado.nombre)} *
          </label>
          <div className="row g-3 mt-1">
            {submetodosDisponibles
              .sort((a, b) => a.orden - b.orden)
              .map((submetodo) => {
                const activo = submetodoPagoId === submetodo.id
                return (
                  <div className="col-12 col-md-6" key={submetodo.id}>
                    <div
                      className={`border rounded-3 p-3 h-100 d-flex align-items-center gap-3 transition ${
                        activo ? "border-success bg-success bg-opacity-10" : "border-light bg-white"
                      }`}
                      role="button"
                      onClick={() => handleSubmetodoSelect(submetodo.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="form-check m-0">
                        <input
                          type="radio"
                          name="submetodoPago"
                          value={submetodo.id}
                          checked={activo}
                          onChange={() => handleSubmetodoSelect(submetodo.id)}
                          className="form-check-input"
                        />
                      </div>
                      <div>
                        <span className="fw-semibold d-block">{displayMetodoNombre(submetodo.nombre)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
          {!submetodoPagoId && (
            <div className="text-danger small mt-2">
              Debes seleccionar un submétodo de {displayMetodoNombre(metodoSeleccionado.nombre)}
            </div>
          )}
        </div>
      )}

      {necesitaComplemento && (
        <div className="mt-4 p-3 border rounded bg-light">
          <p className="small fw-semibold mb-2">
            El saldo a favor cubre ${formatPesosAr(saldoCC)} de ${formatPesosAr(montoRef)}. Indicá cómo se registra el
            resto (${formatPesosAr(montoRef - saldoCC)}):
          </p>
          <div className="row g-2">
            {metodosParaMostrar
              .filter((m) => m.activo)
              .sort((a, b) => a.orden - b.orden)
              .map((metodo) => {
                const activo = complementoMetodoId === metodo.id
                return (
                  <div className="col-12 col-md-6" key={`comp-${metodo.id}`}>
                    <div
                      className={`border rounded-3 p-2 d-flex align-items-center gap-2 ${
                        activo ? "border-primary bg-white" : "bg-white"
                      }`}
                      role="button"
                      onClick={() => handleComplementoMetodoSelect(metodo.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <input
                        type="radio"
                        name="metodoComplemento"
                        checked={activo}
                        onChange={() => handleComplementoMetodoSelect(metodo.id)}
                        className="form-check-input m-0"
                      />
                      <span className="small fw-semibold">{displayMetodoNombre(metodo.nombre)}</span>
                    </div>
                  </div>
                )
              })}
          </div>
          {metodoComplementoSel?.tiene_submetodos && subComplementoDisponibles.length > 0 && (
            <div className="row g-2 mt-2">
              {subComplementoDisponibles
                .sort((a, b) => a.orden - b.orden)
                .map((sub) => {
                  const activo = complementoSubmetodoId === sub.id
                  return (
                    <div className="col-12 col-md-6" key={`compsub-${sub.id}`}>
                      <div
                        className={`border rounded-3 p-2 d-flex align-items-center gap-2 ${
                          activo ? "border-success bg-white" : "bg-white"
                        }`}
                        role="button"
                        onClick={() => handleComplementoSubmetodoSelect(sub.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="radio"
                          name="subComplemento"
                          checked={activo}
                          onChange={() => handleComplementoSubmetodoSelect(sub.id)}
                          className="form-check-input m-0"
                        />
                        <span className="small fw-semibold">{displayMetodoNombre(sub.nombre)}</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {showError && required && !metodoPagoId && (
        <div className="text-danger small mt-3">Debes seleccionar un método de pago</div>
      )}

      {showError &&
        metodoSeleccionado &&
        metodoSeleccionado.tiene_submetodos &&
        !submetodoPagoId && (
          <div className="text-danger small mt-3">Debes seleccionar un submétodo</div>
        )}

      {showError && necesitaComplemento && (!complementoMetodoId || (metodoComplementoSel?.tiene_submetodos && !complementoSubmetodoId)) && (
        <div className="text-danger small mt-2">Completá el método para el importe restante</div>
      )}
    </div>
  )
}
