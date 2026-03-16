import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store'
import { Search, Plus, Minus, Trash2, Printer, CheckCircle, Package, Calculator, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

export default function VendedorVenta() {
  const [productos, setProductos]             = useState([])
  const [busqueda, setBusqueda]               = useState('')
  const [carrito, setCarrito]                 = useState([])
  const [nombreCliente, setNombreCliente]     = useState('')
  const [notas, setNotas]                     = useState('')
  const [montoPagado, setMontoPagado]         = useState('')
  const [mostrarCalc, setMostrarCalc]         = useState(false)
  const [calcDisplay, setCalcDisplay]         = useState('0')
  const [calcPrev, setCalcPrev]               = useState(null)
  const [calcOp, setCalcOp]                   = useState(null)
  const [calcNuevo, setCalcNuevo]             = useState(true)
  const [procesando, setProcesando]           = useState(false)
  const [ventaCompletada, setVentaCompletada] = useState(null)
  const { perfil } = useAuth()
  const boletaRef = useRef()

  useEffect(() => { cargarProductos() }, [])

  async function cargarProductos() {
    const { data } = await supabase
      .from('productos')
      .select('*, categorias(nombre), secciones(nombre)')
      .eq('activo', true)
      .order('nombre')
    setProductos(data || [])
  }

  const productosFiltrados = busqueda.trim().length > 0
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.codigo_barras && p.codigo_barras.includes(busqueda))
      )
    : productos

  function agregar(p) {
    if (p.stock < 1) return toast.error('Sin stock disponible')
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

  function quitar(id) { setCarrito(prev => prev.filter(i => i.id !== id)) }

  const total    = carrito.reduce((a, i) => a + i.precio * i.cantidad, 0)
  const pagado   = parseFloat(montoPagado) || 0
  const vuelto   = pagado - total
  const hayVuelto = montoPagado !== '' && pagado >= total

  async function procesarVenta() {
    if (carrito.length === 0) return toast.error('Agrega productos al carrito')
    if (montoPagado !== '' && pagado < total) return toast.error(`Monto insuficiente. Faltan S/ ${(total - pagado).toFixed(2)}`)
    setProcesando(true)
    try {
      const { data: venta, error: errVenta } = await supabase
        .from('ventas')
        .insert({
          vendedor_id: perfil.id,
          tipo: 'fisica',
          total,
          estado: 'completada',
          nombre_cliente: nombreCliente || 'Cliente general',
          notas: notas || null,
        })
        .select()
        .single()
      if (errVenta) throw errVenta

      const items = carrito.map(i => ({
        venta_id: venta.id,
        producto_id: i.id,
        nombre_producto: i.nombre,
        precio_unitario: i.precio,
        cantidad: i.cantidad,
        subtotal: i.precio * i.cantidad,
      }))
      const { error: errItems } = await supabase.from('venta_items').insert(items)
      if (errItems) throw errItems

      setVentaCompletada({
        ...venta,
        items,
        nombre_cliente: nombreCliente || 'Cliente general',
        monto_pagado: pagado > 0 ? pagado : null,
        vuelto: pagado > 0 ? vuelto : null,
      })
      setCarrito([])
      setNombreCliente('')
      setNotas('')
      setMontoPagado('')
      cargarProductos()
      toast.success('¡Venta registrada!')
    } catch (e) {
      toast.error('Error: ' + e.message)
    }
    setProcesando(false)
  }

  // Calculadora
  function calcPresionar(val) {
    if (val === 'C') {
      setCalcDisplay('0'); setCalcPrev(null); setCalcOp(null); setCalcNuevo(true); return
    }
    if (val === '←') {
      setCalcDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0'); return
    }
    if (['+', '-', '×', '÷'].includes(val)) {
      setCalcPrev(parseFloat(calcDisplay))
      setCalcOp(val)
      setCalcNuevo(true)
      return
    }
    if (val === '=') {
      if (calcPrev === null || !calcOp) return
      const b = parseFloat(calcDisplay)
      let res = calcPrev
      if (calcOp === '+') res = calcPrev + b
      if (calcOp === '-') res = calcPrev - b
      if (calcOp === '×') res = calcPrev * b
      if (calcOp === '÷') res = b !== 0 ? calcPrev / b : 0
      const redondeado = Math.round(res * 100) / 100
      setCalcDisplay(String(redondeado))
      setCalcPrev(null); setCalcOp(null); setCalcNuevo(true)
      return
    }
    if (val === '.') {
      if (calcNuevo) { setCalcDisplay('0.'); setCalcNuevo(false); return }
      if (!calcDisplay.includes('.')) setCalcDisplay(prev => prev + '.')
      return
    }
    if (calcNuevo) { setCalcDisplay(val); setCalcNuevo(false) }
    else setCalcDisplay(prev => prev === '0' ? val : prev + val)
  }

  const botonesCalc = [
    ['C', '←', '÷', '×'],
    ['7', '8', '9', '-'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '='],
    ['0', '0', '.', '='],
  ]

  function imprimirBoleta() {
    const contenido = boletaRef.current.innerHTML
    const ventana = window.open('', '_blank')
    ventana.document.write(`
      <html><head><title>Boleta</title>
      <style>
        body { font-family: monospace; font-size: 13px; padding: 20px; max-width: 320px; margin: 0 auto; }
        .sep { border-top: 1px dashed #000; margin: 8px 0; }
        .centro { text-align: center; }
        .fila { display: flex; justify-content: space-between; margin: 3px 0; }
        h2 { font-size: 16px; margin: 4px 0; }
        h3 { font-size: 13px; margin: 2px 0; font-weight: 400; }
      </style></head>
      <body>${contenido}</body></html>
    `)
    ventana.document.close()
    ventana.print()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, minHeight: 'calc(100vh - 100px)' }}>

      {/* Lista productos */}
      <div>
        <h2 style={{ fontFamily: 'var(--fuente-display)', fontSize: 20, fontWeight: 800, marginBottom: 14 }}>
          Productos<span style={{ color: 'var(--naranja)' }}>.</span>
        </h2>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-suave)' }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código..." style={{ paddingLeft: 32 }} autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {productosFiltrados.map(p => (
            <button key={p.id} onClick={() => agregar(p)} disabled={p.stock < 1}
              style={{ background: p.stock < 1 ? 'var(--fondo)' : 'var(--blanco)', border: '1px solid var(--borde)', borderRadius: 12, padding: 0, cursor: p.stock < 1 ? 'not-allowed' : 'pointer', overflow: 'hidden', textAlign: 'left', opacity: p.stock < 1 ? 0.6 : 1, transition: 'all 0.15s' }}
              onMouseEnter={e => p.stock > 0 && (e.currentTarget.style.borderColor = 'var(--naranja)')}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--borde)'}>
              {p.imagen_url
                ? <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
                : <div style={{ width: '100%', aspectRatio: '1', background: 'var(--naranja-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={28} color="var(--naranja)" />
                  </div>
              }
              <div style={{ padding: '8px 10px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, lineHeight: 1.3 }}>{p.nombre}</p>
                <p style={{ fontSize: 13, color: 'var(--naranja)', fontWeight: 700 }}>S/ {Number(p.precio).toFixed(2)}</p>
                {p.secciones?.nombre && (
                  <p style={{ fontSize: 10, color: '#7C3AED', fontWeight: 500 }}>📍 {p.secciones.nombre}</p>
                )}
                <p style={{ fontSize: 11, color: p.stock <= p.stock_minimo ? '#E65100' : 'var(--texto-suave)' }}>
                  Stock: {p.stock}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {ventaCompletada ? (
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <CheckCircle size={40} color="#2E7D32" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontWeight: 700, fontSize: 16, color: '#2E7D32' }}>¡Venta completada!</p>
            </div>

            <div ref={boletaRef} style={{ fontFamily: 'monospace', fontSize: 12, border: '1px dashed var(--borde)', borderRadius: 8, padding: 14, background: 'var(--fondo)' }}>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <h2 style={{ fontFamily: 'var(--fuente-display)', fontSize: 14, margin: '0 0 2px' }}>RICHARD EXPRESS MARKET</h2>
                <h3>BOLETA DE VENTA</h3>
                <p style={{ margin: '4px 0', fontSize: 11 }}>{new Date(ventaCompletada.created_at).toLocaleString('es-PE')}</p>
              </div>
              <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
              <p style={{ margin: '2px 0' }}>Cliente: {ventaCompletada.nombre_cliente}</p>
              <p style={{ margin: '2px 0' }}>Vendedor: {perfil?.nombre || 'Vendedor'}</p>
              <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
              {ventaCompletada.items.map(i => (
                <div key={i.producto_id} style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
                  <span style={{ flex: 1, marginRight: 8 }}>{i.nombre_producto} x{i.cantidad}</span>
                  <span>S/ {Number(i.subtotal).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                <span>TOTAL:</span>
                <span>S/ {Number(ventaCompletada.total).toFixed(2)}</span>
              </div>
              {ventaCompletada.monto_pagado > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                    <span>PAGÓ:</span>
                    <span>S/ {Number(ventaCompletada.monto_pagado).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#2E7D32' }}>
                    <span>VUELTO:</span>
                    <span>S/ {Number(ventaCompletada.vuelto).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
              <p style={{ textAlign: 'center', fontSize: 11 }}>¡Gracias por su compra!</p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={imprimirBoleta} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
                <Printer size={14} /> Imprimir
              </button>
              <button onClick={() => setVentaCompletada(null)} className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
                Nueva venta
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Carrito */}
            <div className="card" style={{ padding: '16px' }}>
              <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Carrito</h3>

              {carrito.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--texto-suave)', textAlign: 'center', padding: '20px 0' }}>
                  Haz clic en los productos para agregarlos
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                  {carrito.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</p>
                        <p style={{ fontSize: 12, color: 'var(--naranja)' }}>S/ {Number(item.precio).toFixed(2)}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => cambiarCantidad(item.id, item.cantidad - 1)}
                          style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--fondo)', border: '1px solid var(--borde)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Minus size={11} />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.cantidad}</span>
                        <button onClick={() => cambiarCantidad(item.id, item.cantidad + 1)}
                          style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--naranja-light)', border: '1px solid var(--naranja-mid)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--naranja)' }}>
                          <Plus size={11} />
                        </button>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, minWidth: 52, textAlign: 'right' }}>
                        S/ {(item.precio * item.cantidad).toFixed(2)}
                      </span>
                      <button onClick={() => quitar(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D00', padding: '2px' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {carrito.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--borde)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Total</span>
                  <span style={{ fontFamily: 'var(--fuente-display)', fontSize: 20, fontWeight: 800, color: 'var(--naranja)' }}>
                    S/ {total.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Datos + pago */}
            <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Nombre del cliente (opcional)</label>
                <input value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} placeholder="Ej: Juan Pérez" />
              </div>

              {/* Monto pagado + vuelto */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Con cuánto paga (opcional)</label>
                <input
                  type="number" min="0" step="0.10"
                  value={montoPagado}
                  onChange={e => setMontoPagado(e.target.value)}
                  placeholder={`Ej: ${Math.ceil(total)}.00`}
                />
              </div>

              {/* Vuelto en tiempo real */}
              {montoPagado !== '' && (
                <div style={{ borderRadius: 10, padding: '10px 14px', background: vuelto >= 0 ? '#E8F5E9' : '#FFEBEE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: vuelto >= 0 ? '#2E7D32' : '#C62828' }}>
                    {vuelto >= 0 ? '💵 Vuelto:' : '⚠ Falta:'}
                  </span>
                  <span style={{ fontFamily: 'var(--fuente-display)', fontSize: 18, fontWeight: 800, color: vuelto >= 0 ? '#2E7D32' : '#C62828' }}>
                    S/ {Math.abs(vuelto).toFixed(2)}
                  </span>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Notas (opcional)</label>
                <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas opcionales" />
              </div>

              <button onClick={procesarVenta} className="btn-primary"
                disabled={procesando || carrito.length === 0}
                style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, borderRadius: 10, opacity: procesando || carrito.length === 0 ? 0.6 : 1 }}>
                {procesando ? 'Procesando...' : `Cobrar S/ ${total.toFixed(2)}`}
              </button>
            </div>

            {/* Calculadora opcional */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <button onClick={() => setMostrarCalc(!mostrarCalc)}
                style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: 'var(--texto-suave)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calculator size={15} /> Calculadora</span>
                {mostrarCalc ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {mostrarCalc && (
                <div style={{ padding: '0 12px 12px' }}>
                  <div style={{ background: 'var(--texto)', color: 'white', borderRadius: 8, padding: '10px 14px', textAlign: 'right', marginBottom: 8 }}>
                    {calcOp && <p style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>{calcPrev} {calcOp}</p>}
                    <p style={{ fontFamily: 'var(--fuente-display)', fontSize: 22, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{calcDisplay}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                    {['C', '←', '÷', '×', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', '00', '.', '='].map((btn, idx) => {
                      const esIgual   = btn === '=' && (idx === 15 || idx === 19)
                      const esOp      = ['+', '-', '×', '÷'].includes(btn)
                      const esClear   = btn === 'C'
                      const esBack    = btn === '←'
                      return (
                        <button key={idx} onClick={() => calcPresionar(btn)}
                          style={{
                            padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                            background: esIgual ? 'var(--naranja)' : esOp ? 'var(--naranja-light)' : esClear ? '#FFEBEE' : esBack ? '#F0F0F0' : 'var(--fondo)',
                            color: esIgual ? 'white' : esOp ? 'var(--naranja)' : esClear ? '#C62828' : 'var(--texto)',
                            transition: 'opacity 0.1s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                          {btn}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
