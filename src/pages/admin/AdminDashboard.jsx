import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Package, Tag, ShoppingBag, AlertTriangle } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats]     = useState({ productos: 0, categorias: 0, ventas_hoy: 0, total_hoy: 0, stock_bajo: [] })
  const [cargando, setCargando] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const [
      { count: productos },
      { count: categorias },
      { data: ventas },
      { data: todos_productos }
    ] = await Promise.all([
      supabase.from('productos').select('*', { count: 'exact', head: true }),
      supabase.from('categorias').select('*', { count: 'exact', head: true }),
      supabase.from('ventas').select('total').gte('created_at', hoy.toISOString()),
      supabase.from('productos').select('id, nombre, stock, stock_minimo').eq('activo', true),
    ])

    const total_hoy  = (ventas || []).reduce((a, v) => a + Number(v.total), 0)
    const stock_bajo = (todos_productos || []).filter(p => p.stock < p.stock_minimo)

    setStats({
      productos:  productos || 0,
      categorias: categorias || 0,
      ventas_hoy: (ventas || []).length,
      total_hoy,
      stock_bajo
    })
    setCargando(false)
  }

  function irAEditar(productoId) {
    navigate(`/admin/productos?editar=${productoId}`)
  }

  const cards = [
    { label: 'Productos activos', valor: stats.productos,                          icon: Package,    color: 'var(--naranja)' },
    { label: 'Categorías',        valor: stats.categorias,                         icon: Tag,        color: '#7C3AED'        },
    { label: 'Ventas hoy',        valor: stats.ventas_hoy,                         icon: ShoppingBag, color: '#059669'       },
    { label: 'Total vendido hoy', valor: `S/ ${stats.total_hoy.toFixed(2)}`,       icon: ShoppingBag, color: '#0284C7'       },
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
            <span style={{ fontSize: 12, color: 'var(--texto-suave)', marginLeft: 4 }}>— Haz clic para editar</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.stock_bajo.map(p => (
              <button key={p.id} onClick={() => irAEditar(p.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFF3E0', borderRadius: 8, border: '1px solid #FFCC80', cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FFE0B2'; e.currentTarget.style.borderColor = 'var(--naranja)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFF3E0'; e.currentTarget.style.borderColor = '#FFCC80' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="badge badge-rojo">Stock: {p.stock}</span>
                  <span style={{ fontSize: 11, color: 'var(--naranja)', fontWeight: 500 }}>✏️ Editar →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
