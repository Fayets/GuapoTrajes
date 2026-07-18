"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
    <div className="login-page d-flex align-items-center justify-content-center min-vh-100 px-3">
      <div className="login-card w-100">
        <div className="login-card__accent" aria-hidden />
        <div className="text-center pt-4 px-4">
          <div className="d-flex justify-content-center mb-2">
            <Image
              src="/guapo-logo.png"
              alt="GUAPO - Alquiler y Venta de Trajes"
              width={180}
              height={135}
              priority
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>
        <div className="p-4 pt-3">
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="login-error d-flex align-items-center" role="alert">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                <div>{error}</div>
              </div>
            )}
            <div className="mb-3">
              <label htmlFor="username" className="login-label form-label">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                className="form-control login-input"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="login-label form-label">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className="form-control login-input"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-oxblood login-submit w-100">
              Ingresar
            </button>
          </form>
        </div>
        <div className="login-footer text-center pb-4 px-4">
          <span className="login-divider" aria-hidden />
          <p className="mb-0">Sistema de Administración Interna</p>
        </div>
      </div>
    </div>
  );
}
