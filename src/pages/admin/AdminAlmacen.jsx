import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { exportarCSV } from '../../lib/exportar'
import { Package, Search, Download, Plus, Pencil, Trash2, X, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminAlmacen() {
  const [productos, setProductos]       = useState([])
  const [sucursales, setSucursales]     = useState([])
  const [secciones, setSecciones]       = useState([])
  const [cargando, setCargando]         = useState(true)
  const [busqueda, setBusqueda]         = useState('')
  const [filtroSucursal, setFiltroSucursal] = useState('')
  const [filtroSeccion, setFiltroSeccion]   = useState('')
  const [modalSucursal, setModalSucursal]   = useState(false)
  const [modalSeccion, setModalSeccion]     = useState(false)
  const [formSucursal, setFormSucursal] = useState({ nombre: '', direccion: '' })
  const [formSeccion, setFormSeccion]   = useState({ nombre: '', descripcion: '', sucursal_id: '' })
  const [editandoSucursal, setEditandoSucursal] = useState(null)
  const [editandoSeccion, setEditandoSeccion]   = useState(null)
  const navigate = useNavigate()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const [{ data: prods }, { data: sucs }, { data: secs }] = await Promise.all([
      supabase.from('productos').select('*, sucursales(nombre), secciones(nombre)').order('nombre'),
      supabase.from('sucursales').select('*').order('nombre'),
      supabase.from('secciones').select('*, sucursales(nombre)').order('nombre'),
    ])
    setProductos(prods || [])
    setSucursales(sucs || [])
    setSecciones(secs || [])
    setCargando(false)
  }

  // Secciones filtradas por sucursal seleccionada
  const seccionesFiltradas = filtroSucursal
    ? secciones.filter(s => s.sucursal_id === filtroSucursal)
    : secciones

  const productosFiltrados = productos.filter(p => {
    const matchBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchSuc  = filtroSucursal ? p.sucursal_id === filtroSucursal : true
    const matchSec  = filtroSeccion  ? p.seccion_id  === filtroSeccion  : true
    return matchBusq && matchSuc && matchSec
  })

  async function actualizarStock(id, nuevoStock) {
    if (nuevoStock < 0) return
    const { error } = await supabase.from('productos').update({ stock: nuevoStock, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return toast.error('Error al actualizar stock')
    toast.success('Stock actualizado ✅')
    cargar()
  }

  // — Sucursales CRUD
  function abrirNuevaSucursal() {
    setFormSucursal({ nombre: '', direccion: '' })
    setEditandoSucursal(null)
    setModalSucursal(true)
  }
  function abrirEditarSucursal(s) {
    setFormSucursal({ nombre: s.nombre, direccion: s.direccion || '' })
    setEditandoSucursal(s)
    setModalSucursal(true)
  }
  async function guardarSucursal() {
    if (!formSucursal.nombre.trim()) return toast.error('El nombre es obligatorio')
    if (editandoSucursal) {
      await supabase.from('sucursales').update(formSucursal).eq('id', editandoSucursal.id)
      toast.success('Sucursal actualizada')
    } else {
      await supabase.from('sucursales').insert(formSucursal)
      toast.success('Sucursal creada')
    }
    setModalSucursal(false)
    cargar()
  }
  async function eliminarSucursal(s) {
    if (!confirm(`¿Eliminar sucursal "${s.nombre}"? Se eliminarán todas sus secciones.`)) return
    await supabase.from('sucursales').delete().eq('id', s.id)
    toast.success('Sucursal eliminada')
    cargar()
  }

  // — Secciones CRUD
  function abrirNuevaSeccion() {
    setFormSeccion({ nombre: '', descripcion: '', sucursal_id: sucursales[0]?.id || '' })
    setEditandoSeccion(null)
    setModalSeccion(true)
  }
  function abrirEditarSeccion(s) {
    setFormSeccion({ nombre: s.nombre, descripcion: s.descripcion || '', sucursal_id: s.sucursal_id })
    setEditandoSeccion(s)
    setModalSeccion(true)
  }
  async function guardarSeccion() {
    if (!formSeccion.nombre.trim()) return toast.error('El nombre es obligatorio')
    if (!formSeccion.sucursal_id) return toast.error('Selecciona una sucursal')
    if (editandoSeccion) {
      await supabase.from('secciones').update(formSeccion).eq('id', editandoSeccion.id)
      toast.success('Sección actualizada')
    } else {
      await supabase.from('secciones').insert(formSeccion)
      toast.success('Sección creada')
    }
    setModalSeccion(false)
    cargar()
  }
  async function eliminarSeccion(s) {
    if (!confirm(`¿Eliminar sección "${s.nombre}"?`)) return
    await supabase.from('secciones').delete().eq('id', s.id)
    toast.success('Sección eliminada')
    cargar()
  }

  function handleExportar() {
    if (productosFiltrados.length === 0) return toast.error('No hay productos para exportar')
    exportarCSV('almacen', [
      ['Producto', 'Sucursal', 'Sección', 'Stock', 'Stock Mínimo', 'Precio (S/)'],
      ...productosFiltrados.map(p => [
        p.nombre,
        p.sucursales?.nombre || 'Sin sucursal',
        p.secciones?.nombre  || 'Sin sección',
        p.stock,
        p.stock_minimo,
        Number(p.precio).toFixed(2)
      ])
    ])
    toast.success('Excel exportado ✅')
  }

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
          Almacén<span style={{ color: 'var(--naranja)' }}>.</span>
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={abrirNuevaSucursal} className="btn-ghost" style={{ fontSize: 13 }}>
            <Plus size={14} /> Sucursal
          </button>
          <button onClick={abrirNuevaSeccion} className="btn-ghost" style={{ fontSize: 13 }}>
            <Plus size={14} /> Sección
          </button>
          <button onClick={handleExportar} className="btn-ghost" style={{ fontSize: 13 }}>
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Sucursales resumen */}
      {sucursales.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {sucursales.map(s => (
            <div key={s.id} style={{ background: filtroSucursal === s.id ? 'var(--naranja-light)' : 'var(--blanco)', border: `1.5px solid ${filtroSucursal === s.id ? 'var(--naranja)' : 'var(--borde)'}`, borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => { setFiltroSucursal(filtroSucursal === s.id ? '' : s.id); setFiltroSeccion('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: filtroSucursal === s.id ? 'var(--naranja)' : 'var(--texto)' }}>
                {s.nombre}
              </button>
              <button onClick={() => abrirEditarSucursal(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-suave)', display: 'flex' }}>
                <Pencil size={12} />
              </button>
              <button onClick={() => eliminarSucursal(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D00', display: 'flex' }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-suave)' }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto..." style={{ paddingLeft: 32 }} />
        </div>
        <select value={filtroSeccion} onChange={e => setFiltroSeccion(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">Todas las secciones</option>
          {seccionesFiltradas.map(s => (
            <option key={s.id} value={s.id}>{s.nombre} {!filtroSucursal && s.sucursales?.nombre ? `(${s.sucursales.nombre})` : ''}</option>
          ))}
        </select>
      </div>

      <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 14 }}>{productosFiltrados.length} productos</p>

      {/* Lista productos */}
      {cargando ? <div className="spinner" /> : productosFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>
          <Package size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <p>No hay productos en esta sección</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {productosFiltrados.map(p => (
            <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
              {p.imagen_url
                ? <img src={p.imagen_url} alt={p.nombre} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }} onClick={() => navigate('/admin/productos')} />
                : <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={20} color="var(--borde)" />
                  </div>
              }
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate('/admin/productos')}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  {p.secciones?.nombre && (
                    <span style={{ fontSize: 11, background: 'var(--naranja-light)', color: 'var(--naranja-dark)', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                      📍 {p.secciones.nombre}
                    </span>
                  )}
                  {p.sucursales?.nombre && (
                    <span style={{ fontSize: 11, background: 'var(--fondo)', color: 'var(--texto-suave)', padding: '2px 8px', borderRadius: 20 }}>
                      🏪 {p.sucursales.nombre}
                    </span>
                  )}
                  {!p.secciones?.nombre && (
                    <span style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Sin sección asignada</span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginBottom: 4 }}>Stock</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => actualizarStock(p.id, p.stock - 1)}
                    style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--fondo)', border: '1px solid var(--borde)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>−</button>
                  <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 16, minWidth: 28, textAlign: 'center', color: p.stock <= p.stock_minimo ? '#E65100' : 'var(--texto)' }}>
                    {p.stock}
                  </span>
                  <button onClick={() => actualizarStock(p.id, p.stock + 1)}
                    style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--naranja-light)', border: '1px solid var(--naranja-mid)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--naranja)' }}>+</button>
                </div>
              </div>
              <span className={`badge ${p.activo ? 'badge-verde' : 'badge-gris'}`} style={{ flexShrink: 0 }}>
                {p.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Modal Sucursal */}
      {modalSucursal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18 }}>
                {editandoSucursal ? 'Editar sucursal' : 'Nueva sucursal'}
              </h2>
              <button onClick={() => setModalSucursal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-suave)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Nombre *</label>
                <input value={formSucursal.nombre} onChange={e => setFormSucursal({ ...formSucursal, nombre: e.target.value })} placeholder="Ej: Sucursal Centro" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Dirección</label>
                <input value={formSucursal.direccion} onChange={e => setFormSucursal({ ...formSucursal, direccion: e.target.value })} placeholder="Ej: Av. Principal 123" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setModalSucursal(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
                <button onClick={guardarSucursal} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {editandoSucursal ? 'Guardar cambios' : 'Crear sucursal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sección */}
      {modalSeccion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18 }}>
                {editandoSeccion ? 'Editar sección' : 'Nueva sección'}
              </h2>
              <button onClick={() => setModalSeccion(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-suave)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Sucursal *</label>
                <select value={formSeccion.sucursal_id} onChange={e => setFormSeccion({ ...formSeccion, sucursal_id: e.target.value })}>
                  <option value="">Selecciona una sucursal</option>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Nombre *</label>
                <input value={formSeccion.nombre} onChange={e => setFormSeccion({ ...formSeccion, nombre: e.target.value })} placeholder="Ej: Andamio A" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Descripción</label>
                <input value={formSeccion.descripcion} onChange={e => setFormSeccion({ ...formSeccion, descripcion: e.target.value })} placeholder="Descripción opcional" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setModalSeccion(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
                <button onClick={guardarSeccion} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {editandoSeccion ? 'Guardar cambios' : 'Crear sección'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
