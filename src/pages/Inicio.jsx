import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import ProductoCard from '../components/ProductoCard'
import { Package, ChevronRight } from 'lucide-react'

export default function Inicio() {
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [cargando, setCargando] = useState(true)
  const busRef = useRef()

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('categorias').select('*').eq('activo', true).order('orden'),
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
    ])
    setCategorias(cats || [])
    setProductos(prods || [])
    setCargando(false)
  }

  function handleBuscar(val) {
    setBusqueda(val)
    if (val.trim().length < 2) { setSugerencias([]); setMostrarSugerencias(false); return }
    const filtrados = productos.filter(p => p.nombre.toLowerCase().includes(val.toLowerCase())).slice(0, 6)
    setSugerencias(filtrados)
    setMostrarSugerencias(true)
  }

  const productosFiltrados = busqueda.trim().length > 1
    ? productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : productos

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo)' }}>
      <Navbar onBuscar={handleBuscar} />

      {/* Sugerencias de búsqueda */}
      {mostrarSugerencias && sugerencias.length > 0 && (
        <div style={{ position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 500, background: 'var(--blanco)', borderRadius: 12, border: '1px solid var(--borde)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 200 }}>
          {sugerencias.map(p => (
            <button key={p.id} onClick={() => { setBusqueda(p.nombre); setMostrarSugerencias(false) }}
              style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--borde)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--naranja-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              {p.imagen_url
                ? <img src={p.imagen_url} alt={p.nombre} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={16} color="var(--texto-suave)" /></div>
              }
              <div>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</p>
                <p style={{ fontSize: 12, color: 'var(--naranja)' }}>S/ {Number(p.precio).toFixed(2)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div onClick={() => setMostrarSugerencias(false)}>
        <div className="page-wrap" style={{ padding: '32px 16px' }}>

          {/* Hero */}
          {!busqueda && (
            <div style={{ background: 'linear-gradient(135deg, var(--naranja) 0%, #FF8C42 100%)', borderRadius: 20, padding: '36px 32px', marginBottom: 36, color: 'white', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -20, top: -20, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'absolute', right: 60, bottom: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
              <p style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, marginBottom: 6 }}>Bienvenido a</p>
              <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 'clamp(24px, 5vw, 40px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 10 }}>
                Richard Express<br />Market
              </h1>
              <p style={{ fontSize: 14, opacity: 0.85 }}>Todo lo que necesitas, cerca de ti</p>
            </div>
          )}

          {/* Categorías */}
          {!busqueda && (
            <section style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h2 style={{ fontFamily: 'var(--fuente-display)', fontSize: 20, fontWeight: 700 }}>
                  Categorías<span style={{ color: 'var(--naranja)' }}>.</span>
                </h2>
              </div>
              {cargando ? <div className="spinner" /> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                  {categorias.map(cat => (
                    <Link key={cat.id} to={`/categoria/${cat.id}`}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--blanco)', borderRadius: 14, border: '1px solid var(--borde)', overflow: 'hidden', transition: 'all 0.18s', textAlign: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--naranja)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--borde)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                      <div style={{ width: '100%', aspectRatio: '1', background: 'var(--naranja-light)', overflow: 'hidden' }}>
                        {cat.imagen_url
                          ? <img src={cat.imagen_url} alt={cat.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Package size={36} color="var(--naranja)" />
                            </div>
                        }
                      </div>
                      <div style={{ padding: '10px 8px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)' }}>{cat.nombre}</p>
                        {cat.descripcion && <p style={{ fontSize: 11, color: 'var(--texto-suave)', marginTop: 2 }}>{cat.descripcion}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Todos los productos / resultados búsqueda */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'var(--fuente-display)', fontSize: 20, fontWeight: 700 }}>
                {busqueda ? `Resultados: "${busqueda}"` : 'Todos los productos'}<span style={{ color: 'var(--naranja)' }}>.</span>
              </h2>
              <span style={{ fontSize: 13, color: 'var(--texto-suave)' }}>{productosFiltrados.length} productos</span>
            </div>
            {cargando ? <div className="spinner" /> : productosFiltrados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>
                <Package size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p>No se encontraron productos</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
                {productosFiltrados.map(p => <ProductoCard key={p.id} producto={p} />)}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: 'var(--blanco)', borderTop: '1px solid var(--borde)', padding: '20px 16px', textAlign: 'center', marginTop: 40 }}>
        <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>© 2025 Richard Express Market · Todos los derechos reservados</p>
      </footer>
    </div>
  )
}
