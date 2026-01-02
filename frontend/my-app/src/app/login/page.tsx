"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Por favor ingrese usuario y contraseña");
      return;
    }

    try {
      // En un caso real, esto sería una llamada a una API
      await login(username, password);
    } catch (err) {
      setError("Credenciales inválidas");
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-sm" style={{ width: "400px" }}>
        <div className="card-header text-center bg-white border-bottom-0 pt-4">
          <h4 className="card-title fw-bold">Guapo Trajes</h4>
          <p className="card-subtitle text-muted">
            Ingrese sus credenciales para acceder al sistema
          </p>
        </div>
        <div className="card-body p-4">
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                className="alert alert-danger d-flex align-items-center"
                role="alert"
              >
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                <div>{error}</div>
              </div>
            )}
            <div className="mb-3">
              <label htmlFor="username" className="form-label">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary w-100">
              Ingresar
            </button>
          </form>
        </div>
        <div className="card-footer text-center bg-white border-top-0 pb-4">
          <p className="text-muted small mb-0">
            Sistema de Administración Interna
          </p>
        </div>
      </div>
    </div>
  );
}
