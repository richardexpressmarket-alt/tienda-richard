import { Outlet, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store'
import { Store, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

export default function VendedorLayout() {
  const navigate = useNavigate()
  const { perfil } = useAuth()

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo)' }}>
      <header style={{ background: 'var(--blanco)', borderBottom: '1px solid var(--borde)', padding: '0 16px', height: 58, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 34, height: 34, background: 'var(--naranja)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Store size={18} color="white" />
        </div>
        <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 16 }}>Punto de Venta</span>
        <span style={{ fontSize: 13, color: 'var(--texto-suave)', marginLeft: 4 }}>· {perfil?.nombre}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <Link to="/" style={{ fontSize: 13, color: 'var(--texto-suave)' }}>← Tienda</Link>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#D00', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>
      <main style={{ padding: '20px 16px', maxWidth: 900, margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
