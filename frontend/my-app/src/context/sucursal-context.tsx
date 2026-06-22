"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { fetchSucursales } from "@/lib/fetch-productos";

export type Sucursal = {
  id: number;
  nombre: string;
  direccion: string;
  provincia: string;
};

type SucursalContextType = {
  sucursales: Sucursal[];
  sucursalActual: Sucursal | null;
  isLoading: boolean;
  error: string | null;
  seleccionarSucursal: (sucursal: Sucursal) => void;
  refrescarSucursales: () => Promise<void>;
};

const SucursalContext = createContext<SucursalContextType | undefined>(undefined);

export function SucursalProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalActual, setSucursalActual] = useState<Sucursal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescarSucursales = useCallback(async () => {
    if (!token) {
      setSucursales([]);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchSucursales(token);
      setSucursales(data);

      setSucursalActual((prev) => {
        if (prev) {
          const match = data.find((s) => s.id === prev.id);
          if (match) return match;
        }
        const sucursalGuardada = localStorage.getItem("sucursalActual");
        if (sucursalGuardada) {
          try {
            const parsed = JSON.parse(sucursalGuardada) as Sucursal;
            const match = data.find((s) => s.id === parsed.id);
            if (match) return match;
          } catch {
            localStorage.removeItem("sucursalActual");
          }
        }
        if (data.length > 0) {
          localStorage.setItem("sucursalActual", JSON.stringify(data[0]));
          return data[0];
        }
        return null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar sucursales");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refrescarSucursales();
  }, [refrescarSucursales]);

  const seleccionarSucursal = (sucursal: Sucursal) => {
    setSucursalActual(sucursal);
    localStorage.setItem("sucursalActual", JSON.stringify(sucursal));
  };

  return (
    <SucursalContext.Provider
      value={{
        sucursales,
        sucursalActual,
        isLoading,
        error,
        seleccionarSucursal,
        refrescarSucursales,
      }}
    >
      {children}
    </SucursalContext.Provider>
  );
}

export function useSucursal() {
  const context = useContext(SucursalContext);
  if (context === undefined) {
    throw new Error("useSucursal debe ser usado dentro de un SucursalProvider");
  }
  return context;
}
