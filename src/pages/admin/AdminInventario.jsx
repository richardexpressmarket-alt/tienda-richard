import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { exportarCSV } from '../../lib/exportar'
import { Package, TrendingUp, TrendingDown, DollarSign, Download, BarChart2 } from 'lucide-react'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function AdminInventario() {
  const [productos, setProductos]   = useState([])
  const [categorias, setCategorias] = useState([])
  const [ventas, setVentas]         = useState([])
  const [compras, setCompras]       = useState([])
  const [cargando, setCargando]     = useState(true)
  const [filtroCat, setFiltroCat]   = useState('')
  const [anio, setAnio]             = useState(new Date().getFullYear())
  const [mes, setMes]               = useState(null)

  useEffect(() => { cargar() }, [anio, mes])

  async function cargar() {
    setCargando(true)
    const desdeDate = mes !== null
      ? `${anio}-${String(mes + 1).padStart(2,'0')}-01`
      : `${anio}-01-01`
    const hastaDate = mes !== null
      ? new Date(anio, mes + 1, 0).toISOString().split('T')[0]
      : `${anio}-12-31`

    const [
      { data: prods },
      { data: cats },
      { data: vents },
      { data: comps },
    ] = await Promise.all([
      supabase.from('productos').select('*, categorias(nombre)').order('nombre'),
      supabase.from('categorias').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('ventas').select('*, venta_items(cantidad, subtotal, precio_unitario, producto_id)')
        .gte('created_at', desdeDate + 'T00:00:00')
        .lte('created_at', hastaDate + 'T23:59:59')
        .eq('estado', 'completada'),
      supabase.from('compras').select('*, compra_items(cantidad, subtotal, precio_unitario)')
        .gte('fecha_compra', desdeDate)
        .lte('fecha_compra', hastaDate),
    ])
    setProductos(prods || [])
    setCategorias(cats || [])
    setVentas(vents || [])
    setCompras(comps || [])
    setCargando(false)
  }

  // Filtrar productos por categoría
  const prodsFiltrados = filtroCat
    ? productos.filter(p => p.categoria_id === filtroCat)
    : productos

  // Métricas de inventario
  const totalProductos    = prodsFiltrados.length
  const productosActivos  = prodsFiltrados.filter(p => p.activo).length
  const productosAgotados = prodsFiltrados.filter(p => p.stock <= 0).length
  const valorInventario   = prodsFiltrados.reduce((a, p) => a + Number(p.precio || 0) * Number(p.stock || 0), 0)
  const totalUnidades     = prodsFiltrados.reduce((a, p) => a + Number(p.stock || 0), 0)

  // Métricas de ventas del período
  const totalVendido   = ventas.reduce((a, v) => a + Number(v.total || 0), 0)
  const totalComprado  = compras.reduce((a, c) => a + Number(c.total || 0), 0)
  const ganancia       = totalVendido - totalComprado
  const nVentas        = ventas.length

  // Ventas por mes para gráfico
  const ventasPorMes = Array(12).fill(0)
  const comprasPorMes = Array(12).fill(0)
  ventas.forEach(v => {
    const m = new Date(v.created_at).getMonth()
    ventasPorMes[m] += Number(v.total || 0)
  })
  compras.forEach(c => {
    if (c.fecha_compra) {
      const m = new Date(c.fecha_compra + 'T12:00:00').getMonth()
      comprasPorMes[m] += Number(c.total || 0)
    }
  })
  const maxBar = Math.max(...ventasPorMes, ...comprasPorMes, 1)

  // Top productos más vendidos en el período
  const mapaVentas = {}
  ventas.forEach(v => {
    v.venta_items?.forEach(i => {
      if (!mapaVentas[i.producto_id]) mapaVentas[i.producto_id] = { unidades: 0, ingresos: 0 }
      mapaVentas[i.producto_id].unidades += Number(i.cantidad || 0)
      mapaVentas[i.producto_id].ingresos += Number(i.subtotal || 0)
    })
  })

  // Productos con valor en inventario
  const productosConValor = prodsFiltrados
    .map(p => ({
      ...p,
      valorStock: Number(p.precio || 0) * Number(p.stock || 0),
      vendido: mapaVentas[p.id]?.unidades || 0,
      ingresos: mapaVentas[p.id]?.ingresos || 0,
    }))
    .sort((a, b) => b.valorStock - a.valorStock)

  function handleExportar() {
    exportarCSV('inventario', [
      ['Producto', 'Categoría', 'Stock', 'Precio venta', 'Valor en stock', 'Vendido período', 'Ingresos período', 'Activo'],
      ...productosConValor.map(p => [
        p.nombre,
        p.categorias?.nombre || '',
        p.stock,
        Number(p.precio).toFixed(2),
        p.valorStock.toFixed(2),
        p.vendido,
        p.ingresos.toFixed(2),
        p.activo ? 'Sí' : 'No'
      ])
    ])
  }

  const BAR_H = 70
  const anios = [2024, 2025, 2026, 2027]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
            Inventario & Balance<span style={{ color: 'var(--naranja)' }}>.</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginTop: 3 }}>
            Valor invertido, ventas y balance por período
          </p>
        </div>
        <button onClick={handleExportar} className="btn-ghost" style={{ fontSize: 13 }}>
          <Download size={14} /> Excel
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Año */}
        <div style={{ display: 'flex', gap: 6 }}>
          {anios.map(a => (
            <button key={a} onClick={() => { setAnio(a); setMes(null) }}
              style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${anio === a ? 'var(--naranja)' : 'var(--borde)'}`, background: anio === a ? 'var(--naranja-light)' : 'var(--blanco)', color: anio === a ? 'var(--naranja)' : 'var(--texto-suave)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {a}
            </button>
          ))}
        </div>
        {/* Mes */}
        <select value={mes ?? ''} onChange={e => setMes(e.target.value === '' ? null : Number(e.target.value))}
          style={{ minWidth: 130 }}>
          <option value="">Todo el año</option>
          {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        {/* Categoría */}
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ minWidth: 160 }}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {cargando ? <div className="spinner" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Cards métricas inventario */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
            {[
              { label: 'Valor en inventario', valor: `S/ ${valorInventario.toFixed(2)}`, icon: DollarSign, color: 'var(--naranja)', desc: 'Precio venta × stock' },
              { label: 'Total unidades', valor: totalUnidades, icon: Package, color: '#7C3AED', desc: `${totalProductos} productos` },
              { label: 'Productos activos', valor: productosActivos, icon: BarChart2, color: '#059669', desc: `${productosAgotados} agotados` },
              { label: 'Vendido período', valor: `S/ ${totalVendido.toFixed(2)}`, icon: TrendingUp, color: '#0284C7', desc: `${nVentas} ventas` },
              { label: 'Comprado período', valor: `S/ ${totalComprado.toFixed(2)}`, icon: TrendingDown, color: '#DC2626', desc: `${compras.length} boletas` },
              { label: 'Ganancia período', valor: `S/ ${ganancia.toFixed(2)}`, icon: TrendingUp, color: ganancia >= 0 ? '#059669' : '#DC2626', desc: ganancia >= 0 ? 'Positivo ✅' : 'Negativo ⚠️' },
            ].map(({ label, valor, icon: Icon, color, desc }) => (
              <div key={label} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ fontSize: 11, color: 'var(--texto-suave)', lineHeight: 1.3 }}>{label}</p>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} color={color} />
                  </div>
                </div>
                <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 18, color, lineHeight: 1.1 }}>{valor}</p>
                <p style={{ fontSize: 10, color: 'var(--texto-suave)', marginTop: 4 }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Gráfico ventas vs compras por mes */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Ventas vs Compras — {anio}</h2>
            <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginBottom: 16 }}>
              Comparación mensual de ingresos y gastos
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--naranja)' }} />
                <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Ventas</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: '#7C3AED' }} />
                <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Compras</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: BAR_H + 40, overflowX: 'auto' }}>
              {MESES.map((m, i) => (
                <div key={m} onClick={() => setMes(mes === i ? null : i)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 44, flex: 1, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: BAR_H }}>
                    <div style={{ width: 16, background: mes === i ? '#E05A00' : 'var(--naranja)', borderRadius: '3px 3px 0 0', height: Math.max((ventasPorMes[i] / maxBar) * BAR_H, ventasPorMes[i] > 0 ? 4 : 1), transition: 'height 0.3s', opacity: ventasPorMes[i] > 0 ? 1 : 0.3 }} />
                    <div style={{ width: 16, background: mes === i ? '#5B21B6' : '#7C3AED', borderRadius: '3px 3px 0 0', height: Math.max((comprasPorMes[i] / maxBar) * BAR_H, comprasPorMes[i] > 0 ? 4 : 1), transition: 'height 0.3s', opacity: comprasPorMes[i] > 0 ? 1 : 0.3 }} />
                  </div>
                  <span style={{ fontSize: 10, color: mes === i ? 'var(--naranja)' : 'var(--texto-suave)', fontWeight: mes === i ? 700 : 400 }}>{m}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--texto-suave)', marginTop: 8, textAlign: 'center' }}>
              Haz clic en un mes para filtrar los datos
            </p>
          </div>

          {/* Tabla productos con valor */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--borde)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Detalle por producto</h2>
              <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{productosConValor.length} productos</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, padding: '8px 20px', background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}>
              {['Producto', 'Stock', 'Precio venta', 'Valor en stock', 'Vendido', 'Ingresos'].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--texto-suave)', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {productosConValor.map(p => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, padding: '10px 20px', borderBottom: '1px solid var(--borde)', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--fondo)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</p>
                    <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>{p.categorias?.nombre || 'Sin categoría'} · {p.unidad}</p>
                  </div>
                  <span className={`badge ${p.stock <= 0 ? 'badge-rojo' : p.stock <= p.stock_minimo ? 'badge-naranja' : 'badge-verde'}`}>
                    {p.stock}
                  </span>
                  <p style={{ fontSize: 13 }}>S/ {Number(p.precio).toFixed(2)}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--naranja)' }}>S/ {p.valorStock.toFixed(2)}</p>
                  <p style={{ fontSize: 13, color: '#7C3AED' }}>{p.vendido} uds</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>S/ {p.ingresos.toFixed(2)}</p>
                </div>
              ))}
            </div>
            {/* Total */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, padding: '12px 20px', background: 'var(--naranja-light)', borderTop: '2px solid var(--naranja-mid)' }}>
              <p style={{ fontSize: 13, fontWeight: 700 }}>TOTAL</p>
              <p style={{ fontSize: 13, fontWeight: 700 }}>{totalUnidades} uds</p>
              <p />
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--naranja)' }}>S/ {valorInventario.toFixed(2)}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>{Object.values(mapaVentas).reduce((a, v) => a + v.unidades, 0)} uds</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>S/ {totalVendido.toFixed(2)}</p>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
