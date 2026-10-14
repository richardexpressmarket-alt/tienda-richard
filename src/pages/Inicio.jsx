import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTienda } from '../store'
import Navbar from '../components/Navbar'
import ProductoCard from '../components/ProductoCard'
import Paginador from '../components/Paginador'
import { Package, Cpu, ShieldCheck, Zap, MessageCircle } from 'lucide-react'

export default function Inicio() {
  const { tiendaActual } = useTienda()
  const esMiller = tiendaActual === 'miller'

  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [cargando, setCargando] = useState(true)

  // Estados del Paginador (50 por defecto)
  const [paginaActual, setPaginaActual] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(50)

  const busRef = useRef()

  useEffect(() => {
    setPaginaActual(1)
    setBusqueda('')
    cargar()

    const canal = supabase
      .channel('cambios-tienda')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, () => cargar())
      .subscribe()

    return () => supabase.removeChannel(canal)
  }, [tiendaActual])

  async function cargar() {
    setCargando(true)
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('categorias').select('*').eq('activo', true).order('orden'),
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
    ])
    setCategorias((cats || []).filter(c => (c.tienda || 'richard') === tiendaActual))
    setProductos((prods || []).filter(p => (p.tienda || 'richard') === tiendaActual))
    setCargando(false)
  }

  function handleBuscar(val) {
    setBusqueda(val)
    setPaginaActual(1)
    if (val.trim().length < 2) { setSugerencias([]); setMostrarSugerencias(false); return }
    const filtrados = productos.filter(p => p.nombre.toLowerCase().includes(val.toLowerCase())).slice(0, 6)
    setSugerencias(filtrados)
    setMostrarSugerencias(true)
  }

  const productosFiltrados = busqueda.trim().length > 1
    ? productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : productos

  const limiteValido = Math.max(1, Number(itemsPorPagina) || 50)
  const productosPaginados = productosFiltrados.slice(
    (paginaActual - 1) * limiteValido,
    paginaActual * limiteValido
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: esMiller
        ? 'radial-gradient(circle at 20% 10%, rgba(124, 58, 237, 0.25), transparent 45%), radial-gradient(circle at 80% 30%, rgba(6, 182, 212, 0.2), transparent 50%), #090d16'
        : 'var(--fondo)',
      color: esMiller ? '#f8fafc' : 'var(--texto)',
      transition: 'background 0.3s ease'
    }}>
      <Navbar onBuscar={handleBuscar} />

      {/* Sugerencias de búsqueda */}
      {mostrarSugerencias && sugerencias.length > 0 && (
        <div style={{
          position: 'fixed', top: 68, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 500,
          background: esMiller ? '#1e293b' : 'var(--blanco)',
          color: esMiller ? '#fff' : 'var(--texto)',
          borderRadius: 12, border: '1px solid var(--borde)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', zIndex: 200
        }}>
          {sugerencias.map(p => (
            <button key={p.id} onClick={() => { setBusqueda(p.nombre); setMostrarSugerencias(false) }}
              style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--borde)', color: 'inherit' }}>
              {p.imagen_url
                ? <img src={p.imagen_url} alt={p.nombre} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={16} color="var(--texto-suave)" /></div>
              }
              <div>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</p>
                <p style={{ fontSize: 12, color: esMiller ? '#06b6d4' : 'var(--naranja)', fontWeight: 700 }}>S/ {Number(p.precio).toFixed(2)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div onClick={() => setMostrarSugerencias(false)}>
        <div className="page-wrap" style={{ padding: '32px 16px' }}>

          {/* HERO BANNER DINÁMICO */}
          {!busqueda && (
            esMiller ? (
              <div style={{
                background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 45%, #06b6d4 100%)',
                borderRadius: 24, padding: '38px 32px', marginBottom: 36, color: 'white',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 20px 45px rgba(124, 58, 237, 0.3)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{ position: 'absolute', right: -30, top: -30, width: 220, height: 220, borderRadius: '50%', background: 'rgba(6, 182, 212, 0.25)', filter: 'blur(20px)' }} />
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.35)', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                  <Zap size={14} color="#22d3ee" /> ¡Adquiere primero y luego realiza el pago!
                </div>
                <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 'clamp(26px, 5vw, 42px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 10 }}>
                  Miller Digital Store<br />
                  <span style={{ color: '#a5f3fc' }}>Cuentas & Suscripciones Pro</span>
                </h1>
                <p style={{ fontSize: 14, opacity: 0.92, maxWidth: 560, marginBottom: 18 }}>
                  Activa Canva Pro, Google, HBO y más directamente en tu correo personal. 100% seguro, entrega inmediata y soporte garantizado.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <a href="https://wa.me/51924545856?text=Hola%20Miller%20Digital,%20quiero%20informaci%C3%B3n%20sobre%20los%20servicios%20Pro"
                    target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#10b981', color: '#fff', padding: '10px 18px', borderRadius: 12, fontWeight: 800, fontSize: 13, textDecoration: 'none', boxShadow: '0 6px 16px rgba(16,185,129,0.4)' }}>
                    <MessageCircle size={17} /> WhatsApp: 924 545 856
                  </a>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.15)', padding: '8px 14px', borderRadius: 12 }}>
                    <ShieldCheck size={16} /> 100% Seguro · Cancela con cualquier medio de pago
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ background: 'linear-gradient(135deg, var(--naranja) 0%, #FF8C42 100%)', borderRadius: 20, padding: '36px 32px', marginBottom: 36, color: 'white', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -20, top: -20, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ position: 'absolute', right: 60, bottom: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <p style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, marginBottom: 6 }}>Bienvenido a</p>
                <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 'clamp(24px, 5vw, 40px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 10 }}>
                  Richard Express<br />Market
                </h1>
                <p style={{ fontSize: 14, opacity: 0.85 }}>Todo lo que necesitas, cerca de ti</p>
              </div>
            )
          )}

          {/* Categorías */}
          {!busqueda && categorias.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h2 style={{ fontFamily: 'var(--fuente-display)', fontSize: 20, fontWeight: 700 }}>
                  Categorías<span style={{ color: esMiller ? '#06b6d4' : 'var(--naranja)' }}>.</span>
                </h2>
              </div>
              {cargando ? <div className="spinner" /> : (
                <div className="grid-categorias" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                  {categorias.map(cat => (
                    <Link key={cat.id} to={`/categoria/${cat.id}`}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        background: esMiller ? 'rgba(30, 41, 59, 0.8)' : 'var(--blanco)',
                        borderRadius: 14,
                        border: esMiller ? '1px solid rgba(124, 58, 237, 0.35)' : '1px solid var(--borde)',
                        overflow: 'hidden', transition: 'all 0.18s', textAlign: 'center', textDecoration: 'none'
                      }}>
                      <div style={{ width: '100%', aspectRatio: '1', background: esMiller ? 'rgba(124, 58, 237, 0.15)' : 'var(--naranja-light)', overflow: 'hidden' }}>
                        {cat.imagen_url
                          ? <img src={cat.imagen_url} alt={cat.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Package size={36} color={esMiller ? '#06b6d4' : 'var(--naranja)'} />
                            </div>
                        }
                      </div>
                      <div style={{ padding: '10px 8px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: esMiller ? '#f8fafc' : 'var(--texto)' }}>{cat.nombre}</p>
                        {cat.descripcion && <p style={{ fontSize: 11, color: esMiller ? '#94a3b8' : 'var(--texto-suave)', marginTop: 2 }}>{cat.descripcion}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Todos los productos / servicios con Paginador */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'var(--fuente-display)', fontSize: 20, fontWeight: 700 }}>
                {busqueda ? `Resultados: "${busqueda}"` : (esMiller ? 'Catálogo de Servicios Digitales' : 'Todos los productos')}
                <span style={{ color: esMiller ? '#06b6d4' : 'var(--naranja)' }}>.</span>
              </h2>
              <span style={{ fontSize: 13, color: esMiller ? '#94a3b8' : 'var(--texto-suave)' }}>
                {productosFiltrados.length} {esMiller ? 'servicios' : 'productos'}
              </span>
            </div>
            {cargando ? <div className="spinner" /> : productosFiltrados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: esMiller ? '#94a3b8' : 'var(--texto-suave)' }}>
                <Package size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p>No se encontraron registros en esta tienda</p>
              </div>
            ) : (
              <>
                <div className="grid-productos" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 14 }}>
                  {productosPaginados.map(p => <ProductoCard key={p.id} producto={p} />)}
                </div>

                <Paginador
                  totalItems={productosFiltrados.length}
                  itemsPorPagina={itemsPorPagina}
                  setItemsPorPagina={setItemsPorPagina}
                  paginaActual={paginaActual}
                  setPaginaActual={setPaginaActual}
                  esMiller={esMiller}
                />
              </>
            )}
          </section>
        </div>
      </div>

      {/* Footer dinámico según tienda */}
      <footer style={{ background: esMiller ? '#050811' : 'var(--texto)', color: 'white', marginTop: 48, borderTop: esMiller ? '1px solid rgba(124, 58, 237, 0.3)' : 'none' }}>
        <div className="page-wrap" style={{ padding: '40px 16px 20px' }}>
          {esMiller ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 32, marginBottom: 32 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                  Miller Digital<span style={{ color: '#06b6d4' }}>.</span>
                </h3>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                  Tu plataforma de confianza para suscripciones y cuentas digitales Pro. Activamos primero tu servicio en tu correo y luego realizas el pago con total seguridad.
                </p>
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#06b6d4' }}>Servicios Destacados</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['Canva Pro (3, 6 y 12 meses)', 'Cuentas de Google / Almacenamiento', 'HBO Max / Streaming', 'Renovaciones automáticas', 'Soporte personalizado'].map(item => (
                    <li key={item} style={{ fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#7c3aed', fontSize: 10 }}>●</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#06b6d4' }}>📱 Contacto Directo</h4>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
                  Atención inmediata 100% online. Sin costo de envío.
                </p>
                <a href="https://wa.me/51924545856" target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#fff', background: '#10b981', borderRadius: 8, padding: '8px 14px', textDecoration: 'none', fontWeight: 700 }}>
                  💬 WhatsApp: 924 545 856
                </a>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 32, marginBottom: 32 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                  Richard Express<span style={{ color: 'var(--naranja)' }}>.</span>
                </h3>
                <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.7 }}>
                  Somos una tienda de barrio comprometida con ofrecerte los mejores productos de abarrotes, lácteos, bebidas, útiles y más, a precios justos y con atención personalizada. Tu satisfacción es nuestra prioridad.
                </p>
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--naranja)' }}>Qué vendemos</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['Abarrotes y alimentos', 'Lácteos y derivados', 'Bebidas y refrescos', 'Útiles escolares', 'Limpieza y hogar', 'Snacks y golosinas'].map(item => (
                    <li key={item} style={{ fontSize: 13, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--naranja)', fontSize: 10 }}>●</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--naranja)' }}>📍 Encuéntranos</h4>
                <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.7, marginBottom: 10 }}>
                  Ca. Belén, Puente Piedra 15121<br />
                  <span style={{ fontSize: 11, color: '#666' }}>Código Plus: 4WVF+9C8</span>
                </p>
                <a href="https://maps.google.com/?q=4WVF+9C8,Puente+Piedra" target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--naranja)', border: '1px solid var(--naranja)', borderRadius: 8, padding: '6px 12px', textDecoration: 'none' }}>
                  🗺️ Ver en Google Maps
                </a>
                <p style={{ fontSize: 13, color: '#aaa', marginTop: 12 }}>
                  📱 WhatsApp: <a href="https://wa.me/51968332181" style={{ color: 'var(--naranja)', textDecoration: 'none' }}>+51 968 332 181</a>
                </p>
                <p style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                  🕒 Delivery: 3:00 PM – 9:00 PM
                </p>
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid #333', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 12, color: '#64748b' }}>
              © 2026 {esMiller ? 'Miller Digital Store' : 'Richard Express Market'} · Todos los derechos reservados
            </p>
            <a href={`https://wa.me/${esMiller ? '51924545856' : '51968332181'}?text=${encodeURIComponent('Hola, quisiera hacer una consulta/reclamo: ')}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: '#64748b', textDecoration: 'none', borderBottom: '1px dotted #64748b', paddingBottom: 1 }}>
              Libro de reclamos
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
