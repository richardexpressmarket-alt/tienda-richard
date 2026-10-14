import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Tag, ShoppingBag, Users, LogOut, Store, Menu, MessageCircle, TrendingUp, Warehouse, Tag as TagIcon, Receipt, BarChart2, Calculator, Cpu, Moon, Sun } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth, useTienda } from '../../store'
import toast from 'react-hot-toast'

const menu = [
  { to: '/admin',            label: 'Dashboard',        icon: LayoutDashboard, exact: true },
  { to: '/admin/productos',  label: 'Productos',         icon: Package },
  { to: '/admin/categorias', label: 'Categorías',        icon: Tag },
  { to: '/admin/almacen',    label: 'Almacén',           icon: Warehouse },
  { to: '/admin/pedidos',    label: 'Pedidos WhatsApp',  icon: MessageCircle },
  { to: '/admin/ventas',     label: 'Ventas',            icon: ShoppingBag },
  { to: '/admin/compras',    label: 'Compras',           icon: Receipt },
  { to: '/admin/inventario', label: 'Inventario',        icon: BarChart2 },
  { to: '/admin/analisis',   label: 'Análisis',          icon: TrendingUp },
  { to: '/admin/precios',    label: 'Etiquetas',         icon: TagIcon },
  { to: '/admin/calculador', label: 'Calculador',        icon: Calculator },
  { to: '/admin/usuarios',   label: 'Usuarios',          icon: Users },
]

export default function AdminLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { tiendaActual, cambiarTienda, modoOscuro, toggleModoOscuro } = useTienda()
  const esMiller = tiendaActual === 'miller'
  const [sidebarAbierto, setSidebarAbierto] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('dark-mode', modoOscuro)
  }, [modoOscuro])

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    navigate('/')
  }

  const isActive = (to, exact) => exact ? pathname === to : pathname.startsWith(to)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--fondo)', color: 'var(--texto)' }}>

      {/* Overlay mobile */}
      {sidebarAbierto && (
        <div onClick={() => setSidebarAbierto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 235, background: 'var(--blanco)', borderRight: '1px solid var(--borde)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'fixed', top: 0, left: sidebarAbierto ? 0 : -235, height: '100vh',
        zIndex: 100, transition: 'left 0.25s ease', overflowY: 'auto'
      }}>
        {/* Cabecera Dinámica según tienda */}
        <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--borde)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ 
            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: esMiller ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'var(--naranja)'
          }}>
            {esMiller ? <Cpu size={18} color="white" /> : <Store size={18} color="white" />}
          </div>
          <div>
            <p style={{ fontFamily: 'var(--fuente-display)', fontSize: 14, fontWeight: 700, lineHeight: 1.2, color: 'var(--texto)' }}>
              {esMiller ? 'Miller Digital' : 'Richard Express'}
            </p>
            <p style={{ fontSize: 11, color: esMiller ? '#06b6d4' : 'var(--naranja)', fontWeight: 600 }}>
              {esMiller ? 'Servicios & Cuentas' : 'Panel Admin'}
            </p>
          </div>
        </div>

        {/* Selector de Tienda */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--texto-suave)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
            Seleccionar Tienda
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: 'var(--borde)', padding: 3, borderRadius: 8 }}>
            <button
              onClick={() => { cambiarTienda('richard'); toast.success('Modo: Richard Express Market 🏪') }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 4px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: '0.2s',
                background: !esMiller ? 'var(--naranja)' : 'transparent',
                color: !esMiller ? '#fff' : 'var(--texto-suave)'
              }}>
              <Store size={12} /> Richard
            </button>
            <button
              onClick={() => { cambiarTienda('miller'); toast.success('Modo: Miller Digital 🚀') }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 4px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: '0.2s',
                background: esMiller ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'transparent',
                color: esMiller ? '#fff' : 'var(--texto-suave)'
              }}>
              <Cpu size={12} /> Miller
            </button>
          </div>
        </div>

        <nav style={{ padding: '12px 10px', flex: 1 }}>
          {menu.map(({ to, label, icon: Icon, exact }) => {
            const activo = isActive(to, exact)
            return (
              <Link key={to} to={to} onClick={() => setSidebarAbierto(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 10, marginBottom: 2, fontSize: 14, fontWeight: 500,
                  background: activo ? (esMiller ? 'rgba(124, 58, 237, 0.2)' : 'var(--naranja-light)') : 'transparent',
                  color: activo ? (esMiller ? '#06b6d4' : 'var(--naranja)') : 'var(--texto-suave)',
                  transition: 'all 0.15s'
                }}>
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--borde)' }}>
          <div style={{ padding: '8px 12px', marginBottom: 4 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)' }}>{perfil?.nombre || 'Admin'}</p>
            <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Administrador</p>
          </div>
          <button onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer', border: 'none' }}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header Superior */}
        <header style={{ background: 'var(--blanco)', borderBottom: '1px solid var(--borde)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSidebarAbierto(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto)', display: 'flex', padding: 4 }}>
            <Menu size={22} />
          </button>
          <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 16 }}>
            Admin · <span style={{ color: esMiller ? '#06b6d4' : 'var(--naranja)' }}>{esMiller ? 'Miller Digital' : 'Richard Express'}</span>
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Botón Modo Oscuro / Claro */}
            <button
              type="button"
              onClick={toggleModoOscuro}
              title={modoOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              style={{
                width: 34, height: 34, borderRadius: 8, border: '1px solid var(--borde)',
                background: 'var(--fondo)', color: modoOscuro ? '#fbbf24' : 'var(--texto-suave)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}>
              {modoOscuro ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              onClick={() => cambiarTienda(esMiller ? 'richard' : 'miller')}
              style={{
                padding: '5px 10px', borderRadius: 20, border: '1px solid var(--borde)', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: esMiller ? 'rgba(124, 58, 237, 0.2)' : 'var(--naranja-light)',
                color: esMiller ? '#06b6d4' : 'var(--naranja)'
              }}>
              Cambiar a {esMiller ? '🏪 Richard Express' : '🚀 Miller Digital'}
            </button>
            <Link to="/" style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600 }}>← Ver tienda</Link>
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px 16px', maxWidth: 1000, width: '100%' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
