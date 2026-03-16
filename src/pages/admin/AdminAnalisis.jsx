import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { TrendingUp, Package, Clock, Calendar, AlertTriangle, Star, Download, FileText } from 'lucide-react'
import { exportarCSV, exportarPDF } from '../../lib/exportar'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const HORAS = Array.from({ length: 16 }, (_, i) => `${i + 6}:00`)

export default function AdminAnalisis() {
  const [datos, setDatos]       = useState(null)
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo]   = useState(7)

  useEffect(() => { cargar() }, [periodo])

  async function cargar() {
    setCargando(true)
    const desde = new Date()
    desde.setDate(desde.getDate() - periodo)
    desde.setHours(0, 0, 0, 0)

    const { data: ventas } = await supabase
      .from('ventas')
      .select('*, venta_items(*, productos(nombre, precio, stock, stock_minimo, unidad))')
      .gte('created_at', desde.toISOString())
      .eq('estado', 'completada')

    if (!ventas || ventas.length === 0) {
      setDatos(null)
      setCargando(false)
      return
    }
function handleExportarExcel() {
  if (!datos) return toast.error('No hay datos para exportar')
  exportarCSV('analisis_productos', [
    ['Ranking', 'Producto', 'Unidad', 'Unidades Vendidas', 'Ingresos (S/)', 'Stock Actual', 'Necesita Restock'],
    ...datos.masVendidos.map((p, i) => [
      `#${i + 1}`, p.nombre, p.unidad, p.unidades,
      p.ingresos.toFixed(2), p.stock,
      p.stock <= p.stock_minimo ? 'SÍ' : 'No'
    ])
  ])
  toast.success('Excel exportado ✅')
}

async function handleExportarPDF() {
  if (!datos) return toast.error('No hay datos para exportar')
  toast.loading('Generando PDF...')

  const maxBarH = 60
  const barrasHora = datos.horasData.map(({ label, ventas: v }) => `
    <div class="bar-col">
      <span class="bar-val">${v > 0 ? v : ''}</span>
      <div class="bar" style="height:${Math.max((v / datos.maxHora) * maxBarH, v > 0 ? 4 : 1)}px;opacity:${v > 0 ? 1 : 0.3}"></div>
      <span class="bar-lbl">${label}</span>
    </div>
  `).join('')

  const barrasDia = datos.diasData.map(({ label, ventas: v }) => `
    <div class="bar-col">
      <span class="bar-val" style="color:#7C3AED">${v > 0 ? v : ''}</span>
      <div class="bar" style="height:${Math.max((v / datos.maxDia) * maxBarH, v > 0 ? 4 : 1)}px;background:#7C3AED;opacity:${v > 0 ? 1 : 0.3}"></div>
      <span class="bar-lbl">${label}</span>
    </div>
  `).join('')

  const html = `
    <div class="header">
      <div>
        <h1>Richard Express Market</h1>
        <p>Reporte de Análisis — Últimos ${periodo} días</p>
        <p>Generado: ${new Date().toLocaleString('es-PE')}</p>
      </div>
      <div style="text-align:right">
        <p style="font-size:10px;color:#999">Richard Express Market</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-val">S/ ${datos.totalVendido.toFixed(2)}</div>
        <div class="stat-lbl">Total vendido</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${datos.totalVentas}</div>
        <div class="stat-lbl">Nº de ventas</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">S/ ${datos.ticketPromedio.toFixed(2)}</div>
        <div class="stat-lbl">Ticket promedio</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="font-size:13px">${datos.productoEstrella?.nombre || '-'}</div>
        <div class="stat-lbl">Producto estrella</div>
      </div>
    </div>

    <h2>Ventas por hora del día</h2>
    <div class="bar-wrap">${barrasHora}</div>

    <h2>Ventas por día de la semana</h2>
    <div class="bar-wrap">${barrasDia}</div>

    <h2>Productos más vendidos</h2>
    <table>
      <thead><tr>
        <th>#</th><th>Producto</th><th>Unidad</th>
        <th>Unidades vendidas</th><th>Ingresos (S/)</th><th>Stock</th>
      </tr></thead>
      <tbody>
        ${datos.masVendidos.map((p, i) => `
          <tr>
            <td><strong>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</strong></td>
            <td>${p.nombre}</td>
            <td>${p.unidad}</td>
            <td class="naranja">${p.unidades}</td>
            <td class="verde">S/ ${p.ingresos.toFixed(2)}</td>
            <td class="${p.stock <= p.stock_minimo ? 'rojo' : ''}">${p.stock}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>Sugerencias de reabastecimiento</h2>
    ${datos.restock.map(p => `
      <div class="restock">
        <div>
          <strong>${p.necesita ? '⚠️ ' : ''}${p.nombre}</strong>
          <p>Vende ~${p.promedioDiario.toFixed(1)} ${p.unidad}/día · Stock actual: ${p.stock}</p>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:800;color:#FF6B00">${p.sugerido} ${p.unidad}</div>
          <div style="font-size:10px;color:#666">Comprar para 14 días</div>
        </div>
      </div>
    `).join('')}
  `

  toast.dismiss()
  await exportarPDF(`analisis_${periodo}dias`, html)
}
    // — Productos más vendidos
    const mapaProductos = {}
    ventas.forEach(v => {
      v.venta_items?.forEach(item => {
        const id = item.producto_id
        if (!mapaProductos[id]) {
          mapaProductos[id] = {
            nombre: item.nombre_producto,
            unidades: 0,
            ingresos: 0,
            stock: item.productos?.stock ?? 0,
            stock_minimo: item.productos?.stock_minimo ?? 5,
            precio: item.productos?.precio ?? item.precio_unitario,
            unidad: item.productos?.unidad ?? 'unidad',
          }
        }
        mapaProductos[id].unidades += item.cantidad
        mapaProductos[id].ingresos += Number(item.subtotal)
      })
    })
    const masVendidos = Object.values(mapaProductos)
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 10)

    // — Ventas por hora
    const porHora = Array(24).fill(0)
    ventas.forEach(v => {
      const h = new Date(v.created_at).getHours()
      porHora[h]++
    })
    const horasData = HORAS.map((label, i) => ({ label, ventas: porHora[i + 6] }))
    const maxHora   = Math.max(...horasData.map(h => h.ventas), 1)

    // — Ventas por día de semana
    const porDia = Array(7).fill(0)
    ventas.forEach(v => {
      const d = new Date(v.created_at).getDay()
      porDia[d]++
    })
    const diasData = DIAS.map((label, i) => ({ label: label.slice(0, 3), ventas: porDia[i] }))
    const maxDia   = Math.max(...diasData.map(d => d.ventas), 1)

    // — Sugerencias de restock (promedio diario × 14 días)
    const restock = Object.values(mapaProductos)
      .filter(p => p.unidades > 0)
      .map(p => ({
        ...p,
        promedioDiario: p.unidades / periodo,
        sugerido: Math.ceil((p.unidades / periodo) * 14),
        necesita: p.stock < p.stock_minimo,
      }))
      .sort((a, b) => b.unidades - a.unidades)

    // — Resumen financiero
    const totalVendido  = ventas.reduce((a, v) => a + Number(v.total), 0)
    const ticketPromedio = totalVendido / ventas.length
    const productoEstrella = masVendidos[0]

    setDatos({ masVendidos, horasData, maxHora, diasData, maxDia, restock, totalVendido, ticketPromedio, productoEstrella, totalVentas: ventas.length })
    setCargando(false)
  }

  const BAR_MAX_H = 80

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
          Análisis<span style={{ color: 'var(--naranja)' }}>.</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setPeriodo(d)}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${periodo === d ? 'var(--naranja)' : 'var(--borde)'}`, background: periodo === d ? 'var(--naranja-light)' : 'var(--blanco)', color: periodo === d ? 'var(--naranja)' : 'var(--texto-suave)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {d} días
            </button>
          ))}
        </div>
      </div>

      {cargando ? <div className="spinner" /> : !datos ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--texto-suave)' }}>
          <TrendingUp size={48} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <p style={{ fontSize: 16 }}>No hay ventas registradas en este período</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Registra ventas para ver el análisis</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Resumen financiero */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total vendido', valor: `S/ ${datos.totalVendido.toFixed(2)}`, icon: TrendingUp, color: 'var(--naranja)' },
              { label: 'Nº de ventas', valor: datos.totalVentas, icon: Calendar, color: '#7C3AED' },
              { label: 'Ticket promedio', valor: `S/ ${datos.ticketPromedio.toFixed(2)}`, icon: Star, color: '#059669' },
              { label: 'Producto estrella', valor: datos.productoEstrella?.nombre || '-', icon: Package, color: '#0284C7', small: true },
            ].map(({ label, valor, icon: Icon, color, small }) => (
              <div key={label} className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{label}</p>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                  </div>
                </div>
                <p style={{ fontFamily: small ? 'var(--fuente-body)' : 'var(--fuente-display)', fontWeight: 700, fontSize: small ? 14 : 22, color: 'var(--texto)', lineHeight: 1.2 }}>{valor}</p>
              </div>
            ))}
          </div>

          {/* Gráfico por hora */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Clock size={16} color="var(--naranja)" />
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Ventas por hora del día</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: BAR_MAX_H + 30, overflowX: 'auto', paddingBottom: 4 }}>
              {datos.horasData.map(({ label, ventas: v }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 32, flex: 1 }}>
                  {v > 0 && <span style={{ fontSize: 10, color: 'var(--naranja)', fontWeight: 600 }}>{v}</span>}
                  <div style={{ width: '100%', background: v > 0 ? 'var(--naranja)' : 'var(--borde)', borderRadius: '4px 4px 0 0', height: Math.max((v / datos.maxHora) * BAR_MAX_H, v > 0 ? 6 : 2), transition: 'height 0.3s', opacity: v > 0 ? 1 : 0.4 }} />
                  <span style={{ fontSize: 9, color: 'var(--texto-suave)', transform: 'rotate(-45deg)', transformOrigin: 'top left', marginTop: 6, whiteSpace: 'nowrap' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico por día */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Calendar size={16} color="#7C3AED" />
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Ventas por día de la semana</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: BAR_MAX_H + 30 }}>
              {datos.diasData.map(({ label, ventas: v }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                  {v > 0 && <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600 }}>{v}</span>}
                  <div style={{ width: '100%', background: v > 0 ? '#7C3AED' : 'var(--borde)', borderRadius: '4px 4px 0 0', height: Math.max((v / datos.maxDia) * BAR_MAX_H, v > 0 ? 6 : 2), transition: 'height 0.3s', opacity: v > 0 ? 1 : 0.4 }} />
                  <span style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Productos más vendidos */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <TrendingUp size={16} color="var(--naranja)" />
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Productos más vendidos</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {datos.masVendidos.map((p, idx) => (
                <div key={p.nombre} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--borde)' }}>
                  <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 16, color: idx === 0 ? 'var(--naranja)' : 'var(--texto-suave)', minWidth: 24 }}>#{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{p.nombre}</p>
                    <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>{p.unidad}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--naranja)' }}>{p.unidades} vendidos</p>
                    <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>S/ {p.ingresos.toFixed(2)}</p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <span className={`badge ${p.stock <= p.stock_minimo ? 'badge-rojo' : 'badge-verde'}`}>
                      Stock: {p.stock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sugerencias de restock */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <AlertTriangle size={16} color="#E65100" />
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>Sugerencias de reabastecimiento</h2>
            </div>
            <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginBottom: 14 }}>
              Calculado con el promedio de ventas diarias × 14 días de cobertura
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {datos.restock.map(p => (
                <div key={p.nombre} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 12, padding: '10px 14px', background: p.necesita ? '#FFF3E0' : 'var(--fondo)', borderRadius: 10, border: `1px solid ${p.necesita ? '#FFCC80' : 'var(--borde)'}` }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>
                      {p.necesita && '⚠️ '}{p.nombre}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>
                      Vende ~{p.promedioDiario.toFixed(1)} {p.unidad}/día · Stock actual: {p.stock}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Comprar</p>
                    <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 18, color: 'var(--naranja)' }}>{p.sugerido}</p>
                    <p style={{ fontSize: 10, color: 'var(--texto-suave)' }}>{p.unidad}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Precio venta</p>
                    <p style={{ fontWeight: 600, fontSize: 13, color: '#059669' }}>S/ {Number(p.precio).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
