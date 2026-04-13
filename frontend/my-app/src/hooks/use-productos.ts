import { useEffect, useState } from "react"

export function useProductos() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchProductos = async () => {
    setLoading(true)
    const res = await fetch("/api/productos")
    const data = await res.json()
    setProductos(data)
    setLoading(false)
  }

  const crearProducto = async (nuevoProducto: any) => {
    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevoProducto),
    })
    if (res.ok) await fetchProductos()
  }

  const actualizarProducto = async (id: string | number, cambios: any) => {
    const res = await fetch(`/api/productos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    })
    if (res.ok) await fetchProductos()
  }

  const eliminarProducto = async (id: string | number) => {
    const res = await fetch(`/api/productos/${id}`, {
      method: "DELETE",
    })
    if (res.ok) await fetchProductos()
  }

  useEffect(() => {
    fetchProductos()
  }, [])

  return {
    productos,
    loading,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
  }
}
