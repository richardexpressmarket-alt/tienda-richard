import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingBag, ChevronDown, ChevronUp, Calendar } from 'lucide-react'

export default function AdminVentas() {
  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [expandida, setExpandida] = useState(null)
  const [desde, setDesde] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
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

  const totalPeriodo = ventas.reduce((a, v) => a + Number(v.total), 0)

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800, marginBottom: 20 }}>
        Ventas<span style={{ color: 'var(--naranja)' }}>.</span>
      </h1>

      {/* Filtro fechas */}
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
            <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18, color: 'var(--naranja)' }}>S/ {totalPeriodo.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {cargando ? <div className="spinner" /> : ventas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>
          <ShoppingBag size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <p>No hay ventas en este período</p>
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
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{v.nombre_cliente || 'Cliente'}</p>
                  <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>
                    {new Date(v.created_at).toLocaleString('es-PE')} · {v.perfiles?.nombre || 'Sistema'}
                  </p>
                </div>
                <span className={`badge ${v.tipo === 'online' ? 'badge-naranja' : 'badge-verde'}`}>{v.tipo}</span>
                <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 16, marginLeft: 8 }}>S/ {Number(v.total).toFixed(2)}</p>
                {expandida === v.id ? <ChevronUp size={16} color="var(--texto-suave)" /> : <ChevronDown size={16} color="var(--texto-suave)" />}
              </button>

              {expandida === v.id && (
                <div style={{ borderTop: '1px solid var(--borde)', padding: '14px 16px', background: 'var(--fondo)' }}>
                  {v.venta_items?.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
                      <p style={{ flex: 1, fontSize: 13 }}>{item.nombre_producto}</p>
                      <p style={{ fontSize: 13, color: 'var(--texto-suave)' }}>x{item.cantidad}</p>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>S/ {Number(item.subtotal).toFixed(2)}</p>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 8 }}>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>Total: <span style={{ color: 'var(--naranja)' }}>S/ {Number(v.total).toFixed(2)}</span></p>
                  </div>
                  {v.notas && <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 6 }}>Nota: {v.notas}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
