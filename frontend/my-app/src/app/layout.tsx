import type React from "react"
import type { Metadata } from "next"
import { Inter, Fraunces } from "next/font/google"
import "./globals.css" // Importación correcta
import { AuthProvider } from "@/context/auth-context"
import { SucursalProvider } from "@/context/sucursal-context"
import { ToasterProvider } from "@/components/toaster-provider"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false, // evita el aviso "preloaded but not used" en consola
})

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  weight: ["600"],
  variable: "--font-fraunces",
  preload: false,
})

export const metadata: Metadata = {
  title: "Guapo Trajes - Sistema de Administración",
  description: "Sistema de administración interna para Guapo Trajes",
  applicationName: "Guapo Trajes",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" />
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
      <body className={`${inter.className} ${fraunces.variable}`}>
        <AuthProvider>
          <SucursalProvider>
            {children}
            <ToasterProvider />
          </SucursalProvider>
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

