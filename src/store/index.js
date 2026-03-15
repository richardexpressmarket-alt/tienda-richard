import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCarrito = create(
  persist(
    (set, get) => ({
      items: [],
      agregar: (producto) => {
        const items = get().items
        const existente = items.find(i => i.id === producto.id)
        if (existente) {
          set({ items: items.map(i => i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i) })
        } else {
          set({ items: [...items, { ...producto, cantidad: 1 }] })
        }
      },
      quitar: (id) => set({ items: get().items.filter(i => i.id !== id) }),
      cambiarCantidad: (id, cantidad) => {
        if (cantidad < 1) return
        set({ items: get().items.map(i => i.id === id ? { ...i, cantidad } : i) })
      },
      limpiar: () => set({ items: [] }),
      total: () => get().items.reduce((acc, i) => acc + i.precio * i.cantidad, 0),
      cantidad: () => get().items.reduce((acc, i) => acc + i.cantidad, 0),
    }),
    { name: 'carrito-richard' }
  )
)

export const useAuth = create((set) => ({
  usuario: null,
  perfil: null,
  setUsuario: (usuario) => set({ usuario }),
  setPerfil: (perfil) => set({ perfil }),
  logout: () => set({ usuario: null, perfil: null }),
}))
