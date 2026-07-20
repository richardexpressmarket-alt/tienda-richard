import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { exportarCSV } from '../../lib/exportar'
import toast from 'react-hot-toast'
import { 
  BarChart3, Calendar, Download, FileText, FileSpreadsheet, 
  TrendingUp, Package, Star, DollarSign, Award, ShoppingCart, Printer
} from 'lucide-react'

export default function AdminAnalisis() {
  const [cargando, setCargando] = useState(true)
  const [ventasData, setVentasData] = useState([])
  const [itemsData, setItemsData] = useState([])

  // Por defecto: Primer y último día del mes actual
  const [desde, setDesde] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
  })

  useEffect(() => { cargarDatos() }, [desde, hasta])

  async function cargarDatos() {
    setCargando(true)
    try {
      // Cargamos las ventas y sus items con los datos del producto en una sola consulta
      const { data, error } = await supabase
        .from('ventas')
        .select('*, venta_items(*, productos(*))')
        .gte('created_at', desde + 'T00:00:00')
        .lte('created_at', hasta + 'T23:59:59')

      if (error) throw error
      setVentasData(data || [])
    } catch (error) {
      toast.error('Error al cargar análisis: ' + error.message)
    } finally {
      setCargando(false)
    }
  }

  // --- PROCESAMIENTO DE DATOS ---
  let totalGanancias = 0
  let totalProductosVendidos = 0
  const productosStats = {} // Para agrupar por producto
  const diasSemana = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } // Dom a Sab

  ventasData.forEach(venta => {
    totalGanancias += Number(venta.total || 0)
    
    // Obtener el día de la semana (0 = Dom, 1 = Lun...)
    const dia = new Date(venta.created_at).getDay()

    venta.venta_items?.forEach(item => {
      const cant = Number(item.cantidad || 0)
      const subtotal = Number(item.subtotal || 0)
      
      totalProductosVendidos += cant
      diasSemana[dia] += cant // Sumamos productos vendidos a ese día

      const p = item.productos
      if (p) {
        if (!productosStats[p.id]) {
          productosStats[p.id] = { 
            id: p.id, 
            nombre: p.nombre, 
            cantidad: 0, 
            ganancia: 0, 
            stock: p.stock || 0,
            img: p.imagen_url 
          }
        }
        productosStats[p.id].cantidad += cant
        productosStats[p.id].ganancia += subtotal
      }
    })
  })

  // Cálculos de promedios
  const fInicio = new Date(desde + 'T00:00:00')
  const fFin = new Date(hasta + 'T23:59:59')
  const diasTranscurridos = Math.max(1, Math.ceil((fFin - fInicio) / (1000 * 60 * 60 * 24)))
  
  const promedioDiarioGanancia = totalGanancias / diasTranscurridos
  const promedioDiarioProductos = totalProductosVendidos / diasTranscurridos

  // Ordenamiento para los Tops
  const listaProductos = Object.values(productosStats)
  const topRentables = [...listaProductos].sort((a, b) => b.ganancia - a.ganancia)
  const topVendidos = [...listaProductos].sort((a, b) => b.cantidad - a.cantidad)
  const productoEstrella = topRentables.length > 0 ? topRentables[0] : null

  // Configuración del gráfico de barras
  const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const maxProductosDia = Math.max(...Object.values(diasSemana), 1) // Evitar división por 0

  // --- EXPORTACIONES ---
  const handleExportarExcel = () => {
    if (topRentables.length === 0) return toast.error('No hay datos para exportar')
    exportarCSV(`Analisis_${desde}_al_${hasta}`, [
      ['Producto', 'Cantidad Vendida', 'Ganancia (S/)', 'Stock Actual'],
      ...topRentables.map(p => [p.nombre, p.cantidad, p.ganancia.toFixed(2), p.stock])
    ])
    toast.success('Excel exportado')
  }

  const handleExportarTXT = () => {
    if (topRentables.length === 0) return toast.error('No hay datos para exportar')
    let txt = `REPORTE DE VENTAS Y RENTABILIDAD\nDesde: ${desde} | Hasta: ${hasta}\n`
    txt += `==========================================\n`
    txt += `Total Ingresos: S/ ${totalGanancias.toFixed(2)}\n`
    txt += `Total Productos Vendidos: ${totalProductosVendidos}\n`
    txt += `Promedio Diario de Ingresos: S/ ${promedioDiarioGanancia.toFixed(2)}\n`
    txt += `Producto Estrella: ${productoEstrella?.nombre || 'N/A'}\n`
    txt += `==========================================\n\n`
    
    txt += `--- TOP PRODUCTOS MÁS RENTABLES ---\n`
    topRentables.slice(0, 20).forEach((p, i) => {
      txt += `${i + 1}. ${p.nombre} -> Ingreso: S/ ${p.ganancia.toFixed(2)} | Vendidos: ${p.cantidad} | Stock: ${p.stock}\n`
    })

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Reporte_${desde}_al_${hasta}.txt`
    link.click()
    toast.success('Archivo TXT exportado')
  }

  const handleImprimirPDF = () => {
    window.print()
  }

  return (
    <div className="analisis-container">
      {/* Estilos específicos para impresión */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .analisis-container { padding: 0 !important; background: white !important; color: black !important; }
          .card { border: 1px solid #ddd !important; box-shadow: none !important; background: white !important; }
          * { color: black !important; }
        }
      `}</style>

      {/* ENCABEZADO Y FILTROS */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 28, fontWeight: 800 }}>
            Dashboard Finance<span style={{ color: 'var(--naranja)' }}>.</span>
          </h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: 13, marginTop: 4 }}>
            Análisis de rendimiento y rentabilidad del negocio
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={16} color="var(--naranja)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--texto)', outline: 'none', fontSize: 13 }} />
              <span style={{ color: 'var(--texto-suave)' }}>-</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--texto)', outline: 'none', fontSize: 13 }} />
            </div>
          </div>
          
          <button onClick={handleExportarExcel} className="btn-ghost" style={{ fontSize: 13, padding: '8px 12px' }} title="Exportar Excel">
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button onClick={handleExportarTXT} className="btn-ghost" style={{ fontSize: 13, padding: '8px 12px' }} title="Exportar TXT">
            <FileText size={16} /> TXT
          </button>
          <button onClick={handleImprimirPDF} className="btn-primary" style={{ fontSize: 13, padding: '8px 12px', gap: 6 }}>
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="spinner" style={{ margin: '40px auto' }} />
      ) : (
        <>
          {/* TARJETAS DE KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20, borderTop: '3px solid var(--naranja)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600, textTransform: 'uppercase' }}>Ingresos Totales</p>
                  <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, marginTop: 4 }}>
                    S/ {totalGanancias.toFixed(2)}
                  </h3>
                </div>
                <div style={{ background: 'var(--naranja-light)', padding: 8, borderRadius: 8 }}><DollarSign size={20} color="var(--naranja)" /></div>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600, textTransform: 'uppercase' }}>Productos Vendidos</p>
                  <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, marginTop: 4 }}>
                    {totalProductosVendidos}
                  </h3>
                </div>
                <div style={{ background: 'var(--fondo)', padding: 8, borderRadius: 8 }}><Package size={20} color="var(--texto)" /></div>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600, textTransform: 'uppercase' }}>Promedio Diario</p>
                  <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 20, fontWeight: 800, marginTop: 4, color: 'var(--verde)' }}>
                    S/ {promedioDiarioGanancia.toFixed(2)}
                  </h3>
                  <p style={{ fontSize: 11, color: 'var(--texto-suave)', marginTop: 2 }}>
                    ~ {Math.round(promedioDiarioProductos)} items por día
                  </p>
                </div>
                <div style={{ background: '#10b98122', padding: 8, borderRadius: 8 }}><TrendingUp size={20} color="var(--verde)" /></div>
              </div>
            </div>

            <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, var(--fondo), var(--naranja-light))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: 'var(--naranja)', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={14} fill="currentColor" /> Producto Estrella
                  </p>
                  <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 18, fontWeight: 700, marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {productoEstrella ? productoEstrella.nombre : 'Sin datos'}
                  </h3>
                  {productoEstrella && (
                    <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 4, fontWeight: 600 }}>
                      S/ {productoEstrella.ganancia.toFixed(2)} generados
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* GRÁFICO: VENTAS POR DÍA DE LA SEMANA */}
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={18} color="var(--naranja)" /> 
              Dinámica de Ventas por Día (Unidades Vendidas)
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 180, paddingTop: 20 }}>
              {nombresDias.map((nombre, i) => {
                const indexDia = i === 6 ? 0 : i + 1; // Ajuste para que Lunes sea el primero en UI
                const cant = diasSemana[indexDia];
                const alturaPorcentaje = maxProductosDia === 0 ? 0 : (cant / maxProductosDia) * 100;
                const esMayor = cant === maxProductosDia && cant > 0;

                return (
                  <div key={nombre} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: esMayor ? 'var(--naranja)' : 'var(--texto-suave)' }}>
                      {cant > 0 ? cant : ''}
                    </span>
                    <div style={{ 
                      width: '100%', 
                      maxWidth: 40, 
                      height: `${alturaPorcentaje}%`, 
                      minHeight: 4,
                      background: esMayor ? 'var(--naranja)' : 'var(--borde)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.5s ease'
                    }} />
                    <span style={{ fontSize: 12, fontWeight: esMayor ? 700 : 500, color: 'var(--texto)' }}>{nombre}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* LISTAS: RENTABLES VS VENDIDOS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            
            {/* TOP RENTABLES */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={18} color="var(--verde)" />
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Top Productos Más Rentables</h3>
              </div>
              <div style={{ padding: '12px 0' }}>
                {topRentables.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--texto-suave)', padding: 20 }}>Sin datos en este periodo</p>
                ) : (
                  topRentables.slice(0, 10).map((p, idx) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--borde)' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: idx < 3 ? 'var(--naranja)' : 'var(--texto-suave)', width: 20 }}>
                        {idx + 1}
                      </span>
                      {p.img ? (
                        <img src={p.img} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={16} color="var(--borde)" /></div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</p>
                        <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Stock actual: <span style={{ color: p.stock < 5 ? '#D00' : 'inherit' }}>{p.stock}</span></p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--verde)' }}>S/ {p.ganancia.toFixed(2)}</p>
                        <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>{p.cantidad} uds.</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TOP VENDIDOS */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={18} color="var(--naranja)" />
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Top Más Vendidos (Rotación)</h3>
              </div>
              <div style={{ padding: '12px 0' }}>
                {topVendidos.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--texto-suave)', padding: 20 }}>Sin datos en este periodo</p>
                ) : (
                  topVendidos.slice(0, 10).map((p, idx) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--borde)' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--texto-suave)', width: 20 }}>
                        {idx + 1}
                      </span>
                      {p.img ? (
                        <img src={p.img} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={16} color="var(--borde)" /></div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</p>
                        <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Stock actual: <span style={{ color: p.stock < 5 ? '#D00' : 'inherit' }}>{p.stock}</span></p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--naranja)' }}>{p.cantidad} uds.</p>
                        <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>S/ {p.ganancia.toFixed(2)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
