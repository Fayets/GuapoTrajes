"use client";
import { ReactNode } from "react";
import { useAuth } from "@/context/auth-context";

export function RoleGate({
  allow,
  children,
}: {
  allow: ("ADMIN" | "EMPLEADO")[];
  children: ReactNode;
}) {
  const { me, loading } = useAuth();
  if (loading) return null;
  if (!me) return null;
  return allow.includes(me.role) ? <>{children}</> : null;
}
