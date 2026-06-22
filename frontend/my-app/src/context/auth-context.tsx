// context/auth-context.tsx
"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { clearScanQueue } from "@/lib/scan-queue";

type Rol = "ADMIN" | "EMPLEADO" | "SUPER_ADMIN";
type Me = {
  id: number;
  email: string;
  role: Rol;
  sucursalNombre?: string | null;
  sucursalId?: number | null;
};

interface AuthContextType {
  token: string | null;
  me: Me | null;
  loading: boolean;
  isAdmin: boolean;
  isEmpleado: boolean;
  isSuperAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Llama a /auth/me usando el token actual
  const fetchMe = async (tkn: string) => {
    const res = await apiFetch("/auth/me", { token: tkn });
    if (!res.ok) throw new Error("Unauthorized");
    const raw = await res.json();
    const normalized: Me = {
      id: raw.id,
      email: raw.email,
      role: (raw.role ?? raw.rol) as Rol,
      sucursalNombre:
        raw.sucursal?.nombre ??
        raw.sucursal_nombre ??
        raw.sucursalName ??
        null,
      sucursalId: raw.sucursal?.id ?? raw.sucursal_id ?? null,
    };
    setMe(normalized);
  };

  // Expuesto por si querés forzar relectura (ej: tras actualizar perfil)
  const refreshMe = async () => {
    if (!token) return;
    await fetchMe(token);
  };

  // Hidratar desde localStorage al cargar
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    (async () => {
      try {
        if (storedToken) {
          setToken(storedToken);
          await fetchMe(storedToken);
        }
      } catch {
        // token inválido/expirado
        localStorage.removeItem("token");
        clearScanQueue();
        setToken(null);
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        skipAuthRedirect: true,
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error("Credenciales inválidas");
      const data = await response.json();

      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);

      await fetchMe(data.access_token); // ← acá sincronizamos /auth/me
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    clearScanQueue();
    setToken(null);
    setMe(null);
    router.push("/login");
  };

  const isAdmin = me?.role === "ADMIN";
  const isEmpleado = me?.role === "EMPLEADO";
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  return (
    <AuthContext.Provider
      value={{
        token,
        me,
        loading,
        isAdmin,
        isEmpleado,
        isSuperAdmin,
        login,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de un AuthProvider");
  return ctx;
};
