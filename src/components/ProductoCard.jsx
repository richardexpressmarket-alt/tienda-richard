import { ShoppingCart, Plus, Package } from 'lucide-react'
import { useCarrito } from '../store'
import toast from 'react-hot-toast'

export default function ProductoCard({ producto }) {
  const agregar = useCarrito(s => s.agregar)

  function handleAgregar(e) {
    e.preventDefault()
    if (producto.stock < 1) return toast.error('Sin stock disponible')
    agregar(producto)
    toast.success(`${producto.nombre} agregado`, { icon: '🛒' })
  }

  const sinStock = producto.stock < 1

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'transform 0.18s, box-shadow 0.18s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--sombra-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--sombra)' }}>

      {/* Imagen */}
      <div style={{ aspectRatio: '1', background: 'var(--fondo)', position: 'relative', overflow: 'hidden' }}>
        {producto.imagen_url ? (
          <img src={producto.imagen_url} alt={producto.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

      {/* Info */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)', lineHeight: 1.3, flex: 1 }}>{producto.nombre}</p>
        <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{producto.unidad}</p>

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
            style={{ width: 34, height: 34, borderRadius: 8, background: sinStock ? 'var(--borde)' : 'var(--naranja)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.18s', flexShrink: 0 }}>
            <Plus size={18} />
          </button>
        </div>

        <p style={{ fontSize: 11, color: producto.stock <= producto.stock_minimo ? '#E65100' : 'var(--texto-suave)' }}>
          Stock: {producto.stock} {producto.stock <= producto.stock_minimo && producto.stock > 0 ? '⚠ Poco stock' : ''}
        </p>
      </div>
    </div>
  )
}
