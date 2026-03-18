import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Tag, ShoppingBag, Users, LogOut, Store, Menu, X, MessageCircle, TrendingUp, Warehouse, Tag as TagIcon, Receipt } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store'
import toast from 'react-hot-toast'

const menu = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/productos', label: 'Productos', icon: Package },
  { to: '/admin/categorias', label: 'Categorías', icon: Tag },
  { to: '/admin/almacen', label: 'Almacén', icon: Warehouse },
  { to: '/admin/pedidos', label: 'Pedidos WhatsApp', icon: MessageCircle },
  { to: '/admin/ventas', label: 'Ventas', icon: ShoppingBag },
  { to: '/admin/compras', label: 'Compras', icon: Receipt },
  { to: '/admin/analisis', label: 'Análisis', icon: TrendingUp },
  { to: '/admin/precios', label: 'Etiquetas', icon: TagIcon },
  { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
]
export default function AdminLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [sidebarAbierto, setSidebarAbierto] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    navigate('/')
  }

  const isActive = (to, exact) => exact ? pathname === to : pathname.startsWith(to)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--fondo)' }}>

      {/* Overlay mobile */}
      {sidebarAbierto && (
        <div onClick={() => setSidebarAbierto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 230, background: 'var(--blanco)', borderRight: '1px solid var(--borde)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'fixed', top: 0, left: sidebarAbierto ? 0 : -230, height: '100vh',
        zIndex: 100, transition: 'left 0.25s ease',
        '@media(min-width:768px)': { position: 'sticky' }
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--borde)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'var(--naranja)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Store size={18} color="white" />
          </div>
          <div>
            <p style={{ fontFamily: 'var(--fuente-display)', fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>Richard Express</p>
            <p style={{ fontSize: 11, color: 'var(--naranja)', fontWeight: 600 }}>Panel Admin</p>
          </div>
        </div>

        <nav style={{ padding: '12px 10px', flex: 1 }}>
          {menu.map(({ to, label, icon: Icon, exact }) => (
            <Link key={to} to={to} onClick={() => setSidebarAbierto(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, marginBottom: 2, fontSize: 14, fontWeight: 500,
                background: isActive(to, exact) ? 'var(--naranja-light)' : 'transparent',
                color: isActive(to, exact) ? 'var(--naranja)' : 'var(--texto-suave)',
                transition: 'all 0.15s'
              }}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--borde)' }}>
          <div style={{ padding: '8px 12px', marginBottom: 4 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)' }}>{perfil?.nombre || 'Admin'}</p>
            <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Administrador</p>
          </div>
          <button onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'none', color: '#D00', fontSize: 14, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#FFEEEE'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header mobile */}
        <header style={{ background: 'var(--blanco)', borderBottom: '1px solid var(--borde)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSidebarAbierto(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto)', display: 'flex', padding: 4 }}>
            <Menu size={22} />
          </button>
          <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 16 }}>Admin</span>
          <Link to="/" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--texto-suave)' }}>← Ver tienda</Link>
        </header>

        <main style={{ flex: 1, padding: '24px 16px', maxWidth: 1000, width: '100%' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
