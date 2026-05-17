import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Package, Tag, ShoppingBag, AlertTriangle, XCircle, EyeOff } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats]           = useState({ productos: 0, categorias: 0, ventas_hoy: 0, total_hoy: 0 })
  const [stockBajo, setStockBajo]   = useState([])
  const [stockCero, setStockCero]   = useState([])
  const [inactivos, setInactivos]   = useState([])
  const [categorias, setCategorias] = useState([])
  const [filtroCat, setFiltroCat]   = useState('')
  const [verInactivos, setVerInactivos] = useState(false)
  const [cargando, setCargando]     = useState(true)
  const navigate = useNavigate()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const [
      { count: productos },
      { count: categorias_count },
      { data: ventas },
      { data: activos },
      { data: todos },
      { data: cats },
    ] = await Promise.all([
      supabase.from('productos').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('categorias').select('*', { count: 'exact', head: true }),
      supabase.from('ventas').select('total').gte('created_at', hoy.toISOString()),
      supabase.from('productos').select('id, nombre, stock, stock_minimo, categoria_id, categorias(nombre)').eq('activo', true),
      supabase.from('productos').select('id, nombre, stock, activo, precio, categoria_id, categorias(nombre)').eq('activo', false),
      supabase.from('categorias').select('id, nombre').eq('activo', true).order('nombre'),
    ])

    const total_hoy = (ventas || []).reduce((a, v) => a + Number(v.total), 0)
    setStats({ productos: productos || 0, categorias: categorias_count || 0, ventas_hoy: (ventas || []).length, total_hoy })
    setStockBajo((activos || []).filter(p => p.stock === 1))
    setStockCero((activos || []).filter(p => p.stock <= 0))
    setInactivos(todos || [])
    setCategorias(cats || [])
    setCargando(false)
  }

  function irAEditar(id) { navigate(`/admin/productos?editar=${id}`) }

  const bajFiltrado      = filtroCat ? stockBajo.filter(p => p.categoria_id  === filtroCat) : stockBajo
  const ceroFiltrado     = filtroCat ? stockCero.filter(p => p.categoria_id  === filtroCat) : stockCero
  const inactivosFiltrado = filtroCat ? inactivos.filter(p => p.categoria_id === filtroCat) : inactivos

  const cards = [
    { label: 'Productos activos',  valor: stats.productos,                    icon: Package,    color: 'var(--naranja)' },
    { label: 'Categorías',         valor: stats.categorias,                   icon: Tag,        color: '#7C3AED'        },
    { label: 'Ventas hoy',         valor: stats.ventas_hoy,                   icon: ShoppingBag, color: '#059669'       },
    { label: 'Total vendido hoy',  valor: `S/ ${stats.total_hoy.toFixed(2)}`, icon: ShoppingBag, color: '#0284C7'       },
  ]

  if (cargando) return <div className="spinner" />

  const hayAlertas = stockBajo.length > 0 || stockCero.length > 0 || inactivos.length > 0

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800, marginBottom: 24 }}>
        Dashboard<span style={{ color: 'var(--naranja)' }}>.</span>
      </h1>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        {cards.map(({ label, valor, icon: Icon, color }) => (
          <div key={label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--texto-suave)' }}>{label}</p>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={color} />
              </div>
            </div>
            <p style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800 }}>{valor}</p>
          </div>
        ))}
      </div>

      {/* Filtro categoría */}
      {hayAlertas && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ minWidth: 200, fontSize: 13 }}>
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {filtroCat && (
            <button onClick={() => setFiltroCat('')} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
              ✕ Limpiar
            </button>
          )}
        </div>
      )}

      {/* Stock bajo — solo 1 */}
      {bajFiltrado.length > 0 && (
        <div className="card" style={{ padding: '18px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={18} color="#E65100" />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#E65100' }}>Stock bajo — quedan solo 1</h2>
            <span style={{ fontSize: 12, color: 'var(--texto-suave)', marginLeft: 4 }}>· Clic para editar</span>
            <span className="badge badge-naranja" style={{ marginLeft: 'auto' }}>{bajFiltrado.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bajFiltrado.map(p => (
              <button key={p.id} onClick={() => irAEditar(p.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFF3E0', borderRadius: 8, border: '1px solid #FFCC80', cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FFE0B2'; e.currentTarget.style.borderColor = 'var(--naranja)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFF3E0'; e.currentTarget.style.borderColor = '#FFCC80' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                  {p.categorias?.nombre && <span style={{ fontSize: 11, color: 'var(--texto-suave)', marginLeft: 8 }}>· {p.categorias.nombre}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="badge badge-naranja">Stock: {p.stock}</span>
                  <span style={{ fontSize: 11, color: 'var(--naranja)', fontWeight: 500 }}>✏️ Editar →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stock en 0 */}
      {ceroFiltrado.length > 0 && (
        <div className="card" style={{ padding: '18px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <XCircle size={18} color="#C62828" />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#C62828' }}>Sin stock — agotados</h2>
            <span style={{ fontSize: 12, color: 'var(--texto-suave)', marginLeft: 4 }}>· Clic para editar</span>
            <span className="badge badge-rojo" style={{ marginLeft: 'auto' }}>{ceroFiltrado.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ceroFiltrado.map(p => (
              <button key={p.id} onClick={() => irAEditar(p.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFEBEE', borderRadius: 8, border: '1px solid #FFCDD2', cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FFCDD2'; e.currentTarget.style.borderColor = '#C62828' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFEBEE'; e.currentTarget.style.borderColor = '#FFCDD2' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                  {p.categorias?.nombre && <span style={{ fontSize: 11, color: 'var(--texto-suave)', marginLeft: 8 }}>· {p.categorias.nombre}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="badge badge-rojo">Agotado</span>
                  <span style={{ fontSize: 11, color: '#C62828', fontWeight: 500 }}>✏️ Editar →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Productos inactivos */}
      {inactivosFiltrado.length > 0 && (
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: verInactivos ? 14 : 0 }}>
            <EyeOff size={18} color="#666" />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#555' }}>Productos inactivos</h2>
            <span style={{ fontSize: 12, color: 'var(--texto-suave)', marginLeft: 4 }}>· No visibles en la tienda</span>
            <span className="badge badge-gris" style={{ marginLeft: 'auto' }}>{inactivosFiltrado.length}</span>
            <button onClick={() => setVerInactivos(!verInactivos)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--naranja)', fontWeight: 500, marginLeft: 4 }}>
              {verInactivos ? 'Ocultar' : 'Ver todos'}
            </button>
          </div>
          {verInactivos && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {inactivosFiltrado.map(p => (
                <button key={p.id} onClick={() => irAEditar(p.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F5F5F5', borderRadius: 8, border: '1px solid #E0E0E0', cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#EEEEEE'; e.currentTarget.style.borderColor = '#BDBDBD' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F5F5F5'; e.currentTarget.style.borderColor = '#E0E0E0' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#555' }}>{p.nombre}</span>
                    {p.categorias?.nombre && <span style={{ fontSize: 11, color: 'var(--texto-suave)', marginLeft: 8 }}>· {p.categorias.nombre}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {Number(p.precio || 0) === 0 && <span className="badge badge-rojo">Sin precio</span>}
                    {p.stock <= 0 && <span className="badge badge-gris">Sin stock</span>}
                    <span style={{ fontSize: 11, color: '#777', fontWeight: 500 }}>✏️ Editar →</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
