import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuth } from './store'

import Inicio from './pages/Inicio'
import Categoria from './pages/Categoria'
import Carrito from './pages/Carrito'
import Login from './pages/Login'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminProductos from './pages/admin/AdminProductos'
import AdminCategorias from './pages/admin/AdminCategorias'
import AdminVentas from './pages/admin/AdminVentas'
import AdminUsuarios from './pages/admin/AdminUsuarios'
import AdminPedidos from './pages/admin/AdminPedidos'
import AdminAnalisis from './pages/admin/AdminAnalisis'
import AdminAlmacen from './pages/admin/AdminAlmacen'
import AdminPrecios from './pages/admin/AdminPrecios'
import VendedorLayout from './pages/vendedor/VendedorLayout'
import VendedorVenta from './pages/vendedor/VendedorVenta'
import { Navigate } from 'react-router-dom'

function RutaProtegida({ children, rol }) {
  const { perfil } = useAuth()
  if (!perfil) return <Navigate to="/login" replace />
  if (rol && perfil.rol !== rol && perfil.rol !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { setUsuario, setPerfil, logout } = useAuth()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUsuario(session.user)
        cargarPerfil(session.user.id)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUsuario(session.user)
        cargarPerfil(session.user.id)
      } else {
        logout()
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function cargarPerfil(uid) {
    const { data } = await supabase.from('perfiles').select('*').eq('id', uid).single()
    if (data) setPerfil(data)
  }

  return (
    <Routes>
      {/* RUTAS PÚBLICAS — sin login */}
      <Route path="/" element={<Inicio />} />
      <Route path="/categoria/:id" element={<Categoria />} />
      <Route path="/carrito" element={<Carrito />} />
      <Route path="/login" element={<Login />} />

      {/* RUTAS PROTEGIDAS — solo admin */}
      <Route path="/admin" element={
        <RutaProtegida rol="admin"><AdminLayout /></RutaProtegida>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="productos" element={<AdminProductos />} />
        <Route path="categorias" element={<AdminCategorias />} />
        <Route path="ventas" element={<AdminVentas />} />
        <Route path="pedidos" element={<AdminPedidos />} />
        <Route path="analisis" element={<AdminAnalisis />} />
        <Route path="almacen" element={<AdminAlmacen />} />
        <Route path="usuarios" element={<AdminUsuarios />} />
      </Route>

      {/* RUTAS PROTEGIDAS — vendedor */}
      <Route path="/vendedor" element={
        <RutaProtegida rol="vendedor"><VendedorLayout /></RutaProtegida>
      }>
        <Route index element={<VendedorVenta />} />
      </Route>
    </Routes>
  )
}
