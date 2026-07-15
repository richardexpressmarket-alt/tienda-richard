import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store'
import { ShoppingBag, Calendar, Trash2, Download, Plus, X, Search, Package } from 'lucide-react'
import { exportarCSV } from '../../lib/exportar'
import toast from 'react-hot-toast'

export default function AdminVentas() {
  const [ventas, setVentas]               = useState([])
  const [cargando, setCargando]           = useState(true)
  const [modalVenta, setModalVenta]       = useState(false)
  const [productos, setProductos]         = useState([])
  const [busqueda, setBusqueda]           = useState('')
  const [carrito, setCarrito]             = useState([])
  const [nombreCliente, setNombreCliente] = useState('')
  const [notas, setNotas]                 = useState('')
  const [fechaVenta, setFechaVenta]       = useState(new Date().toISOString().split('T')[0])
  const [guardando, setGuardando]         = useState(false)
  
  // Nuevo estado para mostrar/ocultar opciones de cliente
  const [mostrarOpcionesCliente, setMostrarOpcionesCliente] = useState(false)
  
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
    setMostrarOpcionesCliente(false)
    cargarProductos()
    setModalVenta(true)
  }

  const prodsFiltrados = busqueda.trim()
    ? productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : productos

  // MODIFICADO: Agrega un nuevo ítem siempre, sin agrupar cantidades
  function agregarAlCarrito(p) {
    if (p.stock < 1) return toast.error('Sin stock')
    
    // Verificamos que no exceda el stock total disponible del producto en el carrito
    const agregados = carrito.filter(i => i.id === p.id).length
    if (agregados >= p.stock) return toast.error('Stock insuficiente')

    setCarrito(prev => [...prev, { ...p, cartId: Date.now() + Math.random(), cantidad: 1 }])
  }

  // MODIFICADO: Elimina por cartId único
  function quitar(cartId) { 
    setCarrito(prev => prev.filter(i => i.cartId !== cartId)) 
  }

  // MODIFICADO: Actualiza el precio usando cartId único
  function cambiarPrecio(cartId, valor) {
    setCarrito(prev => prev.map(i => i.cartId === cartId ? { ...i, precio: valor } : i))
  }

  const totalVenta = carrito.reduce((a, i) => a + (parseFloat(i.precio) || 0) * i.cantidad, 0)

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
        precio_unitario: parseFloat(i.precio) || 0,
        cantidad:        i.cantidad,
        subtotal:        (parseFloat(i.precio) || 0) * i.cantidad,
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

  async function eliminarVenta(itemId, esUltimo) {
    const msg = esUltimo
      ? '¿Eliminar este producto? Era el único, se eliminará la venta completa y se restaurará el stock.'
      : '¿Eliminar este producto de la venta? Se restaurará su stock.'
    if (!confirm(msg)) return
    try {
      const { error } = await supabase.rpc('revertir_item', { item_uuid: itemId })
      if (error) throw error
      toast.success('Producto eliminado y stock restaurado')
      cargar()
    } catch (e) {
      toast.error('Error: ' + e.message)
    }
  }

  const lineas = ventas.flatMap(v =>
    (v.venta_items || []).map(item => ({
      ...item,
      fecha: v.created_at,
      vendedor: v.perfiles?.nombre || 'Admin',
      cliente: v.nombre_cliente,
      tipo: v.tipo,
      venta_id: v.id,
      notas: v.notas,
      total_venta: v.total,
      items_count: v.venta_items?.length || 1,
    }))
  )

  function handleExportar() {
    if (lineas.length === 0) return toast.error('No hay ventas para exportar')
    exportarCSV('ventas', [
      ['Fecha', 'Producto', 'Cantidad', 'Precio Ud.', 'Subtotal', 'Cliente', 'Vendedor', 'Tipo', 'Notas'],
      ...lineas.map(l => [
        new Date(l.fecha).toLocaleDateString('es-PE'),
        l.nombre_producto,
        l.cantidad,
        Number(l.precio_unitario).toFixed(2),
        Number(l.subtotal).toFixed(2),
        l.cliente || '',
        l.vendedor,
        l.tipo === 'online' ? 'WhatsApp' : 'Fisica',
        l.notas || ''
      ])
    ])
    toast.success('Excel exportado')
  }

  const totalPeriodo = ventas.reduce((a, v) => a + Number(v.total), 0)
  const totalProductos = lineas.reduce((a, l) => a + l.cantidad, 0)

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
            {/* MODIFICADO: Eliminado el texto de "X ventas" para solo mostrar los productos */}
            <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{totalProductos} productos vendidos</p>
            <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18, color: 'var(--naranja)' }}>
              S/ {totalPeriodo.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {cargando ? <div className="spinner" /> : lineas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>
          <ShoppingBag size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <p>No hay ventas en este periodo</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lineas.map((l, idx) => (
            <div key={l.id || idx} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>

              {l.productos?.imagen_url
                ? <img src={l.productos.imagen_url} alt={l.nombre_producto} style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={18} color="var(--borde)" />
                  </div>
              }

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.nombre_producto}
                </p>
                <p style={{ fontSize: 11, color: 'var(--texto-suave)', marginTop: 2 }}>
                  {new Date(l.fecha).toLocaleDateString('es-PE')}
                  {' · '}{l.vendedor}
                  {l.cliente ? ` · ${l.cliente}` : ''}
                  {l.notas ? ` · ${l.notas}` : ''}
                </p>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {l.cantidad > 1 ? (
                  <>
                    <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>
                      x{l.cantidad} · S/ {Number(l.precio_unitario).toFixed(2)} c/u
                    </p>
                    <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 15, color: 'var(--naranja)' }}>
                      S/ {Number(l.subtotal).toFixed(2)}
                    </p>
                  </>
                ) : (
                  <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 15 }}>
                    S/ {Number(l.subtotal).toFixed(2)}
                  </p>
                )}
              </div>

              <button
                onClick={() => eliminarVenta(l.id, l.items_count === 1)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, color: '#D00' }}>
                <Trash2 size={15} />
              </button>

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
                      <div key={item.cartId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</p>
                          
                          {(item.unidad && /kg|kilo|g|gramo|gr/i.test(item.unidad)) ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <span style={{ fontSize: 11, color: 'var(--naranja)' }}>S/</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={item.precio}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9.]/g, '');
                                  if (val.split('.').length > 2) return;
                                  cambiarPrecio(item.cartId, val);
                                }}
                                onFocus={(e) => e.target.select()}
                                style={{ width: 70, fontSize: 12, padding: '2px 4px', border: '1px solid var(--borde)', borderRadius: 4, outline: 'none' }}
                                placeholder="0.00"
                              />
                            </div>
                          ) : (
                            <p style={{ fontSize: 11, color: 'var(--naranja)' }}>S/ {Number(item.precio).toFixed(2)}</p>
                          )}
                          
                        </div>
                        
                        <p style={{ fontSize: 12, fontWeight: 700, minWidth: 50, textAlign: 'right' }}>
                          S/ {((parseFloat(item.precio) || 0) * item.cantidad).toFixed(2)}
                        </p>
                        <button onClick={() => quitar(item.cartId)}
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
                    
                    {/* MODIFICADO: Toggle para mostrar las opciones de Cliente y Notas */}
                    <button
                      onClick={() => setMostrarOpcionesCliente(!mostrarOpcionesCliente)}
                      style={{ background: 'none', border: 'none', color: 'var(--naranja)', fontSize: 12, cursor: 'pointer', textAlign: 'left', fontWeight: 600, marginTop: 4 }}>
                      {mostrarOpcionesCliente ? '− Ocultar opciones de cliente' : '+ Agregar venta por cliente (Opcional)'}
                    </button>

                    {mostrarOpcionesCliente && (
                      <>
                        <input value={nombreCliente} onChange={e => setNombreCliente(e.target.value)}
                          placeholder="Nombre del cliente (opcional)" style={{ fontSize: 13 }} />
                        <input value={notas} onChange={e => setNotas(e.target.value)}
                          placeholder="Notas (opcional)" style={{ fontSize: 13 }} />
                      </>
                    )}

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
