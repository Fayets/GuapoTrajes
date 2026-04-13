import React from "react"

export type ClienteFormData = {
  nombre: string
  apellido: string
  dni: string
  direccion: string
  celular: string
  notas: string
  fecha_nacimiento: string
}

type ClienteModalProps = {
  show: boolean
  formData: ClienteFormData
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClose: () => void
  onSave: () => void
  modoEdicion?: boolean
  /** Solo true al convertir precliente → cliente (misma pantalla u otras). */
  esConversionPrecliente?: boolean
}

const camposTexto: { key: keyof ClienteFormData; label: string; requeridoEnConversion?: boolean }[] = [
  { key: "apellido", label: "Apellido" },
  { key: "nombre", label: "Nombre" },
  { key: "dni", label: "DNI", requeridoEnConversion: true },
  { key: "direccion", label: "Dirección", requeridoEnConversion: true },
  { key: "celular", label: "Celular" },
  { key: "notas", label: "Notas" },
]

export default function ClienteModal({
  show,
  formData,
  onChange,
  onClose,
  onSave,
  modoEdicion = false,
  esConversionPrecliente = false,
}: ClienteModalProps) {
  const titulo = modoEdicion
    ? "Editar cliente"
    : esConversionPrecliente
      ? "Convertir a cliente"
      : "Nuevo cliente"

  return (
    <>
      <div
        className={`modal fade ${show ? "show" : ""}`}
        style={{ display: show ? "block" : "none" }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{titulo}</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {esConversionPrecliente && !modoEdicion && (
                <div className="alert alert-info mb-3">
                  <i className="bi bi-info-circle me-2"></i>
                  <strong>Información:</strong> El DNI es obligatorio para convertir un precliente a cliente.
                </div>
              )}
              <form>
                {camposTexto.map(({ key, label, requeridoEnConversion }) => (
                  <div className="mb-3" key={key}>
                    <label htmlFor={key} className="form-label">
                      {label}
                      {key === "dni" && esConversionPrecliente && !modoEdicion && (
                        <span className="text-danger"> *</span>
                      )}
                      {key === "direccion" && esConversionPrecliente && !modoEdicion && (
                        <span className="text-danger"> *</span>
                      )}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id={key}
                      name={key}
                      value={formData[key]}
                      onChange={onChange}
                      required={esConversionPrecliente && !modoEdicion && Boolean(requeridoEnConversion)}
                    />
                  </div>
                ))}
                <div className="mb-3">
                  <label htmlFor="fecha_nacimiento" className="form-label">
                    Fecha de nacimiento <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    id="fecha_nacimiento"
                    name="fecha_nacimiento"
                    value={formData.fecha_nacimiento}
                    onChange={onChange}
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={onSave}>
                {modoEdicion ? "Actualizar" : esConversionPrecliente ? "Convertir" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className={`modal-backdrop fade ${show ? "show" : ""}`}
        style={{ display: show ? "block" : "none" }}
      ></div>
    </>
  )
}
