import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store'
import { ShoppingBag, Calendar, Trash2, Download, Plus, X, Search, Package, FileText, Printer, BarChart3, List } from 'lucide-react'
import { exportarCSV } from '../../lib/exportar'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function AdminVentas() {
  const [tabActual, setTabActual]         = useState('historial')
  const [ventas, setVentas]               = useState([])
  const [cargando, setCargando]           = useState(true)
  const [modalVenta, setModalVenta]       = useState(false)
  const [productos, setProductos]         = useState([])
  const [busqueda, setBusqueda]           = useState('')
  const [busquedaVentas, setBusquedaVentas] = useState('')
  const [carrito, setCarrito]             = useState([])
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
    setFechaVenta(new Date().toISOString().split('T')[0])
    setBusqueda('')
    cargarProductos()
    setModalVenta(true)
  }

  const normalizarTexto = (texto) => {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
  }

  const prodsFiltrados = busqueda.trim()
    ? productos.filter(p => normalizarTexto(p.nombre).includes(normalizarTexto(busqueda)))
    : productos

  function agregarAlCarrito(p) {
    if (p.stock < 1) return toast.error('Sin stock')
    
    const agregados = carrito.filter(i => i.id === p.id).length
    if (agregados >= p.stock) return toast.error('Stock insuficiente')

    setCarrito(prev => [...prev, { ...p, cartId: Date.now() + Math.random(), cantidad: 1 }])
  }

  function quitar(cartId) { 
    setCarrito(prev => prev.filter(i => i.cartId !== cartId)) 
  }

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
          nombre_cliente: null, 
          notas:          null,
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
      tipo: v.tipo,
      venta_id: v.id,
      items_count: v.venta_items?.length || 1,
    }))
  )

  const lineasFiltradas = lineas.filter(l => {
    if (!busquedaVentas.trim()) return true;
    return normalizarTexto(l.nombre_producto).includes(normalizarTexto(busquedaVentas));
  })

  // --- EXPORTACIONES (AHORA CADA PRODUCTO ES UNA VENTA INDIVIDUAL EN EL REPORTE) ---
  const exportarTXT = () => {
    if (lineasFiltradas.length === 0) return toast.error('No hay ventas para exportar')
    let contenido = `HISTORIAL DE VENTAS INDIVIDUALES\nDesde: ${desde} - Hasta: ${hasta}\n\n`;
    
    contenido += `FECHA       | VENDEDOR         | PRODUCTO                                       | CANT | P. UNIT | SUBTOTAL\n`;
    contenido += `--------------------------------------------------------------------------------------------------------\n`;
    
    lineasFiltradas.forEach(l => {
      const f = new Date(l.fecha).toLocaleDateString('es-PE').padEnd(11, ' ');
      const v = (l.vendedor || '').substring(0, 15).padEnd(16, ' ');
      const p = (l.nombre_producto || '').substring(0, 45).padEnd(46, ' ');
      const c = l.cantidad.toString().padStart(4, ' ');
      const u = Number(l.precio_unitario).toFixed(2).padStart(7, ' ');
      const s = Number(l.subtotal).toFixed(2).padStart(8, ' ');
      contenido += `${f} | ${v} | ${p} | ${c} | ${u} | ${s}\n`;
    });
    
    const blob = new Blob([contenido], { type: 'text/plain' }); 
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'historial_ventas.txt'; link.click();
  }

  const exportarPDF = () => {
    if (lineasFiltradas.length === 0) return toast.error('No hay ventas para exportar')
    const doc = new jsPDF('landscape'); 
    doc.text('Registro de Ventas (Detalle por Producto)', 14, 15); 
    doc.setFontSize(10); 
    doc.text(`Desde: ${desde} - Hasta: ${hasta}`, 14, 22);
    
    const tableData = lineasFiltradas.map(l => [
      new Date(l.fecha).toLocaleDateString('es-PE'),
      l.nombre_producto,
      l.vendedor,
      l.cantidad.toString(),
      `S/ ${Number(l.precio_unitario).toFixed(2)}`,
      `S/ ${Number(l.subtotal).toFixed(2)}`
    ]);

    doc.autoTable({ 
      head: [['Fecha', 'Producto Vendido', 'Vendedor', 'Cant.', 'P. Unitario', 'Subtotal']], 
      body: tableData, 
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 20 },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' }
      }
    });
    
    doc.save('historial_ventas.pdf');
  }

  function handleExportar() {
    if (lineasFiltradas.length === 0) return toast.error('No hay ventas para exportar')
    exportarCSV('ventas', [
      ['Fecha', 'Producto', 'Vendedor', 'Cantidad', 'Precio Ud.', 'Subtotal'],
      ...lineasFiltradas.map(l => [
        new Date(l.fecha).toLocaleDateString('es-PE'),
        l.nombre_producto,
        l.vendedor,
        l.cantidad,
        Number(l.precio_unitario).toFixed(2),
        Number(l.subtotal).toFixed(2)
      ])
    ])
    toast.success('Excel exportado')
  }

  // --- LÓGICA DE ANÁLISIS ---
  let ingresoTotal = 0; let productosVendidosStats = 0; 
  const productosStats = {}; const ventasPorDia = {};
  
  lineasFiltradas.forEach(l => {
    const dia = new Date(l.fecha).toISOString().split('T')[0];
    if (!ventasPorDia[dia]) ventasPorDia[dia] = 0;
    ventasPorDia[dia] += Number(l.subtotal);

    ingresoTotal += Number(l.subtotal);
    productosVendidosStats += Number(l.cantidad);
    
    if (!productosStats[l.producto_id]) productosStats[l.producto_id] = { nombre: l.nombre_producto, cantidad: 0, ingreso: 0 }; 
    productosStats[l.producto_id].cantidad += Number(l.cantidad); 
    productosStats[l.producto_id].ingreso += Number(l.subtotal);
  });

  const diasTotales = Math.max(1, Math.ceil((new Date(hasta+'T23:59:59') - new Date(desde+'T00:00:00')) / 86400000)); 
  const promedioVentaDiaria = ingresoTotal / diasTotales;
  const statsArray = Object.values(productosStats);
  
  const chartDiasData = Object.keys(ventasPorDia).map(k => ({ Fecha: k, Ingreso: parseFloat(ventasPorDia[k].toFixed(2)) })).sort((a,b) => a.Fecha.localeCompare(b.Fecha));
  const chartData = statsArray.sort((a, b) => b.ingreso - a.ingreso).slice(0, 10).map(p => ({ name: p.nombre.substring(0, 15) + '...', Ingreso: parseFloat(p.ingreso.toFixed(2)), Unidades: p.cantidad }))
  const topVendidos = [...statsArray].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5); 
  const menosVendidos = [...statsArray].sort((a, b) => a.cantidad - b.cantidad).slice(0, 5); 

  const totalPeriodo = lineasFiltradas.reduce((a, l) => a + Number(l.subtotal), 0)
  const totalProductos = lineasFiltradas.reduce((a, l) => a + l.cantidad, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
          Ventas<span style={{ color: 'var(--naranja)' }}>.</span>
        </h1>
        <div style={{ display: 'flex', background: 'var(--fondo)', padding: 4, borderRadius: 8, gap: 4 }}>
          <button onClick={() => setTabActual('historial')} className={tabActual === 'historial' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}><List size={16} /> Historial y Registro</button>
          <button onClick={() => setTabActual('analisis')} className={tabActual === 'analisis' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}><BarChart3 size={16} /> Análisis</button>
        </div>
      </div>

      {/* -------------------- TAB HISTORIAL Y REGISTRO -------------------- */}
      {tabActual === 'historial' && (
        <>
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px', border: '1px solid var(--borde)', padding: '6px 12px', borderRadius: 8 }}>
                <Search size={15} color="var(--texto-suave)" />
                <input 
                  type="text" 
                  value={busquedaVentas} 
                  onChange={e => setBusquedaVentas(e.target.value)} 
                  placeholder="Buscar producto vendido..." 
                  style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', fontSize: 13 }} 
                />
              </div>

              <Calendar size={16} color="var(--texto-suave)" style={{ marginLeft: 10 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--texto-suave)' }}>Desde</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 'auto', padding: '6px 10px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--texto-suave)' }}>Hasta</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 'auto', padding: '6px 10px' }} />
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderLeft: '1px solid var(--borde)', paddingLeft: 12 }}>
                 <button onClick={handleExportar} className="btn-ghost" title="Exportar CSV" style={{ fontSize: 11, padding: '6px 8px' }}><Download size={15}/></button>
                 <button onClick={exportarTXT} className="btn-ghost" title="Exportar TXT Detallado" style={{ fontSize: 11, padding: '6px 8px' }}><FileText size={15}/></button>
                 <button onClick={exportarPDF} className="btn-ghost" title="Exportar PDF Detallado" style={{ fontSize: 11, padding: '6px 8px', color: '#D00' }}><Printer size={15}/></button>
              </div>

              <div style={{ marginLeft: 'auto', textAlign: 'right', minWidth: '120px' }}>
                <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{totalProductos} productos vendidos</p>
                <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18, color: 'var(--naranja)' }}>
                  S/ {totalPeriodo.toFixed(2)}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={abrirModal} className="btn-primary" style={{ gap: 6, width: '100%', maxWidth: 200, justifyContent: 'center' }}>
                <Plus size={15} /> Agregar venta manual
              </button>
            </div>
          </div>

          {cargando ? <div className="spinner" /> : lineasFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>
              <ShoppingBag size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
              <p>{busquedaVentas ? 'No se encontraron productos con esa búsqueda' : 'No hay ventas en este periodo'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lineasFiltradas.map((l, idx) => (
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
                      {' · Vendedor: '}{l.vendedor}
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
        </>
      )}

      {/* -------------------- TAB ANÁLISIS -------------------- */}
      {tabActual === 'analisis' && (
        <div className="analisis-container">
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Calendar size={16} color="var(--texto-suave)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, color: 'var(--texto-suave)' }}>Desde</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, color: 'var(--texto-suave)' }}>Hasta</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20, borderTop: '3px solid #10b981' }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600 }}>Total Ingresos</p>
              <h3 style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: '#10b981' }}>S/ {ingresoTotal.toFixed(2)}</h3>
            </div>
            <div className="card" style={{ padding: 20, borderTop: '3px solid #3b82f6' }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600 }}>Unidades Vendidas</p>
              <h3 style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{productosVendidosStats}</h3>
            </div>
            <div className="card" style={{ padding: 20, borderTop: '3px solid var(--naranja)' }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600 }}>Productos Diferentes</p>
              <h3 style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: 'var(--naranja)' }}>{statsArray.length}</h3>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600 }}>Promedio Venta Diaria</p>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>S/ {promedioVentaDiaria.toFixed(2)}</h3>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Ingresos por Día (S/)</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDiasData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="Fecha" fontSize={11} tickMargin={10} />
                    <YAxis fontSize={11} />
                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="Ingreso" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Top 10 Productos (Mayores Ingresos)</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                    <XAxis type="number" fontSize={11} />
                    <YAxis dataKey="name" type="category" width={120} fontSize={10} />
                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="Ingreso" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--naranja)' }}>🔥 Productos Más Vendidos (Unidades)</h3>
              {topVendidos.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--borde)' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</span><span style={{ fontSize: 13, fontWeight: 700 }}>{p.cantidad} unid.</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🧊 Productos Menos Vendidos</h3>
              {menosVendidos.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--borde)' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</span><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto-suave)' }}>{p.cantidad} unid.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nueva Venta */}
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
                        <p style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.3', paddingBottom: '2px' }}>{p.nombre}</p>
                        <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>S/ {Number(p.precio).toFixed(2)} · Stock: {p.stock}</p>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--naranja)', fontWeight: 700, flexShrink: 0 }}>+ Agregar</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', flexShrink: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>Productos para registrar</p>
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
                          <p style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.3' }}>{item.nombre}</p>
                          
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
                            <p style={{ fontSize: 11, color: 'var(--naranja)', marginTop: 2 }}>S/ {Number(item.precio).toFixed(2)}</p>
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
                    {guardando ? 'Registrando...' : 'Registrar venta(s)'}
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
