import React from "react"

type FormData = {
  nombre: string
  apellido: string
  dni: string
  direccion: string
  celular: string
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
                {["nombre", "apellido", "dni", "direccion", "celular", "notas"].map((campo) => (
                  <div className="mb-3" key={campo}>
                    <label htmlFor={campo} className="form-label text-capitalize">
                      {campo}
                      {campo === "dni" && !modoEdicion && <span className="text-danger"> *</span>}
                      {campo === "direccion" && !modoEdicion && <span className="text-danger"> *</span>}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id={campo}
                      name={campo}
                      value={formData[campo as keyof FormData]}
                      onChange={onChange}
                      required={!modoEdicion && (campo === "dni" || campo === "direccion")}
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
