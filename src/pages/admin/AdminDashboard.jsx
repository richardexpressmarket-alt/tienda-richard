import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Package, Tag, ShoppingBag, AlertTriangle } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ productos: 0, categorias: 0, ventas_hoy: 0, total_hoy: 0, stock_bajo: [] })
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const [{ count: productos }, { count: categorias }, { data: ventas }, { data: stock_bajo }] = await Promise.all([
      supabase.from('productos').select('*', { count: 'exact', head: true }),
      supabase.from('categorias').select('*', { count: 'exact', head: true }),
      supabase.from('ventas').select('total').gte('created_at', hoy.toISOString()),
      supabase.from('productos').select('nombre, stock, stock_minimo').lt('stock', supabase.raw('stock_minimo')).eq('activo', true),
    ])
    const total_hoy = (ventas || []).reduce((a, v) => a + Number(v.total), 0)
    setStats({ productos: productos || 0, categorias: categorias || 0, ventas_hoy: (ventas || []).length, total_hoy, stock_bajo: stock_bajo || [] })
    setCargando(false)
  }

  const cards = [
    { label: 'Productos activos', valor: stats.productos, icon: Package, color: 'var(--naranja)' },
    { label: 'Categorías', valor: stats.categorias, icon: Tag, color: '#7C3AED' },
    { label: 'Ventas hoy', valor: stats.ventas_hoy, icon: ShoppingBag, color: '#059669' },
    { label: 'Total vendido hoy', valor: `S/ ${stats.total_hoy.toFixed(2)}`, icon: ShoppingBag, color: '#0284C7' },
  ]

  if (cargando) return <div className="spinner" />

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800, marginBottom: 24 }}>
        Dashboard<span style={{ color: 'var(--naranja)' }}>.</span>
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        {cards.map(({ label, valor, icon: Icon, color }) => (
          <div key={label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--texto-suave)' }}>{label}</p>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={color} />
              </div>
            </div>
            <p style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, color: 'var(--texto)' }}>{valor}</p>
          </div>
        ))}
      </div>

      {stats.stock_bajo.length > 0 && (
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={18} color="#E65100" />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#E65100' }}>Productos con stock bajo</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.stock_bajo.map(p => (
              <div key={p.nombre} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#FFF3E0', borderRadius: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                <span className="badge badge-rojo">Stock: {p.stock}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
