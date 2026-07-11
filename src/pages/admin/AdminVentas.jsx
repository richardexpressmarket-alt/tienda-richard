import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store'
import { ShoppingBag, ChevronDown, ChevronUp, Calendar, Trash2, Download, Plus, X, Search, Package } from 'lucide-react'
import { exportarCSV } from '../../lib/exportar'
import toast from 'react-hot-toast'

export default function AdminVentas() {
  const [ventas, setVentas]               = useState([])
  const [cargando, setCargando]           = useState(true)
  const [expandida, setExpandida]         = useState(null)
  const [modalVenta, setModalVenta]       = useState(false)
  const [productos, setProductos]         = useState([])
  const [busqueda, setBusqueda]           = useState('')
  const [carrito, setCarrito]             = useState([])
  const [nombreCliente, setNombreCliente] = useState('')
  const [notas, setNotas]                 = useState('')
  const [fechaVenta, setFechaVenta]       = useState(new Date().toISOString().split('T')[0])
  const [guardando, setGuardando]         = useState(false)
  const { perfil } = useAuth()

  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => { cargar() }, [desde, hasta])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('ventas')
      .select('*, perfiles(nombre), venta_items(*, productos(nombre, imagen_url))')
      .gte('created_at', desde + 'T00:00:00')
      .lte('created_at', hasta + 'T23:59:59')
      .order('created_at', { ascending: false })
    setVentas(data || [])
    setCargando(false)
  }

  async function cargarProductos() {
    const { data } = await supabase
      .from('productos')
      .select('id, nombre, precio, stock, unidad, imagen_url')
      .eq('activo', true)
      .order('nombre')
    setProductos(data || [])
  }

  function abrirModal() {
    setCarrito([])
    setNombreCliente('')
    setNotas('')
    setFechaVenta(new Date().toISOString().split('T')[0])
    setBusqueda('')
    cargarProductos()
    setModalVenta(true)
  }

  const prodsFiltrados = busqueda.trim()
    ? productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : productos

  function agregarAlCarrito(p) {
    if (p.stock < 1) return toast.error('Sin stock')
    setCarrito(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex) {
        if (ex.cantidad >= p.stock) { toast.error('Stock insuficiente'); return prev }
        return prev.map(i => i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      }
      return [...prev, { ...p, cantidad: 1 }]
    })
  }

  function cambiarCantidad(id, cantidad) {
    if (cantidad < 1) return
    const prod = productos.find(p => p.id === id)
    if (prod && cantidad > prod.stock) return toast.error('Stock insuficiente')
    setCarrito(prev => prev.map(i => i.id === id ? { ...i, cantidad } : i))
  }

  const totalVenta = carrito.reduce((a, i) => a + i.precio * i.cantidad, 0)

  async function guardarVenta() {
    if (carrito.length === 0) return toast.error('Agrega al menos un producto')
    setGuardando(true)
    try {
      const { data: venta, error: errV } = await supabase
        .from('ventas')
        .insert({
          vendedor_id:    perfil?.id || null,
          tipo:           'fisica',
          total:          totalVenta,
          estado:         'completada',
          nombre_cliente: nombreCliente || null,
          notas:          notas || null,
          created_at:     fechaVenta + 'T' + new Date().toTimeString().split(' ')[0],
        })
        .select()
        .single()
      if (errV) throw errV

      const items = carrito.map(i => ({
        venta_id:        venta.id,
        producto_id:     i.id,
        nombre_producto: i.nombre,
        precio_unitario: i.precio,
        cantidad:        i.cantidad,
        subtotal:        i.precio * i.cantidad,
      }))
      const { error: errI } = await supabase.from('venta_items').insert(items)
      if (errI) throw errI

      toast.success('Venta registrada')
      setModalVenta(false)
      cargar()
    } catch (e) {
      toast.error('Error: ' + e.message)
    }
    setGuardando(false)
  }

  async function eliminarVenta(venta) {
    if (!confirm('Eliminar esta venta? Esto restaurara el stock.')) return
    try {
      const { error } = await supabase.rpc('revertir_venta', { venta_uuid: venta.id })
      if (error) throw error
      toast.success('Venta eliminada y stock restaurado')
      cargar()
    } catch (e) {
      toast.error('Error: ' + e.message)
    }
  }

  function handleExportar() {
    if (ventas.length === 0) return toast.error('No hay ventas para exportar')
    exportarCSV('ventas', [
      ['Fecha', 'Productos', 'Cliente', 'Vendedor', 'Tipo', 'Total (S/)', 'Notas'],
      ...ventas.map(v => [
        new Date(v.created_at).toLocaleDateString('es-PE'),
        v.venta_items?.map(i => i.nombre_producto + ' x' + i.cantidad).join(', ') || '',
        v.nombre_cliente || '',
        v.perfiles?.nombre || 'Sistema',
        v.tipo === 'online' ? 'WhatsApp' : 'Fisica',
        Number(v.total).toFixed(2),
        v.notas || ''
      ])
    ])
    toast.success('Excel exportado')
  }

  const totalPeriodo = ventas.reduce((a, v) => a + Number(v.total), 0)

  function resumenProductos(items) {
    if (!items || items.length === 0) return 'Sin productos'
    const nombres = items.map(i => i.nombre_producto + ' x' + i.cantidad)
    const texto = nombres.join(', ')
    return texto.length > 60 ? texto.substring(0, 57) + '...' : texto
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
          Ventas<span style={{ color: 'var(--naranja)' }}>.</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExportar} className="btn-ghost" style={{ fontSize: 13 }}>
            <Download size={14} /> Excel
          </button>
          <button onClick={abrirModal} className="btn-primary" style={{ gap: 6 }}>
            <Plus size={15} /> Agregar venta
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Calendar size={16} color="var(--texto-suave)" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: 'var(--texto-suave)' }}>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 'auto', padding: '6px 10px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: 'var(--texto-suave)' }}>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 'auto', padding: '6px 10px' }} />
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{ventas.length} ventas</p>
            <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18, color: 'var(--naranja)' }}>
              S/ {totalPeriodo.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {cargando ? <div className="spinner" /> : ventas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>
          <ShoppingBag size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <p>No hay ventas en este periodo</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ventas.map(v => (
            <div key={v.id} className="card" style={{ overflow: 'hidden' }}>
              <button onClick={() => setExpandida(expandida === v.id ? null : v.id)}
                style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: v.tipo === 'online' ? 'var(--naranja-light)' : '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShoppingBag size={16} color={v.tipo === 'online' ? 'var(--naranja)' : '#2E7D32'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {resumenProductos(v.venta_items)}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>
                    {new Date(v.created_at).toLocaleDateString('es-PE')}
                    {v.nombre_cliente ? ` · ${v.nombre_cliente}` : ''}
                    {' · '}{v.perfiles?.nombre || 'Admin'}
                  </p>
                </div>
                <span className={`badge ${v.tipo === 'online' ? 'badge-naranja' : 'badge-verde'}`}>
                  {v.tipo === 'online' ? 'WhatsApp' : 'Fisica'}
                </span>
                <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 16, marginLeft: 8 }}>
                  S/ {Number(v.total).toFixed(2)}
                </p>
                {expandida === v.id ? <ChevronUp size={16} color="var(--texto-suave)" /> : <ChevronDown size={16} color="var(--texto-suave)" />}
              </button>

              {expandida === v.id && (
                <div style={{ borderTop: '1px solid var(--borde)', padding: '14px 16px', background: 'var(--fondo)' }}>
                  {v.venta_items?.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
                      {item.productos?.imagen_url && (
                        <img src={item.productos.imagen_url} alt={item.nombre_producto} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <p style={{ flex: 1, fontSize: 13 }}>{item.nombre_producto}</p>
                      <p style={{ fontSize: 13, color: 'var(--texto-suave)' }}>x{item.cantidad}</p>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>S/ {Number(item.subtotal).toFixed(2)}</p>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8 }}>
                    <button onClick={() => eliminarVenta(v)} className="btn-danger" style={{ fontSize: 12 }}>
                      <Trash2 size={13} /> Eliminar y restaurar stock
                    </button>
                    <p style={{ fontWeight: 700 }}>Total: <span style={{ color: 'var(--naranja)' }}>S/ {Number(v.total).toFixed(2)}</span></p>
                  </div>
                  {v.notas && <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 6 }}>Nota: {v.notas}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalVenta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 640, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--borde)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18 }}>Agregar venta manual</h2>
              <button onClick={() => setModalVenta(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--texto-suave)" />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'hidden' }}>

              <div style={{ borderRight: '1px solid var(--borde)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '12px', borderBottom: '1px solid var(--borde)', flexShrink: 0 }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-suave)' }} />
                    <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto..." style={{ paddingLeft: 30, fontSize: 13 }} autoFocus />
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                  {prodsFiltrados.map(p => (
                    <button key={p.id} onClick={() => agregarAlCarrito(p)} disabled={p.stock < 1}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'none', border: 'none', cursor: p.stock < 1 ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: p.stock < 1 ? 0.5 : 1, marginBottom: 2 }}
                      onMouseEnter={e => p.stock > 0 && (e.currentTarget.style.background = 'var(--naranja-light)')}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      {p.imagen_url
                        ? <img src={p.imagen_url} alt={p.nombre} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Package size={16} color="var(--borde)" /></div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</p>
                        <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>S/ {Number(p.precio).toFixed(2)} · Stock: {p.stock}</p>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--naranja)', fontWeight: 700, flexShrink: 0 }}>+ Agregar</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', flexShrink: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>Productos seleccionados</p>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                  {carrito.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--texto-suave)', textAlign: 'center', padding: '20px 0' }}>
                      Selecciona productos de la izquierda
                    </p>
                  ) : (
                    carrito.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</p>
                          <p style={{ fontSize: 11, color: 'var(--naranja)' }}>S/ {Number(item.precio).toFixed(2)}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button onClick={() => cambiarCantidad(item.id, item.cantidad - 1)}
                            style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--fondo)', border: '1px solid var(--borde)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                            -
                          </button>
                          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 18, textAlign: 'center' }}>{item.cantidad}</span>
                          <button onClick={() => cambiarCantidad(item.id, item.cantidad + 1)}
                            style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--naranja-light)', border: '1px solid var(--naranja-mid)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--naranja)' }}>
                            +
                          </button>
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 700, minWidth: 50, textAlign: 'right' }}>
                          S/ {(item.precio * item.cantidad).toFixed(2)}
                        </p>
                        <button onClick={() => setCarrito(prev => prev.filter(i => i.id !== item.id))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D00', padding: '2px' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--borde)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--texto-suave)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        <Calendar size={11} /> Fecha de la venta
                      </label>
                      <input type="date" value={fechaVenta} onChange={e => setFechaVenta(e.target.value)}
                        style={{ fontSize: 13, width: '100%' }} />
                    </div>
                    <input value={nombreCliente} onChange={e => setNombreCliente(e.target.value)}
                      placeholder="Nombre del cliente (opcional)" style={{ fontSize: 13 }} />
                    <input value={notas} onChange={e => setNotas(e.target.value)}
                      placeholder="Notas (opcional)" style={{ fontSize: 13 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                    <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 20, color: 'var(--naranja)' }}>
                      S/ {totalVenta.toFixed(2)}
                    </span>
                  </div>
                  <button onClick={guardarVenta} className="btn-primary"
                    disabled={guardando || carrito.length === 0}
                    style={{ width: '100%', justifyContent: 'center', padding: '11px', opacity: guardando || carrito.length === 0 ? 0.6 : 1 }}>
                    {guardando ? 'Guardando...' : 'Registrar venta'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
