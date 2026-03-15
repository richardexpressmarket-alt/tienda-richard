import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCarrito } from '../store'
import Navbar from '../components/Navbar'
import { Trash2, Plus, Minus, ShoppingCart, MessageCircle, ChevronLeft, Package, MapPin, Store } from 'lucide-react'

const WA_NUMBER = import.meta.env.VITE_WHATSAPP || '51924545856'

export default function Carrito() {
  const { items, quitar, cambiarCantidad, limpiar, total } = useCarrito()
  const [tipoEntrega, setTipoEntrega] = useState('recojo')
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [telefono, setTelefono] = useState('')

  function handleComprar() {
    if (items.length === 0) return
    if (!nombre.trim()) return alert('Por favor escribe tu nombre')
    if (tipoEntrega === 'delivery' && !direccion.trim()) return alert('Por favor escribe tu dirección')

    const lineas = items.map(i =>
      `• ${i.nombre} x${i.cantidad} = S/ ${(i.precio * i.cantidad).toFixed(2)}`
    ).join('\n')

    const entregaInfo = tipoEntrega === 'delivery'
      ? `\n📍 *Delivery a:* ${direccion}${referencia ? ` (${referencia})` : ''}`
      : `\n🏪 *Recojo en tienda*`

    const msg =
      `¡Hola! Quiero hacer un pedido 🛒\n\n` +
      `👤 *Nombre:* ${nombre}\n` +
      `📱 *Teléfono:* ${telefono || 'No indicado'}\n` +
      entregaInfo +
      `\n\n*Productos:*\n${lineas}\n\n` +
      `💰 *Total: S/ ${total().toFixed(2)}*\n\n` +
      `¿Está disponible?`

    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo)' }}>
      <Navbar />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--texto-suave)', marginBottom: 20 }}>
          <ChevronLeft size={16} /> Seguir comprando
        </Link>

        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, marginBottom: 24 }}>
          Tu carrito<span style={{ color: 'var(--naranja)' }}>.</span>
        </h1>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <ShoppingCart size={56} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <p style={{ fontSize: 16, color: 'var(--texto-suave)', marginBottom: 20 }}>Tu carrito está vacío</p>
            <Link to="/" className="btn-primary">Ver productos</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(item => (
                <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
                  {item.imagen_url
                    ? <img src={item.imagen_url} alt={item.nombre} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Package size={24} color="var(--borde)" />
                      </div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</p>
                    <p style={{ fontSize: 13, color: 'var(--naranja)', fontWeight: 600 }}>S/ {Number(item.precio).toFixed(2)} c/u</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => cambiarCantidad(item.id, item.cantidad - 1)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--fondo)', border: '1px solid var(--borde)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Minus size={14} />
                    </button>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(item.id, item.cantidad + 1)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--naranja-light)', border: '1px solid var(--naranja-mid)', color: 'var(--naranja)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 70 }}>
                    <p style={{ fontFamily: 'var(--fuente-display)', fontSize: 15, fontWeight: 700 }}>S/ {(item.precio * item.cantidad).toFixed(2)}</p>
                  </div>
                  <button onClick={() => quitar(item.id)} className="btn-danger" style={{ padding: '6px', flexShrink: 0 }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            {/* Datos del cliente */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
                Tus datos
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 5, display: 'block' }}>Nombre completo *</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="¿Cómo te llamamos?" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 5, display: 'block' }}>Teléfono</label>
                  <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Tu número de contacto" type="tel" />
                </div>
              </div>
            </div>

            {/* Tipo de entrega */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
                ¿Cómo quieres recibir tu pedido?
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {/* Recojo */}
                <button onClick={() => setTipoEntrega('recojo')}
                  style={{ padding: '14px', borderRadius: 12, border: `2px solid ${tipoEntrega === 'recojo' ? 'var(--naranja)' : 'var(--borde)'}`, background: tipoEntrega === 'recojo' ? 'var(--naranja-light)' : 'var(--blanco)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.18s' }}>
                  <Store size={24} color={tipoEntrega === 'recojo' ? 'var(--naranja)' : 'var(--texto-suave)'} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: tipoEntrega === 'recojo' ? 'var(--naranja)' : 'var(--texto)' }}>Recojo en tienda</span>
                  <span style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Gratis</span>
                </button>

                {/* Delivery */}
                <button onClick={() => setTipoEntrega('delivery')}
                  style={{ padding: '14px', borderRadius: 12, border: `2px solid ${tipoEntrega === 'delivery' ? 'var(--naranja)' : 'var(--borde)'}`, background: tipoEntrega === 'delivery' ? 'var(--naranja-light)' : 'var(--blanco)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.18s' }}>
                  <MapPin size={24} color={tipoEntrega === 'delivery' ? 'var(--naranja)' : 'var(--texto-suave)'} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: tipoEntrega === 'delivery' ? 'var(--naranja)' : 'var(--texto)' }}>Delivery</span>
                  <span style={{ fontSize: 11, color: 'var(--texto-suave)' }}>A coordinar</span>
                </button>
              </div>

              {/* Campos de delivery */}
              {tipoEntrega === 'delivery' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px', background: 'var(--naranja-light)', borderRadius: 10 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 5, display: 'block' }}>Dirección *</label>
                    <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, distrito" style={{ background: 'var(--blanco)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 5, display: 'block' }}>Referencia</label>
                    <input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ej: Frente al parque, casa azul..." style={{ background: 'var(--blanco)' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Resumen y botón */}
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: 'var(--texto-suave)' }}>
                  Subtotal ({items.reduce((a, i) => a + i.cantidad, 0)} productos)
                </span>
                <span style={{ fontSize: 14 }}>S/ {total().toFixed(2)}</span>
              </div>
              {tipoEntrega === 'delivery' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--texto-suave)' }}>Delivery</span>
                  <span style={{ fontSize: 13, color: 'var(--naranja)' }}>A coordinar por WhatsApp</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--borde)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18 }}>Total</span>
                <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 22, color: 'var(--naranja)' }}>S/ {total().toFixed(2)}</span>
              </div>

              <button onClick={handleComprar} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, borderRadius: 12, gap: 10 }}>
                <MessageCircle size={18} />
                {tipoEntrega === 'delivery' ? 'Pedir con delivery por WhatsApp' : 'Pedir y recoger en tienda'}
              </button>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', textAlign: 'center', marginTop: 10 }}>
                Se abrirá WhatsApp con tu pedido completo
              </p>

              <button onClick={() => { if (confirm('¿Vaciar carrito?')) limpiar() }}
                style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', fontSize: 12, color: 'var(--texto-suave)', cursor: 'pointer', textDecoration: 'underline' }}>
                Vaciar carrito
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
