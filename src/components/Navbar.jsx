import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, Search, LogIn, LayoutDashboard, Store, Cpu, User } from 'lucide-react'
import { useCarrito, useAuth, useTienda } from '../store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function Navbar({ onBuscar }) {
  const [busqueda, setBusqueda] = useState('')
  const items = useCarrito(s => s.items)
  const { perfil, usuario } = useAuth()
  const { tiendaActual, cambiarTienda } = useTienda()
  const esMiller = tiendaActual === 'miller'
  const navigate = useNavigate()

  const totalItems = items.reduce((a, i) => a + i.cantidad, 0)

  function handleBuscar(e) {
    const val = e.target.value
    setBusqueda(val)
    if (onBuscar) onBuscar(val)
  }

  function handleCambiarTienda(nueva) {
    if (nueva === tiendaActual) return
    cambiarTienda(nueva)
    setBusqueda('')
    if (onBuscar) onBuscar('')
    navigate('/')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    navigate('/')
  }

  return (
    <header style={{
      background: esMiller ? 'rgba(15, 23, 42, 0.95)' : 'var(--blanco)',
      borderBottom: esMiller ? '1px solid rgba(124, 58, 237, 0.35)' : '1px solid var(--borde)',
      position: 'sticky', top: 0, zIndex: 100,
      boxShadow: esMiller ? '0 4px 20px rgba(124, 58, 237, 0.15)' : '0 2px 8px rgba(0,0,0,0.06)',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 68, flexWrap: 'wrap' }}>

        {/* Logo dinámico */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36,
            background: esMiller ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'var(--naranja)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {esMiller ? <Cpu size={20} color="white" /> : <Store size={20} color="white" />}
          </div>
          <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 15, color: esMiller ? '#ffffff' : 'var(--texto)', lineHeight: 1.1 }}>
            {esMiller ? 'Miller' : 'Richard'}<br />
            <span style={{ color: esMiller ? '#06b6d4' : 'var(--naranja)', fontSize: 11, fontWeight: 600 }}>
              {esMiller ? 'Digital Store' : 'Express Market'}
            </span>
          </span>
        </Link>

        {/* Selector de Tienda en Vivo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: 3, borderRadius: 20,
          background: esMiller ? '#1e293b' : 'var(--fondo)',
          border: esMiller ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid var(--borde)'
        }}>
          <button
            type="button"
            onClick={() => handleCambiarTienda('richard')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: '0.2s',
              background: !esMiller ? 'var(--naranja)' : 'transparent',
              color: !esMiller ? '#fff' : '#94a3b8'
            }}>
            <Store size={12} /> Richard Market
          </button>
          <button
            type="button"
            onClick={() => handleCambiarTienda('miller')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: '0.2s',
              background: esMiller ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'transparent',
              color: esMiller ? '#fff' : 'var(--texto-suave)'
            }}>
            <Cpu size={12} /> Miller Digital
          </button>
        </div>

        {/* Buscador exclusivo de la tienda activa */}
        {onBuscar && (
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', maxWidth: 420, minWidth: 160, margin: '0 auto' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, color: esMiller ? '#94a3b8' : 'var(--texto-suave)' }} />
            <input
              value={busqueda}
              onChange={handleBuscar}
              placeholder={esMiller ? "Buscar en Miller Digital (Canva, Google, HBO...)" : "Buscar en Richard Express Market..."}
              style={{
                paddingLeft: 38, borderRadius: 24,
                background: esMiller ? '#1e293b' : 'var(--fondo)',
                color: esMiller ? '#fff' : 'var(--texto)',
                border: esMiller ? '1.5px solid rgba(124, 58, 237, 0.4)' : '1.5px solid var(--borde)',
                width: '100%'
              }}
            />
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {perfil?.rol === 'admin' && (
            <Link to="/admin" style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
              color: esMiller ? '#06b6d4' : 'var(--naranja)', fontWeight: 600, padding: '6px 10px', borderRadius: 8,
              background: esMiller ? 'rgba(6, 182, 212, 0.15)' : 'var(--naranja-light)'
            }}>
              <LayoutDashboard size={15} /> Admin
            </Link>
          )}
          {perfil?.rol === 'vendedor' && (
            <Link to="/vendedor" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--naranja)', fontWeight: 500, padding: '6px 10px', borderRadius: 8, background: 'var(--naranja-light)' }}>
              <Store size={15} /> Vender
            </Link>
          )}

          {usuario ? (
            <>
              <Link to="/mi-cuenta" style={{
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                padding: '6px 10px', borderRadius: 8,
                background: esMiller ? 'rgba(124, 58, 237, 0.2)' : 'var(--fondo)',
                color: esMiller ? '#f8fafc' : 'var(--texto)',
                border: '1px solid var(--borde)', textDecoration: 'none'
              }}>
                {perfil?.avatar_url ? (
                  <img src={perfil.avatar_url} alt="Avatar" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <User size={14} color={esMiller ? '#06b6d4' : 'var(--naranja)'} />
                )}
                Mi Cuenta
              </Link>
              <button onClick={handleLogout} className="btn-ghost" style={{ padding: '7px 10px', fontSize: 12, color: esMiller ? '#cbd5e1' : 'inherit' }}>
                Salir
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-ghost" style={{ padding: '7px 12px', fontSize: 12, color: esMiller ? '#fff' : 'inherit' }}>
              <LogIn size={14} /> Ingresar
            </Link>
          )}

          <Link to="/carrito" style={{
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 10,
            background: totalItems > 0 ? (esMiller ? 'rgba(124, 58, 237, 0.25)' : 'var(--naranja-light)') : (esMiller ? '#1e293b' : 'var(--fondo)'),
            border: esMiller ? '1.5px solid rgba(6, 182, 212, 0.4)' : '1.5px solid var(--borde)',
            color: totalItems > 0 ? (esMiller ? '#06b6d4' : 'var(--naranja)') : (esMiller ? '#94a3b8' : 'var(--texto-suave)'),
            transition: 'all 0.2s'
          }}>
            <ShoppingCart size={19} />
            {totalItems > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: esMiller ? '#7c3aed' : 'var(--naranja)', color: 'white',
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
