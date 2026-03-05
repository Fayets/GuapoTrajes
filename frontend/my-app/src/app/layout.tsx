import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css" // Importación correcta
import { AuthProvider } from "@/context/auth-context"
import { SucursalProvider } from "@/context/sucursal-context"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false, // evita el aviso "preloaded but not used" en consola
})

export const metadata: Metadata = {
  title: "Guapo Trajes - Sistema de Administración",
  description: "Sistema de administración interna para Guapo Trajes",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <head>
        {/* Bootstrap CSS */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
          rel="stylesheet"
          integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN"
          crossOrigin="anonymous"
        />
        {/* Bootstrap Icons */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <SucursalProvider>{children}</SucursalProvider>
        </AuthProvider>

        {/* Bootstrap JavaScript */}
        <script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"
          integrity="sha384-C6RzsynM9kWDrMNeT87bh95OGNyZPhcTNXj1NW7RuBCsyN/o0jlpcV8Qyq46cDfL"
          crossOrigin="anonymous"
          defer
        />
      </body>
    </html>
  )
}

