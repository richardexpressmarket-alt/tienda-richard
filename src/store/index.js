import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useTienda = create(
  persist(
    (set, get) => ({
      tiendaActual: 'richard', // 'richard' | 'miller'
      modoOscuro: true,        // Activo por defecto para ambas tiendas
      cambiarTienda: (nuevaTienda) => set({ tiendaActual: nuevaTienda }),
      toggleModoOscuro: () => set({ modoOscuro: !get().modoOscuro }),
    }),
    { name: 'tienda-seleccionada' }
  )
)

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
          set({ items: [...items, { ...producto, cantidad: 1, tienda: producto.tienda || 'richard' }] })
        }
      },
      quitar: (id) => set({ items: get().items.filter(i => i.id !== id) }),
      cambiarCantidad: (id, cantidad) => {
        if (cantidad < 1) return
        set({ items: get().items.map(i => i.id === id ? { ...i, cantidad } : i) })
      },
      limpiar: () => set({ items: [] }),
      limpiarPorTienda: (tienda) => set({ items: get().items.filter(i => (i.tienda || 'richard') !== tienda) }),
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
