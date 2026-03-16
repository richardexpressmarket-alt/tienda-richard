import { useState } from 'react'
import { ShoppingCart, Plus, Package, X, MapPin } from 'lucide-react'
import { useCarrito } from '../store'
import toast from 'react-hot-toast'

export default function ProductoCard({ producto }) {
  const agregar = useCarrito(s => s.agregar)
  const [modalAbierto, setModalAbierto] = useState(false)

  function handleAgregar(e) {
    e.stopPropagation()
    if (producto.stock < 1) return toast.error('Sin stock disponible')
    agregar(producto)
    toast.success(`${producto.nombre} agregado`, { icon: '🛒' })
  }

  const sinStock = producto.stock < 1

  return (
    <>
      {/* Card */}
      <div className="card"
        onClick={() => setModalAbierto(true)}
        style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'transform 0.18s, box-shadow 0.18s', cursor: 'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--sombra-hover)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--sombra)' }}>

        <div style={{ aspectRatio: '1', background: 'var(--fondo)', position: 'relative', overflow: 'hidden' }}>
          {producto.imagen_url ? (
            <img src={producto.imagen_url} alt={producto.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--borde)' }}>
              <Package size={48} />
            </div>
          )}
          {sinStock && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="badge badge-rojo">Sin stock</span>
            </div>
          )}
          {producto.precio_oferta && (
            <span className="badge badge-naranja" style={{ position: 'absolute', top: 8, left: 8 }}>Oferta</span>
          )}
        </div>

        <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)', lineHeight: 1.3, flex: 1 }}>{producto.nombre}</p>
          <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>{producto.unidad}</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <div>
              {producto.precio_oferta ? (
                <div>
                  <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 17, color: 'var(--naranja)' }}>
                    S/ {Number(producto.precio_oferta).toFixed(2)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--texto-suave)', textDecoration: 'line-through', marginLeft: 5 }}>
                    S/ {Number(producto.precio).toFixed(2)}
                  </span>
                </div>
              ) : (
                <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 17, color: 'var(--naranja)' }}>
                  S/ {Number(producto.precio).toFixed(2)}
                </span>
              )}
            </div>
            <button onClick={handleAgregar} disabled={sinStock}
              style={{ width: 34, height: 34, borderRadius: 8, background: sinStock ? 'var(--borde)' : 'var(--naranja)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.18s', flexShrink: 0, border: 'none', cursor: sinStock ? 'not-allowed' : 'pointer' }}>
              <Plus size={18} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: producto.stock <= producto.stock_minimo ? '#E65100' : 'var(--texto-suave)' }}>
            Stock: {producto.stock} {producto.stock <= producto.stock_minimo && producto.stock > 0 ? '⚠ Poco stock' : ''}
          </p>
        </div>
      </div>

      {/* Modal detalle producto */}
      {modalAbierto && (
        <div
          onClick={() => setModalAbierto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div
            onClick={e => e.stopPropagation()}
            className="card"
            style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', borderRadius: 20 }}>

            {/* Imagen grande */}
            <div style={{ position: 'relative', background: 'var(--fondo)', borderRadius: '20px 20px 0 0', overflow: 'hidden', aspectRatio: '4/3' }}>
              {producto.imagen_url ? (
                <img src={producto.imagen_url} alt={producto.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={80} color="var(--borde)" />
                </div>
              )}
              <button onClick={() => setModalAbierto(false)}
                style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <X size={18} />
              </button>
              {producto.precio_oferta && (
                <span className="badge badge-naranja" style={{ position: 'absolute', top: 12, left: 12, fontSize: 13, padding: '4px 12px' }}>Oferta</span>
              )}
              {sinStock && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="badge badge-rojo" style={{ fontSize: 15, padding: '8px 20px' }}>Sin stock</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ padding: '20px 22px' }}>
              <h2 style={{ fontFamily: 'var(--fuente-display)', fontSize: 22, fontWeight: 800, marginBottom: 6, lineHeight: 1.2 }}>{producto.nombre}</h2>

              {producto.descripcion && (
                <p style={{ fontSize: 14, color: 'var(--texto-suave)', marginBottom: 12, lineHeight: 1.5 }}>{producto.descripcion}</p>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 12, background: 'var(--fondo)', padding: '4px 12px', borderRadius: 20, color: 'var(--texto-suave)' }}>
                  📦 {producto.unidad}
                </span>
                {producto.secciones?.nombre && (
                  <span style={{ fontSize: 12, background: '#F3E5F5', padding: '4px 12px', borderRadius: 20, color: '#6A1B9A', fontWeight: 500 }}>
                    📍 {producto.secciones.nombre}
                  </span>
                )}
                <span className={`badge ${producto.stock > producto.stock_minimo ? 'badge-verde' : producto.stock > 0 ? 'badge-naranja' : 'badge-rojo'}`}
                  style={{ fontSize: 12, padding: '4px 12px' }}>
                  {producto.stock > 0 ? `Stock: ${producto.stock}` : 'Sin stock'}
                </span>
              </div>

              {/* Precio */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{ fontFamily: 'var(--fuente-display)', fontSize: 32, fontWeight: 800, color: 'var(--naranja)' }}>
                  S/ {Number(producto.precio_oferta || producto.precio).toFixed(2)}
                </span>
                {producto.precio_oferta && (
                  <span style={{ fontSize: 16, color: 'var(--texto-suave)', textDecoration: 'line-through' }}>
                    S/ {Number(producto.precio).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Botón agregar */}
              <button onClick={handleAgregar} disabled={sinStock} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 16, borderRadius: 12, gap: 10, opacity: sinStock ? 0.6 : 1 }}>
                <ShoppingCart size={20} />
                {sinStock ? 'Sin stock disponible' : 'Agregar al carrito'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
