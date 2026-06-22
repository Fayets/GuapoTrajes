import React from "react"

type FormData = {
  nombre: string
  apellido: string
  dni: string
  direccion: string
  celular: string
  fecha_nacimiento: string
  notas: string
}

type ClienteModalProps = {
  show: boolean
  formData: FormData
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClose: () => void
  onSave: () => void
  modoEdicion?: boolean
}

const CAMPOS_TEXTO: Array<{
  key: keyof FormData
  label: string
  requeridoEnAlta?: boolean
}> = [
  { key: "apellido", label: "Apellido" },
  { key: "nombre", label: "Nombre" },
  { key: "dni", label: "DNI", requeridoEnAlta: true },
  { key: "direccion", label: "Dirección", requeridoEnAlta: true },
  { key: "celular", label: "Celular" },
  { key: "notas", label: "Notas" },
]

export default function ClienteModal({
  show,
  formData,
  onChange,
  onClose,
  onSave,
  modoEdicion = false
}: ClienteModalProps) {
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
              <h5 className="modal-title">{modoEdicion ? "Editar Cliente" : "Convertir a Cliente"}</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {!modoEdicion && (
                <div className="alert alert-info mb-3">
                  <i className="bi bi-info-circle me-2"></i>
                  <strong>Información:</strong> El DNI es obligatorio para convertir un precliente a cliente.
                </div>
              )}
              <form>
                {CAMPOS_TEXTO.slice(0, 5).map(({ key, label, requeridoEnAlta }) => (
                  <div className="mb-3" key={key}>
                    <label htmlFor={key} className="form-label">
                      {label}
                      {requeridoEnAlta && !modoEdicion && <span className="text-danger"> *</span>}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id={key}
                      name={key}
                      value={formData[key]}
                      onChange={onChange}
                      required={!modoEdicion && !!requeridoEnAlta}
                    />
                  </div>
                ))}
                <div className="mb-3">
                  <label htmlFor="fecha_nacimiento" className="form-label">
                    Fecha de nacimiento
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
                {CAMPOS_TEXTO.slice(5).map(({ key, label }) => (
                  <div className="mb-3" key={key}>
                    <label htmlFor={key} className="form-label">
                      {label}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id={key}
                      name={key}
                      value={formData[key]}
                      onChange={onChange}
                    />
                  </div>
                ))}
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={onSave}>
                {modoEdicion ? "Actualizar" : "Convertir"}
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
