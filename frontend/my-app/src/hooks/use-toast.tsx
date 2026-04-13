"use client"

import { useState } from "react"

type ToastType = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  title: string
  description?: string
  type: ToastType
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = (title: string, description?: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = { id, title, description, type }

    setToasts((prev) => [...prev, newToast])

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      dismissToast(id)
    }, 5000)

    return id
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  return {
    toasts,
    toast,
    dismissToast,
    success: (title: string, description?: string) => toast(title, description, "success"),
    error: (title: string, description?: string) => toast(title, description, "error"),
    warning: (title: string, description?: string) => toast(title, description, "warning"),
    info: (title: string, description?: string) => toast(title, description, "info"),
  }
}

