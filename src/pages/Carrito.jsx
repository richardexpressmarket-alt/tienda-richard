import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCarrito, useTienda, useAuth } from '../store'
import Navbar from '../components/Navbar'
import { Trash2, Plus, Minus, ShoppingCart, MessageCircle, ChevronLeft, Package, MapPin, Store, Clock, AlertCircle, Cpu, Lock, Mail, UserCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const WA_RICHARD = import.meta.env.VITE_WHATSAPP || '51968332181'
const WA_MILLER  = '51924545856'
const YAPE_NUMBER = '51968332181'
const MONTO_MIN_DELIVERY = 5
const DELIVERY_HORA_INICIO = 15
const DELIVERY_HORA_FIN = 21
const MONTO_GRATIS = { min: 30, max: 50 }
const UBICACION_TIENDA = 'Ca. Belén, Puente Piedra 15121 (4WVF+9C8)'

export default function Carrito() {
  const { items, quitar, cambiarCantidad, limpiar, total } = useCarrito()
  const { tiendaActual } = useTienda()
  const { usuario, perfil } = useAuth()
  const navigate = useNavigate()

  const esMiller = tiendaActual === 'miller'
  const WA_NUMBER = esMiller ? WA_MILLER : WA_RICHARD

  const [tipoEntrega, setTipoEntrega] = useState('recojo')
  const [nombre, setNombre]           = useState('')
  const [correoActivacion, setCorreoActivacion] = useState('')
  const [direccion, setDireccion]     = useState('')
  const [referencia, setReferencia]   = useState('')
  const [telefono, setTelefono]       = useState('')
  const [enviando, setEnviando]       = useState(false)

  useEffect(() => {
    if (perfil) {
      setNombre(perfil.nombre || '')
      setTelefono(perfil.telefono || '')
      setCorreoActivacion(perfil.email || usuario?.email || '')
    } else if (usuario) {
      setCorreoActivacion(usuario.email || '')
    }
  }, [perfil, usuario])

  const ahora          = new Date()
  const horaActual     = ahora.getHours()
  const deliveryActivo = horaActual >= DELIVERY_HORA_INICIO && horaActual < DELIVERY_HORA_FIN
  const totalActual    = total()
  const deliveryGratis = totalActual >= MONTO_GRATIS.min

  async function handleComprar() {
    if (items.length === 0) return

    // En Miller Digital exigimos cuenta iniciada para registrar en su historial de suscripciones
    if (esMiller && !usuario) {
      toast.error('Para adquirir servicios digitales en la web, inicia sesión o crea tu cuenta en 1 minuto 🔐')
      navigate('/login')
      return
    }

    if (!nombre.trim()) return toast.error('Por favor escribe tu nombre')
    if (esMiller && !correoActivacion.trim()) return toast.error('Ingresa el correo donde activaremos tu servicio')

    if (!esMiller && tipoEntrega === 'delivery') {
      if (totalActual < MONTO_MIN_DELIVERY) return toast.error(`El monto mínimo para delivery es S/ ${MONTO_MIN_DELIVERY}`)
      if (!deliveryActivo) return toast.error(`Delivery disponible de ${DELIVERY_HORA_INICIO}:00 a ${DELIVERY_HORA_FIN}:00`)
      if (!direccion.trim()) return toast.error('Por favor escribe tu dirección')
    }

    setEnviando(true)
    try {
      await supabase.from('pedidos').insert({
        nombre_cliente:   nombre.trim(),
        telefono_cliente: telefono || null,
        tipo_entrega:     esMiller ? 'digital' : tipoEntrega,
        direccion:        esMiller ? correoActivacion : (direccion || null),
        referencia:       esMiller ? 'Tienda Virtual Miller Digital' : (referencia || null),
        items: items.map(i => ({ id: i.id, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad, subtotal: i.precio * i.cantidad, imagen_url: i.imagen_url || null })),
        total: totalActual,
        estado: 'pendiente'
      })

      const lineas = items.map(i => `• ${i.nombre} x${i.cantidad} = S/ ${(i.precio * i.cantidad).toFixed(2)}`).join('\n')

      let msg = ''
      if (esMiller) {
        msg =
          `¡Hola *Miller Digital*! 🚀 Quiero activar mi servicio digital:\n\n` +
          `👤 *Cliente:* ${nombre}\n` +
          `✉️ *Correo a activar:* ${correoActivacion}\n` +
          `📱 *WhatsApp:* ${telefono || 'No indicado'}\n\n` +
          `⚡ *Servicios solicitados:*\n${lineas}\n\n` +
          `💰 *Total a pagar: S/ ${totalActual.toFixed(2)}*\n\n` +
          `Quedo atento(a) para realizar el pago y activar mi cuenta.`
      } else {
        const entregaInfo = tipoEntrega === 'delivery'
          ? `\n📍 *Delivery a:* ${direccion}${referencia ? ` (${referencia})` : ''}\n💳 *Pago previo por Yape:* +${YAPE_NUMBER}${deliveryGratis ? '\n🎉 ¡Delivery GRATIS!' : ''}`
          : `\n🏪 *Recojo en tienda:* ${UBICACION_TIENDA}`

        msg =
          `¡Hola! Quiero hacer un pedido 🛒\n\n` +
          `👤 *Nombre:* ${nombre}\n` +
          `📱 *Teléfono:* ${telefono || 'No indicado'}\n` +
          entregaInfo +
          `\n\n*Productos:*\n${lineas}\n\n` +
          `💰 *Total: S/ ${totalActual.toFixed(2)}*\n\n` +
          (tipoEntrega === 'delivery' ? `📌 Enviaré mi ubicación en tiempo real para coordinar el envío.\n\n` : '') +
          `¿Está disponible?`
      }

      limpiar()
      toast.success('¡Pedido registrado! Abriendo WhatsApp...')
      setTimeout(() => window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank'), 800)
    } catch (e) {
      toast.error('Error: ' + e.message)
    }
    setEnviando(false)
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: esMiller ? 'radial-gradient(circle at top right, #1e1b4b, #0f172a 60%, #020617)' : 'var(--fondo)',
      color: esMiller ? '#f8fafc' : 'var(--texto)'
    }}>
      <Navbar />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: esMiller ? '#94a3b8' : 'var(--texto-suave)', marginBottom: 20 }}>
          <ChevronLeft size={16} /> Seguir comprando
        </Link>

        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          {esMiller ? <><Cpu size={28} color="#06b6d4" /> Tu Carrito Digital<span style={{ color: '#7c3aed' }}>.</span></> : <>Tu carrito<span style={{ color: 'var(--naranja)' }}>.</span></>}
        </h1>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <ShoppingCart size={56} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <p style={{ fontSize: 16, color: esMiller ? '#94a3b8' : 'var(--texto-suave)', marginBottom: 20 }}>Tu carrito está vacío</p>
            <Link to="/" className="btn-primary" style={{ background: esMiller ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'var(--naranja)', border: 'none' }}>
              Ver catálogo
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Aviso de Cuenta Requerida en Miller Digital */}
            {esMiller && !usuario && (
              <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(124, 58, 237, 0.15)', border: '1px solid #7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Lock size={20} color="#06b6d4" />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Inicia sesión para gestionar tus suscripciones</p>
                    <p style={{ fontSize: 12, color: '#cbd5e1' }}>Con tu cuenta podrás ver tus fechas de vencimiento y recibir alertas de renovación en tu correo.</p>
                  </div>
                </div>
                <Link to="/login" className="btn-primary" style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', fontSize: 12 }}>
                  Iniciar sesión / Crear cuenta
                </Link>
              </div>
            )}

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(item => (
                <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: esMiller ? 'rgba(30, 41, 59, 0.85)' : '#fff', border: esMiller ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid var(--borde)', color: esMiller ? '#fff' : 'inherit' }}>
                  {item.imagen_url
                    ? <img src={item.imagen_url} alt={item.nombre} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Package size={24} color="var(--borde)" />
                      </div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</p>
                    <p style={{ fontSize: 13, color: esMiller ? '#06b6d4' : 'var(--naranja)', fontWeight: 700 }}>S/ {Number(item.precio).toFixed(2)} c/u</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => cambiarCantidad(item.id, item.cantidad - 1)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--fondo)', border: '1px solid var(--borde)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Minus size={14} />
                    </button>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(item.id, item.cantidad + 1)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: esMiller ? '#7c3aed' : 'var(--naranja-light)', border: 'none', color: esMiller ? '#fff' : 'var(--naranja)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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
            <div className="card" style={{ padding: '20px', background: esMiller ? 'rgba(30, 41, 59, 0.85)' : '#fff', border: esMiller ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid var(--borde)', color: esMiller ? '#fff' : 'inherit' }}>
              <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
                {esMiller ? 'Datos para la Activación Digital' : 'Tus datos'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 5, display: 'block' }}>Nombre completo *</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="¿Cómo te llamamos?" />
                </div>
                {esMiller && (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 5, display: 'block', color: '#06b6d4' }}>
                      ✉️ Correo electrónico donde activaremos tu cuenta (Canva, Google, etc.) *
                    </label>
                    <input type="email" value={correoActivacion} onChange={e => setCorreoActivacion(e.target.value)} placeholder="tucorreo@gmail.com" />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 5, display: 'block' }}>WhatsApp de contacto *</label>
                  <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Tu número de WhatsApp" type="tel" />
                </div>
              </div>
            </div>

            {/* Tipo de entrega: SOLO PARA RICHARD EXPRESS (Eliminado en Miller Digital) */}
            {!esMiller ? (
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
                  ¿Cómo quieres recibir tu pedido?
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <button onClick={() => setTipoEntrega('recojo')}
                    style={{ padding: '14px', borderRadius: 12, border: `2px solid ${tipoEntrega === 'recojo' ? 'var(--naranja)' : 'var(--borde)'}`, background: tipoEntrega === 'recojo' ? 'var(--naranja-light)' : 'var(--blanco)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.18s' }}>
                    <Store size={24} color={tipoEntrega === 'recojo' ? 'var(--naranja)' : 'var(--texto-suave)'} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: tipoEntrega === 'recojo' ? 'var(--naranja)' : 'var(--texto)' }}>Recojo en tienda</span>
                    <span style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Gratis · Siempre disponible</span>
                  </button>

                  <button onClick={() => setTipoEntrega('delivery')}
                    style={{ padding: '14px', borderRadius: 12, border: `2px solid ${tipoEntrega === 'delivery' ? 'var(--naranja)' : 'var(--borde)'}`, background: tipoEntrega === 'delivery' ? 'var(--naranja-light)' : 'var(--blanco)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.18s', position: 'relative' }}>
                    {!deliveryActivo && (
                      <div style={{ position: 'absolute', top: 6, right: 6, background: '#FFEBEE', borderRadius: 20, padding: '2px 6px', fontSize: 10, color: '#C62828', fontWeight: 600 }}>
                        No disponible ahora
                      </div>
                    )}
                    <MapPin size={24} color={tipoEntrega === 'delivery' ? 'var(--naranja)' : 'var(--texto-suave)'} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: tipoEntrega === 'delivery' ? 'var(--naranja)' : 'var(--texto)' }}>Delivery</span>
                    <span style={{ fontSize: 11, color: 'var(--texto-suave)', textAlign: 'center' }}>
                      {deliveryGratis ? '🎉 ¡Gratis!' : `${DELIVERY_HORA_INICIO}:00 – ${DELIVERY_HORA_FIN}:00`}
                    </span>
                  </button>
                </div>

                {tipoEntrega === 'delivery' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {!deliveryActivo && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', background: '#FFEBEE', borderRadius: 10, border: '1px solid #FFCDD2' }}>
                        <Clock size={16} color="#C62828" style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#C62828' }}>Delivery no disponible ahora</p>
                          <p style={{ fontSize: 12, color: '#C62828', marginTop: 2 }}>
                            El delivery está disponible de {DELIVERY_HORA_INICIO}:00 a {DELIVERY_HORA_FIN}:00. Puedes hacer tu pedido ahora y coordinar el envío en ese horario.
                          </p>
                        </div>
                      </div>
                    )}

                    {totalActual < MONTO_MIN_DELIVERY && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', background: '#FFF3E0', borderRadius: 10, border: '1px solid #FFCC80' }}>
                        <AlertCircle size={16} color="#E65100" style={{ flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontSize: 12, color: '#E65100' }}>
                          El monto mínimo para delivery es <strong>S/ {MONTO_MIN_DELIVERY}</strong>. Tu pedido actual es S/ {totalActual.toFixed(2)}.
                        </p>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'var(--naranja-light)', borderRadius: 10, border: '1px solid var(--naranja-mid)' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--naranja-dark)' }}>💳 Pago previo por Yape</p>
                      <p style={{ fontSize: 13, color: 'var(--naranja-dark)', fontWeight: 700 }}>+{YAPE_NUMBER}</p>
                      <p style={{ fontSize: 12, color: 'var(--naranja-dark)' }}>
                        {deliveryGratis
                          ? `🎉 ¡Tu pedido supera S/ ${MONTO_GRATIS.min}! Delivery GRATIS`
                          : `Delivery gratis desde S/ ${MONTO_GRATIS.min} o en zonas cercanas a la tienda`}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--naranja-dark)' }}>
                        📌 Al confirmar tu pedido envía tu <strong>ubicación en tiempo real</strong> para coordinar el envío
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 5, display: 'block' }}>Dirección *</label>
                        <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, distrito" />
                      </div>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 5, display: 'block' }}>Referencia</label>
                        <input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ej: Frente al parque, casa azul..." />
                      </div>
                    </div>
                  </div>
                )}

                {tipoEntrega === 'recojo' && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', background: 'var(--fondo)', borderRadius: 10, border: '1px solid var(--borde)' }}>
                    <MapPin size={16} color="var(--naranja)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>Dirección de la tienda</p>
                      <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 2 }}>{UBICACION_TIENDA}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Info Entrega Virtual Instantánea en Miller Digital */
              <div className="card" style={{ padding: '16px 20px', background: 'rgba(6, 182, 212, 0.12)', border: '1px solid #06b6d4', color: '#f8fafc' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#06b6d4', marginBottom: 4 }}>⚡ Entrega Virtual Inmediata (Sin Delivery)</p>
                <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                  ¡Adquiere primero y luego realiza el pago! Tu suscripción se activa directamente en tu correo y podrás coordinar por nuestro WhatsApp oficial <b>924 545 856</b>.
                </p>
              </div>
            )}

            {/* Resumen */}
            <div className="card" style={{ padding: '20px 24px', background: esMiller ? 'rgba(30, 41, 59, 0.85)' : '#fff', border: esMiller ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid var(--borde)', color: esMiller ? '#fff' : 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: esMiller ? '#94a3b8' : 'var(--texto-suave)' }}>Subtotal ({items.reduce((a, i) => a + i.cantidad, 0)} items)</span>
                <span style={{ fontSize: 14 }}>S/ {totalActual.toFixed(2)}</span>
              </div>
              {!esMiller && tipoEntrega === 'delivery' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--texto-suave)' }}>Delivery</span>
                  <span style={{ fontSize: 13, color: deliveryGratis ? '#2E7D32' : 'var(--naranja)', fontWeight: 600 }}>
                    {deliveryGratis ? '🎉 GRATIS' : 'A coordinar'}
                  </span>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--borde)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18 }}>Total</span>
                <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 22, color: esMiller ? '#06b6d4' : 'var(--naranja)' }}>S/ {totalActual.toFixed(2)}</span>
              </div>

              <button onClick={handleComprar} disabled={enviando} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, borderRadius: 12, gap: 10, opacity: enviando ? 0.7 : 1, background: esMiller ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'var(--naranja)', border: 'none' }}>
                <MessageCircle size={18} />
                {enviando ? 'Procesando...' : esMiller ? 'Activar Servicio por WhatsApp (924 545 856)' : (tipoEntrega === 'delivery' ? 'Pedir con delivery por WhatsApp' : 'Pedir y recoger en tienda')}
              </button>
              <p style={{ fontSize: 12, color: esMiller ? '#94a3b8' : 'var(--texto-suave)', textAlign: 'center', marginTop: 10 }}>
                Tu pedido quedará registrado y se abrirá WhatsApp
              </p>
              <button onClick={() => { if (confirm('¿Vaciar carrito?')) limpiar() }}
                style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', fontSize: 12, color: esMiller ? '#94a3b8' : 'var(--texto-suave)', cursor: 'pointer', textDecoration: 'underline' }}>
                Vaciar carrito
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
