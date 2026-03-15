import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, Search, LogIn, LayoutDashboard, Store } from 'lucide-react'
import { useCarrito, useAuth } from '../store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function Navbar({ onBuscar }) {
  const [busqueda, setBusqueda] = useState('')
  const items = useCarrito(s => s.items)
  const { perfil, usuario } = useAuth()
  const navigate = useNavigate()

  const totalItems = items.reduce((a, i) => a + i.cantidad, 0)

  function handleBuscar(e) {
    const val = e.target.value
    setBusqueda(val)
    if (onBuscar) onBuscar(val)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    navigate('/')
  }

  return (
    <header style={{ background: 'var(--blanco)', borderBottom: '1px solid var(--borde)', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 64 }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, background: 'var(--naranja)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Store size={20} color="white" />
          </div>
          <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 16, color: 'var(--texto)', lineHeight: 1.1 }}>
            Richard<br /><span style={{ color: 'var(--naranja)', fontSize: 12, fontWeight: 600 }}>Express Market</span>
          </span>
        </Link>

        {/* Buscador */}
        {onBuscar && (
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', maxWidth: 500, margin: '0 auto' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--texto-suave)' }} />
            <input
              value={busqueda}
              onChange={handleBuscar}
              placeholder="Buscar productos..."
              style={{ paddingLeft: 38, borderRadius: 24, background: 'var(--fondo)', border: '1.5px solid var(--borde)', width: '100%' }}
            />
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {perfil?.rol === 'admin' && (
            <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--naranja)', fontWeight: 500, padding: '6px 10px', borderRadius: 8, background: 'var(--naranja-light)' }}>
              <LayoutDashboard size={15} /> Admin
            </Link>
          )}
          {perfil?.rol === 'vendedor' && (
            <Link to="/vendedor" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--naranja)', fontWeight: 500, padding: '6px 10px', borderRadius: 8, background: 'var(--naranja-light)' }}>
              <Store size={15} /> Vender
            </Link>
          )}

          {usuario ? (
            <button onClick={handleLogout} className="btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }}>
              Salir
            </button>
          ) : (
            <Link to="/login" className="btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }}>
              <LogIn size={14} /> Ingresar
            </Link>
          )}

          <Link to="/carrito" style={{
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 42, height: 42, borderRadius: 10,
            background: totalItems > 0 ? 'var(--naranja-light)' : 'var(--fondo)',
            border: '1.5px solid var(--borde)',
            color: totalItems > 0 ? 'var(--naranja)' : 'var(--texto-suave)',
            transition: 'all 0.2s'
          }}>
            <ShoppingCart size={20} />
            {totalItems > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: 'var(--naranja)', color: 'white',
                borderRadius: '50%', width: 20, height: 20,
                fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
