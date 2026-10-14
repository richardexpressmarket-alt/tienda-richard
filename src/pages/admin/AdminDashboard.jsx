import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useTienda } from '../../store'
import Paginador from '../../components/Paginador'
import { Package, Tag, ShoppingBag, AlertTriangle, XCircle, EyeOff, Clock, Users, Key, ChevronDown, ChevronUp, Send, Copy, RefreshCw, CheckCircle, Cpu } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const { tiendaActual, modoOscuro } = useTienda()
  const esMiller = tiendaActual === 'miller'

  const [stats, setStats]           = useState({ productos: 0, categorias: 0, ventas_hoy: 0, total_hoy: 0 })
  const [stockBajo, setStockBajo]   = useState([])
  const [stockCero, setStockCero]   = useState([])
  const [inactivos, setInactivos]   = useState([])
  const [categorias, setCategorias] = useState([])
  const [filtroCat, setFiltroCat]   = useState('')
  const [verInactivos, setVerInactivos] = useState(false)
  const [cargando, setCargando]     = useState(true)

  // Paginador (50 por defecto)
  const [paginaActual, setPaginaActual]     = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(50)

  // Estados exclusivos para Miller Digital (Vencimientos de Usuarios y Servicios)
  const [vistaMiller, setVistaMiller]     = useState('usuarios') // 'usuarios' | 'servicios'
  const [suscripciones, setSuscripciones] = useState([])
  const [cuentasMadre, setCuentasMadre]   = useState([])
  const [expandidoId, setExpandidoId]     = useState(null)
  const [modalRenovar, setModalRenovar]   = useState(null)
  const [mesesRenovar, setMesesRenovar]   = useState(3)

  const navigate = useNavigate()

  useEffect(() => {
    setPaginaActual(1)
    cargar()
  }, [tiendaActual])

  async function cargar() {
    setCargando(true)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const [
      { data: prodsTodos },
      { data: catsTodas },
      { data: ventasHoy },
    ] = await Promise.all([
      supabase.from('productos').select('*, categorias(nombre)'),
      supabase.from('categorias').select('id, nombre, activo, tienda').order('nombre'),
      supabase.from('ventas').select('total, tienda').gte('created_at', hoy.toISOString()),
    ])

    const prodsTienda  = (prodsTodos || []).filter(p => (p.tienda || 'richard') === tiendaActual)
    const catsTienda   = (catsTodas || []).filter(c => (c.tienda || 'richard') === tiendaActual)
    const ventasTienda = (ventasHoy || []).filter(v => (v.tienda || 'richard') === tiendaActual)

    const activos   = prodsTienda.filter(p => p.activo)
    const inacts    = prodsTienda.filter(p => !p.activo)
    const total_hoy = ventasTienda.reduce((a, v) => a + Number(v.total), 0)

    setStats({
      productos: activos.length,
      categorias: catsTienda.length,
      ventas_hoy: ventasTienda.length,
      total_hoy
    })
    setStockBajo(activos.filter(p => p.stock === 1))
    setStockCero(activos.filter(p => p.stock <= 0))
    setInactivos(inacts)
    setCategorias(catsTienda.filter(c => c.activo))

    if (esMiller) {
      const [{ data: subs }, { data: madres }] = await Promise.all([
        supabase.from('venta_items')
          .select('*, ventas(created_at, total, tienda)')
          .not('fecha_vencimiento', 'is', null)
          .order('fecha_vencimiento', { ascending: true }),
        supabase.from('compras')
          .select('*')
          .eq('tienda', 'miller')
          .order('fecha_vencimiento', { ascending: true })
      ])
      setSuscripciones(subs || [])
      setCuentasMadre(madres || [])
    }

    setCargando(false)
  }

  function irAEditar(id) { navigate(`/admin/productos?editar=${id}`) }

  const calcularDiasRestantes = (fechaVenc) => {
    if (!fechaVenc) return 999
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const venc = new Date(fechaVenc + 'T00:00:00')
    return Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24))
  }

  const generarTextoRenovacion = (item) => {
    const dias = calcularDiasRestantes(item.fecha_vencimiento)
    const estadoTexto = dias < 0 ? `venció el *${item.fecha_vencimiento}*` : `está a punto de vencer el *${item.fecha_vencimiento}* (en ${dias} días)`
    return `¡Hola *${item.cliente_nombre || 'estimado(a)'}*! 👋 Te saluda *Miller Digital*.\n\nTe escribimos para comentarte que tu servicio de *${item.nombre_producto}* asociado al correo (${item.cliente_correo || 'tu cuenta'}) ${estadoTexto}.\n\nPor favor, para no perder el servicio ni tus beneficios activos, coméntame por aquí para renovar tu plan (3, 6 o 12 meses). ¡Quedo atento! 🚀`
  }

  const confirmarRenovacionRapida = async (item) => {
    const baseDate = new Date(item.fecha_vencimiento + 'T12:00:00') < new Date() ? new Date() : new Date(item.fecha_vencimiento + 'T12:00:00')
    baseDate.setMonth(baseDate.getMonth() + Number(mesesRenovar))
    const nuevaFecha = baseDate.toISOString().split('T')[0]

    const { error } = await supabase.from('venta_items').update({
      fecha_vencimiento: nuevaFecha,
      duracion_meses: Number(item.duracion_meses || 0) + Number(mesesRenovar),
      estado_suscripcion: 'renovado'
    }).eq('id', item.id)

    if (error) return toast.error('Error al renovar')
    toast.success(`¡Servicio renovado hasta el ${nuevaFecha}! 🎉`)
    setModalRenovar(null)
    cargar()
  }

  const limiteValido      = Math.max(1, Number(itemsPorPagina) || 50)
  const bajFiltrado       = filtroCat ? stockBajo.filter(p => p.categoria_id  === filtroCat) : stockBajo
  const ceroFiltrado      = filtroCat ? stockCero.filter(p => p.categoria_id  === filtroCat) : stockCero
  const inactivosFiltrado = filtroCat ? inactivos.filter(p => p.categoria_id === filtroCat) : inactivos
  const subsPaginadas     = suscripciones.slice((paginaActual - 1) * limiteValido, paginaActual * limiteValido)

  // Colores adaptativos para que siempre se lea perfecto en Modo Oscuro y Modo Claro
  const bgFila           = modoOscuro ? '#1e293b' : '#ffffff'
  const bgFilaUrgente    = modoOscuro ? 'rgba(239, 68, 68, 0.14)' : '#fef2f2'
  const bgDetalle        = modoOscuro ? '#0f172a' : '#f8fafc'
  const bgCajaDato       = modoOscuro ? '#1e293b' : '#ffffff'
  const bordeFila        = modoOscuro ? '#334155' : 'var(--borde)'
  const textoPrincipal   = modoOscuro ? '#f8fafc' : '#0f172a'
  const textoSecundario  = modoOscuro ? '#94a3b8' : '#64748b'

  const cards = [
    { label: esMiller ? 'Servicios activos' : 'Productos activos', valor: stats.productos, icon: Package, color: esMiller ? '#7c3aed' : 'var(--naranja)' },
    { label: 'Categorías',         valor: stats.categorias,                   icon: Tag,         color: '#7C3AED'  },
    { label: 'Ventas hoy',         valor: stats.ventas_hoy,                   icon: ShoppingBag, color: '#059669'  },
    { label: 'Total vendido hoy',  valor: `S/ ${stats.total_hoy.toFixed(2)}`, icon: ShoppingBag, color: '#0284C7'  },
  ]

  if (cargando) return <div className="spinner" />

  const hayAlertas = stockBajo.length > 0 || stockCero.length > 0 || inactivos.length > 0

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        {esMiller ? <><Cpu size={24} color="#7c3aed" /> Dashboard Miller Digital<span style={{ color: '#06b6d4' }}>.</span></> : <>Dashboard<span style={{ color: 'var(--naranja)' }}>.</span></>}
      </h1>

      {/* Cards superiores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        {cards.map(({ label, valor, icon: Icon, color }) => (
          <div key={label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--texto-suave)' }}>{label}</p>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={color} />
              </div>
            </div>
            <p style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, color: 'var(--texto)' }}>{valor}</p>
          </div>
        ))}
      </div>

      {/* ==================== MODO MILLER DIGITAL: VENCIMIENTOS DE USUARIOS Y SERVICIOS ==================== */}
      {esMiller ? (
        <div className="card" style={{ padding: 20, borderTop: '4px solid #7c3aed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: textoPrincipal }}>
                <Clock size={20} color="#06b6d4" /> Próximos a Vencer (Renovaciones)
              </h2>
              <p style={{ fontSize: 12, color: textoSecundario }}>Haz clic en cualquier fila para expandir toda la información y renovar</p>
            </div>

            <div style={{ display: 'flex', gap: 6, background: bgDetalle, padding: 4, borderRadius: 10, border: `1px solid ${bordeFila}` }}>
              <button
                onClick={() => setVistaMiller('usuarios')}
                className={vistaMiller === 'usuarios' ? 'btn-primary' : 'btn-ghost'}
                style={{ fontSize: 12, padding: '7px 14px', background: vistaMiller === 'usuarios' ? '#7c3aed' : 'transparent', color: vistaMiller === 'usuarios' ? '#fff' : textoSecundario, border: 'none' }}>
                <Users size={14} /> Usuarios ({suscripciones.length})
              </button>
              <button
                onClick={() => setVistaMiller('servicios')}
                className={vistaMiller === 'servicios' ? 'btn-primary' : 'btn-ghost'}
                style={{ fontSize: 12, padding: '7px 14px', background: vistaMiller === 'servicios' ? '#0891b2' : 'transparent', color: vistaMiller === 'servicios' ? '#fff' : textoSecundario, border: 'none' }}>
                <Key size={14} /> Stock Servicios ({cuentasMadre.length})
              </button>
            </div>
          </div>

          {vistaMiller === 'usuarios' ? (
            suscripciones.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '30px 0', color: textoSecundario, fontSize: 13 }}>
                Aún no hay usuarios con suscripciones registradas.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {subsPaginadas.map(s => {
                    const dias = calcularDiasRestantes(s.fecha_vencimiento)
                    const urgente = dias <= 5
                    const expandido = expandidoId === s.id

                    return (
                      <div key={s.id} style={{
                        border: `1.5px solid ${urgente ? '#ef4444' : (expandido ? '#7c3aed' : bordeFila)}`,
                        borderRadius: 12,
                        background: urgente ? bgFilaUrgente : bgFila,
                        overflow: 'hidden',
                        transition: '0.2s'
                      }}>
                        {/* Cabecera de la fila */}
                        <div
                          onClick={() => setExpandidoId(expandido ? null : s.id)}
                          style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 12 }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: 15, color: textoPrincipal }}>
                                {s.cliente_nombre || 'Cliente sin nombre'}
                              </span>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 12,
                                background: 'rgba(124, 58, 237, 0.2)', color: modoOscuro ? '#c4b5fd' : '#6d28d9',
                                border: '1px solid rgba(124, 58, 237, 0.35)'
                              }}>
                                {s.nombre_producto}
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: textoSecundario, marginTop: 5 }}>
                              ✉️ {s.cliente_correo || 'Sin correo'} &nbsp;·&nbsp; 📱 {s.cliente_whatsapp || 'Sin WhatsApp'} &nbsp;·&nbsp; 🌐 {s.plataforma_venta || 'WhatsApp'}
                            </p>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 20,
                              background: dias < 0 ? '#991b1b' : urgente ? '#ef4444' : '#10b981', color: '#ffffff'
                            }}>
                              {dias < 0 ? `Vencido hace ${Math.abs(dias)}d` : dias === 0 ? '¡Vence HOY!' : `Vence en ${dias} días`}
                            </span>
                            {expandido ? <ChevronUp size={18} color={textoSecundario} /> : <ChevronDown size={18} color={textoSecundario} />}
                          </div>
                        </div>

                        {/* Panel desplegable con alto contraste */}
                        {expandido && (
                          <div style={{ padding: '16px', background: bgDetalle, borderTop: `1px solid ${bordeFila}` }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10, marginBottom: 14 }}>
                              <div style={{ background: bgCajaDato, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bordeFila}` }}>
                                <span style={{ fontSize: 11, color: textoSecundario, display: 'block', marginBottom: 3 }}>📅 Fecha de Compra</span>
                                <strong style={{ fontSize: 13, color: textoPrincipal }}>
                                  {s.ventas?.created_at ? new Date(s.ventas.created_at).toLocaleDateString('es-PE') : 'N/A'}
                                </strong>
                              </div>

                              <div style={{ background: bgCajaDato, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bordeFila}` }}>
                                <span style={{ fontSize: 11, color: textoSecundario, display: 'block', marginBottom: 3 }}>⏳ Fecha de Vencimiento</span>
                                <strong style={{ fontSize: 13, color: '#f87171' }}>
                                  {s.fecha_vencimiento}
                                </strong>
                              </div>

                              <div style={{ background: bgCajaDato, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bordeFila}` }}>
                                <span style={{ fontSize: 11, color: textoSecundario, display: 'block', marginBottom: 3 }}>🌐 Plataforma de Venta</span>
                                <strong style={{ fontSize: 13, color: textoPrincipal }}>
                                  {s.plataforma_venta || 'WhatsApp'}
                                </strong>
                              </div>

                              <div style={{ background: bgCajaDato, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bordeFila}` }}>
                                <span style={{ fontSize: 11, color: textoSecundario, display: 'block', marginBottom: 3 }}>⚡ Tiempo Contratado</span>
                                <strong style={{ fontSize: 13, color: '#38bdf8' }}>
                                  {s.duracion_meses || 1} meses
                                </strong>
                              </div>

                              <div style={{ background: bgCajaDato, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bordeFila}` }}>
                                <span style={{ fontSize: 11, color: textoSecundario, display: 'block', marginBottom: 3 }}>💰 Precio Pagado</span>
                                <strong style={{ fontSize: 14, color: '#a855f7' }}>
                                  S/ {Number(s.subtotal).toFixed(2)}
                                </strong>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => setModalRenovar(s)}
                                className="btn-primary"
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', fontSize: 12, padding: '9px 16px' }}
                              >
                                <RefreshCw size={14} /> Renovar / Ver Mensaje para Usuario
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <Paginador
                  totalItems={suscripciones.length}
                  itemsPorPagina={itemsPorPagina}
                  setItemsPorPagina={setItemsPorPagina}
                  paginaActual={paginaActual}
                  setPaginaActual={setPaginaActual}
                  esMiller={true}
                />
              </>
            )
          ) : (
            /* Vista de Servicios / Cuentas Madre Próximas a Vencer */
            cuentasMadre.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '30px 0', color: textoSecundario, fontSize: 13 }}>
                No hay cuentas madre o servicios registrados en Compras de Miller Digital.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cuentasMadre.map(m => {
                  const dias = calcularDiasRestantes(m.fecha_vencimiento)
                  const libres = Number(m.cupos_totales || 1) - Number(m.cupos_usados || 0)
                  const expandido = expandidoId === m.id

                  return (
                    <div key={m.id} style={{
                      border: `1.5px solid ${dias <= 7 ? '#ef4444' : bordeFila}`,
                      borderRadius: 12,
                      background: dias <= 7 ? bgFilaUrgente : bgFila,
                      overflow: 'hidden'
                    }}>
                      <div onClick={() => setExpandidoId(expandido ? null : m.id)} style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 12 }}>
                        <div>
                          <p style={{ fontWeight: 800, fontSize: 15, color: textoPrincipal }}>{m.servicio_nombre || m.empresa}</p>
                          <p style={{ fontSize: 12, color: textoSecundario, marginTop: 4 }}>
                            🔑 Cuenta: <b style={{ color: textoPrincipal }}>{m.cuenta_correo || 'S/C'}</b> &nbsp;·&nbsp; 👥 Cupos libres: <b style={{ color: '#38bdf8' }}>{libres} de {m.cupos_totales || 1}</b>
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: dias <= 7 ? '#ef4444' : '#0891b2', color: '#fff' }}>
                            Vence: {m.fecha_vencimiento || 'Sin fecha'} ({dias}d)
                          </span>
                          {expandido ? <ChevronUp size={18} color={textoSecundario} /> : <ChevronDown size={18} color={textoSecundario} />}
                        </div>
                      </div>

                      {expandido && (
                        <div style={{ padding: '16px', background: bgDetalle, borderTop: `1px solid ${bordeFila}` }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
                            <div style={{ background: bgCajaDato, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bordeFila}` }}>
                              <span style={{ fontSize: 11, color: textoSecundario, display: 'block', marginBottom: 3 }}>👤 Proveedor</span>
                              <strong style={{ fontSize: 13, color: textoPrincipal }}>{m.empresa}</strong>
                            </div>
                            <div style={{ background: bgCajaDato, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bordeFila}` }}>
                              <span style={{ fontSize: 11, color: textoSecundario, display: 'block', marginBottom: 3 }}>📱 WhatsApp Proveedor</span>
                              <strong style={{ fontSize: 13, color: textoPrincipal }}>{m.proveedor_whatsapp || 'S/N'}</strong>
                            </div>
                            <div style={{ background: bgCajaDato, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bordeFila}` }}>
                              <span style={{ fontSize: 11, color: textoSecundario, display: 'block', marginBottom: 3 }}>🌐 Plataforma Compra</span>
                              <strong style={{ fontSize: 13, color: textoPrincipal }}>{m.plataforma_compra || 'Directo'}</strong>
                            </div>
                            <div style={{ background: bgCajaDato, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bordeFila}` }}>
                              <span style={{ fontSize: 11, color: textoSecundario, display: 'block', marginBottom: 3 }}>💰 Costo Pagado</span>
                              <strong style={{ fontSize: 13, color: '#10b981' }}>S/ {Number(m.total).toFixed(2)}</strong>
                            </div>
                            <div style={{ background: bgCajaDato, padding: '10px 12px', borderRadius: 8, border: `1px solid ${bordeFila}` }}>
                              <span style={{ fontSize: 11, color: textoSecundario, display: 'block', marginBottom: 3 }}>📅 Fecha Compra</span>
                              <strong style={{ fontSize: 13, color: textoPrincipal }}>{m.fecha_compra}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Modal para Enviar Mensaje de Renovación y Extender Fecha */}
          {modalRenovar && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div className="card" style={{ width: '100%', maxWidth: 500, padding: 24, border: `1px solid ${bordeFila}` }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10, color: textoPrincipal }}>
                  📲 Texto de Renovación para {modalRenovar.cliente_nombre}
                </h3>
                <textarea
                  readOnly
                  rows={7}
                  value={generarTextoRenovacion(modalRenovar)}
                  style={{ width: '100%', fontSize: 12, padding: 12, borderRadius: 8, border: `1px solid ${bordeFila}`, background: bgDetalle, color: textoPrincipal, marginBottom: 12 }}
                />
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button
                    onClick={() => { navigator.clipboard.writeText(generarTextoRenovacion(modalRenovar)); toast.success('Mensaje copiado 📋') }}
                    className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
                    <Copy size={14} /> Copiar Texto
                  </button>
                  {modalRenovar.cliente_whatsapp && (
                    <a
                      href={`https://wa.me/51${modalRenovar.cliente_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(generarTextoRenovacion(modalRenovar))}`}
                      target="_blank" rel="noopener noreferrer"
                      className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: '#10b981', border: 'none', fontSize: 12, textDecoration: 'none' }}>
                      <Send size={14} /> Mandar por WhatsApp
                    </a>
                  )}
                </div>

                <div style={{ borderTop: `1px solid ${bordeFila}`, paddingTop: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: textoPrincipal }}>
                    ¿Confirmar renovación de fecha en el sistema?
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={mesesRenovar} onChange={e => setMesesRenovar(e.target.value)} style={{ flex: 1, fontSize: 13 }}>
                      <option value={1}>+ 1 Mes</option>
                      <option value={3}>+ 3 Meses (S/ 3)</option>
                      <option value={6}>+ 6 Meses (S/ 5)</option>
                      <option value={12}>+ 12 Meses (S/ 8)</option>
                    </select>
                    <button onClick={() => confirmarRenovacionRapida(modalRenovar)} className="btn-primary" style={{ background: '#7c3aed', border: 'none' }}>
                      <CheckCircle size={15} /> Renovar
                    </button>
                  </div>
                </div>

                <button onClick={() => setModalRenovar(null)} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>Cerrar</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ==================== MODO RICHARD EXPRESS: STOCK BAJO Y AGOTADOS (ADAPTADO A MODO OSCURO) ==================== */
        <>
          {hayAlertas && (
            <div style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ minWidth: 200, fontSize: 13 }}>
                <option value="">Todas las categorías</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {filtroCat && (
                <button onClick={() => setFiltroCat('')} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
                  ✕ Limpiar
                </button>
              )}
            </div>
          )}

          {bajFiltrado.length > 0 && (
            <div className="card" style={{ padding: '18px 20px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <AlertTriangle size={18} color="#f59e0b" />
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f59e0b' }}>Stock bajo — quedan solo 1</h2>
                <span style={{ fontSize: 12, color: 'var(--texto-suave)', marginLeft: 4 }}>· Clic para editar</span>
                <span className="badge badge-naranja" style={{ marginLeft: 'auto' }}>{bajFiltrado.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bajFiltrado.map(p => (
                  <button key={p.id} onClick={() => irAEditar(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px',
                      background: modoOscuro ? 'rgba(245, 158, 11, 0.12)' : '#FFF3E0',
                      borderRadius: 8, border: `1px solid ${modoOscuro ? 'rgba(245, 158, 11, 0.35)' : '#FFCC80'}`,
                      cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left', color: textoPrincipal
                    }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</span>
                      {p.categorias?.nombre && <span style={{ fontSize: 11, color: textoSecundario, marginLeft: 8 }}>· {p.categorias.nombre}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="badge badge-naranja">Stock: {p.stock}</span>
                      <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>✏️ Editar →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {ceroFiltrado.length > 0 && (
            <div className="card" style={{ padding: '18px 20px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <XCircle size={18} color="#ef4444" />
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#ef4444' }}>Sin stock — agotados</h2>
                <span style={{ fontSize: 12, color: 'var(--texto-suave)', marginLeft: 4 }}>· Clic para editar</span>
                <span className="badge badge-rojo" style={{ marginLeft: 'auto' }}>{ceroFiltrado.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ceroFiltrado.map(p => (
                  <button key={p.id} onClick={() => irAEditar(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px',
                      background: modoOscuro ? 'rgba(239, 68, 68, 0.12)' : '#FFEBEE',
                      borderRadius: 8, border: `1px solid ${modoOscuro ? 'rgba(239, 68, 68, 0.35)' : '#FFCDD2'}`,
                      cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left', color: textoPrincipal
                    }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</span>
                      {p.categorias?.nombre && <span style={{ fontSize: 11, color: textoSecundario, marginLeft: 8 }}>· {p.categorias.nombre}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="badge badge-rojo">Agotado</span>
                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>✏️ Editar →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {inactivosFiltrado.length > 0 && (
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: verInactivos ? 14 : 0 }}>
                <EyeOff size={18} color={textoSecundario} />
                <h2 style={{ fontSize: 16, fontWeight: 600, color: textoPrincipal }}>Productos inactivos</h2>
                <span style={{ fontSize: 12, color: textoSecundario, marginLeft: 4 }}>· No visibles en la tienda</span>
                <span className="badge badge-gris" style={{ marginLeft: 'auto' }}>{inactivosFiltrado.length}</span>
                <button onClick={() => setVerInactivos(!verInactivos)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--naranja)', fontWeight: 600, marginLeft: 4 }}>
                  {verInactivos ? 'Ocultar' : 'Ver todos'}
                </button>
              </div>
              {verInactivos && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {inactivosFiltrado.map(p => (
                    <button key={p.id} onClick={() => irAEditar(p.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px',
                        background: bgFila, borderRadius: 8, border: `1px solid ${bordeFila}`,
                        cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left', color: textoPrincipal
                      }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                        {p.categorias?.nombre && <span style={{ fontSize: 11, color: textoSecundario, marginLeft: 8 }}>· {p.categorias.nombre}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {Number(p.precio || 0) === 0 && <span className="badge badge-rojo">Sin precio</span>}
                        {p.stock <= 0 && <span className="badge badge-gris">Sin stock</span>}
                        <span style={{ fontSize: 11, color: textoSecundario, fontWeight: 600 }}>✏️ Editar →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
